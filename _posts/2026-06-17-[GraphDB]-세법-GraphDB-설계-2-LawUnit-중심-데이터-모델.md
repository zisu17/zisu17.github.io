---
title: "[GraphDB] 세법 GraphDB 설계 2편: LawUnit 중심 데이터 모델"
excerpt: "Law, LawUnit, Decision, Guidance를 중심으로 세법 GraphDB의 핵심 데이터 모델과 관계 설계 원칙을 정리한다."

categories:
  - Data
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
> - [2편. LawUnit 중심 데이터 모델](/data/tax-graphdb-series-02-modeling/)
> - [3편. Graph-RAG 검색과 운영 아키텍처](/data/tax-graphdb-series-03-graphrag-ops/)

## 1. 2편의 목적

1편에서는 세법 GraphDB가 단순한 문서 저장소가 아니라 **세법 근거를 찾아가기 위한 관계 지도**라는 점을 설명했다.

2편에서는 이 관계 지도를 실제 GraphDB 모델로 어떻게 설계할지 정리한다. 예시는 **증여세**, 특히 **상속세 및 증여세법 제45조: 재산 취득자금 등의 증여 추정**과 **자금출처 쟁점**을 중심으로 든다.

이 문서의 목표는 다음과 같다.

```text
1. 세법 GraphDB의 핵심 노드를 정의한다.
2. 각 노드가 어떤 업무 개념을 표현하는지 설명한다.
3. 법령 개정, 시행일, 적용일을 어떻게 관리할지 정리한다.
4. 판례, 심판례, 예규, 법령해석을 조문과 어떻게 연결할지 정리한다.
5. TextChunk와 Embedding을 그래프 모델에 어떻게 붙일지 정리한다.
```

이번 모델의 중심은 다음 네 가지다.

