---
title: "[Spark] JDBC 파티셔닝 최적화"
excerpt: "JDBC 파티셔닝 옵션으로 DB를 병렬 조회하고 대용량 테이블 실험에서 기준 컬럼과 파티션 수에 따른 차이를 비교한다."
nav_section: data
nav_topic: processing

categories:
  - Data Engineering
tags:
  - Data
permalink: /data/[Spark]-스파크-JDBC-파티셔닝-최적화/

toc: true
toc_sticky: true

date: 2025-02-01
last_modified_at: 2026-11-16
---

## JDBC 병렬 조회가 필요한 이유

Spark에서 관계형 DB의 데이터를 조회할 때는 JDBC를 사용할 수 있다. 파티셔닝을 설정하지 않으면 일반적으로 하나의 파티션에서 조회하므로 Executor를 늘려도 조회 성능이 그만큼 좋아지지는 않는다.

JDBC 파티셔닝은 Spark가 서로 다른 조건의 쿼리로 DB 데이터를 병렬 조회하는 기능이다. DB 테이블 자체의 파티션을 바꾸지는 않는다. Spark의 자원뿐 아니라 DB 연결 수와 쿼리 부하도 함께 확인해야 한다.

## 단일 조회와 병렬 조회

아래는 실행 중인 `spark` 세션과 PostgreSQL JDBC 드라이버가 준비된 환경을 가정한다. 접속 정보는 환경변수에서 읽는다.

```python
import os

jdbc_options = {
    "url": os.environ["JDBC_URL"],
    "user": os.environ["JDBC_USER"],
    "password": os.environ["JDBC_PASSWORD"],
    "driver": "org.postgresql.Driver",
}

df = (
    spark.read.format("jdbc")
    .options(**jdbc_options)
    .option("dbtable", "public.events")
    .load()
)
```

`load()`로 DataFrame을 생성해도 전체 데이터가 바로 조회되지는 않는다. 실제 데이터 조회는 액션을 실행할 때 수행된다. 조회 시간을 측정하려면 액션이 완료될 때까지의 시간을 확인해야 한다.

컬럼 값의 범위로 파티셔닝하려면 `partitionColumn`과 `lowerBound`, `upperBound`, `numPartitions`를 함께 지정한다. 기준 컬럼은 숫자나 날짜, 타임스탬프 타입이어야 한다.

```python
df = (
    spark.read.format("jdbc")
    .options(**jdbc_options)
    .option("dbtable", "public.events")
    .option("partitionColumn", "id")
    .option("lowerBound", 1)
    .option("upperBound", 1000)
    .option("numPartitions", 10)
    .load()
)
```

`numPartitions`는 JDBC 파티션 수의 상한이다. 실제로 동시에 실행되는 쿼리 수는 Spark의 실행 슬롯에도 제한된다. 파티션 수를 크게 설정하면 DB 연결 부하가 늘어날 수 있으므로 DB가 처리할 수 있는 범위에서 조정한다.

## lowerBound와 upperBound는 필터가 아니다

두 값은 파티션을 나눌 간격을 정한다. `lowerBound=1`과 `upperBound=1000`을 넣어도 조회 결과가 ID 1 이상 1000 미만인 행으로 제한되지는 않는다.

예를 들어 정수 컬럼에 하한 1과 상한 5, 파티션 4개를 지정하면 Spark 3.5 계열에서는 다음과 같은 조건으로 나뉜다.

| 파티션 | 조회 조건 |
|---|---|
| 1 | `id < 2 OR id IS NULL` |
| 2 | `id >= 2 AND id < 3` |
| 3 | `id >= 3 AND id < 4` |
| 4 | `id >= 4` |

따라서 `id=100`도 마지막 파티션의 조회 대상에 포함된다. 조회할 행을 제한하려면 `dbtable`에 지정하는 서브쿼리에 `WHERE` 조건을 추가해야 한다. `query` 옵션은 `partitionColumn`과 함께 사용할 수 없으므로 `dbtable`의 서브쿼리를 사용한다.

