---
title: "[Iceberg] REST Catalog와 테이블 모니터링"
excerpt: "Iceberg REST Catalog가 무엇이고 왜 필요한지, 그리고 이 카탈로그를 축으로 테이블을 어떻게 모니터링하는지 정리한다."

categories:
  - Data
tags:
  - Data
  - Iceberg
  - REST Catalog
  - 데이터레이크하우스
  - 모니터링
  - 데이터옵저버빌리티

permalink: /data/iceberg-rest-catalog-table-monitoring/

toc: true
toc_sticky: true

date: 2026-07-24
last_modified_at: 2026-07-24
---

## 1. 배경: Iceberg 테이블에는 카탈로그가 필요하다

Apache Iceberg는 데이터 레이크(S3, HDFS, 오브젝트 스토리지) 위에 올라가는 **테이블 포맷**이다.

실제 데이터는 Parquet, ORC 같은 파일로 저장되고, 테이블의 구조와 스냅샷 정보는 메타데이터 파일(`metadata.json`, manifest)로 저장된다.

여기서 한 가지가 빠진다. **어떤 테이블의 현재 최신 `metadata.json`이 무엇인지**를 누군가 관리해줘야 한다.

이 "테이블 이름 → 최신 metadata.json 포인터" 매핑을 관리하는 것이 **카탈로그(Catalog)** 다.

카탈로그 구현체는 여러 가지가 있다.

| 구현 | 특징 | 약점 |
|------|------|------|
| Hive Metastore | 전통적, Thrift 기반 | 무겁고 Java 클라이언트에 종속 |
| Hadoop(파일시스템) | 파일 이름 규칙 의존 | 동시 커밋의 원자성이 약함 |
| JDBC | RDB에 포인터 저장 | 커넥션, 드라이버 관리 필요 |
| AWS Glue 등 | 관리형 | 벤더 종속 |
| **REST Catalog** | 표준 HTTP API | 이 글의 주제 |

이 글의 본문에 나오는 버킷명(`s3://my-bucket/warehouse`), 데이터베이스명(`analytics_db`), 테이블명(`mart.sales_summary`)은 모두 설명을 위한 예시 값이다.

---

## 2. REST Catalog란 무엇이고 왜 쓰는가

REST Catalog는 **Iceberg가 표준으로 정의한 HTTP REST API 스펙**이다.

카탈로그를 특정 구현(Hive, Glue)에 묶지 않고, 표준화된 REST 인터페이스 뒤에 둔다.

핵심은 하나다. **클라이언트는 카탈로그 백엔드가 무엇인지 몰라도 된다.**

```text
[Spark / Flink / Trino / PyIceberg]
            │  (표준 REST API 호출)
            ▼
   ┌──────────────────────┐
   │  REST Catalog Server  │  ← OpenAPI 스펙으로 정의된 표준
   └──────────────────────┘
            │
   내부 백엔드는 무엇이든 가능
   (JDBC / Hive / Glue / 자체 DB ...)
```

이 표준은 Iceberg 저장소의 `rest-catalog-open-api.yaml` OpenAPI 문서로 관리된다.

기존 방식과 비교하면 REST Catalog를 쓰는 이유가 분명해진다.

| 항목 | 기존(Hive/Hadoop) | REST Catalog |
|------|-------------------|--------------|
| 언어 종속성 | Java, Thrift 클라이언트 필요 | HTTP만 되면 어떤 언어든 접속 |
| 커밋 원자성 | 파일 rename 의존, 취약 | 서버가 서버사이드에서 원자적 커밋 보장 |
| 클라이언트 무게 | Hive JAR, Hadoop conf 필요 | 얇은(thin) 클라이언트 |
| 백엔드 교체 | 클라이언트가 백엔드에 종속 | 백엔드를 바꿔도 클라이언트 불변 |
| 거버넌스 | 제어 지점이 분산 | 서버 한 곳에서 인증, 권한, 감사 집중 |
| 벤더 중립 | 특정 벤더 락인 | 표준 스펙, 어떤 엔진이든 붙음 |

특히 두 가지가 중요하다.