```text
Law
= 법령 자체

LawUnit
= 조문, 항, 호, 목, 부칙, 별표 같은 법령 구성 단위

Decision
= 판례, 조세심판례처럼 판단 결과가 있는 문서

Guidance
= 예규, 법령해석, 기본통칙처럼 조문을 해석하거나 안내하는 문서
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

## 3. 최종 노드 목록

아래 표는 이 모델에서 사용하는 노드의 역할을 한눈에 정리한 것이다. 각 노드는 단순한 이름 목록이 아니라, 세법 Agent가 검색과 답변을 만들 때 어떤 역할을 하는지를 기준으로 정의한다.

### 3.1 필수 노드

| 노드               | 의미                      | 왜 필요한가                                    | 예시                             |
| ---------------- | ----------------------- | ----------------------------------------- | ------------------------------ |
| `Law`            | 법령 자체                   | 조문이 어느 법령에 속하는지 식별한다. 법, 시행령, 시행규칙을 구분한다. | 상속세 및 증여세법, 상속세 및 증여세법 시행령     |
| `LawUnit`        | 조문·항·호·목·부칙·별표 같은 법령 단위 | 실제 적용 조문, 참조 조문, 시행령 위임 관계의 중심이다.         | 상증세법 제45조, 상증세법 시행령 제34조       |
| `Decision`       | 판례·조세심판례 등 판단 결과가 있는 문서 | 특정 조문이 실제 사건에서 어떻게 적용되었는지 확인한다.           | 자금출처를 입증하지 못한 증여세 심판례          |
| `Guidance`       | 예규·법령해석·기본통칙 등 해석/안내 문서 | 조문을 과세관청이 어떻게 해석하는지 확인한다.                 | 국세청 서면질의, 기재부 유권해석             |
| `TaxType`        | 세목                      | 질문과 문서를 세목별로 묶는다.                         | 증여세, 상속세, 법인세                  |
| `Issue`          | 세무 쟁점                   | 유사 쟁점의 조문·판례·예규를 찾는다.                     | 자금출처, 명의신탁, 부담부증여              |
| `TextChunk`      | 검색용 텍스트 조각              | 긴 본문을 LLM이 읽기 좋은 단위로 나눈다.                 | 심판례의 판단 부분 chunk               |
| `EmbeddingModel` | 임베딩 모델 정보               | 어떤 모델로 벡터를 만들었는지 추적한다.                    | text-embedding-3-large, bge-m3 |
| `Embedding`      | chunk 벡터                | 의미 검색과 유사 문맥 검색에 사용한다.                    | 자금출처 쟁점 chunk의 벡터              |

### 3.2 권장 노드

| 노드               | 의미             | 왜 필요한가                          | 예시               |
| ---------------- | -------------- | ------------------------------- | ---------------- |
| `Term`           | 법령 용어          | 조문 정의와 문서 속 용어를 연결한다.           | 증여자, 수증자, 특수관계인  |
| `Organization`   | 기관·법원·처분청·발행기관 | 판결 기관, 처분청, 해석 발행 기관을 명확히 구분한다. | 국세청, 조세심판원, 대법원  |
| `Disposition`    | 과세처분 또는 행정처분   | 판례·심판례에서 무엇을 다투는지 표현한다.         | 증여세 부과처분, 경정거부처분 |
| `Claim`          | 청구 내용          | 납세자가 무엇을 요구했는지 표현한다.            | 증여세 부과처분 취소청구    |
| `DecisionResult` | 판단 결과          | 인용·기각·각하 등 결과 기반 검색에 사용한다.      | 기각, 인용, 일부 인용    |

### 3.3 선택 노드

| 노드 | 의미 | 왜 필요한가 | 사용 시점 |
|---|---|---|---|
| `ExtractedFact` | 자동 추출된 후보 관계 | LLM·정규식·파서가 만든 관계를 바로 확정하지 않고 검증 전 후보로 관리한다. | 관계 검증 워크플로우가 필요할 때 |
| `IngestionRun` | 수집·적재 실행 기록 | 배치 실행, 실패, 재처리 이력을 추적한다. | 운영 자동화 단계 |
| `RetrievalLog` | 검색 실행 로그 | 어떤 질문에서 어떤 근거가 검색되었는지 추적한다. | 검색 품질 평가, 감사 로그 |

---

## 4. 노드 상세 설계

이 섹션에서는 각 노드가 어떤 업무 개념을 표현하는지, 언제 사용하는지, 어떤 속성을 가져야 하는지 상세히 설명한다.

---

### 4.1 Law

#### 의미

`Law`는 법령 자체를 나타내는 노드다. 법령의 본문 전체나 특정 조문이 아니라, **법령이라는 논리적 단위**를 표현한다.

예를 들어 `상속세 및 증여세법`은 하나의 `Law`이고, 그 안의 `제45조`는 `LawUnit`이다.

#### 왜 필요한가

세법은 법, 시행령, 시행규칙, 기본통칙이 계층적으로 연결된다. 따라서 조문을 바로 저장하기 전에, 해당 조문이 어떤 법령에 속하는지 식별할 상위 노드가 필요하다.

`Law`를 두면 다음 질문에 답할 수 있다.

```text
증여세 관련 법령은 무엇인가?
상속세 및 증여세법에 속한 조문은 무엇인가?
상속세 및 증여세법 시행령의 조문 중 상증세법 제45조와 연결된 것은 무엇인가?
```

#### 대표 예시

```text
상속세 및 증여세법
상속세 및 증여세법 시행령
상속세 및 증여세법 시행규칙
소득세법
법인세법
부가가치세법
```

#### 주요 속성

```text
law_id : 법령 식별자

law_type : 법령 유형

name : 법령명

short_name : 약칭

jurisdiction : 관할 국가 또는 지역

ministry : 소관 부처

source_system : 수집 출처

source_url : 원문 URL

created_at / updated_at : 생성·수정 시각
```

#### law_type 예시

```text
ACT : 법률

ENFORCEMENT_DECREE : 시행령

ENFORCEMENT_RULE : 시행규칙

ADMINISTRATIVE_RULE : 고시, 훈령 등 행정규칙

