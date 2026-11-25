---
title: "[Text2SQL] 대규모 메타데이터 환경을 위한 지표 검색과 SQL 실행 설계"
excerpt: "질문에 맞는 지표 후보만 AI에 전달하고 실행 엔진이 같은 버전의 정의로 SQL을 실행하는 구조를 Olist 사례와 함께 정리한다."
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
last_modified_at: 2026-11-25
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

실무 환경에서는 테이블이 수천에서 수만 개에 이를 수 있다. 테이블마다 컬럼 이름과 자료형이 있고 여기에 업무 용어, 지표 계산식, 조인 키가 더해진다. 정의는 파일로 관리할 수 있다. 질문을 처리할 때 에이전트가 관련 정의를 찾으려고 큰 파일을 읽으면 읽은 내용만큼 모델 입력이 늘어난다.

‘지난달 매출’을 묻는다면 상품 가격 합계와 결제 금액의 차이, 매출에서 제외하는 주문 상태, 기간을 자를 날짜를 알아야 한다. 고객의 지역별로 계산하려면 매출 정의에 더해 고객 데이터셋과 조인 키가 필요하다. 어떤 정의를 가져올지는 질문마다 달라진다.

앞서 만든 플러그인은 로컬 Ossie 파일에서 정의를 읽었다. 파일을 관리하는 방식은 그대로 써도 질의에서는 필요한 항목을 빠르게 찾아 소량의 정보로 지표를 고를 수 있어야 했다. 이 요구를 기준으로 에이전트가 읽는 검색 결과와 실행 엔진이 읽는 정의의 범위를 따로 정했다.

---

## 2. 시맨틱 정의의 게시와 조회 경로

### 2.1 Ossie 파일과 Neo4j의 역할

지표와 데이터셋의 정의는 Ossie YAML에서 관리한다. 게시 전에는 원본 DB 카탈로그와 대조해 정의에 쓴 컬럼이 있는지 확인한다. SQL 조회문을 소스로 쓰는 데이터셋은 조회문의 출력이 실제 어느 컬럼에서 오는지 파악하고 조인에 쓰는 키도 기록한다. 이 과정을 거쳐 정의와 물리 컬럼 사이의 관계를 Neo4j에 게시한다.

