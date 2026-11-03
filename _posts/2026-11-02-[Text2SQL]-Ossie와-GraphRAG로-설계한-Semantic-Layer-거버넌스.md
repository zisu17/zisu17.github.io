---
title: "[Text2SQL] Ossie와 GraphRAG로 설계한 Semantic Layer 거버넌스"
excerpt: "Text2SQL 에이전트의 시맨틱 레이어를 Apache Ossie YAML로 두고 사용자 요청과 답변 기록에서 나온 정의 초안을 PR로 승인한 뒤 GraphRAG용 그래프로 내보내는 거버넌스 흐름 설계를 정리한다."
nav_section: projects
nav_topic: text2sql

categories:
  - Project
tags:
  - Data
  - Text2SQL
  - SemanticLayer
  - Apache Ossie
  - GraphRAG
  - Governance

permalink: /data/text2sql-ossie-graphrag-semantic-layer-governance/

toc: true
toc_sticky: true

date: 2026-11-02
last_modified_at: 2026-11-03
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

## 1. 배경

데이터 모델을 설계하다 보면 현업 담당자만 이해하는 지표나 용어가 많다. 같은 매출이라도 어떤 주문 상태를 빼고 계산하는지 어느 테이블을 어떤 키로 이어야 하는지는 스키마에 드러나지 않는다. LLM에는 이런 도메인 지식이 없어서 데이터 추출이나 분석에 쓸 SQL을 명확하게 만들기 어렵다고 느꼈다. 모델의 SQL 생성 능력이 좋아지는 것과는 별개의 문제이고 앞서 살펴본 dbt Labs 벤치마크에서도 정확도가 중요한 영역에서는 잘 모델링된 시맨틱 레이어가 여전히 앞섰다.

이런 도메인 지식을 구조화해 보려고 Text2SQL AI 에이전트를 개발하는 스터디에 참여했다. 지표와 용어, 테이블 사이의 연결을 LLM이 찾아 읽을 수 있게 정의해 두려면 시맨틱 레이어가 중요하다고 생각해서 스터디에서는 시맨틱 레이어와 검색 부분을 맡았다.

시맨틱 레이어를 맡고 보니 정의를 만드는 것만큼 정의를 관리하는 일도 문제였다. 사용자의 질문이 쌓이면 새 지표와 용어가 계속 생기고 같은 지표를 사람마다 다르게 정의해 달라고 요청하는 경우도 생긴다. 누가 정의를 추가하고 누가 승인하는지, 승인된 정의를 LLM이 어떻게 빨리 찾아 쓰는지까지 정해 두지 않으면 검증되지 않은 정의가 답에 섞일 수 있다. 그래서 정의 양식과 함께 정의를 관리하는 흐름을 설계해야 했다.

---

## 2. Ossie로 정의하고 GraphRAG로 검색하기

### 2.1 Apache Ossie를 선택한 이유

정의 양식은 Apache Ossie로 정했다. Ossie는 dbt나 Databricks 같은 도구가 시맨틱 모델을 공통 YAML 형식으로 주고받게 하려는 오픈 표준이다. 스터디에서 만든 결과를 실무에 옮기려면 정의가 특정 도구에 묶이지 않고 이종 시스템과 연계돼야 해서 표준화된 양식으로 개발되고 있는 Ossie를 써야겠다고 생각했다. 물론 아직까지는 인큐베이터에 있는 프로젝트지만 언젠간 많은 시스템의 표준으로 자리잡지 않을까 기대하고 있다. 본문은 Ossie 스펙 `0.2.0.dev0`을 기준으로 했다.

### 2.2 GraphRAG를 검색 계층으로 선택한 이유

