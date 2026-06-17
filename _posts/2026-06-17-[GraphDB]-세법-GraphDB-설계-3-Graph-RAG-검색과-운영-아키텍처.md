---
title: "[GraphDB] 세법 GraphDB 설계 3편: Graph-RAG 검색과 운영 아키텍처"
excerpt: "세법 Graph-RAG 서비스의 검색 흐름, Chunk/Embedding 설계, 운영 파이프라인과 품질 관리 전략을 정리한다."

categories:
  - Data
tags:
  - Data
  - GraphDB
  - Neo4j
  - RAG
  - Tax

permalink: /data/tax-graphdb-series-03-graphrag-ops/

toc: true
toc_sticky: true

date: 2026-06-17
last_modified_at: 2026-06-17
---

> 세법 GraphDB 시리즈
> - [1편. 왜 세법에는 GraphDB가 필요한가](/data/tax-graphdb-series-01-concept/)
> - [2편. LawUnit 중심 데이터 모델](/data/tax-graphdb-series-02-modeling/)
> - [3편. Graph-RAG 검색과 운영 아키텍처](/data/tax-graphdb-series-03-graphrag-ops/)

## 1. 3편의 목적

1편에서는 세법에 GraphDB가 필요한 이유를 설명했고, 2편에서는 `Law`, `LawUnit`, `Decision`, `Guidance` 중심의 데이터 모델을 설계했다.

3편에서는 이 모델을 실제 서비스로 운영하기 위한 구조를 다룬다.

주요 내용은 다음과 같다.

```text
1. Chunk 설계
2. Embedding과 Neo4j Vector Index
3. Graph-RAG 검색 흐름
4. 관계 추출 전략
5. Neo4j Cypher 예시
6. 데이터 수집·정제·적재 파이프라인
7. 서비스 아키텍처
8. 운영·보안·품질 관리
9. 구축 로드맵
```

---

## 2. 전체 검색 구조

세법 Graph-RAG는 다음 구조로 동작한다.

```text
사용자 질문
  ↓
질문 분석
  ↓
Vector Search
  ↓
Graph Seed 확정
  ↓
Graph Expansion
  ↓
날짜 기준 필터링
  ↓
근거 랭킹
  ↓
Context 구성
  ↓
LLM 답변 생성
```

핵심은 LLM이 바로 답하지 않는다는 점이다.

```text
LLM은 근거를 찾는 주체가 아니다.
LLM은 검색된 근거를 설명하는 주체다.
```

근거 탐색은 Vector Search와 GraphDB가 담당해야 한다.

---

## 3. Chunk 설계

GraphDB에 모든 문장을 관계로 만들지 않는다.  
본문의 대부분은 `TextChunk`로 저장하고, 검색에 사용한다.

```text
핵심 법률 관계
→ GraphDB 관계

본문 내용
→ TextChunk

의미 검색
→ Embedding

근거 설명
→ LLM
```

---

## 3.1 법령 Chunk

법령은 고정 길이로 자르지 않는다.  
법령 구조를 기준으로 나눈다.

```text
LawUnit 제45조
 ├─ TextChunk(article_full)
 ├─ TextChunk(paragraph_1)
 └─ TextChunk(paragraph_2)
```

권장 기준:

```text
1. 조문 단위 우선
2. 조문이 길면 항 단위
3. 항이 길면 호/목 단위
4. chunk마다 법령명, 조문번호, 시행일, 적용일을 context header로 포함
```

예시:

```text
[법령] 상속세 및 증여세법
[조문] 제45조 재산 취득자금 등의 증여 추정
[효력시작일] 2025-01-01
[적용시작일] 2025-01-01
[세목] 증여세

본문:
...
```

---

## 3.2 심판례 Chunk

조세심판례는 문서 구조를 기준으로 나눈다.

```text
Decision 조심2024서0000
 ├─ TextChunk(summary)
 ├─ TextChunk(facts)
 ├─ TextChunk(claimant_argument)
 ├─ TextChunk(tax_authority_argument)
 ├─ TextChunk(issue)
 ├─ TextChunk(related_law)
 ├─ TextChunk(reasoning)
 └─ TextChunk(conclusion)
```

