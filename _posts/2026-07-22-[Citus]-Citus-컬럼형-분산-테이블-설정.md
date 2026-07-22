---
title: "[Citus] Citus 컬럼형 분산 테이블 설정"
excerpt: "Citus에서 컬럼형 분산 테이블을 만들고 상태를 확인하는 방법과 증분 반영이 필요한 데이터를 하이브리드로 운영하는 방법을 정리한다."

categories:
  - Database
tags:
  - Data
  - Citus
  - PostgreSQL
  - 분산DB
  - OLAP
  - 데이터엔지니어링

permalink: /data/citus-distributed-columnar-table/

toc: true
toc_sticky: true

date: 2026-07-22
last_modified_at: 2026-07-22
---

## 1. 이 글의 목적

Citus는 PostgreSQL 데이터를 여러 노드에 나눠 저장하고, 쿼리도 여러 노드에서 병렬로 실행하게 해주는 확장 기능이다. 여기에 컬럼형 저장 방식을 적용하면 대용량 분석 쿼리의 디스크 읽기와 저장 공간을 줄일 수 있다.

이 글에서는 **컬럼형 저장 방식**과 **분산 테이블**의 차이를 먼저 짚고, 둘을 결합한 테이블을 만드는 방법을 살펴본다. 생성한 테이블의 분산 상태를 확인하는 방법, 조인 성능에 영향을 주는 colocation, 컬럼형 테이블의 증분 반영 제약과 하이브리드 운영 방법도 함께 다룬다.

본문의 테이블명과 컬럼명은 모두 설명을 위한 예시 값이다. `fact_event`, `customer_master`처럼 일반적인 이름만 사용한다.

---

## 2. 저장 방식과 분산 방식은 서로 다른 설정이다

Citus 테이블을 설계할 때는 두 가지를 따로 봐야 한다.

- **저장 방식**: 한 노드 안에서 데이터를 행 단위로 저장할지, 컬럼 단위로 저장할지 정한다.
- **분산 방식**: 데이터를 한 노드에 둘지, 여러 워커 노드의 샤드에 나눠 둘지 정한다.

따라서 컬럼형 테이블도 로컬 테이블로 쓸 수 있고 분산 테이블로 쓸 수도 있다.

### 2.1 컬럼형 테이블

일반 PostgreSQL 테이블은 한 행의 값을 모아 저장한다. 한 건을 조회하거나 자주 수정하는 업무에는 이 방식이 잘 맞는다.

컬럼형 테이블은 같은 컬럼의 값을 모아 저장한다. 분석 쿼리가 일부 컬럼만 읽을 때 불필요한 데이터를 덜 읽고, 비슷한 값이 모여 있어 압축률도 높다. 대량 데이터를 훑는 집계나 통계 쿼리에 유리한 이유다.

다만 데이터가 자주 바뀌는 테이블에는 맞지 않는다. Citus 컬럼형 저장소는 기본적으로 **append-only** 방식이며 `UPDATE`, `DELETE`, 일반적인 `INSERT ... ON CONFLICT`를 지원하지 않는다.

### 2.2 분산 테이블

분산 테이블은 데이터를 여러 샤드로 나눠 워커 노드에 저장한다. 코디네이터 노드는 들어온 쿼리를 분석해 필요한 워커에 전달하고 결과를 모은다.

이때 가장 중요한 설정이 **분산 키**다. 분산 키가 고르게 분포해야 특정 샤드나 워커에 데이터가 몰리지 않는다. 자주 조인하는 테이블은 같은 기준으로 분산해야 노드 사이의 데이터 이동도 줄일 수 있다.

### 2.3 컬럼형 분산 테이블

두 방식을 합치면 각 워커 노드에 있는 샤드가 컬럼형으로 저장된다.

```text
분산 테이블
├─ 워커 1: 컬럼형 샤드
├─ 워커 2: 컬럼형 샤드
└─ 워커 3: 컬럼형 샤드
```

컬럼형 저장소가 디스크 읽기와 저장 공간을 줄이고, Citus가 여러 샤드의 쿼리를 병렬로 처리한다. 데이터 변경이 거의 없는 대규모 분석 테이블에서 두 장점을 함께 얻을 수 있다.