검색 부분은 GraphRAG로 구성하기로 했다. 질문이 들어올 때마다 LLM에 정의 파일 전체를 넘기면 정의가 늘어나는 만큼 컨텍스트도 커진다. 정의를 그래프 DB에 노드와 관계로 옮겨 두면 질문에 나온 용어에서 관련 지표, 테이블, 조인 경로를 따라가 필요한 것만 가져올 수 있어서 LLM이 시맨틱 레이어를 빠르게 조회할 수 있다.

### 2.3 시맨틱 정의의 등록부터 조회까지

두 가지를 정한 뒤 공개 데이터셋 Olist로 PoC를 만들었다. 사용자가 질문하면 질문 에이전트가 쓸 지표를 고르고 엔진이 Ossie 정의를 읽어 SQL을 만든다. 정의를 추가하거나 고칠 때는 정의 에이전트와 대화하면서 초안을 다듬고 승인과 저장은 사람이 맡는다.

PoC를 만든 다음 정의를 실제로 운영할 흐름을 아래처럼 잡았다.

- 사용자가 자연어로 한 질의와 데이터 사전 등록 요청을 정리해 YAML로 저장하고 git으로 관리한다. 정식 등록 전까지는 초안으로 둔다.
- 등록 요청은 PR로 보내고 거버넌스 관리자가 검토해 머지한다. 머지된 YAML만 전환 스크립트를 거쳐 그래프 DB에 들어간다.
- 그래프 DB는 GraphRAG의 검색 저장소로 쓰고 이후 MCP를 통해 필요한 정의를 조회할 수 있도록 연결할 생각이다. 승인된 정의의 벡터는 그래프 적재 시 항상 함께 저장하고 조회할 때는 키워드와 동의어 검색을 기본으로 쓰되 필요한 경우 벡터 검색을 함께 사용한다.

정의의 정본은 git에 있는 YAML 파일로 두고 그래프 DB는 이 파일에서 다시 만들어 쓰는 사본으로 정했다. 사람이든 LLM이든 그래프를 직접 고치지 않는다. 사용자의 요청이 정의가 되고 그 정의가 다음 질문에 쓰이기까지의 흐름은 아래 그림처럼 두 줄로 나뉜다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 216" role="img" aria-label="요청과 사용 기록이 초안 브랜치, PR 검사, 사람 승인을 거쳐 YAML 정본이 되고, 정본에서 그래프 사본을 만들어 MCP로 조회하며 다음 질문으로 돌아간다">
  <defs><marker id="tlv-3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker><marker id="tlv-3-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk-accent" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <rect class="box" x="12" y="10" width="128" height="56" rx="4"/>
  <text class="t" x="24" y="32">요청·질문</text>
  <text class="s" x="24" y="50">사용자, 사용 기록</text>
  <path class="wire" d="M140 38 H168" marker-end="url(#tlv-3-arrow)"/>
  <rect class="box" x="172" y="10" width="128" height="56" rx="4"/>
  <text class="t" x="184" y="32">표준화 초안</text>
  <text class="s" x="184" y="50">코드와 LLM</text>
  <path class="wire" d="M300 38 H328" marker-end="url(#tlv-3-arrow)"/>
  <rect class="box" x="332" y="10" width="128" height="56" rx="4"/>
  <text class="t" x="344" y="32">PR 검사</text>
  <text class="s" x="344" y="50">검증기, 골든셋</text>
  <path class="wire" d="M460 38 H488" marker-end="url(#tlv-3-arrow)"/>
  <rect class="accent" x="492" y="10" width="128" height="56" rx="4"/>
  <text class="t" x="504" y="32">승인·머지</text>
  <text class="s" x="504" y="50">거버넌스 관리자</text>
  <path class="wire" d="M556 66 V93 H76 V118" marker-end="url(#tlv-3-arrow)"/>
  <rect class="box" x="12" y="120" width="128" height="56" rx="4"/>
  <text class="t" x="24" y="142">YAML 정본</text>
  <text class="s" x="24" y="160">git 머지 결과</text>
  <path class="wire" d="M140 148 H168" marker-end="url(#tlv-3-arrow)"/>
  <rect class="box" x="172" y="120" width="128" height="56" rx="4"/>
  <text class="t" x="184" y="142">그래프 전환</text>
  <text class="s" x="184" y="160">머지 때 자동 실행</text>
  <path class="wire" d="M300 148 H328" marker-end="url(#tlv-3-arrow)"/>
  <rect class="soft" x="332" y="120" width="128" height="56" rx="4"/>
  <text class="t" x="344" y="142">GraphDB 사본</text>
  <text class="s" x="344" y="160">다시 만드는 복제본</text>
  <path class="wire" d="M460 148 H488" marker-end="url(#tlv-3-arrow)"/>
  <rect class="box" x="492" y="120" width="128" height="56" rx="4"/>
  <text class="t" x="504" y="142">MCP 조회</text>
  <text class="s" x="504" y="160">조회 전용 도구</text>
  <path class="wire-accent dash" d="M556 176 V204 H4 V38 H10" marker-end="url(#tlv-3-arrow-a)"/>
  <text class="l" x="200" y="198">다음 질문은 그래프에서 정의를 찾는다</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> 사람은 승인·머지 단계에서만 개입하고 그래프는 머지될 때마다 정본에서 다시 만든다.</figcaption>