특히 중요한 chunk는 다음이다.

```text
issue
related_law
reasoning
conclusion
```

심판례는 결론보다 **심리 및 판단** 부분이 검색 품질에 중요하다.

---

## 3.3 판례 Chunk

판례는 다음 단위로 나눈다.

```text
판시사항
판결요지
참조조문
참조판례
사실관계
당사자 주장
법원의 판단
결론
```

검색 우선순위가 높은 부분은 다음이다.

```text
판시사항
판결요지
참조조문
법원의 판단
```

---

## 3.4 예규·해석례 Chunk

예규와 법령해석은 다음 단위로 나눈다.

```text
질의
사실관계
회신
이유
관련법령
```

특히 `회신`과 `이유`는 답변 생성에 중요하다.

예시:

```text
Guidance 서면질의
 ├─ TextChunk(question)
 ├─ TextChunk(facts)
 ├─ TextChunk(reply)
 └─ TextChunk(reasoning)
```

---

## 3.5 Chunk 속성

`TextChunk`에는 최소한 다음 속성을 둔다.

```text
chunk_id
source_type
source_id
chunk_type
text
text_with_context
chunk_order
chunk_hash
token_count
char_count
created_at
updated_at
```

`text`는 원문 조각이고, `text_with_context`는 임베딩과 LLM 입력에 쓰는 보강 텍스트다.

```text
text:
재산 취득자금의 출처를 입증하지 못하는 경우...

text_with_context:
[법령] 상속세 및 증여세법
[조문] 제45조 재산 취득자금 등의 증여 추정
[세목] 증여세
[쟁점] 자금출처, 증여추정
[본문]
재산 취득자금의 출처를 입증하지 못하는 경우...
```

---

## 3.6 NEXT_CHUNK

긴 문서는 chunk 순서가 중요하다.

```text
(:TextChunk)-[:NEXT_CHUNK]->(:TextChunk)
```

검색 결과로 `reasoning` chunk가 걸렸다면 앞뒤 chunk를 함께 가져올 수 있다.

```cypher
MATCH (c:TextChunk {chunk_id: $chunk_id})
OPTIONAL MATCH (prev:TextChunk)-[:NEXT_CHUNK]->(c)
OPTIONAL MATCH (c)-[:NEXT_CHUNK]->(next:TextChunk)
RETURN c, prev, next;
```

---

## 4. Embedding과 Neo4j Vector Index

### 4.1 Embedding을 분리하는 이유

임베딩 모델은 바뀔 수 있다.

```text
text-embedding-3-small
text-embedding-3-large
bge-m3
e5-large
사내 embedding 모델
```

모델이 바뀌면 기존 벡터는 보통 재사용하기 어렵다.  
그래서 `TextChunk`와 `Embedding`을 분리하는 것이 좋다.

```text
(:TextChunk)-[:HAS_EMBEDDING]->(:Embedding)
(:Embedding)-[:GENERATED_BY]->(:EmbeddingModel)
```

모델을 바꿀 때는 GraphDB 전체를 재적재하지 않고 `Embedding`만 새로 만들면 된다.

---

### 4.2 EmbeddingModel

```text
model_id
provider
model_name
model_version
dimensions
similarity_function
is_active
```

예시:

```text
(:EmbeddingModel {
  model_id: "openai:text-embedding-3-large:v1",
  provider: "openai",
  model_name: "text-embedding-3-large",
  model_version: "v1",
  dimensions: 3072,
  similarity_function: "cosine",
  is_active: true
})
```

---

### 4.3 Embedding

```text
embedding_id
chunk_id
model_id
chunk_hash
vector
created_at
is_active
```

`chunk_hash`를 저장하면 원문 chunk가 바뀌었는지 확인할 수 있다.

```text
chunk_hash가 같음
→ 재임베딩 불필요

chunk_hash가 다름
→ 해당 chunk만 재임베딩
```

---

### 4.4 Neo4j Vector Index

모델별로 인덱스를 분리한다.

예시:

