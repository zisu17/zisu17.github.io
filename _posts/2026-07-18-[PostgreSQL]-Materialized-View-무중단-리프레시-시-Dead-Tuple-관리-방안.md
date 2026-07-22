---
title: "[PostgreSQL] Materialized View 무중단 리프레시 시 Dead Tuple 관리 방안"
excerpt: "REFRESH MATERIALIZED VIEW CONCURRENTLY가 Dead Tuple을 누적시키는 구조와 정기 제거, 발생 최소화, 모니터링 운영 방안을 정리한다."

categories:
  - Database
tags:
  - Data
  - PostgreSQL
  - MaterializedView
  - DeadTuple
  - VACUUM

permalink: /data/postgresql-mview-concurrent-refresh-dead-tuple/

toc: true
toc_sticky: true

date: 2026-07-18
last_modified_at: 2026-07-18
---

## 1. 문제 상황

조회 성능을 위해 **Materialized View(MVIEW)** 를 만들어 두고 주기적으로 리프레시하는 구성은 흔하다. 서비스 중에도 조회가 끊기면 안 되므로 리프레시는 `REFRESH MATERIALIZED VIEW CONCURRENTLY`로 수행한다.

그런데 이 방식은 리프레시할 때마다 갱신된 로우 수만큼 **Dead Tuple(비활성 레코드)** 을 남긴다. VACUUM이 제때 회수하지 못하면 다음 문제가 누적된다.

- 테이블/인덱스 **bloat** 증가
- 조회 성능 저하 (Seq Scan / Index Scan 비용 증가)
- **Autovacuum 부하** 증가와 유지비용 상승

무중단 리프레시는 운영에 필수지만 Dead Tuple 누적은 이 방식의 구조적인 한계다. 따라서 Dead Tuple을 **정기적으로 제거**하고, **발생 자체를 최소화**하고, **지표로 감시**하는 운영 방안이 필요하다. 이 글에서는 그 세 가지를 차례로 정리한다.

본문의 스키마명, 테이블명, 시간대는 모두 예시 값이다. 통계 MVIEW는 `mart.mv_sales_stats`로 두고 설명한다.

---

## 2. CONCURRENTLY 리프레시가 Dead Tuple을 만드는 구조

`REFRESH MATERIALIZED VIEW`는 옵션에 따라 동작 방식이 완전히 다르다.

### 2.1 일반 리프레시와 무중단 리프레시

**일반 REFRESH**는 쿼리 결과 전체를 새 저장 공간(relfilenode)에 다시 쓰고 기존 것과 통째로 교체한다. 내부적으로 DROP + CREATE에 가까운 동작이라 Dead Tuple과 bloat이 남지 않는다. 대신 ACCESS EXCLUSIVE 잠금을 잡기 때문에 리프레시가 끝날 때까지 조회가 대기한다.

**REFRESH CONCURRENTLY**는 새 결과를 임시 테이블에 만든 뒤, MVIEW에 정의된 유니크 인덱스를 기준으로 기존 데이터와 비교해 달라진 로우만 DELETE와 INSERT로 반영한다. 조회는 리프레시 중에도 계속 가능하다.

문제는 PostgreSQL의 MVCC 구조다. DELETE와 UPDATE는 기존 로우를 즉시 지우지 않고 Dead Tuple로 남긴다. 결국 CONCURRENTLY 리프레시는 **갱신된 로우 수만큼 Dead Tuple을 만드는 것이 정상 동작**이다.

| 구분 | REFRESH | REFRESH CONCURRENTLY |
|---|---|---|
| 동작 방식 | 새 저장 공간에 전체 재작성 후 교체 | 기존 데이터와 비교 후 변경분만 DELETE/INSERT |
| 리프레시 중 조회 | 대기 (블로킹) | 가능 (무중단) |
| Dead Tuple | 남지 않음 (bloat 일괄 제거) | 갱신 로우 수만큼 누적 |
| 요구 조건 | 없음 | 전체 로우를 포함하는 유니크 인덱스 필수 |