BASIC_RULING : 기본통칙
```

#### 증여세 예시

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

---

### 4.2 LawUnit

#### 의미

`LawUnit`은 법령 안의 실제 구성 단위다. 조문, 항, 호, 목, 부칙, 별표, 서식 등이 모두 `LawUnit`이 될 수 있다.

이 모델에서 `LawUnit`은 가장 중요한 노드다. 사용자의 질문이 결국 특정 조문, 특정 시행령, 특정 부칙과 연결되기 때문이다.

#### 왜 필요한가

세법 질문은 대부분 조문 단위로 답해야 한다.

```text
상증세법 제45조가 적용되는가?
제45조와 연결된 시행령은 무엇인가?
2021년 증여 사건에는 어느 시점의 제45조가 적용되는가?
제45조를 적용한 심판례는 무엇인가?
```

이 질문들은 모두 `LawUnit`을 중심으로 풀린다.

#### 대표 예시

```text
상속세 및 증여세법 제45조
상속세 및 증여세법 제45조 제1항
상속세 및 증여세법 제45조 제1항 제1호
상속세 및 증여세법 시행령 제34조
상속세 및 증여세법 부칙 제2조
```

#### 주요 속성

```text
unit_id : 특정 시점의 법령 단위 ID

canonical_id : 같은 논리 조문을 묶는 ID

law_id / law_name : 소속 법령

unit_type : 조문, 항, 호, 목 등 단위 유형

number : 제45조, 제1항, 제1호 등 표시 번호

title : 조문 제목

path : 법령 내 계층 경로

sort_order : 법령 내 정렬 순서

text : 해당 시점의 본문

text_hash : 본문 변경 감지용 해시

valid_from / valid_to : 법령 효력 기간

applies_from / applies_to : 실제 사건 적용 기간

is_current : 현재 시행 기준 여부

promulgation_date : 공포일

enforcement_date : 시행일

source_url : 원문 URL
```

#### unit_type 예시

```text
ARTICLE : 조

PARAGRAPH : 항

SUBPARAGRAPH : 호

ITEM : 목

SUPPLEMENTARY_PROVISION : 부칙

APPENDIX : 별표

FORM : 서식
```

#### unit_id와 canonical_id

`LawUnit`에서 가장 중요한 속성은 `unit_id`와 `canonical_id`다.

```text
canonical_id : 논리적으로 같은 조문을 묶는다.

unit_id : 특정 시점의 실제 조문 본문을 식별한다.
```

예를 들어 제45조가 2021년 본문과 2025년 본문으로 나뉘면 다음처럼 표현한다.

```text
canonical_id = inheritance-gift-tax-act:article-45

unit_id = inheritance-gift-tax-act:article-45:2021-01-01
unit_id = inheritance-gift-tax-act:article-45:2025-01-01
```

#### 증여세 예시

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

---

### 4.3 Decision

#### 의미

`Decision`은 판례, 조세심판례, 행정심판례처럼 **판단 결과가 있는 문서**를 표현한다.

세법 GraphDB에서 `Decision`은 조문이 실제 사건에서 어떻게 적용되었는지 보여주는 근거다.

#### 왜 필요한가

세무 질문은 법령만으로 충분하지 않은 경우가 많다. 사용자는 보통 다음을 궁금해한다.

```text
비슷한 사건에서 납세자가 이겼는가?
조세심판원은 자금출처 부족 사건을 어떻게 봤는가?
대법원은 명의신탁 증여의제를 어떻게 판단했는가?
어떤 조문이 실제 판단 근거로 쓰였는가?
```

이 질문에 답하기 위해 `Decision`이 필요하다.

#### 대표 예시

```text
대법원 증여세 판례
서울행정법원 증여세 부과처분 취소 사건
조세심판원 자금출처 관련 재결례
조세심판원 명의신탁 증여의제 재결례
```

#### 주요 속성

```text
decision_id
= 판단 문서 식별자

decision_type
= 판례, 심판례 등 유형

case_no
= 사건번호

title
= 사건명 또는 제목

court_or_agency
= 판단 기관

decision_date
= 판결일 또는 결정일

taxable_event_date
= 과세 사실 발생일