---

## 3. 컬럼형 분산 테이블 만들기

### 3.1 워커 노드 확인

먼저 코디네이터에 등록된 활성 워커 노드를 확인한다.

```sql
SELECT * FROM citus_get_active_worker_nodes();
```

구버전 Citus에서는 같은 용도로 `master_get_active_worker_nodes()`를 사용하기도 한다.

### 3.2 컬럼형 테이블 생성

`USING columnar`를 붙이면 컬럼형 저장소를 사용하는 테이블이 만들어진다.

```sql
CREATE TABLE fact_event (
    tenant_id BIGINT,
    event_id BIGINT,
    amount NUMERIC,
    occurred_at TIMESTAMPTZ
) USING columnar;
```

### 3.3 분산 테이블로 전환

이제 `tenant_id`를 분산 키로 지정한다.

```sql
SELECT create_distributed_table('fact_event', 'tenant_id');
```

이 작업이 끝나면 `fact_event`는 여러 워커에 나뉘어 저장되는 컬럼형 테이블이 된다.

> "테이블을 먼저 분산하고 나중에 컬럼형으로 바꿔도 될까?"

가능하다. `alter_table_set_access_method`를 사용하면 `heap`과 `columnar` 사이를 전환할 수 있다. 다만 변환 과정에서 테이블 잠금과 데이터 재작성이 발생하므로 운영 중인 대용량 테이블은 작업 시간을 따로 잡는 편이 안전하다.

```sql
SELECT alter_table_set_access_method('fact_event', 'columnar');
```

---

## 4. 설정 결과 확인하기

테이블을 만든 뒤에는 분산 키, 샤드 배치, 저장 방식을 차례로 확인한다.

### 4.1 분산 키 확인

`pg_dist_partition`에는 분산 테이블의 핵심 설정이 들어 있다.

```sql
SELECT
    logicalrelid,
    column_to_column_name(logicalrelid, partkey) AS distribution_column
FROM pg_dist_partition
WHERE logicalrelid = 'fact_event'::regclass;
```

### 4.2 샤드 배치 확인

샤드가 어느 워커에 놓였는지 확인하려면 샤드, 배치, 노드 메타데이터를 함께 조회한다.

```sql
SELECT
    s.logicalrelid::regclass AS table_name,
    s.shardid,
    n.nodename,
    n.nodeport
FROM pg_dist_shard s
JOIN pg_dist_placement p ON p.shardid = s.shardid
JOIN pg_dist_node n ON n.groupid = p.groupid
WHERE s.logicalrelid = 'fact_event'::regclass
ORDER BY s.shardid, n.nodename, n.nodeport;
```

샤드가 일부 워커에만 몰려 있지 않은지, 각 샤드의 복제본이 기대한 노드에 있는지를 살핀다.

### 4.3 저장 방식 확인

`pg_class.relam`이 가리키는 액세스 메소드를 조회하면 실제 저장 방식을 알 수 있다.

```sql
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    am.amname AS access_method
FROM pg_class c
JOIN pg_am am ON am.oid = c.relam
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.oid = 'fact_event'::regclass;
```

`access_method`가 `columnar`이면 컬럼형으로 저장되고 있는 것이다. 일반 행 기반 테이블은 `heap`으로 표시된다.

### 4.4 colocation 그룹 확인

`colocationid`가 같으면 두 분산 테이블의 대응 샤드가 같은 워커에 배치된다.

```sql
SELECT
    logicalrelid::regclass AS table_name,
    partmethod,
    colocationid
FROM pg_dist_partition
ORDER BY colocationid, logicalrelid;
```

`partmethod`의 대표적인 값은 다음과 같다.

| 값 | 의미 |
| --- | --- |
| `h` | 해시 분산 테이블 |
| `n` | 레퍼런스 테이블 |
| `r` | 범위 분산 테이블 |

---

## 5. Colocation을 기준으로 조인을 설계한다

### 5.1 같은 노드에서 조인을 끝내는 것이 핵심

두 테이블을 같은 키로 분산하고 대응 샤드를 같은 워커에 두면, 각 워커가 자기 샤드 안에서 조인을 끝낼 수 있다. 코디네이터는 워커가 만든 결과만 합치면 된다.

