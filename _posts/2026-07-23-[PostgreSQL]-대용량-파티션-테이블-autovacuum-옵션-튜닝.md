---
title: "[PostgreSQL] 대용량·파티션 테이블의 autovacuum 옵션 튜닝"
excerpt: "대용량·파티션 테이블에서 autovacuum이 늦게 도는 이유와, scale_factor·insert·cost_limit 옵션을 왜 어떻게 조정해야 하는지를 정리한다."

categories:
  - Database
tags:
  - Database
  - PostgreSQL
  - autovacuum
  - VACUUM
  - 파티션

permalink: /database/postgres-autovacuum-tuning-large-tables/

toc: true
toc_sticky: true

date: 2026-07-23
last_modified_at: 2026-07-23
---

## 1. 배경

PostgreSQL은 MVCC로 동시성을 처리한다. 행을 UPDATE하거나 DELETE하면 이전 버전이 즉시 사라지지 않고 **데드 튜플(dead tuple)** 로 남는다. 이 데드 튜플을 정리하고 통계를 갱신하는 자동 유지보수를 **autovacuum** 이 백그라운드에서 담당한다.

autovacuum은 단일 명령이나 여러 개의 별도 데몬이 아니라, 하나의 자동 유지보수 서브시스템이다. `autovacuum launcher` 프로세스가 주기적으로 `autovacuum worker` 를 띄우고, 이 워커가 테이블마다 조건을 따져 **VACUUM**(데드 튜플 정리)과 **ANALYZE**(통계 수집)를 실행한다. autoanalyze는 별도 데몬이 아니라 이 워커가 수행하는 자동 ANALYZE를 부르는 이름이다.

대부분의 테이블은 기본 설정으로 충분하다. 문제는 행 수가 수천만에서 수억에 이르는 대형 테이블이다. 여기서는 기본값이 오히려 방해가 되어, VACUUM도 ANALYZE도 너무 늦게 돌거나 사실상 돌지 않는다.

이 글은 그 원인과 네 가지 옵션의 역할, 일반 테이블과 파티션 테이블에 적용하는 방법을 정리한다. 동작은 PostgreSQL 13~17을 기준으로 설명하고, 12 이전과 18에서 달라지는 부분은 그 자리에서 표시한다.

본문의 스키마명과 테이블명은 모두 예시 값이다. 대용량 분석 테이블을 `mart.event_log`, 날짜로 나눈 대형 파티션 테이블을 `mart.access_log` 로 두고 설명한다.

---

## 2. autovacuum은 언제 도는가

구조부터 보면, launcher 하나가 worker를 띄우고 worker가 테이블마다 판단한다.

```text
autovacuum launcher (프로세스 1개)
└─ autovacuum worker (여러 개)
   ├─ VACUUM 필요 여부 판단  → 필요하면 VACUUM 실행
   └─ ANALYZE 필요 여부 판단 → 필요하면 ANALYZE 실행
```

worker는 테이블마다 세 조건을 따로 확인한다. 각 조건은 독립적이라, 하나만 넘겨도 그 작업이 실행된다.

```text
VACUUM 발동:        n_dead_tup          > vacuum_threshold(50)          + vacuum_scale_factor(0.2)        × reltuples
ANALYZE 발동:       n_mod_since_analyze > analyze_threshold(50)         + analyze_scale_factor(0.1)       × reltuples
INSERT VACUUM 발동:  n_ins_since_vacuum  > vacuum_insert_threshold(1000) + vacuum_insert_scale_factor(0.2) × reltuples
```

`n_dead_tup` 는 데드 튜플 수, `n_mod_since_analyze` 는 마지막 ANALYZE 이후 변경된 행 수(INSERT, UPDATE, DELETE 합산), `n_ins_since_vacuum` 는 마지막 VACUUM 이후 삽입된 행 수다.

세 조건이 독립적이라는 점이 핵심이다. 데드 튜플 조건만 넘기면 VACUUM만, 변경 행 조건만 넘기면 ANALYZE만 걸린다. 둘 다 넘기면 둘 다 실행하고, 아무것도 못 넘기면 아무 작업도 하지 않는다.

여기서 대형 테이블 문제가 나온다. `scale_factor` 는 퍼센트라, 테이블이 커질수록 발동에 필요한 절대 건수가 커진다. `scale_factor 0.2` 는 테이블의 20%가 데드 튜플이 되어야 VACUUM이 걸린다는 뜻이다. 1억 행 테이블이면 **2천만 건**이다. 그 2천만 건이 쌓이는 동안 테이블은 부풀고 조회는 느려진다. ANALYZE도 같다. `analyze_scale_factor 0.1` 이면 대형 테이블은 10%가 바뀔 때까지 통계가 낡은 채로 남는다.

