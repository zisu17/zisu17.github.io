---
title: "[SemanticLayer] Text-to-SQL이 좋아져도 Semantic Layer가 필요한 이유"
excerpt: LLM의 SQL 생성 능력이 좋아진 지금도 Semantic Layer가 필요한 이유를 dbt Labs의 2026년 벤치마크와 Data Agent 관점에서 정리한다.

categories:
  - Data

tags:
  - Data
  - SemanticLayer
  - TextToSQL
  - dbt
  - DataAgent

permalink: /data/semantic-layer-vs-text-to-sql-2026/

toc: true
toc_sticky: true
published: false

date: 2026-09-17
last_modified_at: 2026-09-17
---

## 1. Text-to-SQL이 이 정도면 Semantic Layer가 꼭 필요할까

요즘 Text-to-SQL을 보면 2~3년 전과는 느낌이 꽤 다르다.

예전에는 자연어 질문을 SQL로 바꾸는 것 자체가 어려운 문제였다. JOIN 하나만 복잡해져도 엉뚱한 쿼리가 만들어졌고, 스키마가 조금만 커져도 실제 업무에 쓰기에는 불안했다.

지금은 상황이 많이 달라졌다. 충분한 스키마 정보와 메타데이터를 넣어주면 최신 LLM이 꽤 복잡한 SQL도 잘 만든다.

그러다 보면 자연스럽게 이런 의문이 생긴다.

> LLM이 SQL을 이 정도로 잘 만든다면, 지표와 관계를 미리 정의하는 Semantic Layer가 여전히 필요한가?

dbt Labs도 같은 질문을 가지고 2026년 4월 Semantic Layer와 Text-to-SQL 벤치마크를 다시 수행했다.

2023년 GPT-4를 대상으로 했던 실험을 Claude Sonnet 4.6, Claude Opus 4.6, GPT-5.3 Codex, GPT-5.2와 같은 최신 모델로 다시 돌린 것이다.

실험에는 보험 도메인의 ACME Insurance 데이터셋과 자연어 질문 11개가 사용됐고, 질문마다 20회씩 실행해 최종적으로 반환된 값이 정답과 얼마나 일치하는지를 비교했다.

질문 수가 11개뿐이기 때문에 이 숫자를 Text-to-SQL의 절대적인 정확도로 볼 수는 없다. 다만 같은 데이터와 질문을 놓고 구조를 바꿨을 때 결과가 어떻게 달라지는지는 꽤 흥미롭다.

결론부터 말하면 Text-to-SQL은 확실히 좋아졌다.

그런데 Semantic Layer가 필요 없어지지는 않았다.

오히려 둘이 해결하는 문제가 조금 더 명확하게 나뉘기 시작했다.

---

## 2. 둘의 차이는 SQL을 누가 책임지느냐에 있다

Text-to-SQL에서는 LLM이 SQL을 직접 만든다.

사용자가

> 지난달 매출이 가장 높은 매장 5곳을 알려줘

라고 질문했다면 LLM은 스키마를 보고 직접 판단해야 한다.

- 어떤 테이블이 주문 테이블인지
- 어떤 컬럼이 매출인지
- 주문과 매장을 어떻게 JOIN해야 하는지
- 취소 건을 제외해야 하는지
- 날짜 기준을 주문일로 볼지 결제일로 볼지
- 어떤 기준으로 정렬하고 몇 건을 가져올지

질문은 간단하지만 실제 SQL을 만들기 위해 결정해야 할 것은 꽤 많다.

예를 들어 아래 SQL은 문법적으로 아무 문제가 없다.

```sql
SELECT SUM(order_amount)
FROM orders
JOIN customers USING (customer_id)
```

하지만 회사에서 정의한 매출이 `취소 건과 환불 건을 제외한 결제금액`이라면 이 쿼리는 틀렸다.

문제는 쿼리가 정상적으로 실행된다는 점이다.

결과가 `12,381,292,100`처럼 그럴듯한 숫자로 나오면 사용자는 이 값이 잘못됐다는 사실을 알기 어렵다.