반대로 분산 키가 다르면 조인 전에 데이터를 다른 노드로 옮겨야 할 수 있다. 데이터가 클수록 네트워크 사용량과 임시 데이터가 늘어난다.

### 5.2 분산 키가 다른 테이블을 조인할 때

분산 키가 다른 테이블을 조인하면 다음 오류를 볼 수 있다.

```text
ERROR: the query contains a join that requires repartitioning
  Hint: Set citus.enable_repartition_joins to on to enable repartitioning
```

필요하다면 리파티셔닝 조인을 켤 수 있다.

```sql
SET citus.enable_repartition_joins = 'on';
```

하지만 이 설정을 일반적인 해결책으로 삼으면 안 된다. 실행할 때마다 데이터 이동 비용을 치르기 때문이다. 반복해서 함께 조회하는 대용량 테이블이라면 분산 키와 colocation부터 다시 검토하는 편이 낫다.

여러 분산 테이블을 한꺼번에 조인할 때는 제약이 더 커진다. 모든 테이블이 같은 colocation 그룹에 있고 분산 키로 연결돼야 워커 단위 조인으로 처리하기 쉽다.

### 5.3 colocation 맞추기

새 테이블을 기존 테이블과 같은 위치에 두려면 `colocate_with`를 지정한다.

```sql
SELECT create_distributed_table(
    'fact_payment',
    'tenant_id',
    colocate_with => 'fact_event'
);
```

같은 colocation 그룹에 들어가려면 다음 조건이 맞아야 한다.

- 분산 방식
- 분산 키의 데이터 타입
- 샤드 수
- 샤드 배치 구조

컬럼 이름만 같다고 colocation이 보장되는 것은 아니다. 이름보다 타입과 분산 설정이 중요하다.

### 5.4 작은 공통 테이블은 레퍼런스 테이블로 둔다

모든 워커에서 자주 읽는 작은 기준정보 테이블은 레퍼런스 테이블이 잘 맞는다.

```sql
SELECT create_reference_table('customer_master');
```

레퍼런스 테이블은 모든 워커에 복제된다. 분산 테이블이 어느 워커에서 실행되든 같은 노드 안에서 기준정보를 읽을 수 있으므로, 작은 공통 테이블을 조인할 때 생기는 데이터 이동을 줄일 수 있다.

---

## 6. 컬럼형 테이블의 제약과 하이브리드 운영

### 6.1 컬럼형 테이블 증분 제약

컬럼형 테이블은 `INSERT`나 `COPY`로 새 행을 덧붙일 수 있다. 다만 기존 행을 찾아 바꾸는 `UPDATE`, 지우는 `DELETE`, 충돌한 행을 갱신하는 일반적인 upsert는 지원하지 않는다.

즉, 단순 추가 적재는 가능하지만 **변경분을 기존 행에 반영하는 증분 처리**는 어렵다. 한 행씩 자주 넣으면 작은 stripe가 많이 생겨 압축률과 조회 성능도 나빠질 수 있으므로, 컬럼형 테이블에는 데이터를 묶어서 적재하는 편이 좋다.

| 적재 방식 | 컬럼형 테이블 적합성 |
| --- | --- |
| 확정된 이력 데이터 일괄 적재 | 적합 |
| 새 행을 큰 묶음으로 추가 | 적합 |
| 한 건씩 자주 추가 | 가능하지만 비효율적 |
| 기존 행 수정 또는 삭제 | 부적합 |
| `INSERT ... ON CONFLICT DO UPDATE` | 지원하지 않음 |

### 6.2 컬럼형 테이블 하이브리드 운영

증분 반영이 필요하다고 컬럼형 저장소를 포기할 필요는 없다. 시간 기준 파티셔닝을 사용해 **최신 파티션은 행형**, **변경이 끝난 과거 파티션은 컬럼형**으로 운영하면 된다.

```text
fact_event
├─ 최신 파티션: heap, INSERT·UPDATE·DELETE 처리
├─ 직전 파티션: heap, 지연 도착 데이터와 정정 처리
└─ 과거 파티션: columnar, 압축과 분석 조회에 집중
```