버전 차이는 이렇다. INSERT 기반 VACUUM 규칙은 **PostgreSQL 13** 에서 도입됐고 기본으로 켜져 있다. **PostgreSQL 18** 부터는 VACUUM 임계값에 `autovacuum_vacuum_max_threshold` 상한이 생겨, 퍼센트로 계산한 값과 이 상한 중 작은 쪽이 적용된다. 그래서 아주 큰 테이블은 데드 튜플이 상한에 닿는 순간 퍼센트와 무관하게 VACUUM이 걸린다. 같은 18에서 INSERT 기준 계산에는 아직 freeze되지 않은 페이지 비율도 반영된다. 아래 설명과 튜닝 값은 이 상한이 없는 13~17을 기준으로 한다.

---

## 3. VACUUM과 ANALYZE가 하는 일

옵션을 고르려면 두 작업이 무엇을 유지하는지 알아야 한다. VACUUM은 세 가지, ANALYZE는 통계 하나를 맡는다.

### 3.1 VACUUM: 데드 튜플 회수

데드 튜플이 차지하던 공간을 회수해 재사용 가능한 상태로 되돌린다. 이 일이 늦어지면 테이블 파일이 실제 데이터보다 커진다(bloat). 커진 파일은 순차 스캔이든 인덱스 스캔이든 읽어야 할 페이지 수를 늘린다.

### 3.2 VACUUM: Visibility Map 갱신

**Visibility Map(VM)** 은 각 페이지가 모든 트랜잭션에 visible한 행만 담는지를 표시하는 비트맵이다. 페이지가 all-visible로 표시되면 두 가지 이득이 있다.

- 다음 VACUUM이 그 페이지를 건너뛴다. VACUUM이 빨라진다.
- **index-only scan** 이 힙(테이블 본체)을 읽지 않고 인덱스만으로 결과를 낸다.

VM이 낮으면 두 이득을 모두 잃는다. VACUUM은 매번 더 많은 페이지를 검사하고, 플래너는 index-only scan을 포기한다.

### 3.3 VACUUM: freeze와 트랜잭션 ID 순환

트랜잭션 ID는 32비트라 약 20억 개 범위를 순환한다. 순환 지점에서 오래된 ID가 미래 값으로 잘못 해석되는 것을 막으려고, VACUUM은 일정 나이를 넘긴 행을 **freeze** 해서 영구히 visible로 표시한다.

테이블이 오래 VACUUM되지 않으면 freeze되지 않은 행이 쌓인다. 가장 오래된 행의 나이가 `autovacuum_freeze_max_age`(기본 2억 트랜잭션)를 넘으면 **anti-wraparound autovacuum** 이 강제로 실행된다. 이 VACUUM은 건너뛸 수 없어 테이블 전체를 훑는다. 수억 행 테이블이면 이 스캔 하나가 디스크와 CPU를 크게 점유한다.

계속 INSERT만 되는 append 형 테이블이 특히 문제였다. 데드 튜플이 거의 없어 3.1의 dead 조건으로는 VACUUM이 걸리지 않는다. PostgreSQL 12 이하에서는 이 때문에 VM과 freeze가 방치되다가 anti-wraparound로 한꺼번에 터졌다. PostgreSQL 13부터는 INSERT 기반 규칙이 기본으로 켜져 있어, 삽입만으로도 주기적으로 VACUUM이 돌며 VM과 freeze를 유지한다. 따라서 이 위험은 구버전이거나, INSERT 기반 규칙을 끄거나 그 임계값을 테이블 규모에 비해 높게 둔 경우에 남는다.

### 3.4 ANALYZE: 통계와 실행 계획

ANALYZE는 테이블을 표본 조사해 플래너가 쓸 통계를 수집한다. 대표적으로 다음을 저장한다.

- 테이블의 대략적인 행 수(`reltuples`)
- 컬럼별 값 분포(히스토그램)와 고유값 개수
- 자주 나오는 값의 목록(최빈값)과 컬럼 간 상관도

플래너는 이 통계로 실행 계획을 고른다. 조건에 맞는 행이 몇 건일지 추정해 인덱스 스캔과 순차 스캔, nested loop와 hash join 중 무엇이 쌀지 정한다.