Semantic Layer는 여기서 LLM이 결정해야 하는 범위를 줄인다.

예를 들어 `revenue`라는 지표를 미리 다음과 같이 정의해둘 수 있다.

```yaml
metrics:
  - name: revenue
    description: 취소 건을 제외한 실매출
    type: simple
    type_params:
      measure: order_amount
    filter: "{{ Dimension('order__status') }} != 'CANCELLED'"
```

이제 LLM이 모든 SQL을 직접 만들 필요가 없다.

질문에서 필요한 것이

- metric: `revenue`
- dimension: `store`
- time: `last_month`
- limit: `5`

라는 것까지만 해석하면 실제 JOIN과 집계 SQL은 MetricFlow가 만든다.

이 차이가 생각보다 크다.

Text-to-SQL에서는 LLM이 **데이터 모델과 비즈니스 로직을 매번 다시 해석**하지만, Semantic Layer에서는 이미 합의된 정의를 **선택해서 사용**한다.

모델링된 데이터를 기준으로 한 dbt Labs의 실험에서도 차이가 나타났다.

| 모델 | Text-to-SQL | Semantic Layer |
| --- | ---: | ---: |
| Claude Sonnet 4.6 | 90.0% | 98.2% |
| GPT-5.3 Codex | 84.1% | 100.0% |

Text-to-SQL도 상당히 높은 수준까지 올라왔지만, 미리 정의된 지표를 사용하는 Semantic Layer가 좀 더 안정적이었다.

---

## 3. 실무에서는 평균 정확도보다 '어떻게 틀리는지'가 더 중요하다

개인적으로 이 벤치마크에서 가장 눈에 들어온 부분은 정확도 차이보다 실패 방식이었다.

Semantic Layer에서 정의하지 않은 관계가 필요한 질문이 들어오면 어떻게 될까.

예를 들어 계약에서 고객, 기업, 지역, 상품까지 여러 엔티티를 연결해야만 답할 수 있는데 Semantic Model에 그 관계가 정의되어 있지 않다고 해보자.

Semantic Layer는 이런 질문에 답하지 못한다.

불편하긴 하지만 적어도 **현재 모델로는 답할 수 없다는 사실이 드러난다.**

Text-to-SQL은 조금 다르다.

LLM은 가지고 있는 스키마를 이용해 어떻게든 SQL을 만들어볼 수 있다.

운이 좋으면 Semantic Layer가 아직 표현하지 못하는 질문까지 해결한다. 반대로 JOIN 경로 하나를 잘못 잡으면 행이 중복되어 금액이 두 배로 늘어날 수도 있다.

더 어려운 점은 이 SQL 역시 정상적으로 실행된다는 것이다.

```text
잘못된 JOIN
    ↓
SQL 실행 성공
    ↓
그럴듯한 숫자 반환
```

시스템 입장에서는 성공이고 사용자 입장에서도 특별한 오류 메시지가 없다.

데이터 제품에서는 이 차이가 중요하다.

대시보드나 전사 KPI처럼 많은 사람이 같은 숫자를 보는 영역에서는 답을 못 하는 것보다 틀린 값을 정상 결과처럼 보여주는 것이 더 위험할 수 있다.

데이터에 대한 신뢰는 평균 정확도가 95%인지 97%인지보다, 한 번이라도 심각하게 틀린 숫자를 보여줬을 때 더 크게 흔들린다.

Semantic Layer의 가치는 정확도를 몇 퍼센트 올리는 것만이 아니라 **시스템이 책임질 수 있는 데이터의 범위를 명확하게 만드는 것**에 있다.

---

## 4. 그렇다고 모든 질문을 Semantic Layer로 만들 필요도 없다

여기까지만 보면 모든 데이터를 Semantic Layer에 넣으면 될 것 같지만, 실제로는 그렇지 않다.

이번 벤치마크에서 Text-to-SQL이 가장 크게 달라진 부분도 이 지점이다.

