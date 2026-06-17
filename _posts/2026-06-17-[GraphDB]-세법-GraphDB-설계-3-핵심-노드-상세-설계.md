---
title: "[GraphDB] 세법 GraphDB 설계 3편: 핵심 노드 상세 설계"
excerpt: "Law, LawUnit, Decision, Guidance, TextChunk, Embedding 등 세법 GraphDB의 핵심 노드와 속성을 상세히 설계한다."

categories:
  - Data
tags:
  - Data
  - GraphDB
  - Neo4j
  - RAG
  - Tax

permalink: /data/tax-graphdb-series-03-node-model/

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

## 1. 3편의 목적

2편에서는 세법 GraphDB를 설계할 때 지켜야 할 모델링 원칙을 정리했다.

3편에서는 그 원칙을 실제 노드 모델로 옮긴다. `Law`, `LawUnit`, `Decision`, `Guidance`를 중심으로 어떤 노드가 필요하고, 각 노드에 어떤 속성을 둘지 정리한다.

이번 편의 목표는 다음과 같다.

```text
1. 세법 GraphDB의 필수/권장/선택 노드를 구분한다.
2. 각 노드가 어떤 업무 개념을 표현하는지 설명한다.
3. LawUnit, Decision, Guidance, TextChunk, Embedding의 속성 설계를 정리한다.
4. 증여세 자금출처 쟁점에 필요한 확장 노드를 확인한다.
```

---

## 2. 최종 노드 목록

아래 표는 이 모델에서 사용하는 노드의 역할을 한눈에 정리한 것이다. 각 노드는 단순한 이름 목록이 아니라, 세법 Agent가 검색과 답변을 만들 때 어떤 역할을 하는지를 기준으로 정의한다.

### 2.1 필수 노드

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

### 2.2 권장 노드

| 노드               | 의미             | 왜 필요한가                          | 예시               |
| ---------------- | -------------- | ------------------------------- | ---------------- |
| `Term`           | 법령 용어          | 조문 정의와 문서 속 용어를 연결한다.           | 증여자, 수증자, 특수관계인  |
| `Organization`   | 기관·법원·처분청·발행기관 | 판결 기관, 처분청, 해석 발행 기관을 명확히 구분한다. | 국세청, 조세심판원, 대법원  |
| `Disposition`    | 과세처분 또는 행정처분   | 판례·심판례에서 무엇을 다투는지 표현한다.         | 증여세 부과처분, 경정거부처분 |
| `Claim`          | 청구 내용          | 납세자가 무엇을 요구했는지 표현한다.            | 증여세 부과처분 취소청구    |
| `DecisionResult` | 판단 결과          | 인용·기각·각하 등 결과 기반 검색에 사용한다.      | 기각, 인용, 일부 인용    |

### 2.3 선택 노드

| 노드 | 의미 | 왜 필요한가 | 사용 시점 |
|---|---|---|---|
| `ExtractedFact` | 자동 추출된 후보 관계 | LLM·정규식·파서가 만든 관계를 바로 확정하지 않고 검증 전 후보로 관리한다. | 관계 검증 워크플로우가 필요할 때 |
| `IngestionRun` | 수집·적재 실행 기록 | 배치 실행, 실패, 재처리 이력을 추적한다. | 운영 자동화 단계 |
| `RetrievalLog` | 검색 실행 로그 | 어떤 질문에서 어떤 근거가 검색되었는지 추적한다. | 검색 품질 평가, 감사 로그 |

---

## 3. 노드 상세 설계

이 섹션에서는 각 노드가 어떤 업무 개념을 표현하는지, 언제 사용하는지, 어떤 속성을 가져야 하는지 상세히 설명한다.

---

### 3.1 Law

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

#### 예시

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

### 3.2 LawUnit

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

#### 예시

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

### 3.3 Decision

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

#### 예시

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

### 3.4 Guidance

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
guidance_id : 해석/안내 문서 식별자

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

#### 예시

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

### 3.5 TaxType

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

#### 예시

```cypher
MERGE (t:TaxType {
  tax_type_id: 'tax-type:gift-tax',
  code: 'GIFT_TAX',
  name: '증여세',
  category: '국세'
});
```

---

### 3.6 Issue

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

#### 예시

```cypher
MERGE (i:Issue {
  issue_id: 'issue:fund-source',
  name: '자금출처',
  description: '재산 취득자금의 출처 입증 및 증여 추정과 관련된 쟁점',
  synonyms: ['재산 취득자금', '취득자금 소명', '자금출처 조사']
});
```

---

### 3.7 Term

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

#### 예시

```cypher
MERGE (term:Term {
  term_id: 'term:recipient-of-gift',
  name: '수증자',
  definition: '증여를 받는 자'
});
```

---

### 3.8 Organization

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

### 3.9 Disposition

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

### 3.10 Claim

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

### 3.11 DecisionResult

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

### 3.12 TextChunk

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

### 3.13 EmbeddingModel

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

### 3.14 Embedding

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

### 3.15 ExtractedFact

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

이전 글: [2편. LawUnit 모델링 원칙](/data/tax-graphdb-series-02-modeling/)

다음 글: [4편. 관계 모델과 Cypher 예시](/data/tax-graphdb-series-04-relationships-cypher/)