통계가 실제 데이터와 어긋나면 추정이 빗나간다. 대량 적재나 대량 삭제 직후 아직 ANALYZE가 돌지 않은 상태가 대표적이다. 실제로는 수백만 건인데 통계상 수천 건으로 알고 nested loop를 고르면, 대형 테이블에서 쿼리 시간이 몇 배로 늘어난다. 느린 쿼리의 원인을 실행 계획에서 거슬러 올라가면 낡은 통계에 닿는 경우가 많다.

---

## 4. 네 가지 옵션

2장의 발동 조건에서 실제로 조정하는 값이 아래 네 가지다. 앞의 세 개는 얼마나 자주 도느냐를, 마지막 하나는 한 번 돌 때 얼마나 빨리 끝내느냐를 정한다.

### 4.1 autovacuum_vacuum_scale_factor (기본 0.2)

데드 튜플이 테이블의 몇 %일 때 VACUUM을 걸지 정한다. 대형 테이블에서 20%는 너무 늦다. 낮추면 더 자주 돈다.

### 4.2 autovacuum_analyze_scale_factor (기본 0.1)

변경된 행이 몇 %일 때 ANALYZE를 걸지 정한다. 통계가 낡으면 플래너가 잘못된 계획을 고른다. 대형 테이블은 이 값도 낮춰 통계를 신선하게 유지한다.

### 4.3 autovacuum_vacuum_insert_scale_factor (기본 0.2, PostgreSQL 13 이상)

삽입된 행 수를 기준으로 VACUUM을 건다. append 형 테이블의 VM과 freeze를 유지하는 핵심 옵션이다. 데드 튜플이 없어도 이 규칙이 주기적으로 VACUUM을 건다.

### 4.4 autovacuum_vacuum_cost_limit (기본 -1, 실질 200)

autovacuum은 I/O 비용이 이 한도에 닿으면 잠깐 쉰다. 시스템 부하를 억제하는 장치다. 기본 200은 보수적이라 대형 테이블에서 VACUUM이 느리게 끝난다. 올리면 덜 쉬고 빨리 끝낸다.

| 옵션 | 기본값 | 역할 | 튜닝 방향 |
|---|---|---|---|
| autovacuum_vacuum_scale_factor | 0.2 | dead 비율 기준 VACUUM 발동 | 대형은 낮춘다 |
| autovacuum_analyze_scale_factor | 0.1 | 변경 비율 기준 ANALYZE 발동 | 대형은 낮춘다 |
| autovacuum_vacuum_insert_scale_factor | 0.2 | 삽입 기준 VACUUM 발동 | append 형은 낮춘다 |
| autovacuum_vacuum_cost_limit | -1(200) | VACUUM I/O 스로틀 | 대형은 올린다 |

---

## 5. 일반 테이블에 적용하기

### 5.1 대상 진단

모든 테이블을 손대면 안 된다. 이미 자주 도는 작은 테이블에 공격적인 값을 주면 과잉 VACUUM이 된다. 대형이면서 데드 튜플이 많거나 VM이 낮은 테이블만 고른다.

```sql
SELECT
    s.schemaname, s.relname,
    s.n_live_tup, s.n_dead_tup,
    round(100.0 * s.n_dead_tup / NULLIF(s.n_live_tup + s.n_dead_tup, 0), 1) AS dead_pct,
    round(100.0 * c.relallvisible / NULLIF(c.relpages, 0), 1)              AS vm_pct,
    pg_size_pretty(pg_relation_size(c.oid))                               AS heap_size,
    s.last_autovacuum, s.autovacuum_count
FROM pg_stat_all_tables s
JOIN pg_class c ON c.oid = s.relid
WHERE c.relpages > 100000            -- 약 800MB 이상 대형만
ORDER BY s.n_dead_tup DESC;
```

`dead_pct` 가 높거나 `vm_pct` 가 낮은데 `autovacuum_count` 가 유독 적은 테이블이 대상이다.

### 5.2 옵션 적용

옵션은 테이블 단위 저장 파라미터라 `ALTER TABLE ... SET` 으로 건다. 재시작이 필요 없다.

```sql
ALTER TABLE mart.event_log SET (
  autovacuum_vacuum_scale_factor  = 0.02,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit    = 2000
);
```

