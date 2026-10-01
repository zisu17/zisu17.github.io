---
title: "[Databricks] Delta Lake Z-Order 다차원 정렬과 파일 건너뛰기"
excerpt: "Delta Lake의 Z-Order가 여러 컬럼 값을 같은 파일에 모으는 원리와 정렬 방식별로 읽는 파일 수의 차이, 적용 방법과 컬럼 선택 기준, Liquid Clustering과의 차이를 정리한다."
categories:
  - Data Engineering
tags:
  - Data Engineering
  - Databricks
  - DeltaLake
  - ZOrder
  - DataSkipping
  - LiquidClustering
permalink: /data/delta-lake-zorder-data-skipping/
toc: true
toc_sticky: true
date: 2026-09-29
last_modified_at: 2026-09-29
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

Delta Lake 테이블은 여러 개의 Parquet 파일로 저장된다. 쿼리가 몇 개의 파일을 여는지는 스캔 바이트와 네트워크 I/O, 실행 시간에 직접 영향을 준다.

Delta Lake는 파일을 쓸 때 컬럼별 `min`, `max`, `nullCount` 통계를 `_delta_log` 트랜잭션 로그에 기록한다. 조건 값이 어떤 파일의 min~max 범위 밖에 있으면 그 파일은 열지 않는다. 이 동작을 Data Skipping이라 한다.

통계가 있어도 값이 파일마다 무작위로 흩어져 있으면 모든 파일의 범위가 `min=1`, `max=1000000`처럼 넓어져 건너뛸 파일이 없다. 비슷한 값이 같은 파일에 모여 있어야 건너뛸 파일이 생긴다. Z-Order는 여러 컬럼을 동시에 기준으로 삼아 비슷한 값을 같은 파일에 모으는 배치 방식이다.

본문의 테이블·컬럼 이름(`events`, `user_id` 등)은 예시 값이다. 동작은 Databricks Runtime의 Delta Lake를 기준으로 설명하며 세부 기본값은 런타임 버전마다 다를 수 있다.

---

## 2. 동작 원리

### 2.1 단일 컬럼 정렬의 한계

컬럼이 하나라면 그 컬럼으로 정렬해서 파일을 쓰면 된다. 컬럼이 둘 이상일 때 `ORDER BY a, b`로 정렬하면 첫 번째 컬럼 `a`만 파일 단위로 모인다. `b`는 같은 `a` 값 안에서만 정렬되므로 `b`로만 필터하면 거의 모든 파일의 `b` 범위가 전체 값 범위에 가깝고 건너뛸 파일이 없다.

### 2.2 Z-order curve(Morton 코드)

Z-Order는 여러 컬럼 값의 비트를 번갈아 끼워 넣어 정수 하나를 만든다. 이 값을 z-value라 하고 비트를 섞는 과정을 bit interleaving이라 한다. 정렬은 z-value 기준으로 한다. 좌표 (x, y) = (2, 3)으로 계산하면 아래와 같다.

```text
x = 2  →  0 1 0   (x2 x1 x0)
y = 3  →  0 1 1   (y2 y1 y0)

z = y2 x2  y1 x1  y0 x0
  =  0  0   1  1   1  0   →  001110(2) = 14
```

z-value 순서로 점을 이으면 평면을 Z자로 반복해 훑는 곡선이 된다. 이 순서대로 파일을 채우면 파일 하나가 긴 띠 대신 정사각형에 가까운 블록을 맡는다. x로 필터하든 y로 필터하든 읽어야 할 블록 수가 비슷하게 유지된다.

```text
OPTIMIZE ... ZORDER BY (x, y)
└─ 대상 파일 읽기
   ├─ 각 행의 x, y → range ID로 변환 (값 분포 편향 완화)
   ├─ range ID 비트 교차 → z-value 계산
   ├─ z-value 기준 정렬·셔플
   └─ 목표 크기 단위로 새 파일 기록 → 파일별 min/max 통계 갱신
```

위 계산은 값을 그대로 좌표로 쓴 예시이고 실제 구현은 샘플링으로 구한 범위 구간 번호를 쓴다. 이 번호를 range ID라 하며 비트 교차는 range ID에 적용한다. 값이 한쪽에 몰린 컬럼이나 문자열 컬럼에서도 블록이 고르게 나뉘는 이유다.

---

## 3. 정렬 방식별 읽는 파일 수