gift_date
= 증여일

tax_type
= 세목

summary
= 요약

result
= 결론

source_system / source_url
= 출처

raw_text
= 원문 텍스트 또는 원문 경로
```

#### decision_type 예시

```text
COURT_DECISION
= 법원 판례

TAX_APPEAL_DECISION
= 조세심판원 재결례

ADMINISTRATIVE_APPEAL_DECISION
= 행정심판례
```

#### 증여세에서 중요한 날짜

`Decision`에서 `decision_date`와 `taxable_event_date`는 구분해야 한다.

```text
decision_date : 판결/결정이 내려진 날

taxable_event_date 또는 gift_date : 실제 증여 또는 과세 사실이 발생한 날
```

조문 매핑은 보통 `decision_date`보다 `taxable_event_date` 또는 `gift_date`를 기준으로 해야 한다.

#### 증여세 예시

```cypher
MERGE (d:Decision:TaxAppealDecision {
  decision_id: 'tax-appeal:josim-2024-seo-0000',
  decision_type: 'TAX_APPEAL_DECISION',
  case_no: '조심2024서0000',
  title: '자금출처 입증 관련 증여세 부과처분 사건',
  court_or_agency: '조세심판원'
})
SET
  d.decision_date = date('2024-09-10'),
  d.taxable_event_date = date('2021-06-10'),
  d.tax_type = '증여세',
  d.result = '기각';
```

---

### 4.4 Guidance

#### 의미

`Guidance`는 예규, 국세청 법령해석, 기획재정부 유권해석, 기본통칙, 고시, 훈령처럼 **조문을 해석하거나 안내하는 문서**다.

#### 왜 필요한가

세무 실무에서는 법 조문만 보는 것보다 과세관청의 해석과 실무 기준을 함께 확인하는 경우가 많다.

```text
국세청은 이 조문을 어떻게 해석했는가?
자금출처에 대한 과세관청의 입장은 무엇인가?
기본통칙은 해당 조문을 어떻게 설명하는가?
```

이 질문에 답하기 위해 `Guidance`가 필요하다.

#### 대표 예시

```text
국세청 서면질의
국세청 법령해석
기획재정부 유권해석
상속세 및 증여세법 기본통칙
국세청 고시
```

#### 주요 속성

```text
guidance_id : 해석/안내 문서 식별자

guidance_type : 예규, 법령해석, 기본통칙 등 유형

title : 제목

issue_date : 발행일 또는 회신일

agency : 발행기관

tax_type : 세목

summary : 요약

source_system / source_url : 출처

raw_text : 원문 텍스트 또는 원문 경로
```

#### guidance_type 예시

```text
TAX_INTERPRETATION : 국세청 법령해석

ADVANCE_RULING : 사전답변, 질의회신

BASIC_RULING : 기본통칙

ADMINISTRATIVE_RULE : 고시, 훈령 등 행정규칙

NOTICE : 고시

DIRECTIVE : 훈령
```

#### 증여세 예시

```cypher
MERGE (g:Guidance {
  guidance_id: 'nts-interpretation-gift-tax-0001',
  guidance_type: 'TAX_INTERPRETATION',
  title: '재산 취득자금의 증여 추정 관련 질의회신',
  agency: '국세청',
  tax_type: '증여세'
})
SET
  g.issue_date = date('2023-05-20'),
  g.summary = '재산 취득자금의 출처 입증과 증여 추정에 관한 해석';
```

---

### 4.5 TaxType

#### 의미

`TaxType`은 세목을 표현하는 노드다.

#### 왜 필요한가

세법 자료는 세목별로 검색 범위와 적용 조문이 크게 달라진다. 사용자의 질문에서 세목을 식별하면 GraphDB 검색 범위를 크게 줄일 수 있다.

```text
증여세 질문
→ 상속세 및 증여세법, 관련 심판례, 관련 예규 중심 검색

부가가치세 질문
→ 부가가치세법, 매입세액, 세금계산서 관련 자료 중심 검색
```

#### 대표 예시

```text
증여세
상속세
소득세
법인세
부가가치세
종합부동산세
```

#### 주요 속성

```text
tax_type_id : 세목 식별자