Neo4j에서 공통 `Definition` 라벨은 검색할 범위를 정한다. `Dataset`, `Field`, `Metric` 라벨로는 검색 대상을 좁힐 수 있다. 지표를 찾은 뒤 필요한 경우에만 정의된 관계를 따라 값이 어느 컬럼에서 오는지 또는 다른 데이터셋과 어떻게 조인하는지 확인할 수 있다. 현재 조회 구현에서는 주로 `HAS`, `DERIVED_FROM`, `JOINS`를 사용한다. [그래프 게시 코드](https://github.com/zisu17/semantic-definitions/blob/05c80aac41caa1052371062f6bc492354029a15a/graphdb/neo4j_writer.py)

### 2.2 검색 도구와 실행용 스냅샷

Neo4j에 저장한 정의를 에이전트에서 찾을 수 있도록 검색 서버를 만들었다. 서버가 검색, 상세 조회, 조인 경로 확인을 MCP(Model Context Protocol) 도구로 제공해서 프로젝트에서 이 서버를 Graph MCP라고 부른다. 에이전트는 질문에서 뽑은 단어를 도구에 넘기고 지표의 이름과 설명, 동의어, 승인 상태를 받는다.

SQL을 생성하는 `t2s`에는 그보다 많은 정보가 필요하다. 매출은 주문 상품의 가격을 합산하지만 기간은 주문일로 자른다. 따라서 엔진은 집계식 외에 데이터셋의 소스, 기본키, 조인 조건까지 읽어야 한다. 이 실행용 정의 전체를 스냅샷이라고 부르고 `t2s`가 인증된 HTTP 경로에서 직접 가져오게 했다. 초기 구현에서 MCP 도구로 제공하던 스냅샷은 0.3.0부터 별도 HTTP 경로로 옮겼다. 에이전트의 입력에는 도구가 반환한 후보와 추가로 조회한 상세 정보가 들어간다. [Graph MCP 조회 계약](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/docs/graphdb-mcp-design.md)

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

검색 결과와 스냅샷은 Neo4j의 활성 모델에서 가져온다. 매출 합계나 주문 내역을 계산하는 쿼리는 `t2s`에서 원본 DB로 보낸다. Graph 검색 연결과 원본 DB 읽기 전용 연결은 각각 설정한다.

---

## 3. 지표 검색과 상세 조회

### 3.1 전문 검색 인덱스와 한글 동의어

지표 이름이 `revenue`여도 질문에는 ‘매출’이나 ‘판매액’ 같은 표현이 들어온다. 이 표현을 찾을 수 있도록 지표 이름과 함께 정의에 등록한 설명과 동의어를 색인했다. 게시기가 만드는 Neo4j 전문 검색 인덱스는 다음 네 속성을 사용한다.

```cypher
CREATE FULLTEXT INDEX definition_text IF NOT EXISTS
FOR (n:Definition) ON EACH [n.ref, n.name, n.description, n.synonyms]
OPTIONS {indexConfig: {`fulltext.analyzer`: 'cjk'}}
```

분석기는 Lucene의 `cjk`를 쓴다. 연속한 한글을 두 글자 단위로 나누므로 ‘매출’로 ‘매출액’을 찾을 수 있다. 검색 요청에는 질문 전체보다 ‘매출’ 또는 ‘발송 기한’처럼 업무 용어를 넘긴다. 검색어에 여러 단어가 있으면 각 단어를 OR로 묶어 후보를 얻는다. 등록된 동의어와 설명에 어떤 표현을 넣는지가 후보에 영향을 준다. [Neo4j 전문 검색 인덱스](https://neo4j.com/docs/cypher-manual/current/indexes/search-indexes/full-text-indexes/) · [검색 구현](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/src/text2sql_mcp/graph_repository.py)

### 3.2 활성 모델 필터와 응답 건수

에이전트는 `graph_list_models`로 활성 모델을 확인한다. 지표를 찾을 때는 `kinds: ["Metric"]`으로 범위를 좁힌다. 검색 서버는 테넌트, 모델, 활성 버전이 맞는 정의만 반환한다. 그 범위에서 참조명, 이름, 동의어의 정확한 일치를 순서대로 우선한다. 같은 우선순위에 있는 결과는 Lucene의 관련도 점수(BM25)로 정렬한다. 인덱스가 없거나 아직 조회할 수 없으면 부분 일치 검색으로 돌아가고 응답의 `search`에 검색 방식을 남긴다.

서버는 기본으로 후보 한 건을 반환한다. 반환 한도보다 한 건 더 조회해 추가 후보가 있는지 `has_more`에 표시한다. 에이전트는 첫 후보의 집계 대상과 기간 기준을 질문과 대조한다. 맞는 승인 지표를 찾지 못했고 추가 후보가 있으면 `limit=3`으로 범위를 넓힌다. 검색어를 바꾸거나 기준을 추가로 확인하는 것도 가능하다. 계산 기준이 모호해 값이 달라질 수 있으면 사용자에게 기준을 확인한다. [플러그인의 지표 선택 절차](https://github.com/zisu17/text2sql-plugin/blob/e5b59a8a8e4b84eb256bc9414767cc371f5e6ddb/skills/ask/SKILL.md)

여기에는 서버 쪽 비용이 남는다. 현재 전문 검색 인덱스는 여러 모델이 공유하고 `SEARCH` 안의 `LIMIT`은 바깥쪽의 모델 필터보다 앞에 적용된다. 인덱스에서 전체 상위 세 건만 가져오면 다른 모델의 결과 세 건이 먼저 나와 대상 모델의 후보가 누락될 수 있다. 그래서 현재 구현은 `Definition` 노드 수를 인덱스 후보 상한으로 사용한 뒤 모델과 버전을 거르고 최종 응답 건수를 적용한다. 응답 건수는 모델이 받는 정보량을 제한한다. 인덱스 후보 수는 모델이 늘어나면 별도로 커질 수 있다. [Cypher의 SEARCH 절](https://neo4j.com/docs/cypher-manual/current/clauses/search/) · [검색 구현](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/src/text2sql_mcp/graph_repository.py)

### 3.3 계산식과 조인 키의 추가 조회

검색 후보에서 계산 기준을 더 확인해야 할 때는 도구를 한 번 더 부른다. 질문에 따라 필요한 정보의 종류가 다르다.

| 확인할 내용 | 도구 | 읽는 범위 |
|---|---|---|
| 주문일로 쓸 필드 | `graph_get_dataset` | 주문 데이터셋의 필드 설명과 자료형 |
| 매출을 합산하는 컬럼과 제외 조건 | `graph_get_metric_lineage` | 지표 계산식과 해당 필드의 물리 컬럼 |
| 매출 데이터셋에서 주문일을 가져올 연결 | `graph_find_join_path` | 데이터셋 사이의 연결, 키, 승인 상태 |

Olist에서 매출 계보를 조회하면 가격의 출처는 `order_items.price`이고 주문 상태 조건의 출처는 `orders.order_status`다. `order_lines`는 주문 상품을 기준으로 주문, 고객, 판매자 값을 붙이는 SQL 데이터셋이다. 이 SQL 안에서 사용한 조인 키는 어떤 행이 계산에 포함되는지에 영향을 줄 수 있어 값의 출처와 별도로 응답한다.

조인 경로를 조회하면 `order_lines → order_items → orders`가 나온다. 첫 연결은 주문 ID와 상품 순번을 함께 쓰고 두 번째는 주문 ID를 쓴다. 경로의 `n_to_1`은 도착 쪽 키가 정의된 기본키 또는 고유 키와 맞는지 확인한 값이다. DB에서 실제로 키가 유일한지는 정의 검증에서 별도로 확인할 항목이다. [계보와 조인 경로 반환 형식](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/docs/graphdb-mcp-design.md)

---

## 4. 실행용 정의의 버전 확인과 캐시

### 4.1 검색과 실행 사이의 정의 변경

정의를 게시할 때 파일 이름과 내용으로 버전 해시를 만든다. 게시기는 새 버전의 노드와 관계를 적재하고 활성 버전을 교체한 뒤 이전 정의 노드를 정리한다. 이 작업은 한 쓰기 트랜잭션으로 묶었다. 각 조회 도구는 하나의 읽기 트랜잭션 안에서 활성 버전을 확인하고 그 버전의 정의를 조회한다. 응답에는 `model`과 `version_id`를 포함한다. [게시 코드](https://github.com/zisu17/semantic-definitions/blob/05c80aac41caa1052371062f6bc492354029a15a/graphdb/neo4j_writer.py) · [조회 코드](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/src/text2sql_mcp/graph_repository.py)

질문 한 건에서 도구를 여러 번 호출하면 그 사이에도 활성 버전이 바뀔 수 있다. 예를 들어 매출 지표를 찾은 다음 취소 주문의 처리 기준을 바꾼 정의가 게시될 수 있다. 에이전트에는 검색에 사용한 응답의 모델과 버전을 기록하도록 했다. `t2s`를 부를 때는 `GRAPH_MODEL`과 `GRAPH_VERSION_ID`로 전달한다. `t2s`는 그 모델의 현재 스냅샷을 받아 버전을 대조한 뒤 SQL을 만든다. [CLI의 버전 검사](https://github.com/zisu17/text2sql-plugin/blob/e5b59a8a8e4b84eb256bc9414767cc371f5e6ddb/t2s/cli.py)

<figure class="tlv">
<div class="tlv-compare">
  <div class="tlv-col"><div class="hd"><span class="tlv-chip is-good">버전 일치</span></div><div class="bd"><code>검색 A → 스냅샷 A</code><p>검색에서 고른 지표를 버전 A로 컴파일한다.</p></div></div>
  <div class="tlv-col"><div class="hd"><span class="tlv-chip is-bad">버전 변경</span></div><div class="bd"><code>검색 A → 스냅샷 B</code><p>CLI가 SQL 생성 전에 오류를 반환한다. 새 정의로 지표를 다시 확인한다.</p></div></div>
</div>
<figcaption class="tlv-cap"><b>그림 2.</b> 검색 뒤 활성 버전이 바뀌면 새 정의에서 지표를 다시 확인한다.</figcaption>
</figure>

### 4.2 서버 캐시와 HTTP 재검증

스냅샷을 만들 때 서버는 모델, 데이터셋, 필드, 지표, 연결을 읽어 실행용 Ossie 구조로 재구성한다. 같은 버전의 요청이 반복되면 이 작업을 줄일 수 있다. 서버는 완성된 스냅샷을 테넌트, 모델, 버전별로 메모리에 최대 8개 보관한다. 같은 활성 버전이 들어오면 버전을 확인한 뒤 이미 만든 정의를 재사용한다.

CLI에 검색 버전이 전달됐고 해당 버전의 응답을 로컬에 보관해 둔 경우에는 `If-None-Match`로 이전 응답의 ETag를 보낸다. 서버는 인증을 확인하고 현재 응답 내용의 ETag와 비교한다. 일치하면 본문 없이 `304 Not Modified`를 응답한다. 활성 버전이 바뀌어 새 본문이 오면 CLI는 검색에서 받은 버전과 다시 비교한다. 서버 캐시는 Neo4j 조회를 줄이고 HTTP 재검증은 본문 재전송을 줄인다. CLI는 캐시가 있어도 HTTP 요청을 보내며 서버는 활성 버전을 확인한 뒤 현재 응답의 ETag를 계산한다. [서버의 조건부 응답](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/src/text2sql_mcp/http_app.py) · [CLI의 스냅샷 캐시](https://github.com/zisu17/text2sql-plugin/blob/e5b59a8a8e4b84eb256bc9414767cc371f5e6ddb/t2s/graph_client.py)

---

## 5. 매출 지표의 SQL 생성과 실행

### 5.1 검색 후보와 계산 기준

로컬 Neo4j에 Olist 정의를 게시한 뒤 `graph_search_definitions(query="매출", kinds=["Metric"], model="olist_sales")`로 조회했다. 기본 응답에는 `revenue` 한 건이 들어 있었고 `has_more`는 참이었다. 같은 검색에서 `limit=3`을 지정하니 승인 지표 두 개가 나왔다.

| 검색 결과 | 집계 기준 | 주문 상태 |
|---|---|---|
| `order_lines.revenue` | 주문 상품의 가격 합계. 배송비 제외 | 취소·판매 불가 제외 |
| `order_items.item_price_total` | 주문 상품의 가격 합계. 배송비 별도 | 모든 상태 포함 |

같은 가격 컬럼을 합산해도 적용하는 주문 상태가 다르다. 이 예시에서는 ‘매출’이 동의어로 등록된 `order_lines.revenue`를 사용했다. 주문 데이터셋의 `order_purchase_timestamp`는 주문일시이며 해당 지표의 기간 기준에도 부합한다. [Olist Ossie 정의](https://github.com/zisu17/semantic-definitions/blob/05c80aac41caa1052371062f6bc492354029a15a/definitions/olist/sales.ossie.yaml)

### 5.2 승인 지표 컴파일

기준일을 2017년 11월 1일로 두면 ‘지난달’은 10월 1일 이상 11월 1일 미만이다. 지표와 검색에서 받은 모델 버전, 기간 조건을 `t2s compile`에 전달한다. 실제 실행에는 Graph 서버 접속 설정과 Olist SQLite의 읽기 전용 접속 설정을 사용한다.

```bash
export GRAPH_MODEL=olist_sales
export GRAPH_VERSION_ID='<검색 응답의 version_id>'

t2s compile order_lines.revenue \
  --where "orders.order_purchase_timestamp >= '2017-10-01'" \
  --where "orders.order_purchase_timestamp < '2017-11-01'" \
  --run
```

엔진은 지표의 집계식과 제외 조건을 읽는다. 기간 필드는 주문 데이터셋에 있으므로 앞에서 조회한 연결을 SQL에 적용한다. `--run`을 붙이면 생성한 SQL을 검사하고 DB에서 실행한다. 로컬 검증에서는 같은 버전의 Neo4j 스냅샷을 CLI에 전달해 실행했고 원본 주문 상품과 주문 테이블에 직접 같은 조건을 적용한 SQLite 쿼리와 대조했다. 두 결과 모두 **660,179.62**였다.

질문을 승인 지표와 엔진이 지원하는 차원·필터로 표현할 수 있으면 이 경로를 먼저 사용한다. 에이전트는 지표명과 기간을 고르고 집계식과 조인 조건은 정의에서 가져온다. 주문 내역처럼 원본 테이블의 행을 조회하는 경우에는 물리 테이블 기준의 SQL을 `t2s run`에 전달한다. [실행 경로 선택 규칙](https://github.com/zisu17/text2sql-plugin/blob/e5b59a8a8e4b84eb256bc9414767cc371f5e6ddb/skills/ask/SKILL.md)

### 5.3 같은 지표를 쓰는 복합 집계

‘지난달 고객 주별 매출 1위 카테고리’에서는 같은 매출 지표를 고객 주와 카테고리로 집계한 뒤 각 주 안에서 1위를 선택한다. 이 경우 에이전트는 쿼리의 구조를 작성하고 매출 계산은 `AGG(l.revenue)`로 참조한다. 이 SQL을 `t2s sql`로 실행했다.

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

카테고리가 비어 있는 행은 제외했다. 동률이면 카테고리명 순으로 한 행을 고른다. 원본 테이블에서 동일한 기준으로 작성한 쿼리와 비교했을 때 고객 주별 **27행**이 모두 일치했다.

조인에서 지표의 행 단위가 중요한 이유도 같은 샘플로 확인했다. 한 주문에 결제 행이 여러 개면 주문 상품을 결제 테이블에 붙였을 때 동일 상품 행이 늘어난다. 같은 기간에 결제 행을 붙이고 일반 `SUM(price)`를 쓰니 합계가 **689,353.19**로 늘었다. 같은 조인에 `AGG(l.revenue)`를 쓰면 엔진이 상품의 복합키 `(order_id, order_item_id)`마다 한 행을 골라 합산한다. 이 경우 결제 테이블을 붙이기 전의 매출과 같았다. [AGG 변환 코드](https://github.com/zisu17/text2sql-plugin/blob/e5b59a8a8e4b84eb256bc9414767cc371f5e6ddb/t2s/measures.py)

---

## 6. 응답 크기와 전체 질의 비용

### 6.1 같은 버전의 검색 결과와 스냅샷

Olist 로컬 검증에 사용한 그래프에는 정의용 데이터셋 10개, 필드 63개, 지표 28개, 연결 규칙 9개가 있었다. 같은 활성 버전에서 ‘매출’ 후보 두 건을 담은 검색 결과, 매출 지표 계보, 주문 데이터셋으로 가는 조인 경로, 실행용 스냅샷을 각각 받았다. 네 응답 객체를 같은 설정으로 UTF-8 JSON으로 직렬화했다.

<figure class="tlv">
<div class="tlv-bars" role="img" aria-label="매출 지표 검색 응답 904바이트, 검색과 계보와 조인 경로 응답 합계 3768바이트, 실행용 스냅샷 40240바이트">
  <div class="tlv-bar-row"><span class="k">지표 검색</span><span class="tlv-track"><i style="--w:2.2465%"></i></span><span class="v">904</span></div>
  <div class="tlv-bar-row"><span class="k">검색·계보·조인 경로</span><span class="tlv-track"><i style="--w:9.3638%"></i></span><span class="v">3,768</span></div>
  <div class="tlv-bar-row"><span class="k">실행용 스냅샷</span><span class="tlv-track"><i class="is-mute" style="--w:100%"></i></span><span class="v">40,240</span></div>
</div>
<figcaption class="tlv-cap"><b>그림 3.</b> 같은 Olist 모델에서 조회한 응답의 UTF-8 JSON 크기를 바이트로 비교했다.</figcaption>
</figure>

지표 후보 두 건을 담은 검색 결과는 실행용 스냅샷의 약 **2.2%**였다. 추가로 요청한 매출 계보는 2,231바이트였고 주문 데이터셋까지의 조인 경로는 633바이트였다. 그림의 수치는 응답 객체의 JSON 본문만 잰 값이다. 실제 모델 입력은 도구 명세와 대화 기록에 따라서도 달라진다.

### 6.2 Olist 개발 평가의 토큰과 지연

전체 질의에서 드는 비용은 별도로 확인했다. Olist 개발 평가셋 49문항을 각 세 번 실행한 기록에는 전체 DDL을 준 기준 조건과 같은 DDL에 원격 Graph 도구 조회를 추가하고 `t2s`로 실행한 조건이 있다. 두 조건의 모델과 문항은 같고 SQL 생성 지시 및 실행 경로는 각 조건에 맞게 구성했다.

| 관측값 | 전체 DDL과 SQLite 직접 실행 | 전체 DDL과 Graph 조회 및 t2s |
|---|---:|---:|
| 캐시 제외 모델 입력 토큰 합계 | 539,060 | 1,293,176 |
| 문항 처리 시간 중앙값 | 9.51초 | 19.68초 |
| Graph 도구 1회 중앙값 | 해당 없음 | 1.58초 |
| 스냅샷 HTTP 1회 중앙값 | 해당 없음 | 2.55초 |

전체 DDL을 제공한 Olist 평가에서 Graph 조회를 포함한 조건의 입력 토큰과 질의 처리 시간이 늘었다. 위 토큰은 질의 전체를 합산한 값이다. 모델 요청별 기록을 남기지 않아 도구 명세와 검색 응답이 각각 얼마나 기여했는지는 이 집계에서 확인할 수 없었다.

스냅샷 HTTP 시간은 또 다른 비용이다. 로컬 점검에서는 초기 응답 200과 같은 ETag를 보낸 조건부 응답 304를 확인했다. 위 표의 운영 서버는 평가 당시 ETag를 반환하지 않았으므로 표에서 캐시의 효과를 계산하기는 어렵다. 로컬 응답의 크기 측정과 원격 질의 시간은 서로 다른 관측이다.

### 6.3 모델 요청별 입력 토큰 재생 실험

기존 평가에서 Graph 검색을 한 번 호출해 후보 6개를 받은 문항 4개를 골랐다. 전체 DDL과 질문 및 필수 조건은 이전 실행과 같은 해시인지 확인했다. 검색 인자와 응답을 고정해 로컬 MCP 서버에서 재생하고 같은 Codex CLI 0.160.0과 `gpt-6-luna` medium을 사용했다. 조건마다 각 문항을 한 번씩 실행해 32건을 기록했다. Codex 실행 로그에서 모델 요청별 사용량을 추출해 턴 종료 시 보고된 합계와 대조했다.

후속 실험은 입력 구성의 크기를 비교하기 위해 캐시된 입력을 포함한 토큰을 사용했다. 변화량은 같은 문항에서 바꾼 항목의 전후를 비교한 뒤 중앙값을 냈다.

| 바꾼 항목 | 비교한 요청 | 입력 토큰 변화 |
|---|---|---:|
| Graph 도구 5개 노출 · 도구 호출 없음 | 첫 요청 | +780 |
| 검색·조인 경로 도구의 설명 축약 | 첫 요청 · 두 번째 요청 | 0 · 0 |
| 검색 후보 6개 → 빈 목록 | 두 번째 요청 | −1,437.5 |
| 텍스트와 구조화 JSON → 구조화 JSON만 | 두 번째 요청 | −968.5 |
| 텍스트 사본을 한 줄 JSON으로 변경 | 두 번째 요청 | −292 |
| 검색 후보 6개 → 3개 | 두 번째 요청 | −629 |

서버가 보낸 5개 도구의 설명은 `o200k_base`로 추정했을 때 183토큰에서 91토큰으로 줄었다. 설명만 바꾼 조건에서 첫 요청의 토큰 수는 문항 네 개 모두 같았다. 두 번째 요청에서 관측된 차이도 최대 1토큰이었다. 첫 요청에서 확인한 780토큰 증가는 Graph 도구를 노출할 때 Codex가 구성하는 입력 전체의 차이다.

원래 응답 형식으로 실행했을 때 Codex에 기록된 도구 출력에는 동일한 결과가 `content`의 들여쓴 텍스트와 `structuredContent`의 JSON으로 들어 있었다. 구조화 JSON만 전달했을 때 두 번째 요청에서 문항별로 868~972토큰이 줄었다. 검색 후보 수를 줄였을 때의 변화도 확인했으며 이 실험에서는 SQL 정답률을 별도로 채점하지 않았다.

도구를 호출한 조건은 모두 모델 요청이 두 번 발생했다. 원래 응답의 입력 토큰 중앙값은 첫 요청 8,371토큰과 두 번째 요청 10,084.5토큰이었다. 후보를 비워도 두 번째 요청에는 기존 문맥과 도구 호출 기록이 포함돼 입력 중앙값이 8,620.5토큰이었다. 이 비교로 앞선 49문항의 증가분을 항목별로 역산할 수는 없다.

이후 서버 구현을 바꿔 성공 응답의 결과를 `structuredContent`에 한 번만 담았다. 플러그인도 한 건으로 검색을 시작해 맞는 승인 지표가 없고 추가 후보가 있을 때 범위를 넓히도록 바꿨다. 로컬 Olist에서 기본 조회와 `limit=3` 조회를 실행해 반환 건수와 응답 형식을 확인했다. 위 표는 이전 응답을 고정해 재생한 실험이며 새 기본값으로 49문항을 다시 평가해 얻은 수치는 없다. [MCP 응답 구현](https://github.com/zisu17/text2sql-mcp/blob/12c91b1d1e20b4356e28c0de6dc3dd9260bbc4be/src/text2sql_mcp/server.py)

---

## 7. 메타데이터가 늘어날 때의 검증 항목

테이블이나 모델을 늘릴 때는 먼저 검색의 첫 결과에서 답에 필요한 지표를 얼마나 자주 찾는지 확인해야 한다. 응답을 한 건으로 제한해도 넓은 검색어가 많은 정의에 일치하면 인덱스에서 가져오는 후보와 필터링 비용은 늘 수 있다. 활성 모델별로 검색 범위를 앞에서 좁히는 구조를 검토하려면 동일한 질문으로 후보 누락과 검색 지연을 함께 측정해야 한다.

실행용 정의도 규모에 영향을 받는다. 현재 서버는 도구 결과에 128 KiB, 스냅샷에 1 MiB의 JSON 크기 제한을 적용한다. 검색 결과의 크기는 후보 수를 줄여 제어할 수 있고 스냅샷 크기는 모델 안의 실행 정의 전체에 따라 달라진다. 모델을 업무 영역별로 나누면 한 번에 읽는 정의는 작아질 수 있지만 영역을 가로지르는 지표와 조인 경로도 함께 검토해야 한다.

이번에 확인한 규모는 Olist 샘플이다. 테이블이 수천 개 이상인 환경의 처리를 검증하려면 모델 수와 정의 수를 늘리면서 검색 적중률, 실제 모델 입력 토큰, 검색과 스냅샷의 P95를 각각 기록해야 한다. 그래야 검색 후보의 선별과 전체 질의 비용을 연결해 판단할 수 있다.

---

## 8. 정리

Olist에서 같은 매출 정의를 단일 집계와 고객 주별 순위 쿼리에 적용해 원본 SQLite 쿼리와 결과를 대조했다. 질문에 필요한 정의만 검색으로 가져오고 계산에 필요한 모델은 CLI가 별도로 읽는 방식으로 구성했다. 실무 규모에서 적용할 때는 응답이 작아지는 정도와 서버가 후보를 찾고 스냅샷을 전달하는 비용을 함께 봐야 한다.
