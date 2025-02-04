---  
title: "[Spark] 스파크 JDBC 파티셔닝 최적화"  
excerpt: "스파크에서 JDBC 파티셔닝을 활용해 데이터 읽기 최적화 하기"  
  
categories:  
  - Data  
tags:  
  - [Data]  
permalink: /data/[Spark]-스파크-JDBC-파티셔닝-최적화/  
  
toc: true  
toc_sticky: true  
  
date: 2025-02-01
last_modified_at: 2025-02-01
---  
  
## Spark JDBC

Spark는 JDBC를 통해 관계형 데이터베이스(RDBMS)에 연결하여 데이터를 읽거나 쓸 수 있는 기능을 제공한다. 그러나 RDBMS는 분산 처리 시스템이 아니므로 Spark의 병렬 처리 성능을 최대한 활용하려면 추가적인 최적화가 필요하다. Spark는 셔플을 최소화하기 위해 기존 파티션을 최대한 재사용하려 하므로, 데이터 읽기 시점에서부터 파티셔닝을 최적화하는 것이 중요하다. 데이터 읽기의 파티션 수가 적으면 후속 작업의 병렬성이 저하되므로, 효율적인 데이터 읽기가 필수적이다.

## JDBC를 활용한 데이터 읽기

Spark에서 JDBC 데이터를 읽기 위해 `DataFrameReader.jdbc` 메서드를 사용한다. 아래는 기본적인 JDBC 데이터 읽기 옵션이다. 기본적으로 Spark는 데이터베이스에서 데이터를 읽을 때 단일 커넥션을 사용하므로, 데이터가 크면 속도가 느려지거나 메모리 부족으로 세션이 중단될 수 있다.

```python
df = spark.read \
    .format("jdbc") \
    .option("url", "jdbc:postgresql://host:5432/dbname") \
    .option("dbtable", "schema.tablename") \
    .option("user", "username") \
    .option("password", "password") \
    .load()
```

| **옵션**   | **설명**                  | **예시**                                     |
|-----------|-------------------------|-----------------------------------------|
| url      | JDBC 연결 URL             | `jdbc:postgresql://host:5432/dbname`   |
| dbtable  | 읽으려는 테이블 또는 서브쿼리 | `schema.tablename` 또는 `(SELECT * FROM table) AS tmp` |
| user     | 데이터베이스 사용자 이름      | `service`                               |
| password | 데이터베이스 비밀번호        | `*******`                               |

## JDBC 데이터 파티셔닝을 통한 성능 최적화