무중단의 대가로 Dead Tuple을 얻는 구조이므로 어느 한쪽만 쓸 수는 없다. 두 방식을 시간대에 따라 조합하는 것이 현실적인 답이 된다.

---

## 3. 정기 제거: 시간대별 리프레시 이원화

운영 시간에는 CONCURRENTLY로 무중단을 보장하고, 서비스 이용이 거의 없는 운영외 시간에 하루 1회 일반 REFRESH를 수행해 그동안 쌓인 Dead Tuple을 일괄 제거한다.

| 시간대 (예시) | 리프레시 방식 | 목적 |
|---|---|---|
| 운영 시간 06:00~24:00 | `REFRESH ... CONCURRENTLY` | 서비스 조회 무중단 보장 |
| 운영외 시간 03:30~06:00 | `REFRESH` (CONCURRENTLY 미사용) | Dead Tuple, bloat 일괄 제거 |

파이프라인은 스케줄러가 시간대를 판단해 워커를 나눠 실행하는 구조로 만든다.

```text
리프레시 스케줄러
 ├─ 운영 시간   → 주기 리프레시 워커 (CONCURRENTLY)
 └─ 운영외 시간 → 심야 배치 워커 (일반 REFRESH, 전체 재작성)
```

이 방식의 장점은 **bloat까지 원복된다**는 점이다. autovacuum이 Dead Tuple을 회수해도 재사용 가능 공간으로 바뀔 뿐 이미 커진 파일 크기는 줄지 않는다. 일반 REFRESH는 새 저장 공간에 전체를 다시 쓰므로 테이블과 인덱스가 최소 크기로 돌아온다. 어차피 최신 데이터로 다시 써야 하는 리프레시 작업에 재작성 비용을 겸하게 하는 셈이다.

운영외 시간 리프레시 동안에는 조회가 블로킹되므로, 배치 창은 서비스 영향이 없는 시간으로 잡고 최대 종료 시각(예: 06:30)을 정해 운영 시간과 겹치지 않게 한다.

---

## 4. 발생 최소화: 유니크 키의 Nullable 컬럼 제거

> 원천 테이블에 변경이 없으면 리프레시해도 Dead Tuple이 안 생기는 것 아닌가?

그렇지 않다. 유니크 키에 Null이 허용된 컬럼이 포함되면 원천 데이터에 변경이 전혀 없어도 리프레시마다 Dead Tuple이 대량 발생할 수 있다.

### 4.1 Null 키가 매칭을 깨는 이유

CONCURRENTLY는 유니크 키를 기준으로 기존 로우와 새 로우를 매칭해 변경 여부를 판단한다. 그런데 PostgreSQL에서 `NULL = NULL` 비교는 참이 되지 않고, UNIQUE INDEX도 Null을 서로 다른 값으로 취급한다.

그래서 유니크 키 컬럼에 Null이 있으면 다음이 벌어진다.

- 동일한 논리적 로우인데도 기존 로우와 새 로우의 매칭이 실패한다
- 기존 로우는 DELETE, 새 로우는 INSERT로 처리된다
- 리프레시할 때마다 해당 로우 전부가 Dead Tuple로 남는다

### 4.2 실험: 리프레시 1회가 만든 99.75%의 Dead Tuple

약 500만 건 규모의 통계 MVIEW로 확인한 결과다. 원천 데이터 변경이 없는 상태에서 CONCURRENTLY 리프레시를 1회만 수행했다.

| 구분 | 최초 | 리프레시 1회 후 |
|---|---|---|
| 유니크 키에 Nullable 컬럼 포함 | live 4,978,765 / dead 0 (0%) | live 4,978,789 / **dead 4,966,551 (99.75%)** |
| COALESCE로 Null 치환 후 유니크 키 구성 | live 4,978,765 / dead 0 (0%) | live 4,979,045 / **dead 0 (0%)** |

