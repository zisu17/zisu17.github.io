---
title: "[Text2SQL] Claude Code·Codex용 AI Agent 플러그인 구성하기"
excerpt: "Claude Code와 Codex에서 함께 사용하는 Text-to-SQL Agent 플러그인을 스킬, 리뷰 에이전트, t2s 명령줄 도구와 안전장치로 구성한 과정을 정리한다."
nav_section: projects
nav_topic: text2sql

categories:
  - Project
tags:
  - Project
  - Text2SQL
  - AI
  - AI Agent
  - Claude Code
  - Codex
  - Plugin

permalink: /data/text2sql-agent-claude-codex-plugin/

toc: true
toc_sticky: true

date: 2026-11-10
last_modified_at: 2026-11-10
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

## 1. 설계 배경

Text-to-SQL의 시맨틱 레이어는 데이터의 구조와 비즈니스 의미를 정의하는 것에서 끝나지 않는다. 자연어 질문이 들어왔을 때 필요한 지표와 데이터 관계를 탐색하고 정의가 부족하거나 존재하지 않는 경우 사용자와의 대화를 통해 새로운 정의를 작성하거나 기존 정의를 보완할 수 있어야 한다. 나아가 검토된 정의를 바탕으로 SQL을 생성하고 실행 결과를 검증하는 등 정의의 생성부터 관리, 실제 활용까지 연결하는 과정이 필요하다.

처음에는 이 흐름을 확인하려고 OpenAI Agents SDK로 독립형 에이전트를 만들었다. 자연어 질문을 SQL로 바꾸는 질문 에이전트와 대화를 통해 시맨틱 정의를 수정하는 정의 에이전트를 구현해 터미널에서 실행했다.

기능은 정상적으로 동작했지만 스터디 구성원들과 함께 사용하기에는 번거로운 점이 있었다. 독립형 에이전트를 사용하려면 별도의 프로그램 실행과 모델 API 인증 설정이 필요했다.