```cypher
CREATE VECTOR INDEX embedding_openai_large_idx IF NOT EXISTS
FOR (e:Embedding_OpenAI_Large)
ON e.vector
OPTIONS {
  indexConfig: {
    `vector.dimensions`: 3072,
    `vector.similarity_function`: 'cosine'
  }
};
```

검색 예시:

```cypher
CALL db.index.vector.queryNodes(
  'embedding_openai_large_idx',
  10,
  $query_embedding
)
YIELD node AS embedding, score
MATCH (chunk:TextChunk)-[:HAS_EMBEDDING]->(embedding)
RETURN chunk, score
ORDER BY score DESC;
```

---

## 5. Graph-RAG 검색 흐름

사용자 질문:

```text
부모가 자녀 아파트 취득자금을 지원하면 증여세 문제가 있나?
```

---

### 5.1 질문 분석

질문에서 다음 정보를 추출한다.

```text
세목: 증여세
쟁점: 자금출처, 증여추정
후보 조문: 상증세법 제45조
사건 기준일: 없음
문서 유형: 법령, 시행령, 심판례, 예규
```

사건 기준일이 있으면 중요하다.

```text
2021년에 부모가 자녀에게 아파트 취득자금을 지원했다면...
```

이 경우 2021년에 적용되는 조문을 우선 검색해야 한다.

---

### 5.2 Vector Search

질문을 임베딩으로 변환한 뒤, `TextChunk`를 검색한다.

검색 결과 예시:

```text
상증세법 제45조 chunk
상증세법 시행령 관련 chunk
자금출처 관련 심판례 reasoning chunk
국세청 해석례 reply chunk
```

Vector Search는 seed 후보를 찾는 역할을 한다.

---

### 5.3 Graph Seed 확정

검색 결과와 질문 분석을 조합해 seed를 정한다.

```text
TaxType: 증여세
Issue: 자금출처
LawUnit: 상증세법 제45조
```

---

### 5.4 Graph Expansion

Seed에서 관계를 따라 확장한다.

```text
제45조
→ DETAILED_BY
→ 시행령 관련 조문

제45조
← APPLIES
← 심판례

제45조
← INTERPRETS
← 예규/해석례

자금출처
← HAS_ISSUE
← 관련 판례/심판례
```

Cypher 예시:

```cypher
MATCH (seed:LawUnit {canonical_id: 'inheritance-gift-tax-act:article-45'})
OPTIONAL MATCH (seed)-[:DETAILED_BY|CITES|APPLIES_WITH*1..2]->(related:LawUnit)
OPTIONAL MATCH (decision:Decision)-[:APPLIES|MENTIONS|INTERPRETS]->(seed)
OPTIONAL MATCH (guidance:Guidance)-[:INTERPRETS|MENTIONS]->(seed)
RETURN seed, collect(DISTINCT related), collect(DISTINCT decision), collect(DISTINCT guidance);
```

---

### 5.5 날짜 기준 필터링

사건일이 있으면 `applies_from`, `applies_to` 기준으로 필터링한다.

```cypher
MATCH (u:LawUnit {
  canonical_id: 'inheritance-gift-tax-act:article-45'
})
WHERE date($event_date) >= u.applies_from
  AND date($event_date) <= u.applies_to
RETURN u;
```

사건일이 없으면 현재 조문을 사용한다.

```cypher
MATCH (u:LawUnit {
  canonical_id: 'inheritance-gift-tax-act:article-45',
  is_current: true
})
RETURN u;
```

---

### 5.6 랭킹

검색 결과는 점수화한다.

```text
final_score =
  vector_score * 0.35
+ graph_distance_score * 0.25
+ relation_type_weight * 0.20
+ confidence * 0.10
+ source_authority_weight * 0.05
+ recency_weight * 0.05
```

관계별 가중치 예시:

```text
APPLIES: 1.00
INTERPRETS: 0.95
DETAILED_BY: 0.90
DELEGATES_TO: 0.90
CITES: 0.70
MENTIONS: 0.50
```

`APPLIES`가 `MENTIONS`보다 훨씬 중요하다.

---

### 5.7 Context 구성

