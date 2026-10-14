---
title: "[dbt] Semantic Layer 지표 정의 구조와 마트 테이블 방식 비교"
excerpt: "dbt v1.12 최신 YAML 스펙 기준으로 Semantic Layer의 구성 요소와 entity·dimension·metric 정의 구조를 설명하고, 같은 질문에 대해 마트 테이블 방식과 비교해 SQL 생성 주체, 테이블 수, 정의 변경 범위의 차이를 정리한다."
nav_section: data
nav_topic: modeling

categories:
  - Data
tags:
  - Data
  - dbt
  - SemanticLayer
  - MetricFlow
  - 데이터모델링

permalink: /data/dbt-semantic-layer-metricflow/

toc: true
toc_sticky: true

date: 2026-10-13
last_modified_at: 2026-10-13
---

<style>
/* tech-log-html viz kit v1 — 블로그(Minimal Mistakes) 본문 안에서만 동작하도록 모든 선택자를 .tlv 아래로 스코프한다 */
.tlv{--tlv-ink:#000;--tlv-body:#101010;--tlv-sub:#393939;--tlv-mute:#6b6b6b;--tlv-line:#e6e6e6;--tlv-line-2:#bfbfbf;--tlv-soft:#f8f8f8;--tlv-accent:#ff6c02;--tlv-accent-2:#ff984e;--tlv-accent-line:rgba(255,108,2,.3);--tlv-accent-bg:rgba(255,108,2,.07);--tlv-accent-text:#c24e00;--tlv-good:#1a7f37;--tlv-good-bg:rgba(26,127,55,.08);--tlv-bad:#c0272d;--tlv-bad-bg:rgba(192,39,45,.07);--tlv-mono:"Fira Mono",Pretendard,Monaco,Consolas,"Lucida Console",monospace;display:block;margin:1.75em 0;color:var(--tlv-body);line-height:1.6}
figure.tlv{display:block;padding:0}
.tlv *,.tlv *::before,.tlv *::after{box-sizing:border-box}
.tlv p{margin:.4em 0;font-size:.9em}
.tlv ul,.tlv ol{margin:0;padding:0;list-style:none}
.tlv li{margin:0}
.tlv button{font:inherit;cursor:pointer}
.tlv button:focus-visible{outline:2px solid var(--tlv-accent);outline-offset:2px}
.tlv div.highlighter-rouge{margin:0}
.tlv-cap{display:block;margin-top:.7em;font-size:.78em;line-height:1.5;color:var(--tlv-sub)}
.tlv-cap b{color:var(--tlv-ink);font-weight:600;margin-right:.35em}
.tlv-box{border:1px solid var(--tlv-line);border-radius:4px;padding:1em 1.1em}
/* SVG */
.tlv-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.tlv-svg{display:block;width:100%;height:auto;color:var(--tlv-body);font-family:inherit;overflow:visible}
.tlv-scroll>.tlv-svg{min-width:var(--tlv-min,560px)}
.tlv-svg .t{font-size:13px;font-weight:600;fill:var(--tlv-ink)}
.tlv-svg .s{font-size:11.5px;fill:var(--tlv-sub)}
.tlv-svg .l{font-size:11px;font-family:var(--tlv-mono);fill:var(--tlv-mute)}
.tlv-svg .box{fill:#fff;stroke:var(--tlv-line-2);stroke-width:1}
.tlv-svg .soft{fill:var(--tlv-soft);stroke:var(--tlv-line);stroke-width:1}
.tlv-svg .accent{fill:var(--tlv-accent-bg);stroke:var(--tlv-accent);stroke-width:1.2}
.tlv-svg .good{fill:var(--tlv-good-bg);stroke:var(--tlv-good);stroke-width:1.2}
.tlv-svg .bad{fill:var(--tlv-bad-bg);stroke:var(--tlv-bad);stroke-width:1.2}
.tlv-svg .wire{fill:none;stroke:var(--tlv-mute);stroke-width:1.2}
.tlv-svg .wire-accent{fill:none;stroke:var(--tlv-accent);stroke-width:1.6}
.tlv-svg .dash{stroke-dasharray:4 3}
.tlv-svg .c-accent{fill:var(--tlv-accent-text)}
.tlv-svg .c-good{fill:var(--tlv-good)}
.tlv-svg .c-bad{fill:var(--tlv-bad)}
.tlv-svg .mk{fill:var(--tlv-mute)}
.tlv-svg .mk-accent{fill:var(--tlv-accent)}
.tlv-svg .bar{fill:var(--tlv-accent-2)}
.tlv-svg .bar-mute{fill:var(--tlv-line-2)}
/* chip · legend */
.tlv-chip{display:inline-block;padding:.05em .55em;border-radius:1000px;font-size:.72em;font-weight:600;line-height:1.7;background:var(--tlv-soft);color:var(--tlv-sub);border:1px solid var(--tlv-line)}
.tlv-chip.is-accent{background:var(--tlv-accent-bg);color:var(--tlv-accent-text);border-color:var(--tlv-accent-line)}
.tlv-chip.is-good{background:var(--tlv-good-bg);color:var(--tlv-good);border-color:transparent}
.tlv-chip.is-bad{background:var(--tlv-bad-bg);color:var(--tlv-bad);border-color:transparent}
.tlv-legend{display:flex;flex-wrap:wrap;gap:.3em 1.1em;font-size:.75em;color:var(--tlv-sub);margin-bottom:.6em}
.tlv-legend span::before{content:"";display:inline-block;width:.8em;height:.8em;border-radius:2px;margin-right:.4em;vertical-align:-.05em;background:var(--sw,var(--tlv-accent-2))}
/* stats */
.tlv-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px}
.tlv-stat{border:1px solid var(--tlv-line);border-radius:4px;padding:.8em .9em}
.tlv-stat .n{font-size:1.45em;font-weight:700;line-height:1.2;color:var(--tlv-ink);font-variant-numeric:tabular-nums}
.tlv-stat .n small{font-size:.55em;font-weight:600;margin-left:.15em;color:var(--tlv-sub)}
.tlv-stat .l{font-size:.75em;color:var(--tlv-sub);margin-top:.25em}
.tlv-stat .d{font-size:.72em;font-weight:600;margin-top:.2em}
.tlv-stat .d.is-good{color:var(--tlv-good)}.tlv-stat .d.is-bad{color:var(--tlv-bad)}
/* bars — 가로 막대 비교 */
.tlv-bars{display:grid;gap:.55em}
.tlv-bar-row{display:grid;grid-template-columns:minmax(0,34%) 1fr 3.6em;align-items:center;gap:.4em .8em;font-size:.8em}
.tlv-bar-row .k{color:var(--tlv-body);line-height:1.35}
.tlv-bar-row .v{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:var(--tlv-ink)}
.tlv-track{display:grid;gap:3px}
.tlv-track i{display:block;height:9px;border-radius:2px;background:var(--tlv-accent-2);width:var(--w,0%);min-width:2px}
.tlv-track i.is-mute{background:var(--tlv-line-2)}
.tlv-track i.is-good{background:var(--tlv-good)}
.tlv-track i.is-bad{background:var(--tlv-bad)}
/* compare — 2단 전후 비교 */
.tlv-compare{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tlv-col{min-width:0;border:1px solid var(--tlv-line);border-radius:4px;overflow:hidden}
.tlv-col>.hd{display:flex;align-items:center;gap:.5em;padding:.45em .8em;border-bottom:1px solid var(--tlv-line);font-size:.78em;font-weight:600;color:var(--tlv-ink);background:#fff}
.tlv-col>.bd{padding:.6em .8em;font-size:.9em}
.tlv-col>.bd.is-code{padding:0}
.tlv-col>.bd.is-code pre.highlight{margin:0;border-radius:0}
/* flow — HTML 파이프라인 */
.tlv-flow{display:flex;align-items:stretch;gap:0}
.tlv-node{flex:1 1 0;min-width:0;border:1px solid var(--tlv-line-2);border-radius:4px;padding:.65em .75em;background:#fff}
.tlv-node .nt{font-size:.8em;font-weight:600;color:var(--tlv-ink);line-height:1.35;word-break:keep-all}
.tlv-node .ns{font-size:.7em;color:var(--tlv-sub);line-height:1.45;margin-top:.25em;word-break:keep-all}
.tlv-node code{font-size:.95em}
.tlv-node.is-accent{border-color:var(--tlv-accent);background:var(--tlv-accent-bg)}
.tlv-node.is-good{border-color:var(--tlv-good);background:var(--tlv-good-bg)}
.tlv-node.is-bad{border-color:var(--tlv-bad);background:var(--tlv-bad-bg)}
.tlv-node.is-mute{border-style:dashed;color:var(--tlv-mute)}
.tlv-arrow{flex:0 0 1.9em;display:flex;align-items:center;justify-content:center;color:var(--tlv-mute);font-size:.85em;position:relative}
.tlv-arrow::before{content:"→"}
.tlv-arrow[data-label]::after{content:attr(data-label);position:absolute;top:calc(50% + .8em);font-size:.7em;white-space:nowrap;color:var(--tlv-mute)}
/* tabs */
.tlv-tablist{display:none;flex-wrap:wrap;gap:0;border-bottom:1px solid var(--tlv-line);margin-bottom:.8em}
.tlv-tabs.is-ready>.tlv-tablist{display:flex}
.tlv-tab{background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:.45em .9em;font-size:.8em;color:var(--tlv-sub);white-space:nowrap}
.tlv-tab[aria-selected="true"]{color:var(--tlv-ink);font-weight:600;border-bottom-color:var(--tlv-accent)}
.tlv-panel>.tlv-panel-title{font-size:.78em;font-weight:600;color:var(--tlv-sub);margin:.2em 0 .4em}
.tlv-tabs.is-ready .tlv-panel-title{display:none}
.tlv-tabs:not(.is-ready) .tlv-panel+.tlv-panel{margin-top:1em}
/* steps — 단계별 강조 도해 */
.tlv-steps-ctrl{display:none;align-items:center;flex-wrap:wrap;gap:.35em;margin-top:.8em}
.tlv-steps.is-ready .tlv-steps-ctrl{display:flex}
.tlv-steps.is-ready .tlv-step-list{display:none}
.tlv-step-btn{min-width:2em;height:2em;border:1px solid var(--tlv-line-2);border-radius:4px;background:#fff;font-size:.78em;color:var(--tlv-sub)}
.tlv-step-btn[aria-pressed="true"]{border-color:var(--tlv-accent);background:var(--tlv-accent-bg);color:var(--tlv-accent-text);font-weight:600}
.tlv-step-btn.is-all{padding:0 .7em}
.tlv-step-note{flex:1 1 100%;margin-top:.35em;font-size:.82em;color:var(--tlv-body);min-height:1.6em}
.tlv-step-list{counter-reset:s;margin-top:.8em !important}
.tlv-step-list li{counter-increment:s;font-size:.82em;padding-left:1.8em;position:relative;margin:.25em 0}
.tlv-step-list li::before{content:counter(s);position:absolute;left:0;top:.1em;width:1.35em;height:1.35em;border-radius:50%;background:var(--tlv-accent-bg);color:var(--tlv-accent-text);font-size:.85em;font-weight:600;display:flex;align-items:center;justify-content:center}
.tlv-steps [data-steps]{transition:opacity .25s}
.tlv-steps.is-ready.is-focus [data-steps]:not(.is-on){opacity:.18}
/* timeline */
.tlv-timeline li{position:relative;padding:0 0 .9em 1.4em;border-left:1px solid var(--tlv-line-2);margin-left:.35em}
.tlv-timeline li:last-child{border-left-color:transparent;padding-bottom:0}
.tlv-timeline li::before{content:"";position:absolute;left:-.36em;top:.45em;width:.7em;height:.7em;border-radius:50%;background:#fff;border:2px solid var(--tlv-line-2)}
.tlv-timeline li.is-accent::before{border-color:var(--tlv-accent);background:var(--tlv-accent)}
.tlv-timeline li.is-bad::before{border-color:var(--tlv-bad)}
.tlv-timeline li.is-good::before{border-color:var(--tlv-good)}
.tlv-timeline .when{display:block;font-size:.72em;font-family:var(--tlv-mono);color:var(--tlv-mute)}
.tlv-timeline .what{display:block;font-size:.86em;line-height:1.55}
/* term — 터미널 로그 */
.tlv.tlv-term{border-radius:4px;overflow:hidden;background:#1d1f21;color:#e6e6e6;font-family:var(--tlv-mono);font-size:.76em;line-height:1.65}
.tlv-term .bar{display:flex;align-items:center;gap:6px;padding:.5em .8em;background:#2a2c2f;color:#9a9a9a;font-size:.9em}
.tlv-term .bar i{width:10px;height:10px;border-radius:50%;background:#ff5f57}
.tlv-term .bar i:nth-child(2){background:#febc2e}.tlv-term .bar i:nth-child(3){background:#28c840;margin-right:.5em}
.tlv-term .body{padding:.8em 1em;overflow-x:auto;white-space:pre}
.tlv-term .ln{display:block;min-height:1.65em}
.tlv-term .ln.is-ok{color:#7ee2a0}.tlv-term .ln.is-err{color:#ff8b8b}.tlv-term .ln.is-dim{color:#8a8a8a}
.tlv-term .p{color:#ff984e}
.tlv-term.is-playing .ln{visibility:hidden}.tlv-term.is-playing .ln.is-shown{visibility:visible}
/* mobile */
@media (max-width:600px){
.tlv-compare{grid-template-columns:1fr}
.tlv-flow{flex-direction:column}
.tlv-arrow{flex-basis:1.6em}
.tlv-arrow::before{content:"↓"}
.tlv-arrow[data-label]::after{top:auto;left:calc(50% + 1em)}
.tlv-bar-row{grid-template-columns:1fr 3.4em}
.tlv-bar-row .k{grid-column:1/-1}
}
@media (prefers-reduced-motion:reduce){.tlv *{transition:none !important;animation:none !important}}
</style>

## 1. 개요

시맨틱 레이어(Semantic Layer)는 데이터의 물리적 구조와 비즈니스 의미를 분리하고 지표와 데이터 간 관계를 일관된 기준으로 정의하는 계층이다. 시맨틱 레이어를 통해 사용자는 복잡한 테이블 구조나 SQL을 직접 이해하지 않아도 공통으로 정의된 비즈니스 지표를 조회하고 활용할 수 있다.

dbt Semantic Layer는 이 계층을 dbt 프로젝트 안의 YAML로 정의하고 MetricFlow라는 엔진이 정의를 읽어 SQL을 만들어 데이터 플랫폼에서 실행하는 구조다. 이 글은 dbt v1.12 이상에서 쓰는 최신 YAML 스펙을 기준으로 구성 요소와 정의 단위를 정리하고 같은 질문을 마트 테이블로 답할 때와 비교한다.

본문의 테이블명과 컬럼명은 예시 값이다. 생성 SQL은 MetricFlow의 실제 출력이 아니라 조인과 집계 논리를 보여주기 위해 줄여 쓴 것이고, 실제 출력은 서브쿼리로 감싸져 더 길다. 공식 문서는 2026년 10월에 확인한 내용이다.

---

## 2. 구성 요소와 요청 경로

dbt Semantic Layer는 오픈소스 엔진과 유료 플랫폼 서비스로 나뉜다. MetricFlow는 Apache 2.0 라이선스의 오픈소스 엔진으로, YAML 정의를 읽어 SQL을 생성한다. 로컬 환경에 설치하면 정의 검증, SQL 생성, CLI 조회까지 할 수 있다. BI 도구나 외부 애플리케이션이 API로 지표를 조회하는 기능과 캐시, exports는 dbt 플랫폼의 Starter 이상 플랜에서 제공한다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 190" role="img" aria-label="지표 정의와 SQL 생성은 오픈소스 MetricFlow가 맡고, BI와 AI 도구가 쓰는 API와 캐시는 dbt 플랫폼에 있다">
  <defs><marker id="tlv-2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker><marker id="tlv-2-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk-accent" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <rect class="box" x="0" y="10" width="140" height="44" rx="4"/>
  <text class="t" x="14" y="28">BI 도구</text>
  <text class="s" x="14" y="45">Tableau · Sheets</text>
  <rect class="box" x="0" y="66" width="140" height="44" rx="4"/>
  <text class="t" x="14" y="84">AI 에이전트</text>
  <text class="s" x="14" y="101">MCP 서버 경유</text>
  <rect class="box" x="0" y="122" width="140" height="44" rx="4"/>
  <text class="t" x="14" y="140">CLI</text>
  <text class="l" x="14" y="157">mf / dbt sl</text>
  <rect class="soft dash" x="170" y="0" width="200" height="112" rx="6"/>
  <text class="s" x="184" y="18">dbt 플랫폼 · Starter 이상</text>
  <rect class="box" x="184" y="30" width="172" height="60" rx="4"/>
  <text class="t" x="198" y="52">Semantic Layer API</text>
  <text class="s" x="198" y="70">JDBC · GraphQL · 캐시</text>
  <rect class="accent" x="400" y="30" width="230" height="60" rx="4"/>
  <text class="t" x="414" y="52">MetricFlow</text>
  <text class="s" x="414" y="69">YAML 정의로 SQL 생성</text>
  <text class="l" x="414" y="84">Apache 2.0</text>
  <rect class="box" x="400" y="136" width="230" height="44" rx="4"/>
  <text class="t" x="414" y="154">데이터 플랫폼</text>
  <text class="s" x="414" y="171">생성된 SQL 실행</text>
  <path class="wire" d="M140 32 H182" marker-end="url(#tlv-2-arrow)"/>
  <path class="wire" d="M140 88 H182" marker-end="url(#tlv-2-arrow)"/>
  <path class="wire-accent" d="M356 50 H398" marker-end="url(#tlv-2-arrow-a)"/>
  <path class="wire" d="M140 144 H385 V78 H398" marker-end="url(#tlv-2-arrow)"/>
  <path class="wire-accent" d="M515 90 V134" marker-end="url(#tlv-2-arrow-a)"/>
  <text class="l" x="522" y="116">SQL</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> 정의와 SQL 생성은 MetricFlow가 맡고, BI·AI 도구가 거치는 API와 캐시만 dbt 플랫폼에 있다. CLI는 플랫폼 없이 MetricFlow를 직접 호출한다.</figcaption>
</figure>

dbt 플랫폼에서 제공하거나 플랫폼 연결이 필요한 기능은 다음과 같다.

- Semantic Layer API: JDBC와 GraphQL로 외부 도구가 지표를 조회한다.
- 공식 연동: Tableau, Google Sheets, Excel 등 BI 도구와 스프레드시트에서 지표를 선택해 쓴다.
- 결과 캐시와 exports: 자주 쓰는 조회를 미리 계산해 두거나 데이터 플랫폼에 테이블로 기록한다.
- dbt MCP 서버: self-hosted와 remote 방식이 있다. Semantic Layer 지표 조회 도구를 사용할 수 있는 범위는 연결한 dbt 플랫폼의 플랜과 API 권한에 따라 달라진다.

---

## 3. 정의 단위

semantic model은 dbt 모델 하나에 의미를 붙인 것이다. 최신 스펙에서는 모델 YAML 안에 `semantic_model: enabled: true`를 두고 컬럼마다 entity 또는 dimension을 선언하며, 지표는 같은 파일의 `metrics:` 목록에 둔다. 구 스펙의 최상위 `semantic_models:` 블록과 `measures`는 폐지 수순이다.

entity는 조인 키다. 타입은 네 가지다.

- `primary`: 행마다 하나씩 있고 null이 없는 키
- `unique`: 유일하지만 null을 허용하는 키
- `foreign`: 다른 semantic model을 가리키는 키
- `natural`: SCD Type 2처럼 같은 키가 시간에 따라 여러 행에 걸치는 경우

dimension은 지표를 자르거나 필터링하는 기준이며 `categorical`과 `time` 두 타입이 있다. time dimension에는 컬럼 수준에서 `granularity`를 지정하고 모델 수준의 `agg_time_dimension`이 그 모델에 정의된 지표의 기본 시간축이 된다.

metric은 다섯 타입이다.

| 타입 | 정의 | 예 |
|---|---|---|
| `simple` | 컬럼 식 하나를 집계한다 (sum, count, count_distinct, average, percentile 등) | 매출 = sum(amount) |
| `ratio` | 지표 ÷ 지표 | 객단가 = 매출 / 주문수 |
| `derived` | 지표끼리의 산식. 기간 오프셋 지정 가능 | 전주 대비 매출 증감 |
| `cumulative` | 누적 또는 윈도우 집계 | 월 누적 매출, 최근 30일 활성 사용자 |
| `conversion` | 기준 이벤트 뒤 일정 기간 안에 전환 이벤트가 일어난 비율 | 가입 후 결제 전환율 |

주문 fact 테이블과 고객 dimension 테이블을 최신 스펙으로 정의하면 다음과 같다.

```yaml
models:
  - name: fct_orders
    semantic_model:
      enabled: true
    agg_time_dimension: ordered_at
    columns:
      - name: order_id
        entity:
          type: primary
          name: order
      - name: customer_id
        entity:
          type: foreign
          name: customer
      - name: ordered_at
        granularity: day
        dimension:
          type: time
      - name: order_status
        dimension:
          type: categorical
    metrics:
      - name: revenue
        type: simple
        agg: sum
        expr: amount
      - name: order_count
        type: simple
        agg: count
        expr: 1

  - name: dim_customers
    semantic_model:
      enabled: true
    agg_time_dimension: first_ordered_at
    columns:
      - name: customer_id
        entity:
          type: primary
          name: customer
      - name: first_ordered_at
        granularity: day
        dimension:
          type: time
      - name: region
        dimension:
          type: categorical

metrics:
  - name: avg_order_value
    type: ratio
    numerator: revenue
    denominator: order_count
```

두 semantic model을 잇는 것은 entity 이름이다. `fct_orders.customer_id`는 foreign, `dim_customers.customer_id`는 primary로 선언됐고 둘 다 이름이 `customer`라서 MetricFlow는 이 둘 사이에 조인 경로가 있다고 본다. 조인 조건은 따로 적지 않는다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 300" role="img" aria-label="fct_orders의 foreign entity와 dim_customers의 primary entity 이름이 customer로 같아 조인 경로가 생기고, 지표를 조합한 avg_order_value는 최상위 metrics에 둔다">
  <defs><marker id="tlv-3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker><marker id="tlv-3-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk-accent" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <rect class="soft" x="0" y="0" width="290" height="232" rx="6"/>
  <text class="t" x="14" y="24">fct_orders</text>
  <text class="l" x="100" y="24">semantic model</text>
  <text class="s" x="14" y="52">entities</text>
  <text class="l" x="24" y="72">order_id</text>
  <text class="s" x="140" y="72">primary · order</text>
  <text class="l c-accent" x="24" y="90">customer_id</text>
  <text class="s c-accent" x="140" y="90">foreign · customer</text>
  <text class="s" x="14" y="116">dimensions</text>
  <text class="l" x="24" y="136">ordered_at</text>
  <text class="s" x="140" y="136">time · day</text>
  <text class="l" x="24" y="154">order_status</text>
  <text class="s" x="140" y="154">categorical</text>
  <text class="s" x="14" y="180">metrics</text>
  <text class="l" x="24" y="200">revenue</text>
  <text class="s" x="140" y="200">simple · sum(amount)</text>
  <text class="l" x="24" y="218">order_count</text>
  <text class="s" x="140" y="218">simple · count</text>
  <rect class="soft" x="340" y="0" width="290" height="232" rx="6"/>
  <text class="t" x="354" y="24">dim_customers</text>
  <text class="l" x="460" y="24">semantic model</text>
  <text class="s" x="354" y="52">entities</text>
  <text class="l c-accent" x="364" y="72">customer_id</text>
  <text class="s c-accent" x="480" y="72">primary · customer</text>
  <text class="s" x="354" y="116">dimensions</text>
  <text class="l" x="364" y="136">first_ordered_at</text>
  <text class="s" x="480" y="136">time · day</text>
  <text class="l" x="364" y="154">region</text>
  <text class="s" x="480" y="154">categorical</text>
  <path class="wire-accent" d="M290 86 H315 V68 H338" marker-end="url(#tlv-3-arrow-a)"/>
  <rect class="accent" x="0" y="252" width="290" height="46" rx="4"/>
  <text class="t" x="14" y="272">avg_order_value</text>
  <text class="l" x="140" y="272">최상위 metrics</text>
  <text class="s" x="14" y="289">ratio · revenue / order_count</text>
  <path class="wire dash" d="M145 250 V236" marker-end="url(#tlv-3-arrow)"/>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 2.</b> 두 semantic model은 <code>customer</code>라는 entity 이름으로 이어지고, 다른 지표를 참조하는 지표는 최상위 <code>metrics</code>에 둔다.</figcaption>
</figure>

공식 문서는 이 관계를 semantic graph라고 부른다. dbt DAG가 모델 사이의 실행 의존성을 담는 것과 달리 semantic graph는 지표와 기준 사이의 사용 가능한 조합을 담는다. MetricFlow는 entity 타입으로 조인 가능한 경로를 정하고 행이 불어나는 fan-out 조인과 chasm 조인은 만들지 않는다고 문서에 설명돼 있다. primary나 unique entity가 없는 테이블(이벤트 로그 등)의 dimension은 그 테이블 안의 지표에서만 쓸 수 있다.

---

## 4. 조회 명령과 생성 SQL

dimension은 `엔티티__디멘전` 형식으로 부른다. `customer__region`은 customer 엔티티를 따라 도달하는 dim_customers의 region이고, `order__order_status`는 fct_orders 자체의 상태다. 시간축은 `metric_time`이며 `metric_time__month`처럼 grain을 붙이면 컬럼의 `granularity`(day)보다 큰 단위로 올린다.

로컬 환경에 MetricFlow를 직접 설치한 경우 `mf` 명령을 쓴다.

```bash
mf query --metrics revenue,avg_order_value --group-by metric_time__month,customer__region
```

dbt 플랫폼 CLI에서는 `dbt sl` 명령을 쓰고 필터는 `--where`에 dimension 참조 문법으로 적는다.

{% raw %}
```bash
dbt sl query --metrics revenue --group-by metric_time__month --where "{{ Dimension('customer__region') }} = 'KR'"
```
{% endraw %}

`mf query`에 `--explain`, `dbt sl query`에 `--compile`을 붙이면 실행하지 않고 생성 SQL만 본다. 정의 검증은 `mf validate-configs` 또는 `dbt sl validate`다.

---

## 5. 마트 테이블 방식과의 비교

dbt 모델만 쓰는 경우 질문 하나에 마트 모델 하나를 만든다. 월별 매출은 `mart_revenue_by_month`, 지역별 매출은 `mart_revenue_by_region` 같은 식이다. Semantic Layer는 새 테이블을 만들지 않고 3장의 정의로 요청 시점에 SQL을 생성한다. 아래에서 지표와 기준을 바꿔 가며 두 방식이 실행하는 SQL과 누적되는 마트 수를 비교할 수 있다. 기준은 여러 개를 함께 고를 수 있다.

<style>
.tlv-sl .opts{display:flex;flex-wrap:wrap;align-items:center;gap:.4em;margin:0 0 .5em}
.tlv-sl .opts .lb{font-size:.78em;color:var(--tlv-sub);min-width:3em}
.tlv-sl .opt{border:1px solid var(--tlv-line-2);border-radius:4px;background:#fff;padding:.3em .8em;font-size:.8em;color:var(--tlv-sub);line-height:1.4}
.tlv-sl .opt[aria-pressed="true"]{background:var(--tlv-accent);border-color:var(--tlv-accent);color:#fff;font-weight:600}
.tlv-sl .q{margin:.8em 0 .1em;font-size:.9em;font-weight:600;color:var(--tlv-ink)}
.tlv-sl .g{font-size:.78em;color:var(--tlv-sub)}
.tlv-sl .pane{border:1px solid var(--tlv-line);border-radius:4px;overflow:hidden;margin-top:.8em}
.tlv-sl .pane>.hd{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.3em .6em;padding:.45em .8em;border-bottom:1px solid var(--tlv-line);font-size:.78em;font-weight:600;background:#fff}
.tlv-sl .pane>.hd .tlv-chip{margin-right:.35em}
.tlv-sl .pane .note{font-size:.74em;color:var(--tlv-mute);padding:.5em .8em 0}
.tlv-sl .pane pre.highlight{margin:0;border-radius:0}
.tlv-sl .pane .tlv-stats{padding:.6em .8em .8em}
.tlv-sl .ir{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,1.3fr);gap:.4em .8em;padding:.5em 0;border-top:1px solid var(--tlv-line);font-size:.78em;line-height:1.5}
.tlv-sl .ir.hd{border-top:0;color:var(--tlv-sub);padding:1em 0 .3em;font-size:.72em}
.tlv-sl .ir code{font-size:.92em;word-break:break-all}
.tlv-sl .ir .src{color:var(--tlv-sub)}
.tlv-sl .cav{margin-top:.6em;font-size:.78em;line-height:1.55}
.tlv-sl .cav li{padding:.2em 0 .2em 1em;position:relative}
.tlv-sl .cav li::before{content:"·";position:absolute;left:.2em}
@media (max-width:600px){.tlv-sl .ir{grid-template-columns:1fr;gap:.15em}.tlv-sl .ir.hd{display:none}}
</style>

<figure class="tlv tlv-sl" id="tlv-5-sl">
<div class="tlv-box">
<div class="opts"><span class="lb">지표</span><button type="button" class="opt" data-m="revenue" aria-pressed="true">매출</button><button type="button" class="opt" data-m="order_count" aria-pressed="false">주문수</button><button type="button" class="opt" data-m="avg_order_value" aria-pressed="false">객단가</button></div>
<div class="opts"><span class="lb">기준</span><button type="button" class="opt" data-d="month" aria-pressed="true">월별</button><button type="button" class="opt" data-d="region" aria-pressed="false">고객 지역별</button><button type="button" class="opt" data-d="status" aria-pressed="false">주문 상태별</button></div>
<div class="q" data-el="q">질문 · 월별 매출</div>
<div class="g" data-el="g">결과 1행 = 월 1개</div>
<div class="pane">
<div class="hd"><span><span class="tlv-chip">마트 테이블 방식</span>질문마다 모델 1개를 작성한다</span><span class="tlv-chip is-bad" data-el="badge">새 마트 추가</span></div>
<div class="language-sql highlighter-rouge"><div class="highlight"><pre class="highlight"><code data-el="lsql">-- models/marts/mart_revenue_by_month.sql
select
  date_trunc('month', o.ordered_at) as month,
  sum(o.amount) as revenue
from fct_orders o
group by 1</code></pre></div></div>
<div class="tlv-stats"><div class="tlv-stat"><div class="n" data-el="lcnt">1<small>개</small></div><div class="l">만든 마트 테이블</div></div><div class="tlv-stat"><div class="n" data-el="lcopy">1<small>곳</small></div><div class="l">매출 계산식 사본</div></div></div>
</div>
<div class="pane">
<div class="hd"><span><span class="tlv-chip is-accent">Semantic Layer</span>요청을 보내면 정의로 SQL을 생성한다</span></div>
<div class="language-bash highlighter-rouge"><div class="highlight"><pre class="highlight"><code data-el="rcmd">mf query --metrics revenue \
  --group-by metric_time__month</code></pre></div></div>
<div class="note">MetricFlow가 생성한 SQL (논리만 남기고 줄인 형태)</div>
<div class="language-sql highlighter-rouge"><div class="highlight"><pre class="highlight"><code data-el="rsql">select
  date_trunc('month', o.ordered_at) as metric_time__month,
  sum(o.amount) as revenue
from fct_orders o
group by 1</code></pre></div></div>
<div class="tlv-stats"><div class="tlv-stat"><div class="n">0<small>개</small></div><div class="l">만든 테이블</div></div><div class="tlv-stat"><div class="n">1<small>곳</small></div><div class="l">매출 계산식</div></div></div>
</div>
<div class="ir hd"><span>SQL 조각</span><span>의미</span><span>Semantic Layer에서 온 곳</span></div>
<div data-el="rows"><div class="ir"><span><code>date_trunc('month', o.ordered_at)</code></span><span>주문일을 월 단위로 잘라 묶는다</span><span class="src">agg_time_dimension(ordered_at, day)을 __month로 올린다</span></div><div class="ir"><span><code>sum(o.amount)</code></span><span>주문 금액을 모두 더한다</span><span class="src">revenue 지표 · simple · agg: sum · expr: amount</span></div><div class="ir"><span><code>from fct_orders o</code></span><span>주문 1건이 1행인 fact 테이블에서 시작한다</span><span class="src">지표가 정의된 semantic model이 출발점이다</span></div><div class="ir"><span><code>group by 1</code></span><span>고른 기준 조합마다 한 행으로 묶는다</span><span class="src">--group-by 목록을 그대로 쓴다</span></div></div>
<ul class="cav" data-el="cav"><li>월은 주문일(ordered_at) 기준이다. 결제일 기준이 필요하면 agg_time_dimension이 다른 지표를 따로 둔다.</li></ul>
</div>
<figcaption class="tlv-cap"><b>그림 3.</b> 같은 질문에 두 방식이 실행하는 SQL은 거의 같고, 마트 방식만 질문이 늘 때마다 테이블과 매출 계산식 사본이 늘어난다.</figcaption>
</figure>

<script>
(function(){
  var root = document.getElementById('tlv-5-sl'); if (!root) return;
  var M = {
    revenue: { l: '매출', expr: 'sum(o.amount)', rev: true, mean: '주문 금액을 모두 더한다', src: 'revenue 지표 · simple · agg: sum · expr: amount' },
    order_count: { l: '주문수', expr: 'count(*)', rev: false, mean: '주문 행 수를 센다', src: 'order_count 지표 · simple · agg: count · expr: 1' },
    avg_order_value: { l: '객단가', expr: 'sum(o.amount) * 1.0 / count(*)', rev: true, mean: '주문 1건당 평균 금액이다 (매출 ÷ 주문수)', src: 'avg_order_value 지표 · ratio · revenue / order_count' }
  };
  var D = {
    month: { l: '월별', g: '월', sl: 'metric_time__month', sql: "date_trunc('month', o.ordered_at)", s: 'month', mean: '주문일을 월 단위로 잘라 묶는다', src: 'agg_time_dimension(ordered_at, day)을 __month로 올린다' },
    region: { l: '고객 지역별', g: '지역', sl: 'customer__region', sql: 'c.region', s: 'region', mean: '고객 테이블의 지역 값이다', src: 'customer 엔티티를 따라 dim_customers의 region을 가져온다' },
    status: { l: '주문 상태별', g: '주문 상태', sl: 'order__order_status', sql: 'o.order_status', s: 'order_status', mean: '주문 자체의 상태 값이다', src: 'fct_orders 안의 categorical dimension이라 조인이 없다' }
  };
  var ORDER = ['month', 'region', 'status'];
  var metric = 'revenue', dims = { month: true }, built = {}, builtN = 0, builtRev = 0;
  function q(k){ return root.querySelector('[data-el="' + k + '"]'); }
  function sel(){ return ORDER.filter(function(d){ return dims[d]; }); }
  function sql(alias){
    var ds = sel(), out = ['select'];
    ds.forEach(function(d){ out.push('  ' + D[d].sql + ' as ' + (alias ? D[d].sl : D[d].s) + ','); });
    out.push('  ' + M[metric].expr + ' as ' + metric, 'from fct_orders o');
    if (dims.region) out.push('left join dim_customers c', '  on o.customer_id = c.customer_id');
    if (ds.length) out.push('group by ' + ds.map(function(_, i){ return i + 1; }).join(', '));
    return out.join('\n');
  }
  function row(code, mean, src){
    var r = document.createElement('div'); r.className = 'ir';
    var a = document.createElement('span'), c = document.createElement('code'); c.textContent = code; a.appendChild(c);
    var b = document.createElement('span'); b.textContent = mean;
    var s = document.createElement('span'); s.className = 'src'; s.textContent = src;
    r.appendChild(a); r.appendChild(b); r.appendChild(s); return r;
  }
  function li(t){ var e = document.createElement('li'); e.textContent = t; return e; }
  function stat(el, n, unit){ el.textContent = ''; el.appendChild(document.createTextNode(n)); var s = document.createElement('small'); s.textContent = unit; el.appendChild(s); }
  function render(){
    var ds = sel(), m = M[metric];
    Array.prototype.forEach.call(root.querySelectorAll('[data-m]'), function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-m') === metric ? 'true' : 'false'); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-d]'), function(b){ b.setAttribute('aria-pressed', dims[b.getAttribute('data-d')] ? 'true' : 'false'); });
    var name = 'mart_' + metric + (ds.length ? '_by_' + ds.map(function(d){ return D[d].s; }).join('_') : '_total');
    var isNew = !built[name];
    if (isNew) { built[name] = 1; builtN++; if (m.rev) builtRev++; }
    var badge = q('badge'); badge.textContent = isNew ? '새 마트 추가' : '이미 만든 마트'; badge.className = 'tlv-chip' + (isNew ? ' is-bad' : '');
    q('lsql').textContent = '-- models/marts/' + name + '.sql\n' + sql(false);
    stat(q('lcnt'), builtN, '개'); stat(q('lcopy'), builtRev, '곳');
    q('rcmd').textContent = 'mf query --metrics ' + metric + (ds.length ? ' \\\n  --group-by ' + ds.map(function(d){ return D[d].sl; }).join(',') : '');
    q('rsql').textContent = sql(true);
    q('q').textContent = '질문 · ' + (ds.length ? ds.map(function(d){ return D[d].l; }).join(' · ') + ' ' : '전체 ') + m.l;
    q('g').textContent = ds.length ? '결과 1행 = ' + ds.map(function(d){ return D[d].g; }).join(' × ') + (ds.length > 1 ? ' 조합 1개' : ' 1개') : '결과 1행 = 전체 기간 합계 1개';
    var rows = q('rows'); rows.textContent = '';
    ds.forEach(function(d){ rows.appendChild(row(D[d].sql, D[d].mean, D[d].src)); });
    rows.appendChild(row(m.expr, m.mean, m.src));
    rows.appendChild(row('from fct_orders o', '주문 1건이 1행인 fact 테이블에서 시작한다', '지표가 정의된 semantic model이 출발점이다'));
    if (dims.region) rows.appendChild(row('left join dim_customers c', '지역을 가져오기 위해 고객 테이블을 붙인다', 'customer_id가 fct_orders에서는 foreign, dim_customers에서는 primary라 조인 경로로 쓴다'));
    rows.appendChild(ds.length ? row('group by ' + ds.map(function(_, i){ return i + 1; }).join(', '), '고른 기준 조합마다 한 행으로 묶는다', '--group-by 목록을 그대로 쓴다') : row('(group by 없음)', '전체를 한 행으로 집계한다', '--group-by를 생략하면 전체 합계다'));
    var cav = q('cav'); cav.textContent = '';
    if (metric === 'avg_order_value' && ds.length) cav.appendChild(li('그룹별 객단가를 다시 평균 내면 상위 수준 객단가가 아니다. 마트 방식에서는 매출과 주문수를 따로 저장하고 조회할 때 나누는 규칙을 사람이 지켜야 하고, Semantic Layer는 ratio 정의를 보고 매번 분자와 분모를 각각 집계한 뒤 나눈다.'));
    if (metric === 'avg_order_value' && !ds.length) cav.appendChild(li('전체 객단가는 전체 매출을 전체 주문수로 나눈 값이다.'));
    if (dims.region) cav.appendChild(li('지역이 없는 고객의 주문은 region이 null인 행 하나로 모인다.'));
    if (dims.status && m.rev) cav.appendChild(li('상태별로 나누면 취소 주문의 금액도 매출에 포함된 것이 보인다. 취소를 빼려면 Semantic Layer는 지표 정의 한 곳, 마트 방식은 매출 마트 전부를 고친다.'));
    if (dims.month) cav.appendChild(li('월은 주문일(ordered_at) 기준이다. 결제일 기준이 필요하면 agg_time_dimension이 다른 지표를 따로 둔다.'));
    if (!ds.length && metric !== 'avg_order_value') cav.appendChild(li('기준이 없으면 전체 기간의 값 하나만 나온다.'));
  }
  Array.prototype.forEach.call(root.querySelectorAll('[data-m]'), function(b){ b.addEventListener('click', function(){ metric = b.getAttribute('data-m'); render(); }); });
  Array.prototype.forEach.call(root.querySelectorAll('[data-d]'), function(b){ b.addEventListener('click', function(){ var d = b.getAttribute('data-d'); dims[d] = !dims[d]; render(); }); });
  render();
})();
</script>

두 방식이 실행하는 SQL 자체는 거의 같다. 차이는 두 가지다. 마트 방식은 사람이 SQL을 쓰고 질문마다 테이블을 추가하며, Semantic Layer는 엔진이 SQL을 생성하고 테이블을 추가하지 않는다.

고객 지역별을 고르면 양쪽 모두 dim_customers 조인이 붙는다. 마트 방식에서는 작성자가 조인 조건을 쓰고, Semantic Layer에서는 customer 엔티티의 foreign·primary 관계를 보고 MetricFlow가 붙인다. 주문 상태별은 fct_orders 안의 dimension이라 조인 없이 바로 쓴다.

마트 수는 지표 수와 기준 조합 수의 곱으로 늘어난다. 위 예시는 지표 3개, 기준 3개라 조합이 3 × 2³ = 24종이고 기준이 하나 늘 때마다 조합은 두 배가 된다. 실무에서는 보통 자주 묻는 조합만 마트로 두고 나머지는 그때마다 SQL을 쓴다. 더할 수 있는 지표(매출, 주문수)는 더 잘게 자른 마트를 다시 집계해 상위 수준 값을 얻을 수 있어 실제 마트 수는 조합 수보다 적다. 비율 지표는 그렇게 되지 않는데, 6장에서 다룬다.

---

## 6. 비율 지표와 정의 변경 범위

객단가처럼 비율로 정의된 지표는 그룹별 값을 다시 평균 내도 상위 수준의 값이 나오지 않는다.

| 지역 | 매출 | 주문수 | 객단가 |
|---|--:|--:|--:|
| A | 1,000 | 10 | 100.0 |
| B | 300 | 1 | 300.0 |
| 전체 | 1,300 | 11 | 118.2 |

두 지역 객단가의 평균은 200이지만 전체 객단가는 118.2다. 마트 방식에서도 마트에 객단가 대신 매출과 주문수를 저장해 두고 조회할 때 각각 합산한 뒤 나누면 맞는 값이 나온다. 다만 이 규칙은 마트를 만드는 사람과 마트를 읽는 도구가 각자 지켜야 한다. 마트에 객단가 컬럼이 있으면 BI 도구가 그 컬럼을 평균 내는 것을 막을 방법이 없고, 분자와 분모만 저장했다면 나누는 식을 조회하는 쪽마다 다시 써야 한다. Semantic Layer에서는 avg_order_value가 ratio 타입이라는 사실이 정의에 들어 있어서, 어떤 기준으로 조회하든 MetricFlow가 분자와 분모를 각각 집계한 뒤 나눈다. 조회하는 쪽은 나누는 식을 모른 채 지표 이름만 부른다.

정의가 바뀔 때도 고칠 범위가 다르다. 취소 주문을 매출에서 빼기로 했다면 마트 방식에서는 매출 계산식이 들어간 마트를 전부 찾아 고쳐야 한다. 5장 위젯의 매출 계산식 사본 수가 이 범위다. Semantic Layer에서는 revenue 지표의 `expr` 한 곳을 고치면 revenue를 참조하는 avg_order_value와 모든 조회에 반영된다.

<figure class="tlv">
<div class="tlv-compare">
  <div class="tlv-col"><div class="hd"><span class="tlv-chip">마트 테이블 방식</span>매출 마트마다 수정</div><div class="bd is-code"><div class="language-sql highlighter-rouge"><div class="highlight"><pre class="highlight"><code>-- mart_revenue_by_month.sql
-- mart_revenue_by_region.sql
-- mart_avg_order_value_by_*.sql
-- 매출 계산식이 있는 마트 전부
sum(case when order_status
         &lt;&gt; 'cancelled'
         then amount else 0 end)
  as revenue</code></pre></div></div></div></div>
  <div class="tlv-col"><div class="hd"><span class="tlv-chip is-accent">Semantic Layer</span>지표 정의 한 곳 수정</div><div class="bd is-code"><div class="language-yaml highlighter-rouge"><div class="highlight"><pre class="highlight"><code>metrics:
  - name: revenue
    type: simple
    agg: sum
    expr: &gt;
      case when order_status
      &lt;&gt; 'cancelled'
      then amount else 0 end</code></pre></div></div></div></div>
</div>
<figcaption class="tlv-cap"><b>그림 4.</b> 취소 주문 제외는 마트 방식에서는 매출 계산식이 있는 마트마다, Semantic Layer에서는 <code>revenue</code> 지표의 <code>expr</code> 한 곳에서 반영된다.</figcaption>
</figure>

---

## 7. 도입 시 확인 사항

공식 문서 기준으로 확인한 제약이다.

- YAML 스펙 변경: v1.12부터 최상위 `semantic_models:`, `measures`, `type_params`가 구 스펙이 됐다. 블로그와 예제 대부분이 구 스펙이라 섞이지 않게 해야 하고 기존 정의는 `dbt-autofix deprecations --semantic-layer`로 옮긴다. 설치한 패키지가 구 스펙 정의를 담고 있으면 패키지 쪽도 갱신돼야 파싱 오류가 나지 않는다.
- dbt Mesh 프로젝트 간 참조: 최신 스펙에서는 아직 지원하지 않고 구 스펙에서만 된다.
- 지원 데이터 플랫폼: 현재 공식 문서의 목록은 Snowflake, BigQuery, Databricks, Redshift, Postgres, Trino(Starburst Galaxy 포함)다. Microsoft Fabric은 지원하지 않는다. 버전과 실행 환경에 따라 지원 범위가 달라질 수 있으므로 도입 전에 다시 확인한다.
- `expr`에는 순수 SQL만 쓴다. MetricFlow는 dbt 내장 Jinja 함수와 패키지 매크로를 아직 지원하지 않는다.
- 플랫폼 의존: Semantic Layer API, 공식 BI 연동, 캐시와 exports는 dbt 플랫폼 Starter 이상 기능이다. MCP 서버는 self-hosted와 remote 방식이 있지만 Semantic Layer 관련 도구의 사용 범위는 플랜과 권한에 따라 달라진다. 로컬 MetricFlow만 사용하면 CLI 조회까지 가능하다.
- v1.12부터는 dbt YAML 대신 Apache Ossie 문서로 semantic model을 정의하는 선택지도 있다.

---

## 8. 정리

- dbt Semantic Layer는 entity, dimension, metric을 모델 YAML에 선언하고 MetricFlow가 그 정의로 SQL을 생성하는 구조다. SQL 생성 엔진은 Apache 2.0 오픈소스고 API, 연동, 캐시는 플랫폼 기능이다.
- 두 semantic model은 entity 이름이 같으면 조인 경로가 생기고 조인 조건은 따로 적지 않는다.
- 같은 질문에 대해 마트 방식과 생성되는 SQL은 거의 같다. 마트 방식은 지표와 기준 조합마다 테이블이 늘고 Semantic Layer는 테이블을 추가하지 않는다.
- 비율 지표는 그룹별 값을 다시 평균 내면 틀린다. 마트 방식에서는 분자와 분모를 따로 저장하고 조회 시점에 나누는 규칙을 사람이 지켜야 하고, Semantic Layer는 ratio 타입 정의를 보고 엔진이 매번 그렇게 계산한다. 정의 변경도 지표 한 곳에서 반영된다.
- v1.12 스펙 변경, 프로젝트 간 참조 미지원, 지원 플랫폼 목록, Jinja 미지원은 도입 전에 확인해야 한다.

---

## 9. 참고 자료

- [dbt Semantic Layer 아키텍처](https://docs.getdbt.com/docs/use-dbt-semantic-layer/sl-architecture)
- [dbt v1.12 Semantic Layer 레퍼런스](https://docs.getdbt.com/reference/semantic-layer-reference?version=1.12)
- [MetricFlow 명령어](https://docs.getdbt.com/docs/build/metricflow-commands)
- [Semantic Layer 빠른 시작과 지원 데이터 플랫폼](https://docs.getdbt.com/guides/sl-qs)
- [dbt MCP 서버](https://docs.getdbt.com/docs/dbt-ai/about-mcp)
- [MetricFlow 개요와 제한 사항](https://docs.getdbt.com/docs/build/about-metricflow)
- [dbt Mesh와 Semantic Layer](https://docs.getdbt.com/best-practices/how-we-mesh/mesh-5-faqs)
