---
title: "[GraphDB] 세법 GraphDB 설계 4편: 관계 모델과 Cypher 예시"
excerpt: "세법 GraphDB의 관계 모델, 관계 속성 표준, 증여세 예시 그래프, Neo4j Cypher 패턴을 정리한다."

categories:
  - Database
tags:
  - Data
  - GraphDB
  - Neo4j
  - RAG
  - Tax

permalink: /data/tax-graphdb-series-04-relationships-cypher/

toc: true
toc_sticky: true

date: 2026-06-17
last_modified_at: 2026-06-17
---

> 세법 GraphDB 시리즈
> - [1편. 왜 세법에는 GraphDB가 필요한가](/data/tax-graphdb-series-01-concept/)
> - [2편. LawUnit 모델링 원칙](/data/tax-graphdb-series-02-modeling/)
> - [3편. 핵심 노드 상세 설계](/data/tax-graphdb-series-03-node-model/)
> - [4편. 관계 모델과 Cypher 예시](/data/tax-graphdb-series-04-relationships-cypher/)
> - [5편. Graph-RAG 검색 설계](/data/tax-graphdb-series-05-graphrag-search/)
> - [6편. 운영 아키텍처와 로드맵](/data/tax-graphdb-series-06-graphrag-operations/)

## 1. 4편의 목적

3편에서는 세법 GraphDB의 핵심 노드와 속성을 설계했다.

4편에서는 노드들을 어떤 관계로 연결할지 정리한다. 법령 구조, 법령 간 참조, 세목·쟁점·용어, 판례·심판례, 예규·해석례, RAG 관련 관계를 나누고, 증여세 자금출처 쟁점 예시와 Cypher 패턴까지 이어서 본다.

이번 편의 목표는 다음과 같다.

```text
1. 세법 GraphDB의 최종 관계 모델을 정리한다.
2. 관계 속성 표준을 정의한다.
3. 증여세 자금출처 쟁점 예시 그래프를 구성한다.
4. Neo4j 제약조건, 인덱스, Cypher 예시를 정리한다.
```

---

## 2. 최종 관계 모델

관계는 GraphDB의 품질을 결정한다. 노드가 “무엇”을 나타낸다면, 관계는 “왜 함께 봐야 하는지”를 나타낸다.

아래 관계들은 세법 GraphDB에서 우선적으로 설계할 관계다.

---

### 2.1 법령 구조 관계

| 관계 | 방향 | 의미 | 예시 |
|---|---|---|---|
| `HAS_UNIT` | `Law -> LawUnit` | 법령이 조문 단위를 포함한다. | 상증세법 → 제45조 |
| `HAS_CHILD` | `LawUnit -> LawUnit` | 조문이 항·호·목을 포함한다. | 제45조 → 제1항 |
| `NEXT_UNIT` | `LawUnit -> LawUnit` | 같은 계층에서 다음 법령 단위를 가리킨다. | 제44조 → 제45조 |
| `REPLACES` | `LawUnit -> LawUnit` | 새 본문이 이전 본문을 대체한다. | 2025년 제45조 → 2021년 제45조 |

#### HAS_UNIT

```text
(:Law)-[:HAS_UNIT]->(:LawUnit)
```

법령이 조문 단위를 포함한다.

```text
상속세 및 증여세법 -[:HAS_UNIT]-> 상속세 및 증여세법 제45조
```

#### HAS_CHILD

```text
(:LawUnit)-[:HAS_CHILD]->(:LawUnit)
```

조문이 항, 호, 목을 포함한다.

```text
제45조 -[:HAS_CHILD]-> 제45조 제1항
제45조 제1항 -[:HAS_CHILD]-> 제45조 제1항 제1호
```

#### REPLACES

```text
(:LawUnit)-[:REPLACES]->(:LawUnit)
```

새 조문 본문이 이전 조문 본문을 대체한다.

```text
2025년 제45조 -[:REPLACES]-> 2021년 제45조
```

---

### 2.2 법령 간 참조 관계

| 관계 | 방향 | 의미 | 예시 |
|---|---|---|---|
| `CITES` | `LawUnit -> LawUnit` | 다른 조문을 인용한다. | 제45조 → 제4조 |
| `DELEGATES_TO` | `LawUnit -> LawUnit` | 법률 조문이 시행령·시행규칙에 위임한다. | 법 제45조 → 시행령 관련 조문 |
| `DETAILED_BY` | `LawUnit -> LawUnit` | 하위 조문이 세부사항을 규정한다. | 법 제45조 → 시행령 제34조 |
| `BASED_ON` | `LawUnit -> LawUnit` | 하위 조문이 상위 조문을 근거로 한다. | 시행령 제34조 → 법 제45조 |
| `APPLIES_WITH` | `LawUnit -> LawUnit` | 함께 적용되는 조문이다. | 과세대상 조문 ↔ 평가 조문 |
| `EXCEPTS` | `LawUnit -> LawUnit` | 예외 관계다. | 원칙 조문 → 예외 조문 |
| `DEFINES` | `LawUnit -> Term` | 용어를 정의한다. | 정의 조문 → 수증자 |