</figure>

위 프로세스로 정의가 만들어지고 아래 프로세스에서는 정의가 조회된다. 두 프로세스 사이에 거버넌스 관리자가 정의를 승인하고 머지하는 과정이 포함되어야 한다. 처음에는 사용자가 직접 요청할 때만 초안을 만들 생각이었는데 질문 에이전트의 답변 기록에서도 초안을 만들도록 흐름을 하나 더 붙였다.

이 흐름을 구현하기 전에 몇 가지를 더 정해야 했다. 초안을 어디에 둘지, 관리자가 보기 전에 무엇을 자동으로 검사할지, 그래프는 언제 어떻게 다시 만들지, MCP에 어떤 도구를 둘지 선택을 해야한다.

---

## 3. 시맨틱 정의를 생성하고 승인하는 과정

### 3.1 초안 폴더 대신 Git 브랜치를 선택한 이유

처음에는 정식 등록 전의 YAML을 초안 폴더에 따로 모아 둘 생각이었다. 그런데 Ossie는 파일 하나가 시맨틱 모델 하나라서 초안 폴더에는 모델 파일 전체의 사본이 들어가게 된다. 두 사람이 같은 모델에 지표를 하나씩 추가하면 초안 폴더에 전체 파일 사본이 두 개 생기고 본 파일로 합칠 때 사본끼리 충돌하게 된다.

그래서 초안은 폴더 대신 브랜치로 두기로 했다. 등록 요청마다 브랜치를 하나 만들고 PR이 곧 초안이 되며 머지하면 정식 등록이 된다. 충돌이 나더라도 git 머지에서 드러나고 지표 하나를 더한 정도의 변경은 보통 충돌 없이 합쳐진다.

| 기준 | 초안 폴더 | 초안 브랜치 |
|---|---|---|
| 초안 단위 | 모델 파일 전체 사본 | 변경한 줄 |
| 동시 요청 | 사본끼리 수동 병합 | git 머지, 겹치는 줄만 충돌 |
| 승인 기록 | 별도 관리 필요 | PR 작성자·승인자·시각 |
| 엔진이 읽을 위험 | 폴더를 따로 막아야 함 | 머지 전에는 본 브랜치에 없음 |

파일 안의 `status` 필드는 브랜치와 별개로 남겨 두었다. 지표마다 `draft`나 `approved`를 적는 필드라서 한 모델 안에서 지표 A는 승인하고 B는 규칙이 정해질 때까지 미정으로 둘 수 있다. 요청 단위의 초안은 브랜치로, 지표 단위의 미정 상태는 `status`로 관리한다.