2023년과 2026년 전체 질문 기준 결과를 비교하면 다음과 같다.

| 방식 | 2023 | 2026 |
| --- | ---: | ---: |
| Text-to-SQL | 32.7% | 64.5% |
| 최소 Semantic Layer | 60.5% | 72.7% |

Text-to-SQL의 정확도가 두 배 가까이 올라왔다.

특히 여러 엔티티를 따라가야 하는 복잡한 질문에서는 최소 구성의 Semantic Layer가 답하지 못하는데 Text-to-SQL이 답을 찾아낸 경우도 있었다.

이건 두 방식의 목적이 다르다는 의미에 가깝다.

Semantic Layer는 이미 정의된 영역에서는 강하다.

매출, 활성 사용자, 주문 건수, 객단가처럼 조직에서 기준이 명확해야 하는 지표를 조회할 때 매번 새로운 SQL을 만들 이유가 없다.

반대로 분석 업무에는 미리 예상하기 어려운 질문도 많다.

> 특정 고객군에서 최근 환불이 증가한 이유는 무엇인가?

> 이 상품을 구매한 고객이 이후 어떤 상품을 많이 구매했는가?

> 지난달부터 발생한 이상 패턴과 관련된 속성을 찾아달라.

이런 질문을 모두 미리 metric으로 정의하는 것은 현실적이지 않다.

그래서 앞으로의 구조는 `Semantic Layer vs Text-to-SQL`보다 다음에 가까워 보인다.

- **정확성이 우선인 질문은 Semantic Layer**
- **탐색이 필요한 질문은 Text-to-SQL**

그리고 그 위에서 Agent가 질문의 성격에 따라 경로를 선택한다.

둘 중 하나를 없애는 구조가 아니라 잘하는 일을 나누는 구조다.

---

## 5. 두 방식 모두 결국 데이터 모델링의 영향을 받는다

이번 벤치마크에서 가장 흥미로웠던 결과는 따로 있었다.

최소 구성 Semantic Layer가 일부 질문에 답하지 못한 이유를 분석해보니 원본 데이터가 3NF 형태로 정규화되어 있었고, 하나의 질문에 답하기 위해 너무 많은 엔티티를 거쳐야 했다.

대략 이런 구조다.

```text
order
 └─ customer_order
     └─ customer
         └─ customer_company
             └─ company
                 └─ region
```

dbt Labs는 모든 질문을 Semantic Layer에서 처리할 수 있도록 최소한의 dbt 모델을 추가하도록 했고, 그 결과 모델 3개가 만들어졌다.

그 뒤에는 Semantic Layer가 11개 질문을 모두 처리할 수 있었다.

여기까지는 예상할 수 있는 결과다.

재미있는 부분은 **같은 모델링된 데이터를 사용한 Text-to-SQL의 정확도도 같이 올라갔다는 것**이다.

기존 64.5% 수준이었던 결과가 모델에 따라 84.1~90.0%까지 올라갔다.

좋은 데이터 모델링이 Semantic Layer만을 위한 작업이 아니라는 뜻이다.

LLM도 결국 사람이 만든 데이터 구조를 읽는다.

원천 테이블과 코드성 컬럼이 그대로 노출되어 있는 환경과 분석 목적에 맞게 Fact, Dimension이 정리되고 컬럼 설명까지 붙어 있는 환경은 난이도 자체가 다르다.

예를 들어 아래와 같은 스키마보다

```text
ORD_MST
  A01
  A02
  C_CD
  C_ST
  REG_DT
```

다음 구조가 LLM에게도 훨씬 이해하기 쉽다.

```yaml
models:
  - name: fct_orders
    description: 고객 주문 단위 Fact 테이블

    columns:
      - name: order_amount
        description: 취소 반영 전 주문금액

      - name: net_order_amount
        description: 취소와 할인을 반영한 실매출
```

AI가 좋아지면 데이터 모델링의 중요성이 줄어들 것 같지만 실제로는 반대에 가깝다.

