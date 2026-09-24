---
title: "[Datamates] 데이터 플랫폼의 Spark + Iceberg를 DuckDB + DuckLake로 전환한 이유"
excerpt: "데이터 규모에 비해 무거웠던 Spark와 Iceberg 중심 구조를 DuckDB와 DuckLake로 단순화한 과정과 결과를 정리한다."

categories:
  - Project

tags:
  - Datamates
  - Data
  - DuckDB
  - DuckLake
  - Iceberg
  - PostgreSQL
  - dbt

permalink: /data/duckdb-ducklake-architecture-rewrite/

toc: true
toc_sticky: true

date: 2026-08-18
last_modified_at: 2026-08-27
series: "데이터 플랫폼 구축 프로젝트"
series_order: 3
---

작은 데이터 플랫폼에 Spark, Iceberg REST Catalog, DuckDB가 함께 들어가 있었다. 기능은 동작했지만 데이터 규모에 비해 실행 구조가 무거웠고, 변환과 조회가 서로 다른 엔진에 나뉘어 운영 복잡도도 커졌다. 이 글은 저장 계층과 실행 엔진을 다시 구성하면서 어떤 기준으로 구조를 줄였는지 정리한 기록이다.

## 데이터 규모에 비해 무거웠던 실행 구조

전환 전 웨어하우스는 약 113MB, 주요 팩트 테이블은 약 14만 행 규모였다. 이 정도 데이터에 비해 처리 계층은 꽤 복잡했다. dbt 모델 변환은 Spark가 맡고, 저장 포맷은 Iceberg, 카탈로그는 별도 REST 서비스, 미리보기와 분석 조회는 DuckDB가 담당했다.

```text
dbt
  └─ Spark
      └─ Iceberg REST Catalog
          └─ Object Storage / Parquet

API Preview
  └─ DuckDB
      └─ Iceberg REST Catalog

BI / Analysis
  └─ DuckDB
      └─ Iceberg REST Catalog
```

가장 큰 문제는 Spark의 계산 성능이 아니라 실행 비용이었다. dbt가 Spark를 호출할 때마다 JVM이 새로 올라왔고, 기동에 약 15초가 필요했다. 짧은 변환 작업에서도 실제 SQL 실행보다 JVM 시작 시간이 더 크게 느껴졌다.

같은 데이터를 다루면서 변환은 Spark, 조회는 DuckDB, 적재는 별도 라이브러리를 사용했다. 각 계층이 다른 엔진과 접속 방식을 가지다 보니 의존성, 이미지 크기, 카탈로그 연결 설정도 함께 늘었다. 데이터가 커져서 복잡해진 구조라기보다, 선택한 기술 때문에 구조가 커진 상태에 가까웠다.

**재설계 목표:** 현재 데이터 규모에서 불필요한 런타임 비용을 줄이고, 변환과 조회 경로를 최대한 같은 엔진으로 맞춘다.

## SQLite 메타데이터 계층의 Postgres 전환

실행 엔진을 바꾸기 전에 메타데이터 저장소부터 정리했다. 플랫폼 메타스토어, Airflow 메타DB, Iceberg 카탈로그가 각각 SQLite를 사용하고 있었다. 단일 프로세스 환경에서는 간단했지만 쓰기가 겹치기 시작하면서 제약이 드러났다.

| 구성 | SQLite 사용 시 제약 | 전환 후 |
| --- | --- | --- |
| 플랫폼 메타스토어 | 동시 쓰기 시 대기 발생 | Postgres |
| Airflow 메타DB | SequentialExecutor 사용 | Postgres + LocalExecutor |
| Iceberg 카탈로그 | 동시 커밋에서 `SQLITE_BUSY` | Postgres |

DB를 서비스별로 하나씩 늘리기보다는 Postgres 인스턴스 하나에 데이터베이스를 분리하는 구성을 택했다. 세 저장소가 같은 호스트에서 함께 기동되고 종료되는 구조였기 때문에, 컨테이너을 각각 분리하는 것보다 운영 단위를 줄이는 쪽이 이 프로젝트에는 더 적합했다.

이 단계에서 플랫폼 메타스토어 14개 테이블과 Iceberg 카탈로그 메타데이터를 옮겼고, 기존 테이블과 스냅샷 이력이 정상적으로 조회되는 것을 확인했다. Airflow도 SequentialExecutor에서 LocalExecutor로 변경했다.

여기서 중요한 변화는 DB 제품을 바꿨다는 사실보다, 메타데이터 계층이 더 이상 SQLite의 단일 writer 제약에 묶이지 않게 된 점이었다.

## 처리 엔진 재선정을 위한 기준

Postgres 전환 이후에도 dbt 빌드의 고정 비용은 남아 있었다. Spark JVM 기동 약 15초를 없애려면 변환 엔진을 바꿔야 했지만, 단순히 더 빠른 엔진을 고르는 것으로는 부족했다.

| 조건 | 기준 |
| --- | --- |
| 미리보기 응답 시간 유지 | 기존 조회 함수 약 13.8ms, API 왕복 약 25ms |
| 정확 중위값 유지 | 대표 지표에서 정확 분위수 사용 |
| dbt 유지 | `manifest.json`을 플랫폼 메타데이터의 기준으로 사용 |
| 로컬 구축 가능 | 외부 클라우드 서비스에 의존하지 않음 |