초안 폴더가 꼭 필요하다면 모델 파일 전체를 복사하지 말고 추가할 지표, 필드, 연결만 담은 작은 YAML 조각을 넣은 뒤 PR 단계에서 본 파일에 적용하는 방식이 낫다. 이때는 엔진과 질문 에이전트가 초안 폴더를 읽지 못하게 막아야 한다. 지금 엔진은 환경변수로 받은 파일을 그대로 읽기 때문에 폴더 방식을 쓰려면 이 제한을 코드에 넣어야 한다.

### 3.2 사용자 질문과 실행 기록에서 정의 후보 추출하기

정의 초안은 사용자가 정의 에이전트에 직접 요청해서 만들 수도 있고 질문 에이전트의 답변 기록에서 만들 수도 있다. 어느 쪽에서 만들어진 초안이든 같은 방식으로 브랜치와 PR을 거친다.

질문 에이전트가 답할 때마다 기록 파일을 하나씩 남기게 했다. 기록에는 질문과 답, 사용한 지표와 지표 요청 인자, 지표가 없어 거절된 집계 요청, 실행한 SQL에 나온 테이블과 조인 쌍, 그 시점의 정의 번호가 들어간다. 결과 행은 남기지 않았고 질문 문장이 들어 있어서 기록 폴더는 git에서 제외했다.

```text
답변 → runs/<id>.json (질문, 지표, 요청 인자, 거절된 집계, 테이블·조인, 정의 번호)
→ /표준화: 질문 예시와 새 조인 초안은 코드가, 동의어와 새 지표는 LLM이 제안
→ 초안 브랜치 → PR
```

표준화 단계에서는 규칙으로 판단할 수 있는 것을 먼저 코드로 처리한다. 지표로 답한 질문은 해당 지표의 질문 예시에 추가하고 실행 SQL에 나온 조인이 정의에 없으면 기본키 쪽을 한 행 쪽으로 잡아 연결 초안을 만든다. 어느 쪽이 한 행인지 판단할 수 없는 조인은 초안으로 만들지 않고 메모만 남긴다. 질문에 나온 용어를 어떤 지표의 동의어로 붙일지, 거절된 집계가 어떤 지표를 원했는지는 LLM이 제안하게 했다. 이 제안도 모두 초안으로만 들어가고 승인 상태는 바꾸지 못한다.

답변 기록에서 초안을 만들기로 한 데는 앞서 정확도 관련 자료를 조사한 결과가 영향을 줬다. 지표 정의와 업무 규칙 다음으로 효과가 컸던 지식이 검증된 질문과 SQL 예시였는데 답변 기록에는 이런 예시가 계속 쌓인다.

### 3.3 기존 정의와의 중복 및 충돌 확인

초안을 만들기 전에 그래프에서 같은 이름이나 동의어가 이미 있는지 찾아보는 단계를 넣기로 했다. 같은 지표가 있으면 새로 만들지 않고 동의어나 예시로 붙이고 이름은 같은데 뜻이 다르면 `AMBIGUOUS`로 표시해 관리자에게 넘긴다. 두 사용자가 매출을 서로 다르게 정의해서 요청하면 PR 두 개가 충돌하게 되는데 이 단계에서 미리 걸러진다. 이 중복 확인은 그래프의 이름과 동의어를 조회하는 기능으로 처리하고 추후 MCP를 설계할 때 같은 방식을 활용할 생각이다.

### 3.4 PR에서 정의 변경을 검증하는 방법

거버넌스 관리자가 PR에 들어 있는 SQL 식이 맞는지 눈으로 판단하기는 어렵다. 그래서 관리자가 보기 전에 PR의 CI에서 아래 검사를 돌리고 결과를 코멘트로 붙이기로 했다.

