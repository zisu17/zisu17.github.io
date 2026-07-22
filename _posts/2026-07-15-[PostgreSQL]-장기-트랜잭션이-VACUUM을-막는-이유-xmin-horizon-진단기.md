---
title: "[PostgreSQL] 장기 트랜잭션이 VACUUM을 막는 이유: xmin horizon 진단기"
excerpt: "Seq Scan 반복에서 시작해 26일간 열려 있던 장기 트랜잭션에 도달한 진단 과정과, 무관한 테이블의 트랜잭션이 VACUUM을 막는 MVCC 스냅샷 원리, 조치 뒤 이어진 MVIEW 리프레시 지연 후속 이슈까지 정리한다."

categories:
  - Database
tags:
  - Data
  - PostgreSQL
  - VACUUM
  - MVCC
  - 트랜잭션
  - 실행계획

permalink: /data/postgresql-long-transaction-vacuum-xmin-horizon/

toc: true
toc_sticky: true

date: 2026-07-15
last_modified_at: 2026-07-16
---

## 1. 문제 상황

운영 중인 어느 DW 리포트 테이블의 실행 계획에서 **Seq Scan**이 반복 발생했다. 이 글에서는 테이블명을 `mart.sales_summary`, 데이터베이스명을 `analytics_db`로 두고 설명한다. 본문에 등장하는 테이블명·데이터베이스명·계정명 등 식별자는 모두 예시 값이다.

처음에는 인덱스 손상을 의심해 **REINDEX** 필요 여부를 검토했다.

확인 결과 원인은 인덱스가 아니었다. **VACUUM이 데드튜플을 회수하지 못해** 테이블이 심각하게 bloat된 상태였고, 근본 원인은 같은 데이터베이스에서 **26일간 종료되지 않은 장기 트랜잭션**이 데드튜플 제거 기준선(**xmin horizon**)을 고정하고 있었기 때문이다.

이 글은 그 진단 과정을 순서대로 따라간다. REINDEX 검토에서 출발해 xmin horizon에 도달하기까지의 확인 절차와, 조치 후 재발을 막기 위한 장치까지 다룬다. 조치 다음 날 이어진 후속 이슈(통계 갱신에 의한 MVIEW 리프레시 실행 계획 회귀)도 함께 다룬다.

---

## 2. 증상: 데드튜플이 라이브 튜플의 17배

데드튜플 현황을 `pg_stat_user_tables`로 조회했다.

```sql
SELECT schemaname, relname, n_live_tup, n_dead_tup,
       round(n_dead_tup::numeric / NULLIF(n_live_tup,0) * 100, 2) AS dead_pct,
       n_mod_since_analyze, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE relname = 'sales_summary';
```

결과는 다음과 같았다.

| 지표                | 값           |
| ----------------- | ----------- |
| `n_live_tup`      | 8,176,502   |
| `n_dead_tup`      | 140,985,751 |
| `dead_pct`        | 1,724.28%   |
| `last_autovacuum` | 당일 새벽 01:27 |

두 가지가 비정상이다.

첫째, **데드튜플이 라이브 튜플의 약 17배**다. autovacuum이 정상적으로 동작한다면 나타나기 어려운 수치다.

둘째, 당일 새벽 autovacuum이 **완료**했는데도(`last_autovacuum` 기록) 데드튜플이 그대로 남아 있다. VACUUM이 실행되지 않은 것이 아니라, 실행됐지만 데드튜플을 **아직 지울 수 없다고 판정해 건너뛰고 있다**는 신호다.

---

## 3. 첫 번째 가설: 잦은 ANALYZE의 락 간섭

대상 테이블에는 통계 갱신을 위한 ANALYZE가 자주 실행되고 있었다. 테이블 옵션을 조정해 통계가 자주 갱신되도록 설정한 상태였다. 그래서 첫 가설은 잦은 ANALYZE가 VACUUM에 필요한 락을 계속 점유해 데드튜플 회수를 방해한다는 것이었다.

가설 자체는 성립한다. ANALYZE와 VACUUM은 모두 **SHARE UPDATE EXCLUSIVE** 락을 잡고, 이 락은 **자기 자신과 충돌**한다. 수동 또는 스케줄 ANALYZE가 잦으면 진행 중인 autovacuum을 취소시켜 정상 완료를 방해할 수 있다.

그러나 이번 사례는 여기에 해당하지 않았다. 2장에서 봤듯 `last_autovacuum`에 **정상 완료 기록**이 남아 있다. 락 충돌로 취소됐다면 작업을 완료하지 못했을 것이다. VACUUM이 실행됐지만 데드튜플을 회수하지 못한 상황이므로 다른 원인을 찾아야 했다.