- **중앙집중 거버넌스**: 인증, 인가, 감사, 데이터 접근 제어를 REST 서버 한 곳에서 통제한다.
- **벤더 락인 회피**: Spark, Trino, Flink, DuckDB, PyIceberg가 전부 같은 API로 접속한다.

---

## 3. REST Catalog로 조회하고 수행할 수 있는 것

REST Catalog API가 제공하는 동작을 기능별로 정리한다.

### 3.1 서버 설정

접속 시 최초로 호출하는 엔드포인트다.

| 동작 | 엔드포인트 | 설명 |
|------|-----------|------|
| 설정 조회 | `GET /v1/config` | 서버가 강제/기본 설정, warehouse 위치 등을 내려준다 |

### 3.2 네임스페이스 (스키마/DB 개념)

| 동작 | 엔드포인트 |
|------|-----------|
| 목록 조회 | `GET /v1/{prefix}/namespaces` |
| 생성 | `POST /v1/{prefix}/namespaces` |
| 존재 확인 | `HEAD .../namespaces/{ns}` |
| 상세 조회 | `GET .../namespaces/{ns}` |
| 삭제 | `DELETE .../namespaces/{ns}` |
| 프로퍼티 수정 | `POST .../namespaces/{ns}/properties` |

### 3.3 테이블 (핵심)

| 동작 | 엔드포인트 |
|------|-----------|
| 목록 조회 | `GET .../namespaces/{ns}/tables` |
| 생성 | `POST .../namespaces/{ns}/tables` |
| **로드(메타데이터 조회)** | `GET .../tables/{table}` |
| 존재 확인 | `HEAD .../tables/{table}` |
| **커밋(업데이트)** | `POST .../tables/{table}` |
| 삭제 | `DELETE .../tables/{table}` |
| 이름 변경/이동 | `POST .../tables/rename` |
| 다중 테이블 트랜잭션 | `POST .../transactions/commit` |
| 스토리지 자격증명 조회 | `GET .../tables/{table}/credentials` |

테이블을 로드(`GET .../tables/{table}`)하면 다음을 얻는다.

- **스키마**와 스키마 진화 이력
- **파티션 스펙**과 **정렬 순서(sort order)**
- **현재 스냅샷과 스냅샷 히스토리** (타임 트래블의 근거)
- 테이블 **프로퍼티**
- 데이터/메타데이터 파일 위치, manifest 정보
- 설정에 따라 데이터 접근용 임시 스토리지 자격증명(vended credentials)

### 3.4 뷰

| 동작 | 엔드포인트 |
|------|-----------|
| 목록 조회 | `GET .../namespaces/{ns}/views` |
| 생성/로드/교체/삭제 | `POST/GET/POST/DELETE .../views/{view}` |
| 이름 변경 | `POST .../views/rename` |

### 3.5 메트릭, 트랜잭션, 인증

- **메트릭 리포팅**: `POST .../tables/{table}/metrics` 로 스캔/커밋 통계를 서버로 보낸다. (뒤 6장에서 자세히 다룬다.)
- **다중 테이블 트랜잭션**: 여러 테이블 변경을 원자적으로 커밋한다.
- **인증**: OAuth2, Bearer 토큰, API Key 같은 표준 HTTP 인증을 그대로 쓴다.

---

## 4. REST Catalog가 테이블 모니터링의 중심이 되는 이유

여기서 관점을 하나 바꾼다.

> REST Catalog는 그저 테이블 포인터를 관리하는 저장소이고, 모니터링은 엔진이나 스토리지에서 따로 해야 하는 것 아닌가?

그렇지 않다. 카탈로그는 이미 **모든 테이블 변경이 반드시 지나가는 단일 관문**이다.

Iceberg 테이블은 어떤 엔진이 쓰든 **모든 커밋이 카탈로그를 통해 원자적으로 반영**된다.

```text
Spark ─┐
Flink ─┼──▶ [REST Catalog] ──▶ metadata.json 갱신 (스냅샷 생성)
Trino ─┘         │
                 └──▶ 무슨 일이 일어났는지 여기서 다 보인다
```

파일시스템 카탈로그는 변경이 여기저기 흩어져 관측이 어렵다.