| 검사 | 내용 | 현재 |
|---|---|---|
| Ossie 공식 검증기 | 스키마, 이름 유일성, 관계 참조, 식 문법. 검증기 커밋을 고정한다 | 수동 실행 |
| 정적 검사 | 연결이 가리키는 필드, 기본키가 아닌 연결, 이름 중복, 모호한 조인 경로, 데이터셋 지표의 참조 범위, 자료형 | 정의 에이전트 안에서만 |
| DB 대조 | 필드가 읽히는지, 기본키와 연결 키가 유일한지, 지표가 계산되는지와 샘플 값 | 정의 에이전트 안에서만 |
| 골든셋 회귀 | 정의 변경 전후로 골든셋 문항의 답이 달라지는지 | 테스트로만 |

이 중 정적 검사와 DB 대조는 정의 에이전트가 초안을 고칠 때마다 이미 돌리고 있다. 두 검사를 명령줄에서 따로 실행할 수 있게 분리하면 CI에서도 그대로 쓸 수 있다.

관리자는 식 자체를 읽기보다 식을 바꾼 뒤 달라진 답을 보고 판단하는 편이 쉽다. 예를 들어 매출 지표에서 취소 주문 제외 조건을 지우는 PR이라면 코멘트에 아래 결과가 붙는다.

<figure class="tlv">
<div class="tlv-compare">
  <div class="tlv-col"><div class="hd"><span class="tlv-chip">변경 전</span>취소 주문 제외</div><div class="bd"><p><code>SUM(CASE WHEN orders.order_status NOT IN ('canceled', 'unavailable') THEN order_items.price END)</code></p><p>골든셋 2번 전체 기간 매출: <strong>200</strong> (일치)</p></div></div>
  <div class="tlv-col"><div class="hd"><span class="tlv-chip is-bad">변경 후</span>조건 없음</div><div class="bd"><p><code>SUM(order_items.price)</code></p><p>골든셋 2번 전체 기간 매출: <strong>1,199</strong> (불일치)</p></div></div>
</div>
<figcaption class="tlv-cap"><b>그림 2.</b> 취소 주문 제외 조건을 지우면 골든셋 2번의 전체 기간 매출 답이 200에서 1,199로 바뀐다.</figcaption>
</figure>

이 차이는 정의 에이전트를 평가하다가 확인했다. 승인된 지표의 식을 바꿔도 승인 상태가 그대로 유지되는 결함을 찾던 중이었다. 골든셋 검사를 CI에 붙여 두면 이런 변경은 PR 단계에서 바로 걸린다.

PR diff도 관리자가 읽을 수 있는 형태여야 한다. 지금은 저장할 때 YAML을 통째로 다시 쓰기 때문에 줄바꿈 모양이 바뀌고 본문 주석이 사라진다. 지표 하나를 추가했는데 diff에 파일 전체가 바뀐 것으로 나오면 검토가 어렵다. 형식을 보존하며 저장하는 방식으로 바꾸거나 저장 전에 맞출 형식을 저장소 규칙으로 정해야 한다. 이 작업은 추후 진행할 예정이다.

---

## 4. 승인된 정의를 Neo4j에 반영하기

### 4.1 Git 머지를 기준으로 그래프 동기화하기

전환 스크립트는 사람이 돌리지 않고 머지될 때 CI가 실행하게 할 계획이다. 사람이 직접 돌리면 한 번만 잊어도 그래프와 정본이 어긋난다.

지금 스크립트는 정의 파일을 노드와 선으로 바꿔 Neo4j에 넣는다. 같은 모델 이름의 노드를 지우고 다시 넣는 방식이라 여러 번 실행해도 결과가 같고 Olist 샘플로 두 번 적재했을 때도 노드 40개와 선 66개가 그대로였다. 노드에는 `:Ossie`와 종류 라벨을 붙이고 지표 노드에는 승인 상태를 넣었다.

### 4.2 조회 중단 없는 그래프 버전 교체

