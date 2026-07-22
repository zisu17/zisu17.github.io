---
title: "[GraphDB] 세법 GraphDB 설계 5편: Graph-RAG 검색 설계"
excerpt: "세법 GraphDB 모델을 기반으로 Chunk, Embedding, Vector Search, Graph Expansion, 관계 추출 전략을 설계한다."

categories:
  - Database
tags:
  - Data
  - GraphDB
  - Neo4j
  - RAG
  - Tax

permalink: /data/tax-graphdb-series-05-graphrag-search/

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

## 1. 5편의 목적

1편에서는 세법에 GraphDB가 필요한 이유를 설명했고, 2~4편에서는 `Law`, `LawUnit`, `Decision`, `Guidance` 중심의 데이터 모델과 관계 모델을 설계했다.

5편에서는 이 모델을 실제 검색 흐름에 어떻게 사용할지 다룬다. Chunk 설계, Embedding과 Neo4j Vector Index, Graph-RAG 검색 단계, 관계 추출 전략을 중심으로 정리한다.

주요 내용은 다음과 같다.

```text
1. 전체 검색 구조
2. Chunk 설계
3. Embedding과 Neo4j Vector Index
4. Graph-RAG 검색 흐름
5. 관계 추출 전략
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

### 3.1 법령 Chunk

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

### 3.2 심판례 Chunk

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

### 3.3 판례 Chunk

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

### 3.4 예규·해석례 Chunk

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

### 3.5 Chunk 속성

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

### 3.6 NEXT_CHUNK

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

이전 글: [4편. 관계 모델과 Cypher 예시](/data/tax-graphdb-series-04-relationships-cypher/)

다음 글: [6편. 운영 아키텍처와 로드맵](/data/tax-graphdb-series-06-graphrag-operations/)
