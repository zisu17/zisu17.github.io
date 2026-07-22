---
title: "[GraphDB] 세법 GraphDB 설계 6편: 운영 아키텍처와 로드맵"
excerpt: "세법 Graph-RAG 서비스를 운영하기 위한 데이터 파이프라인, 서비스 아키텍처, 보안·품질 관리, 구축 로드맵을 정리한다."

categories:
  - Database
tags:
  - Data
  - GraphDB
  - Neo4j
  - RAG
  - Tax

permalink: /data/tax-graphdb-series-06-graphrag-operations/

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

## 1. 6편의 목적

5편에서는 세법 Graph-RAG의 검색 흐름과 관계 추출 전략을 정리했다.

6편에서는 이 구조를 운영 가능한 서비스로 만들기 위한 파이프라인과 아키텍처를 다룬다. 데이터 수집·정제·적재, Cypher 예시, 서비스 구성, 운영·보안·품질 관리, 구축 로드맵을 하나의 실행 계획으로 정리한다.

주요 내용은 다음과 같다.

```text
1. 데이터 수집·정제·적재 파이프라인
2. Neo4j Cypher 예시
3. 서비스 아키텍처
4. 운영·보안·품질 관리
5. 구축 로드맵
```

---

## 2. 데이터 수집·정제·적재 파이프라인

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

### 2.1 Extract

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

### 2.2 Normalize

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

### 2.3 Parse

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

### 2.4 Chunk

문서 구조 기준으로 chunk를 만든다.

```text
법령: 조문/항/호/목
심판례: 쟁점/관련법령/판단/결론
예규: 질의/회신/이유
```

---

### 2.5 Embed

`TextChunk`를 embedding model로 벡터화한다.

```text
TextChunk
→ Embedding
```

---

### 2.6 Build Graph

노드와 관계를 생성한다.

```text
Law - HAS_UNIT - LawUnit
Decision - APPLIES - LawUnit
Guidance - INTERPRETS - LawUnit
LawUnit - HAS_CHUNK - TextChunk
```

---

### 2.7 Verify Relations

자동 추출 관계를 검증한다.

```text
ExtractedFact
→ verified relation
```

---

## 3. Neo4j Cypher 예시

### 3.1 법령 생성

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

### 3.2 조문 생성

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

### 3.3 이전 조문과 연결

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

### 3.4 사건일 기준 조문 조회

```cypher
MATCH (u:LawUnit {
  canonical_id: 'inheritance-gift-tax-act:article-45'
})
WHERE date($event_date) >= u.applies_from
  AND date($event_date) <= u.applies_to
RETURN u;
```

---

### 3.5 심판례와 적용 조문 연결

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

### 3.6 자금출처 쟁점과 연결된 조문/심판례 조회

```cypher
MATCH (issue:Issue {name: '자금출처'})
OPTIONAL MATCH (u:LawUnit)-[:HAS_ISSUE]->(issue)
OPTIONAL MATCH (d:Decision)-[:HAS_ISSUE]->(issue)
RETURN
  collect(DISTINCT u) AS law_units,
  collect(DISTINCT d) AS decisions;
```

---

### 3.7 제45조 기준 근거 확장

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

## 4. 서비스 아키텍처 예시

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

## 5. 운영·보안·품질 관리

### 5.1 Idempotent 적재

같은 데이터를 여러 번 적재해도 중복이 생기면 안 된다.

```text
MERGE 사용
content_hash 사용
unit_id / decision_id / guidance_id unique 제약조건
```

---

### 5.2 원천 응답 보존

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

### 5.3 관계 신뢰도 관리

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

### 5.4 LLM 추론 관계 분리

LLM이 만든 관계는 바로 확정하지 않는다.

```text
ExtractedFact(status = CANDIDATE)
```

검증 후 실제 관계로 반영한다.

---

### 5.5 개인정보와 민감정보

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

### 5.6 품질 평가

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

## 6. 구축 로드맵

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

## 7. 6편 요약

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

이전 글: [5편. Graph-RAG 검색 설계](/data/tax-graphdb-series-05-graphrag-search/)
