---
title: "[GraphDB] 세법 GraphDB 설계 2편: LawUnit 모델링 원칙"
excerpt: "세법 GraphDB를 문서 저장소가 아니라 관계 지도로 설계하기 위한 LawUnit 중심 모델링 원칙을 정리한다."

categories:
  - Database
tags:
  - Data
  - GraphDB
  - Neo4j
  - RAG
  - Tax

permalink: /data/tax-graphdb-series-02-modeling/

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

## 1. 2편의 목적

1편에서는 세법 GraphDB가 단순한 문서 저장소가 아니라 **세법 근거를 찾아가기 위한 관계 지도**라는 점을 설명했다.

2편에서는 이 관계 지도를 설계하기 전에 먼저 정해야 하는 모델링 원칙을 정리한다. 예시는 **증여세**, 특히 **상속세 및 증여세법 제45조: 재산 취득자금 등의 증여 추정**과 **자금출처 쟁점**을 중심으로 든다.

이 문서의 목표는 다음과 같다.

```text
1. 세법 GraphDB를 문서 저장소가 아니라 관계 지도로 보는 이유를 정리한다.
2. Law와 LawUnit을 나누는 기준을 설명한다.
3. 법령 개정, 시행일, 적용일을 어떻게 관리할지 정리한다.
4. 판단 문서와 해석 문서를 구분하는 이유를 설명한다.
5. TextChunk와 Embedding을 그래프 모델에 어떻게 붙일지 정리한다.
```

세법 GraphDB에서 가장 중요한 질문은 “어떤 문서가 있는가?”가 아니라 **“어떤 근거들이 서로 어떻게 연결되는가?”** 다. 따라서 모델도 문서 원문 전체보다 **법적 의미 단위와 관계**를 중심으로 설계한다.

---

## 2. 모델링 원칙

세법 GraphDB는 법령과 판례를 단순히 저장하기 위한 데이터베이스가 아니다. 목적은 사용자의 세무 질문에 대해 **어떤 조문, 어떤 해석례, 어떤 심판례, 어떤 판례를 함께 봐야 하는지 찾아가기 위한 관계 지도**를 만드는 것이다.

따라서 모델링의 중심은 문서 원문 전체가 아니라 다음 세 가지다.

```text
1. 세법상 의미 있는 단위
2. 그 단위들 사이의 법적 관계
3. 검색과 답변 생성을 위한 근거 텍스트
```

---

### 2.1 GraphDB는 문서 저장소가 아니라 관계 지도다

세법 자료의 원문 전체는 텍스트 저장소, 파일 저장소, 검색 인덱스에 보관할 수 있다. GraphDB에는 원문 전체를 무리하게 모두 구조화하지 않고, **검색과 근거 확장에 필요한 핵심 관계**를 저장한다.

예를 들어 조세심판례 하나에 포함된 모든 문장을 그래프 관계로 만들 필요는 없다. 대신 다음과 같은 핵심 정보만 그래프로 구조화한다.

```text
심판례가 적용한 조문
심판례가 언급한 조문
심판례의 세목
심판례의 쟁점
심판례의 처분
심판례의 청구 내용
심판례의 결과
심판례가 인용한 판례
심판례와 연결된 예규/해석례
```

본문의 상세 내용은 `TextChunk`로 나누고, 의미 검색을 위해 `Embedding`을 생성한다.

```text
핵심 법률 관계 → GraphDB 관계
본문 내용       → TextChunk
의미 검색       → Embedding / Vector Index
```

---

### 2.2 법령은 Law와 LawUnit으로 나눈다

법령 전체와 조문 단위는 분리한다.

```text
Law
= 법령 자체

LawUnit
= 조문, 항, 호, 목, 부칙, 별표, 서식 같은 법령 구성 단위
```

예를 들어 다음과 같이 표현한다.

```text
Law
- 상속세 및 증여세법
- 상속세 및 증여세법 시행령
- 상속세 및 증여세법 시행규칙

LawUnit
- 상속세 및 증여세법 제45조
- 상속세 및 증여세법 제45조 제1항
- 상속세 및 증여세법 시행령 제34조
- 상속세 및 증여세법 부칙 제2조
```

`Law`는 법령의 식별과 분류를 담당하고, `LawUnit`은 실제 검색과 관계 확장의 중심이 된다.

---

### 2.3 조문 변경 이력은 LawUnit의 시간 속성으로 관리한다

같은 조문이라도 시점에 따라 본문이 달라질 수 있다. 따라서 특정 시점의 조문 본문은 별도의 `LawUnit` 노드로 관리한다.

단, 조문 변경 이력을 표현하기 위해 별도의 전용 라벨을 만들지는 않는다. 모든 조문 본문 상태는 동일하게 `LawUnit`으로 표현한다.

핵심 속성은 다음과 같다.

