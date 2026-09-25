---
title: "[Datamates] dbt 모델에 컬럼 레벨 리니지 구축하기"
excerpt: "dbt 산출물과 카탈로그 정보를 SQLGlot으로 분석해 컬럼 간 의존 관계를 계산하고 PostgreSQL에 메타데이터로 저장한 과정을 정리한다."

categories:
  - Project

tags:
  - Datamates
  - Data
  - dbt
  - Column Lineage
  - SQLGlot
  - PostgreSQL
  - Metadata

permalink: /data/column-lineage-build/

toc: true
toc_sticky: true

date: 2026-08-19
last_modified_at: 2026-08-27
series: "데이터 플랫폼 구축 프로젝트"
series_order: 4
---

## 테이블 계보에서 컬럼 계보로

Data Mates에는 dbt의 `manifest.json`을 기반으로 모델 간 의존 관계를 보여 주는 테이블 레벨 리니지가 있었다. `ref()`를 따라가면 어떤 모델이 어떤 모델을 참조하는지는 알 수 있었지만, 그 안의 컬럼이 어디에서 왔는지는 알 수 없었다.

예를 들어 마트의 `signal_state`가 어떤 원천 컬럼에서 만들어졌는지, 스테이징 모델의 특정 컬럼을 수정했을 때 어떤 하류 컬럼이 영향을 받는지를 확인하려면 결국 모델 SQL을 직접 따라가야 했다. 모델이 여러 단계의 CTE와 조인으로 이어지면 사람이 추적하기도 어려워진다.

```text
기존
raw_orders ──▶ stg_orders ──▶ mart_orders

알 수 있는 것   : 어떤 모델이 어떤 모델을 참조하는가
알 수 없는 것   : mart_orders.amount 가 어느 컬럼에서 만들어졌는가
```

그래서 컬럼 단위 관계를 별도의 기능이 아니라 **플랫폼이 관리하는 메타데이터**로 구축하기로 했다. 목표는 단순히 화면에 선을 하나 더 그리는 것이 아니라, 한 번 계산한 컬럼 의존 관계를 저장하고 여러 화면에서 재사용할 수 있게 만드는 것이었다.

- **출처 추적** — 선택한 컬럼이 어떤 상류 컬럼에서 만들어졌는지 역방향으로 확인한다.
- **영향 범위** — 컬럼 변경 시 어떤 하류 모델과 컬럼까지 영향을 받을 수 있는지 확인한다.
- **공통 메타데이터** — 계보 결과를 저장해 모델, 마트, 품질 정보와 같은 식별자로 결합한다.

#### 구축 대상

본문의 모델명과 컬럼명은 예시로 바꿨다. 실제 테스트 대상은 모델 13개, 모델·원천·seed를 포함한 노드 20개, 컬럼 452개였고 최종적으로 컬럼 간 의존 관계 676개를 구축했다.

## 계보 계산에 필요한 입력 모으기

컬럼 리니지는 SQL만 파싱한다고 완성되지 않는다. SQL 안의 `select *`를 실제 컬럼 목록으로 풀고, `ref()`가 가리키는 관계를 실제 모델과 연결하려면 dbt가 이미 알고 있는 메타데이터를 함께 사용해야 한다.