## 대용량 테이블 실험

당시 실험한 테이블은 `ft_cre_nurskt_clnc`로 전체 71,239,156행과 28개 컬럼이었다. 파티셔닝 기준과 실행 자원을 바꾸며 아래 결과를 기록했다.

| 번호·분할 기준 | 실행 자원 | 결과 |
|---|---|---|
| 1 · 파티셔닝 없음 | 8코어 16GB (4개 인스턴스) | 메모리 부족으로 세션 종료 |
| 2 · 연도별 (`year_col`) | 4코어 16GB (4개 인스턴스) | 메모리 부족으로 세션 종료 |
| 3 · 월별 (`month_col`) | 1코어 4GB (2개 인스턴스) | 메모리 부족으로 세션 종료 |
| 4 · 일자별 (`day_col`) | 1코어 4GB (2개 인스턴스) | 6.4분 |
| 5 · 일자별 (`day_col`, `upperBound=32`) | 1코어 4GB (2개 인스턴스) | 3.7분 |

함께 기록한 Task 수와 Skew Ratio는 다음과 같다.

| 번호 | 기록한 Task 수 | Skew Ratio |
|---|---|---|
| 1 | 1 | - |
| 2 | 20 | 11.8 |
| 3 | 12 | 1.3 |
| 4 | 31 | 1.89 |
| 5 | 31 | 1.77 |

표의 Task 수와 Skew Ratio는 당시 기록한 값이다. JDBC 조회 Stage의 Task 수만 기록했는지는 확인되지 않아 아래에서 설명하는 JDBC 파티션 수와 직접 비교하기 어렵다. Skew Ratio도 계산 기준에 따라 달라지므로 실제 행 수 분포를 함께 확인한다.

여러 조건을 함께 바꾼 실험이므로 시간 차이를 특정 옵션 하나의 효과로 단정하기는 어렵다. 다만 연도와 월을 기준으로 나눴을 때보다 일자를 기준으로 나눈 경우에 작업을 완료할 수 있었다.

## 파티셔닝 기준 컬럼의 데이터 분포

연도 기준으로 나누면 최근 연도에 데이터가 몰릴 수 있다. 반면 일자만 추출하면 여러 연도와 월의 같은 일자가 한 구간에 모인다.

| 연도  | 데이터 수 | 일자 | 데이터 수 |
|------|---------|-----|---------|
| 2004 | 363     | 1   | 1,843,233 |
| 2005 | 511     | 2   | 2,350,572 |
| 2006 | 9,306   | 3   | 2,319,334 |
| ...  | ...     | ... | ...       |
| 2022 | 7,501,165 | 29  | 2,149,230 |
| 2023 | 7,426,306 | 30  | 2,051,441 |
| 2024 | 5,954,938 | 31  | 1,428,250 |

위 데이터에서는 연도별 건수 차이가 컸다. 일자 기준으로 나누면 이 편중을 줄일 수 있다. 다른 데이터에서는 월말이나 특정 날짜에 집중될 수 있으므로 실제 분포를 확인해야 한다.

다음은 `public.events`의 `event_time`에서 일자를 추출해 파티셔닝하는 예제이다. `id`와 `event_time` 컬럼이 있다고 가정하며 앞선 실험과는 테이블과 실행 조건이 다르다.

```python
subquery = """
(
    SELECT id,
           event_time,
           EXTRACT(DAY FROM event_time)::integer AS day_col
    FROM public.events
) AS source_data
"""

daily_df = (
    spark.read.format("jdbc")
    .options(**jdbc_options)
    .option("dbtable", subquery)
    .option("partitionColumn", "day_col")
    .option("lowerBound", 1)
    .option("upperBound", 32)
    .option("numPartitions", 31)
    .load()
)

print(daily_df.rdd.getNumPartitions())
daily_df.explain()
```