x와 y가 각각 0~7인 64개 행을 파일 16개에 4행씩 나눠 저장한 상태를 격자로 그렸다. 칸 안의 숫자는 그 행이 들어간 파일 번호다. 정렬 방식이나 쿼리 조건을 바꾸면 읽어야 하는 파일이 표시되고 파일 수가 다시 계산된다. 정렬하지 않은 배치는 무작위 순서 하나를 고정해 사용했다.

<style>
.tlv-zv .row{display:flex;flex-wrap:wrap;align-items:center;gap:.35em .45em;margin:.3em 0;font-size:.8em}
.tlv-zv .lbl{flex:0 0 4.6em;color:var(--tlv-sub);font-weight:600;white-space:nowrap}
.tlv-zv .btn{border:1px solid var(--tlv-line-2);border-radius:4px;background:#fff;color:var(--tlv-sub);padding:.25em .7em;font-size:.95em;line-height:1.5}
.tlv-zv .btn[aria-pressed="true"]{border-color:var(--tlv-accent);background:var(--tlv-accent-bg);color:var(--tlv-accent-text);font-weight:600}
.tlv-zv input[type=range]{width:9em;accent-color:var(--tlv-accent)}
.tlv-zv .kout{font-family:var(--tlv-mono);min-width:3.4em}
.tlv-zv .chk{display:inline-flex;align-items:center;gap:.4em;color:var(--tlv-sub)}
.tlv-zv .stage{display:flex;flex-wrap:wrap;gap:1em;align-items:center;margin-top:.7em}
.tlv-zv .stage>.tlv-svg{flex:0 1 340px;max-width:340px;min-width:0}
.tlv-zv .stage>div{flex:1 1 200px;min-width:0}
.tlv-zv .tlv-stats{grid-template-columns:1fr 1fr;margin-top:.5em}
.tlv-zv .tlv-legend{margin-bottom:0}
.tlv-zv .ax{font-size:11px;fill:var(--tlv-mute)}
.tlv-zv .zt{font-size:11px}
.tlv-zv .z-hit{fill:var(--tlv-good-bg);stroke:var(--tlv-good);stroke-opacity:.45}
.tlv-zv .z-read{fill:var(--tlv-accent-bg);stroke:var(--tlv-accent-line)}
.tlv-zv .z-skip{fill:#fff;stroke:var(--tlv-line)}
.tlv-zv .z-hit-t{fill:var(--tlv-good)}
.tlv-zv .z-read-t{fill:var(--tlv-accent-text)}
.tlv-zv .z-skip-t{fill:var(--tlv-mute)}
.tlv-zv .z-in{stroke:var(--tlv-accent);stroke-width:2}
.tlv-zv .z-out{stroke:var(--tlv-accent-2);stroke-width:1;stroke-dasharray:3 3}
</style>

<figure class="tlv tlv-zv" id="tlv-3-zorder">
<div class="tlv-box">
<div class="row"><span class="lbl">정렬 방식</span><button type="button" class="btn" data-m="rand" aria-pressed="false">정렬 안 함</button><button type="button" class="btn" data-m="lin" aria-pressed="false">ORDER BY x, y</button><button type="button" class="btn" data-m="z" aria-pressed="true">ZORDER BY (x, y)</button></div>
<div class="row"><span class="lbl">쿼리</span><button type="button" class="btn" data-a="x" aria-pressed="true">WHERE x = k</button><button type="button" class="btn" data-a="y" aria-pressed="false">WHERE y = k</button><input type="range" min="0" max="7" step="1" value="3" data-v="k" aria-label="k 값"><span class="kout" data-v="kout">k = 3</span></div>
<div class="row"><span class="lbl">표시</span><label class="chk"><input type="checkbox" data-v="path" checked> 저장 순서(곡선)</label></div>
<div class="stage">
<svg class="tlv-svg" viewBox="0 0 340 346" role="img" aria-label="8×8 격자에서 정렬 방식에 따라 같은 쿼리가 읽는 파일이 달라진다"><text class="ax" x="41" y="340" text-anchor="middle">x0</text><text class="ax" x="12" y="311" text-anchor="middle">y0</text><text class="ax" x="79" y="340" text-anchor="middle">x1</text><text class="ax" x="12" y="273" text-anchor="middle">y1</text><text class="ax" x="117" y="340" text-anchor="middle">x2</text><text class="ax" x="12" y="235" text-anchor="middle">y2</text><text class="ax" x="155" y="340" text-anchor="middle">x3</text><text class="ax" x="12" y="197" text-anchor="middle">y3</text><text class="ax" x="193" y="340" text-anchor="middle">x4</text><text class="ax" x="12" y="159" text-anchor="middle">y4</text><text class="ax" x="231" y="340" text-anchor="middle">x5</text><text class="ax" x="12" y="121" text-anchor="middle">y5</text><text class="ax" x="269" y="340" text-anchor="middle">x6</text><text class="ax" x="12" y="83" text-anchor="middle">y6</text><text class="ax" x="307" y="340" text-anchor="middle">x7</text><text class="ax" x="12" y="45" text-anchor="middle">y7</text><rect class="z-skip" x="23" y="289" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="41" y="311" text-anchor="middle">1</text><rect class="z-skip" x="23" y="251" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="41" y="273" text-anchor="middle">1</text><rect class="z-skip" x="23" y="213" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="41" y="235" text-anchor="middle">3</text><rect class="z-skip" x="23" y="175" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="41" y="197" text-anchor="middle">3</text><rect class="z-skip" x="23" y="137" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="41" y="159" text-anchor="middle">9</text><rect class="z-skip" x="23" y="99" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="41" y="121" text-anchor="middle">9</text><rect class="z-skip" x="23" y="61" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="41" y="83" text-anchor="middle">11</text><rect class="z-skip" x="23" y="23" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="41" y="45" text-anchor="middle">11</text><rect class="z-skip" x="61" y="289" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="79" y="311" text-anchor="middle">1</text><rect class="z-skip" x="61" y="251" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="79" y="273" text-anchor="middle">1</text><rect class="z-skip" x="61" y="213" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="79" y="235" text-anchor="middle">3</text><rect class="z-skip" x="61" y="175" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="79" y="197" text-anchor="middle">3</text><rect class="z-skip" x="61" y="137" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="79" y="159" text-anchor="middle">9</text><rect class="z-skip" x="61" y="99" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="79" y="121" text-anchor="middle">9</text><rect class="z-skip" x="61" y="61" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="79" y="83" text-anchor="middle">11</text><rect class="z-skip" x="61" y="23" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="79" y="45" text-anchor="middle">11</text><rect class="z-read" x="99" y="289" width="36" height="36" rx="3"/><text class="zt z-read-t" x="117" y="311" text-anchor="middle">2</text><rect class="z-read" x="99" y="251" width="36" height="36" rx="3"/><text class="zt z-read-t" x="117" y="273" text-anchor="middle">2</text><rect class="z-read" x="99" y="213" width="36" height="36" rx="3"/><text class="zt z-read-t" x="117" y="235" text-anchor="middle">4</text><rect class="z-read" x="99" y="175" width="36" height="36" rx="3"/><text class="zt z-read-t" x="117" y="197" text-anchor="middle">4</text><rect class="z-read" x="99" y="137" width="36" height="36" rx="3"/><text class="zt z-read-t" x="117" y="159" text-anchor="middle">10</text><rect class="z-read" x="99" y="99" width="36" height="36" rx="3"/><text class="zt z-read-t" x="117" y="121" text-anchor="middle">10</text><rect class="z-read" x="99" y="61" width="36" height="36" rx="3"/><text class="zt z-read-t" x="117" y="83" text-anchor="middle">12</text><rect class="z-read" x="99" y="23" width="36" height="36" rx="3"/><text class="zt z-read-t" x="117" y="45" text-anchor="middle">12</text><rect class="z-hit" x="137" y="289" width="36" height="36" rx="3"/><text class="zt z-hit-t" x="155" y="311" text-anchor="middle">2</text><rect class="z-hit" x="137" y="251" width="36" height="36" rx="3"/><text class="zt z-hit-t" x="155" y="273" text-anchor="middle">2</text><rect class="z-hit" x="137" y="213" width="36" height="36" rx="3"/><text class="zt z-hit-t" x="155" y="235" text-anchor="middle">4</text><rect class="z-hit" x="137" y="175" width="36" height="36" rx="3"/><text class="zt z-hit-t" x="155" y="197" text-anchor="middle">4</text><rect class="z-hit" x="137" y="137" width="36" height="36" rx="3"/><text class="zt z-hit-t" x="155" y="159" text-anchor="middle">10</text><rect class="z-hit" x="137" y="99" width="36" height="36" rx="3"/><text class="zt z-hit-t" x="155" y="121" text-anchor="middle">10</text><rect class="z-hit" x="137" y="61" width="36" height="36" rx="3"/><text class="zt z-hit-t" x="155" y="83" text-anchor="middle">12</text><rect class="z-hit" x="137" y="23" width="36" height="36" rx="3"/><text class="zt z-hit-t" x="155" y="45" text-anchor="middle">12</text><rect class="z-skip" x="175" y="289" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="193" y="311" text-anchor="middle">5</text><rect class="z-skip" x="175" y="251" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="193" y="273" text-anchor="middle">5</text><rect class="z-skip" x="175" y="213" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="193" y="235" text-anchor="middle">7</text><rect class="z-skip" x="175" y="175" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="193" y="197" text-anchor="middle">7</text><rect class="z-skip" x="175" y="137" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="193" y="159" text-anchor="middle">13</text><rect class="z-skip" x="175" y="99" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="193" y="121" text-anchor="middle">13</text><rect class="z-skip" x="175" y="61" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="193" y="83" text-anchor="middle">15</text><rect class="z-skip" x="175" y="23" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="193" y="45" text-anchor="middle">15</text><rect class="z-skip" x="213" y="289" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="231" y="311" text-anchor="middle">5</text><rect class="z-skip" x="213" y="251" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="231" y="273" text-anchor="middle">5</text><rect class="z-skip" x="213" y="213" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="231" y="235" text-anchor="middle">7</text><rect class="z-skip" x="213" y="175" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="231" y="197" text-anchor="middle">7</text><rect class="z-skip" x="213" y="137" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="231" y="159" text-anchor="middle">13</text><rect class="z-skip" x="213" y="99" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="231" y="121" text-anchor="middle">13</text><rect class="z-skip" x="213" y="61" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="231" y="83" text-anchor="middle">15</text><rect class="z-skip" x="213" y="23" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="231" y="45" text-anchor="middle">15</text><rect class="z-skip" x="251" y="289" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="269" y="311" text-anchor="middle">6</text><rect class="z-skip" x="251" y="251" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="269" y="273" text-anchor="middle">6</text><rect class="z-skip" x="251" y="213" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="269" y="235" text-anchor="middle">8</text><rect class="z-skip" x="251" y="175" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="269" y="197" text-anchor="middle">8</text><rect class="z-skip" x="251" y="137" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="269" y="159" text-anchor="middle">14</text><rect class="z-skip" x="251" y="99" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="269" y="121" text-anchor="middle">14</text><rect class="z-skip" x="251" y="61" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="269" y="83" text-anchor="middle">16</text><rect class="z-skip" x="251" y="23" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="269" y="45" text-anchor="middle">16</text><rect class="z-skip" x="289" y="289" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="307" y="311" text-anchor="middle">6</text><rect class="z-skip" x="289" y="251" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="307" y="273" text-anchor="middle">6</text><rect class="z-skip" x="289" y="213" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="307" y="235" text-anchor="middle">8</text><rect class="z-skip" x="289" y="175" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="307" y="197" text-anchor="middle">8</text><rect class="z-skip" x="289" y="137" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="307" y="159" text-anchor="middle">14</text><rect class="z-skip" x="289" y="99" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="307" y="121" text-anchor="middle">14</text><rect class="z-skip" x="289" y="61" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="307" y="83" text-anchor="middle">16</text><rect class="z-skip" x="289" y="23" width="36" height="36" rx="3"/><text class="zt z-skip-t" x="307" y="45" text-anchor="middle">16</text><line class="z-in" x1="41" y1="307" x2="79" y2="307"/><line class="z-in" x1="79" y1="307" x2="41" y2="269"/><line class="z-in" x1="41" y1="269" x2="79" y2="269"/><line class="z-out" x1="79" y1="269" x2="117" y2="307"/><line class="z-in" x1="117" y1="307" x2="155" y2="307"/><line class="z-in" x1="155" y1="307" x2="117" y2="269"/><line class="z-in" x1="117" y1="269" x2="155" y2="269"/><line class="z-out" x1="155" y1="269" x2="41" y2="231"/><line class="z-in" x1="41" y1="231" x2="79" y2="231"/><line class="z-in" x1="79" y1="231" x2="41" y2="193"/><line class="z-in" x1="41" y1="193" x2="79" y2="193"/><line class="z-out" x1="79" y1="193" x2="117" y2="231"/><line class="z-in" x1="117" y1="231" x2="155" y2="231"/><line class="z-in" x1="155" y1="231" x2="117" y2="193"/><line class="z-in" x1="117" y1="193" x2="155" y2="193"/><line class="z-out" x1="155" y1="193" x2="193" y2="307"/><line class="z-in" x1="193" y1="307" x2="231" y2="307"/><line class="z-in" x1="231" y1="307" x2="193" y2="269"/><line class="z-in" x1="193" y1="269" x2="231" y2="269"/><line class="z-out" x1="231" y1="269" x2="269" y2="307"/><line class="z-in" x1="269" y1="307" x2="307" y2="307"/><line class="z-in" x1="307" y1="307" x2="269" y2="269"/><line class="z-in" x1="269" y1="269" x2="307" y2="269"/><line class="z-out" x1="307" y1="269" x2="193" y2="231"/><line class="z-in" x1="193" y1="231" x2="231" y2="231"/><line class="z-in" x1="231" y1="231" x2="193" y2="193"/><line class="z-in" x1="193" y1="193" x2="231" y2="193"/><line class="z-out" x1="231" y1="193" x2="269" y2="231"/><line class="z-in" x1="269" y1="231" x2="307" y2="231"/><line class="z-in" x1="307" y1="231" x2="269" y2="193"/><line class="z-in" x1="269" y1="193" x2="307" y2="193"/><line class="z-out" x1="307" y1="193" x2="41" y2="155"/><line class="z-in" x1="41" y1="155" x2="79" y2="155"/><line class="z-in" x1="79" y1="155" x2="41" y2="117"/><line class="z-in" x1="41" y1="117" x2="79" y2="117"/><line class="z-out" x1="79" y1="117" x2="117" y2="155"/><line class="z-in" x1="117" y1="155" x2="155" y2="155"/><line class="z-in" x1="155" y1="155" x2="117" y2="117"/><line class="z-in" x1="117" y1="117" x2="155" y2="117"/><line class="z-out" x1="155" y1="117" x2="41" y2="79"/><line class="z-in" x1="41" y1="79" x2="79" y2="79"/><line class="z-in" x1="79" y1="79" x2="41" y2="41"/><line class="z-in" x1="41" y1="41" x2="79" y2="41"/><line class="z-out" x1="79" y1="41" x2="117" y2="79"/><line class="z-in" x1="117" y1="79" x2="155" y2="79"/><line class="z-in" x1="155" y1="79" x2="117" y2="41"/><line class="z-in" x1="117" y1="41" x2="155" y2="41"/><line class="z-out" x1="155" y1="41" x2="193" y2="155"/><line class="z-in" x1="193" y1="155" x2="231" y2="155"/><line class="z-in" x1="231" y1="155" x2="193" y2="117"/><line class="z-in" x1="193" y1="117" x2="231" y2="117"/><line class="z-out" x1="231" y1="117" x2="269" y2="155"/><line class="z-in" x1="269" y1="155" x2="307" y2="155"/><line class="z-in" x1="307" y1="155" x2="269" y2="117"/><line class="z-in" x1="269" y1="117" x2="307" y2="117"/><line class="z-out" x1="307" y1="117" x2="193" y2="79"/><line class="z-in" x1="193" y1="79" x2="231" y2="79"/><line class="z-in" x1="231" y1="79" x2="193" y2="41"/><line class="z-in" x1="193" y1="41" x2="231" y2="41"/><line class="z-out" x1="231" y1="41" x2="269" y2="79"/><line class="z-in" x1="269" y1="79" x2="307" y2="79"/><line class="z-in" x1="307" y1="79" x2="269" y2="41"/><line class="z-in" x1="269" y1="41" x2="307" y2="41"/></svg>
<div>
<div class="tlv-legend"><span style="--sw:var(--tlv-good)">조건에 맞는 행</span><span style="--sw:var(--tlv-accent-2)">같은 파일이라 함께 읽히는 행</span><span style="--sw:var(--tlv-line-2)">건너뛴 파일</span></div>
<div class="tlv-stats">
<div class="tlv-stat"><div class="n" data-v="now">4<small> / 16</small></div><div class="l">이번 쿼리가 읽는 파일</div></div>
<div class="tlv-stat"><div class="n" data-v="skip">12<small> / 16</small></div><div class="l">건너뛴 파일</div></div>
<div class="tlv-stat"><div class="n" data-v="ax">4.0<small> / 16</small></div><div class="l">x 필터 평균 (k=0~7)</div></div>
<div class="tlv-stat"><div class="n" data-v="ay">4.0<small> / 16</small></div><div class="l">y 필터 평균 (k=0~7)</div></div>
</div>
</div>
</div>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> 같은 64개 행도 정렬 방식과 필터 컬럼에 따라 읽어야 하는 파일 수가 달라진다.</figcaption>
</figure>

<script>
(function () {
var N = 8, PER = 4, C = 38, O = 22, TOT = N * N / PER;
var pts = [];
for (var x = 0; x < N; x++) for (var y = 0; y < N; y++) pts.push({ x: x, y: y });
function zval(p) { var z = 0; for (var i = 0; i < 3; i++) { z |= ((p.x >> i) & 1) << (2 * i); z |= ((p.y >> i) & 1) << (2 * i + 1); } return z; }
function rng(s) { return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function order(m) {
  var a = pts.slice();
  if (m === 'lin') a.sort(function (p, q) { return p.x - q.x || p.y - q.y; });
  else if (m === 'z') a.sort(function (p, q) { return zval(p) - zval(q); });
  else { var r = rng(7); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } }
  return a;
}
function fileMap(m) { var a = order(m), f = {}; a.forEach(function (p, i) { f[p.x + ',' + p.y] = Math.floor(i / PER); }); return { a: a, f: f }; }
function filesRead(f, ax, kk) { var s = {}; pts.forEach(function (p) { if (p[ax] === kk) s[f[p.x + ',' + p.y]] = 1; }); return s; }
function size(o) { return Object.keys(o).length; }
function cx(p) { return O + p.x * C + C / 2; }
function cy(p) { return O + (N - 1 - p.y) * C + C / 2; }
function avg(f, ax) { var s = 0; for (var q = 0; q < N; q++) s += size(filesRead(f, ax, q)); return s / N; }
function grid(mode, axis, k, path) {
  var fm = fileMap(mode), a = fm.a, f = fm.f, rs = filesRead(f, axis, k), h = '';
  for (var i = 0; i < N; i++) {
    h += '<text class="ax" x="' + (O + i * C + C / 2) + '" y="' + (O + N * C + 14) + '" text-anchor="middle">x' + i + '</text>';
    h += '<text class="ax" x="' + (O - 10) + '" y="' + (O + (N - 1 - i) * C + C / 2 + 4) + '" text-anchor="middle">y' + i + '</text>';
  }
  pts.forEach(function (p) {
    var id = f[p.x + ',' + p.y], hit = p[axis] === k, rd = rs[id] === 1;
    var cls = hit ? 'z-hit' : rd ? 'z-read' : 'z-skip';
    h += '<rect class="' + cls + '" x="' + (O + p.x * C + 1) + '" y="' + (O + (N - 1 - p.y) * C + 1) + '" width="' + (C - 2) + '" height="' + (C - 2) + '" rx="3"/>';
    h += '<text class="zt ' + cls + '-t" x="' + cx(p) + '" y="' + (cy(p) + 4) + '" text-anchor="middle">' + (id + 1) + '</text>';
  });
  if (path) {
    for (var j = 0; j < a.length - 1; j++) {
      var same = Math.floor(j / PER) === Math.floor((j + 1) / PER);
      h += '<line class="' + (same ? 'z-in' : 'z-out') + '" x1="' + cx(a[j]) + '" y1="' + cy(a[j]) + '" x2="' + cx(a[j + 1]) + '" y2="' + cy(a[j + 1]) + '"/>';
    }
  }
  return { svg: h, now: size(rs), avgx: avg(f, 'x'), avgy: avg(f, 'y') };
}
var root = document.getElementById('tlv-3-zorder'); if (!root) return;
var mode = 'z', axis = 'x', kv = 3;
var svg = root.querySelector('svg');
function q(name) { return root.querySelector('[data-v="' + name + '"]'); }
function put(name, v) { q(name).innerHTML = v + '<small> / ' + TOT + '</small>'; }
function draw() {
  var g = grid(mode, axis, kv, q('path').checked);
  svg.innerHTML = g.svg;
  put('now', g.now); put('skip', TOT - g.now); put('ax', g.avgx.toFixed(1)); put('ay', g.avgy.toFixed(1));
  q('kout').textContent = 'k = ' + kv;
}
function group(attr, set) {
  var bs = root.querySelectorAll('[' + attr + ']');
  Array.prototype.forEach.call(bs, function (b) {
    b.addEventListener('click', function () {
      set(b.getAttribute(attr));
      Array.prototype.forEach.call(bs, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      draw();
    });
  });
}
group('data-m', function (v) { mode = v; });
group('data-a', function (v) { axis = v; });
q('k').addEventListener('input', function (e) { kv = +e.target.value; draw(); });
q('path').addEventListener('change', draw);
draw();
})();
</script>

### 3.1 결과 비교

| 정렬 방식 | 한 파일이 차지하는 모양 | `WHERE x = k` | `WHERE y = k` |
|---|---|---|---|
| 정렬 안 함 | 격자 전체에 흩어짐 | 평균 6.4 / 16 | 평균 6.5 / 16 |
| `ORDER BY x, y` | 세로 1×4 띠 | 2 / 16 | 8 / 16 |
| `ZORDER BY (x, y)` | 2×2 정사각형 블록 | 4 / 16 | 4 / 16 |

표의 값은 k를 0부터 7까지 바꿔 읽은 파일 수의 평균이고, 정렬한 두 방식은 k와 무관하게 값이 같다.

정렬하지 않으면 조건에 맞는 8개 행이 여러 파일에 흩어져 평균 6개 넘는 파일을 읽는다. 행이 훨씬 많은 실제 테이블에서는 모든 파일의 범위가 넓어져 건너뛸 파일이 거의 없다.

`ORDER BY x, y`는 첫 번째 컬럼 x로 필터할 때만 읽는 파일이 줄고 y로 필터하면 8개를 읽는다. Z-Order는 x 필터에서 `ORDER BY`보다 2개를 더 읽는 대신 y 필터에서 4개를 덜 읽는다. 곡선 표시를 켜면 저장 순서가 Z자를 반복하며 격자를 채운다. Z-Order라는 이름은 이 모양에서 왔다.

컬럼을 3개, 4개로 늘리면 블록은 3차원 이상의 입체가 된다. 파일 하나가 맡는 행 수는 그대로라서 컬럼 하나로 본 값 범위가 넓어지고 건너뛰는 파일이 준다. Z-Order 컬럼은 보통 1~3개로 둔다.

---

## 4. 적용 방법

### 4.1 SQL

`OPTIMIZE`는 작은 파일을 합치는 bin-packing과 Z-Order 정렬을 한 번에 처리한다. 파티션 테이블이면 `WHERE`로 대상 파티션을 좁혀 다시 쓰는 양을 줄인다.

```sql
-- 테이블 전체
OPTIMIZE events ZORDER BY (user_id, event_type);

-- 최근 파티션만 (파티션 컬럼 조건만 허용)
OPTIMIZE events
WHERE event_date >= '2026-09-01'
ZORDER BY (user_id);
```

### 4.2 Python (Delta Lake API)

```python
from delta.tables import DeltaTable

(DeltaTable.forName(spark, "events")
    .optimize()
    .where("event_date >= '2026-09-01'")
    .executeZOrderBy("user_id"))
```

### 4.3 효과 확인

OPTIMIZE 결과는 테이블 이력의 `operationMetrics`에 남는다. 조회 쪽 효과는 같은 쿼리를 OPTIMIZE 전후로 실행해 스캔 바이트와 files pruned / files read 비율을 비교한다.

```sql
DESCRIBE HISTORY events;   -- numFilesAdded, numFilesRemoved, zOrderStats 확인
```

재작성 전 파일은 `VACUUM`을 실행하기 전까지 지워지지 않는다. 그동안은 Time Travel로 이전 버전을 조회할 수 있다.

---

## 5. 컬럼 선택 기준과 주의점

### 5.1 컬럼 선택 기준

| 기준 | 판정 | 설명 |
|---|---|---|
| 필터·조인에 자주 쓰는 컬럼 | 적합 | WHERE·JOIN 조건에 반복해서 나오는 컬럼 |
| 카디널리티가 높은 컬럼 | 적합 | `user_id`, `device_id`처럼 값 종류가 많은 컬럼 |
| 카디널리티가 낮은 컬럼 | 부적합 | 국가나 상태 코드처럼 값 종류가 적은 컬럼은 파티셔닝이 맞다 |
| 통계 미수집 컬럼 | 부적합 | Unity Catalog 외부 테이블은 기본적으로 앞쪽 32개 컬럼의 통계를 수집한다. 관리형 테이블은 Predictive Optimization이 필터에 자주 쓰는 컬럼을 선택한다 |
| 파티션 컬럼 | 불가 | 이미 디렉터리로 나뉘어 있어 `ZORDER BY`에 넣으면 오류가 난다 |
| 4개 이상 컬럼 | 비권장 | 컬럼이 늘수록 컬럼 하나로 본 클러스터링 효과가 떨어진다 |

### 5.2 파티셔닝과의 조합

자주 쓰는 구성은 날짜처럼 카디널리티가 낮은 컬럼으로 파티셔닝하고 파티션 안을 카디널리티가 높은 컬럼으로 Z-Order하는 방식이다. `PARTITIONED BY (event_date)`와 `ZORDER BY (user_id)`를 함께 쓰는 식이다. OPTIMIZE는 데이터가 새로 들어오는 최근 파티션에만 주기적으로 실행한다.

### 5.3 운영 시 주의점

| 항목 | 내용 |
|---|---|
| 증분 처리 한계 | `ZORDER BY`는 멱등하지 않다. 새 데이터가 들어오면 다시 실행해야 하고 기존 파일까지 다시 쓰일 수 있다 |
| 키 변경 비용 | Z-Order 컬럼을 바꾸면 해당 범위 전체를 다시 정렬해야 한다 |
| 동시 쓰기 충돌 | INSERT와는 충돌하지 않지만 UPDATE·DELETE·MERGE와 겹치면 `ConcurrentDeleteReadException`, `ConcurrentDeleteDeleteException` 같은 충돌 예외로 한쪽이 실패할 수 있다 |
| 연산 비용 | 셔플과 정렬이 들어가므로 조회가 잦은 테이블에만 적용한다 |

---

## 6. Liquid Clustering과의 비교

Databricks는 새로 만드는 테이블에 파티셔닝과 Z-Order 대신 Liquid Clustering을 권장한다. 클러스터링 키는 테이블을 만들 때 선언하고 이후 OPTIMIZE는 아직 정렬되지 않은 데이터를 중심으로 증분 처리한다.

```sql
CREATE TABLE events (...) CLUSTER BY (user_id, event_type);

ALTER TABLE events CLUSTER BY (device_id);   -- 키 변경: 기존 데이터 즉시 재작성 없음
OPTIMIZE events;                             -- 증분 클러스터링
```

| 항목 | Z-Order | Liquid Clustering |
|---|---|---|
| 증분 처리 | 제한적 | 지원 |
| 키 변경 | 대상 범위 재작성 | 메타데이터를 변경하고 이후 OPTIMIZE에서 점진적으로 재배치 |
| 파티셔닝 병행 | 가능 | 불가 (파티셔닝을 대체) |
| 키 자동 선택 | 없음 | `CLUSTER BY AUTO` 지원 |
| 선언 위치 | OPTIMIZE 실행 시마다 지정 | 테이블 속성으로 1회 선언 |

파티셔닝과 Z-Order로 이미 운영 중이고 쿼리 패턴이 바뀌지 않는 테이블은 그대로 둬도 된다. 신규 테이블이나 쿼리 패턴이 자주 바뀌는 테이블, 파티션 크기가 들쭉날쭉한 테이블에는 Liquid Clustering을 먼저 검토한다. 두 방식은 함께 쓰지 못하므로 전환할 때 기존 `ZORDER BY` 작업을 제거한다.

---

## 7. 정리

- Delta Lake는 파일별 min/max 통계로 조건에 맞지 않는 파일을 건너뛰며, 비슷한 값이 같은 파일에 모여 있어야 효과가 난다.
- `ORDER BY a, b`로 정렬하면 첫 번째 컬럼만 모이고 두 번째 컬럼은 여러 파일에 흩어진다.
- Z-Order는 비트를 교차한 z-value로 정렬한다. 파일 하나가 정사각형에 가까운 블록을 맡으므로 어느 컬럼으로 필터해도 읽는 파일이 고르게 준다.
- 8×8 예시에서 Z-Order는 x 필터와 y 필터 모두 16개 중 4개를 읽었고 `ORDER BY x, y`는 각각 2개와 8개를 읽었다.
- 컬럼은 필터에 자주 쓰는 고카디널리티 컬럼 1~3개로 고르고, 파티션 컬럼과 통계를 수집하지 않는 컬럼은 제외한다.
- OPTIMIZE는 파일을 다시 쓰는 비용이 커서 최근 파티션 위주로 실행하고 효과는 `DESCRIBE HISTORY`와 스캔 지표로 확인한다. 신규 테이블에서는 증분 처리와 키 변경을 지원하는 Liquid Clustering을 먼저 검토한다.

---

## 8. 참고 자료

- [Databricks Data skipping](https://docs.databricks.com/aws/en/tables/data-skipping)
- [Databricks Optimize data file layout](https://docs.databricks.com/aws/en/delta/optimize)
- [Databricks Use liquid clustering for tables](https://docs.databricks.com/aws/en/tables/clustering)