역할도 구분해 둔다. **ANALYZE는 데드튜플을 제거하지 않는다.** 데드튜플 회수는 온전히 **VACUUM**의 역할이고, autovacuum 데몬은 두 작업을 **각각 다른 임계치**로 트리거한다.

| 구분 | ANALYZE | VACUUM |
|---|---|---|
| 역할 | 통계(pg_statistic) 갱신 | 데드튜플 회수 |
| 데드튜플 처리 | 하지 않음 | 수행 |
| 트리거 임계치 | `autovacuum_analyze_scale_factor` | `autovacuum_vacuum_scale_factor` |
| 락 종류 | SHARE UPDATE EXCLUSIVE | SHARE UPDATE EXCLUSIVE |

---

## 4. 원인 추적: backend_xmin을 장기간 유지한 백엔드

VACUUM이 지울 수 없다는 판정을 내리는 기준은 **가장 오래된 스냅샷**이다. `pg_stat_activity`에서 `backend_xmin`을 장기간 유지하고 있는 백엔드를 조회했다.

```sql
SELECT pid, state, usename, datname,
       now() - xact_start AS xact_age,
       age(backend_xmin)  AS xmin_age,
       left(query, 120)   AS query
FROM pg_stat_activity
WHERE backend_xmin IS NOT NULL
ORDER BY age(backend_xmin) DESC
LIMIT 20;
```

최상단에 **26일째 종료되지 않은 트랜잭션 1건**이 나왔다.

| 항목 | 값 |
|---|---|
| pid | 977298 |
| state | active |
| usename | app_user |
| datname | analytics_db |
| xact_age | 26일 20시간 |
| xmin_age | 2,238,153 |
| query | `COPY (SELECT * FROM user_data.large_table) TO STDOUT WITH (FORMAT CSV, ...)` |

`COPY ... TO STDOUT`은 실행되는 동안 **하나의 스냅샷을 유지**한다. 이 백엔드가 26일 전 스냅샷을 해제하지 않으므로, 그 이후 생성된 모든 데드튜플은 여전히 참조될 수 있다고 판정되어 회수할 수 없게 된다.

state가 active인데 26일째라는 점이 단서다. 클라이언트(데이터 추출 잡)가 비정상 종료됐지만 연결이 정리되지 않은 **비정상 백엔드**로 추정된다. COPY가 클라이언트로 데이터를 전송하지 못하고 **ClientWrite 대기** 상태에 머물러 있을 가능성이 높다.

장기 트랜잭션 외에도 xmin을 고정하는 요인이 있으므로 함께 점검한다.

- 장기 실행/방치된 트랜잭션 (`pg_stat_activity.backend_xmin`)
- prepared transaction, 2PC (`pg_prepared_xacts`)
- 비활성 복제 슬롯 (`pg_replication_slots.xmin`)

```sql
SELECT slot_name, active, age(xmin) AS xmin_age
FROM pg_replication_slots;

SELECT gid, prepared, now() - prepared AS age
FROM pg_prepared_xacts;
```

---

## 5. MVCC 핵심 원리: 스냅샷은 테이블 단위가 아니다

여기서 MVCC에서 가장 오해하기 쉬운 질문이 나온다.

> "COPY가 읽는 것은 user_data 스키마의 전혀 다른 테이블이다. 왜 무관한 mart.sales_summary의 VACUUM까지 막는가?"

결론부터 말하면, **테이블과 무관하게 막는다.**

VACUUM의 데드튜플 제거 기준선(xmin horizon)은 **테이블별로 계산되지 않는다**. 데이터베이스 단위로 **가장 오래된 스냅샷 하나**를 기준으로 정해진다. 어떤 트랜잭션이 어떤 테이블에 접근하는지는 고려 대상이 아니다.

이유는 스냅샷의 정의에 있다. 스냅샷은 특정 시점의 **데이터베이스 전체 상태**를 가리킨다. 트랜잭션이 열려 있는 한 언제든 임의의 테이블을 조회할 수 있으므로, PostgreSQL은 이 트랜잭션이 특정 테이블을 절대 보지 않는다는 것을 증명할 수 없다. 따라서 스냅샷 시점에 살아 있던 행을 **모든 테이블에서** 보존한다.

```text
스냅샷은 데이터베이스 전체의 특정 순간을 찍은 사진이다.
누군가 그 사진을 들고 있는 한,
사진에 찍힌 모든 행은 어느 테이블에 있든 지울 수 없다.
```

