---
title: "[PostgreSQL] 컬럼 간 상관관계가 파티션별 실행 계획에 미치는 영향"
excerpt: "PostgreSQL에서 correlation이 가리키는 두 대상(플래너 통계와 데이터 관계)을 구분하고, 상관된 컬럼으로 파티셔닝했을 때 파티션별 통계와 접근 경로 선택이 읽기량을 줄이는 원리를 정리한다."

categories:
  - Database
tags:
  - Data
  - PostgreSQL
  - 옵티마이저
  - correlation
  - 파티셔닝
  - 통계

permalink: /data/postgresql-column-correlation-partitioning/

toc: true
toc_sticky: true

date: 2026-07-22
last_modified_at: 2026-07-22
---

## 1. 문제 상황

대용량 팩트 테이블에서 관찰한 결과다. 이 글에서는 테이블을 `orders`, 주문일을 `order_date`, 출고일을 `ship_date`로 두고 설명한다. 테이블·컬럼 이름 등 식별자는 예시로 치환했고, 측정 수치는 실제 실행 결과다.

`orders`는 `order_date`로 연 단위 파티셔닝했고 날짜 컬럼마다 B-tree 인덱스가 있다. 문제의 쿼리는 파티션 키가 아닌 `ship_date`로 필터한다.

```sql
SELECT count(*)
FROM orders
WHERE status = 'CANCELED'
  AND amount >= 100000
  AND ship_date BETWEEN '2024-01-01' AND '2024-12-31';
```

파티션 프루닝은 파티션 키 조건이 있어야 작동한다. 이 쿼리에는 `order_date` 조건이 없으므로 파티셔닝의 이점이 없으리라 예상했다. 그런데 실측 결과는 반대였다. 인덱스만 있는 구성보다 파티셔닝을 더한 구성이 읽기량(shared read)을 5배 이상 줄였다.

이 현상을 설명하려면 PostgreSQL에서 correlation이라는 말이 가리키는 대상을 구분하고, 옵티마이저가 그중 무엇을 어떻게 쓰는지 확인해야 한다. 그 구분이 이 글의 중심이다.

---

## 2. correlation의 두 가지 의미: 플래너 통계와 데이터 관계

PostgreSQL 맥락에서 상관관계는 서로 다른 두 대상을 가리킨다. 이름이 비슷해 혼동이 잦다.