```text
unit_id
= 특정 시점의 조문 단위 ID

canonical_id
= 같은 논리 조문을 묶는 ID

valid_from / valid_to
= 법령 효력 기간

applies_from / applies_to
= 실제 사건에 적용되는 기간

is_current
= 현재 시행 기준 여부
```

예를 들어 상속세 및 증여세법 제45조가 여러 번 개정되었다면 다음처럼 표현한다.

```text
LawUnit
- unit_id: inheritance-gift-tax-act:article-45:2021-01-01
- canonical_id: inheritance-gift-tax-act:article-45
- number: 제45조
- valid_from: 2021-01-01
- valid_to: 2024-12-31
- applies_from: 2021-01-01
- applies_to: 2024-12-31

LawUnit
- unit_id: inheritance-gift-tax-act:article-45:2025-01-01
- canonical_id: inheritance-gift-tax-act:article-45
- number: 제45조
- valid_from: 2025-01-01
- valid_to: 9999-12-31
- applies_from: 2025-01-01
- applies_to: 9999-12-31
```

새 조문이 이전 조문을 대체하면 `REPLACES` 관계로 연결한다.

```text
(2025년 제45조)-[:REPLACES]->(2021년 제45조)
```

이 구조를 사용하면 현재 조문뿐 아니라 과거 사건 당시 적용되던 조문도 정확히 찾을 수 있다.

---

### 2.4 시행일과 적용일은 분리한다

세법에서는 법령의 시행일과 실제 과세 사건에 적용되는 적용일이 다를 수 있다. 따라서 단순히 시행일만 저장하면 안 된다.

```text
valid_from / valid_to
= 법령이 효력을 가지는 기간

applies_from / applies_to
= 실제 과세 사건에 적용되는 기간
```

세무 사건을 조문과 연결할 때는 일반적으로 결정일보다 과세 사실 발생일이 더 중요하다.

증여세에서는 특히 다음 날짜가 중요하다.

```text
증여일
자금 지급일
재산 취득일
처분일
결정일
```

예를 들어 2024년에 조세심판 결정이 내려졌더라도, 실제 증여일이 2021년이라면 2021년에 적용되던 `LawUnit`에 연결해야 한다.

```text
Decision.decision_date = 2024-09-10
Decision.taxable_event_date = 2021-06-10

Decision -[:APPLIES]-> 2021년 적용 상증세법 제45조
```

---

### 2.5 판단 문서와 해석 문서는 분리한다

세법 자료 중 판례와 조세심판례는 판단 결과를 가진 문서다. 예규, 법령해석, 기본통칙은 조문을 해석하거나 안내하는 문서다.

따라서 다음처럼 구분한다.

```text
Decision
= 판례, 조세심판례, 행정심판례처럼 판단 결과가 있는 문서

Guidance
= 예규, 법령해석, 기본통칙, 고시, 훈령처럼 조문을 해석하거나 안내하는 문서
```

이렇게 분리하면 검색 전략도 달라진다.

```text
유사 사건 검색
→ Decision 중심

조문 해석 검색
→ Guidance 중심

적용 법령 검색
→ LawUnit 중심
```

---

### 2.6 APPLIES, INTERPRETS, MENTIONS는 반드시 구분한다

법률 문서에서 어떤 조문이 등장한다고 해서 항상 그 조문이 판단 근거인 것은 아니다. 따라서 조문과 문서의 관계는 최소한 세 가지로 구분한다.

```text
APPLIES
= 판례나 심판례가 실제 판단 근거로 적용한 조문

INTERPRETS
= 예규나 해석례가 해석한 조문

MENTIONS
= 본문에 단순히 언급된 조문
```

예를 들어 조세심판례가 상속세 및 증여세법 제45조를 실제 판단 근거로 사용했다면 다음과 같이 연결한다.

```text
Decision -[:APPLIES]-> LawUnit
```

국세청 해석례가 해당 조문을 해석했다면 다음과 같이 연결한다.

```text
Guidance -[:INTERPRETS]-> LawUnit
```

본문에 조문 번호가 등장했지만 판단 근거인지 확실하지 않다면 다음과 같이 연결한다.

```text
Decision -[:MENTIONS]-> LawUnit
```

이 구분은 답변 품질에 직접적인 영향을 준다. `APPLIES`는 강한 근거이고, `MENTIONS`는 약한 관련성이다.

---

### 2.7 세목, 쟁점, 용어는 독립 노드로 관리한다

세법 질문은 대부분 특정 세목과 쟁점을 중심으로 들어온다. 따라서 세목, 쟁점, 용어는 문자열 속성으로만 두지 않고 별도 노드로 관리한다.

```text
TaxType
= 증여세, 상속세, 소득세, 법인세, 부가가치세 등

Issue
= 자금출처, 명의신탁, 부담부증여, 저가양도, 증여추정 등

Term
= 증여자, 수증자, 특수관계인, 증여재산, 명의신탁 등
```