`backend_xmin`이 `NULL`이 아니고 age가 크다는 사실 자체가, 이 백엔드가 제거 기준선을 유지하고 있다는 **직접적인 근거**다. 진단 쿼리에서 해당 백엔드가 최상단에 나온 것으로 원인을 확인할 수 있다.

한 가지 구분할 점이 있다. **PostgreSQL 14 이상**은 horizon을 카탈로그 / 일반 데이터 / temp / shared 테이블 부류로 나눠 계산하고, **다른 데이터베이스**의 트랜잭션은 일반 테이블 회수에서 무시한다. 그러나 **같은 데이터베이스 안의 일반 테이블끼리는 구분하지 않는다**. 문제의 COPY는 `analytics_db`의 일반 테이블을 읽는 일반 트랜잭션이므로, `analytics_db` 안 모든 일반 테이블의 horizon을 고정한다.

---

## 6. 진단 절차 요약

같은 상황을 만나면 다음 순서로 확인한다.

1. **데드튜플 현황**: `pg_stat_user_tables`에서 dead_pct, last_autovacuum 확인 (2장 쿼리)
2. **xmin 고정 백엔드**: `pg_stat_activity`를 backend_xmin age 내림차순으로 조회 (4장 쿼리)
3. **그 외 고정 요인**: `pg_replication_slots`, `pg_prepared_xacts` (4장 쿼리)
4. **실증**: `VACUUM (VERBOSE)` 출력의 oldest xmin 확인

검증 단계가 중요하다. VERBOSE 출력의 **oldest xmin** 값과 `cannot be removed yet` 건수를 확인한다. 이 xmin이 2단계에서 찾은 백엔드의 xmin과 일치하면 원인을 확인할 수 있다.

```sql
VACUUM (VERBOSE) mart.sales_summary;
```

---

## 7. 조치: 백엔드 종료, 그리고 VACUUM이 못 하는 일

조치는 다섯 단계로 진행한다.

1. **대상 백엔드 상세 확인**: wait_event로 비정상 대기 여부 판단
2. **백엔드 종료**: `pg_terminate_backend`
3. **VACUUM 실행**: xmin 해제 후 데드튜플 회수
4. **물리 파일 수축**: pg_repack 권장
5. **DB 전역 영향 점검**: 다른 테이블 bloat 확인

```sql
-- 1) 종료 전 상태 확인
SELECT pid, state, wait_event_type, wait_event, xact_start
FROM pg_stat_activity WHERE pid = 977298;

-- 2) 백엔드 종료
SELECT pg_terminate_backend(977298);

-- 5) DB 전역 bloat 점검
SELECT schemaname, relname, n_live_tup, n_dead_tup,
       round(n_dead_tup::numeric / NULLIF(n_live_tup,0) * 100, 2) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 100000
ORDER BY n_dead_tup DESC LIMIT 30;
```

백엔드 종료가 안전한 근거는 명확하다. 문제 쿼리는 `COPY ... TO STDOUT`, 즉 **읽기 작업**이라 강제 종료로 롤백돼도 데이터 변경 영향이 없다.

주의점이 두 가지 있다.

**VACUUM은 파일 크기를 줄이지 않는다.** 데드튜플이 차지하던 공간을 재사용 가능으로 표시할 뿐이다. 이미 부풀어 오른 물리 파일의 수축은 **pg_repack** 또는 VACUUM FULL로 별도 수행해야 한다. VACUUM FULL은 **ACCESS EXCLUSIVE** 락을 잡아 운영 중에는 위험하므로 pg_repack을 권장한다.

**영향 범위는 테이블 하나가 아니다.** 26일간 데이터베이스 전체의 데드튜플 회수가 막혀 있었으므로, 다른 테이블의 bloat도 반드시 함께 점검한다.

---

## 8. 후속 이슈: 조치 다음 날 발생한 MVIEW 리프레시 지연

7장의 조치로 상황이 종료된 것처럼 보였다. 그러나 조치 다음 날 새벽, 같은 데이터베이스에서 Materialized View(이하 MVIEW) 정기 리프레시가 지연되는 후속 이슈가 발생했다. 원인은 7장의 조치에서 시작됐다.

### 8.1 증상

다음 날 새벽 03:30, MVIEW 208건을 일괄 REFRESH하는 정기 배치(Airflow DAG)에서 5건의 `REFRESH MATERIALIZED VIEW`가 완료되지 않았다. DAG가 실행 제한 3시간(`dagrun_timeout`)에 도달해 run 전체가 실패했고, 미완료 5건은 skipped로 마킹됐다.