LLM에 넣을 context는 다음을 포함해야 한다.

```text
문서명
조문번호
시행일
적용일
사건번호
결정일
근거 관계
source_url
chunk text
```

예시:

```text
[근거 1]
문서: 상속세 및 증여세법
조문: 제45조 재산 취득자금 등의 증여 추정
적용 기준: 현재 시행 기준
관계: 질문 쟁점과 직접 관련
본문: ...

[근거 2]
문서: 조심2024서0000
관계: 상증세법 제45조를 적용한 심판례
쟁점: 자금출처
결론: 기각
본문: ...
```

---

### 5.8 LLM 답변

LLM은 검색된 근거만 사용한다.

답변에는 다음을 포함한다.

```text
1. 결론
2. 적용 기준일
3. 관련 조문
4. 시행령/예규/심판례 근거
5. 주의사항
6. 근거 목록
```

근거가 부족하면 답변을 중단한다.

```text
제공된 근거만으로는 판단하기 어렵습니다.
```

---

## 6. 관계 추출 전략

GraphDB 품질은 관계 품질에 달려 있다.

관계는 다음 방식으로 추출한다.

---

### 6.1 공식 필드 기반

판례나 심판례에 `관련법령`, `참조조문` 필드가 있으면 신뢰도가 높다.

```text
source_method = official_field
confidence = 0.9 이상
```

---

### 6.2 정규식 기반

조문 참조는 정규식으로 추출할 수 있다.

```text
제45조
제45조 제1항
제45조제1항제2호
상속세 및 증여세법 제45조
같은 법 제00조
동법 시행령 제00조
```

정규식 기반은 후보로 저장한다.

```text
source_method = regex
confidence = 0.6 ~ 0.8
```

---

### 6.3 LLM 기반

쟁점 추출, 판단 요지 추출, 관계 후보 생성에는 LLM을 사용할 수 있다.

하지만 LLM 추출 관계는 바로 확정하면 안 된다.

```text
ExtractedFact {
  predicate: "APPLIES",
  confidence: 0.78,
  status: "CANDIDATE"
}
```

검증 후 실제 관계로 materialize한다.

---

### 6.4 수작업 검증

정식 서비스에서는 관리자 검증 구조가 필요하다.

```text
CANDIDATE
→ VERIFIED
→ MATERIALIZED

또는

CANDIDATE
→ REJECTED
```

검증된 관계는 높은 신뢰도로 검색 랭킹에 반영한다.

---

## 7. 데이터 수집·정제·적재 파이프라인

전체 파이프라인은 다음과 같다.

```text
Extract
→ Normalize
→ Parse
→ Chunk
→ Embed
→ Build Graph
→ Verify Relations
→ Serve
```

---

### 7.1 Extract

수집 대상:

```text
국가법령정보센터 법령 데이터
조세심판원 재결례
국세청 법령해석/예규
판례
기본통칙
```

원천 응답은 보존한다.

```text
raw_json
raw_xml
raw_html
raw_pdf
```

---

### 7.2 Normalize

날짜, 조문번호, 법령명, 사건번호를 정규화한다.

```text
제45조제1항
→ 제45조 제1항

상증세법
→ 상속세 및 증여세법

2021. 6. 10.
→ 2021-06-10
```

---

### 7.3 Parse

문서를 구조화한다.

```text
법령
→ Law, LawUnit

판례/심판례
→ Decision, Disposition, Claim, DecisionResult

예규/해석례
→ Guidance
```

---

### 7.4 Chunk

문서 구조 기준으로 chunk를 만든다.

```text
법령: 조문/항/호/목
심판례: 쟁점/관련법령/판단/결론
예규: 질의/회신/이유
```

---

### 7.5 Embed

`TextChunk`를 embedding model로 벡터화한다.

```text
TextChunk
→ Embedding
```

---

### 7.6 Build Graph

노드와 관계를 생성한다.

```text
Law - HAS_UNIT - LawUnit
Decision - APPLIES - LawUnit
Guidance - INTERPRETS - LawUnit
LawUnit - HAS_CHUNK - TextChunk
```