code : 세목 코드

name : 세목명

category : 국세, 지방세 등 분류

description : 설명
```

#### 증여세 예시

```cypher
MERGE (t:TaxType {
  tax_type_id: 'tax-type:gift-tax',
  code: 'GIFT_TAX',
  name: '증여세',
  category: '국세'
});
```

---

### 4.6 Issue

#### 의미

`Issue`는 세무 쟁점을 표현한다. 쟁점은 사용자의 질문과 법령·판례를 이어주는 핵심 연결점이다.

#### 왜 필요한가

사용자는 보통 정확한 조문번호를 모르고 질문한다. 대신 “자금출처”, “명의신탁”, “부담부증여” 같은 쟁점으로 질문한다.

따라서 쟁점을 별도 노드로 만들면 다음과 같은 탐색이 가능하다.

```text
자금출처
→ 상증세법 제45조
→ 관련 시행령
→ 관련 조세심판례
→ 관련 국세청 해석례
```

#### 대표 예시

```text
자금출처
명의신탁
부담부증여
저가양도
고가양수
증여추정
특수관계인
우회증여
증여재산가액
```

#### 주요 속성

```text
issue_id : 쟁점 식별자

name : 쟁점명

description : 설명

synonyms : 동의어, 유사 표현
```

#### 증여세 예시

```cypher
MERGE (i:Issue {
  issue_id: 'issue:fund-source',
  name: '자금출처',
  description: '재산 취득자금의 출처 입증 및 증여 추정과 관련된 쟁점',
  synonyms: ['재산 취득자금', '취득자금 소명', '자금출처 조사']
});
```

---

### 4.7 Term

#### 의미

`Term`은 법령 용어를 표현한다.

#### 왜 필요한가

세법에서는 같은 용어가 여러 조문, 예규, 판례에서 반복적으로 등장한다. 용어를 노드로 관리하면 정의 조문, 관련 쟁점, 판례를 연결할 수 있다.

```text
수증자
→ 정의 조문
→ 증여세 관련 조문
→ 관련 심판례
```

#### 대표 예시

```text
증여자
수증자
특수관계인
증여재산
명의신탁
저가양도
부담부증여
```

#### 주요 속성

```text
term_id : 용어 식별자

name : 용어명

definition : 정의

synonyms : 동의어

source_url : 정의 출처
```

#### 증여세 예시

```cypher
MERGE (term:Term {
  term_id: 'term:recipient-of-gift',
  name: '수증자',
  definition: '증여를 받는 자'
});
```

---

### 4.8 Organization

#### 의미

`Organization`은 법령, 판례, 심판례, 예규와 관련된 기관을 표현한다.

#### 왜 필요한가

자료의 권위와 성격은 발행 기관에 따라 달라진다. 법원 판례, 조세심판원 결정, 국세청 해석례, 기획재정부 유권해석은 서로 다른 무게를 가진다.

기관 정보를 분리하면 다음과 같은 필터링과 랭킹이 가능하다.

```text
대법원 판례만 조회
조세심판원 재결례만 조회
국세청 해석례만 조회
기획재정부 해석을 더 높은 가중치로 평가
```

#### 대표 예시

```text
기획재정부
국세청
조세심판원
대법원
서울행정법원
```

#### 주요 속성

```text
organization_id : 기관 식별자

name : 기관명

organization_type : 기관 유형

code : 기관 코드
```

#### organization_type 예시

```text
MINISTRY
TAX_AUTHORITY
TAX_TRIBUNAL
COURT
LOCAL_GOVERNMENT
```

---

### 4.9 Disposition

#### 의미

`Disposition`은 과세처분, 부과처분, 경정거부처분처럼 납세자가 다투는 행정처분을 표현한다.

#### 왜 필요한가

세법 판례와 심판례는 대개 어떤 처분이 적법한지 다툰다. 처분을 별도 노드로 만들면 어떤 유형의 처분에서 어떤 결과가 나왔는지 분석할 수 있다.

```text
증여세 부과처분
→ 취소청구
→ 기각된 사건
→ 적용 조문
```

#### 대표 예시

```text
증여세 부과처분
상속세 부과처분
경정청구 거부처분
부가가치세 부과처분
```

#### 주요 속성

```text
disposition_id : 처분 식별자