모델이 이해할 수 있는 context가 좋아질수록 AI가 할 수 있는 일도 같이 늘어난다.

기존에는 좋은 모델링이 사람과 BI 도구를 위한 것이었다면, 이제는 Agent가 데이터를 이해하기 위한 기반이 하나 더 추가된 셈이다.

---

## 6. 좋은 모델을 쓰는 것보다 context를 줄이는 것이 먼저일 수 있다

dbt Labs의 실험에서는 모델 선택에 관한 결과도 재미있었다.

Semantic Layer가 이미 잘 구성된 질문에서는 모델이나 reasoning effort를 바꿔도 결과 차이가 크지 않았다.

이유는 Semantic Layer를 사용할 때 LLM이 하는 일이 상대적으로 제한적이기 때문이다.

자연어 질문을 보고 올바른 metric과 dimension을 선택했다면 이후 계산은 MetricFlow가 담당한다.

반면 Text-to-SQL에서는 모델이 테이블 선택부터 JOIN, 필터, 집계까지 직접 결정하기 때문에 모델 성능에 영향을 더 많이 받았다.

그렇다고 Data Agent 전체에서 모델 성능이 중요하지 않다는 의미는 아니다.

실제 Agent는 지표 하나를 선택하는 것보다 훨씬 많은 일을 한다.

- 질문 의도 파악
- Semantic Layer와 Text-to-SQL 중 경로 선택
- 기간과 필터 해석
- 필요한 데이터 추가 조회
- 결과 간 비교
- 순위 및 변화량 계산
- 원인 후보 탐색
- 사용자에게 전달할 형태로 해석

Semantic Layer가 잘 정의되어 있다면 **지표를 조회하는 구간에는 굳이 가장 비싼 모델을 사용할 필요가 없을 수 있다.**

반대로 탐색과 해석이 필요한 구간에는 모델의 reasoning 능력이 다시 중요해진다.

Agent를 하나의 거대한 LLM 호출로 만들기보다 단계별로 필요한 지능 수준을 나눠볼 수 있다는 이야기이기도 하다.

---

## 7. Text-to-SQL에서 더 어려운 문제는 스키마가 커진 다음부터 시작된다

이번 벤치마크를 볼 때 한 가지 주의할 점이 있다.

Text-to-SQL 실험에서는 전체 스키마를 LLM context에 넣었다.

테이블이 수십 개 정도인 환경에서는 충분히 가능한 방법이다.

하지만 실제 기업 DW에서는 상황이 다르다.

테이블이 수천 개이고 컬럼이 수만 개라면 전체 스키마를 매번 프롬프트에 넣을 수 없다.

설령 context window에 들어간다고 해도 전부 넣는 것이 정확도에 도움이 된다고 보기도 어렵다.

결국 Text-to-SQL 앞에는 한 단계가 더 필요해진다.

```text
사용자 질문
    ↓
관련 도메인 탐색
    ↓
관련 테이블 / 컬럼 / Metric 탐색
    ↓
필요한 Metadata 구성
    ↓
Text-to-SQL
```

여기서 필요한 것이 Catalog, Metadata, Lineage, Semantic Model 같은 정보다.

결국 Text-to-SQL의 성능 문제도 어느 시점부터는 SQL 생성 모델 자체보다 **적절한 context를 얼마나 잘 찾아서 제공하느냐**의 문제로 넘어간다.

그래서 Semantic Layer와 Metadata 관리가 AI 이전보다 오히려 더 중요해질 수 있다.

---

## 8. Data Agent에서는 Semantic Layer가 하나의 Tool이 된다

이 관점에서 보면 Semantic Layer의 위치도 조금 달라진다.

기존에는 주로 Tableau, Power BI 같은 BI 도구에서 같은 지표를 사용하기 위한 공통 계층으로 생각했다.

Data Agent에서는 Semantic Layer가 **Agent가 신뢰하고 호출할 수 있는 계산 인터페이스**가 된다.

예를 들어 사용자가

> 지난달 매출이 왜 감소했어?

