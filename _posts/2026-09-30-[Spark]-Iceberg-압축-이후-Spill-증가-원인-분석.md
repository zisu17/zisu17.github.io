---
title: "[Spark] Iceberg 압축 이후 Spill 증가 원인 분석"
excerpt: "Iceberg 데이터 파일을 압축한 뒤 Spark MERGE의 태스크당 입력 크기가 커지면서 실행 메모리 한도를 넘고 Spill이 증가한 원인을 정리한다."
nav_section: data
nav_topic: processing

categories:
  - Data Engineering
tags:
  - Data Engineering
  - Spark
  - Iceberg
  - Compaction
  - Spill
  - YARN

permalink: /data/iceberg-compaction-spark-spill-task-memory/

toc: true
toc_sticky: true

date: 2026-09-30
last_modified_at: 2026-10-13
---

<style>
/* tech-log-html viz kit v1 - 블로그(Minimal Mistakes) 본문 안에서만 동작하도록 모든 선택자를 .tlv 아래로 스코프한다 */
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
/* bars - 가로 막대 비교 */
.tlv-bars{display:grid;gap:.55em}
.tlv-bar-row{display:grid;grid-template-columns:minmax(0,34%) 1fr 3.6em;align-items:center;gap:.4em .8em;font-size:.8em}
.tlv-bar-row .k{color:var(--tlv-body);line-height:1.35}
.tlv-bar-row .v{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:var(--tlv-ink)}
.tlv-track{display:grid;gap:3px}
.tlv-track i{display:block;height:9px;border-radius:2px;background:var(--tlv-accent-2);width:var(--w,0%);min-width:2px}
.tlv-track i.is-mute{background:var(--tlv-line-2)}
.tlv-track i.is-good{background:var(--tlv-good)}
.tlv-track i.is-bad{background:var(--tlv-bad)}
/* compare - 2단 전후 비교 */
.tlv-compare{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tlv-col{min-width:0;border:1px solid var(--tlv-line);border-radius:4px;overflow:hidden}
.tlv-col>.hd{display:flex;align-items:center;gap:.5em;padding:.45em .8em;border-bottom:1px solid var(--tlv-line);font-size:.78em;font-weight:600;color:var(--tlv-ink);background:#fff}
.tlv-col>.bd{padding:.6em .8em;font-size:.9em}
.tlv-col>.bd.is-code{padding:0}
.tlv-col>.bd.is-code pre.highlight{margin:0;border-radius:0}
/* flow - HTML 파이프라인 */
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
/* steps - 단계별 강조 도해 */
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
/* term - 터미널 로그 */
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

## 1. 현상

Iceberg 테이블의 작은 데이터 파일을 합친 뒤 다음 Spark MERGE에서 디스크 Spill이 늘었다.

여기서 압축은 zstd 같은 코덱으로 파일 용량을 줄이는 압축(compression)이 아니다. Iceberg의 `rewrite_data_files`로 여러 개의 작은 파일을 더 적은 수의 큰 파일로 다시 쓰는 컴팩션(compaction)이다. 전체 데이터양은 거의 같지만 파일 하나의 크기는 커진다.

실제로 두 테이블의 파일 수와 Spark 태스크 지표가 다음과 같이 바뀌었다. 태스크당 값은 중앙값이다.

| 테이블 | 파일 수 | 태스크 수 | 태스크당 입력 | 태스크 peak 메모리 | 디스크 Spill |
|---|---:|---:|---:|---:|---:|
| `event_log` 압축 전 | 250개 | 250개 | 32.5MB | 736MB | 0 |
| `event_log` 압축 후 | 84개 | 84개 | 97.8MB | 1,408MB | 28.5GB |
| `order_detail` 압축 전 | 250개 | 250개 | 20.1MB | 392MB | 0 |
| `order_detail` 압축 후 | 42개 | 42개 | 118.8MB | 1,440MB | 24.2GB |

두 테이블 모두 전체 행 수와 셔플 쓰기 크기는 거의 변하지 않았다. 달라진 것은 파일 수와 태스크 하나가 읽는 데이터의 크기였다.

---

## 2. 파일이 줄었는데 태스크 입력은 커진 이유

압축 전에는 `event_log`의 약 33MB 파일 250개를 250개 태스크가 나눠 읽었다. 압축 후에는 같은 데이터를 약 98MB 파일 84개로 읽었다.

이 MERGE의 스캔 스테이지에서는 데이터 파일 하나가 입력 파티션 하나로 계획됐다. Spark는 입력 파티션마다 태스크 하나를 실행하므로 파일 수가 250개에서 84개로 줄자 태스크 수도 84개로 줄었다. 전체 데이터양은 같기 때문에 태스크 하나가 맡는 데이터는 약 3배가 됐다.

`order_detail`도 같은 흐름이다. 파일 수가 250개에서 42개로 줄면서 태스크당 입력은 20.1MB에서 118.8MB로 약 6배가 됐다.

<figure class="tlv">
<div class="tlv-flow">
  <div class="tlv-node"><div class="nt">압축 전</div><div class="ns">작은 파일 250개</div></div>
  <div class="tlv-arrow"></div>
  <div class="tlv-node is-accent"><div class="nt">Iceberg 압축</div><div class="ns">작은 파일을 큰 파일로 다시 씀</div></div>
  <div class="tlv-arrow"></div>
  <div class="tlv-node"><div class="nt">압축 후</div><div class="ns">큰 파일 84개 또는 42개</div></div>
  <div class="tlv-arrow"></div>
  <div class="tlv-node is-bad"><div class="nt">Spark 스캔</div><div class="ns">태스크당 입력 증가</div></div>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> 전체 데이터양은 같지만 파일 수가 줄면서 태스크 하나가 읽는 데이터가 커졌다.</figcaption>
</figure>

파일 수가 줄었다고 항상 Spill이 생기는 것은 아니다. 문제는 커진 파일이 이후 연산에서 태스크가 사용할 수 있는 메모리보다 큰 작업 데이터를 만들었다는 점이다.

또한 이 Spill은 MERGE의 첫 번째 스캔·셔플 쓰기 스테이지에서 발생했다. 이 단계의 태스크 수는 읽는 파일 배치로 정해졌기 때문에 `spark.sql.shuffle.partitions`를 늘려도 각 스캔 태스크가 읽는 파일 크기는 작아지지 않는다.

---

## 3. 100MB 파일이 메모리에서는 약 2GB가 됐다

Parquet 파일 크기와 Spark가 연산할 때 사용하는 행 데이터 크기는 다르다.

Parquet은 같은 컬럼의 값을 모아 저장하고 사전 인코딩과 zstd 압축을 적용한다. 반면 Spark는 파일을 읽은 뒤 조인과 셔플에 사용할 컬럼을 내부 행 형식으로 풀어 놓는다. 이 과정에서 압축이 해제되고 문자열과 각 컬럼의 값, 정렬용 포인터가 메모리에 올라간다.

실행 계획과 Spark 지표로 행당 크기를 계산하면 다음과 같았다.

| 테이블 | Parquet 바이트/행 | Spark 행 데이터 바이트/행 | 증가 배율 |
|---|---:|---:|---:|
| `event_log` | 28B | 596B | 약 21배 |
| `order_detail` | 70B | 1,178B | 약 17배 |

따라서 압축 후 파일 하나를 읽을 때 만들어지는 행 데이터는 대략 다음 크기가 된다.

- `event_log`: 97.8MB × 21배 ≈ 2.0GB
- `order_detail`: 118.8MB × 17배 ≈ 2.0GB

압축 전에는 각각 약 33MB와 20MB 파일을 읽었기 때문에 행 데이터도 약 700MB와 340MB 수준이었다. 이 정도는 태스크 메모리 안에 들어갔다. 압축 후에는 태스크 하나가 다뤄야 할 행 데이터가 약 2GB까지 커졌다.

중요한 값은 디스크에 저장된 파일 크기 자체가 아니다. 파일을 읽어 연산에 사용하는 형태로 바꿨을 때 메모리에서 얼마나 커지는지를 봐야 한다. 같은 100MB 파일이라도 컬럼 수, 문자열 비율, 압축률에 따라 필요한 메모리는 달라진다.

---

## 4. 태스크가 사용할 수 있는 메모리를 넘으면 Spill이 발생한다

당시 executor 설정은 8GB, 코어는 4개, `spark.memory.fraction`은 0.8이었다. Spark의 실행 메모리와 저장 메모리가 공유하는 영역은 다음과 같이 약 6.17GB다.

> (8,192MB - 300MB) × 0.8 = 6,314MB

executor 한 개에서 태스크 네 개가 동시에 실행되고 모두 실행 메모리를 요구하면 태스크 하나가 사용할 수 있는 몫은 약 1.54GB에 가까워진다. Spark가 태스크마다 메모리를 고정해서 똑같이 나누는 것은 아니지만, 여러 태스크가 동시에 메모리를 쓰면 한 태스크가 계속 확보할 수 있는 양에는 한계가 생긴다.

실제 태스크는 peak 메모리가 1,408~1,440MB에 도달했을 때 Spill을 시작했다. 압축 후 파일에서 만들어진 약 2GB의 행 데이터를 끝까지 메모리에 유지하기에는 부족한 크기다.

이 MERGE에서는 읽은 행을 조인 키에 따라 나눠 셔플 파일로 썼다. 셔플 쓰기 과정은 행 데이터와 정렬용 포인터를 실행 메모리에 쌓는다. 다음 메모리 페이지를 얻지 못하면 지금까지 쌓은 데이터를 정렬해 로컬 디스크에 쓰고 메모리를 비운 뒤 작업을 계속한다. 이것이 Spill이다.

Spill은 executor가 바로 죽었다는 의미가 아니다. 메모리에 다 담지 못한 중간 데이터를 디스크로 내보내면서 작업을 이어 갔다는 뜻이다. 다만 디스크 쓰기와 다시 읽기가 추가되기 때문에 스테이지 시간이 늘어난다.

---

## 5. 인과관계

이번 현상은 다음 순서로 발생했다.

<figure class="tlv">
<div class="tlv-flow">
  <div class="tlv-node"><div class="nt">파일 압축</div><div class="ns">목표 크기에 맞춰 작은 파일을 합침</div></div>
  <div class="tlv-arrow"></div>
  <div class="tlv-node"><div class="nt">파일 수 감소</div><div class="ns">250개 → 84개·42개</div></div>
  <div class="tlv-arrow"></div>
  <div class="tlv-node is-accent"><div class="nt">태스크당 입력 증가</div><div class="ns">약 20~33MB → 98~119MB</div></div>
  <div class="tlv-arrow"></div>
  <div class="tlv-node is-bad"><div class="nt">행 데이터 확대</div><div class="ns">Parquet의 17~21배, 약 2GB</div></div>
  <div class="tlv-arrow"></div>
  <div class="tlv-node is-bad"><div class="nt">Spill 발생</div><div class="ns">태스크 실행 메모리 약 1.4GB 초과</div></div>
</div>
<figcaption class="tlv-cap"><b>그림 2.</b> 파일 개수 감소가 직접 원인은 아니다. 커진 파일이 태스크당 메모리 사용량을 늘린 것이 원인이다.</figcaption>
</figure>

압축이 끝난 뒤 파일은 커졌고 다음 MERGE는 그 파일을 그대로 읽었다. MERGE가 테이블을 다시 쓰면서 파일이 250개로 돌아간 뒤에는 같은 테이블을 읽어도 Spill이 발생하지 않았다. 데이터양이나 조인 키 분포가 아니라 입력 파일 배치가 달라졌다는 점을 확인할 수 있다.

### 같은 128MB인데 파일 크기가 달라진 이유

Iceberg 압축과 Spark AQE 모두 128MB를 기준으로 사용했지만 기준이 되는 데이터가 달랐다. Iceberg 압축의 128MB는 디스크에 저장되는 Parquet 파일의 목표 크기다. 반면 AQE의 128MB는 셔플 과정에서 사용하는 행 데이터의 파티션 크기다.

행 데이터는 Parquet보다 17~21배 컸다. 따라서 AQE가 약 128MB의 행 데이터를 하나의 쓰기 태스크에 배정해도 압축된 Parquet 파일은 20~33MB 정도로 작아졌다. 같은 숫자를 사용해도 압축은 큰 파일 84개 또는 42개를 만들었고, MERGE는 작은 파일 250개를 만든 이유다.

---

## 6. 압축 파일 크기를 정할 때 봐야 할 값

Iceberg의 목표 파일 크기는 저장 효율과 스캔 성능만 보고 정하면 안 된다. 그 파일을 읽는 Spark 작업이 태스크 하나에 얼마만큼의 실행 메모리를 쓸 수 있는지도 함께 봐야 한다.

이번 사례에서는 다음 식으로 대략적인 경계를 구할 수 있다.

> Spill 직전 태스크 메모리 ÷ Parquet 대비 행 데이터 증가 배율

Spill 직전 메모리를 약 1.4GB로 잡으면 `event_log`는 약 65MB, `order_detail`은 약 82MB가 된다. 실제 압축 결과인 98MB와 119MB는 이 값을 넘었다.

이 값은 모든 테이블에 공통으로 적용할 수 있는 기준이 아니다. 스키마와 문자열 비율, 읽는 컬럼, 압축 코덱, executor 메모리와 동시 실행 태스크 수에 따라 달라진다. 테이블마다 Spark UI의 `Input Size`, `Peak Execution Memory`, `Disk Spill`을 함께 보고 판단해야 한다.

대응 방향은 두 가지다. 태스크당 입력이 작아지도록 압축 목표 파일 크기를 낮추거나, executor 메모리를 늘리거나 코어 수를 줄여 태스크 하나가 사용할 수 있는 메모리를 늘린다. 어느 쪽이 맞는지는 작은 파일의 비용과 클러스터 자원 여유를 함께 보고 정한다.

이번에는 압축 목표를 바꾸지 않고 executor 힙을 8GB에서 12GB로, memory overhead를 1GB에서 2GB로 늘리기로 했다. 파일 관리 기준을 유지하면서 태스크가 사용할 수 있는 실행 메모리를 먼저 늘리는 방향이다. 분석을 바탕으로 정한 값이므로 실제 Spill 감소 여부는 변경 후 실행에서 확인해야 한다.

---

## 7. 정리

Iceberg 압축으로 전체 데이터양이 늘어난 것은 아니다. 파일 수가 줄고 파일 하나가 커지면서 Spark 태스크 하나가 읽는 데이터가 늘었다. 압축된 Parquet 데이터는 셔플 과정에서 17~21배 크기의 행 데이터가 됐고, 약 2GB의 작업 데이터가 태스크 실행 메모리 한도를 넘으면서 Spill이 발생했다.

결국 압축 목표 파일 크기는 저장 계층만의 설정이 아니다. 그 파일을 읽는 Spark 작업의 태스크 메모리까지 함께 보고 정해야 한다.

이번 사례에서는 압축 기준을 바꾸기보다 executor 메모리를 먼저 늘리고 결과를 확인하기로 했다.

---

## 8. 참고 자료

- [Apache Iceberg - Spark Writes](https://iceberg.apache.org/docs/latest/spark-writes/)
- [Apache Iceberg - Spark Procedures](https://iceberg.apache.org/docs/latest/spark-procedures/)
- [Apache Spark 3.5.7 - Tuning](https://spark.apache.org/docs/3.5.7/tuning.html)
- [Apache Spark 3.5.7 - Configuration](https://spark.apache.org/docs/3.5.7/configuration.html)
- [Apache Spark 3.5.7 - Monitoring and Instrumentation](https://spark.apache.org/docs/3.5.7/monitoring.html)
