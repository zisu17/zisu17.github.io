---
title: "[Parquet] Parquet 행 그룹과 Bloom Filter 기반 데이터 스키핑"
excerpt: "Parquet 파일의 행 그룹 구조와 Bloom Filter의 동작 원리, Iceberg가 데이터를 읽을 때 Bloom Filter를 확인하는 단계와 오탐률, 효과가 나는 조건과 설정 방법을 정리한다."
nav_section: data
nav_topic: lakehouse

categories:
  - Data Engineering
tags:
  - Data Engineering
  - Parquet
  - Iceberg
  - BloomFilter
  - DataSkipping

permalink: /data/parquet-row-group-bloom-filter/

toc: true
toc_sticky: true

date: 2026-10-26
last_modified_at: 2026-10-26
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

Iceberg 테이블의 조회 성능 개선안을 검토하면서 일부 컬럼에 Parquet Bloom Filter를 설정하는 방안을 봤다. 설정은 테이블 속성 한 줄이지만 설정만 보고는 어떤 컬럼에서 효과가 날지 판단하기 어려웠다. Bloom Filter는 Parquet 파일 안의 행 그룹마다 컬럼별로 하나씩 만들어지고 min/max 통계로 거르지 못한 행 그룹을 한 번 더 거르는 데 쓰인다. 그래서 행 그룹 구조와 읽기 단계부터 확인했다.

이 글은 Parquet 파일 구조, Bloom Filter의 동작 원리, Iceberg가 데이터를 읽을 때 Bloom Filter를 확인하는 단계, 필터 크기와 오탐률, 효과가 나는 조건을 순서대로 다룬다. Iceberg 1.x와 Parquet 파일 형식을 기준으로 하며 본문의 테이블명과 컬럼명은 예시 값으로 바꿨다.

---

## 2. Parquet 파일 구조

Parquet은 컬럼형 파일 형식이지만 파일 전체를 컬럼 단위로 한 번에 저장하지 않는다. 행을 일정 크기씩 끊어 행 그룹(row group)을 만들고 행 그룹 안에서 컬럼별로 값을 모아 저장한다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 300" role="img" aria-label="표의 행을 행 그룹 두 개로 나누고, 행 그룹마다 customer_id, customer_name, amount 값을 컬럼별로 모아 차례로 기록한 뒤 후반부에 Bloom Filter 영역과 footer를 둔 예시">
  <defs><marker id="tlv-2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <text class="l" x="102" y="16">customer_id</text>
  <text class="l" x="282" y="16">customer_name</text>
  <text class="l" x="472" y="16">amount</text>
  <rect class="soft" x="0" y="26" width="80" height="66" rx="4"/>
  <text class="t" x="12" y="64">행 그룹 1</text>
  <rect class="accent" x="90" y="26" width="170" height="66" rx="4"/>
  <rect class="box" x="270" y="26" width="180" height="66" rx="4"/>
  <rect class="box" x="460" y="26" width="170" height="66" rx="4"/>
  <text class="l c-accent" x="102" y="41">C01</text><text class="s" x="282" y="41">가나상사</text><text class="l" x="472" y="41">1,200</text>
  <text class="l c-accent" x="102" y="63">C03</text><text class="s" x="282" y="63">다라물산</text><text class="l" x="472" y="63">800</text>
  <text class="l c-accent" x="102" y="85">C04</text><text class="s" x="282" y="85">마바건설</text><text class="l" x="472" y="85">2,500</text>
  <rect class="soft" x="0" y="100" width="80" height="66" rx="4"/>
  <text class="t" x="12" y="138">행 그룹 2</text>
  <rect class="accent" x="90" y="100" width="170" height="66" rx="4"/>
  <rect class="box" x="270" y="100" width="180" height="66" rx="4"/>
  <rect class="box" x="460" y="100" width="170" height="66" rx="4"/>
  <text class="l c-accent" x="102" y="115">C05</text><text class="s" x="282" y="115">사아식품</text><text class="l" x="472" y="115">640</text>
  <text class="l c-accent" x="102" y="137">C07</text><text class="s" x="282" y="137">자차전자</text><text class="l" x="472" y="137">3,100</text>
  <text class="l c-accent" x="102" y="159">C08</text><text class="s" x="282" y="159">카타물류</text><text class="l" x="472" y="159">970</text>
  <text class="s" x="0" y="206">행 그룹 1</text>
  <text class="s" x="262" y="206">행 그룹 2</text>
  <text class="s" x="524" y="206">후반부 예시</text>
  <rect class="accent" x="0" y="214" width="40" height="40" rx="3"/><text class="l c-accent" x="20" y="238" text-anchor="middle">id</text>
  <rect class="box" x="42" y="214" width="136" height="40" rx="3"/><text class="l" x="110" y="238" text-anchor="middle">customer_name</text>
  <rect class="box" x="180" y="214" width="72" height="40" rx="3"/><text class="l" x="216" y="238" text-anchor="middle">amount</text>
  <rect class="accent" x="262" y="214" width="40" height="40" rx="3"/><text class="l c-accent" x="282" y="238" text-anchor="middle">id</text>
  <rect class="box" x="304" y="214" width="136" height="40" rx="3"/><text class="l" x="372" y="238" text-anchor="middle">customer_name</text>
  <rect class="box" x="442" y="214" width="72" height="40" rx="3"/><text class="l" x="478" y="238" text-anchor="middle">amount</text>
  <rect class="accent dash" x="524" y="214" width="44" height="40" rx="3"/><text class="l c-accent" x="546" y="238" text-anchor="middle">BF</text>
  <rect class="soft" x="570" y="214" width="60" height="40" rx="3"/><text class="l" x="600" y="238" text-anchor="middle">footer</text>
  <path class="wire" d="M0 272 H624" marker-end="url(#tlv-2-arrow)"/>
  <text class="s" x="0" y="292">파일에 기록되는 순서 (왼쪽이 파일 앞부분, id = customer_id, BF = Bloom Filter 영역)</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> 같은 customer_id 컬럼(주황)이라도 행 그룹마다 따로 모여 저장된다. 그림은 Bloom Filter 영역을 모든 행 그룹 뒤에 둔 배치 예시다.</figcaption>