이 5건은 평소 27초에서 20분 사이에 완료되던 리프레시다. 같은 run의 나머지 203건은 평소 속도(중앙값 153초)로 정상 완료됐다. 지연이 DB 전역이 아니라 특정 쿼리에 국한된 문제라는 뜻이다.

실패의 영향은 두 가지가 더 있었다.

첫째, Airflow 태스크 프로세스는 SIGKILL로 종료됐지만 **DB 백엔드는 남아 REFRESH를 계속 실행했다**(최장 6시간 이상). REFRESH MATERIALIZED VIEW는 **ACCESS EXCLUSIVE** 락을 잡으므로, 남은 백엔드가 락을 보유한 채 유지되면서 해당 MVIEW 조회까지 차단됐다.

둘째, 태스크가 failed가 아닌 skipped로 끝나면서 리프레시 상태를 추적하는 관리 테이블의 실패 마킹 경로가 실행되지 않았고, 상태 값이 진행 중으로 남았다. 실시간 리프레시 스케줄러는 진행 중인 대상을 건너뛰므로, 이 5건은 실시간 리프레시 대상에서도 빠졌다.

### 8.2 배제한 원인

| 배제한 원인 | 배제 근거 |
|---|---|
| 락 대기 | 백엔드 확인 시점에 대기 이벤트와 차단 세션 없이 active 상태로 실행 중이었다 |
| MVIEW 간 참조 | pg_depend 조회 결과 5건 모두 일반 테이블만 참조한다 |
| 원천 테이블 bloat | n_live_tup 7.1만~348만 행, dead_pct 0~7.6%로 정상 범위다 |
| 타 작업과의 락 충돌 | 해당 시간대에 원천 테이블에 배타 락을 잡는 작업이 없었다 |

### 8.3 원인 추정: 통계 갱신에 의한 실행 계획 회귀

지연된 5건은 모두 같은 원천 테이블 세 개를 조인한다. 이 글에서는 `mart.customer_master`, `mart.order_history`, `mart.account_ledger`로 둔다.

26일간 유지되던 트랜잭션을 종료하자 데이터베이스 전역에서 밀려 있던 autovacuum이 동작했고, 그날 오후 `mart.customer_master`에 autovacuum과 autoanalyze가 실행되어 **통계가 갱신됐다**.

반면 조인 상대인 나머지 두 테이블의 통계는 마지막 갱신이 짧게는 2주, 길게는 두 달 이상 지난 상태였다. 테이블 간 통계 산출 시점이 어긋나 **조인 카디널리티 추정**이 실제와 크게 벌어졌고, 다음 날 새벽 배치는 갱신된 통계로 실행된 첫 리프레시였다.

카디널리티 추정이 벌어지면 플래너는 조인 순서와 방식을 비효율적인 형태(대량 Nested Loop 등)로 선택한다. 행 수가 크지 않은 테이블(최대 348만 행)이라도 실행 시간이 수 시간 규모로 늘어날 수 있다. 같은 원천을 조인하는 5건만 동시에 지연되고 나머지 203건이 정상이었던 현상과 부합한다.

다만 당시 실행 계획은 백엔드를 종료하면서 확보하지 못했다. 이 분석은 가설 단계이며, 동일 증상이 재발하면 EXPLAIN으로 실행 계획을 확보해 검증한다.

사건 순서를 정리하면 다음과 같다.

| 시점 | 사건 |
|---|---|
| 조치 당일 03:30 | 정기 배치에서 5건 정상 완료 (마지막 정상 리프레시) |
| 조치 당일 낮 | 26일 장기 트랜잭션 종료(7장), xmin horizon 해제 |
| 조치 당일 14:27 | `mart.customer_master`에 autovacuum과 autoanalyze 실행, 통계 갱신 |
| 다음 날 03:30 | 정기 배치에서 5건 REFRESH 시작, 완료되지 않음 |
| 다음 날 06:30 | dagrun_timeout(3시간) 도달로 run 실패, 5건 skipped 처리. DB 백엔드는 계속 실행 |
| 다음 날 09:48 | 남은 백엔드 5건 확인(차단 세션 없음, active 상태) 후 수동 종료 |
| 다음 날 10:15 | 원천 테이블 ANALYZE 실행, 통계 산출 시점 일치 |
| 다음 날 10:24 | 5건 REFRESH 재실행, 15분 이내 정상 완료 |

통계 시점을 맞춘 직후의 재실행이 15분 이내에 완료됐다는 사실이 이 가설을 뒷받침한다.

### 8.4 조치와 재발 방지

조치는 세 가지로 진행했다.