---

### 7.7 Verify Relations

자동 추출 관계를 검증한다.

```text
ExtractedFact
→ verified relation
```

---

## 8. Neo4j Cypher 예시

### 8.1 법령 생성

```cypher
MERGE (law:Law {
  law_id: 'inheritance-gift-tax-act',
  law_type: 'ACT',
  name: '상속세 및 증여세법',
  jurisdiction: 'KR',
  ministry: '기획재정부'
});
```

---

### 8.2 조문 생성

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

### 8.3 이전 조문과 연결

```cypher
MATCH (new:LawUnit {
  unit_id: 'inheritance-gift-tax-act:article-45:2025-01-01'
})
MATCH (old:LawUnit {
  unit_id: 'inheritance-gift-tax-act:article-45:2021-01-01'
})
MERGE (new)-[:REPLACES]->(old);
```

---

### 8.4 사건일 기준 조문 조회

```cypher
MATCH (u:LawUnit {
  canonical_id: 'inheritance-gift-tax-act:article-45'
})
WHERE date($event_date) >= u.applies_from
  AND date($event_date) <= u.applies_to
RETURN u;
```

---

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

---

### 8.6 자금출처 쟁점과 연결된 조문/심판례 조회

```cypher
MATCH (issue:Issue {name: '자금출처'})
OPTIONAL MATCH (u:LawUnit)-[:HAS_ISSUE]->(issue)
OPTIONAL MATCH (d:Decision)-[:HAS_ISSUE]->(issue)
RETURN
  collect(DISTINCT u) AS law_units,
  collect(DISTINCT d) AS decisions;
```

---

### 8.7 제45조 기준 근거 확장

```cypher
MATCH (u:LawUnit {
  canonical_id: 'inheritance-gift-tax-act:article-45',
  is_current: true
})
OPTIONAL MATCH (u)-[:DETAILED_BY|CITES|APPLIES_WITH*1..2]->(related:LawUnit)
OPTIONAL MATCH (d:Decision)-[:APPLIES|MENTIONS|INTERPRETS]->(u)
OPTIONAL MATCH (g:Guidance)-[:INTERPRETS|MENTIONS]->(u)
RETURN
  u,
  collect(DISTINCT related) AS related_law_units,
  collect(DISTINCT d) AS decisions,
  collect(DISTINCT g) AS guidances;
```

---

## 9. 서비스 아키텍처 예시

```text
[External Data Sources]
  - 법령 API
  - 조세심판례 API
  - 예규/해석례 API
  - 판례 API

        ↓

[Ingestion Service]
  - 수집
  - 원천 저장
  - 재시도
  - checkpoint

        ↓

[Parsing & Normalization]
  - 법령 구조 파싱
  - 사건 구조 파싱
  - 조문번호 정규화
  - 날짜 정규화

        ↓

[Graph Builder]
  - Law / LawUnit
  - Decision / Guidance
  - 관계 생성

        ↓

[Chunk & Embedding Service]
  - TextChunk 생성
  - Embedding 생성
  - Vector Index 적재

        ↓

[Retrieval Service]
  - Vector Search
  - Graph Expansion
  - Ranking

        ↓

[Agent Service]
  - 근거 기반 답변 생성
  - Evidence 반환
```

---

## 10. 운영·보안·품질 관리

### 10.1 Idempotent 적재

같은 데이터를 여러 번 적재해도 중복이 생기면 안 된다.

```text
MERGE 사용
content_hash 사용
unit_id / decision_id / guidance_id unique 제약조건
```

---

### 10.2 원천 응답 보존

원천 API 응답은 반드시 보존한다.

```text
raw_json
raw_xml
raw_html
collected_at
content_hash
source_url
```

그래야 파서 개선 시 재처리할 수 있다.

---

### 10.3 관계 신뢰도 관리

관계마다 신뢰도를 둔다.

```text
official_field: 0.95
parser: 0.85
regex: 0.70
llm: 0.60
manual: 1.00
```

검색 랭킹에서 `confidence`와 `verified`를 반영한다.

---

### 10.4 LLM 추론 관계 분리