설정을 바꾼다고 그 순간 VACUUM이 실행되지는 않는다. 다만 이미 쌓인 데드 튜플 카운터는 그대로 남아 다음 autovacuum 검사에서 새 임계값과 비교된다. 낮춘 임계값을 이미 넘긴 상태라면 곧 autovacuum이 알아서 건다. 지금 바로 bloat나 낮아진 VM을 되돌리려면 수동으로 한 번 실행한다.

```sql
VACUUM (ANALYZE, VERBOSE) mart.event_log;
```

### 5.3 아주 큰 테이블은 고정 임계값도 고려

`scale_factor` 는 퍼센트라 테이블이 커질수록 발동 간격이 벌어진다. 크기와 무관하게 일정한 데드 튜플 수마다 돌게 하려면 `scale_factor` 를 0으로 두고 `threshold` 를 고정한다. PostgreSQL 18의 `autovacuum_vacuum_max_threshold` 는 이 수작업을 상당 부분 대신한다.

```sql
ALTER TABLE mart.event_log SET (
  autovacuum_vacuum_scale_factor = 0,
  autovacuum_vacuum_threshold    = 1000000     -- 데드 튜플 100만 건마다 VACUUM
);
```

---

## 6. 파티션 테이블에 적용하기

### 6.1 부모가 아니라 리프에 건다

> 파티션 부모 테이블에 옵션을 걸면 자식 전체에 적용될까?

그렇지 않다.

autovacuum은 데이터가 든 **리프(자식) 파티션** 각각에 대해 돈다. 파티션 부모는 데이터가 없어 VACUUM 대상이 아니다. 부모에 옵션을 걸어도 구동되지 않고, 새로 만들어지는 자식은 부모 옵션을 상속하지 않는다.

ANALYZE도 리프만 자동 처리한다. 다만 파티션 키가 아닌 컬럼으로 조건을 걸어 플래너가 파티션 전체를 하나로 보고 추정해야 할 때는 부모 수준 통계가 필요하다. 이 통계는 부모에 수동으로 `ANALYZE mart.access_log;` 를 돌려야 갱신된다. 리프가 최신이어도 부모 통계는 따로 챙긴다.

따라서 옵션은 리프마다 걸고, 앞으로 생길 파티션 대책을 따로 둔다.

### 6.2 리프 파티션 목록 확인

`pg_partition_tree` 로 한 트리의 모든 파티션을 크기·상태와 함께 나열한다.

```sql
SELECT
    pt.relid::regclass AS partition,
    pt.isleaf, pt.level,
    s.n_live_tup, s.n_dead_tup,
    round(100.0 * c.relallvisible / NULLIF(c.relpages, 0), 1) AS vm_pct,
    pg_size_pretty(pg_relation_size(pt.relid))                AS size,
    c.reloptions
FROM pg_partition_tree('mart.access_log') pt
JOIN pg_class c ON c.oid = pt.relid
LEFT JOIN pg_stat_all_tables s ON s.relid = pt.relid
ORDER BY pg_relation_size(pt.relid) DESC;
```

### 6.3 리프 전체에 옵션 거는 SQL 생성

파티션 이름을 일일이 적지 않도록, ALTER 문을 만들어주는 쿼리를 쓴다. 결과 텍스트를 검토한 뒤 실행한다.

```sql
SELECT string_agg(
  format('ALTER TABLE %s SET (autovacuum_vacuum_scale_factor=0, autovacuum_vacuum_threshold=5000000, autovacuum_vacuum_insert_scale_factor=0, autovacuum_vacuum_insert_threshold=5000000, autovacuum_analyze_scale_factor=0, autovacuum_analyze_threshold=2000000, autovacuum_vacuum_cost_limit=3000);',
         pt.relid::regclass), E'\n') AS ddl
FROM pg_partition_tree('mart.access_log') pt
WHERE pt.isleaf;
```

### 6.4 수억 행 append 형 파티션 권장값

날짜로 나눈 로그성 대형 파티션은 대부분 삽입만 일어난다. dead 조건은 거의 안 걸리므로 INSERT 기반 규칙과 freeze 유지가 핵심이다. 크기가 제각각인 리프에는 퍼센트보다 고정 임계값이 맞는다.

| 옵션 | 권장 | 의미 |
|---|---|---|
| vacuum_scale_factor = 0, threshold = 5000000 | 데드 튜플 500만마다 VACUUM | 크기와 무관한 일정 주기 |
| vacuum_insert_scale_factor = 0, insert_threshold = 5000000 | 삽입 500만마다 VACUUM | VM 유지와 freeze 진행 |
| analyze_scale_factor = 0, analyze_threshold = 2000000 | 변경 200만마다 ANALYZE | 통계 신선도 |
| vacuum_cost_limit = 3000 | 스로틀 완화 | 큰 리프도 빨리 종료 |