Nullable 컬럼이 키에 들어간 쪽은 단 1회 리프레시로 테이블 전체가 한 번씩 지워졌다 다시 쓰인 상태가 됐다. 반면 Null을 치환한 쪽은 Dead Tuple이 전혀 발생하지 않았다.

### 4.3 개선 방법

MVIEW 유니크 키 컬럼은 다음 조건을 만족하도록 설계한다.

- **NOT NULL 보장**
- 논리적으로 로우를 유일하게 식별할 수 있는 컬럼 조합

Null일 수 있는 컬럼이 키에 꼭 필요하다면 MVIEW 정의 단계에서 **COALESCE로 치환한 컬럼**을 만들고, 그 컬럼으로 유니크 인덱스를 구성한다.

```sql
CREATE MATERIALIZED VIEW mart.mv_sales_stats AS
SELECT org_id,
       item_code,
       COALESCE(sub_code, '') AS sub_code,  -- Null 치환
       SUM(amount)            AS total_amount
  FROM mart.sales_raw
 GROUP BY org_id, item_code, COALESCE(sub_code, '');

CREATE UNIQUE INDEX ux_mv_sales_stats
    ON mart.mv_sales_stats (org_id, item_code, sub_code);
```

한 가지 주의할 점이 있다. `COALESCE(sub_code, '')`를 인덱스 식으로 직접 쓰는 표현식 인덱스는 CONCURRENTLY의 유니크 인덱스 요건을 충족하지 못한다. PostgreSQL은 컬럼명만으로 구성된 유니크 인덱스를 요구하므로, Null 치환은 반드시 MVIEW 정의(SELECT) 단계에서 해야 한다.

---

## 5. 모니터링: pg_stat_user_tables

Dead Tuple 현황은 테이블 단위 통계 뷰인 `pg_stat_user_tables`로 확인한다.

| 지표 | 의미 |
|---|---|
| `n_live_tup` | 현재 유효한 로우 수 |
| `n_dead_tup` | Dead Tuple 수 |
| `last_vacuum` / `last_autovacuum` | 최근 (auto)vacuum 시각 |
| `last_analyze` | 최근 analyze 시각 |

```sql
SELECT relname,
       n_live_tup,
       n_dead_tup,
       ROUND(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 2) AS dead_ratio,
       last_vacuum,
       last_autovacuum
  FROM pg_stat_user_tables
 WHERE schemaname = 'mart'
 ORDER BY dead_ratio DESC NULLS LAST;
```

Dead Tuple 비율(`n_dead_tup / n_live_tup`)에 대한 운영 기준 예시는 다음과 같다.

- **10% 이상**: 관찰 대상
- **20% 이상**: 운영외 시간 일반 리프레시(전체 재작성) 검토

비율 기준을 두면 문제가 커진 MVIEW만 골라 조치할 수 있다. 다만 심야 배치 창에 여유가 있다면 비율과 관계없이 모든 MVIEW를 매일 전체 재작성하는 단순한 운영도 유효하다. 판단 로직이 없어 운영이 쉽고, Dead Tuple이 하루 이상 누적되지 않기 때문이다.

---

## 6. 정리

- `REFRESH MATERIALIZED VIEW CONCURRENTLY`는 무중단 조회를 보장하는 대신 변경분을 DELETE/INSERT로 반영하므로 **갱신 로우 수만큼 Dead Tuple을 남긴다**.
- **시간대 이원화**로 정기 제거한다. 운영 시간은 CONCURRENTLY, 운영외 시간은 일반 REFRESH로 하루 1회 전체 재작성해 Dead Tuple과 bloat를 함께 제거한다.
- **유니크 키에 Nullable 컬럼을 넣지 않는다**. Null 키는 로우 매칭 실패로 이어져 변경이 없어도 전량 DELETE/INSERT가 발생한다. 필요하면 MVIEW 정의에서 COALESCE로 치환한 뒤 키를 구성한다.
- `pg_stat_user_tables`의 **Dead Tuple 비율**을 감시하고, 기준(예: 20%)을 넘으면 전체 재작성을 검토한다.