다만 지우고 다시 넣는 사이에 조회가 들어오면 일부가 빠진 그래프를 보게 된다. 지금은 Cypher 문장 107개를 하나씩 실행해서 이런 구간이 실제로 생긴다. 한 트랜잭션으로 묶거나 새 버전을 먼저 넣고 활성 버전을 바꾼 다음 이전 버전을 지우는 순서로 바꿀 생각이다.

<figure class="tlv tlv-steps" data-intro="번호를 누르면 해당 단계만 강조한다.">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 100" role="img" aria-label="머지를 감지하면 새 버전을 먼저 넣고 활성 버전을 바꾼 뒤 이전 버전을 지운다">
  <defs><marker id="tlv-7-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <g data-steps="1"><rect class="box" x="0" y="20" width="135" height="56" rx="4"/><text class="t" x="14" y="42">머지 감지</text><text class="l" x="14" y="60">main 머지 이벤트</text></g>
  <g data-steps="1 2"><path class="wire" d="M135 48 H163" marker-end="url(#tlv-7-arrow)"/></g>
  <g data-steps="2"><rect class="box" x="165" y="20" width="135" height="56" rx="4"/><text class="t" x="179" y="42">새 버전 적재</text><text class="l" x="179" y="60">revision, commit</text></g>
  <g data-steps="2 3"><path class="wire" d="M300 48 H328" marker-end="url(#tlv-7-arrow)"/></g>
  <g data-steps="3"><rect class="accent" x="330" y="20" width="135" height="56" rx="4"/><text class="t" x="344" y="42">활성 버전 교체</text><text class="l" x="344" y="60">조회가 보는 버전</text></g>
  <g data-steps="3 4"><path class="wire" d="M465 48 H493" marker-end="url(#tlv-7-arrow)"/></g>
  <g data-steps="4"><rect class="soft" x="495" y="20" width="135" height="56" rx="4"/><text class="t" x="509" y="42">이전 버전 삭제</text><text class="l" x="509" y="60">교체 뒤에만</text></g>
</svg>
</div>
<ol class="tlv-step-list">
  <li>정본 브랜치에 머지가 들어오면 CI가 전환 스크립트를 실행한다.</li>
  <li>새 정의를 별도 버전 표시와 함께 넣는다. 모델 노드에 정의 번호와 git 커밋 해시를 기록한다.</li>
  <li>조회가 보는 활성 버전을 새 버전으로 바꾼다. 이 시점까지 조회는 이전 버전을 본다.</li>
  <li>이전 버전 노드를 지운다. 교체 전에는 지우지 않는다.</li>
</ol>
<figcaption class="tlv-cap"><b>그림 3.</b> 조회가 비어 있는 그래프를 보지 않도록 삭제를 교체 뒤로 미룬다.</figcaption>
</figure>

### 4.3 정의 버전 추적과 읽기 전용 운영

모델 노드에는 정의 번호와 커밋 해시를 함께 남기기로 했다. 질문 에이전트는 답마다 계산에 쓴 정의 번호를 붙이는데 그래프에서도 같은 번호를 찾을 수 있어야 정의가 바뀐 뒤에 예전 답을 설명할 수 있다. 지금 적재 스크립트는 정의 번호를 설명 문자열에만 넣고 있고 커밋 해시는 추후 추가할 예정이다.

Neo4j Browser에서 그래프를 직접 고쳐도 다음 적재 때 사라지므로 그래프는 읽기 전용으로 쓸 생각이다. 이후 MCP를 설계할 때도 그래프를 직접 수정하는 기능은 열지 않는 방향을 우선 검토하고 구체적인 운영 규칙은 그때 정리할 예정이다.

---

## 5. MCP로 필요한 정의와 스키마만 조회하기

### 5.1 키워드와 동의어를 이용한 기본 검색

기본 검색은 키워드와 동의어로 한다. 정의의 이름, 동의어, 설명에서 질문에 나온 단어를 찾은 다음 찾은 노드에서 몇 홉을 따라가 관련 테이블, 필드, 지표, 연결을 모아 넘긴다. 정의가 수백 개 정도까지는 이 방식으로 충분하다고 봤고 외부 토큰도 들지 않는다.