</figure>

Parquet 사양상 Bloom Filter 데이터는 모든 행 그룹 뒤에 모아 둘 수도 있고 행 그룹 사이에 둘 수도 있다. footer에는 각 column chunk의 Bloom Filter 위치가 기록되므로 reader는 실제 배치와 관계없이 필요한 필터를 찾을 수 있다.

### 2.1 행 그룹, column chunk, page, footer

- 행 그룹: 행을 가로로 끊은 묶음이다. Iceberg의 기본 목표 크기는 `write.parquet.row-group-size-bytes` = 128MB다.
- column chunk: 한 행 그룹 안에서 한 컬럼의 값만 모은 것이다. 그림 1의 칸 하나가 column chunk 하나다.
- page: column chunk를 나눈 인코딩·압축 단위다. 기본 크기는 `write.parquet.page-size-bytes` = 1MB다.
- footer: 파일 끝에 있는 메타데이터다. 스키마, 행 그룹 목록, column chunk마다 위치·크기·min/max·null 수·Bloom Filter 위치를 담는다.

파일을 읽을 때는 footer를 먼저 읽어 필요한 column chunk의 위치를 알아낸 뒤 그 범위만 읽는다. 쿼리에 쓰이지 않는 컬럼의 column chunk는 읽지 않는다.

### 2.2 행 그룹 단위로 나누는 이유

- 쓰기 메모리: writer는 행 그룹 하나 분량을 메모리에 모았다가 한 번에 기록한다. 행 그룹 없이 파일 전체를 컬럼별로 쓰려면 파일 전체를 메모리에 둬야 한다. 파티션이 많아 여러 파일을 동시에 쓰는 경우에는 열린 파일 수만큼 행 그룹 버퍼가 생긴다.
- 병렬 읽기: Parquet writer는 각 행 그룹의 시작 위치를 Iceberg manifest의 `split_offsets`에 기록할 수 있고 Spark는 이 경계에서 파일을 나눠 여러 태스크에 배정한다. 1GB 파일에 행 그룹이 8개면 최대 8개 태스크로 나눌 수 있지만 행 그룹 하나를 여러 태스크가 나눠 읽지는 않는다.
- 데이터 스키핑(data skipping): min/max 통계, dictionary, Bloom Filter는 행 그룹 안의 column chunk 단위로 보관하거나 참조한다. 이 정보들로 읽지 않고 넘어가는 단위도 행 그룹이다.

---

## 3. Bloom Filter 동작 원리

Bloom Filter는 어떤 값이 집합에 들어 있는지를 "확실히 없음"과 "있을 수도 있음" 두 가지로 판정하는 비트 배열이다. 원래 값은 저장하지 않으므로 고유값이 수십만 개여도 1MB 안팎에 들어간다. 대신 실제로는 없는 값을 있을 수도 있다고 판정하는 오탐(false positive)이 일정 비율로 생긴다.

### 3.1 값 추가와 조회

- 처음에는 m개 비트가 모두 0이다.
- 값 추가: 값을 해시 함수 k개에 넣어 위치 k개를 얻고 그 위치의 비트를 1로 설정한다. 위치는 해시 결과를 비트 수로 나눈 나머지다.
- 조회: 같은 해시로 위치 k개를 구해 비트를 확인한다. 하나라도 0이면 그 값은 추가된 적이 없으므로 확실히 없다. 모두 1이면 있을 수도 있다.

Parquet writer는 행 그룹을 쓰는 동안 컬럼별 비트 배열을 메모리에 두고 행마다 그 컬럼 값을 추가한다. 행 그룹이 끝나면 비트 배열을 파일의 Bloom Filter 영역에 기록하고 위치를 footer에 남긴다. 데이터 값 자체는 바뀌지 않는다.

아래는 24비트, 해시 3개짜리 축소판이다. 값 5개를 미리 추가해 뒀고 값을 입력해 추가하거나 조회할 수 있다.