라고 물었다고 해보자.

Agent가 처음부터 전체 SQL을 만드는 것보다 먼저 Semantic Layer에서 기준이 되는 매출을 가져올 수 있다.

```text
사용자 질문
      ↓
  Intent Router
      ↓
┌───────────────┬────────────────┐
│               │                │
Metric 조회      추가 탐색 필요
│               │
Semantic Layer  Text-to-SQL
│               │
└───────────────┴────────────────┘
        ↓
   Analysis Agent
        ↓
    원인 해석
```

Semantic Layer에서 지난달 매출과 전월 매출을 신뢰할 수 있는 기준으로 가져오고, 그 차이가 왜 발생했는지를 찾는 과정에서 Text-to-SQL을 사용할 수 있다.

여기서 중요한 것은 **기준이 되는 숫자와 탐색 과정에서 얻은 숫자의 성격을 구분하는 것**이다.

예를 들어

> 지난달 매출은 123억이고 전월 대비 11.2% 감소했습니다.

까지는 Semantic Layer에서 가져온 확정된 지표일 수 있다.

그다음

> 감소분의 상당 부분이 온라인 B2B와 A 상품군에서 발생했고, A 상품군의 감소 폭은 최근 변동 범위를 벗어났습니다.

와 같은 내용은 Agent가 데이터를 추가로 탐색하고 해석한 결과다.

둘을 같은 방식으로 만들 필요가 없다.

오히려 **어디까지 시스템이 보장하는 숫자인지 경계를 명확히 두는 것**이 중요하다.

---

## 9. Semantic Layer를 만들 것인가보다 중요한 질문

Text-to-SQL의 발전을 보면 Semantic Layer가 없어질 것처럼 보이기도 한다.

하지만 이번 벤치마크를 보면 오히려 역할이 조금 더 분명해진다.

Semantic Layer가 모든 질문을 대신할 필요는 없다.

Text-to-SQL 역시 모든 숫자를 책임질 필요는 없다.

조직에서 공통으로 사용하는 KPI나 잘못되면 안 되는 숫자는 사람이 정의하고 테스트한 규칙 안에서 계산한다.

반대로 미리 정의할 수 없는 탐색은 LLM에게 더 많은 자유를 줄 수 있다.

그리고 탐색 과정에서 반복적으로 등장하고 중요도가 높아진 로직은 다시 모델과 Metric으로 끌어올릴 수 있다.

```text
Text-to-SQL에서 반복되는 질문
        ↓
검증된 분석 로직
        ↓
dbt Model / Metric으로 승격
        ↓
Semantic Layer의 신뢰 영역 확대
```

이렇게 보면 답하지 못한 질문도 실패라기보다 다음 모델링 대상을 알려주는 피드백이 된다.

그래서 지금 더 중요한 질문은

> Semantic Layer를 만들 것인가?

보다는

> 어디까지를 deterministic하게 고정하고, 어디부터 AI의 exploration과 inference에 맡길 것인가?

에 가깝다고 생각한다.

LLM이 SQL을 더 잘 만든다고 해서 데이터의 정의와 관계까지 매번 LLM에게 새로 판단하게 할 이유는 없다.

반대로 모든 분석 가능성을 사전에 Semantic Layer로 정의하려는 것도 현실적이지 않다.

그 사이의 경계를 잘 설계하는 것이 Data Agent를 만드는 데 더 중요한 문제가 되고 있다.

그리고 그 경계를 안정적으로 만들기 위해 필요한 것은 결국 익숙한 것들이다.

잘 설계된 Warehouse 모델, 명확한 Metric 정의, Metadata, Test, Data Contract, 그리고 도메인을 알고 있는 사람이다.

AI가 이 기반을 대신한다기보다, 기반이 잘 갖춰져 있을수록 AI가 활용할 수 있는 범위가 넓어진다고 보는 편이 맞다.

---

## 참고

- [Semantic Layer vs. Text-to-SQL: 2026 Benchmark Update](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026), dbt Developer Blog, 2026-04-07