예를 들어 증여세 자금출처 쟁점은 다음처럼 연결된다.

```text
LawUnit -[:ABOUT_TAX]-> TaxType
LawUnit -[:HAS_ISSUE]-> Issue

Decision -[:ABOUT_TAX]-> TaxType
Decision -[:HAS_ISSUE]-> Issue

Guidance -[:ABOUT_TAX]-> TaxType
Guidance -[:HAS_ISSUE]-> Issue
```

이 구조를 사용하면 사용자의 질문에서 `증여세`, `자금출처`만 추출해도 관련 조문, 심판례, 예규로 확장할 수 있다.

---

### 2.8 모든 문장을 SPO 트리플로 만들지 않는다

앞서 말했듯 판례나 심판례의 모든 문장을 `주어-관계-목적어` 형태로 만들 필요는 없다. 서비스 관점에서 중요한 것은 모든 문장을 그래프화하는 것이 아니라, 답변과 검색에 필요한 핵심 관계를 정확하게 만드는 것이다.

그래프 관계로 만들 가치가 높은 정보는 다음과 같다.

```text
적용 조문
해석 조문
참조 조문
세목
쟁점
처분
청구 내용
판단 결과
인용 판례
관련 예규
```

반면 사실관계의 세부 서술, 당사자의 긴 주장, 법원의 상세 판단 문맥은 `TextChunk`로 보관하고 벡터 검색으로 찾는 것이 적절하다.

```text
핵심 관계
→ GraphDB

긴 본문과 문맥
→ TextChunk + Embedding
```

---

### 2.9 자동 추출 관계는 검증 전 후보로 관리한다

정규식, 파서, LLM으로 추출한 관계는 처음부터 확정 관계로 사용하지 않는다. 특히 LLM이 추론한 관계는 오류 가능성이 있으므로 후보 상태로 관리하는 것이 안전하다.

이를 위해 선택적으로 `ExtractedFact`를 둔다.

```text
ExtractedFact
= 원문에서 추출된 후보 관계
```

예를 들어 다음과 같은 후보를 저장할 수 있다.

```text
subject: 조심2024서0000
predicate: APPLIES
object: 상증세법 제45조
source_text: "청구인은 상속세 및 증여세법 제45조의 적용을 다투고 있다."
confidence: 0.72
status: CANDIDATE
```

검증된 후보만 실제 관계로 반영한다.

```text
Decision -[:APPLIES]-> LawUnit
```

후보 상태는 다음처럼 관리한다.

```text
CANDIDATE
= 추출됨

VERIFIED
= 검증됨

REJECTED
= 기각됨

MATERIALIZED
= 실제 그래프 관계로 반영됨
```

---

### 2.10 관계에는 출처와 신뢰도를 남긴다

GraphDB의 품질은 노드보다 관계의 품질에서 갈린다. 따라서 주요 관계에는 반드시 출처와 신뢰도 정보를 남긴다.

권장 관계 속성은 다음과 같다.

```text
source_method
= official_api | parser | regex | llm | manual

confidence
= 관계 신뢰도

source_text
= 관계 추출의 근거 문장

source_chunk_id
= 관계가 추출된 TextChunk ID

basis_date
= 판단 기준일

valid_from / valid_to
= 관계의 유효 기간

verified
= 검증 여부

verified_by
= 검증자

created_at
= 생성 시각
```

예를 들어 심판례와 조문을 연결할 때 다음처럼 저장한다.

```text
Decision -[:APPLIES {
  basis_date: 2021-06-10,
  source_method: related_law_field,
  confidence: 0.95,
  verified: false
}]-> LawUnit
```

이렇게 하면 검색 결과를 랭킹할 때 신뢰도와 검증 여부를 반영할 수 있다.

---

### 2.11 TextChunk와 Embedding은 분리한다

본문 검색을 위해 문서를 chunk로 나누고, 각 chunk에 embedding을 생성한다. 다만 embedding은 특정 모델에 종속되므로 `TextChunk`와 분리해서 관리한다.

```text
TextChunk
= 검색과 LLM 입력을 위한 텍스트 조각

Embedding
= 특정 모델로 생성한 벡터

EmbeddingModel
= 임베딩 모델 정보
```

관계는 다음과 같다.

```text
LawUnit -[:HAS_CHUNK]-> TextChunk
Decision -[:HAS_CHUNK]-> TextChunk
Guidance -[:HAS_CHUNK]-> TextChunk

TextChunk -[:HAS_EMBEDDING]-> Embedding
Embedding -[:GENERATED_BY]-> EmbeddingModel
```

이 구조의 장점은 임베딩 모델이 바뀌어도 전체 그래프를 다시 적재할 필요가 없다는 점이다.