<style>
.tlv-bloom .ctl{display:flex;flex-wrap:wrap;gap:.4em;align-items:center}
.tlv-bloom .ctl input{width:8.5em;padding:.3em .5em;border:1px solid var(--tlv-line-2);border-radius:4px;font:inherit;font-size:.85em;font-family:var(--tlv-mono)}
.tlv-bloom .ctl button{padding:.3em .8em;border:1px solid var(--tlv-line-2);border-radius:4px;background:#fff;font-size:.8em;color:var(--tlv-body)}
.tlv-bloom .bits,.tlv-bloom .idx{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:2px}
.tlv-bloom .bits{margin-top:.9em}
.tlv-bloom .bit{height:2em;border:1px solid var(--tlv-line-2);border-radius:3px;display:flex;align-items:center;justify-content:center;font-family:var(--tlv-mono);font-size:.75em;color:var(--tlv-mute);background:#fff}
.tlv-bloom .bit.on{background:var(--tlv-accent-bg);border-color:var(--tlv-accent);color:var(--tlv-accent-text)}
.tlv-bloom .bit.hit{outline:2px solid var(--tlv-ink);outline-offset:1px}
.tlv-bloom .idx{font-family:var(--tlv-mono);font-size:.68em;color:var(--tlv-mute);text-align:center;margin-top:2px}
.tlv-bloom .msg{min-height:1.6em;margin-top:.8em;font-size:.88em}
.tlv-bloom .msg.is-good{color:var(--tlv-good)}
.tlv-bloom .msg.is-bad{color:var(--tlv-bad)}
.tlv-bloom .msg.is-accent{color:var(--tlv-accent-text)}
.tlv-bloom .meta{font-size:.76em;color:var(--tlv-sub);font-family:var(--tlv-mono)}
</style>

<figure class="tlv tlv-bloom" id="tlv-3-bloom">
<div class="tlv-box">
<div class="ctl"><input type="text" id="tlv-3-bloom-v" value="C0009" aria-label="추가하거나 조회할 값"><button type="button" data-act="add">추가</button><button type="button" data-act="query">조회</button><button type="button" data-act="fp">오탐 예</button><button type="button" data-act="reset">초기화</button></div>
<div class="bits" data-el="bits"><div class="bit on">1</div><div class="bit on">1</div><div class="bit">0</div><div class="bit">0</div><div class="bit on">1</div><div class="bit">0</div><div class="bit on">1</div><div class="bit on">1</div><div class="bit on">1</div><div class="bit">0</div><div class="bit on">1</div><div class="bit">0</div><div class="bit">0</div><div class="bit">0</div><div class="bit on">1</div><div class="bit">0</div><div class="bit">0</div><div class="bit">0</div><div class="bit">0</div><div class="bit on">1</div><div class="bit">0</div><div class="bit">0</div><div class="bit">0</div><div class="bit">0</div></div>
<div class="idx"><div>0</div><div>1</div><div>2</div><div>3</div><div>4</div><div>5</div><div>6</div><div>7</div><div>8</div><div>9</div><div>10</div><div>11</div><div>12</div><div>13</div><div>14</div><div>15</div><div>16</div><div>17</div><div>18</div><div>19</div><div>20</div><div>21</div><div>22</div><div>23</div></div>
<p class="msg" data-el="msg">값 5개를 추가한 상태다. 위치가 일부 겹쳐 24비트 중 9개가 1이다.</p>
<p class="meta" data-el="hash">C0101 → 6, 19, 8 · C0202 → 14, 7, 0 · C0303 → 8, 19, 6 · C0404 → 1, 4, 7 · C0505 → 4, 19, 10</p>
<p class="meta" data-el="stat">m = 24비트, k = 3, 추가한 값 5개, 1인 비트 9개, 이론 오탐률 10.0%</p>
</div>
<figcaption class="tlv-cap"><b>그림 2.</b> 조회 값의 위치 중 하나라도 0이면 확실히 없음, 모두 1이면 추가하지 않은 값도 있을 수도 있음으로 판정된다.</figcaption>
</figure>

<script>
(function(){
  var root = document.getElementById('tlv-3-bloom'); if (!root) return;
  var M = 24, K = 3, init = ['C0101','C0202','C0303','C0404','C0505'], bits, added;
  var input = root.querySelector('#tlv-3-bloom-v');
  function el(k){ return root.querySelector('[data-el="' + k + '"]'); }
  function h32(s, seed){
    var h = (2166136261 ^ seed) >>> 0;
    for (var i = 0; i !== s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
    return h >>> 0;
  }
  function pos(s){
    var a = h32(s, 0), b = (h32(s, 0x9747b28c) | 1) >>> 0, p = [];
    for (var i = 0; i !== K; i++) p.push((a + i * b) % M);
    return p;
  }
  function clear(){ bits = []; for (var i = 0; i !== M; i++) bits.push(0); added = []; }
  function add(s){ pos(s).forEach(function(i){ bits[i] = 1; }); if (added.indexOf(s) === -1) added.push(s); }
  function draw(hl){
    var cells = el('bits').children, on = 0;
    for (var i = 0; i !== M; i++){
      cells[i].textContent = bits[i];
      cells[i].className = 'bit' + (bits[i] ? ' on' : '') + (hl ? (hl.indexOf(i) !== -1 ? ' hit' : '') : '');
      on += bits[i];
    }
    var n = added.length, p = Math.pow(1 - Math.exp(-K * n / M), K) * 100;
    el('stat').textContent = 'm = 24비트, k = 3, 추가한 값 ' + n + '개, 1인 비트 ' + on + '개, 이론 오탐률 ' + p.toFixed(1) + '%';
  }
  function say(t, cls){ var m = el('msg'); m.textContent = t; m.className = 'msg' + (cls ? ' ' + cls : ''); }
  function allOn(p){ return p.every(function(i){ return bits[i] === 1; }); }
  function act(a){
    if (a === 'reset'){ clear(); el('hash').textContent = ''; say('모든 비트를 0으로 되돌렸다.'); draw(); return; }
    if (a === 'fp'){
      for (var j = 0; j !== 10000; j++){
        var c = 'C' + ('000' + j).slice(-4);
        if (added.indexOf(c) === -1){ if (allOn(pos(c))){ input.value = c; act('query'); return; } }
      }
      say('1인 비트가 적어 오탐 예가 없다. 값을 더 추가한다.'); draw(); return;
    }
    var s = input.value.trim();
    if (!s){ say('입력한 값이 없다.', 'is-bad'); return; }
    var p = pos(s);
    el('hash').textContent = s + ' → ' + p.join(', ');
    if (a === 'add'){ add(s); say('추가했다. 1로 설정한 비트: ' + p.join(', ')); draw(p); return; }
    var zero = p.filter(function(i){ return bits[i] === 0; });
    if (zero.length) say('확실히 없음. 0인 비트: ' + zero.join(', ') + '. 이 행 그룹은 읽지 않는다.', 'is-good');
    else if (added.indexOf(s) !== -1) say('있을 수도 있음. 추가한 값이라 행 그룹을 읽으면 찾는다.', 'is-accent');
    else say('있을 수도 있음. 추가하지 않은 값인데 위치가 모두 1이다(오탐). 행 그룹을 읽어도 값은 없다.', 'is-bad');
    draw(p);
  }
  clear(); init.forEach(add);
  root.addEventListener('click', function(e){ var b = e.target.closest('button[data-act]'); if (b) act(b.getAttribute('data-act')); });
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter') act('query'); });
})();
</script>

`C0009`는 추가하지 않은 값이지만 위치 0, 19, 14가 모두 다른 값들이 설정한 비트라 있을 수도 있음으로 판정된다. `C0001`처럼 위치 중 하나라도 0이면 데이터를 보지 않고 확실히 없다고 판정한다.

### 3.2 오탐과 미탐

- 미탐(실제로 있는 값을 없다고 판정)은 생기지 않는다. 추가할 때 1로 설정한 비트는 다시 0으로 바뀌지 않기 때문이다.
- 오탐은 다른 값들이 설정한 비트가 조회 값의 위치와 모두 겹칠 때 생긴다. 추가한 값이 많을수록 1인 비트가 늘어 오탐률이 오른다.
- 값을 삭제할 수 없다. 비트를 0으로 되돌리면 같은 비트를 쓰는 다른 값까지 없다고 판정된다. Parquet 파일은 한 번 쓰면 수정하지 않으므로 이 제약이 문제가 되지 않고 Iceberg의 행 삭제는 delete 파일로 따로 처리한다.

### 3.3 Parquet의 Split Block Bloom Filter

Parquet 형식은 일반 Bloom Filter 대신 블록 단위로 나눈 Split Block Bloom Filter(SBBF)를 쓴다.

- 비트 배열을 256비트(32바이트) 블록으로 나눈다.
- 값마다 xxHash64 결과로 블록 하나를 고르고 그 블록 안의 32비트 워드 8개에서 비트를 하나씩, 모두 8개를 1로 설정한다.
- 조회할 때 블록 하나만 확인하면 되므로 CPU 캐시 라인 하나 안에서 판정이 끝난다. 같은 크기의 일반 Bloom Filter보다 오탐률은 약간 높다.

---

## 4. Iceberg 읽기 과정의 확인 단계

Iceberg는 쿼리 조건으로 데이터를 두 번 거른다. 드라이버가 계획 단계에서 manifest의 파일별 통계로 읽을 파일을 고르고, executor가 파일을 연 뒤 footer의 행 그룹별 정보로 읽을 행 그룹을 고른다.

```text
1. manifest min/max    파일 단위, 파일을 열기 전 (드라이버)
2. 행 그룹 min/max      footer 통계 (executor)
3. dictionary          column chunk 전체가 dictionary 인코딩일 때
4. Bloom Filter        등식·IN 조건
5. 남은 행 그룹에서 필요한 column chunk만 읽음
```

- 1단계의 파일별 min/max는 Iceberg가 파일을 쓸 때 footer의 행 그룹 통계를 합쳐 manifest에 기록한 값이다. 문자열은 기본 설정(`truncate(16)`)에서 앞 16자까지만 저장된다.
- 2~4단계는 행 그룹을 제외할 때 활용할 수 있는 정보다. 실제 적용 여부와 확인 순서는 reader 구현과 설정에 따라 달라지지만, 어느 단계에서든 값이 없다고 판정하면 해당 행 그룹을 읽지 않을 수 있다는 점은 같다.
- dictionary 필터는 column chunk 전체가 dictionary로 인코딩된 경우에만 판정할 수 있다. 고유값이 많아 dictionary가 `write.parquet.dict-size-bytes`(기본 2MB)를 넘으면 writer가 일반 인코딩으로 전환하고 이때 3단계는 판정하지 못한다. Bloom Filter는 이처럼 dictionary 필터를 쓸 수 없는 고유값이 많은 컬럼에서 판정을 맡는다.
- Bloom Filter는 manifest에 들어 있지 않다. 판정하려면 파일을 열어 footer와 Bloom Filter를 읽어야 하고 건너뛰는 단위는 파일이 아니라 행 그룹이다.

행 그룹 3개로 된 파일에서 조회 조건과 Bloom Filter 사용 여부를 바꿔 보면 읽는 범위가 달라진다. 행 그룹 하나는 128MB(customer_id 20MB, customer_name 70MB, amount 38MB), column chunk 하나의 Bloom Filter는 1MB로 가정했다.

<style>
.tlv-rg .ctl{display:flex;flex-wrap:wrap;gap:.5em 1.2em;align-items:center;font-size:.85em}
.tlv-rg .ctl select{font:inherit;padding:.25em .4em;border:1px solid var(--tlv-line-2);border-radius:4px;background:#fff}
.tlv-rg .ctl label{display:flex;align-items:center;gap:.35em;cursor:pointer}
.tlv-rg .sql{font-family:var(--tlv-mono);font-size:.75em;color:var(--tlv-sub);margin-top:.6em;word-break:break-all}
.tlv-rg .lb{font-size:.78em;font-weight:600;color:var(--tlv-sub);margin:1.1em 0 .4em}
.tlv-rg .grid{display:grid;font-size:.78em;border-top:1px solid var(--tlv-line-2)}
.tlv-rg .g4{grid-template-columns:1.1fr 1fr 1.4fr 1fr}
.tlv-rg .g5{grid-template-columns:.8fr 1.2fr 1.3fr 1.5fr .9fr}
.tlv-rg .grid>span{padding:.3em .5em;border-bottom:1px solid var(--tlv-line);word-break:keep-all;transition:background .2s}
.tlv-rg .grid>.h{font-weight:600;color:var(--tlv-sub)}
.tlv-rg .grid>.gs{border-top:1px solid var(--tlv-line-2)}
.tlv-rg .grid>.sk{color:var(--tlv-mute);text-decoration:line-through}
.tlv-rg .grid>.hit{background:var(--tlv-accent-bg);color:var(--tlv-accent-text)}
.tlv-rg .grid>.am{color:var(--tlv-mute)}
.tlv-rg .grid>.ok{color:var(--tlv-good)}
.tlv-rg .grid>.rd{color:var(--tlv-accent-text);font-weight:600}
.tlv-rg .strip{display:flex;gap:4px}
.tlv-rg .grp{min-width:0}
.tlv-rg .gl{font-size:.7em;color:var(--tlv-sub);white-space:nowrap;overflow:hidden;margin-bottom:2px}
.tlv-rg .segs{display:flex;gap:2px;height:2.2em}
.tlv-rg .seg{min-width:0;display:flex;align-items:center;justify-content:center;font-family:var(--tlv-mono);font-size:.66em;border:1px solid var(--tlv-line);border-radius:3px;background:var(--tlv-soft);color:var(--tlv-mute);overflow:hidden;white-space:nowrap;transition:background .2s}
.tlv-rg .seg.rd{background:var(--tlv-accent-bg);border-color:var(--tlv-accent);color:var(--tlv-accent-text)}
.tlv-rg .note{font-size:.72em;color:var(--tlv-mute);margin-top:.3em}
.tlv-rg .res{margin-top:1em;font-size:.88em}
.tlv-rg .io{font-size:.78em;color:var(--tlv-sub);font-family:var(--tlv-mono)}
</style>

<figure class="tlv tlv-rg" id="tlv-4-rg">
<div class="tlv-box">
<div class="ctl"><select aria-label="조회 조건"><option value="C07">customer_id = 'C07'</option><option value="C03">customer_id = 'C03'</option><option value="C11">customer_id = 'C11' (없는 값)</option><option value="C15">customer_id = 'C15' (범위 밖)</option></select><label><input type="checkbox"> Bloom Filter 사용</label></div>
<p class="sql" data-el="sql">SELECT customer_name FROM sales.orders WHERE customer_id = 'C07'</p>
<div class="lb">표 (행 9개, 행 그룹 3개)</div>
<div class="grid g4">
<span class="h">행 그룹</span><span class="h">customer_id</span><span class="h">customer_name</span><span class="h">amount</span>
<span class="gs sk" data-r="00">행 그룹 1</span><span class="gs sk" data-r="00">C01</span><span class="gs sk" data-r="00">가나상사</span><span class="gs sk am" data-r="00">1,200</span>
<span class="sk" data-r="01"></span><span class="sk" data-r="01">C03</span><span class="sk" data-r="01">다라물산</span><span class="sk am" data-r="01">800</span>
<span class="sk" data-r="02"></span><span class="sk" data-r="02">C04</span><span class="sk" data-r="02">마바건설</span><span class="sk am" data-r="02">2,500</span>
<span class="gs" data-r="10">행 그룹 2</span><span class="gs" data-r="10">C05</span><span class="gs" data-r="10">사아식품</span><span class="gs am" data-r="10">640</span>
<span class="hit" data-r="11"></span><span class="hit" data-r="11">C07</span><span class="hit" data-r="11">자차전자</span><span class="hit am" data-r="11">3,100</span>
<span data-r="12"></span><span data-r="12">C08</span><span data-r="12">카타물류</span><span class="am" data-r="12">970</span>
<span class="gs" data-r="20">행 그룹 3</span><span class="gs" data-r="20">C02</span><span class="gs" data-r="20">파하유통</span><span class="gs am" data-r="20">1,450</span>
<span data-r="21"></span><span data-r="21">C09</span><span data-r="21">가람제약</span><span class="am" data-r="21">720</span>
<span data-r="22"></span><span data-r="22">C12</span><span data-r="22">나래기계</span><span class="am" data-r="22">2,080</span>
</div>
<div class="lb">파일 안 배치 (주황 = 디스크에서 읽는 부분, 칸 너비 = 용량)</div>
<div class="strip">
<div class="grp" style="flex:128"><div class="gl">행 그룹 1 (128MB)</div><div class="segs"><div class="seg" data-el="s0c" style="flex:20">id</div><div class="seg" data-el="s0n" style="flex:70">name</div><div class="seg" style="flex:38">amt</div></div></div>
<div class="grp" style="flex:128"><div class="gl">행 그룹 2 (128MB)</div><div class="segs"><div class="seg rd" data-el="s1c" style="flex:20">id</div><div class="seg rd" data-el="s1n" style="flex:70">name</div><div class="seg" style="flex:38">amt</div></div></div>
<div class="grp" style="flex:128"><div class="gl">행 그룹 3 (128MB)</div><div class="segs"><div class="seg rd" data-el="s2c" style="flex:20">id</div><div class="seg rd" data-el="s2n" style="flex:70">name</div><div class="seg" style="flex:38">amt</div></div></div>
<div class="grp" style="flex:72"><div class="gl">파일 끝</div><div class="segs"><div class="seg" data-el="sbf" style="flex:1">BF</div><div class="seg rd" style="flex:2.2">footer</div></div></div>
</div>
<p class="note">id = customer_id, name = customer_name, amt = amount, BF = Bloom Filter 영역</p>
<div class="lb">footer의 행 그룹별 정보</div>
<div class="grid g5">
<span class="h">행 그룹</span><span class="h">customer_id 범위</span><span class="h">min/max</span><span class="h">Bloom Filter</span><span class="h">결과</span>
<span>1</span><span>C01 ~ C04</span><span class="am" data-el="m0">범위 밖, 제외</span><span data-el="b0">사용 안 함</span><span class="am" data-el="x0">건너뜀</span>
<span>2</span><span>C05 ~ C08</span><span data-el="m1">범위 안, 통과</span><span data-el="b1">사용 안 함</span><span class="rd" data-el="x1">읽음</span>
<span>3</span><span>C02 ~ C12</span><span data-el="m2">범위 안, 통과</span><span data-el="b2">사용 안 함</span><span class="rd" data-el="x2">읽음</span>
</div>
<p class="res" data-el="res">결과: 행 그룹 2에서 찾았다. 행 그룹 1개는 읽었지만 값이 없었다.</p>
<p class="io" data-el="io">읽은 데이터 180MB / 전체 384MB · 건너뛴 행 그룹 1 / 3</p>
</div>
<figcaption class="tlv-cap"><b>그림 3.</b> 기본 상태(C07 조회, Bloom Filter 사용 안 함)에서는 범위가 넓은 행 그룹 3도 읽고, Bloom Filter를 사용하면 행 그룹 3을 건너뛴다.</figcaption>
</figure>

<script>
(function(){
  var root = document.getElementById('tlv-4-rg'); if (!root) return;
  var RG = [
    { min: 'C01', max: 'C04', v: ['C01','C03','C04'] },
    { min: 'C05', max: 'C08', v: ['C05','C07','C08'] },
    { min: 'C02', max: 'C12', v: ['C02','C09','C12'] }
  ];
  var sel = root.querySelector('select'), bf = root.querySelector('input[type=checkbox]');
  function el(k){ return root.querySelector('[data-el="' + k + '"]'); }
  function mark(node, cls){ node.className = cls; }
  function run(){
    var v = sel.value, useBf = bf.checked, mb = 0, skip = 0, found = -1, wasted = 0, anyPass = false;
    el('sql').textContent = "SELECT customer_name FROM sales.orders WHERE customer_id = '" + v + "'";
    RG.forEach(function(g, i){
      var pass = v >= g.min ? g.max >= v : false;
      var has = g.v.indexOf(v) !== -1;
      var read = pass ? (useBf ? has : true) : false;
      el('m' + i).textContent = pass ? '범위 안, 통과' : '범위 밖, 제외';
      mark(el('m' + i), pass ? '' : 'am');
      var bText = '사용 안 함', bCls = '';
      if (useBf){ bText = pass ? (has ? '있을 수도 있음' : '확실히 없음, 제외') : '-'; bCls = pass ? (has ? '' : 'ok') : 'am'; }
      el('b' + i).textContent = bText; mark(el('b' + i), bCls);
      el('x' + i).textContent = read ? '읽음' : '건너뜀';
      mark(el('x' + i), read ? 'rd' : 'am');
      el('s' + i + 'c').classList.toggle('rd', read);
      el('s' + i + 'n').classList.toggle('rd', read);
      g.v.forEach(function(x, j){
        root.querySelectorAll('[data-r="' + i + j + '"]').forEach(function(c, k){
          c.classList.toggle('sk', !read);
          c.classList.toggle('hit', read ? x === v : false);
        });
      });
      if (read){ mb += 90; if (has) found = i; else wasted++; } else skip++;
      if (useBf){ if (pass) mb += 1; }
      anyPass = anyPass || pass;
    });
    el('sbf').classList.toggle('rd', useBf ? anyPass : false);
    var t = found !== -1 ? '결과: 행 그룹 ' + (found + 1) + '에서 찾았다.' : '결과: 해당 값이 없다.';
    if (wasted) t += ' 행 그룹 ' + wasted + '개는 읽었지만 값이 없었다.';
    el('res').textContent = t;
    el('io').textContent = '읽은 데이터 ' + mb + 'MB / 전체 384MB · 건너뛴 행 그룹 ' + skip + ' / 3';
  }
  sel.addEventListener('change', run); bf.addEventListener('change', run); run();
})();
</script>

조건을 바꿔 보면 다음 차이가 보인다.

- `amount`는 쿼리에 쓰이지 않아 어떤 조건에서도 읽지 않는다. 컬럼형 저장에서 기본으로 얻는 이득이다.
- 행 그룹 3의 customer_id 범위가 C02~C12로 넓은 것은 정렬되지 않은 값이 섞여 들어갔기 때문이다. min/max만 쓰면 C07을 조회할 때 값이 없는 행 그룹 3도 읽는다. Bloom Filter를 쓰면 행 그룹 3을 건너뛰어 읽는 양이 180MB에서 92MB(Bloom Filter 2MB 포함)로 줄어든다.
- `C11`은 어느 행 그룹에도 없다. min/max로는 행 그룹 3을 읽어야 하지만 Bloom Filter를 쓰면 데이터 영역은 읽지 않는다.
- `C15`는 모든 행 그룹의 범위 밖이라 min/max만으로 전부 제외된다. 이런 조건에서는 Bloom Filter가 추가로 하는 일이 없다.

그림은 오탐이 없다고 가정했다. 실제로는 5장의 오탐률만큼 값이 없는 행 그룹도 읽게 된다.

---

## 5. 필터 크기와 오탐률

### 5.1 비트 수와 오탐률의 관계

일반 Bloom Filter의 오탐률은 다음 식으로 근사한다.

```text
p ≈ (1 - e^(-k·n/m))^k

n: 추가한 고유값 수
m: 비트 수
k: 해시 함수 수
```

목표 오탐률이 1%면 고유값 하나당 약 9.6비트(해시 7개), 0.1%면 약 14.4비트(해시 10개)가 필요하다. Parquet의 SBBF는 parquet-java(구 parquet-mr) 구현에서 고유값 하나당 비트 수를 `-8 / ln(1 - p^(1/8))`로 계산하며 1%일 때 약 9.7비트다.

### 5.2 1MB 상한에서의 오탐률

Iceberg는 column chunk 하나의 Bloom Filter 크기 상한을 `write.parquet.bloom-filter-max-bytes`(기본 1MB)로 둔다. 1MB는 8,388,608비트이고 parquet-java 계산식으로는 고유값 약 87만 개를 담을 때 1%가 된다. 블록마다 들어가는 값 수의 편차까지 반영하면 같은 87만 개에서 약 1.5%이고 그보다 많아지면 오탐률이 빠르게 오른다.

| 행 그룹 하나의 고유값 수 | 오탐률 (SBBF 1MB, 계산값) |
|--:|--:|
| 10만 | 0.0001% 미만 |
| 30만 | 0.007% |
| 50만 | 0.10% |
| 87만 | 1.5% |
| 100만 | 2.7% |
| 200만 | 29% |
| 500만 | 93% |

블록 32,768개에 고유값이 고르게 흩어진다고 보고 블록마다 들어간 값 수를 포아송 분포로 놓은 뒤 블록 안 워드 8개에서 조회 비트가 모두 1일 확률을 평균해 계산했다. 실제 파일에서 측정한 값은 아니다.

기준은 테이블 전체가 아니라 행 그룹 하나의 고유값 수다. 행이 좁아 128MB 행 그룹에 수백만 행이 들어가는 테이블에서는 고유 ID 컬럼의 행 그룹당 고유값이 87만을 쉽게 넘는다. 행 그룹당 고유값이 300만이면 parquet-java 계산식 기준으로 약 3.5MB가 필요하므로 상한을 그만큼 올려야 한다.

---

## 6. 효과가 나는 조건

Bloom Filter는 해당 값이 실제로 없는 행 그룹만 건너뛰게 한다. 오탐률이 0이어도 값이 모든 행 그룹에 들어 있으면 건너뛸 행 그룹이 없다. 그래서 효과는 필터의 정확도보다 값 하나가 몇 개의 행 그룹에 퍼져 있는지에 먼저 좌우된다.

### 6.1 값의 분포와 조건 유형

| 조건 | 효과 | 이유 |
|---|---|---|
| 정렬되지 않은 테이블의 고유 ID 등식 조회 (`order_no = ...`) | 큼 | 값이 행 그룹 1~2개에만 있고, min/max 범위는 넓어 거르지 못한다 |
| 해당 컬럼으로 정렬된 테이블 | 작음 | min/max가 이미 거른다 |
| 값 하나에 행이 많아 모든 행 그룹에 퍼진 컬럼 | 없음 | 실제로 모든 행 그룹에 값이 있다 |
| 고유값이 적은 코드 컬럼 (`status_code`, `order_month`) | 작음 | dictionary 필터가 이미 판정한다 |
| 범위 조건, `LIKE 'C2%'`, `!=` | 없음 | 해시에는 값의 순서와 접두어 정보가 남지 않는다. 등식과 IN만 판정한다 |
| 행 그룹당 고유값이 87만을 넘는 컬럼 (상한 1MB) | 약해짐 | 오탐률이 급격히 오른다 (5.2절) |

### 6.2 파일 크기와 행 그룹 수

파일 하나에 행 그룹이 하나뿐이면 행 그룹 min/max는 manifest의 파일 min/max와 사실상 같다. 이 경우 2단계에서 추가로 걸러지는 행 그룹이 없고 행 그룹 단계에서 얻을 수 있는 이득은 dictionary와 Bloom Filter 정도다.

매일 MERGE로 다시 쓰는 테이블은 결과 파일이 20~30MB대라 파일 하나에 행 그룹이 하나였다. 파일이 행 그룹 목표 크기 128MB보다 작기 때문이다. 반대로 압축 목표 크기를 1GB로 잡은 테이블은 파일 하나에 행 그룹이 약 8개 들어간다. 행 그룹 수가 많은 큰 파일일수록 행 그룹 단위로 건너뛸 여지가 크다.

### 6.3 정렬 키와의 관계

정렬(sort order, Z-order)은 파일과 행 그룹의 값 범위를 좁혀 1·2단계의 min/max가 거르게 만든다. Bloom Filter는 그 뒤의 4단계를 보강한다. 정렬 첫 키로 쓰는 컬럼에는 Bloom Filter가 거의 필요 없고 정렬로 범위를 좁히기 어려운 두 번째 이후 컬럼이나 정렬 키로 쓰지 않는 고유 ID 컬럼이 Bloom Filter 대상이다. 정렬을 이용한 파일 단위 데이터 스키핑은 [Delta Lake Z-Order 다차원 정렬과 파일 건너뛰기](/data/delta-lake-zorder-data-skipping/)에서 다뤘다.

---

## 7. Iceberg 설정과 효과 확인

활성화 여부와 오탐률은 컬럼마다 `.column.<컬럼명>`을 붙인 속성으로 지정한다.

```sql
ALTER TABLE sales.orders SET TBLPROPERTIES (
  'write.parquet.bloom-filter-enabled.column.order_no' = 'true',
  'write.parquet.bloom-filter-fpp.column.order_no'     = '0.01',
  'write.parquet.bloom-filter-max-bytes'               = '1048576'
);
```

- `.column.`이 빠진 `write.parquet.bloom-filter-fpp` 같은 이름은 Iceberg 1.x 문서의 속성 목록에 없다. 이런 속성은 테이블 메타데이터에 저장만 되고 동작에는 반영되지 않는다.
- 속성은 이후 새로 쓰는 파일에만 적용된다. `ALTER TABLE`은 메타데이터 변경이라 바로 끝나고 기존 파일에 Bloom Filter를 만들려면 파일을 다시 써야 한다.

```sql
CALL catalog.system.rewrite_data_files(
  table   => 'sales.orders',
  options => map('rewrite-all', 'true')
);
```

- 파일에 Bloom Filter가 들어갔는지는 parquet-cli의 `bloom-filter` 명령으로 확인한다. 컬럼과 값을 주면 행 그룹별 판정을 출력한다.

```bash
parquet bloom-filter -c order_no -v O-0000123 part-00000.parquet
```

- 효과를 잴 때는 Bloom Filter 외의 조건을 같게 둔다. 압축처럼 파일 구성을 바꾸는 작업과 함께 적용하면 응답 시간이 줄어도 어느 변경의 효과인지 나눌 수 없다. 같은 파일 구성에서 Bloom Filter 유무만 다르게 두고 등식 조회를 여러 번 실행해, 응답 시간과 함께 Spark UI의 읽은 데이터량을 비교한다.

---

## 8. 정리

- Parquet 파일은 행을 행 그룹(Iceberg 기본 128MB)으로 끊고 행 그룹 안에서 컬럼별로 저장한다. min/max 통계, dictionary, Bloom Filter는 행 그룹의 column chunk 단위로 보관하거나 참조한다.
- Bloom Filter는 해시 위치의 비트로 확실히 없음과 있을 수도 있음을 판정한다. 미탐은 없고 오탐률은 행 그룹당 고유값 수에 따라 오른다. 1MB 상한에서는 고유값 약 87만 개에서 1%를 넘고 200만 개에서 약 29%가 된다(계산값).
- Iceberg 읽기에서 파일은 manifest 통계로 먼저 거르고, 파일을 연 뒤에는 행 그룹 min/max·dictionary·Bloom Filter 같은 정보로 행 그룹을 더 거를 수 있다. Bloom Filter가 건너뛰는 단위는 파일이 아니라 행 그룹이다.
- 효과는 값이 소수의 행 그룹에만 있는 등식·IN 조회 컬럼에서 난다. 정렬 키 컬럼, 고유값이 적은 컬럼, 범위·LIKE 조건에는 효과가 거의 없다.
- 설정은 새로 쓰는 파일에만 적용되므로 기존 파일은 재작성해야 하고 효과는 다른 변경과 분리해 측정한다.

---

## 9. 참고 자료

- [Apache Iceberg - Configuration](https://iceberg.apache.org/docs/latest/configuration/)
- [Apache Iceberg - Table Spec](https://iceberg.apache.org/spec/)
- [Apache Parquet - Bloom Filter](https://parquet.apache.org/docs/file-format/bloomfilter/)
- [Apache Parquet Java - parquet-hadoop configuration](https://github.com/apache/parquet-java/blob/master/parquet-hadoop/README.md)