disposition_type : 처분 유형

name : 처분명

tax_type : 세목

amount : 처분 금액

disposition_date : 처분일
```

---

### 4.10 Claim

#### 의미

`Claim`은 납세자나 당사자가 요구한 청구 내용을 표현한다.

#### 왜 필요한가

같은 세목과 쟁점이라도 청구 내용에 따라 검색해야 할 문서가 달라진다.

```text
부과처분 취소청구
경정거부처분 취소청구
과세표준 감액청구
```

청구를 분리하면 사용자가 “취소 가능성”, “불복 가능성”, “경정청구 가능성”을 물을 때 더 정확한 사례를 찾을 수 있다.

#### 대표 예시

```text
증여세 부과처분 취소청구
경정거부처분 취소청구
과세표준 감액청구
```

#### 주요 속성

```text
claim_id : 청구 식별자

claim_type : 청구 유형

name : 청구명

summary : 청구 요약
```

---

### 4.11 DecisionResult

#### 의미

`DecisionResult`는 판례나 심판례의 결론을 표현한다.

#### 왜 필요한가

유사 사건 검색에서 단순히 비슷한 사건을 찾는 것만으로는 부족하다. 그 사건이 인용되었는지, 기각되었는지, 일부 인용되었는지를 함께 봐야 한다.

```text
자금출처 쟁점의 심판례 중 납세자가 이긴 사례는?
명의신탁 증여의제 사건에서 기각된 사례는?
```

이런 검색을 위해 결과를 별도 노드로 둘 수 있다.

#### 대표 예시

```text
인용
기각
각하
일부 인용
파기환송
원고승
원고패
```

#### 주요 속성

```text
result_id : 결과 식별자

name : 결과명

result_type : 결과 유형

description : 설명
```

---

### 4.12 TextChunk

#### 의미

`TextChunk`는 검색과 LLM 입력을 위한 텍스트 조각이다.

GraphDB에 모든 문장을 관계로 만들지 않고, 대부분의 본문은 `TextChunk`로 저장한다. 이후 `Embedding`을 붙여 의미 검색을 수행한다.

#### 왜 필요한가

판례, 심판례, 예규는 길다. 전체 문서를 한 번에 LLM에 넣기 어렵고, 모든 문장을 관계로 만들면 노이즈가 많아진다. 따라서 문서를 의미 단위로 나눈 `TextChunk`가 필요하다.

#### 대표 예시

```text
상증세법 제45조 본문 chunk
조세심판례의 쟁점 chunk
조세심판례의 심리 및 판단 chunk
국세청 해석례의 회신 chunk
판례의 판결요지 chunk
```

#### 주요 속성

```text
chunk_id : chunk 식별자

source_type : 원천 노드 유형

source_id : 원천 노드 ID

chunk_type : chunk 유형

text : 원문 조각

text_with_context : 검색 품질을 높이기 위한 context 포함 텍스트

chunk_order : 문서 내 순서

chunk_hash : chunk 변경 감지용 해시

token_count / char_count : 길이 정보
```

#### source_type 예시

```text
LAW_UNIT
DECISION
GUIDANCE
```

#### chunk_type 예시

```text
article_text
paragraph_text
facts
issue
claimant_argument
tax_authority_argument
reasoning
conclusion
question
reply
related_law
```

---

### 4.13 EmbeddingModel

#### 의미

`EmbeddingModel`은 임베딩을 생성한 모델 정보를 표현한다.

#### 왜 필요한가

임베딩 벡터는 모델에 종속된다. 모델이 바뀌면 같은 텍스트라도 다른 벡터 공간에 매핑된다. 따라서 어떤 모델로 만든 벡터인지 추적해야 한다.

#### 주요 속성

```text
model_id : 모델 식별자