### Trino 검토

Trino는 Iceberg와의 호환성이 좋지만 별도 서버와 분산 쿼리 계층이 추가된다. 현재 데이터 규모에서는 분산 실행의 이점을 얻기 어렵고, 대표 지표에 필요한 정확 분위수 대신 근사 분위수 계열을 사용해야 한다는 점도 맞지 않았다.

### DuckDB + Iceberg 검토

이미 조회 계층에서 DuckDB를 사용하고 있었기 때문에 변환까지 DuckDB로 통일하는 방향은 자연스러웠다. 다만 현재 환경의 DuckDB Iceberg 쓰기에서는 `CREATE OR REPLACE`를 사용할 수 없었다.

모델 12개가 매 실행마다 전체 재생성되는 구조에서 `DROP` 후 `CREATE`를 사용하면 테이블이 잠깐 존재하지 않는 구간이 생긴다. 그 순간 미리보기나 차트 요청이 들어오면 조회 실패로 이어질 수 있어 운영 경로로 쓰기 어려웠다.

### DuckLake 채택

DuckLake에서는 DuckDB가 변환 엔진과 카탈로그 접근을 함께 맡을 수 있었고, 기존 객체 저장소의 Parquet 기반 구조도 유지할 수 있었다. 게이트 테스트에서 `CREATE OR REPLACE` 동작과 기존 Iceberg 데이터의 이관 가능성을 확인한 뒤 전환 대상으로 정했다.

## DuckDB + DuckLake 중심의 아키텍처 단순화

전환 후에는 Spark와 Iceberg REST Catalog가 빠지고, DuckDB가 dbt 변환과 조회를 담당한다. DuckLake 메타데이터는 Postgres에 저장하고 데이터 파일은 기존 객체 저장소에 둔다.

```text
dbt
  └─ DuckDB
      └─ DuckLake
          ├─ Postgres Metadata
          └─ Object Storage / Parquet

API Preview
  └─ DuckDB
      └─ DuckLake

BI / Analysis
  └─ DuckDB
      └─ DuckLake
```

| 역할 | 전환 전 | 전환 후 |
| --- | --- | --- |
| 변환 | Spark | DuckDB |
| 조회 | DuckDB | DuckDB |
| 카탈로그 | Iceberg REST + Postgres | DuckLake + Postgres |
| 데이터 파일 | Object Storage / Parquet | Object Storage / Parquet |
| 정확 중위값 | `percentile` | `quantile_cont` |

데이터 파일의 위치를 바꾸는 작업보다 실행 계층을 줄이는 작업에 가까웠다. Java 런타임과 Spark 패키지, Spark 어댑터, 별도 Iceberg REST 서비스가 빠졌고 변환과 조회에서 사용하는 SQL 엔진도 하나로 정리됐다.

엔진을 바꾼 뒤에는 결과 값이 같다는 확인이 더 중요했다. 특히 중위값을 사용하는 지표는 엔진별 함수 차이가 숫자 차이로 이어질 수 있어, 동일한 기간을 고정한 뒤 지역별 결과를 대조했다. 25개 지역에서 지표가 모두 일치했고, 이관한 33개 테이블의 행 수도 전부 맞았다.

## 전환 결과와 트레이드오프

- **133s → 23s** — 전체 dbt build
- **13.8ms → 13.6ms** — 미리보기 조회
- **4.88GB → 3.75GB** — 오케스트레이터 이미지
- **33 / 33** — 이관 테이블 행 수 일치

가장 큰 변화는 빌드 시간이었다. Spark JVM 기동 비용이 사라지면서 전체 dbt build가 133초에서 약 23초로 줄었다. 반면 미리보기 조회는 13.8ms에서 13.6ms로 거의 변하지 않았다. 기존에 DuckDB가 맡고 있던 빠른 조회 경로를 그대로 유지했기 때문이다.

이미지 크기도 4.88GB에서 3.75GB로 감소했다. Java 런타임과 Spark 관련 패키지, 이벤트 로그 및 의존성 캐시가 빠진 영향이 컸다. 성능 수치뿐 아니라 배포 이미지와 운영 구성도 함께 줄었다.

### Iceberg 대비 상호운용성 축소

DuckLake로 바꾸면서 모든 면이 좋아진 것은 아니다. Iceberg의 장점은 여러 엔진이 같은 테이블 포맷을 공유할 수 있다는 점이다. DuckLake는 현재 DuckDB 중심의 생태계에 더 가깝기 때문에, 다른 분산 엔진이 같은 테이블을 직접 읽어야 하는 환경이라면 같은 선택을 하기 어렵다.

이 프로젝트에서는 Spark도 실제로 로컬 모드로 동작하고 있었고, 데이터 규모 역시 단일 노드에서 충분히 처리 가능한 수준이었다. 그래서 현재 사용하지 않는 분산 처리 가능성을 유지하는 것보다 지금 발생하고 있는 실행 비용과 운영 복잡도를 줄이는 쪽을 선택했다.

**적합했던 이유:** DuckLake가 항상 Iceberg보다 낫기 때문이 아니라, 현재 데이터 규모와 실행 방식에서는 Spark와 Iceberg가 제공하는 확장성을 사용하지 않으면서 그 운영 비용만 지불하고 있었기 때문이다.

{% include pjt-series.html current=3 %}
