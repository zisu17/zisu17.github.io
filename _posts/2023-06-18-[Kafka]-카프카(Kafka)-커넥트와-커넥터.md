---
title: "[Kafka] Kafka Connect와 Connector로 데이터 옮기기"
excerpt: "Kafka Connect의 구성 요소와 MongoDB·Elasticsearch Sink Connector 설정을 정리한다."
nav_section: data
nav_topic: pipelines

categories:
  - Data Engineering
tags:
  - Data

permalink: /data/[Kafka]-카프카(Kafka)-커넥트와-커넥터/

toc: true
toc_sticky: true

date: 2023-06-18
last_modified_at: 2026-11-12
---

## Kafka Connect

Kafka 토픽에 쌓인 데이터를 MongoDB나 Elasticsearch로 옮기려면 토픽을 읽고 대상 시스템에 저장하는 코드가 필요하다. Kafka Connect를 사용하면 시스템별 Connector를 설정해 이 작업을 실행할 수 있다.

Kafka Connect는 Kafka와 외부 시스템 사이에서 데이터를 옮기는 실행 환경이다. 외부 시스템에서 Kafka로 가져오는 것은 Source Connector이고 Kafka에서 외부 시스템으로 보내는 것은 Sink Connector이다.

예를 들어 DB의 변경 데이터를 Kafka로 가져온 뒤 검색용 Elasticsearch에 저장한다면 다음처럼 연결할 수 있다.

```text
DB → Source Connector → Kafka 토픽 → Sink Connector → Elasticsearch
```

Connector는 설치해서 실행하는 플러그인이다. JSON은 Connector의 이름과 접속 정보, 토픽 등을 지정할 때 사용하는 설정 형식이다.

| 구성 요소 | 역할 |
|---|---|
| Connector | 연결할 시스템과 작업 설정을 관리하고 Task에 작업을 나눔 |
| Task | 실제 데이터를 읽거나 쓰는 실행 단위 |
| Worker | Connector와 Task를 실행하는 프로세스 |
| Converter | Kafka의 바이트 데이터와 Connect 내부 데이터 표현 사이의 직렬화·역직렬화를 담당 |
| SMT | 레코드별로 필드 추출이나 토픽명 변경 같은 간단한 변환을 수행 |
| REST API | 커넥터 생성·상태 조회·일시 중지·재시작 등을 요청 |

Worker가 Connect를 실행하는 프로세스라면 Task는 그 안에서 실제로 데이터를 읽거나 쓰는 작업 단위이다. `tasks.max`는 Task 수의 상한이므로 이 값만큼 항상 생성되는 것은 아니다.

Task가 언제나 Kafka 파티션 하나에 대응하는 것도 아니다. Source는 외부 시스템에서 나눌 수 있는 작업에 따라 병렬성이 달라진다. Sink는 토픽의 파티션을 Task에 배정한다. 파티션이 3개라면 `tasks.max=10`으로 설정해도 동시에 데이터를 읽는 Task는 최대 3개이다. Task 하나가 여러 파티션을 맡을 수도 있다.

### Connector 등록과 상태 확인

분산 모드에서는 REST API로 Connector를 등록하고 상태를 확인한다. 등록할 때는 최상위에 `name`과 `config`가 있는 JSON 파일을 준비한다. `name`에는 Connector 이름을 넣고 `config` 안에 클래스와 토픽, 접속 정보 등을 넣는다. 시스템별 설정은 아래 MongoDB와 Elasticsearch 예제를 참고하면 된다.

아래는 이 파일을 `connector.json`으로 저장하고 Connect REST API를 로컬 8083 포트로 열어 둔 경우의 예시이다.

```bash
# 요청을 받은 Worker에 설치된 Connector 플러그인
curl -sS http://localhost:8083/connector-plugins

# connector.json의 설정으로 Connector 등록
curl -sS -X POST -H 'Content-Type: application/json' \
  --data @connector.json http://localhost:8083/connectors

# 등록된 Connector 이름 목록
curl -sS http://localhost:8083/connectors

# mongo-sink라는 이름으로 등록한 Connector와 Task의 상태
curl -sS http://localhost:8083/connectors/mongo-sink/status
```