provider : 제공자

model_name : 모델명

model_version : 모델 버전

dimensions : 벡터 차원 수

similarity_function : cosine, euclidean 등 유사도 함수

is_active : 현재 사용 여부
```

#### 예시

```cypher
MERGE (m:EmbeddingModel {
  model_id: 'openai:text-embedding-3-large:default',
  provider: 'openai',
  model_name: 'text-embedding-3-large',
  dimensions: 3072,
  similarity_function: 'cosine',
  is_active: true
});
```

---

### 4.14 Embedding

#### 의미

`Embedding`은 특정 `TextChunk`를 특정 `EmbeddingModel`로 임베딩한 결과다.

#### 왜 필요한가

운영 중 임베딩 모델을 교체하거나 여러 모델을 A/B 테스트할 수 있다. 이때 `TextChunk`에 벡터를 직접 하나만 저장하면 모델 교체가 어렵다. `Embedding`을 분리하면 같은 chunk에 여러 모델의 벡터를 붙일 수 있다.

#### 주요 속성

```text
embedding_id : 임베딩 식별자

chunk_id : 원본 chunk ID

model_id : 사용 모델 ID

chunk_hash : 임베딩 생성 당시의 chunk hash

vector : 벡터 값

created_at : 생성 시각

is_active : 현재 사용 여부
```

#### 관계

```text
TextChunk -[:HAS_EMBEDDING]-> Embedding
Embedding -[:GENERATED_BY]-> EmbeddingModel
```

---

### 4.15 ExtractedFact

#### 의미

`ExtractedFact`는 원문에서 자동 추출된 후보 관계를 표현한다.

SPO 형태의 트리플이나 LLM 추론 결과를 바로 서비스 그래프에 반영하지 않고, 검증 전 후보로 보관할 때 사용한다.

#### 왜 필요한가

법률 문서에서 관계를 자동 추출하면 오류가 생길 수 있다. 예를 들어 어떤 조문이 본문에 언급되었다고 해서 반드시 실제 판단 근거로 적용된 것은 아니다. 따라서 자동 추출 결과는 후보로 저장하고, 검증된 것만 실제 관계로 반영하는 구조가 안전하다.

#### 대표 예시

```text
subject: 조심2024서0000
predicate: APPLIES
object: 상증세법 제45조
source_text: "청구인은 상속세 및 증여세법 제45조의 적용을 다투고 있다."
confidence: 0.72
status: CANDIDATE
```

#### 주요 속성

```text
fact_id : 후보 관계 식별자

subject_key : 주어 후보

predicate : 관계 후보

object_key : 목적어 후보

source_chunk_id : 근거 chunk

source_text : 근거 문장

confidence : 추출 신뢰도

extraction_method : parser, regex, llm 등

status : 후보 상태

created_at / verified_at / verified_by : 생성 및 검증 정보
```

#### status 예시

```text
CANDIDATE : 추출됨

VERIFIED : 검증됨

REJECTED : 기각됨