[//]: # (![JDBC 데이터 소스 분할]&#40;/assets/images/2025-02-01-[Spark]-스파크-JDBC-파티셔닝-최적화/img1.png&#41;)

Spark에서 JDBC 데이터를 병렬로 읽기 위해 파티셔닝을 사용할 수 있다. 이를 위해 `partitionColumn`, `lowerBound`, `upperBound`, `numPartitions` 옵션을 모두 지정해야 하며, `partitionColumn`은 숫자, 날짜, 타임스탬프 타입이어야 한다.

아래 예제는 `id` 컬럼을 기준으로 10개의 파티션을 생성하는 방식이다.

```python
df = spark.read \
    .format("jdbc") \
    .option("url", "jdbc:postgresql://host:5432/dbname") \
    .option("dbtable", "tablename") \
    .option("user", "username") \
    .option("password", "password") \
    .option("partitionColumn", "id") \
    .option("lowerBound", "1") \
    .option("upperBound", "1000") \
    .option("numPartitions", "10") \
    .load()
```

| **옵션**          | **설명**                                                 | **예시**                                     |
|------------------|------------------------------------------------------|-----------------------------------------|
| partitionColumn | 파티셔닝 기준 컬럼                                      | `id`                                   |
| lowerBound      | 파티셔닝 범위 최소 값                                  | `1`                                    |
| upperBound      | 파티셔닝 범위 최대 값                                  | `1000`                                 |
| numPartitions   | 생성할 파티션 수                                       | `10`                                   |

## 성능 최적화 테스트

테스트 환경:
- 테이블명: `ft_cre_nurskt_clnc`
- 총 row 수: `71,239,156건`
- 컬럼 수: `28개`

| **No.** | **리소스**            | **파티셔닝 옵션**                           | **작업 수(Task)** | **파티션 왜곡 비율 (Skew Ratio)** | **소요 시간**      |
| ------- | ------------------ | ------------------------------------- | -------------- | -------------------------- | -------------- |
| 1       | 8코어 16GB (4개 인스턴스) | 파티셔닝 없음                               | 1              | -                          | 메모리 부족으로 세션 종료 |
| 2       | 4코어 16GB (4개 인스턴스) | 연도별 파티셔닝 (`year_col`)                 | 20             | 11.8                       | 메모리 부족으로 세션 종료 |
| 3       | 1코어 4GB (2개 인스턴스)  | 월별 파티셔닝 (`month_col`)                 | 12             | 1.3                        | 메모리 부족으로 세션 종료 |
| 4       | 1코어 4GB (2개 인스턴스)  | 일자별 파티셔닝 (`day_col`)                  | 31             | 1.89                       | 6.4분           |
| 5       | 1코어 4GB (2개 인스턴스)  | 일자별 파티셔닝 (`day_col`, `upperBound=32`) | 31             | 1.77                       | 3.7분           |

각 파티셔닝 옵션은 아래와 같이 구성된다.

- **연도별 파티셔닝**
    
    ```
    dbtable_sub = "(SELECT EXTRACT(YEAR FROM {partition_col2}) AS year_col, * FROM {table_name}) AS subquery"
    df = spark.read \
        .format("jdbc") \
        .option("partitionColumn", "year_col") \
        .option("lowerBound", 2003) \
        .option("upperBound", 2024) \
        .option("numPartitions", "100") \
        .load()
    ```
    
- **월별 파티셔닝**
    
    ```
    dbtable_sub = "(SELECT EXTRACT(MONTH FROM {partition_col2}) AS month_col, * FROM {table_name}) AS subquery"
    df = spark.read \
        .format("jdbc") \
        .option("partitionColumn", "month_col") \
        .option("lowerBound", 1) \
        .option("upperBound", 13) \
        .option("numPartitions", "12") \
        .load()
    ```
    
- **일자별 파티셔닝 (수정된 upperBound=32 적용)**
    
    ```
    df = spark.read \
        .format("jdbc") \
        .option("partitionColumn", "day_col") \
        .option("lowerBound", 1) \
        .option("upperBound", 32) \
        .option("numPartitions", "31") \
        .load()
    ```

이와 같이 다양한 파티셔닝 방식을 테스트하고 최적의 데이터 분산을 찾는 것이 성능 최적화의 핵심이다.


## 이슈 트래킹

1. Data Skew 문제

Data Skew란 특정 파티션에 데이터가 몰려 데이터가 균등하게 분산되지 않는 현상을 의미한다. 특정 태스크가 데이터량이 많아지면서 리소스 사용량이 증가하고, 전체 처리 속도가 저하될 수 있다.

| 연도  | 데이터 수 | 일자 | 데이터 수 |
|------|---------|-----|---------|
| 2004 | 363     | 1   | 1,843,233 |
| 2005 | 511     | 2   | 2,350,572 |
| 2006 | 9,306   | 3   | 2,319,334 |
| ...  | ...     | ... | ...       |
| 2022 | 7,501,165 | 29  | 2,149,230 |
| 2023 | 7,426,306 | 30  | 2,051,441 |
| 2024 | 5,954,938 | 31  | 1,428,250 |

테스트 초기에 날짜 컬럼의 연도를 기준으로 파티셔닝을 시도하였으나 Skew Ratio가 11.8배로 나타났다. 이는 가장 큰 파티션이 가장 작은 파티션보다 11.8배 많음을 의미하며, 결국 메모리 부족으로 세션이 종료되었다.

연도별 데이터 개수를 분석한 결과, 특정 연도의 데이터가 지나치게 많아 파티션 간 균형이 맞지 않았다. 이에 따라 일자별 파티셔닝을 수행하여 Skew Ratio를 11.8에서 1.77로 줄였다.

2. 파티션 개수가 예상과 다르게 생성되는 문제

lowerBound와 upperBound를 1과 31로 설정하고 numPartitions=31로 지정하였으나 실제 생성된 파티션 수는 30개였다.

이는 Spark가 lowerBound를 포함하고 upperBound는 포함하지 않는 방식으로 파티션을 생성하기 때문이다. 즉, 실제 파티션 범위는 [lowerBound, upperBound) 이므로 upperBound=32로 설정해야 31개의 파티션이 정확하게 생성되었다.

3. Skew Ratio가 낮아도 세션이 종료되는 문제

월별 파티셔닝을 적용하였을 때, Skew Ratio는 1.3으로 가장 적었으나, 파티션별 데이터 수가 많아 메모리 부족 현상이 발생하였다. 즉, 데이터가 균등하게 분배되었더라도 각 파티션의 크기가 커지면 단일 태스크가 감당할 수 없는 수준이 되어 세션이 종료될 수 있다.

결론적으로, Skew Ratio가 낮다고 해서 반드시 최적화된 상태는 아니며, 적절한 파티션 크기 조정이 필요하다.

주의사항

Spark는 자체적으로 커넥션 풀을 관리하지 않으므로, 과도한 파티션 설정으로 인해 데이터베이스에 너무 많은 연결이 생성되지 않도록 주의해야 한다.

numPartitions 값을 과도하게 설정하면 데이터베이스 부하가 증가할 수 있으므로 적절한 값을 설정하는 것이 중요하다.
