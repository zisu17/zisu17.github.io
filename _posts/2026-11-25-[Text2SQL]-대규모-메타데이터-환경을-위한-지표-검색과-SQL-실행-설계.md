---
title: "[Text2SQL] 대규모 메타데이터 환경을 위한 지표 검색과 SQL 실행 설계"
excerpt: "지난달 매출 질문을 따라가며 지표 검색과 SQL 실행을 나눈 구조와 Olist에서 확인한 토큰 및 정답률을 정리한다."
nav_section: projects
nav_topic: text2sql
categories:
  - Project
tags:
  - Project
  - Text2SQL
  - MCP
  - SemanticLayer
  - Neo4j
permalink: /data/text2sql-graph-mcp-metric-search-sql-execution/
toc: true
toc_sticky: true
date: 2026-11-25
last_modified_at: 2026-11-27
---

> Text2SQL 시리즈
>
> - [Ossie와 GraphRAG를 활용한 Semantic Layer 설계](/data/text2sql-ossie-graphrag-semantic-layer-governance/)
> - [메타데이터와 지표 계보를 위한 GraphDB 설계](/data/text2sql-metadata-lineage-graph-design/)
> - [Claude Code·Codex용 AI Agent 플러그인 구성하기](/data/text2sql-agent-claude-codex-plugin/)
> - 대규모 메타데이터 환경을 위한 지표 검색과 SQL 실행 설계

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

## 1. 배경

‘지난달 매출이 얼마였어?’라는 질문을 받으면 매출의 기준부터 확인한다. 상품 가격을 더한 값과 실제 결제 금액은 다르다. 취소 주문의 처리 방식과 기간을 자를 날짜를 어떻게 정하느냐에 따라서도 합계가 달라진다.

앞선 글에서 이런 기준을 Ossie 정의에 정리했다. 처음에는 플러그인이 로컬 파일에서 필요한 지표를 찾았다. 테이블이 수천 개나 수만 개 있는 환경에서는 컬럼과 조인 키에 업무 용어와 계산식까지 쌓인다. 에이전트가 이 파일을 통째로 읽으면 질문과 관계없는 정의까지 모델 입력에 들어간다.

지난달 매출을 묻는다면 일단 매출 후보를 고를 수 있는 설명부터 있으면 된다. 지역별 매출로 질문이 바뀌면 그때 고객과 주문을 잇는 키를 더 찾는다. 질문에 따라 읽을 정의의 범위를 정할 수 있도록 검색을 붙였다.

---

## 2. 지표 검색과 SQL 실행