### 5.2 조회 시 벡터 검색을 선택 기능으로 둔 이유

벡터를 저장하는 과정과 벡터로 조회하는 과정은 나눠서 생각했다. 전환 스크립트는 승인된 정의를 적재할 때 객체마다 임베딩을 계산해 Neo4j 벡터 인덱스에 항상 함께 저장한다. 이 부분은 아직 구현하지 않았고 추후 개발할 예정이다. 임베딩은 파일 단위가 아니라 데이터셋, 필드, 지표, 개념 같은 객체 하나마다 이름과 동의어와 설명을 묶어서 만든다. 임베딩을 적재 시점에 만들기 때문에 외부 LLM의 API 키는 MCP보다 전환 스크립트에서 먼저 필요하다. 임베딩 모델 이름도 노드에 같이 적어 두어야 나중에 모델을 바꿀 때 전부 다시 계산할 수 있다.

질문을 처리할 때는 키워드와 동의어 검색을 기본으로 쓰고 표현이 정확히 일치하지 않거나 의미가 비슷한 정의까지 찾아야 할 때만 벡터 검색을 함께 사용한다. 벡터는 항상 저장해 두지만 실제 조회에 사용할지는 질문에 따라 선택하는 방식이다. 외부 API로 보내는 데이터는 승인된 정의의 이름과 설명, 동의어로 제한하고 답변 기록에 있는 질문 원문은 임베딩하지 않을 계획이다.

### 5.3 MCP 조회 도구로 고려하는 기능

MCP는 아직 구체적으로 설계하지 않았다. 현재는 시맨틱 정의와 테이블 메타데이터를 조회하는 과정에서 아래와 같은 기능이 필요할 것으로 보고 있다.

- 질문에 나온 용어를 이름, 동의어, 설명과 비교해 관련 정의 찾기
- 데이터셋과 테이블의 설명, 컬럼명·자료형·설명, 기본키 같은 스키마 메타데이터 확인하기
- 특정 지표나 개념의 정의, 계산식, 승인 상태와 정의 번호 확인하기
- 두 데이터셋 사이의 조인 경로 찾기
- 특정 데이터셋에서 사용할 수 있는 승인된 지표 찾기

이 기능을 몇 개의 도구로 나눌지, 도구의 이름과 입력·반환 형식을 어떻게 정할지는 아직 결정하지 않았다. 지금 질문 에이전트는 정의 요약 전체를 한 번에 LLM에 넘기고 있는데 정의가 커지면 필요한 정보만 조회하는 방식으로 바꿀 생각이다. 질문 에이전트와 실제로 연결하는 단계에서 조회 범위와 권한 처리, 오류 응답까지 구체적으로 설계할 예정이다.

---

## 6. 구현 현황과 남은 과제

### 6.1 구현한 범위

- 질문 에이전트의 답변 기록을 수집하고 정의 후보를 만드는 표준화 과정을 구현했다.
- Ossie YAML을 Neo4j의 노드와 관계로 바꾸는 전환 스크립트를 만들고 Olist 샘플로 적재 결과를 확인했다.

### 6.2 남은 과제

- 공식 검증기, 정적 검사, DB 대조, 골든셋 회귀를 PR의 CI에서 실행하고 결과를 코멘트로 남긴다.
- Git 머지를 기준으로 그래프 전환을 자동화하고 새 버전 적재, 활성 버전 교체, 이전 버전 삭제 순서로 개선한다.
- 정의 번호와 커밋 해시를 그래프에 남기고 MCP 조회 도구의 범위와 입출력, 권한 처리 방식을 구체적으로 설계한다.
- 승인된 정의 객체의 임베딩을 항상 생성해 저장하고 질문에 따라 벡터 검색 사용 여부를 선택하는 조회 방식을 구현한다.