반면 REST Catalog는 HTTP 서버 한 곳이다. 로그, 메트릭, 감사, 알림을 **중앙에서** 걸 수 있다.

이것이 REST Catalog와 모니터링을 잇는 본질이다. 조회의 관문이 곧 관측의 관문이다.

---

## 5. 조회 항목을 모니터링 지표로 매핑하기

3장에서 정리한 조회 항목을 모니터링 관점으로 다시 매핑하면, API가 그대로 지표의 원천이 된다.

| REST Catalog에서 얻는 것 | 모니터링 활용 |
|--------------------------|---------------|
| 테이블 로드의 **스냅샷 히스토리** | 커밋 빈도, 마지막 쓰기 시각, 데이터 신선도 |
| 스냅샷 **summary**(added/deleted files, records) | 쓰기량 추이, 삭제량, 이상 급증 감지 |
| **manifest, data file 목록** | 스몰 파일 문제, 파일 수 폭증 감지 |
| 스냅샷별 파일 통계 | 파티션 스큐, 데이터 편향 |
| 만료되지 않은 스냅샷 수 | 스냅샷 누적에 따른 비용, 메타데이터 비대화 |
| 테이블 프로퍼티 | 보존 정책, 압축 설정 준수 여부 |
| **메트릭 리포팅 API** | 스캔/커밋 리포트, 쿼리 성능 |

조회를 위한 API가 이미 존재하므로, 별도 저장소를 새로 만들 필요 없이 카탈로그를 관측 소스로 그대로 쓸 수 있다.

---

## 6. Metrics Reporting API: Iceberg의 표준 관측 채널

REST Catalog 스펙에는 클라이언트가 **스캔/커밋 결과를 카탈로그 서버로 되돌려 보고**하는 기능이 있다.

두 종류의 리포트가 있다.

### 6.1 ScanReport (읽기 성능)

쿼리가 실행될 때마다 다음을 보고한다.

- 스캔한 데이터 파일 수, 스킵한 파일 수
- 스캔한 레코드 수, 총 바이트
- 파티션 프루닝 효율 (필터가 파일을 얼마나 걸러냈는가)
- 스캔 계획에 걸린 시간

이 리포트로 특정 쿼리가 왜 느린지, 파티셔닝이 실제로 효과가 있는지를 서버에서 관측한다.

### 6.2 CommitReport (쓰기 통계)

커밋마다 다음을 보고한다.

- added/removed 데이터 파일, 삭제 파일, 레코드 수
- 총 커밋 소요 시간
- 커밋 재시도(attempt) 횟수

쓰기 충돌 빈도와 작업량 추이가 여기서 드러난다.

이 리포트들을 카탈로그 서버가 받아 Prometheus, Datadog, 로그로 흘려보내면 그대로 대시보드가 된다.

---

## 7. 무엇을 모니터링할 것인가

카탈로그에서 뽑아낼 수 있는 값을 기준으로, 실제 감시 대상을 네 갈래로 정리한다.

### 7.1 테이블 상태 (Table Status)

- **스몰 파일 비율**: 파일 수는 많은데 파일당 크기가 작으면 쿼리 성능이 떨어진다. compaction 필요 신호다.
- **스냅샷 누적 수**: 만료(expire)하지 않으면 메타데이터가 비대해져 테이블 로드가 느려진다.
- **삭제 파일 누적**: Merge-on-Read 테이블에서 delete 파일이 쌓이면 읽기 성능이 저하된다.
- **manifest 파일 수**: 많으면 스캔 계획이 느려진다.

### 7.2 데이터 신선도 (Freshness)

마지막 스냅샷 timestamp를 현재 시각과 비교한다.

특정 테이블이 정해진 시간 안에 갱신되지 않으면 SLA 위반으로 알림을 보낸다.

### 7.3 파이프라인 정상성

- CommitReport의 재시도 급증: 동시 커밋 충돌을 의미한다.
- 예정된 시간대의 커밋 실종: 배치나 스트리밍 잡의 장애를 의미한다.

### 7.4 비용과 거버넌스

- orphan 파일(참조되지 않는 파일) 누적: 스토리지 낭비다.
- REST 서버 감사 로그: 누가 어떤 테이블을 조회했는지 추적한다.