`/connector-plugins`에 나온다고 이미 실행 중인 것은 아니다. 설치된 플러그인으로 Connector를 등록해야 작업이 시작된다. 상태를 볼 때도 Connector만 `RUNNING`인지 확인하지 말고 각 Task의 상태를 함께 확인한다. Task가 `FAILED`라면 응답의 오류 내용과 Worker 로그를 살펴본다.

## MongoDB Sink Connector

MongoDB Sink Connector는 Kafka 토픽의 레코드를 MongoDB 문서로 저장한다. 먼저 [MongoDB Kafka Connector](https://www.mongodb.com/docs/kafka-connector/current/)를 Connect Worker의 플러그인 경로에 설치하고 Worker가 커넥터 클래스를 인식하는지 확인한다.

아래 화면은 2023년 실습 당시의 설정이다. 지원 속성은 Connector 버전에 따라 달라질 수 있다.

![MongoDB Sink Connector 설정 화면](https://user-images.githubusercontent.com/108858121/230305219-893f4dd5-1a82-4f4a-b6f6-9ca2cc5c3b98.png)

### 주요 설정

| 속성 | 설명 |
|---|---|
| `name` | 커넥터 인스턴스 이름 |
| `connector.class` | 실행할 MongoDB Sink Connector 클래스 |
| `topics` | 읽을 Kafka 토픽 |
| `connection.uri` | MongoDB 접속 URI |
| `database`·`collection` | 저장할 데이터베이스와 컬렉션 |
| `tasks.max` | 생성할 Task 수의 상한 |
| `document.id.strategy` | MongoDB 문서의 `_id`를 만드는 전략 |
| `writemodel.strategy` | 같은 `_id`의 문서를 삽입·교체·갱신하는 방식 |
| `post.processor.chain` | MongoDB에 쓰기 전에 적용할 후처리 체인 |
| `max.batch.size` | 한 번의 쓰기에 묶을 레코드 수 |
| `delete.on.null.values` | 키가 있고 value가 null인 레코드를 삭제 요청으로 처리할지 여부 |

`ProvidedInValueStrategy`는 value 문서의 `_id`를 사용한다. 이 전략을 쓰려면 value에 실제로 `_id`가 있어야 한다. `ReplaceOneDefaultStrategy`는 같은 `_id`의 문서를 교체하고 없으면 삽입하는 방식이다.

`document.id.strategy.overwrite.existing`은 ID 전략이 기존 `_id`를 덮어쓸지를 정한다. 문서 전체를 교체할지는 `writemodel.strategy`에서 정한다. 이름이 비슷해도 서로 다른 설정이다.

`max.batch.size=0`은 무한히 레코드를 모은다는 뜻이 아니다. Connector가 받은 배치를 추가로 나누지 않고 한 번의 bulk write로 처리한다는 뜻이다.

`key.converter`와 `value.converter`는 Kafka에 저장된 직렬화 형식에 맞춘다. 스키마 없이 저장한 JSON 객체를 Connect 객체로 읽으려면 `JsonConverter`와 `schemas.enable=false`를 사용한다. `StringConverter`는 문자열로 읽기 때문에 같은 결과가 나오지 않는다. `schemas.enable`도 모든 Converter가 공통으로 사용하는 옵션은 아니다.

`group.id`를 볼 때는 Connect Worker 클러스터의 그룹과 Sink의 컨슈머 그룹을 구분해야 한다. Sink의 그룹은 기본적으로 Connector 이름을 바탕으로 만들어진다. 재정의가 필요하면 Worker의 허용 정책과 `consumer.override.group.id` 지원을 확인한다.

### 전송 결과

![Kafka 토픽 데이터가 MongoDB 컬렉션에 저장된 결과](https://user-images.githubusercontent.com/108858121/230308902-5cdd296d-04a2-4f6a-a21e-8b715064c0c6.png)

## Elasticsearch Sink Connector

Elasticsearch Sink Connector는 Kafka 레코드를 Elasticsearch 문서로 저장한다. [커넥터 설치 문서](https://docs.confluent.io/kafka-connectors/elasticsearch/current/index.html)를 참고해 Worker에 플러그인을 설치한다.

![Elasticsearch Sink Connector 설정 화면](https://user-images.githubusercontent.com/108858121/230304661-bc88f3eb-2b40-4c77-a918-7ce5fb4030f9.png)

### 문서 ID와 value 변환 구분하기

`key.ignore=true`이면 Kafka key 대신 토픽·파티션·오프셋으로 문서 ID를 만든다. `schema.ignore=true`는 Connect 스키마로 Elasticsearch 매핑을 만들지 않는다는 설정이다. 문서 구조를 검사하지 않는다는 뜻은 아니다.

`ExtractField$Value`로 `_id`를 꺼내면 value 전체가 그 필드 값으로 바뀐다. 이것만으로 Elasticsearch 문서 ID가 설정되지는 않는다. value의 다른 필드를 유지하면서 `_id`를 문서 ID로 쓰려면 key를 만든 뒤 `key.ignore=false`로 설정한다.

예를 들어 value가 `{"_id": "post-1", "title": "Kafka"}`라면 `_id`를 key로 복사한 뒤 그 안에서 문자열을 추출한다. Elasticsearch의 `_id`는 메타데이터이므로 value의 `_id`는 제거하고 나머지 필드를 문서 본문으로 보낸다. 아래는 Connector 설정의 일부이다.

```json
{
  "key.ignore": "false",
  "schema.ignore": "true",
  "value.converter": "org.apache.kafka.connect.json.JsonConverter",
  "value.converter.schemas.enable": "false",
  "transforms": "MakeKey,ExtractKey,DropId",
  "transforms.MakeKey.type": "org.apache.kafka.connect.transforms.ValueToKey",
  "transforms.MakeKey.fields": "_id",
  "transforms.ExtractKey.type": "org.apache.kafka.connect.transforms.ExtractField$Key",
  "transforms.ExtractKey.field": "_id",
  "transforms.DropId.type": "org.apache.kafka.connect.transforms.ReplaceField$Value",
  "transforms.DropId.exclude": "_id"
}
```

`MakeKey`가 `{"_id": "post-1"}` 형태의 key를 만들고 `ExtractKey`가 여기서 `"post-1"`만 꺼낸다. 마지막으로 `DropId`가 value의 `_id`를 제거한다. 문서 ID는 `post-1`이 되고 본문에는 `{"title": "Kafka"}`가 남는다.

이 설정은 value에 `_id`가 들어 있는 경우를 전제로 한다. `connection.url`과 `topics`, `connector.class` 같은 필수 설정은 별도로 지정한다.

`type.name`과 `index.name` 같은 속성은 Connector와 Elasticsearch 버전에 따라 지원 여부가 다르다. 매핑 타입과 토픽·인덱스 연결 방식은 설치한 버전의 설정 문서를 확인한다. 잘못된 문서를 무시하도록 설정하면 일부 데이터가 저장되지 않을 수 있다. 오류를 어디에 남길지와 해당 데이터를 어떻게 처리할지도 정해야 한다.

### 전송 결과

![Kafka 토픽 데이터가 Elasticsearch에 저장된 결과](https://user-images.githubusercontent.com/108858121/230308131-b09dc539-849f-4825-b1df-9d5d5560f123.png)

## 마무리

Connect는 데이터를 옮기는 실행 환경이고 Connector는 외부 시스템별 플러그인이다. 연결이 되더라도 원하는 문서가 그대로 저장되는지는 별도로 확인해야 한다. Converter가 읽은 데이터의 형태와 SMT 적용 결과를 먼저 확인하고 대상 시스템의 문서 ID와 내용을 비교하면 된다.

## 참고자료

- [Apache Kafka 3.0 Connect 사용자 가이드](https://kafka.apache.org/30/kafka-connect/user-guide/)
- [MongoDB Sink Connector 설정](https://www.mongodb.com/docs/kafka-connector/current/sink-connector/configuration-properties/all-properties/)
- [MongoDB 쓰기 전략](https://www.mongodb.com/docs/kafka-connector/current/sink-connector/fundamentals/write-strategies/)
- [Elasticsearch Sink Connector 13.1 설정](https://docs.confluent.io/kafka-connectors/elasticsearch/13.1/configuration_options.html)
- [ExtractField와 ValueToKey 변환](https://docs.confluent.io/cloud/current/connectors/transforms/extractfield.html)
- [ReplaceField로 필드 제외하기](https://docs.confluent.io/kafka-connectors/transforms/current/replacefield-ak.html)
- [Elasticsearch 문서 메타데이터](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/document-metadata-fields)