LLM이 만든 관계는 바로 확정하지 않는다.

```text
ExtractedFact(status = CANDIDATE)
```

검증 후 실제 관계로 반영한다.

---

### 10.5 개인정보와 민감정보

세법 사건 데이터에는 민감정보가 포함될 수 있다.

관리 기준:

```text
성명 마스킹
주민번호/사업자번호 제거
주소 상세 제거
계좌번호 제거
LLM 요청 로그 최소화
사용자 질의 로그 보존 기간 관리
```

---

### 10.6 품질 평가

평가 질문 세트를 만든다.

```text
부모가 자녀 아파트 취득자금을 지원하면 증여세 문제가 있나?

자금출처를 입증하지 못한 경우 어떤 조문이 적용되는가?

부담부증여와 관련된 상증세법 조문과 심판례는 무엇인가?

명의신탁 증여의제와 관련된 조문, 판례, 예규를 찾아줘.
```

평가 지표:

```text
정답 조문 hit 여부
관련 시행령 포함 여부
심판례/예규 근거 포함 여부
과거 사건일 기준 조문 매핑 정확도
근거 없는 답변 발생률
```

---

## 11. 구축 로드맵

### 1단계: 증여세 최소 그래프

```text
상속세 및 증여세법
상속세 및 증여세법 시행령
주요 조문
TaxType
Issue
TextChunk
Embedding
```

목표:

```text
증여세 주요 조문 검색
자금출처 쟁점 검색
조문-시행령 연결
```

---

### 2단계: 심판례·예규 연결

```text
Decision
Guidance
APPLIES
INTERPRETS
HAS_ISSUE
```

목표:

```text
특정 조문을 적용한 심판례 조회
특정 조문을 해석한 예규 조회
쟁점 기반 근거 확장
```

---

### 3단계: 버전·적용일 관리

```text
LawUnit 시점별 생성
REPLACES 관계
valid_from / valid_to
applies_from / applies_to
```

목표:

```text
과거 사건일 기준 조문 매핑
현재 조문과 과거 조문 구분
```

---

### 4단계: Graph-RAG 서비스화

```text
Vector Search
Graph Expansion
Ranking
LLM Answer
Evidence 반환
```

목표:

```text
세법 질문에 근거 기반 답변 생성
```

---

### 5단계: 관계 검증과 품질 관리

```text
ExtractedFact
관리자 검증
confidence 관리
평가셋 운영
```

목표:

```text
운영 가능한 세법 지식 그래프 품질 확보
```

---

## 12. 최종 요약

세법 GraphDB는 문서 전체를 그래프로 바꾸는 프로젝트가 아니다.

```text
모든 텍스트
→ TextChunk

의미 검색
→ Embedding

핵심 법률 관계
→ GraphDB

자동 추출 후보
→ ExtractedFact

검증된 관계
→ 실제 Edge
```

최종 모델은 다음과 같다.

```text
Law
- 법령

LawUnit
- 조문/항/호/목
- 시점별 효력/적용 기간 관리

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
- 검색용 텍스트 조각

Embedding
- 벡터
```

핵심 관계는 다음이다.

```text
Law -[:HAS_UNIT]-> LawUnit
LawUnit -[:HAS_CHILD]-> LawUnit
LawUnit -[:REPLACES]-> LawUnit
LawUnit -[:DETAILED_BY]-> LawUnit

Decision -[:APPLIES]-> LawUnit
Guidance -[:INTERPRETS]-> LawUnit

Decision -[:HAS_ISSUE]-> Issue
LawUnit -[:HAS_ISSUE]-> Issue
Decision -[:ABOUT_TAX]-> TaxType

LawUnit/Decision/Guidance -[:HAS_CHUNK]-> TextChunk
TextChunk -[:HAS_EMBEDDING]-> Embedding
```

이 구조는 세법 GraphDB를 문서 저장소가 아니라 **세법 근거 관계망**으로 만들기 위한 구조다.

---

이전 글: [세법 GraphDB 설계 2편: LawUnit 중심 데이터 모델](/data/tax-graphdb-series-02-modeling/)