| 입력 | 사용 목적 |
| --- | --- |
| **manifest.json** | 모델·source·seed 식별자, 모델 간 의존 관계, 선언된 컬럼 정보 |
| **target/compiled/** | Jinja와 `ref()`가 해소된 실제 분석 대상 SQL |
| **models/*.sql** | compiled SQL이 없을 때 사용하는 폴백 SQL |
| **catalog.json** | relation별 실제 컬럼과 데이터 타입을 SQLGlot schema로 구성 |
| **플랫폼 모델 메타데이터** | 모델 ID를 기준으로 저장 결과를 Data Mates의 모델·마트 정보와 연결 |

분석 SQL은 가능하면 dbt가 만들어 둔 compiled SQL을 우선 사용했다. 원본 모델 SQL에는 Jinja, `ref()`, `source()`, `is_incremental()` 같은 dbt 문법이 남아 있어 SQL 파서가 그대로 해석하기 어렵기 때문이다.

```text
dbt project
├─ manifest.json       ─┐
├─ target/compiled/*.sql ├─▶ Lineage Input
├─ models/*.sql          │
└─ catalog.json        ───┘
                         │
                         ▼
                relation / schema / SQL
```

### 2.1 SQL dialect 고정

Data Mates의 모델 SQL은 DuckDB 문법을 기준으로 실행하므로 SQLGlot에도 `duckdb` dialect를 명시했다. 같은 SQL이라도 DB별 확장 문법에 따라 AST가 달라질 수 있기 때문에 계보를 계산하는 시점부터 실행 엔진과 같은 문법 규칙을 사용한다.

```python
SQL_DIALECT = "duckdb"

lineage = sg_lineage(
    None,
    compiled_sql,
    schema=schema,
    dialect=SQL_DIALECT,
)
```

## SQLGlot으로 컬럼 의존 관계 계산하기

입력을 준비한 뒤 각 모델의 compiled SQL을 SQLGlot으로 파싱한다. SQLGlot은 SQL을 AST로 변환하고, 출력 컬럼이 어떤 테이블과 컬럼 표현식에 의존하는지 추적한다. 이 과정에서 단순 복사뿐 아니라 CTE, 조인, `CASE`, `CAST`, 함수, 산술 연산처럼 여러 입력이 하나의 출력 컬럼을 만드는 관계도 함께 얻을 수 있다.

```sql
SELECT
    category_code,
    price * quantity AS amount,
    CASE WHEN price > 100 THEN 'HIGH' ELSE 'NORMAL' END AS price_band
FROM stg_orders;
```

위와 같은 SQL을 분석하면 결과를 화면용 그래프로 바로 만들지 않고, 먼저 아래처럼 컬럼 간의 최소 의존 관계로 정규화한다.

```text
stg_orders.category_code ─────────────▶ mart_orders.category_code

stg_orders.price ───────┐
                        ├─────────▶ mart_orders.amount
stg_orders.quantity ────┘

stg_orders.price ─────────────────▶ mart_orders.price_band
```

`amount`처럼 여러 입력 컬럼이 하나의 출력 컬럼에 기여하면 source별로 간선을 각각 저장한다. 원본 표현식도 함께 남겨 두면 단순 연결뿐 아니라 어떤 계산을 거쳐 만들어졌는지도 확인할 수 있다.

### 3.1 모델 ID 기준으로 관계 정규화

SQLGlot이 반환한 relation 이름은 dbt manifest의 모델·source·seed와 대조해 Data Mates의 모델 ID로 정규화한다. 물리 테이블명만 저장하면 alias나 schema가 바뀔 때 다른 메타데이터와 연결이 흔들릴 수 있기 때문이다.

### 3.2 연결할 수 없는 컬럼도 상태로 남기기

상수 컬럼이나 `now()`처럼 실제 상류 컬럼이 없는 경우와, SQL을 해석했지만 컬럼 출처를 확인하지 못한 경우는 의미가 다르다. 둘을 모두 저장 대상에서 빼면 화면에서는 똑같이 "상류 없음"으로 보이므로, 확인하지 못한 관계는 `resolved = false`로 별도 상태를 남겼다.

## 컬럼 계보를 메타데이터로 저장하기

계산된 계보는 일회성 API 응답으로 끝내지 않고 PostgreSQL에 저장했다. 별도의 node 테이블을 새로 만들기보다, 이미 플랫폼이 관리하는 모델 ID를 재사용하고 **모델별 계산 상태**와 **컬럼 간 의존 관계**만 추가했다.

#### lineage_build

모델별로 어떤 입력으로 언제 계보를 계산했는지 기록한다.

- `model_id`
- `sql_hash` , `schema_hash` , `lineage_hash`
- `out_columns` , `ref_relations`
- `dialect` , `sqlglot_version`
- `status` , `error_message` , `is_active`

#### column_lineage_edge

실제 컬럼 간 의존 사실을 간선 단위로 저장한다.

- `build_id` , `model_id`
- `source_relation` , `source_column`
- `target_relation` , `target_column`
- `expression`
- `resolved`

```text
lineage_build                     column_lineage_edge
──────────────                    ─────────────────────
id (PK)              1 ───── N   build_id (FK)
model_id                          source_relation
lineage_hash                      source_column
out_columns                       target_relation
ref_relations                     target_column
status                            expression
is_active                         resolved
```

### 4.1 계보 사실과 화면 표현 분리

저장 대상은 **어느 컬럼이 어느 컬럼에 의존하는가**라는 사실로 한정했다. `isMart`, `group`, `label` 같은 값은 컬럼 의존 관계 자체가 아니라 화면 표현을 위한 정보이므로 계보 테이블에는 넣지 않았다.

| 저장 | 조회 시 결합 |
| --- | --- |
| source/target relation·column | 모델명·라벨 |
| expression | 마트 지정 여부 |
| resolved 상태 | 그룹·화면 위치 |
| build 상태·버전 | 기타 최신 Catalog 메타데이터 |

이렇게 저장 구조를 분리해 두면 같은 컬럼 계보를 모델 상세, 영향도 분석, 품질 화면 등에서 재사용할 수 있고, 마트 지정처럼 표현 정보만 바뀐 경우에는 계보를 다시 계산할 필요가 없다.

## 저장한 계보를 조회 화면으로 조립하기

조회할 때는 활성 상태의 `lineage_build`와 그 빌드에 속한 `column_lineage_edge`를 읽는다. 여기에 최신 모델·카탈로그·마트 메타데이터를 결합해 UI가 사용할 노드와 간선으로 변환한다.

```text
GET /lineage
   │
   ├─ active lineage_build 조회
   ├─ column_lineage_edge 조회
   ├─ model / catalog / mart metadata 결합
   │
   └─▶ nodes + columnEdges + transforms
             │
             ▼
        Data Mates Lineage UI
```

사용자는 모델 노드에서 컬럼을 펼친 뒤 특정 컬럼의 상류·하류 연결을 확인할 수 있다. 저장소에는 직접 연결된 컬럼 간선만 보관하므로, 여러 단계를 따라가는 영향도 조회가 필요하면 이 간선을 그래프처럼 순회하면 된다.

```sql
SELECT
    e.source_relation,
    e.source_column,
    e.target_relation,
    e.target_column,
    e.expression,
    e.resolved
FROM column_lineage_edge e
JOIN lineage_build b
  ON b.id = e.build_id
 AND b.is_active
WHERE e.target_relation = :model_id;
```

### 5.1 계산과 조회는 역할만 분리

컬럼 계보를 메타데이터로 저장하면서 자연스럽게 계산과 조회의 역할도 분리했다. SQLGlot은 계보를 만들거나 갱신할 때만 사용하고, 일반 조회는 저장된 결과를 읽는다. 이 글에서 중요한 포인트는 성능 최적화 자체보다 **계보를 계산 결과가 아닌 조회 가능한 플랫폼 데이터로 만들었다는 것**이다.

#### 조회 결과

저장된 컬럼 간선 조회는 평균 29.0ms, 실제 HTTP 응답은 36~56ms 수준이었다. 조회 중에는 SQLGlot 계산이 발생하지 않는다.

## 바뀐 모델의 계보만 갱신하기

컬럼 계보를 저장하기 시작하면 다음 문제는 갱신 시점이다. 모든 조회마다 계산할 필요는 없지만, SQL이나 상류 스키마가 바뀌었는데 이전 계보를 계속 보여줘서도 안 된다. 그래서 모델별로 계보 결과에 영향을 주는 입력을 해시로 관리했다.

```text
SQL_HASH      = sha256( 계보 계산에 사용한 SQL 본문 )
SCHEMA_HASH   = sha256( 실제로 참조하는 상류 relation의 컬럼 목록 )
LINEAGE_HASH  = sha256( SQL_HASH + SCHEMA_HASH + dialect + sqlglot 버전 )
```

```text
모델 SQL / 상류 컬럼 / dialect / parser version
                     │
                     ▼
                LINEAGE_HASH
                     │
          ┌──────────┴──────────┐
          │                     │
      이전과 같음            이전과 다름
          │                     │
        SKIP                  REBUILD
                                │
                                ▼
                      새 lineage_build + edge
```

파일 수정 시간은 사용하지 않았다. dbt가 compiled 파일을 다시 써도 내용이 같다면 계보는 같기 때문이다. SQL 본문이 같고 참조하는 상류 컬럼 집합도 같으면 이전 빌드에서 저장한 `out_columns`와 `ref_relations`를 재사용해 파싱 자체를 건너뛴다.

### 6.1 하류 재계산 범위 줄이기

`SCHEMA_HASH`에는 전체 카탈로그가 아니라 해당 모델이 실제로 참조하는 상류 relation의 출력 컬럼만 넣었다. 상류 모델의 SQL이 바뀌더라도 출력 컬럼 구성이 그대로라면 하류 모델의 계보 입력은 변하지 않으므로 다시 계산하지 않는다.

```text
A ─▶ B ─▶ C

A SQL 변경
├─ A 출력 컬럼 그대로  → B의 SCHEMA_HASH 동일 → B SKIP
└─ A 출력 컬럼 변경    → B의 SCHEMA_HASH 변경 → B REBUILD
```

내용 변화가 없는 상태에서 증분 빌드를 실행하면 모든 모델이 SKIP되어 약 17.5ms에 끝났다. 전체 모델을 다시 계산해야 할 때는 약 3.1초가 걸렸다.

## 틀린 계보를 남기지 않기 위한 기준

SQL 파서 기반 컬럼 리니지는 모든 SQL을 완벽하게 해석할 수 없다. 따라서 "계보를 만들었다"보다 중요한 것은 **확실히 알 수 없는 관계를 어떻게 표현할 것인가**였다. 확인하지 못한 관계를 임의로 연결하지 않고 상태로 남기는 쪽을 선택했다.

| 상태 | 의미 | 처리 |
| --- | --- | --- |
| **resolved** | 모든 출력 컬럼의 계보를 확인 | 활성 계보로 사용 |
| **partial** | 일부 컬럼만 확인 | 확인된 간선은 사용하고 나머지는 확인 불가 표시 |
| **unresolved** | 모델의 컬럼 계보를 확인하지 못함 | 상태와 사유를 명시 |
| **failed** | 계산 과정 자체가 예외로 종료 | 실패 이력만 남기고 이전 활성 계보 유지 |

### 7.1 새 결과가 완성된 뒤 교체

새로운 계보는 모든 간선을 저장한 다음 활성 상태로 전환한다. 빌드 행 생성, 간선 저장, 기존 활성 해제, 새 빌드 활성화를 하나의 트랜잭션으로 처리해 중간 상태가 조회되지 않게 했다.

```text
BEGIN
 ├─ 새 lineage_build 생성   (is_active = FALSE)
 ├─ column_lineage_edge 저장
 ├─ 기존 active build 해제
 └─ 새 build 활성화
COMMIT
```

### 7.2 남은 한계

동적 SQL, UDF 내부 로직, 일부 PIVOT과 재귀 CTE는 SQLGlot만으로 컬럼 단위 관계를 정확히 풀기 어렵다. dbt compiled SQL이 없고 복잡한 Jinja가 원본 SQL에 남아 있는 경우도 분석이 제한된다. 이런 경우에는 추정한 연결을 만들지 않고 `partial` 또는 `unresolved` 상태로 남긴다.

### 7.3 구축 결과

- dbt의 모델 의존 관계에서 한 단계 더 내려가 **컬럼 452개와 컬럼 간선 676개** 를 메타데이터로 구축했다.
- manifest, compiled SQL, catalog를 결합해 SQLGlot이 실제 relation과 schema를 알고 컬럼 의존 관계를 계산하도록 했다.
- 계산된 관계는 `lineage_build` 와 `column_lineage_edge` 에 저장하고, 모델 ID를 기준으로 기존 플랫폼 메타데이터와 연결했다.
- 조회 API는 저장된 간선을 모델·카탈로그·마트 정보와 조합해 컬럼 그래프를 구성한다.
- SQL 내용과 상류 컬럼 구성이 바뀐 모델만 계보를 다시 계산해 저장 결과가 오래되거나 불필요하게 전량 재계산되는 문제를 줄였다.
- 확인하지 못한 계보와 계산 실패를 별도 상태로 관리해 "상류 없음"과 "알 수 없음"을 구분했다.

{% include pjt-series.html current=4 %}
