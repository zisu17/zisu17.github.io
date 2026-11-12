---
title: "[Spark] JDBC 파티셔닝으로 대용량 읽기 나누기"
excerpt: "JDBC 읽기 분할 옵션과 경계값의 동작을 확인하고 대용량 실험에서 데이터 편중과 파티션 크기를 비교한다."
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
last_modified_at: 2026-11-12
---

## JDBC 읽기도 나누어야 할까?

Spark에서 관계형 DB의 데이터를 읽을 때는 JDBC를 사용할 수 있다. 병렬 읽기를 설정하지 않으면 일반적으로 하나의 읽기 파티션으로 처리하므로 Executor를 늘려도 이 구간이 같은 비율로 빨라지지는 않는다.

JDBC 파티셔닝은 DB 테이블 자체를 다시 파티셔닝하는 기능이 아니다. Spark가 서로 다른 조건의 쿼리를 보내 읽기 작업을 나누는 방식이다. 따라서 Spark의 자원뿐 아니라 DB의 연결 수와 쿼리 부하도 함께 봐야 한다.

## 기본 읽기와 병렬 읽기

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

`load()`로 DataFrame을 만들었다고 전체 데이터를 이미 읽은 것은 아니다. 실제 데이터를 요구하는 액션에서 읽기 작업이 실행된다. 코드의 어느 구간을 측정하는지도 구분해야 한다.

범위 기준 병렬 읽기는 `partitionColumn`과 `lowerBound`, `upperBound`, `numPartitions`를 함께 지정한다. 기준 컬럼은 숫자나 날짜, 타임스탬프 타입이어야 한다.

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

`numPartitions`는 병렬 읽기에 사용할 파티션 수의 상한이다. 동시에 실행되는 읽기 작업 수는 Spark의 실행 슬롯에도 제한되지만 DB 연결 부하를 늘릴 수 있다는 점은 같으므로 무작정 크게 설정하지 않는다.

## lowerBound와 upperBound는 필터가 아니다

두 값은 파티션을 나눌 간격을 정한다. `lowerBound=1`과 `upperBound=1000`을 넣었다고 ID가 1 이상 1000 미만인 행만 읽는 것은 아니다.

예를 들어 정수 컬럼에 하한 1과 상한 5, 파티션 4개를 지정하면 Spark 3.5 계열에서는 다음과 같은 조건으로 나뉜다.

| 읽기 파티션 | 조건 |
|---|---|
| 1 | `id < 2 OR id IS NULL` |
| 2 | `id >= 2 AND id < 3` |
| 3 | `id >= 3 AND id < 4` |
| 4 | `id >= 4` |

따라서 `id=100`도 마지막 파티션에 들어간다. 읽을 행 자체를 제한하려면 `dbtable`에 넣는 서브쿼리의 `WHERE` 등에 실제 필터를 지정해야 한다. `query` 옵션은 `partitionColumn`과 함께 사용할 수 없으므로 서브쿼리 방식과 구분한다.

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

표의 Task 수와 Skew Ratio는 당시 기록값이다. Task 수가 JDBC 읽기 Stage만을 센 값인지는 이 표만으로 확인할 수 없으므로 아래의 읽기 파티션 수와 같은 값으로 취급하지 않는다. Skew Ratio도 계산 기준에 따라 달라지므로 실제 행 수 분포를 함께 확인한다.

여러 조건을 함께 바꾼 실험이므로 시간 차이를 특정 옵션 하나의 효과로 단정하기는 어렵다. 다만 연도와 월을 기준으로 나눴을 때보다 일자를 기준으로 나눈 경우에 작업을 완료할 수 있었다.

## 날짜의 어느 부분으로 나눌까?

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

위 데이터에서는 연도별 차이가 컸다. 일자 기준으로 나누면 그 편중은 줄일 수 있지만 “일자면 항상 고르게 나뉜다”는 뜻은 아니다. 업무 특성상 월말이나 특정 날짜에 데이터가 집중될 수도 있다.