MATERIALIZED : 실제 그래프 관계로 반영됨
```

---

## 5. 최종 관계 모델

관계는 GraphDB의 품질을 결정한다. 노드가 “무엇”을 나타낸다면, 관계는 “왜 함께 봐야 하는지”를 나타낸다.

아래 관계들은 세법 GraphDB에서 우선적으로 설계할 관계다.

---

### 5.1 법령 구조 관계

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

### 5.2 법령 간 참조 관계

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

### 5.3 세목·쟁점·용어 관계

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

### 5.4 판례·심판례 관계

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

### 5.5 예규·해석례 관계

| 관계 | 방향 | 의미 | 예시 |
|---|---|---|---|
| `INTERPRETS` | `Guidance -> LawUnit` | 조문을 해석한다. | 국세청 해석례 → 제45조 |
| `MENTIONS` | `Guidance -> LawUnit` | 조문을 언급한다. | 예규 → 시행령 제34조 |
| `ISSUED_BY` | `Guidance -> Organization` | 발행 기관 | 해석례 → 국세청 |
| `CITES_GUIDANCE` | `Guidance -> Guidance` | 다른 예규·해석례를 인용 | 해석례 → 기존 예규 |

---

### 5.6 RAG 관계

| 관계 | 방향 | 의미 | 예시 |
|---|---|---|---|
| `HAS_CHUNK` | `LawUnit/Decision/Guidance -> TextChunk` | 검색용 본문 조각 | 심판례 → 판단 chunk |
| `NEXT_CHUNK` | `TextChunk -> TextChunk` | 문서 내 다음 chunk | 쟁점 chunk → 판단 chunk |
| `HAS_EMBEDDING` | `TextChunk -> Embedding` | chunk의 벡터 | chunk → embedding |
| `GENERATED_BY` | `Embedding -> EmbeddingModel` | 벡터 생성 모델 | embedding → text-embedding-3-large |

---

### 5.7 ExtractedFact 관계

검증 전 SPO 후보를 보관할 때 사용한다.

```text
(:ExtractedFact)-[:SUBJECT]->(:Decision | :Guidance | :LawUnit)
(:ExtractedFact)-[:OBJECT]->(:LawUnit | :Issue | :Term | :Decision)
(:ExtractedFact)-[:SUPPORTED_BY]->(:TextChunk)
```

이 구조는 자동 추출과 실제 서비스 관계를 분리하는 안전장치다.

---

## 6. 관계 속성 표준

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

## 7. 증여세 예시 그래프

증여세의 자금출처 쟁점을 모델링하면 다음과 같다.

### 7.1 기본 노드

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

### 7.2 기본 관계

```text
상속세 및 증여세법 -[:HAS_UNIT]-> 제45조
상증세법 시행령 -[:HAS_UNIT]-> 시행령 제34조

제45조 -[:ABOUT_TAX]-> 증여세
제45조 -[:HAS_ISSUE]-> 자금출처
제45조 -[:HAS_ISSUE]-> 증여추정

제45조 -[:DETAILED_BY]-> 시행령 제34조
시행령 제34조 -[:BASED_ON]-> 제45조
```

### 7.3 심판례 연결

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

## 8. Cypher 예시

### 8.1 Law 생성

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

### 8.2 LawUnit 생성

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

### 8.3 이전 본문과 연결

```cypher
MATCH (new:LawUnit {
  unit_id: 'inheritance-gift-tax-act:article-45:2025-01-01'
})
MATCH (old:LawUnit {
  unit_id: 'inheritance-gift-tax-act:article-45:2021-01-01'
})
MERGE (new)-[:REPLACES]->(old);
```

### 8.4 사건일 기준 조문 조회

```cypher
MATCH (u:LawUnit {
  canonical_id: 'inheritance-gift-tax-act:article-45'
})
WHERE date($event_date) >= u.applies_from
  AND date($event_date) <= u.applies_to
RETURN u;
```

### 8.5 심판례와 적용 조문 연결

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

### 8.6 자금출처 쟁점과 연결된 조문·심판례 조회

```cypher
MATCH (issue:Issue {name: '자금출처'})
OPTIONAL MATCH (u:LawUnit)-[:HAS_ISSUE]->(issue)
OPTIONAL MATCH (d:Decision)-[:HAS_ISSUE]->(issue)
RETURN
  collect(DISTINCT u) AS law_units,
  collect(DISTINCT d) AS decisions;
```

---

## 9. 제약조건과 인덱스 권장안

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

## 10. 2편 요약

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

다음 편에서는 이 모델을 기반으로 실제 Graph-RAG 검색 흐름, Chunk 설계, Embedding, Cypher 예시, 운영 파이프라인을 다룬다.

---

이전 글: [세법 GraphDB 설계 1편: 왜 세법에는 GraphDB가 필요한가](/data/tax-graphdb-series-01-concept/)

다음 글: [세법 GraphDB 설계 3편: Graph-RAG 검색과 운영 아키텍처](/data/tax-graphdb-series-03-graphrag-ops/)