지표를 고치고 검토할 때는 Ossie YAML을 쓴다. 게시하기 전에 원본 DB에 정의에 적힌 컬럼이 실제로 있는지 확인하고 지표와 물리 컬럼을 잇는 계보를 Neo4j에 적재한다. 질문이 들어오면 그래프에서 지표를 먼저 찾고 필요에 따라 조인 규칙이나 원본 컬럼으로 더 내려갈 수 있다. [그래프 게시 코드](https://github.com/zisu17/semantic-definitions/blob/05c80aac41caa1052371062f6bc492354029a15a/graphdb/neo4j_writer.py)

에이전트가 Neo4j의 정의를 찾을 수 있도록 검색과 상세 조회를 MCP(Model Context Protocol) 도구로 제공했다. 프로젝트에서는 이 서버를 Graph MCP라고 부른다. 에이전트가 ‘매출’을 검색하면 지표의 이름과 설명, 동의어, 승인 상태를 받아 어떤 정의가 질문에 맞는지 살핀다.

지표를 고른 뒤 SQL을 실행하려면 상품 가격을 읽을 테이블과 주문일을 가져올 조인 조건까지 필요하다. 처음에는 이 실행용 정의 전체도 MCP 도구로 내려줬다. 0.3.0부터는 별도 HTTP 경로로 옮겨 `t2s`가 직접 받게 했다. 이 응답을 스냅샷이라고 부른다. 에이전트 입력에는 검색 결과와 필요한 상세 정보만 들어간다. [Graph MCP 조회 계약](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/docs/graphdb-mcp-design.md)

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 258" role="img" aria-label="에이전트는 MCP 도구에서 지표 후보와 버전을 받는다. t2s는 같은 서버의 HTTP 스냅샷으로 정의를 읽고 원본 DB에 SQL을 실행한다.">
  <defs><marker id="tlv-2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker><marker id="tlv-2-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="mk-accent" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <rect class="soft" x="252" y="8" width="206" height="183" rx="5"/>
  <text class="t" x="264" y="26">Graph MCP 서버</text>
  <rect class="box" x="264" y="35" width="182" height="51" rx="4"/>
  <text class="t" x="276" y="55">지표 검색·상세 조회</text>
  <text class="l" x="276" y="72">/mcp</text>
  <rect class="accent" x="264" y="119" width="182" height="56" rx="4"/>
  <text class="t" x="276" y="140">실행용 모델 정의</text>
  <text class="l" x="276" y="158">GET /snapshot/{model}</text>
  <rect class="box" x="5" y="35" width="175" height="51" rx="4"/>
  <text class="t" x="17" y="55">에이전트</text>
  <text class="s" x="17" y="72">질문에 맞는 지표 선택</text>
  <path class="wire" d="M180 60 H260" marker-end="url(#tlv-2-arrow)"/>
  <text class="s" x="193" y="51">검색 호출</text>
  <rect class="accent" x="5" y="119" width="175" height="56" rx="4"/>
  <text class="t" x="17" y="140">t2s CLI</text>
  <text class="s" x="17" y="158">정의 확인·SQL 생성</text>
  <path class="wire-accent" d="M78 86 V115" marker-end="url(#tlv-2-arrow-accent)"/>
  <text class="s c-accent" x="89" y="104">지표와 모델 버전</text>
  <path class="wire-accent" d="M180 147 H260" marker-end="url(#tlv-2-arrow-accent)"/>
  <text class="s c-accent" x="192" y="138">정의 요청</text>
  <rect class="soft" x="493" y="73" width="132" height="63" rx="4"/>
  <text class="t" x="505" y="98">Neo4j</text>
  <text class="s" x="505" y="116">게시된 지표 정의</text>
  <path class="wire" d="M446 60 H474 V92 H489" marker-end="url(#tlv-2-arrow)"/>
  <path class="wire-accent" d="M446 147 H474 V119 H489" marker-end="url(#tlv-2-arrow-accent)"/>
  <rect class="box" x="493" y="197" width="132" height="53" rx="4"/>
  <text class="t" x="505" y="219">원본 DB</text>
  <text class="s" x="505" y="236">Olist 주문 데이터</text>
  <path class="wire-accent" d="M78 175 V224 H489" marker-end="url(#tlv-2-arrow-accent)"/>
  <text class="s c-accent" x="195" y="215">읽기 전용으로 SQL 실행</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> 에이전트는 MCP 도구로 검색한 후보를 읽고 t2s는 같은 서버에서 실행용 정의를 받는다.</figcaption>
</figure>

---

## 3. 매출 지표의 검색과 계보

### 3.1 검색 후보와 계산 기준

‘지난달 매출’에서 검색어로 쓸 부분은 ‘매출’이다. ‘지난달’은 지표를 고른 뒤 SQL의 기간 조건에 넣는다. Olist를 조회할 때는 `model="olist_sales"`와 `kinds=["Metric"]`을 넘겨 이 모델에 등록된 지표로 범위를 좁혔다. [검색 구현](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/src/text2sql_mcp/graph_repository.py)

서버는 검색어와 정확히 맞는 후보를 참조명, 이름, 동의어 순으로 우선한다. 같은 순위 안에서는 BM25 점수로 정렬한다. ‘매출’로 ‘매출액’도 찾을 수 있도록 Lucene의 `cjk` 분석기로 이어진 한글을 두 글자씩 끊어 색인했다. 검색어에 여러 단어가 들어오면 OR로 묶어 후보를 찾는다. 현업에서 쓰는 표현을 동의어로 등록하면 그 표현으로도 지표를 찾을 수 있다. [Neo4j 전문 검색 인덱스](https://neo4j.com/docs/cypher-manual/current/indexes/search-indexes/full-text-indexes/)

‘매출’로 조회했을 때 첫 번째는 `order_lines.revenue`였다. 응답에 `has_more=true`가 있어서 같은 검색을 `limit=3`으로 넓혀 보니 `order_items.item_price_total`도 나왔다. 둘 다 주문 상품의 가격을 더하는 승인 지표다. 매출 지표는 취소되거나 판매할 수 없는 주문을 빼고 상품 가격 합계는 모든 상태를 포함한다. ‘매출’이 동의어로 등록된 첫 후보의 기준을 사용했다. [Olist 지표 정의](https://github.com/zisu17/semantic-definitions/blob/05c80aac41caa1052371062f6bc492354029a15a/definitions/olist/sales.ossie.yaml)

플러그인은 첫 후보의 집계 대상과 기간 기준을 질문과 대조한다. 맞는 승인 지표가 있으면 그 지표를 쓴다. 추가 후보가 있는지는 서버가 한도보다 한 건 더 조회해 `has_more`로 알려준다. 첫 후보에서 맞는 지표를 찾지 못했고 더 볼 후보가 있으면 검색 범위를 넓힌다. 여러 계산 기준이 가능해 결과가 달라질 때는 사용자에게 확인한다. [플러그인의 지표 선택 절차](https://github.com/zisu17/text2sql-plugin/blob/e5b59a8a8e4b84eb256bc9414767cc371f5e6ddb/skills/ask/SKILL.md)

### 3.2 계산식과 조인 키

매출에서 제외하는 상태가 궁금하면 에이전트가 `graph_get_metric_lineage`에 데이터셋과 지표 이름을 보낸다. 어떤 관계를 따라가고 어느 필드를 돌려줄지는 서버의 Cypher 쿼리에서 정했다. 이 도구는 `order_items.price`를 금액의 출처로 돌려주고 `orders.order_status`는 계산에 넣을 행을 정하는 조건으로 알려준다. 주문일 필드의 이름이나 자료형은 `graph_get_dataset`으로 주문 데이터셋을 읽으면 확인할 수 있다. [계보 조회 구현](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/src/text2sql_mcp/graph_repository.py)

기간을 주문일로 자르려면 매출 데이터셋과 주문 데이터셋을 연결해야 한다. `graph_find_join_path`로 확인한 경로는 `order_lines → order_items → orders`였다. 처음에는 주문 ID와 상품 순번이 모두 필요하고 다음에는 주문 ID로 주문에 연결한다. 경로의 `n_to_1`은 도착 쪽 키가 정의의 기본키나 고유 키와 맞는지를 나타낸다. 실제 데이터에서 키가 고유한지는 정의를 점검할 때 별도로 확인한다. [조인 경로 반환 형식](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/docs/graphdb-mcp-design.md)

---

## 4. 검색과 실행 사이의 정의 버전

매출 후보를 고른 직후 취소 주문 처리 기준이 바뀐 정의가 게시될 수 있다. 그 사이에 최신 버전으로 SQL을 만들어 버리면 검색에서 확인한 기준과 실제 집계에 쓰는 기준이 달라진다.

그래서 파일 이름과 내용으로 버전 해시를 만들고 검색 결과에 `model`과 `version_id`를 넣었다. 게시기는 새 정의를 적재하고 활성 버전을 교체하는 작업을 한 쓰기 트랜잭션으로 처리한다. 각 조회도 한 읽기 트랜잭션 안에서 활성 버전과 그 버전의 데이터를 읽는다. 에이전트는 검색에서 받은 모델과 버전을 `GRAPH_MODEL`과 `GRAPH_VERSION_ID`로 넘긴다. `t2s`는 스냅샷 버전이 달라졌으면 SQL을 만들기 전에 멈춘다. [게시 코드](https://github.com/zisu17/semantic-definitions/blob/05c80aac41caa1052371062f6bc492354029a15a/graphdb/neo4j_writer.py) · [CLI의 버전 검사](https://github.com/zisu17/text2sql-plugin/blob/e5b59a8a8e4b84eb256bc9414767cc371f5e6ddb/t2s/cli.py)

<figure class="tlv">
<div class="tlv-compare">
  <div class="tlv-col"><div class="hd"><span class="tlv-chip is-good">버전 일치</span></div><div class="bd"><code>검색 A → 스냅샷 A</code><p>검색에서 고른 지표를 버전 A로 컴파일한다.</p></div></div>
  <div class="tlv-col"><div class="hd"><span class="tlv-chip is-bad">버전 변경</span></div><div class="bd"><code>검색 A → 스냅샷 B</code><p>CLI가 SQL 생성 전에 오류를 반환한다. 새 정의로 지표를 다시 확인한다.</p></div></div>
</div>
<figcaption class="tlv-cap"><b>그림 2.</b> 검색 뒤 활성 버전이 바뀌면 새 정의에서 지표를 다시 확인한다.</figcaption>
</figure>

서버는 Neo4j에서 읽어 만든 스냅샷을 메모리에 최대 8개까지 둔다. 다음 요청에서는 활성 버전을 확인한 뒤 테넌트, 모델, 버전이 같은 사본을 재사용한다. CLI는 검색에서 받은 버전의 스냅샷이 캐시에 있을 때 이전 ETag를 `If-None-Match`로 보낸다. 내용이 같으면 서버는 본문 없이 `304 Not Modified`를 반환한다. 이때도 CLI의 요청과 서버의 활성 버전 확인은 한 번씩 일어난다. [서버의 조건부 응답](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/src/text2sql_mcp/http_app.py) · [CLI의 스냅샷 캐시](https://github.com/zisu17/text2sql-plugin/blob/e5b59a8a8e4b84eb256bc9414767cc371f5e6ddb/t2s/graph_client.py)

---

## 5. 한 가지 매출 정의로 만드는 두 쿼리

### 5.1 지난달 매출

Olist에서 질문의 기준일을 2017년 11월 1일로 잡았다. ‘지난달’에 해당하는 10월 1일 이상 11월 1일 미만의 기간 조건과 검색에서 고른 지표를 `t2s compile`에 전달했다.

```bash
export GRAPH_MODEL=olist_sales
export GRAPH_VERSION_ID='<검색 응답의 version_id>'

t2s compile order_lines.revenue \
  --where "orders.order_purchase_timestamp >= '2017-10-01'" \
  --where "orders.order_purchase_timestamp < '2017-11-01'" \
  --run
```

상품 가격을 더하는 식과 제외할 주문 상태는 지표 정의에 들어 있다. 기간에 쓰는 주문일은 주문 데이터셋에 있으므로 엔진이 정의된 연결을 따라 조인한다. `--run`을 주면 SQL을 검사한 뒤 SQLite에서 실행한다. 원본 주문 상품과 주문 테이블에 같은 기준을 직접 적용한 쿼리도 실행했다. 두 쿼리에서 매출은 **660,179.62**였다. 주문 내역처럼 원본 행이 필요한 질문에는 물리 테이블 기준으로 SQL을 작성해 `t2s run`을 쓴다. [실행 경로 선택 규칙](https://github.com/zisu17/text2sql-plugin/blob/e5b59a8a8e4b84eb256bc9414767cc371f5e6ddb/skills/ask/SKILL.md)

### 5.2 고객 주소 기준 지역별 매출 1위 카테고리

지난달 고객 주소가 속한 주마다 매출이 가장 큰 카테고리를 찾을 때도 같은 지표를 쓴다. 에이전트가 주와 카테고리별 집계 및 순위 쿼리를 쓰고 매출을 `AGG(l.revenue)`로 참조하면 `t2s sql`이 지표 정의를 적용한다.

```sql
WITH sales_by_category AS (
  SELECT c.customer_state, p.product_category_name, AGG(l.revenue) AS revenue
  FROM order_lines AS l
  JOIN order_items AS i
    ON l.order_id = i.order_id AND l.order_item_id = i.order_item_id
  JOIN orders AS o ON i.order_id = o.order_id
  JOIN customers AS c ON o.customer_id = c.customer_id
  JOIN products AS p ON i.product_id = p.product_id
  WHERE o.order_purchase_timestamp >= '2017-10-01'
    AND o.order_purchase_timestamp < '2017-11-01'
    AND p.product_category_name IS NOT NULL
  GROUP BY c.customer_state, p.product_category_name
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY customer_state ORDER BY revenue DESC, product_category_name
  ) AS row_no
  FROM sales_by_category
)
SELECT customer_state, product_category_name, ROUND(revenue, 2) AS revenue
FROM ranked
WHERE row_no = 1
ORDER BY customer_state
```

카테고리가 없는 행은 빼고 동률이면 카테고리명 순으로 한 행을 골랐다. 원본 테이블에 같은 기준을 직접 적용한 결과와 비교해 **27행**이 모두 일치했다.

결제 테이블까지 조인했을 때는 차이가 났다. 주문 하나에 결제 행이 여러 개 있으면 같은 상품 행이 여러 번 생긴다. 그대로 `SUM(price)`를 하면 10월 매출이 **689,353.19**로 늘어난다. `AGG(l.revenue)`를 쓴 쿼리는 상품의 복합키 `(order_id, order_item_id)`마다 한 행을 골라 합산했다. 이때는 결제 테이블을 붙이기 전과 같은 값이 나왔다. 지표의 집계식과 함께 어느 행 단위로 합산할지도 정의에 두는 까닭이다. [AGG 변환 코드](https://github.com/zisu17/text2sql-plugin/blob/e5b59a8a8e4b84eb256bc9414767cc371f5e6ddb/t2s/measures.py)

---

## 6. 검색 비용과 SQL 정답률

### 6.1 한 번에 내려주는 정보의 크기

매출 후보 두 건의 응답은 904바이트였다. 계산식과 물리 컬럼의 계보를 추가로 읽으면 2,231바이트가 들고 주문 데이터셋까지의 조인 경로는 633바이트였다. 같은 Olist 모델에서 데이터셋 10개, 필드 63개, 지표 28개, 연결 규칙 9개를 읽은 실행용 스냅샷은 40,240바이트였다. 네 응답 객체를 같은 설정으로 UTF-8 JSON으로 직렬화했을 때 두 후보의 크기는 스냅샷의 약 **2.2%**였다.

<figure class="tlv">
<div class="tlv-bars" role="img" aria-label="매출 지표 검색 응답 904바이트, 검색과 계보와 조인 경로 응답 합계 3768바이트, 실행용 스냅샷 40240바이트">
  <div class="tlv-bar-row"><span class="k">지표 검색</span><span class="tlv-track"><i style="--w:2.2465%"></i></span><span class="v">904</span></div>
  <div class="tlv-bar-row"><span class="k">검색·계보·조인 경로</span><span class="tlv-track"><i style="--w:9.3638%"></i></span><span class="v">3,768</span></div>
  <div class="tlv-bar-row"><span class="k">실행용 스냅샷</span><span class="tlv-track"><i class="is-mute" style="--w:100%"></i></span><span class="v">40,240</span></div>
</div>
<figcaption class="tlv-cap"><b>그림 3.</b> 같은 Olist 모델에서 조회한 응답의 UTF-8 JSON 크기를 바이트로 비교했다.</figcaption>
</figure>

질문 처리 비용에는 검색을 호출한 뒤 새로 보내는 모델 요청도 들어간다. Olist 개발셋 49문항을 각 세 번 실행했을 때 전체 DDL로 SQLite 쿼리를 바로 만드는 경로는 캐시를 제외하고 입력 539,060토큰을 썼다. 같은 DDL로 Graph 조회와 `t2s` 실행을 거친 경로는 1,293,176토큰을 썼다. 문항 처리 시간 중앙값은 각각 9.51초와 19.68초였다. SQL 생성 지시와 실행 방식이 서로 달랐고 당시 로그에는 요청별 토큰이 남아 있지 않았다.

### 6.2 같은 검색 결과의 두 사본

입력이 어디에서 늘어나는지 보려고 검색 후보가 여섯 건 나왔던 문항 네 개를 골랐다. 이전 검색 응답을 재생하면 질문과 DDL을 고정한 채 도구 설명이나 응답 형식만 바꿔 볼 수 있다. Codex CLI 0.160.0과 `gpt-6-luna` medium으로 32회 실행했고 캐시된 입력도 토큰에 포함했다.

도구 다섯 개를 노출하면 첫 요청이 780토큰 늘었다. 도구 설명 원문은 토크나이저로 세었을 때 183토큰에서 91토큰으로 줄었지만 설명만 바꾼 조건의 첫 요청은 네 문항 모두 같았다. 두 번째 요청도 차이가 최대 1토큰이었다. 780토큰에는 도구가 노출되는 방식과 명세를 포함한 Codex의 입력 구성이 반영돼 있다.

검색 결과를 확인해 보니 같은 내용이 `content`의 들여쓴 JSON 텍스트와 `structuredContent`의 JSON에 한 번씩 들어 있었다. 구조화 JSON만 보냈을 때 검색 직후 요청의 입력이 문항별로 중앙값 **968.5토큰** 줄었다. 텍스트 사본을 한 줄로 줄였을 때는 292토큰 줄었고 후보를 여섯 건에서 세 건으로 줄인 경우에는 629토큰 줄었다. 서버의 성공 응답은 결과를 `structuredContent`에만 담도록 바꿨다. [MCP 응답 구현](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/src/text2sql_mcp/server.py)

후보가 빈 배열이어도 도구 호출 뒤에는 모델 요청이 한 번 더 생겼다. 기존 DDL과 질문, 도구 호출 기록까지 포함한 입력 중앙값은 8,620.5토큰이었다. 한 번에 후보를 적게 주는 설정을 볼 때 응답 크기와 함께 검색 횟수도 세었다.

### 6.3 검색 한 건으로 시작한 결과

토큰을 줄이고 나서 쿼리 결과도 확인했다. 앞의 실험에서 생성한 SQL 32개를 SQLite에서 실행해 예상한 열과 행의 값이 나오는지 채점했다. 처음 네 문항에선 두 사본을 보냈을 때 4개를 맞혔고 구조화 JSON만 보냈을 때는 2개를 맞혔다. 후보를 여섯 건에서 세 건으로 줄인 조건은 4개를 맞혔다. 같은 네 문항에 응답 형식 두 가지를 각각 두 번 더 적용해 보니 두 조건 모두 8개 중 6개를 맞혔다. 첫 회에 나왔던 차이는 두 차례의 추가 실행에서 반복되지 않았다.

다음에는 Olist 개발셋 49문항으로 검색을 시작하는 건수를 비교했다. 운영 Graph MCP의 Olist 정의 12와 구조화 JSON 응답을 공통으로 사용했다. 모델에는 같은 질문과 DDL을 주고 두 조건 모두 필요한 경우 검색 범위를 최대 여섯 건까지 넓힐 수 있게 했다. 문항마다 조건별로 한 번씩 SQLite SELECT를 생성해 같은 DB에서 실행 결과를 채점했다.

세 건으로 시작하면 41/49문항(83.7%)을 맞혔다. 한 건으로 시작한 결과는 40/49문항(81.6%)이었다. 둘 다 맞은 문항은 35개였다. 세 건 쪽에서만 맞은 문항은 여섯 개였고 한 건 쪽에서만 맞은 문항도 다섯 개였다.

고객 주소 기준으로 평균 배송이 가장 오래 걸린 주 다섯 곳을 묻는 문항에서는 한 건으로 시작한 쪽이 같은 검색을 세 건으로 넓혔다. 두 쿼리 모두 정답이었다. 이렇게 한 건으로 시작했다가 같은 검색어로 범위를 넓힌 문항은 11개였다. 전체 검색 호출은 세 건 시작에서 66회였고 한 건 시작에서 68회였다. 캐시된 입력까지 포함해서 같은 문항끼리 비교하면 한 건 시작의 모델 입력은 중앙값 187토큰 줄었다.

### 6.4 플러그인 버전과 채점 방식

플러그인 버전을 비교할 때는 응답을 읽는 방식부터 점검해야 했다. 11월 27일판으로 49문항을 세 번 돌렸을 때 처음 집계는 108/147이었다. `$ask`가 질의 계획에 설명을 붙이자 JSON 하나만 읽던 평가기가 형식 오류로 처리했다. 같은 규칙으로 계획을 추출해 한 번씩 실행하니 27일판에서 정답 11건이 복구돼 119/147이었다. 직전판은 112/147이었다.

형식을 보정한 뒤에도 22일에 기록한 136/147과 차이가 났다. 27일판에서 실행 실패가 11건 늘었고 결과가 틀린 경우는 6건 늘었다. 남은 오답 28건은 SQL을 고쳐 같은 실행기에서 모두 정답을 확인했다. 판매자 지역을 묻는데 고객 지역으로 집계한 쿼리가 있었다. 리뷰 이력을 반복해서 읽던 쿼리는 집계를 한 번만 하도록 고치자 10초 제한에 걸리던 실행이 0.55초에 끝났다.

22일 평가에서는 관련 Graph 정의를 미리 골라 넣었다. 23일에 같은 방식으로 반복했을 때는 130/147이었다. 27일판이 만든 SQL을 고정해 각 실행기가 지원하는 명령으로 돌리니 22일판 118/147과 27일판 119/147로 한 건 차이였다. 정의 제공 방식과 SQL 생성 편차가 각각 얼마나 영향을 줬는지는 확인하지 못했다.

실제로 실행한 결과를 채점하도록 평가기를 고치고 `context`와 `schema` 호출은 실행 횟수에서 뺐다. 두 버전을 같은 Graph와 DB에 연결해 한 번 더 비교했다. 22일판 `e250ebb`은 첫 실행 38/49에서 최종 43/49였고 27일판 `a538fbc`는 41/49에서 45/49였다. 같은 조건에서 다시 돌렸을 때 앞서 보인 하락은 반복되지 않았다. 두 문항 차이는 한 회에서 관측한 값이다.

### 6.5 SQL 재시도 후의 정답률

평가기 `d10fe49`로 27일판 `a538fbc`를 세 회 평가했다. 1회차는 앞의 비교에서 실행 조건이 같은 기록을 사용했다. 2회차와 3회차는 새로 돌렸다. 모델에는 실행 오류와 결과 열 이름을 돌려줘 처음 실행한 SQL을 고칠 수 있게 했다. 정답과 결과 행은 로컬에서만 비교했다. [평가기 구현](https://github.com/zisu17/text2sql/blob/d10fe49947b335b71656393ce9b6492b36009d54/evals/run_ask_comparison.py)

| 회차 | 최초 실행 | 최종 결과 |
|---|---:|---:|
| 1회차 · 동일 조건의 기존 기록 | 41/49 | 45/49 |
| 2회차 · 새 실행 | 38/49 | 45/49 |
| 3회차 · 새 실행 | 40/49 | 44/49 |

도구의 첫 실행에서는 119/147건(81.0%)을 맞혔다. 재시도 뒤 최종 결과는 **134/147건(91.2%)**이었다. 처음에 틀린 15건이 정답으로 바뀌었다. 신규·기존 고객별 결제액을 구하는 문항과 저평점 리뷰 비율의 날짜별 차이를 구하는 문항은 세 회 모두 오답이었다.

### 6.6 정답표가 없는 환경에서 SQL 후보를 고르는 방법

“지역별 매출”을 물었을 때 두 SQL이 모두 고객 주소로 집계하면 같은 숫자가 나올 수 있다. 사용자가 뜻한 게 판매자 소재지였다면 두 SQL 모두 질문을 잘못 읽은 셈이다. 운영 DB에서 두 쿼리를 실행해 확인할 수 있는 것은 결과가 일치한다는 데까지다.

A4 조기 종료 실험은 Luna가 같은 질문으로 SQL 두 개를 독립적으로 만들게 했다. 둘 다 성공하고 잘리지 않은 결과가 같으면 거기서 멈췄다. 결과가 다르거나 하나가 실패하면 세 번째 SQL을 만들었다. Olist 49문항을 세 번 풀면서 모델을 325회 호출했다. 매번 세 후보를 만든 실험은 441회 호출했고 두 방식 모두 136/147건을 맞혔다. 두 실험에서 SQL은 각각 새로 생성했다. [11월 22일 실험 보고서](https://github.com/zisu17/text-to-sql-study/blob/072eae7/experiments/pipeline/runs/member-sujeong-20261122-r4/member-report.md)

선택 자체가 얼마나 도움이 됐는지 보려고 조기 종료 실험에서 저장한 첫 SQL만 다시 채점했다. 첫 SQL은 130건을 맞혔다. 후보를 고른 뒤 새로 맞힌 7건 중 5건은 첫 SQL을 실행할 수 없었던 경우였다. 2건은 첫 SQL이 실행됐지만 값이 틀렸고 반대로 처음에 맞힌 1건은 후보를 바꾸면서 틀렸다. 이 실험에서는 SQL 수정 호출이 0회였다. 기존 플러그인도 실행 오류를 보고 SQL을 고치므로 위의 6건을 재시도에 더해 얻는 이득으로 볼 수는 없다. [후보별 실행 기록](https://github.com/zisu17/text-to-sql-study/blob/072eae7/experiments/pipeline/runs/member-sujeong-20261122-r4/records.jsonl)

0.7.1 플러그인에서 Olist 49문항을 기본 모드와 A4 요청으로 한 번씩 풀었다. 두 모드 모두 실행 결과를 검토하고 SQL을 최대 세 번 수정할 수 있었다.

| 모드 | 첫 쿼리 정답 | 수정 전 채택한 쿼리의 정답 | 최종 정답 | 문항당 지연 중앙값 |
|---|---:|---:|---:|---:|
| 기본 | 39/49 | 39/49 | 42/49 | 47.77초 |
| A4 요청 | 37/49 | 42/49 | 43/49 | 77.23초 |

A4는 후보를 고르는 단계에서 5건을 만회했다. 기본 모드도 SQL을 수정하면서 3건을 더 맞혔다. 최종 결과에서 A4만 맞힌 문항은 6개였고 기본 모드만 맞힌 문항은 5개였다. 이번 비교에서 최종 정답 차이는 한 문항이었고 A4의 지연 중앙값은 29.46초 더 길었다. 이 결과를 보고 **0.7.2에서 A4 옵션을 제거했다.** 현재 `ask`는 쿼리 하나를 실행한 뒤 집계 대상과 단위, 필터를 점검하고 필요한 부분을 고친다. 질문과 지표 정의를 봐도 업무 기준이 모호하면 사용자에게 묻는다.

---

## 7. 모델이 늘어날 때의 검색 범위

에이전트에 한 건을 보내도 Neo4j가 읽는 후보는 더 많을 수 있다. 지금은 여러 모델이 전문 검색 인덱스를 공유한다. Cypher의 `SEARCH` 안에서 전체 상위 몇 건을 먼저 잘라 버리면 모델 필터를 적용한 뒤 필요한 후보를 놓칠 수 있다. 현재는 `Definition` 노드 수를 검색 후보의 상한으로 잡고 모델과 버전에 맞는 후보에 응답 한도를 적용한다. 모델이 늘어날수록 검색에서 읽고 거르는 후보 수도 함께 봐야 한다. [Cypher의 SEARCH 절](https://neo4j.com/docs/cypher-manual/current/clauses/search/) · [검색 구현](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/src/text2sql_mcp/graph_repository.py)

실행 쪽에서도 한 번에 읽는 정의의 크기는 계속 커질 수 있다. 서버의 JSON 한도는 도구 결과 128 KiB와 스냅샷 1 MiB다. 업무 영역별로 모델을 나누면 한 번에 받는 스냅샷은 작아질 수 있다. 그 경우 여러 영역을 함께 써야 하는 지표에서 조인 경로를 어떻게 찾을지도 같이 점검해야 한다.

---

## 8. 정리

처음에는 지난달 매출에 필요한 정의 몇 개만 골라 올 방법이 필요했다. 그 흐름을 만들고 보니 같은 지표를 지역별 순위에도 쓸 수 있었고 검색과 실행 사이에 정의가 바뀌는 경우도 다룰 수 있었다.

다음 모델을 연결할 때는 찾는 지표가 첫 결과에 있는지부터 기록할 생각이다. 처음에 읽는 결과를 줄인 만큼 다시 검색하는 일이 늘어나는지도 함께 봐야 기본 반환 건수를 정할 수 있다.