```text
Law, LawUnit, Decision, Guidance, 관계
→ 유지

TextChunk
→ 유지

Embedding
→ 새 모델 기준으로 재생성
```

---

### 2.12 Chunk는 길이가 아니라 구조 기준으로 나눈다

세법 문서는 고정 길이로 자르면 문맥이 깨질 수 있다. 따라서 chunk는 문서의 구조와 의미 단위를 기준으로 나눈다.

법령은 조문, 항, 호, 목 단위로 나눈다.

```text
LawUnit 제45조
- article_text
- paragraph_text
- subparagraph_text
```

예규와 해석례는 질의, 사실관계, 회신, 이유, 관련법령 단위로 나눈다.

```text
Guidance
- question
- facts
- reply
- reasoning
- related_law
```

판례와 심판례는 사건 개요, 주장, 쟁점, 관련법령, 판단, 결론 단위로 나눈다.

```text
Decision
- summary
- facts
- claimant_argument
- tax_authority_argument
- issue
- related_law
- reasoning
- conclusion
```

각 chunk에는 검색 품질을 높이기 위해 context를 포함한다.

```text
법령명
조문번호
조문명
시행일
적용일
세목
쟁점
사건번호
```

또한 문서 내 순서를 유지하기 위해 `NEXT_CHUNK` 관계를 둔다.

```text
TextChunk -[:NEXT_CHUNK]-> TextChunk
```

---

### 2.13 GraphDB 검색은 seed 탐색과 관계 확장으로 나눈다

세무 질문에 답할 때 GraphDB는 두 단계로 사용된다.

첫 번째는 seed 탐색이다.

```text
사용자 질문
→ 세목 추출
→ 쟁점 추출
→ 후보 조문 추출
→ 후보 LawUnit / Issue / TaxType 탐색
```

두 번째는 관계 확장이다.

```text
LawUnit
→ 시행령/시행규칙
→ 예규/해석례
→ 심판례/판례
→ 관련 쟁점
→ 관련 용어
```

예를 들어 사용자가 다음과 같이 질문했다고 하자.

```text
부모가 자녀 아파트 취득자금을 지원하면 증여세 문제가 있나요?
```

검색 흐름은 다음과 같다.

```text
TaxType: 증여세
Issue: 자금출처, 증여추정
LawUnit: 상증세법 제45조
Guidance: 제45조를 해석한 예규
Decision: 제45조를 적용한 심판례
LawUnit: 관련 시행령 조문
```

이 구조를 사용하면 유사 문서만 찾는 것이 아니라, 법령 체계상 함께 봐야 하는 근거를 확장할 수 있다.

---

### 2.14 모델은 최소한으로 시작하고 관계 품질을 높인다

처음부터 모든 법령 요소와 모든 문장 관계를 완벽하게 모델링하려고 하면 운영이 어려워진다. 서비스에서 중요한 것은 노드 종류를 많이 만드는 것이 아니라, 핵심 관계의 품질을 높이는 것이다.

초기 필수 모델은 다음 정도면 충분하다.

```text
Law
LawUnit
Decision
Guidance
TaxType
Issue
TextChunk
Embedding
```

이후 필요에 따라 다음 노드를 확장한다.

```text
Term
Organization
Disposition
Claim
DecisionResult
ExtractedFact
```

초기에는 다음 관계의 품질을 우선 확보한다.

```text
Law -[:HAS_UNIT]-> LawUnit
LawUnit -[:REPLACES]-> LawUnit
LawUnit -[:DETAILED_BY]-> LawUnit

Decision -[:APPLIES]-> LawUnit
Guidance -[:INTERPRETS]-> LawUnit

Decision -[:HAS_ISSUE]-> Issue
LawUnit -[:HAS_ISSUE]-> Issue

LawUnit -[:HAS_CHUNK]-> TextChunk
Decision -[:HAS_CHUNK]-> TextChunk
Guidance -[:HAS_CHUNK]-> TextChunk
```

GraphDB의 가치는 노드 수가 아니라, 신뢰할 수 있는 관계를 통해 정확한 근거를 확장할 수 있는 데 있다.

---

## 3. 2편 요약

2편에서는 세법 GraphDB의 상세 노드와 관계를 설계하기 전에 필요한 기준을 정리했다. 핵심은 `Law`와 `LawUnit`을 분리하고, 조문 변경 이력과 적용 시점을 시간 속성으로 관리하며, 판단 문서와 해석 문서를 서로 다른 역할로 다루는 것이다.

다음 편에서는 이 원칙을 바탕으로 실제 노드 라벨과 속성을 설계한다.

---

이전 글: [1편. 왜 세법에는 GraphDB가 필요한가](/data/tax-graphdb-series-01-concept/)

다음 글: [3편. 핵심 노드 상세 설계](/data/tax-graphdb-series-03-node-model/)