다음은 개념을 확인하기 위한 일반화한 예제이다. `public.events`에 `id`와 `event_time`이 있다고 가정한다. 실험 표의 전체 조건을 그대로 재현한 코드는 아니다.

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

날짜에서 연도나 월을 추출한 컬럼도 같은 방식으로 사용할 수 있다. 다만 계산식을 조건에 사용하면 기존 날짜 인덱스를 그대로 활용하지 못할 수 있다. 각 쿼리가 DB에서 얼마나 읽는지는 실행 계획도 확인해야 한다.

## 파티션 수가 줄어드는 이유

정수 기준에서 `lowerBound=1`과 `upperBound=31`이면 두 값의 차이는 30이다. Spark 3.5.6 구현은 이 차이가 요청한 파티션 수보다 작으면 읽기 파티션 수를 줄인다. 따라서 `numPartitions=31`이어도 30개로 조정될 수 있다.

상한을 32로 두면 차이가 31이 되어 이 예제에서는 31개로 나눌 수 있다. 이는 `[1, 32)` 범위만 읽도록 필터링했기 때문이 아니다. 첫 파티션과 마지막 파티션은 바깥쪽 값도 포함한다.

기존 실험 표에는 일자 기준 Task 수가 31로 남아 있지만 이 설정 설명의 30개 읽기 파티션과는 맞지 않는 부분이 있다. 다시 확인할 때는 전체 Job의 Task 수 대신 JDBC 읽기 Stage와 `getNumPartitions()` 결과를 구분해서 기록해야 한다.

## 분포가 고르면 메모리 문제도 해결될까?

월별 분할에서는 Skew Ratio가 1.3으로 기록됐지만 메모리 부족으로 세션이 종료됐다. 편중이 작아도 각 읽기 작업이 다루는 데이터량이 클 수 있다. 또한 같은 크기의 파티션이라도 실행 중인 다른 연산에 따라 메모리 사용량은 달라진다.

파티션 하나의 전체 데이터가 항상 메모리에 한꺼번에 올라가야 하는 것은 아니다. JDBC 드라이버의 결과 가져오기 방식과 `fetchsize`, 이후 집계와 정렬, 캐시 사용 여부도 확인해야 한다. 메모리 부족이 Driver와 Executor 중 어디에서 발생했는지도 로그로 구분한다.

`fetchsize`는 JDBC 드라이버가 한 번에 가져올 행 수에 영향을 주는 옵션이지 Spark 파티션 수를 늘리는 옵션은 아니다. 지원 방식은 DB와 드라이버마다 다르다. 파티션 수만 늘리거나 `fetchsize` 하나만 바꾼다고 모든 메모리 문제가 해결되지는 않는다.

또 분할 쿼리는 서로 다른 연결에서 실행된다. 읽는 동안 원본 데이터가 바뀌면 전체 결과가 하나의 일관된 시점이라고 보장할 수 없다. 스냅샷 일관성이 필요하다면 DB와 수집 방식까지 함께 설계해야 한다.

## 마무리

JDBC 병렬 읽기는 작업을 나누는 방법이지만 DB 부하도 함께 나눈다. 먼저 기준 컬럼의 실제 분포와 각 쿼리의 실행 계획을 확인하고 DB가 감당할 수 있는 연결 수 안에서 파티션 수를 조정한다.

이 실험에서는 일자 기준 분할로 작업을 완료했고 가장 짧게 기록한 시간은 3.7분이었다. 다른 테이블에도 같은 값이 맞는 것은 아니므로 입력량과 실행 자원, 읽기 파티션 수를 함께 남겨 비교해야 한다.

## 참고자료

- [Spark 3.5.6 JDBC 데이터 소스](https://spark.apache.org/docs/3.5.6/sql-data-sources-jdbc.html)
- [DataFrameReader.jdbc의 연결 수 주의사항](https://spark.apache.org/docs/3.5.6/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrameReader.jdbc.html)
- [JDBC 읽기 파티션 생성 구현](https://github.com/apache/spark/blob/v3.5.6/sql/core/src/main/scala/org/apache/spark/sql/execution/datasources/jdbc/JDBCRelation.scala)