<script>
/* tech-log-html viz kit v1 runtime — tabs / steps / term. 요소가 없으면 아무 일도 하지 않는다. JS가 꺼져 있어도 모든 내용은 정적으로 읽힌다 */
(function(){
  if (window.__tlvKit) return; window.__tlvKit = 1;
  function each(sel, fn){ Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function tabs(root){
    var panels = root.querySelectorAll(':scope > .tlv-panel'); if (!panels.length) return;
    var list = document.createElement('div'); list.className = 'tlv-tablist'; list.setAttribute('role','tablist');
    var btns = [];
    Array.prototype.forEach.call(panels, function(p, i){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tlv-tab'; b.setAttribute('role','tab');
      b.textContent = p.getAttribute('data-label') || ('탭 ' + (i + 1));
      b.addEventListener('click', function(){ sel(i); });
      b.addEventListener('keydown', function(e){
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length; sel(n); btns[n].focus(); }
      });
      p.setAttribute('role','tabpanel'); btns.push(b); list.appendChild(b);
    });
    function sel(k){ btns.forEach(function(b, j){ b.setAttribute('aria-selected', j === k ? 'true' : 'false'); b.tabIndex = j === k ? 0 : -1; panels[j].hidden = j !== k; }); }
    root.insertBefore(list, root.firstChild); root.classList.add('is-ready'); sel(0);
  }
  function steps(root){
    var items = root.querySelectorAll('.tlv-step-list > li'); if (!items.length) return;
    var targets = root.querySelectorAll('[data-steps]');
    var ctrl = document.createElement('div'); ctrl.className = 'tlv-steps-ctrl';
    var note = document.createElement('div'); note.className = 'tlv-step-note'; note.setAttribute('aria-live','polite');
    var btns = [];
    function mk(label, cls, fn){ var b = document.createElement('button'); b.type = 'button'; b.className = 'tlv-step-btn' + (cls ? ' ' + cls : ''); b.textContent = label; b.addEventListener('click', fn); ctrl.appendChild(b); btns.push(b); return b; }
    mk('전체', 'is-all', function(){ go(0); });
    Array.prototype.forEach.call(items, function(li, i){ mk(String(i + 1), '', function(){ go(i + 1); }); });
    ctrl.appendChild(note);
    function go(k){
      btns.forEach(function(b, j){ b.setAttribute('aria-pressed', j === k ? 'true' : 'false'); });
      root.classList.toggle('is-focus', k > 0);
      Array.prototype.forEach.call(targets, function(t){ var on = (' ' + t.getAttribute('data-steps') + ' ').indexOf(' ' + k + ' ') > -1; t.classList.toggle('is-on', on); });
      note.innerHTML = k > 0 ? items[k - 1].innerHTML : (root.getAttribute('data-intro') || '단계 번호를 누르면 해당 구간만 강조한다.');
    }
    root.querySelector('.tlv-step-list').insertAdjacentElement('beforebegin', ctrl); root.classList.add('is-ready'); go(0);
  }
  function term(root){
    if (!root.hasAttribute('data-play') || !('IntersectionObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var lines = root.querySelectorAll('.ln'); if (!lines.length) return;
    var timer = null;
    function play(){ clearTimeout(timer); root.classList.add('is-playing'); Array.prototype.forEach.call(lines, function(l){ l.classList.remove('is-shown'); }); var i = 0;
      (function next(){ if (i >= lines.length) { root.classList.remove('is-playing'); return; } lines[i].classList.add('is-shown'); i++; timer = setTimeout(next, lines[i - 1].classList.contains('is-cmd') ? 420 : 160); })(); }
    new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) play(); }); }, { threshold: .5 }).observe(root);
  }
  function init(){ each('.tlv-tabs', tabs); each('.tlv-steps', steps); each('.tlv-term', term); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
</script>