먼저 시간 컬럼을 기준으로 파티션 부모 테이블을 만들고 분산한다.

```sql
CREATE TABLE fact_event (
    tenant_id BIGINT,
    event_id BIGINT,
    amount NUMERIC,
    occurred_at TIMESTAMPTZ
) PARTITION BY RANGE (occurred_at);

SELECT create_distributed_table('fact_event', 'tenant_id');
```

최신 파티션은 기본 액세스 메소드인 `heap`으로 만든다.

```sql
CREATE TABLE fact_event_2026_07
PARTITION OF fact_event
FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

정정 기간이 끝난 파티션은 컬럼형으로 바꾼다.

```sql
SELECT alter_table_set_access_method(
    'fact_event_2026_06',
    'columnar'
);
```

기준 날짜보다 오래된 파티션을 한꺼번에 전환할 수도 있다.

```sql
CALL alter_old_partitions_set_access_method(
    'fact_event',
    now() - interval '2 months',
    'columnar'
);
```

애플리케이션은 부모 테이블인 `fact_event`만 조회하면 된다. PostgreSQL이 조건에 맞는 행형 파티션과 컬럼형 파티션을 함께 읽는다.

운영할 때는 두 가지를 주의한다.

- 수정 쿼리에는 파티션 키 조건을 넣어 컬럼형 파티션을 확실히 제외한다.
- 지연 도착이나 정정 가능 기간을 고려해 최근 한두 개 파티션은 행형으로 남긴다.

시간으로 나누기 어려운 데이터라면 쓰기용 행형 테이블과 조회용 컬럼형 이력 테이블을 따로 두고 `UNION ALL` 뷰로 묶는 방법도 있다. 이 경우에는 중복 방지, 이관 기준, 장애가 났을 때의 재처리 절차를 별도로 설계해야 한다.

자세한 제한 사항과 파티션 전환 방법은 [Citus Columnar Storage 문서](https://docs.citusdata.com/en/stable/admin_guide/table_management.html#columnar-storage)와 [Timeseries Data 문서](https://docs.citusdata.com/en/stable/use_cases/timeseries.html#archiving-with-columnar-storage)에서 확인할 수 있다.

### 6.3 분산 테이블의 제약조건에는 분산 키 필수

분산 테이블의 `PRIMARY KEY`, `UNIQUE`, `EXCLUDE` 제약조건에는 분산 키가 포함돼야 한다. 각 워커가 자기 샤드만 보고도 제약조건 위반 여부를 판단할 수 있어야 하기 때문이다.

예를 들어 `tenant_id`로 분산할 테이블에서 `event_id`만 기본 키로 잡으면 다음과 같은 오류가 발생할 수 있다.

```text
ERROR: cannot create constraint on "fact_event"
Detail: Distributed relations cannot have UNIQUE, EXCLUDE, or PRIMARY KEY
constraints that do not include the partition column.
```

이 경우에는 업무 규칙이 허용하는 범위에서 `(tenant_id, event_id)`처럼 분산 키를 포함한 복합 키를 검토한다. 제약조건을 없애기 전에 애플리케이션이 요구하는 유일성 범위부터 확인해야 한다.

---

## 7. 정리

- 컬럼형과 분산은 서로 다른 설정이다. 컬럼형은 저장 구조를, 분산은 데이터가 놓일 노드를 정한다.
- 컬럼형 분산 테이블은 `USING columnar`로 만든 뒤 `create_distributed_table`로 분산 키를 지정한다.
- 분산 키, 샤드 배치, 액세스 메소드, colocation 그룹을 확인해야 설정이 의도대로 적용됐는지 알 수 있다.
- 자주 조인하는 큰 테이블은 분산 키와 colocation을 맞추고, 작은 공통 테이블은 레퍼런스 테이블을 검토한다.
- 컬럼형 테이블은 추가 적재는 가능하지만 `UPDATE`, `DELETE`, 일반적인 upsert를 지원하지 않는다.
- 증분 반영이 필요한 데이터는 최신 파티션을 행형으로 두고, 변경이 끝난 과거 파티션을 컬럼형으로 전환하는 하이브리드 구성이 잘 맞는다.