Agents SDK도 [세션 관리](https://openai.github.io/openai-agents-python/sessions/)와 [명령 실행·파일 편집](https://openai.github.io/openai-agents-python/tools/), [도구 실행 승인](https://openai.github.io/openai-agents-python/human_in_the_loop/)을 지원한다. 다만 독립형 애플리케이션으로 제공하려면 세션 저장 방식과 실행 환경, 사용자 입출력과 승인 절차 등을 프로젝트에 맞게 구성해야 한다.

스터디 구성원 대부분은 이미 Claude Code나 Codex를 사용하고 있었다. 이 실행 환경에 Text-to-SQL 기능을 추가하면 별도 애플리케이션을 실행하지 않고도 기존 작업 흐름에서 사용할 수 있다고 판단했다. 그래서 대화와 권한 관리는 두 도구에 맡기고 시맨틱 검색과 SQL 생성·검증, 정의 관리 기능을 [Text2SQL 플러그인](https://github.com/zisu17/text2sql-plugin)으로 재구성했다.

---

## 2. 독립형 에이전트와 플러그인의 구성 비교

### 2.1 독립형 에이전트의 구성

처음에 Agents SDK를 고른 데는 에이전트마다 쓸 수 있는 도구를 따로 정할 수 있다는 점이 컸다. 질문 에이전트에는 읽기 실행 도구만 주고 정의 에이전트에는 정의를 고치는 도구만 주는 식으로 권한을 나눌 계획이었다.

이 앱에서는 터미널 입력·출력 루프를 앱 코드가 맡고 모델 호출과 도구 실행 루프는 SDK의 `Runner`가 맡았다. 질문 에이전트는 함수 도구 5개로 스키마를 조회하고 SQL을 검사해 실행했다. 지표 SQL을 만드는 엔진, 실행 전 SQL 검사(이하 가드), 읽기 전용 DB 접속은 LLM을 쓰지 않는 파이썬 모듈로 두고 함수 도구가 이 모듈을 불렀다.

### 2.2 Claude Code·Codex와 플러그인의 역할 분리

플러그인에서는 Claude Code와 Codex의 대화 화면과 도구 호출, 실행 전 권한 확인 기능을 그대로 사용한다. 대화 흐름과 권한 관리는 두 도구가 맡고 플러그인에는 Text-to-SQL에 필요한 두 가지만 넣었다. 하나는 질문 처리 절차를 적은 스킬이고 다른 하나는 엔진·가드·DB 접속 모듈을 셸에서 부르는 명령줄 도구 `t2s`다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 268" role="img" aria-label="독립형 에이전트의 대화와 에이전트 실행은 Claude Code와 Codex가 대신하고 계산·검사 모듈은 t2s 명령으로 옮겼다">
  <defs><marker id="tlv-2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker><marker id="tlv-2-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk-accent" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <text class="t" x="104" y="18">독립형 에이전트</text>
  <text class="t c-accent" x="370" y="18">플러그인</text>
  <text class="s" x="0" y="59">대화 화면</text>
  <rect class="box" x="104" y="30" width="236" height="48" rx="4"/>
  <text class="t" x="118" y="51">터미널 대화 루프</text>
  <text class="s" x="118" y="67">앱 코드로 직접 구현</text>
  <path class="wire dash" d="M340 54 H366" marker-end="url(#tlv-2-arrow)"/>
  <rect class="soft" x="370" y="30" width="260" height="48" rx="4"/>
  <text class="t" x="384" y="51">Claude Code·Codex 대화</text>
  <text class="s" x="384" y="67">사용자가 이미 쓰는 도구</text>
  <text class="s" x="0" y="119">에이전트 실행</text>
  <rect class="box" x="104" y="90" width="236" height="48" rx="4"/>
  <text class="t" x="118" y="111">Agents SDK Runner</text>
  <text class="s" x="118" y="127">모델 API 키를 따로 설정</text>
  <path class="wire dash" d="M340 114 H366" marker-end="url(#tlv-2-arrow)"/>
  <rect class="soft" x="370" y="90" width="260" height="48" rx="4"/>
  <text class="t" x="384" y="111">호스트의 에이전트 루프</text>
  <text class="s" x="384" y="127">도구 호출·권한 확인·하위 에이전트</text>
  <text class="s" x="0" y="179">절차와 도구</text>
  <rect class="box" x="104" y="150" width="236" height="48" rx="4"/>
  <text class="t" x="118" y="171">지시문 + 함수 도구 5개</text>
  <text class="s" x="118" y="187">질문 에이전트·정의 에이전트</text>
  <path class="wire dash" d="M340 174 H366" marker-end="url(#tlv-2-arrow)"/>
  <rect class="accent" x="370" y="150" width="260" height="48" rx="4"/>
  <text class="t" x="384" y="171">스킬 7개 + 리뷰 에이전트</text>
  <text class="s" x="384" y="187">절차를 문서로 작성</text>
  <text class="s" x="0" y="239">계산·검사</text>
  <rect class="box" x="104" y="210" width="236" height="48" rx="4"/>
  <text class="t" x="118" y="231">엔진·가드·DB 접속</text>
  <text class="s" x="118" y="247">LLM을 쓰지 않는 파이썬 모듈</text>
  <path class="wire-accent" d="M340 234 H366" marker-end="url(#tlv-2-arrow-a)"/>
  <rect class="accent" x="370" y="210" width="260" height="48" rx="4"/>
  <text class="t" x="384" y="231">t2s 명령</text>
  <text class="s" x="384" y="247">같은 모듈을 셸 명령으로 실행</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> 대화와 에이전트 실행은 Claude Code·Codex가 맡고 플러그인은 절차를 적은 스킬과 기존 모듈을 실행하는 t2s만 제공한다.</figcaption>
</figure>

독립형 에이전트에서 사용한 엔진과 가드는 그대로 두고 플러그인의 `t2s` 명령에서 호출하도록 연결했다. 모델 API 키와 대화 기록은 Claude Code와 Codex의 기존 설정을 사용한다.

### 2.3 LLM과 t2s의 역할 분리

LLM이 맡는 일은 질문 해석, 쓸 지표와 조건 고르기, 처리 경로 선택, 오류 뒤 재시도, 답변 작성으로 정했다. 지표 SQL 생성과 SQL 검사, 읽기 전용 실행처럼 숫자를 만드는 일은 `t2s`가 LLM 없이 한다. 같은 지표와 조건으로 `t2s`를 부르면 Claude Code에서든 Codex에서든 같은 SQL이 만들어진다.

---

## 3. 에이전트와 스킬 구성

### 3.1 스킬 구성과 질문 처리 흐름

스킬은 일곱 개로 나눴다.

| 스킬 | 하는 일 |
|---|---|
| `ask` | 질문에 답한다. 집계는 지표 정의로, 행 조회는 검사한 SELECT로 실행한다 |
| `explore-schema` | 질문에 관련된 지표·컬럼·연결과 실제 값을 보여 준다 |
| `explain-sql` | SQL이 무엇을 하는지 설명한다. 실행하지 않는다 |
| `validate-sql` | SQL을 실행하지 않고 검사한다 |
| `diagnose` | 틀린 답이나 오류의 원인을 실패 유형(F1~F10)으로 분류한다 |
| `define-metric` | 지표 정의에 필요한 조건부터 질문하고 승인 전 상태로 정의 파일에 적는다 |
| `semantic-sync` | `t2s check`로 정의와 실제 DB를 대조해 문제와 정의되지 않은 범위를 보고한다. 파일은 수정하지 않는다 |

스킬은 질문 내용에 따라 모델이 고르며 사용자가 이름으로 직접 부를 수도 있다. 다만 `semantic-sync`는 DB 전체를 점검하는 데 비용과 시간이 들 수 있어 사용자가 직접 호출할 때만 실행하도록 했다. `define-metric`도 정의 파일을 수정한 뒤에는 `t2s check`로 실제 DB와 대조한다.

가장 자주 쓰는 `ask` 스킬은 질문 하나를 다섯 단계로 처리한다.

<figure class="tlv tlv-steps" data-intro="번호를 누르면 해당 단계만 강조한다.">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 200" role="img" aria-label="ask 스킬은 출처 확인, 질의 계획, 경로 선택, 검사와 실행, 점검과 답변 순서로 질문을 처리하고 리뷰 에이전트는 심층 경로에서만 부른다">
  <defs><marker id="tlv-3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <g data-steps="1"><rect class="box" x="0" y="72" width="96" height="50" rx="4"/><text class="t" x="14" y="93">출처 확인</text><text class="s" x="14" y="109">DB·정의 파일</text></g>
  <g data-steps="2"><path class="wire" d="M96 97 H120" marker-end="url(#tlv-3-arrow)"/><rect class="box" x="122" y="72" width="96" height="50" rx="4"/><text class="t" x="136" y="93">질의 계획</text><text class="s" x="136" y="109">정의·실제 값</text></g>
  <g data-steps="3"><path class="wire" d="M218 97 H231 V38 H242" marker-end="url(#tlv-3-arrow)"/><path class="wire" d="M218 97 H231 V156 H242" marker-end="url(#tlv-3-arrow)"/><rect class="accent" x="244" y="10" width="112" height="56" rx="4"/><text class="t" x="258" y="31">지표 호출</text><text class="s" x="258" y="46">집계 질문</text><text class="l" x="258" y="60">t2s compile</text><rect class="box" x="244" y="128" width="112" height="56" rx="4"/><text class="t" x="258" y="149">SELECT 작성</text><text class="s" x="258" y="164">행 조회 질문</text><text class="l" x="258" y="178">t2s run</text></g>
  <g data-steps="4"><path class="wire" d="M356 38 H369 V97 H380" marker-end="url(#tlv-3-arrow)"/><path class="wire" d="M356 156 H369 V97 H380" marker-end="url(#tlv-3-arrow)"/><rect class="accent" x="382" y="72" width="112" height="50" rx="4"/><text class="t" x="396" y="93">검사·실행</text><text class="s" x="396" y="109">읽기 전용 접속</text></g>
  <g data-steps="5"><path class="wire" d="M494 97 H518" marker-end="url(#tlv-3-arrow)"/><rect class="box" x="520" y="72" width="110" height="50" rx="4"/><text class="t" x="534" y="93">점검·답변</text><text class="s" x="534" y="109">결과 숫자로만</text><path class="wire dash" d="M575 122 V148" marker-end="url(#tlv-3-arrow)"/><rect class="box dash" x="520" y="150" width="110" height="44" rx="4"/><text class="t" x="534" y="169">리뷰 에이전트</text><text class="s" x="534" y="184">심층 경로만</text></g>
</svg>
</div>
<ol class="tlv-step-list">
  <li>첫 <code>t2s</code> 호출 전에 사용할 DB와 정의 파일을 사용자에게 묻는다.</li>
  <li><code>t2s context</code>로 정의 요약을 읽고 필터 값은 <code>t2s values</code>로 실제 값을 확인해 질의 계획을 세운다.</li>
  <li>집계 질문은 지표 이름과 조건으로 <code>t2s compile</code>을 부르고 행 조회 질문은 SELECT를 직접 써서 <code>t2s run</code>에 넘긴다.</li>
  <li><code>t2s</code>가 SQL을 검사한 뒤 읽기 전용 접속으로 실행하고 결과를 JSON으로 돌려준다.</li>
  <li>결과가 수상하거나 직접 쓴 SQL이 복잡하면 리뷰 에이전트를 한 번 부르고 실행 결과에 있는 숫자로만 답한다.</li>
</ol>
<figcaption class="tlv-cap"><b>그림 2.</b> 집계 질문과 행 조회 질문은 3단계에서 갈리고 리뷰 에이전트는 5단계의 심층 경로에서만 불린다.</figcaption>
</figure>

질의 계획에는 의도, 쓸 지표나 컬럼, 묶음 기준, 필터와 각 값의 근거, 기간, 결과 형태, 가정을 적도록 했다. 필터 값의 근거가 정의 문구가 아니면 `t2s values`로 DB에 그 값이 실제로 있는지 확인한 뒤 SQL에 넣는다.

### 3.2 별도 에이전트를 리뷰어 하나로 둔 이유

Text-to-SQL Agent에서 흔히 나누는 다섯 역할을 검토했다. 대부분은 규칙이 정해진 코드나 메인 대화에서 처리할 수 있어 SQL 리뷰만 별도 에이전트로 분리했다.

| 역할 | 맡은 곳 | 판단 근거 |
|---|---|---|
| 스키마 탐색 | `t2s context`·`schema`·`values` | 조회 결과가 정해져 있고 Olist 샘플의 정의 요약도 4,285자로 작아 별도 검색 없이 전달할 수 있다 |
| 지표 해석 | 지표 엔진 + ask 스킬의 질의 계획 | 집계 단위와 조인 경로는 엔진이 정의대로 정한다. LLM은 지표만 고른다 |
| SQL 생성 | 메인 대화(ask 스킬) | 따로 떼면 질문 맥락을 다시 넘겨야 하고 단순한 질문에도 지연이 늘어난다 |
| SQL 리뷰 | 리뷰 에이전트(`sql-reviewer`) | SQL을 작성한 쪽은 자신의 해석에 맞춰 결과를 판단하기 쉬워 별도 맥락에서 다시 읽게 했다 |
| 실행 오류 진단 | `t2s`의 오류 종류 + ask 스킬의 재시도 규칙 | 오류 분류는 코드가 이미 하고 재시도 횟수 제한은 절차로 충분하다 |

리뷰 에이전트는 질문마다 부르지 않는다. 직접 쓴 SQL에 조인이나 집계, 하위 쿼리가 있을 때, 결과가 0행이거나 모두 NULL일 때, 질의 계획에 가정이 들어 있을 때만 질문당 한 번 부른다. 지표 엔진 경로가 경고 없이 성공하면 부르지 않으므로 정의가 있는 집계 질문에는 추가 호출이 없다.

리뷰 에이전트에는 데이터 출처, 질문, 질의 계획, SQL, 검사 결과, 결과 요약 여섯 가지만 넘긴다. SQL을 작성할 때의 추론은 전달하지 않는다. 리뷰 에이전트는 조회 명령(`context`·`schema`·`values`·`validate`)만 쓸 수 있고 판정은 `pass`, `revise`, `ask_user` 중 하나로 반환한다. 수정한 SQL 실행과 재시도 횟수 관리는 `ask` 스킬이 맡는다.

### 3.3 실행 예시

Olist 공개 데이터와 샘플 정의로 Claude Code에서 `ask` 스킬을 실행했다. 비대화형으로 실행해서 데이터 출처는 환경변수로 미리 정해 두었다. 도구 출력과 답변의 SQL·설명 부분은 줄였다.

<style>
.tlv .tlv.tlv-term{margin:0}
</style>

<figure class="tlv">
<div class="tlv tlv-term">
<div class="bar"><i></i><i></i><i></i>Claude Code</div>
<div class="body"><span class="ln is-cmd"><span class="p">&gt;</span> /text2sql:ask 2018년 1분기 월별 매출 보여줘</span><span class="ln"></span><span class="ln">● Bash(t2s context "2018년 1분기 월별 매출 보여줘")</span><span class="ln is-dim">  ⎿ {"dialect": "sqlite", "readonly_guarantee": "connection",</span><span class="ln is-dim">     "definition": {"name": "olist_sales", "revision": 2, …},</span><span class="ln is-dim">     "catalog": "정의 olist_sales r2 … - revenue: 매출. …", …}</span><span class="ln"></span><span class="ln">● Bash(t2s compile revenue --by orders.order_purchase_timestamp__month</span><span class="ln">       --where "orders.order_purchase_timestamp &gt;= '2018-01-01'"</span><span class="ln">       --where "orders.order_purchase_timestamp &lt; '2018-04-01'"</span><span class="ln">       --order=order_purchase_timestamp__month --run)</span><span class="ln is-dim">  ⎿ {"sql": "SELECT … SUM(CASE WHEN NOT orders.order_status IN</span><span class="ln is-dim">     ('canceled', 'unavailable') THEN order_items.price END) …",</span><span class="ln is-dim">     "warnings": [], "result": {"ok": true, "rows": [</span><span class="ln is-dim">       ["2018-01-01", 945456.29], ["2018-02-01", 837895.43],</span><span class="ln is-dim">       ["2018-03-01", 981051.06]], "elapsed_ms": 82.1, …}}</span><span class="ln"></span><span class="ln is-ok">● 답: 2018년 1분기 매출은 1월 945,456.29헤알, 2월 837,895.43헤알,</span><span class="ln is-ok">  3월 981,051.06헤알입니다. 3월이 가장 많고 2월이 가장 적습니다.</span><span class="ln"></span><span class="ln">  월별 매출(단위: 헤알)</span><span class="ln">  2018-01   945,456.29</span><span class="ln">  2018-02   837,895.43</span><span class="ln">  2018-03   981,051.06</span><span class="ln"></span><span class="ln">  적용한 필터: 주문일 2018-01-01 이상, 2018-04-01 미만(근거: 사용자 질문)</span><span class="ln">  검증·수정 내역: 1회에 성공했고 경고는 없었습니다.</span><span class="ln">  미리 정해 둔 지표로 계산해서 별도 검토는 하지 않았습니다.</span></div>
</div>
<figcaption class="tlv-cap"><b>그림 3.</b> 정의에 있는 지표로 답할 수 있는 질문은 t2s context와 t2s compile 두 번의 호출로 끝났다.</figcaption>
</figure>

정의에 있는 지표로 답할 수 있는 질문이라 질의 계획을 세운 뒤 바로 지표 호출 경로를 선택했다. 필터가 날짜 범위뿐이라 `t2s values`는 부르지 않았고 지표 호출이 경고 없이 성공해 리뷰 에이전트도 부르지 않았다. 질문부터 답까지 약 21초가 걸렸다.

---

## 4. t2s 명령줄 도구

`t2s`는 지표 SQL 생성, SQL 검사, 읽기 전용 실행, 정의 파일 검사를 맡는 명령줄 도구다. 스킬은 DB와 정의 파일에 직접 접근하지 않고 이 명령만 부른다.

### 4.1 명령과 JSON 출력 형식

`t2s`의 모든 명령은 결과를 stdout에 JSON 하나로 출력한다. LLM이 출력을 읽고 다음 행동을 정해야 해서 사람이 읽는 표 대신 고정된 필드를 가진 JSON으로 정했다. 실패하면 `error.kind`로 오류 종류를 알리고 `retryable`로 같은 의도로 다시 시도해도 되는지 알린다.

| 명령 | 하는 일 |
|---|---|
| `context` | SQL 문법, 읽기 전용 보장 방식, 정의 요약, 조회할 수 있는 테이블 |
| `schema` | 테이블 목록, 테이블을 주면 컬럼과 키 |
| `values` | 컬럼의 실제 값 분포나 날짜 범위 |
| `compile` | 지표 이름·묶음·조건으로 SQL 생성. `--run`이면 실행까지 |
| `validate` | 실행하지 않고 SQL 검사와 구조 분석 |
| `run` | SQL 검사 뒤 읽기 전용으로 실행 |
| `check` | 정의 파일 검사와 실제 DB 대조 |

정의 파일이 있으면 LLM이 직접 쓴 SQL은 행 조회만 실행할 수 있다. 매출을 `SUM(price)`로 직접 계산하면 취소 주문까지 더해지는데 이런 SQL은 `policy` 오류로 거절하고 지표 호출로 돌아가게 했다. 같은 매출을 지표 이름으로 부르면 정의에 적힌 조건이 SQL에 들어간다.

<style>
.tlv.tlv-stack .tlv-compare{grid-template-columns:1fr}
.tlv.tlv-stack pre.highlight{white-space:pre-wrap;word-break:break-all}
</style>

<figure class="tlv tlv-stack">
<div class="tlv-compare">
  <div class="tlv-col"><div class="hd"><span class="tlv-chip is-bad">거절</span>직접 쓴 집계 SQL</div><div class="bd is-code"><div class="language-text highlighter-rouge"><div class="highlight"><pre class="highlight"><code>$ t2s run "SELECT SUM(price) FROM order_items"
{"ok": false,
 "error": {
  "kind": "policy",
  "message": "행 조회만 허용. 집계는 지표 정의(t2s compile)로 하고, 맞는 지표가 없으면 지표가 없다고 답한다",
  "retryable": false},
 "warnings": []}</code></pre></div></div></div></div>
  <div class="tlv-col"><div class="hd"><span class="tlv-chip is-accent">실행</span>지표 호출</div><div class="bd is-code"><div class="language-sql highlighter-rouge"><div class="highlight"><pre class="highlight"><code>$ t2s compile revenue --by orders.order_purchase_timestamp__month
SELECT
  STRFTIME('%Y-%m-01', orders.order_purchase_timestamp)
    AS order_purchase_timestamp__month,
  SUM(CASE
      WHEN NOT orders.order_status IN ('canceled', 'unavailable')
      THEN order_items.price
    END) AS revenue
FROM order_items AS order_items
LEFT JOIN orders AS orders
  ON order_items.order_id = orders.order_id
GROUP BY STRFTIME('%Y-%m-01', orders.order_purchase_timestamp)
LIMIT 100</code></pre></div></div></div></div>
</div>
<figcaption class="tlv-cap"><b>그림 4.</b> 직접 쓴 집계 SQL은 거절되고 같은 매출을 지표로 부르면 정의에 적힌 취소 주문 제외 조건이 SQL에 들어간다.</figcaption>
</figure>

지표 호출 예시는 `compile` 출력의 `sql` 필드만 옮기고 줄바꿈을 일부 조정했다. 조인 방향과 집계 대상 테이블은 엔진이 정의의 연결과 기본키를 보고 정한다.

### 4.2 플러그인에 함께 넣은 실행 환경

플러그인을 사용하는 사람이 파이썬 패키지를 따로 설치하지 않아도 되도록 `t2s` 코드를 플러그인 안에 넣었다. 실행 스크립트는 `scripts/t2s`다. 두 도구 모두 PATH에서 `t2s`를 찾으면 그대로 사용하고 없으면 `sh "<플러그인 경로>/scripts/t2s"`로 호출한다. 본문의 `t2s` 명령 예시도 PATH에 없을 때는 이 호출 방식으로 바꿔 사용한다.

`scripts/t2s`는 처음 실행할 때 uv로 전용 가상환경을 만들고 `t2s`를 설치한다. 환경 폴더 이름은 `pyproject.toml`과 `t2s/*.py` 내용의 체크섬으로 정했다. 코드가 바뀌면 새 환경을 만들고 같은 버전은 Claude Code와 Codex가 하나의 환경을 공유한다.

```text
첫 실행:   uv venv → uv pip install  (환경 폴더: <T2S_HOME>/<코드 체크섬>)
다음 실행: <환경 폴더>/bin/t2s 를 바로 실행 (uv·인터넷 사용 안 함)
```

첫 설치에는 가상환경을 만들 쓰기 권한과 패키지를 내려받을 네트워크 접근이 필요하다. Codex 사용자는 일반 터미널에서 `sh "<플러그인 경로>/scripts/t2s" setup`을 먼저 실행하도록 안내했다. 플러그인 업데이트 후에도 같은 명령으로 설치를 준비한다. 설치를 마친 뒤에는 쓰기 금지 샌드박스(`-s read-only`)에서도 `t2s`가 실행되는 것을 확인했다.

---

## 5. 안전장치 구성

### 5.1 읽기 전용 접속과 SQL 검사

LLM이 만든 SQL을 실행하므로 검사를 여러 겹으로 두었다. 가장 아래에서는 DB 접속 자체를 읽기 전용으로 연다. SQLite는 `PRAGMA query_only`, PostgreSQL은 `default_transaction_read_only`로 접속해서 가드가 놓친 쓰기 쿼리도 DB에서 거절되게 했다. 다른 DB는 접속 옵션으로 막지 못해 계정 권한에 맡긴다. `t2s context`의 `readonly_guarantee`가 `connection`인지 `account`인지로 이 차이를 알려 준다.

그 위에서 가드가 실행 전에 sqlglot 구문 트리로 SQL을 검사한다. 한 문장짜리 조회만 받고 데이터 변경과 부작용이 있는 함수(`nextval`, `load_file` 등)는 거절한다. 허용한 테이블만 읽게 하고 행 수 상한은 `LIMIT`으로 건다. 정의 파일이 있으면 LLM이 쓴 SQL은 정의에 있는 필드와 승인된 연결로만 조인할 수 있다. 함수 검사는 거부 목록 방식이라 목록에 없는 함수는 놓칠 수 있다. 그래서 쓰기를 막는 최종 보장은 읽기 전용 접속과 계정 권한에 두었다.

### 5.2 데이터 출처 확인과 훅

스킬은 첫 `t2s` 호출 전에 사용할 DB와 정의 파일을 각각 확인한다. 후보는 환경변수와 작업 폴더에서 찾은 파일을 보여주되 자동으로 선택하지 않는다. 대화 맥락이나 파일 이름만 보고 다른 DB를 짐작해 조회하지 않게 하려는 장치다. 비밀번호가 든 접속 주소는 대화창에 쓰지 않고 셸 환경변수로 설정하게 안내한다.

두 가지 훅을 추가했다. 셸에서 `sqlite3`·`psql`·`mysql`·`duckdb` 같은 DB 클라이언트를 직접 부르면 실행 전에 사용자 확인을 받는다. 정의 파일(`*.ossie.yaml`)을 고치면 `t2s check --static`으로 정적 검사를 돌려 문제를 알린다. 훅이 놓치는 경우가 있어도 5.1의 읽기 전용 접속과 SQL 검사가 그대로 적용되므로 훅은 보조 장치로 두었다.

---

## 6. Claude Code와 Codex 공용 구성

### 6.1 저장소와 플러그인 정보 파일 구성

현재 저장소에는 Claude Code 형식의 설치 목록(`.claude-plugin/marketplace.json`)과 플러그인 정보(`.claude-plugin/plugin.json`), 루트의 `plugin.json`을 함께 둔다. 루트 파일에는 Agent Plugins 스키마와 이름·버전을 적고 OpenAI 확장 설정에 `requires_local_executor: true`를 지정했다.

저장소에는 플러그인 하나만 두고 저장소 최상위를 플러그인 폴더로 사용했다. 설치 목록의 `source`를 `"./"`로 적어 두어 저장소 하나를 등록하면 바로 설치된다.

```text
text2sql-plugin/
├── .claude-plugin/
│   ├── marketplace.json    설치 목록 (source: "./")
│   └── plugin.json         이름·버전
├── plugin.json             Agent Plugins 매니페스트·로컬 실행기 요구 설정
├── skills/                 스킬 7개
├── agents/sql-reviewer.md  리뷰 에이전트
├── hooks/                  DB 클라이언트 확인·정의 파일 검사
├── references/             실패 유형 F1~F10
├── evals/                  질문이 맞는 스킬로 가는지 보는 평가
├── scripts/
│   ├── t2s                 실행 스크립트
│   └── build_plugin.py     Claude 업로드용 패키지 생성
├── pyproject.toml          t2s 패키지·의존성·명령 진입점
├── t2s/                    t2s 코드(파이썬)
└── tests/                  점검과 예시 정의
```

### 6.2 두 도구의 동작 차이와 보완 방식

같은 파일을 사용해도 두 도구가 플러그인을 해석하는 방식이 달랐다. 차이가 나는 부분은 스킬 문장과 훅 형식으로 보완했다.

| 항목 | Claude Code | Codex | 보완 |
|---|---|---|---|
| 부르는 방법 | `/text2sql:ask` | `$ask` | 질문만 해도 모델이 스킬을 고른다 |
| 실행 경로 | PATH의 `t2s` 또는 `scripts/t2s` | 동일 | PATH에 없으면 `sh "<플러그인 경로>/scripts/t2s"`로 부른다 |
| 리뷰 에이전트 | 하위 에이전트로 실행 | 플러그인 에이전트 없음 | ask 스킬이 `agents/sql-reviewer.md`를 읽고 같은 기준으로 직접 검토한다 |
| 선택지 질문 | 질문 도구 사용 | 질문 도구가 없을 수 있음 | 번호 목록으로 묻고 답을 기다린다 |
| 훅의 확인 요청 | 사용자에게 확인을 받음 | 지원하지 않아 그대로 진행 | 훅은 보조 장치로만 둔다 |
| 파일 수정 입력 | `file_path` 칸 | `apply_patch` 패치 본문 | 정의 검사 훅이 패치 본문에서 파일 경로를 찾는다 |
| 첫 설치 | 첫 호출 때 자동 | 일반 터미널에서 `sh "<플러그인 경로>/scripts/t2s" setup` | README에 안내 |

`hooks/hooks.json`은 `matcher`로 `Bash`와 `Edit|Write`를 구분한다. DB 클라이언트 명령인지와 수정한 파일이 Ossie 정의인지 여부는 각 훅 스크립트에서 확인한다.

Codex는 플러그인 훅을 처음 실행하기 전에 사용자에게 신뢰 여부를 묻는다. 훅을 신뢰하지 않아도 스킬은 그대로 동작하므로 `define-metric` 스킬에는 훅이 실행되지 않으면 정의 파일을 고친 뒤 `t2s check --static`을 직접 부르는 문장을 넣었다.

---

## 7. 구현 결과와 남은 작업

### 7.1 구현한 범위

현재 플러그인은 스킬 7개, 리뷰 에이전트 1개, 훅 2개, `t2s` 명령 7개로 구성했다. 독립형 에이전트에 있던 정의 에이전트와 그래프 적재 코드는 이번 범위에서 제외했다.

배포 전 Python 3.10과 3.12에서 테스트 61개를 실행했고 모두 통과했다. PostgreSQL 읽기 전용 접속 테스트 1개는 접속 정보가 없어 제외했다. 배포할 파일만 복사한 사본으로 Claude Code와 Codex에 각각 새로 설치했다. Codex에서는 `t2s` 첫 설치와 정의 검사까지 확인했다. Windows 환경은 아직 검증하지 않았다.

### 7.2 다음 작업

지금은 정의 파일을 로컬에서 읽고 `t2s`를 셸 명령으로 실행한다. 다음 단계에서는 그래프 DB 기반의 검색과 검증 기능을 원격 MCP 서버로 제공할 예정이다. 이 작업은 별도 저장소에서 진행하고 있다.

PostgreSQL은 사용자가 드라이버를 `t2s` 환경에 직접 설치해야 한다. 플러그인 버전이 바뀌어 환경을 새로 만들면 드라이버도 다시 설치해야 해서 설치 단계에 드라이버를 포함하는 방법을 검토하려고 한다.

정의 파일은 지금 Ossie 형식만 읽는다. 다른 시맨틱 레이어 형식도 읽을 수 있게 추가할 예정이다.

리뷰 에이전트의 효과는 아직 측정하지 못했다. 지표 정의를 사용하는 집계 질문은 엔진이 SQL을 만들기 때문에 리뷰 에이전트가 호출될 일이 적다. 따라서 정의 없이 직접 SQL을 작성하는 조인·집계 질문부터 효과를 측정할 계획이다.

---

## 8. 마무리

Claude Code와 Codex가 대화와 도구 실행을 맡고 플러그인에는 Text-to-SQL에 필요한 절차와 실행 코드만 넣었다. 스킬과 `t2s`의 역할을 나누면서 두 도구에서 같은 정의와 실행 방식을 사용할 수 있게 됐고 SQL 실행 범위도 읽기 전용으로 제한했다.

다음에는 로컬 파일과 CLI에 있는 조회·검사 기능을 원격 MCP 서버로 옮기는 과정을 정리할 예정이다.

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