---

## 8. 모니터링 아키텍처와 구현체

### 8.1 수집 방식: Push와 Pull

```text
┌──── 엔진 (Spark/Flink/Trino/PyIceberg) ────┐
│  스캔/커밋 시 ScanReport, CommitReport 전송   │
└───────────────────────┬───────────────────┘
                        ▼
            ┌────────────────────────┐
            │   REST Catalog Server   │
            │  - 커밋 이벤트            │
            │  - Metrics 엔드포인트     │
            │  - 감사 로그             │
            └───────┬────────┬────────┘
                    │        │
          (1) 실시간 이벤트    (2) 주기적 폴링
                    │        │  GET tables/{t} 로 스냅샷/파일 스캔
                    ▼        ▼
         ┌──────────────────────────────┐
         │ Prometheus / Datadog / Grafana │
         │  + 알림(Alertmanager, Slack)    │
         └──────────────────────────────┘
```

두 축으로 수집한다.

- **Push (실시간)**: 메트릭 리포팅 API로 엔진이 리포트를 보낸다. 커밋과 스캔을 즉시 관측한다.
- **Pull (주기적)**: 모니터링 잡이 `GET .../tables/{table}` 로 스냅샷과 파일 통계를 주기적으로 폴링한다. 상태 지표를 계산한다.

### 8.2 구현체별 모니터링 지원

| REST Catalog 구현 | 모니터링 관련 특징 |
|-------------------|-------------------|
| Apache Polaris | 이벤트, 감사 로그, 메트릭 노출 |
| Lakekeeper | Prometheus 메트릭 내장, OpenTelemetry, 서버 이벤트 훅 |
| Nessie | 커밋이 브랜치처럼 기록되어 변경 이력 추적에 강함 |
| Unity Catalog | 감사, 리니지 중심 |
| 직접 폴링 | 어떤 구현이든 `GET .../tables/{t}` 로 스냅샷 스캔 가능 |

### 8.3 메타데이터 테이블과의 관계

Iceberg에는 `snapshots`, `files`, `manifests`, `partitions`, `history`, `metadata_log_entries` 같은 **메타데이터 테이블**이 있다.

주의할 점이 있다. 이 메타데이터 테이블은 REST Catalog가 아니라 **쿼리 엔진**을 통해 조회한다.

```sql
SELECT * FROM analytics_db.sales_summary.snapshots;
SELECT * FROM analytics_db.sales_summary.files;
```

REST Catalog는 그 원천이 되는 `metadata.json`을 서빙하고, 엔진이 그것을 펼쳐 보여주는 구조다.

따라서 실무에서는 Pull 폴링과 메타데이터 테이블 쿼리를 함께 쓴다. 카탈로그로 대상 테이블 목록과 최신 스냅샷 포인터를 얻고, 엔진으로 파일 단위 상세를 조회한다.

---

## 9. 정리

- **REST Catalog는 Iceberg 테이블의 최신 메타데이터 포인터를 관리하는 표준 HTTP API**다. 언어 중립성, 얇은 클라이언트, 서버사이드 원자적 커밋, 중앙집중 거버넌스, 벤더 락인 회피가 도입 이유다.
- 조회하고 수행할 수 있는 것은 config, 네임스페이스 CRUD, 테이블 로드/커밋/생성/삭제/rename, 뷰 관리, 다중 테이블 트랜잭션, 메트릭 리포팅이다.
- **모든 커밋이 카탈로그를 거치므로, 카탈로그는 모니터링을 걸기 가장 좋은 단일 관문**이다. 조회 항목이 곧 지표의 원천이 된다.
- **Metrics Reporting API(ScanReport, CommitReport)** 는 Iceberg가 표준으로 제공하는 실시간 성능 관측 채널이다.
- **Push(엔진이 리포트 전송)와 Pull(카탈로그 폴링)** 두 축으로 테이블 상태, 신선도, 파이프라인 정상성을 관측한다.
- 핵심 감시 대상은 스몰 파일, 스냅샷 누적, delete 파일, 데이터 신선도, 커밋 충돌이다.