**첫째, 값과 물리적 저장 순서의 상관.** 이것은 실제 플래너 통계다. `ANALYZE`가 컬럼마다 계산해 [`pg_stats.correlation`](https://www.postgresql.org/docs/current/view-pg-stats.html)에 저장한다. 컬럼 값의 논리적 순서와 행이 디스크에 놓인 물리적 순서가 얼마나 일치하는지를 -1에서 1 사이 값으로 나타낸다. 시간 순으로 적재된 테이블의 날짜 컬럼은 1에 가깝다.

**둘째, 컬럼과 컬럼 사이의 상관.** `order_date`와 `ship_date`처럼 두 컬럼의 값이 함께 움직이는 성질이다. 이것은 어떤 단일 통계 항목이 아니라 데이터가 가진 관계이고, 기본 통계 어디에도 저장되지 않는다.

| 구분 | 무엇 사이의 상관 | 실체 | 옵티마이저 사용 |
| --- | --- | --- | --- |
| 값-위치 상관 | 컬럼 값 ↔ 물리적 행 순서 | `pg_stats.correlation` 통계 | 인덱스 스캔 비용에 직접 반영 |
| 컬럼 간 상관 | 컬럼 ↔ 컬럼 | 통계 아님 — 데이터의 관계 | 기본적으로 모름 (독립 가정) |

옵티마이저가 상관관계를 아는가라는 질문의 답은 행마다 다르다. 이 구분을 기준으로 아래 장을 전개한다.

---

## 3. 옵티마이저가 correlation을 쓰는 방식

### 3.1 값-위치 상관: 인덱스 스캔 비용에 직접 반영

플래너는 인덱스 스캔 비용을 추정할 때 `pg_stats.correlation`을 직접 사용한다.

일반 Index Scan은 인덱스로 행을 찾은 뒤 힙(테이블 본체)을 읽어야 한다(Index Only Scan은 visibility map 조건이 맞으면 힙 접근을 건너뛰지만, 여기서는 일반 Index Scan 기준으로 설명한다). 값-위치 상관이 1에 가까우면 인덱스 순서대로 힙을 읽어도 접근이 순차에 가깝고, 같은 페이지를 중복 방문하지 않는다. 상관이 0에 가까우면 행마다 흩어진 페이지를 임의 접근해야 한다. 플래너는 이 차이를 비용에 반영한다. 상관의 절댓값이 클수록 인덱스 스캔의 IO 비용을 낮게 추정하고, 그만큼 인덱스 플랜이 채택되기 쉽다.

이 동작은 문서와 소스에 그대로 명시되어 있다. [pg_stats 문서](https://www.postgresql.org/docs/current/view-pg-stats.html)는 correlation이 ±1에 가까우면 0 근처일 때보다 인덱스 스캔이 저렴하게 추정된다고 설명하고, 구현으로는 옵티마이저 소스 [`costsize.c`의 `cost_index()`](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/optimizer/path/costsize.c)가 correlation의 제곱을 가중치로 최선(완전 순차)과 최악(완전 임의 접근) IO 비용 사이를 보간한다.

즉 correlation이라는 이름이 붙은 통계는 분명히 쿼리 플랜에 직접 영향을 준다. 다만 이것은 단일 컬럼 안의 이야기다.

### 3.2 컬럼 간 상관: 기본 플래너가 모르는 관계

> 옵티마이저가 order_date와 ship_date의 상관을 파악해서 플랜을 세우는 것 아닌가?

그렇지 않다. 기본 플래너는 컬럼들이 서로 독립이라고 가정한다. 조건 여러 개가 결합되면 각 조건의 선택도를 곱한다. 이 독립 가정은 [공식 문서의 확장 통계 장](https://www.postgresql.org/docs/current/planner-stats.html#PLANNER-STATS-EXTENDED)이 명시하는 기본 동작이자, 확장 통계가 도입된 이유이기도 하다.

예를 들어 조건 A의 선택도가 0.1, 조건 B의 선택도가 0.1이면 플래너는 두 조건을 함께 만족하는 비율을 0.01로 추정한다. 그런데 두 컬럼이 강하게 상관되어 A를 만족하는 행 대부분이 B도 만족한다면 실제 비율은 0.1에 가깝다. 추정과 실제가 10배 벌어지고, 이런 오차는 잘못된 플랜 선택으로 이어질 수 있다.

확장 통계(`CREATE STATISTICS`)로 컬럼 간 관계를 일부 보정할 수는 있다. 함수적 종속(dependencies)과 결합 n_distinct는 [PostgreSQL 10에서](https://www.postgresql.org/docs/release/10.0/), 다중 컬럼 MCV 목록은 [12에서 추가됐다](https://www.postgresql.org/docs/release/12.0/). 다만 이 글의 시나리오에는 닿지 않는다. [함수적 종속은 컬럼을 상수와 비교하는 등호 조건과 상수 IN 목록에만 적용되고](https://www.postgresql.org/docs/current/planner-stats.html#PLANNER-STATS-EXTENDED-FUNCTIONAL-DEPS), 범위 조건이나 LIKE에는 쓰이지 않는다. [MCV 목록은 등호뿐 아니라 범위 조건에도 적용되지만](https://www.postgresql.org/docs/current/multivariate-statistics-examples.html), 자주 나오는 값 조합을 담는 구조라 값이 다양한 날짜 컬럼 조합은 목록에 담기는 비중이 작아 실질 효과가 제한적이다. 그리고 어떤 확장 통계도 파티션 키가 아닌 컬럼으로 파티션 프루닝을 일으키지는 못한다. [프루닝은 파티션 키 조건에서만 작동한다](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITION-PRUNING). 단, 파티션마다 비키 컬럼에 CHECK 제약을 직접 걸어 두면 [constraint exclusion](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-CONSTRAINT-EXCLUSION)이 그 조건으로 파티션을 제외해 주는 예외는 있다.

정리하면 이 글의 시나리오 같은 날짜 범위 조회에서, 컬럼 간 상관이 플래너의 추정에 직접 반영될 방법은 없다.

### 3.3 남은 의문: 이론과 어긋나는 실측

여기까지만 보면 파티셔닝이 `ship_date` 조회를 개선할 이유가 없다. 플래너는 두 컬럼의 상관을 모르고, 프루닝도 되지 않는다. 그런데 실측에서는 개선됐다. 다음 장에서 그 이유를 설명한다.

---

## 4. 파티션별 통계가 컬럼 간 상관을 드러내는 과정

이 장의 흐름을 먼저 요약한다. 상관된 컬럼으로 파티셔닝하면 세 가지가 순서대로 일어난다.

1. **배치** — `ship_date`가 비슷한 행들이 같은 파티션에 모여 저장된다.
2. **통계** — 그 결과 파티션마다 `ship_date` 히스토그램이 서로 다른 범위를 갖는다.
3. **플랜** — 플래너가 파티션별 통계를 읽고 파티션마다 다른 접근 경로를 선택한다.

컬럼 간 상관이라는, 플래너가 직접 읽지 못하는 관계가 이 세 단계를 거쳐 플래너가 읽을 수 있는 형태로 바뀐다. 하나씩 본다.

### 4.1 1단계: 상관된 값의 파티션별 집중 저장

출고는 주문 직후에 이뤄진다. 한 행의 `ship_date`는 그 행의 `order_date`와 며칠 이내로 가깝다. 이 상태에서 `order_date`로 파티셔닝하면 각 행은 `order_date` 값에 따라 파티션에 들어가고, 결과적으로 `ship_date`가 2024년인 행 대부분이 2024년 파티션에 모여 저장된다.

두 가지를 분명히 해 둔다.

- 이 배치는 조회 시점에 계산되는 것이 아니다. 적재되는 순간 디스크에 이미 그렇게 놓인다.
- 이것은 파티션 **사이**의 집중·분리다. 파티션 안에서 행이 `ship_date` 순으로 정렬되는 것은 아니다. 파티션 내부 정렬은 `CLUSTER`나 정렬 적재의 영역이고, 파티셔닝이 보장하는 것은 값의 범위가 파티션 단위로 나뉜다는 사실뿐이다.

### 4.2 2단계: 파티션마다 갈라지는 단일 컬럼 통계

파티션은 각각 독립된 테이블이고 `ANALYZE`도 파티션 단위로 수행된다. [공식 ANALYZE 문서](https://www.postgresql.org/docs/current/sql-analyze.html)도 파티션 부모에 실행하면 기본적으로 각 파티션의 통계를 재귀적으로 수집·갱신한다고 명시한다. 그래서 각 파티션의 `ship_date` 히스토그램은 그 파티션에 실제로 있는 값 범위만 담는다. 2020년 파티션의 히스토그램은 2020년 언저리만, 2024년 파티션은 2024년 언저리만 덮는다.

파티셔닝 전에는 테이블 전체에 히스토그램이 하나였다. 파티셔닝 후에는 연도별로 갈라진 히스토그램 여러 개가 됐다. 1단계의 물리적 배치가 플래너의 입력을 바꾼 것이다.

### 4.3 3단계: 통계에 따른 파티션별 접근 경로 선택

플래너는 파티션마다 스캔 플랜을 따로 세운다. `ship_date BETWEEN '2024-01-01' AND '2024-12-31'` 조건을 2020년 파티션의 히스토그램에 대면 일치 행이 극소수로 추정된다(플랜에 표시되는 추정 rows는 최소 1이다). 그래서 무관 파티션에는 보통 짧은 인덱스 프로브가 배정된다. 아주 작은 파티션이라면 순차 스캔이 선택될 수도 있지만 어느 쪽이든 비용이 작다. 2024년 파티션에서는 날짜 조건을 대부분 행이 만족한다고 추정되고, 그 파티션의 크기와 분포에 맞는 스캔(인덱스, 비트맵, 순차)이 선택된다.

실행 단계의 동작도 추정과 일치한다. 2020년 파티션의 `ship_date` 인덱스에는 2024년 키가 아예 없다. B-tree를 몇 페이지 타고 내려가 0건을 확인하고 끝난다. 실제 힙 읽기는 관련 파티션에 집중된다.

```text
업무 프로세스의 상관 (order_date ≈ ship_date)
→ order_date 파티셔닝: ship_date 값이 파티션 사이에서 집중·분리 (배치)
→ 파티션별 ship_date 히스토그램이 연도별로 갈라짐 (통계)
→ 무관 파티션은 짧은 인덱스 프로브, 관련 파티션은 밀집 스캔 (플랜)
→ 힙 읽기가 관련 파티션에 집중 (실행)
```

이 대목이 가장 오해하기 쉽다. 상관관계가 파티션 프루닝을 켜는 것처럼 보이지만, 이 쿼리에서 프루닝은 성립하지 않는다. 다음 표로 둘을 구분한다.

| 관점 | 파티션 프루닝이 일어난다면 | 이 쿼리의 실제 동작 |
| --- | --- | --- |
| 결정 시점 | 계획 단계 | 실행 단계 |
| 성립 조건 | `order_date`(파티션 키) 조건 | `ship_date` 인덱스와 두 컬럼의 상관 |
| 무관 파티션(2020~2023) | 플랜에서 빠져 방문하지 않음 | 플랜에 포함되지만 인덱스 프로브 후 0건으로 종료 |
| 2024 파티션 | 스캔 | 스캔, 실제 힙 읽기 발생 |
| 무관 파티션 비용 | 0 (계획에서 제외) | 0에 가까움 (인덱스 몇 페이지) |

두 경우는 청구서가 비슷할 뿐 사건은 다르다. 프루닝은 무관 파티션에 처음부터 가지 않는 것이고, 이 쿼리는 갔지만 인덱스에서 빈손으로 즉시 돌아오는 것이다. 이 쿼리에는 `order_date` 조건이 없으므로 프루닝은 성립하지 않는다. 상관관계가 한 일은 프루닝을 켜는 것이 아니라, 2024년 출고 행을 2024년 파티션에만 모아 두어 나머지 파티션의 인덱스 조회를 빈손으로 만든 것이다. 두 컬럼이 무상관이었다면 2024년 출고 행이 모든 파티션에 흩어져 어느 파티션 인덱스에서도 빈손이 나오지 않고, 파티셔닝의 이점도 사라진다.

`EXPLAIN (ANALYZE, BUFFERS)`로 둘을 눈으로 구분할 수 있다. 프루닝이면 무관 파티션이 플랜 목록에서 아예 사라지거나 `(never executed)`로 표시된다. 이 쿼리는 다섯 파티션이 모두 목록에 나타나되, 무관 파티션의 actual rows가 0이고 Buffers가 몇 페이지에 그친다.

핵심은 이것이다. **플래너가 컬럼 간 상관을 이해하게 된 것이 아니다. 상관이 데이터의 배치를 바꿨고, 배치가 플래너가 원래 읽던 파티션별 단일 컬럼 통계를 갈라놓았다.** 플래너는 하던 대로 각 파티션의 로컬 통계와 비용을 읽고 접근 경로를 골랐을 뿐이다. 이것은 파티션 프루닝이 아니라 파티션별 접근 경로 선택의 효과다.

인덱스가 필수라는 점도 여기서 나온다. 인덱스가 없으면 무관 파티션을 값싸게 확인할 방법이 없어 파티션마다 순차 스캔이 걸리고, 전체를 다 읽는 것과 같아진다.

### 4.4 절감의 원천: 인덱스 탐색이 아니라 힙 접근 밀집도

무관 파티션의 인덱스 프로브가 몇 페이지 만에 끝난다는 사실은 주의해서 읽어야 한다. 이것은 파티셔닝이 추가한 확인 비용이 작다는 뜻이지, 그 자체가 단일 테이블 대비 절감의 원천은 아니다. 단일 테이블의 `ship_date` B-tree도 탐색은 2024년 키 범위로 바로 내려가므로, 다른 연도의 인덱스 엔트리를 훑느라 비용을 쓰지는 않는다.

차이는 인덱스 다음, 힙에서 벌어진다.

- **힙 접근의 밀집도.** 파티셔닝 후에는 조건에 맞는 행이 한 파티션의 힙에 몰려 있어, 한 페이지를 읽으면 그 안의 여러 행이 조건에 걸린다. 단일 테이블에서 갱신이나 순서가 섞인 적재로 행이 흩어져 있으면, 행 하나를 확인할 때마다 다른 페이지를 임의 접근하게 된다.
- **접근 경로 선택의 자유.** 단일 테이블은 테이블 전체에 하나의 접근 경로만 고를 수 있다. 파티셔닝 후에는 값이 집중된 파티션에 밀집 읽기에 유리한 플랜을, 무관 파티션에 짧은 프로브를 따로 배정할 수 있다.

부수 효과도 같은 방향으로 작동한다. 적재가 대체로 시간 순이면 연도 파티션 내부에서 `ship_date`의 값-위치 상관(`pg_stats.correlation`)이 높게 유지되어, 3.1의 메커니즘대로 파티션 안의 인덱스 스캔 비용도 낮게 추정된다. 다만 파티셔닝 자체가 이 값을 높여 주는 것은 아니다.

---

## 5. 실측 비교: 인덱스만 vs 파티션+인덱스

비교 기준을 먼저 정한다. PostgreSQL에는 쿼리 결과 캐시가 없다. 같은 쿼리의 두 번째 실행이 빨라지는 것은 데이터 페이지가 메모리(shared_buffers, OS 페이지 캐시)에 남아 있기 때문이다. 실행 시간은 캐시 상태에 따라 흔들리므로, 비교는 [`EXPLAIN (ANALYZE, BUFFERS)`](https://www.postgresql.org/docs/current/sql-explain.html)의 버퍼 접근량으로 한다.

버퍼 수치를 읽을 때는 세 가지를 전제한다.

- `shared read`는 shared_buffers에 없어 밖에서 가져온 블록이라는 뜻이지, 반드시 물리 디스크까지 갔다는 뜻은 아니다. OS 페이지 캐시가 줬을 수 있다.
- `shared hit + read` 총합은 고유 페이지 수가 아니라 버퍼 접근 횟수다. 같은 페이지를 다시 방문하면 다시 센다. 첫 실행의 힌트 비트 기록 같은 정리로 재실행 때 소폭 줄 수 있지만, 구성 간 비교를 뒤집을 수준은 아니다.
- 아래 표는 콜드 캐시에서 측정해 `shared hit`이 무시할 수준이었고, `shared read`가 사실상 접근 총량이다.

1년 범위 조회를 두 구성에서 측정한 결과다. 실행 열은 운영 타임아웃(5분) 기준이고, 타임아웃으로 중단된 실행은 `EXPLAIN (ANALYZE, BUFFERS)` 출력을 남기지 않으므로 인덱스만 구성의 수치는 타임아웃을 해제해 완주시킨 별도 실행에서 얻었다.

| 구성 | shared read (블록) | 환산 | 실행 |
| --- | --- | --- | --- |
| 인덱스만 (단일 테이블) | 2,367,444 | 약 18 GiB | 5분 타임아웃 |
| 파티션 + 인덱스 | 440,442 | 약 3.4 GiB | 57초 |

shared read가 약 5.4배 줄었다. 관련 파티션 하나 크기만큼만 읽은 결과와 부합한다.

다만 이 수치의 해석에는 선을 그어야 한다. 읽기량 감소는 4장의 메커니즘, 그리고 두 컬럼의 상관과 **일치하는 정황**이지 그 자체로 증거는 아니다. 읽기량 차이는 선택된 플랜 종류, 테이블·인덱스 크기와 블로트, 캐시 조건 같은 다른 요인으로도 벌어질 수 있다. 상관 자체는 6장처럼 직접 측정해서 확인하고(이 사례의 실측 상관계수는 0.9996이다), 읽기 감소의 원인은 6장의 체크리스트로 실행 계획에서 확정한다.

파티셔닝만 적용하고 인덱스가 없는 구성이 같은 쿼리에서 타임아웃 난 것도 4장의 해석과 일치한다. 무관 파티션을 값싸게 건너뛰는 동작은 인덱스가 있어야 성립한다.

---

## 6. 상관을 직접 확인하는 방법

추론에 그치지 않고 수치로 확인할 수 있다.

`ship_date` 2024년 행이 `order_date` 연도별로 어떻게 분포하는지 본다. 거의 전부 2024년에 몰려 있으면 집중이 확인된다.

```sql
SELECT date_part('year', order_date) AS order_year, count(*)
FROM orders
WHERE ship_date BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY 1
ORDER BY 1;
```

두 컬럼의 상관계수를 표본으로 계산한다. 1에 가까우면 강한 양의 상관이다.

```sql
SELECT corr(extract(epoch FROM order_date), extract(epoch FROM ship_date))
FROM orders TABLESAMPLE SYSTEM (1);
```

이 글의 사례 테이블에서 실측한 값은 `0.999644700573826`이다. 1에 극히 가까운 강한 양의 상관으로, 4장의 전제(주문일과 출고일이 함께 움직인다)가 수치로 확인된다.

파티션별 값-위치 상관을 조회한다. 파티션마다 1에 가까우면 인덱스 스캔이 순차 읽기에 가깝게 동작한다.

```sql
SELECT tablename, attname, correlation
FROM pg_stats
WHERE tablename LIKE 'orders_%' AND attname = 'ship_date';
```

마지막으로, 읽기량 차이의 원인을 확정하려면 `EXPLAIN (ANALYZE, BUFFERS)`에서 다음을 확인한다.

- 단일 테이블 구성에서 실제 선택된 스캔 종류 (인덱스 / 비트맵 / 순차)
- Append 아래 파티션별 추정 rows와 actual rows — 무관 파티션이 극소수로 추정되고 실측 0건인지
- 파티션별 Buffers(비트맵 힙 스캔이면 Heap Blocks 포함) — 힙 읽기가 관련 파티션에 집중되는지
- 두 구성의 테이블·인덱스 크기와 블로트가 비교 가능한 수준인지, 설정과 캐시 조건이 같은지

버퍼 수치는 상위 노드에 하위 노드 값이 포함되므로, 노드별 값을 단순 합산하면 중복 집계된다는 점만 주의한다.

---

## 7. 실무 시사점

**파티션 키는 주 조회 축과 상관이 높은 컬럼으로 잡는다.** 조회 축 자체를 파티션 키로 삼을 수 있으면 가장 확실하고, 그렇지 않아도 상관이 높으면 이 글의 메커니즘으로 효과를 본다.

**파티션별 인덱스를 함께 둔다.** 무관 파티션을 값싸게 걸러내는 동작은 인덱스가 전제다.

**적재 후 ANALYZE를 보장한다.** 이 메커니즘은 파티션별 히스토그램이 실제 분포를 반영할 때 성립한다. 통계 갱신이 목적이면 `ANALYZE`로 충분하다. `VACUUM`은 dead tuple 정리와 visibility map 갱신이라는 별도 역할이므로 필요에 따라 함께 두는 것이다. 특히 [autovacuum은 파티션 부모 테이블을 처리하지 않는다](https://www.postgresql.org/docs/current/sql-analyze.html). 리프 파티션은 일반 테이블로 개별 처리되지만 대량 적재 직후 임계치 도달 전까지는 통계가 낡아 있을 수 있으므로, 적재 파이프라인 마지막에 부모에 대한 `ANALYZE`를 명시적으로 두는 편이 안전하다.

**한계를 인지한다.** 상관이 약한 컬럼 필터에는 이 이점이 없다. OR 결합, ILIKE 부분 일치, 끝이 열린 넓은 범위처럼 인덱스로 충분히 좁혀지지 않는 조건은 파티셔닝과 인덱스를 다 갖춰도 느릴 수 있다. 이런 조회는 날짜 범위 제한 같은 별도 정책으로 보완한다.

---

## 8. 정리

- PostgreSQL에서 correlation은 두 대상을 가리킨다. 값-위치 상관은 `pg_stats.correlation`에 저장되는 실제 플래너 통계고, 컬럼 간 상관은 통계가 아니라 데이터가 가진 관계다.
- 값-위치 상관은 플래너가 인덱스 스캔 비용 계산에 직접 쓴다. 컬럼 간 상관은 기본 통계에 없고, 플래너는 독립 가정으로 선택도를 곱한다. 확장 통계(함수적 종속·결합 n_distinct·MCV)는 부분 보정에 그친다.
- 상관된 컬럼으로 파티셔닝하면 관련 값이 특정 파티션에 모여 저장되고, 그 배치가 파티션별 단일 컬럼 히스토그램을 갈라놓는다. 플래너가 읽지 못하던 컬럼 간 상관이 플래너가 읽는 통계 형태로 드러난다.
- 그 효과는 파티션 프루닝이 아니라 파티션별 접근 경로 선택이다. 무관 파티션은 짧은 인덱스 프로브로 끝나고, 힙 읽기는 값이 집중된 파티션에 몰린다. 절감의 원천은 인덱스 탐색이 아니라 힙 접근의 밀집도다.
- 실측에서 shared read가 약 5.4배 줄었고, 두 컬럼의 상관계수 실측값은 0.9996이었다. 읽기량 감소는 상관과 일치하는 정황이고, 원인 확정은 실행 계획으로 한다.
- 파티션 키는 주 조회 축과 상관 높은 컬럼으로 잡고, 파티션별 인덱스와 적재 후 ANALYZE를 함께 보장한다.

---

## 9. 참고 자료

링크는 작성 시점의 current(PostgreSQL 18) 문서를 가리킨다.

- [pg_stats — correlation 컬럼](https://www.postgresql.org/docs/current/view-pg-stats.html) — 값-위치 상관의 정의(-1~+1)와 ±1 근처에서 인덱스 스캔이 저렴하게 추정되는 근거 (2장, 3.1절)
- [Statistics Used by the Planner — Extended Statistics](https://www.postgresql.org/docs/current/planner-stats.html#PLANNER-STATS-EXTENDED) — 다중 조건 결합 시 독립 가정과 그 한계 (3.2절)
- [Extended Statistics — Functional Dependencies](https://www.postgresql.org/docs/current/planner-stats.html#PLANNER-STATS-EXTENDED-FUNCTIONAL-DEPS) — 함수적 종속이 상수 등호 조건과 상수 IN 목록에만 적용된다는 제한 (3.2절)
- [Extended Statistics — Multivariate N-Distinct Counts](https://www.postgresql.org/docs/current/planner-stats.html#PLANNER-STATS-EXTENDED-N-DISTINCT-COUNTS) — 결합 n_distinct의 용도 (3.2절)
- [Extended Statistics — Multivariate MCV Lists](https://www.postgresql.org/docs/current/planner-stats.html#PLANNER-STATS-EXTENDED-MCV-LISTS) — 다중 컬럼 MCV의 동작과 적용 범위 (3.2절)
- [Multivariate Statistics Examples](https://www.postgresql.org/docs/current/multivariate-statistics-examples.html) — MCV가 범위 조건에도 적용되는 공식 예시 (3.2절)
- [Table Partitioning — Partition Pruning](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITION-PRUNING) — 프루닝이 파티션 키 조건으로 작동한다는 근거 (1장, 3.2절)
- [Table Partitioning — Partitioning and Constraint Exclusion](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-CONSTRAINT-EXCLUSION) — 비키 컬럼 CHECK 제약으로 파티션이 제외되는 예외 (3.2절)
- [ANALYZE](https://www.postgresql.org/docs/current/sql-analyze.html) — 파티션 부모 ANALYZE 시 각 파티션 통계의 재귀 수집·갱신, autovacuum이 파티션 부모를 처리하지 않는다는 주의 (4.2절, 7장)
- [EXPLAIN — BUFFERS 옵션](https://www.postgresql.org/docs/current/sql-explain.html) — 버퍼 접근량 측정 방법 (5장)
- [PostgreSQL 10 릴리스 노트](https://www.postgresql.org/docs/release/10.0/) — CREATE STATISTICS(함수적 종속, 결합 n_distinct) 도입 (3.2절)
- [PostgreSQL 12 릴리스 노트](https://www.postgresql.org/docs/release/12.0/) — 다중 컬럼 MCV 확장 통계 추가 (3.2절)
- [PostgreSQL 소스 — costsize.c의 cost_index()](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/optimizer/path/costsize.c) — correlation 제곱으로 최선/최악 IO 비용을 보간하는 구현 (3.1절)