#### DELEGATES_TO와 DETAILED_BY의 차이

```text
DELEGATES_TO
= 상위 조문이 하위 규정에 위임한다는 방향

DETAILED_BY
= 하위 규정이 상위 조문의 세부 내용을 설명한다는 방향
```

예를 들어 법률 조문에 “대통령령으로 정하는 바에 따라”라는 표현이 있으면 `DELEGATES_TO` 후보가 된다. 실제 시행령 조문이 확인되면 `DETAILED_BY`로 연결할 수 있다.

---

### 2.3 세목·쟁점·용어 관계

| 관계 | 방향 | 의미 | 예시 |
|---|---|---|---|
| `ABOUT_TAX` | `LawUnit/Decision/Guidance -> TaxType` | 세목을 연결한다. | 제45조 → 증여세 |
| `HAS_ISSUE` | `LawUnit/Decision/Guidance -> Issue` | 쟁점을 연결한다. | 제45조 → 자금출처 |
| `MENTIONS_TERM` | `LawUnit/Decision/Guidance -> Term` | 용어를 언급한다. | 제45조 → 수증자 |

이 관계들은 사용자의 질문에서 검색 seed를 잡는 데 중요하다.

```text
사용자 질문: 부모가 자녀 아파트 취득자금을 지원하면 증여세 문제가 있나요?

추출 결과:
TaxType = 증여세
Issue = 자금출처, 증여추정

그래프 탐색:
TaxType → LawUnit
Issue → LawUnit / Decision / Guidance
```

---

### 2.4 판례·심판례 관계

| 관계 | 방향 | 의미 | 예시 |
|---|---|---|---|
| `APPLIES` | `Decision -> LawUnit` | 실제 판단 근거로 적용한 조문 | 심판례 → 2021년 제45조 |
| `MENTIONS` | `Decision -> LawUnit` | 본문에 언급된 조문 | 심판례 → 제4조 |
| `INTERPRETS` | `Decision -> LawUnit` | 판례가 조문 의미를 해석 | 판례 → 명의신탁 증여의제 조문 |
| `CITES_DECISION` | `Decision -> Decision` | 다른 판례·심판례를 인용 | 대법원 판례 → 선행 판례 |
| `DECIDED_BY` | `Decision -> Organization` | 판단 기관 | 심판례 → 조세심판원 |
| `HAS_DISPOSITION` | `Decision -> Disposition` | 다툼의 대상 처분 | 심판례 → 증여세 부과처분 |
| `HAS_CLAIM` | `Decision -> Claim` | 청구 내용 | 심판례 → 부과처분 취소청구 |
| `HAS_RESULT` | `Decision -> DecisionResult` | 판단 결과 | 심판례 → 기각 |

#### APPLIES와 MENTIONS의 차이

```text
MENTIONS : 본문에 조문이 등장했다.

APPLIES : 실제 판단 근거로 해당 조문을 적용했다.
```

세법 Agent의 답변에서는 `APPLIES`를 더 강한 근거로 취급해야 한다.

---

### 2.5 예규·해석례 관계

| 관계 | 방향 | 의미 | 예시 |
|---|---|---|---|
| `INTERPRETS` | `Guidance -> LawUnit` | 조문을 해석한다. | 국세청 해석례 → 제45조 |
| `MENTIONS` | `Guidance -> LawUnit` | 조문을 언급한다. | 예규 → 시행령 제34조 |
| `ISSUED_BY` | `Guidance -> Organization` | 발행 기관 | 해석례 → 국세청 |
| `CITES_GUIDANCE` | `Guidance -> Guidance` | 다른 예규·해석례를 인용 | 해석례 → 기존 예규 |

---

### 2.6 RAG 관계

| 관계 | 방향 | 의미 | 예시 |
|---|---|---|---|
| `HAS_CHUNK` | `LawUnit/Decision/Guidance -> TextChunk` | 검색용 본문 조각 | 심판례 → 판단 chunk |
| `NEXT_CHUNK` | `TextChunk -> TextChunk` | 문서 내 다음 chunk | 쟁점 chunk → 판단 chunk |
| `HAS_EMBEDDING` | `TextChunk -> Embedding` | chunk의 벡터 | chunk → embedding |
| `GENERATED_BY` | `Embedding -> EmbeddingModel` | 벡터 생성 모델 | embedding → text-embedding-3-large |

---

### 2.7 ExtractedFact 관계