INSERT 기반 옵션은 PostgreSQL 13 이상에서만 동작한다. 12 이하라면 이 방식이 없으므로 7장의 예약 VACUUM으로 대신한다.

---

## 7. 옵션이 초기화되는 함정

테이블 옵션을 분명히 걸었는데 얼마 뒤 사라져 있는 경우가 있다. 원인은 옵션이 저장되는 위치에 있다.

저장 파라미터는 그 테이블의 카탈로그 항목(`pg_class.reloptions`)에 붙어 있다. 따라서 테이블 항목이 사라지면 옵션도 함께 사라진다.

| 작업 | 옵션 유지 여부 |
|---|---|
| `TRUNCATE` | 유지 |
| `VACUUM FULL`, `pg_repack` | 유지 |
| `DROP TABLE` 후 `CREATE TABLE` | 소멸 |
| swap 방식 재적재(새 테이블 생성 후 교체) | 소멸 |

적재 파이프라인이 스키마를 항상 새로 맞추려고 대상 테이블을 DROP 후 CREATE 하는 구조라면, 적재가 한 번 돌 때마다 손으로 건 옵션이 지워진다. 파티션도 마찬가지다. 오래된 파티션을 DROP 하고 새 파티션을 CREATE 하는 순간 그 파티션의 옵션은 백지가 된다.

근본 해결은 옵션을 사람 손이 아니라 자동화된 위치에 두는 것이다.

- **파티션 생성 DDL에 옵션을 박는다.** 새 파티션을 만드는 쪽에서 `WITH` 절에 옵션을 함께 지정한다.

```sql
CREATE TABLE mart.access_log_2026_07
  PARTITION OF mart.access_log
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01')
  WITH (
    autovacuum_vacuum_insert_scale_factor = 0,
    autovacuum_vacuum_insert_threshold    = 5000000,
    autovacuum_vacuum_cost_limit          = 3000
  );
```

- **주기적 유지보수 작업으로 재적용한다.** 생성 DDL을 고칠 수 없다면, 스케줄러에서 하루 한 번 6.3의 생성 쿼리를 돌려 옵션이 없는 새 리프에 옵션을 채운다.
- **적재가 끝난 파티션은 명시적으로 정리한다.** append 형에서는 적재가 끝나 더 이상 변경되지 않는 파티션에 `VACUUM (FREEZE, ANALYZE)` 를 걸어두는 방식이 가장 확실하다. VM을 채우고 freeze까지 끝내므로 anti-wraparound가 나중에 한꺼번에 터지는 상황을 막는다.

---

## 8. 정리

- autovacuum은 launcher와 worker로 이뤄진 하나의 자동 유지보수 서브시스템이다. autoanalyze라는 별도 데몬은 없고, 같은 worker가 VACUUM과 ANALYZE를 각각 독립된 조건으로 발동한다. 한쪽만 걸리는 경우가 흔하다.
- 기본 `scale_factor 0.2` 는 대형 테이블에서 너무 늦다. 20%가 거대한 절대 수치가 되기 때문이다. 통계를 거는 `analyze_scale_factor 0.1` 도 같은 문제를 겪는다.
- VACUUM은 데드 튜플 회수, Visibility Map 갱신, freeze를 맡는다. append 형은 PostgreSQL 12 이하에서 방치되다 anti-wraparound로 터질 위험이 컸고, 13의 INSERT 기반 VACUUM이 이를 완화한다.
- ANALYZE는 플래너가 쓰는 통계를 수집한다. 통계가 낡으면 대형 테이블에서 잘못된 실행 계획으로 쿼리가 느려진다.
- 일반 테이블은 대상만 골라 `ALTER TABLE ... SET` 으로 조정하고, 필요하면 수동 VACUUM으로 즉시 회복시킨다. 아주 큰 테이블은 고정 임계값이 잘 맞는다.
- 파티션 테이블은 옵션을 리프마다 걸고, 부모 통계는 수동 `ANALYZE` 로 따로 갱신한다.
- 옵션은 카탈로그 항목에 붙어 있어 DROP 후 CREATE나 swap 재적재로 사라진다. 생성 DDL에 박거나, 주기적 유지보수 작업으로 재적용하고 닫힌 파티션을 정리하는 것이 근본 해결이다.