1. **남은 REFRESH 백엔드 종료**: 차단 중인 세션이 없는 것을 확인한 뒤 수동 종료했다.
2. **원천 테이블 통계 정렬**: 5건이 참조하는 원천 테이블 전체에 ANALYZE를 실행해 통계 산출 시점을 일치시켰다. 이후 재실행한 리프레시는 15분 이내에 정상 완료됐다.
3. **상태 값 정리**: 관리 테이블에 남은 진행 중 상태를 리셋해 실시간 리프레시를 재개하고, 익일 배치 결과와 실행 계획을 모니터링한다.

재발 방지의 핵심은 서버 측 시간 제한이다. 리프레시 세션에 **statement_timeout**과 **lock_timeout**을 적용한다. 제한을 초과하면 클라이언트가 아니라 서버가 쿼리를 중단하므로, 태스크의 예외 처리 경로가 정상 실행되어 실패 마킹이 남는다. 백엔드 잔존, 진행 중 상태 잔존, MVIEW 조회 차단을 한 번에 방지한다.

---

## 9. 장기 트랜잭션 재발 방지

핵심은 **장기 활성 트랜잭션을 만들지 않는 것**, 그리고 생기면 **조기에 탐지하는 것**이다. CSV 추출 워커처럼 장시간 실행될 수 있는 작업에는 트랜잭션 지속 시간 제한을 적용한다.

여기서 설정 함정이 하나 있다. 방치된 트랜잭션 대책으로 흔히 **idle_in_transaction_session_timeout**을 먼저 적용하지만, 이번 사례에는 통하지 않는다. 이 타임아웃은 idle in transaction 상태에만 적용되고, 문제 백엔드처럼 state가 **active**인 백엔드에는 적용되지 않는다. 장시간 실행되는 statement에는 **statement_timeout** 또는 TCP keepalive 기반 감지로 대응해야 한다.

```text
방치된 장기 트랜잭션의 피해 확대 경로:
데드튜플 회수 지연 → 테이블/인덱스 bloat → 실행 계획 열화(Seq Scan)
→ 최악의 경우 XID wraparound 위험
```

장기 트랜잭션은 데드튜플 누적을 넘어 **XID wraparound** 위험까지 확대될 수 있으므로, backend_xmin age 기준의 모니터링을 상시화하는 것이 중요하다.

조치 이후의 영향도 재발 방지 범위에 든다. 장기 트랜잭션을 종료하면 밀려 있던 autovacuum과 autoanalyze가 일제히 동작하면서 테이블별 통계 산출 시점이 어긋날 수 있다. 8장의 사례처럼 실행 계획 회귀로 이어질 수 있으므로, 조치 직후 주요 조인 테이블에 ANALYZE를 함께 실행해 통계 시점을 맞춘다.

---

## 10. 정리

- Seq Scan 반복의 원인은 인덱스가 아니라 테이블 bloat였다.
- autovacuum 작업은 정상적으로 완료됐지만, 26일간 열린 트랜잭션이 xmin horizon을 유지하고 있어 회수가 0건이었다.
- xmin horizon은 테이블 단위가 아니라 데이터베이스 단위다. 무관한 테이블을 읽는 트랜잭션도 모든 테이블의 VACUUM을 막는다.
- 진단은 `pg_stat_user_tables` → `pg_stat_activity`(backend_xmin) → `VACUUM (VERBOSE)` 실증 순서로 진행한다.
- 조치는 백엔드 종료 → VACUUM → pg_repack. VACUUM은 파일 크기를 줄이지 않는다.
- active 백엔드에는 idle timeout이 적용되지 않는다. statement_timeout과 xmin age 모니터링으로 대응한다.
- 장기 트랜잭션을 정리하면 밀려 있던 autovacuum과 autoanalyze가 일제히 동작한다. 일부 테이블만 통계가 갱신되면 조인 카디널리티 추정이 어긋나 실행 계획이 회귀할 수 있다. 실제로 조치 다음 날 같은 원천을 조인하는 MVIEW 리프레시 5건이 지연됐고, 원천 테이블 ANALYZE로 통계 시점을 맞춰 해소했다.
- 배치 태스크가 강제 종료돼도 DB 백엔드는 남아 실행을 계속한다. 리프레시 세션에 statement_timeout과 lock_timeout을 적용해 서버 측에서 쿼리가 중단되도록 한다.

데드튜플이 급증했는데 autovacuum 정상 완료 기록까지 남아 있다면, 인덱스나 autovacuum 설정을 의심하기 전에 **가장 오래된 backend_xmin**부터 확인하자. 이 값이 원인을 파악하는 핵심 단서가 된다.