검증 전 SPO 후보를 보관할 때 사용한다.

```text
(:ExtractedFact)-[:SUBJECT]->(:Decision | :Guidance | :LawUnit)
(:ExtractedFact)-[:OBJECT]->(:LawUnit | :Issue | :Term | :Decision)
(:ExtractedFact)-[:SUPPORTED_BY]->(:TextChunk)
```

이 구조는 자동 추출과 실제 서비스 관계를 분리하는 안전장치다.

---

## 3. 관계 속성 표준

관계에는 가능하면 출처와 신뢰도를 남긴다. 같은 `APPLIES` 관계라도 공식 API의 관련법령 필드에서 나온 것인지, 정규식으로 추출한 것인지, LLM이 추론한 것인지에 따라 신뢰도가 다르기 때문이다.

권장 속성은 다음과 같다.

```text
source_method
= official_api | related_law_field | parser | regex | llm | manual

confidence : 관계 신뢰도

source_text : 관계 추출 근거 문장

source_chunk_id : 근거 chunk ID

basis_date : 판단 기준일

valid_from / valid_to : 관계 유효 기간

verified : 검증 여부

verified_by : 검증자

created_at : 생성 시각
```

예시:

```cypher
MATCH (d:Decision {case_no: '조심2024서0000'})
MATCH (u:LawUnit {unit_id: 'inheritance-gift-tax-act:article-45:2021-01-01'})
MERGE (d)-[:APPLIES {
  basis_date: date('2021-06-10'),
  source_method: 'related_law_field',
  confidence: 0.95,
  verified: false,
  created_at: datetime()
}]->(u);
```

---

## 4. 증여세 예시 그래프

증여세의 자금출처 쟁점을 모델링하면 다음과 같다.

### 4.1 기본 노드

```text
(:TaxType {name: "증여세"})
(:Issue {name: "자금출처"})
(:Issue {name: "증여추정"})

(:Law {name: "상속세 및 증여세법"})
(:Law {name: "상속세 및 증여세법 시행령"})

(:LawUnit {
  number: "제45조",
  title: "재산 취득자금 등의 증여 추정"
})

(:LawUnit {
  law_name: "상속세 및 증여세법 시행령",
  number: "제34조"
})
```

### 4.2 기본 관계

```text
상속세 및 증여세법 -[:HAS_UNIT]-> 제45조
상증세법 시행령 -[:HAS_UNIT]-> 시행령 제34조

제45조 -[:ABOUT_TAX]-> 증여세
제45조 -[:HAS_ISSUE]-> 자금출처
제45조 -[:HAS_ISSUE]-> 증여추정

제45조 -[:DETAILED_BY]-> 시행령 제34조
시행령 제34조 -[:BASED_ON]-> 제45조
```

### 4.3 심판례 연결

```text
(:Decision:TaxAppealDecision {
  case_no: "조심2024서0000",
  decision_date: "2024-09-10",
  taxable_event_date: "2021-06-10",
  result: "기각"
})
```

관계:

```text
심판례 -[:ABOUT_TAX]-> 증여세
심판례 -[:HAS_ISSUE]-> 자금출처
심판례 -[:APPLIES]-> 2021년 적용 상증세법 제45조
심판례 -[:HAS_RESULT]-> 기각
```

핵심은 다음이다.

```text
2024년에 결정된 심판례라도,
실제 증여일이 2021년이면,
2021년에 적용되는 LawUnit에 연결한다.
```

---

## 5. Cypher 예시

### 5.1 Law 생성

```cypher
MERGE (law:Law {
  law_id: 'inheritance-gift-tax-act',
  law_type: 'ACT',
  name: '상속세 및 증여세법',
  short_name: '상증세법',
  jurisdiction: 'KR',
  ministry: '기획재정부'
});
```

### 5.2 LawUnit 생성

```cypher
MATCH (law:Law {law_id: 'inheritance-gift-tax-act'})
MERGE (u:LawUnit {
  unit_id: 'inheritance-gift-tax-act:article-45:2025-01-01',
  canonical_id: 'inheritance-gift-tax-act:article-45',
  law_id: 'inheritance-gift-tax-act',
  law_name: '상속세 및 증여세법',
  unit_type: 'ARTICLE',
  number: '제45조',
  title: '재산 취득자금 등의 증여 추정'
})
SET
  u.valid_from = date('2025-01-01'),
  u.valid_to = date('9999-12-31'),
  u.applies_from = date('2025-01-01'),
  u.applies_to = date('9999-12-31'),
  u.is_current = true,
  u.text = $text,
  u.text_hash = $text_hash
MERGE (law)-[:HAS_UNIT]->(u);
```

### 5.3 이전 본문과 연결