날짜에서 연도나 월을 추출한 컬럼도 같은 방식으로 사용할 수 있다. 다만 계산식을 조건에 사용하면 기존 날짜 인덱스를 그대로 활용하지 못할 수 있다. DB의 쿼리 실행 계획에서 스캔 범위와 인덱스 사용 여부를 확인해야 한다.

## 파티션 수가 줄어드는 이유

정수 기준에서 `lowerBound=1`과 `upperBound=31`이면 두 값의 차이는 30이다. Spark 3.5.6은 이 차이가 요청한 파티션 수보다 작으면 JDBC 파티션 수를 줄인다. 따라서 `numPartitions=31`이어도 30개로 조정될 수 있다.

상한을 32로 두면 차이가 31이 되어 이 예제에서는 31개 파티션으로 조회할 수 있다. 이 설정도 조회 범위를 `[1, 32)`로 제한하지는 않는다. 첫 파티션과 마지막 파티션은 지정 범위 밖의 값도 포함한다.

기존 실험 표의 일자 기준 Task 수는 31이지만 위 설정으로 계산한 JDBC 파티션 수는 30이다. 다시 확인할 때는 전체 Job의 Task 수와 JDBC 조회 Stage의 Task 수, `getNumPartitions()` 결과를 구분해서 기록해야 한다.

## 데이터 분포와 메모리 사용량

월별 파티셔닝에서는 Skew Ratio가 1.3으로 기록됐지만 메모리 부족으로 세션이 종료됐다. 데이터가 고르게 분포해도 파티션당 데이터량이 클 수 있다. 같은 크기의 파티션이라도 이후 연산에 따라 메모리 사용량은 달라진다.

파티션 하나의 전체 데이터가 항상 메모리에 한꺼번에 올라가야 하는 것은 아니다. JDBC 드라이버의 결과 가져오기 방식과 `fetchsize`, 이후 집계와 정렬, 캐시 사용 여부도 확인해야 한다. 메모리 부족이 Driver와 Executor 중 어디에서 발생했는지도 로그로 구분한다.

`fetchsize`는 JDBC 드라이버가 한 번에 가져올 행 수에 영향을 주는 옵션이지 Spark 파티션 수를 늘리는 옵션은 아니다. 지원 방식은 DB와 드라이버마다 다르다. 파티션 수만 늘리거나 `fetchsize` 하나만 바꾼다고 모든 메모리 문제가 해결되지는 않는다.

파티션별 쿼리는 서로 다른 DB 연결에서 실행된다. 조회 중 원본 데이터가 바뀌면 각 쿼리의 결과가 같은 시점의 데이터라고 보장할 수 없다. 스냅샷 일관성이 필요하다면 DB와 수집 방식까지 함께 설계해야 한다.

## 마무리

JDBC 파티셔닝으로 병렬 조회를 늘리면 DB 연결 수와 부하도 늘어날 수 있다. 기준 컬럼의 데이터 분포와 쿼리 실행 계획을 확인하고 DB가 감당할 수 있는 범위에서 파티션 수를 조정한다.

이 실험에서는 일자 기준 파티셔닝으로 작업을 완료했고 가장 짧게 기록한 시간은 3.7분이었다. 다른 테이블에도 같은 설정을 적용하기보다는 데이터량과 실행 자원, JDBC 파티션 수를 기록해 비교해야 한다.

## 참고자료

- [Spark 3.5.6 JDBC 데이터 소스](https://spark.apache.org/docs/3.5.6/sql-data-sources-jdbc.html)
- [DataFrameReader.jdbc의 연결 수 주의사항](https://spark.apache.org/docs/3.5.6/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrameReader.jdbc.html)
- [JDBC 파티션 생성 코드](https://github.com/apache/spark/blob/v3.5.6/sql/core/src/main/scala/org/apache/spark/sql/execution/datasources/jdbc/JDBCRelation.scala)