```cypher
MATCH (new:LawUnit {
  unit_id: 'inheritance-gift-tax-act:article-45:2025-01-01'
})
MATCH (old:LawUnit {
  unit_id: 'inheritance-gift-tax-act:article-45:2021-01-01'
})
MERGE (new)-[:REPLACES]->(old);
```

### 5.4 사건일 기준 조문 조회

```cypher
MATCH (u:LawUnit {
  canonical_id: 'inheritance-gift-tax-act:article-45'
})
WHERE date($event_date) >= u.applies_from
  AND date($event_date) <= u.applies_to
RETURN u;
```

### 5.5 심판례와 적용 조문 연결

```cypher
MATCH (d:Decision {case_no: '조심2024서0000'})
MATCH (u:LawUnit {
  canonical_id: 'inheritance-gift-tax-act:article-45'
})
WHERE date(d.taxable_event_date) >= u.applies_from
  AND date(d.taxable_event_date) <= u.applies_to
MERGE (d)-[:APPLIES {
  basis_date: date(d.taxable_event_date),
  source_method: 'related_law_field',
  confidence: 0.95,
  verified: false,
  created_at: datetime()
}]->(u);
```

### 5.6 자금출처 쟁점과 연결된 조문·심판례 조회

```cypher
MATCH (issue:Issue {name: '자금출처'})
OPTIONAL MATCH (u:LawUnit)-[:HAS_ISSUE]->(issue)
OPTIONAL MATCH (d:Decision)-[:HAS_ISSUE]->(issue)
RETURN
  collect(DISTINCT u) AS law_units,
  collect(DISTINCT d) AS decisions;
```

---

## 6. 제약조건과 인덱스 권장안

운영 환경에서는 중복 적재를 막기 위해 주요 ID에 unique constraint를 둔다.

```cypher
CREATE CONSTRAINT law_id_unique IF NOT EXISTS
FOR (n:Law)
REQUIRE n.law_id IS UNIQUE;

CREATE CONSTRAINT law_unit_id_unique IF NOT EXISTS
FOR (n:LawUnit)
REQUIRE n.unit_id IS UNIQUE;

CREATE INDEX law_unit_canonical_id IF NOT EXISTS
FOR (n:LawUnit)
ON (n.canonical_id);

CREATE INDEX law_unit_apply_range IF NOT EXISTS
FOR (n:LawUnit)
ON (n.applies_from, n.applies_to);

CREATE CONSTRAINT decision_id_unique IF NOT EXISTS
FOR (n:Decision)
REQUIRE n.decision_id IS UNIQUE;

CREATE CONSTRAINT guidance_id_unique IF NOT EXISTS
FOR (n:Guidance)
REQUIRE n.guidance_id IS UNIQUE;

CREATE CONSTRAINT tax_type_code_unique IF NOT EXISTS
FOR (n:TaxType)
REQUIRE n.code IS UNIQUE;

CREATE CONSTRAINT issue_id_unique IF NOT EXISTS
FOR (n:Issue)
REQUIRE n.issue_id IS UNIQUE;

CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS
FOR (n:TextChunk)
REQUIRE n.chunk_id IS UNIQUE;

CREATE CONSTRAINT embedding_id_unique IF NOT EXISTS
FOR (n:Embedding)
REQUIRE n.embedding_id IS UNIQUE;
```

---

## 7. 4편 요약

이번 모델은 세법 GraphDB를 다음처럼 단순화한다.

```text
Law
- 법령

LawUnit
- 조문/항/호/목
- 시간 속성으로 효력/적용 기간 관리

Decision
- 판례/심판례

Guidance
- 예규/법령해석/기본통칙

TaxType
- 세목

Issue
- 쟁점

Term
- 법령 용어

TextChunk
- 검색용 본문 조각

Embedding
- 벡터
```

이 모델의 장점은 다음이다.

```text
1. 법령과 조문을 명확히 분리한다.
2. 조문 변경 이력은 LawUnit의 시간 속성과 REPLACES 관계로 관리한다.
3. 판례/심판례는 Decision, 예규/해석례는 Guidance로 나누어 검색 목적을 분명히 한다.
4. 세목과 쟁점은 별도 노드로 만들어 검색 seed로 활용한다.
5. 모든 문장을 SPO로 만들지 않고 핵심 관계만 그래프화한다.
6. 본문 검색은 TextChunk와 Embedding이 담당한다.
7. GraphDB는 관계 확장과 근거 추적에 집중한다.
```

다음 편에서는 이 관계 모델을 기반으로 실제 Graph-RAG 검색 흐름, Chunk 설계, Embedding, 관계 추출 전략을 다룬다.

---

이전 글: [3편. 핵심 노드 상세 설계](/data/tax-graphdb-series-03-node-model/)

다음 글: [5편. Graph-RAG 검색 설계](/data/tax-graphdb-series-05-graphrag-search/)
