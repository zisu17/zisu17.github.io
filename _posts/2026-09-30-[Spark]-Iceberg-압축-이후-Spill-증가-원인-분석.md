---
title: "[Spark] Iceberg 압축 이후 Spill 증가 원인 분석"
excerpt: "Iceberg 압축이 합친 큰 파일을 다음 새벽 MERGE가 읽다가 태스크 메모리 상한을 넘어 Spill이 4배로 늘어난 사례에서, 압축과 MERGE가 파일 크기를 정하는 기준과 태스크 메모리 배율을 실측하고 executor 메모리 조정 방향을 정리한다."

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
last_modified_at: 2026-10-01
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

## 1. 문제 상황

새벽 적재 배치의 디스크 Spill이 하루 사이에 4배로 늘었다. 이 배치는 소스 변경분을 Iceberg 테이블에 `MERGE INTO`로 반영하는 Spark 잡 6개로 이루어진다. 잡마다 Livy 세션이 하나씩 뜨고 YARN 위에서 Spark 3.5.1 애플리케이션으로 실행된다. executor는 8g에 코어 4개이고 동적 할당으로 1~5개가 뜬다. 이 글에서 다루는 테이블은 copy-on-write라서 변경 행이 적어도 MERGE마다 모든 데이터 파일을 다시 쓴다.

본문의 테이블명, 호스트명, 잡 이름은 예시 값으로 바꿨다. MB와 GB는 Spark UI와 같은 1024 기준이다.

[앞선 글](/data/spark-spill-disk-usage-root-cause/)에서 다룬 조치(셔플 파티션 상향, 일부 테이블의 merge-on-read 전환) 이후 새벽 Spill 합계는 16.6~18.3GB에서 일정했다. 당일에는 75.2GB였다. 6일 전에도 67.6GB로 한 번 비슷하게 늘었다. merge-on-read로 전환하기 전 이틀은 281GB와 329GB였으니 절대량이 큰 편은 아니다. 다만 5일 동안 일정하던 값이 4배로 늘어난 이유는 확인이 필요했다.

<figure class="tlv">
<div class="tlv-legend"><span>Spill이 늘어난 날</span><span style="--sw:var(--tlv-line-2)">기준선</span></div>
<div class="tlv-bars">
  <div class="tlv-bar-row"><span class="k">6일 전</span><span class="tlv-track"><i style="--w:89.9%"></i></span><span class="v">67.6</span></div>
  <div class="tlv-bar-row"><span class="k">5일 전</span><span class="tlv-track"><i class="is-mute" style="--w:24.3%"></i></span><span class="v">18.3</span></div>
  <div class="tlv-bar-row"><span class="k">4일 전</span><span class="tlv-track"><i class="is-mute" style="--w:24.3%"></i></span><span class="v">18.3</span></div>
  <div class="tlv-bar-row"><span class="k">3일 전</span><span class="tlv-track"><i class="is-mute" style="--w:24.3%"></i></span><span class="v">18.3</span></div>
  <div class="tlv-bar-row"><span class="k">2일 전</span><span class="tlv-track"><i class="is-mute" style="--w:22.1%"></i></span><span class="v">16.6</span></div>
  <div class="tlv-bar-row"><span class="k">1일 전</span><span class="tlv-track"><i class="is-mute" style="--w:24.3%"></i></span><span class="v">18.3</span></div>
  <div class="tlv-bar-row"><span class="k">당일</span><span class="tlv-track"><i style="--w:100.0%"></i></span><span class="v">75.2</span></div>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> 새벽 Spill 합계(GB). 두 날(주황)을 제외하면 16.6~18.3GB로 일정했다.</figcaption>
</figure>

증가한 지표는 Spill뿐이었다. 당일 셔플 쓰기 합계는 308.7GB로 전날의 313.2GB와 같은 수준이었다. 잡 6개의 실행 시간을 더하면 전날 92.3분, 당일 93.3분이었다. Spill은 세 잡에서 나왔다.

| 잡 | 갱신 테이블 | 전날 Spill | 당일 Spill | 셔플 쓰기(전날 → 당일) |
|---|---|--:|--:|--:|
| job-A | `mart.event_log` | 0.0GB | 28.5GB | 84.7GB → 85.1GB |
| job-B | `mart.order_detail` | 0.0GB | 24.2GB | 73.3GB → 73.3GB |
| job-C | `mart.product_stat` 외 | 18.3GB | 22.5GB | 106.5GB → 107.1GB |
| 나머지 3개 | - | 0.0GB | 0.0GB | - |

job-A와 job-B가 늘린 52.6GB가 전체 증가분 56.9GB의 93%를 차지한다. job-C는 매일 18.3GB를 내던 스테이지에 4.2GB를 내는 스테이지가 하나 더 추가됐다.

---

## 2. Spill이 발생한 스테이지

Spark History Server의 REST API로 스테이지와 태스크 지표를 조회해 Spill이 난 스테이지를 찾았다.

```bash
# 스테이지별 태스크 수, 입력, Spill (YARN 앱은 attempt 번호 1이 경로에 들어간다)
curl -s "$SHS/api/v1/applications/$APP/1/stages?status=complete"
# 태스크 분위수: peakExecutionMemory, diskBytesSpilled, inputMetrics.bytesRead
curl -s "$SHS/api/v1/applications/$APP/1/stages/$STAGE/0/taskSummary?quantiles=0.5,1.0"
# 실행 계획 지표: Exchange data size, AQEShuffleRead partition data size
curl -s "$SHS/api/v1/applications/$APP/1/sql?details=true"
```

Spill은 모두 MERGE의 첫 단계인 스캔·셔플 쓰기 스테이지에서 나왔다. copy-on-write MERGE는 대상 테이블 전체를 읽어 조인 키로 셔플한 뒤 소스와 조인한다. 해당 스테이지는 이 중 대상 테이블을 읽어 셔플 파일로 쓰는 부분이다. job-A와 job-B의 스테이지를 전날, 당일, 같은 날 같은 테이블을 다시 읽은 스테이지와 비교했다.

| 스테이지 | 태스크 | 태스크당 읽기 | 태스크당 peak | 디스크 Spill | 소요 시간 |
|---|--:|--:|--:|--:|--:|
| `event_log` 전날 | 250 | 32.5MB | 736MB | 0 | 38.2초 |
| `event_log` 당일 job-A | 84 | 97.8MB | 1,408MB | 28.5GB | 45.1초 |
| `event_log` 당일 job-C | 250 | 32.8MB | 736MB | 0 | 36.3초 |
| `order_detail` 전날 | 250 | 20.1MB | 392MB | 0 | 30.4초 |
| `order_detail` 당일 job-B | 42 | 118.8MB | 1,440MB | 24.2GB | 54.5초 |

태스크당 값은 중앙값이고 peak는 태스크가 쓴 최대 실행 메모리(`peakExecutionMemory`)다.

`event_log`의 세 스테이지는 입력이 3.00억~3.04억 행이고 셔플 쓰기가 28.4~28.7GB로 같다. 달라진 것은 태스크 수와 태스크당 읽는 크기뿐이다. 이 스캔은 파일 하나를 태스크 하나가 읽기 때문에 파일이 250개에서 84개로 줄면서 태스크당 읽는 양이 3배가 됐다. Spill이 난 태스크는 태스크마다 디스크로 351~353MB를 내보내 크기가 거의 같았다. 일부 태스크에 데이터가 쏠린 결과라기보다 같은 크기의 태스크가 모두 같은 메모리 한도에서 Spill한 것으로 보인다.

같은 날 job-C가 `event_log`를 다시 읽은 스테이지는 태스크 250개에 Spill 0이었다. 같은 날 같은 테이블이라 데이터 증가나 값의 분포로는 설명되지 않는다. 다른 것은 읽은 시점의 파일 배치뿐이다. 스테이지 시간은 `event_log`가 6.9초(18%), `order_detail`이 24.1초(79%) 늘었다. 잡 전체 시간은 job-A가 0.8분, job-B가 0.5분 늘었다.

job-C의 기준선 18.3GB는 다른 스테이지에서 나온다. `product_stat`을 읽는 60태스크 스테이지가 조사한 날마다 18GB 안팎을 냈다. 당일에 더해진 4.2GB는 `customer_profile`을 읽는 18태스크 스테이지(태스크당 92MB)에서 나왔다. 두 테이블은 압축한 날에도 파일 수가 그대로였다. 6장에서 다시 다룬다.

---

## 3. 압축 이후 파일 배치

`event_log`와 `order_detail`은 새벽 MERGE가 모든 파일을 새로 쓰기 때문에 매번 파일 250개가 만들어진다. 평균 크기는 각각 약 33MB와 약 20MB다. 유지관리 DAG는 스케줄 없이 필요할 때 수동으로 실행한다. 이 DAG는 데이터 파일의 평균 크기가 목표(128MB)의 75%인 96MB보다 작으면 테이블을 압축(`rewrite_data_files`) 대상으로 본다. 두 테이블은 평균이 항상 기준보다 작아서 DAG를 실행할 때마다 압축 대상이 된다.

유지관리 DAG의 실행 결과를 보면 압축은 전날 오후에 실행됐다. `event_log`는 데이터 파일이 250개에서 84개로, `order_detail`은 250개에서 42개로 줄었다. `product_stat`(60개)과 `customer_profile`(18개)도 같은 실행에서 압축 대상이 됐지만 파일 수가 그대로였다. 새벽 MERGE 스캔의 태스크 수(84개, 42개)와 태스크당 읽은 크기(98MB, 119MB)가 이 배치와 맞는다.

<figure class="tlv">
<div class="tlv-flow">
  <div class="tlv-node"><div class="nt">전날 새벽 MERGE</div><div class="ns">파일 250개 · 약 33MB</div></div>
  <div class="tlv-arrow" data-label="압축"></div>
  <div class="tlv-node is-accent"><div class="nt">전날 오후 압축</div><div class="ns">파일 84개 · 약 98MB</div></div>
  <div class="tlv-arrow" data-label="읽기"></div>
  <div class="tlv-node is-bad"><div class="nt">당일 새벽 스캔(job-A)</div><div class="ns">태스크 84개 · Spill 28.5GB</div></div>
  <div class="tlv-arrow" data-label="쓰기"></div>
  <div class="tlv-node"><div class="nt">당일 MERGE 쓰기</div><div class="ns">파일 250개 · 33MB</div></div>
  <div class="tlv-arrow" data-label="읽기"></div>
  <div class="tlv-node is-good"><div class="nt">이어지는 스캔(job-C)</div><div class="ns">태스크 250개 · Spill 0</div></div>
</div>
<figcaption class="tlv-cap"><b>그림 2.</b> <code>event_log</code>의 파일 배치는 오후 압축으로 84개가 됐다가 새벽 MERGE가 끝나면 250개로 돌아간다.</figcaption>
</figure>

압축 효과는 다음 MERGE까지만 유지됐다. 당일 MERGE가 끝난 뒤 `event_log`는 다시 파일 250개, 평균 33MB가 됐다. 그 뒤에 이 테이블을 읽은 스테이지(job-C)는 태스크 250개에 Spill 0이었다.

6일 전에도 같은 양상이었다. 압축을 실행한 다음 새벽에 같은 두 테이블의 스캔이 84태스크(태스크당 95.8MB)와 41태스크(118.4MB)였고 Spill은 28.1GB와 21.3GB였다. 압축을 하지 않은 그 사이 5일은 두 테이블이 250개 파일이었고 이 스테이지들의 Spill은 없었다.

압축은 별도의 스탠드얼론 클러스터(executor 16g)에서 실행되고 새벽 적재는 YARN 클러스터(executor 8g)에서 실행된다. 압축 잡에는 셔플이 없어서 이 문제가 압축 단계에서는 드러나지 않고 결과 파일을 읽는 새벽 잡에서 처음 나타난다.

---

## 4. 압축과 MERGE가 파일 크기를 정하는 기준

두 작업 모두 128MB를 기준으로 삼는데 결과 파일은 98MB와 33MB로 달랐다. 128MB가 제한하는 대상이 다르기 때문이다. 압축에서는 새 파일 하나의 크기이고 MERGE에서는 셔플 파티션 묶음 하나의 크기다.

### 4.1 압축의 파일 묶음 기준

Iceberg `rewrite_data_files`의 binpack 전략(Iceberg 1.5.0 기준)은 작은 파일을 순서대로 묶되 한 묶음의 크기 합이 목표 크기(128MB)를 넘지 않게 한다. 묶음 하나를 읽기 태스크 하나로 처리해 새 파일 하나를 쓴다. 정렬이나 조인이 없어서 셔플은 생기지 않는다. 파일이 목표보다 작으면 쪼개지 않고 통째로 묶으므로 결과 크기는 128MB가 아니라 다음 파일을 더하면 128MB를 넘는 지점에서 정해진다.

`event_log`는 파일이 약 33MB라 3개(약 99MB)까지 묶을 수 있고 4개(약 132MB)부터 128MB를 넘는다. 250개를 3개씩 묶으면 묶음 83개가 되고 파일 1개가 남아 결과 파일은 84개가 된다. `order_detail`은 약 20MB라 6개(약 120MB)까지 묶을 수 있고 7개(약 140MB)부터 넘는다. 250개를 6개씩 묶으면 묶음 41개가 되고 4개가 남아 결과 파일은 42개가 된다. 새벽 스캔 태스크의 읽기 크기 최솟값이 각각 32.6MB(파일 1개)와 79.5MB(파일 4개)인 것과 맞는다.

### 4.2 MERGE의 셔플 파티션 병합 기준

copy-on-write MERGE는 대상 테이블과 소스를 `FULL OUTER JOIN`으로 합쳐 모든 파일을 다시 쓴다(`ReplaceData`). 조인 스테이지의 태스크 수는 입력 파일 배치가 아니라 AQE의 파티션 병합이 정한다. 이 잡은 초기 셔플 파티션이 1,000개이고 AQE가 인접한 파티션을 advisory 크기(128MB) 이하로 묶는다.

AQE가 집계한 묶음 하나의 크기는 `event_log`가 118.5MB, `order_detail`이 107.7MB였고 둘 다 파티션 4개를 묶은 값이다. 5개를 묶으면 각각 148MB, 135MB로 128MB를 넘으므로 태스크가 250개가 됐다. 조인 태스크가 곧 쓰기 태스크라서 태스크 250개가 파일 250개를 쓴다. 이 구성은 압축 전후가 같았다. 압축 직후 배치(파일 84개)를 읽은 밤에도 쓰기 스테이지는 태스크 250개였고 태스크당 출력은 32.9MB였다.

셔플 블록은 행 형식을 lz4로 압축한 데이터라서 Parquet(zstd)로 다시 쓰면 크기가 줄어든다. 조인 태스크가 읽은 셔플 데이터는 `event_log`가 태스크당 117.8MB인데 출력 파일은 32.9MB였고 `order_detail`은 101.5MB가 20.5MB였다. 그래서 MERGE가 끝나면 파일 배치는 압축 전과 같은 250개 작은 파일로 돌아간다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 162" role="img" aria-label="압축은 파일 3개 98.7MB에서, MERGE는 셔플 파티션 4개 118.5MB에서 다음 조각을 더하면 128MB를 넘어 묶음이 끝난다">
  <text class="t" x="0" y="14">압축 (rewrite_data_files)</text>
  <text class="s" x="0" y="31">파일을 통째로 묶고 합계는 128MB 이하</text>
  <text class="l" x="240.0" y="40" text-anchor="end">128MB</text>
  <rect class="soft" x="0" y="44" width="240" height="44" rx="4"/>
  <rect class="accent" x="1.5" y="48" width="58.7" height="36" rx="2"/>
  <text class="l" x="30.8" y="70" text-anchor="middle">33MB</text>
  <rect class="accent" x="63.2" y="48" width="58.7" height="36" rx="2"/>
  <text class="l" x="92.5" y="70" text-anchor="middle">33MB</text>
  <rect class="accent" x="124.9" y="48" width="58.7" height="36" rx="2"/>
  <text class="l" x="154.2" y="70" text-anchor="middle">33MB</text>
  <rect class="bad dash" x="186.6" y="48" width="58.7" height="36" rx="2"/>
  <text class="l" x="215.9" y="70" text-anchor="middle">33MB</text>
  <text class="t" x="0" y="112">32.9MB × 3 = 98.7MB</text>
  <text class="s" x="0" y="130">4개째는 131.6MB가 되어 3.6MB 넘는다</text>
  <text class="t c-accent" x="0" y="152">결과: 파일 250개 → 84개, 약 98MB</text>
  <text class="t" x="330" y="14">MERGE (AQE 파티션 병합)</text>
  <text class="s" x="330" y="31">셔플 파티션 1,000개를 인접한 것끼리 묶는다</text>
  <text class="l" x="570.0" y="40" text-anchor="end">128MB</text>
  <rect class="soft" x="330" y="44" width="240" height="44" rx="4"/>
  <rect class="accent" x="331.5" y="48" width="52.5" height="36" rx="2"/>
  <text class="l" x="357.8" y="70" text-anchor="middle">29.6MB</text>
  <rect class="accent" x="387.0" y="48" width="52.5" height="36" rx="2"/>
  <text class="l" x="413.3" y="70" text-anchor="middle">29.6MB</text>
  <rect class="accent" x="442.6" y="48" width="52.5" height="36" rx="2"/>
  <text class="l" x="468.9" y="70" text-anchor="middle">29.6MB</text>
  <rect class="accent" x="498.1" y="48" width="52.5" height="36" rx="2"/>
  <text class="l" x="524.4" y="70" text-anchor="middle">29.6MB</text>
  <rect class="bad dash" x="553.7" y="48" width="52.5" height="36" rx="2"/>
  <text class="l" x="580.0" y="70" text-anchor="middle">29.6MB</text>
  <text class="t" x="330" y="112">약 29.6MB × 4 = 118.5MB</text>
  <text class="s" x="330" y="130">5개째는 148.1MB가 되어 20.1MB 넘는다</text>
  <text class="t c-accent" x="330" y="152">결과: 태스크 250개, 파일당 33MB</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 3.</b> 압축은 파일 3개(98.7MB)에서, MERGE는 셔플 파티션 4개(118.5MB)에서 다음 조각이 128MB를 넘어 묶음이 끝난다.</figcaption>
</figure>

---

## 5. 행 데이터가 파일 크기의 16~21배가 되는 이유

Spill이 난 스테이지의 태스크는 읽은 행을 조인 키의 해시로 나눠 셔플 파일로 쓴다. 이 쓰기 경로(Spark 3.5의 `UnsafeShuffleWriter`)는 행을 `UnsafeRow` 바이트 그대로 64MB 메모리 페이지에 쌓고 파티션 번호로 정렬하기 위한 포인터 배열을 함께 둔다. 새 페이지를 얻지 못하면 쌓인 내용을 정렬해 디스크로 내보낸다. 그래서 태스크 하나에 필요한 메모리는 그 태스크가 만드는 행 데이터 전체에 페이지 올림과 포인터 배열이 더해진 크기다. 셔플 파티션 수는 이 값과 관계가 없다.

행 데이터의 크기는 실행 계획의 `Exchange` 노드가 기록한 `data size`를 `shuffle records written`으로 나눠 구했다. Parquet 크기는 스캔 스테이지가 읽은 바이트를 행 수로 나눈 값이다.

| 테이블 | 컬럼 수(문자열) | Parquet 바이트/행 | 행 형식 바이트/행 | 배율 |
|---|--:|--:|--:|--:|
| `event_log` | 25(19) | 28 | 596 | 21배 |
| `order_detail` | 71(61) | 70 | 1,178 | 17배 |
| `customer_profile` | 92(72) | 86 | 1,368 | 16배 |
| `product_stat` | 68(50) | 62 | 1,101 | 18배 |

Parquet 파일은 컬럼 단위로 사전 인코딩과 zstd 압축을 적용해 행당 28~86바이트까지 줄인다. 행 형식은 컬럼마다 8바이트 슬롯을 차지하고 문자열은 UTF-8 바이트가 압축 없이 들어가서 같은 행이 596~1,368바이트가 된다. 배율은 Parquet의 압축 정도에 따라 달라지므로 테이블마다 실측해야 한다. [Spark 튜닝 가이드](https://spark.apache.org/docs/latest/tuning.html)는 압축이 풀린 블록이 원본의 2~3배라고 보고 여유를 잡는다. 이 테이블들은 그보다 훨씬 컸다. 128MB 파일 하나를 태스크 하나가 읽으면 테이블에 따라 행 데이터만 2.0~2.6GB가 필요하다.

Spill이 없던 250개 파일 배치에서 태스크 peak는 읽은 크기의 22.6배(`event_log`), 19.5배(`order_detail`)였다. 행 데이터를 64MB 페이지 단위로 올리고 포인터 배열(레코드 수에 맞춰 2배씩 커져 8MB, 32MB, 64MB가 된다)을 더하면 이 peak가 그대로 나온다.

| 스테이지 | 태스크당 행 수 | 행 데이터 | 페이지(64MB) | 포인터 배열 | peak 계산 | peak 실측 |
|---|--:|--:|--:|--:|--:|--:|
| `event_log`, 파일 250개 | 120만 | 683MB | 11개, 704MB | 32MB | 736MB | 736MB |
| `order_detail`, 파일 250개 | 29만 | 328MB | 6개, 384MB | 8MB | 392MB | 392MB |
| `event_log`, 파일 84개 | 359만 | 2.0GB | 21개, 1,344MB* | 64MB | 1,408MB | 1,408MB |
| `order_detail`, 파일 42개 | 175만 | 1.9GB | 22개, 1,408MB* | 32MB | 1,440MB | 1,440MB |

\*Spill이 시작된 시점의 값이다.

두 스테이지에서 첫 Spill이 일어난 시점의 페이지와 배열 합은 1,408~1,440MB였다. 메모리 기준 Spill량(1,344MB, 1,408MB)은 그 시점의 페이지 합과 같았다.

---

## 6. 태스크당 메모리 상한과 Spill 없이 읽는 파일 크기

### 6.1 태스크당 상한

executor 8g, 코어 4개, `spark.memory.fraction` 0.8에서 실행 메모리와 저장 메모리가 공유하는 풀은 (8,192MB - 300MB) × 0.8 = 6,314MB(6.17GB)다. 같은 executor에서 동시에 실행 중인 태스크가 N개이면 태스크 하나의 실행 메모리 몫은 풀의 1/(2N)에서 1/N 사이에서 정해진다. 4개가 동시에 돌 때 최대 몫은 1.54GB, 3개일 때는 2.06GB다.

```text
풀 = (힙 - 300MB) × spark.memory.fraction
태스크 최대 몫 = 풀 ÷ 동시 실행 태스크 수
8g, 4개 동시:  (8,192 - 300) × 0.8 ÷ 4 = 1,578MB
```

실제로 Spill이 시작된 지점은 이 값보다 조금 낮았다. 페이지와 배열 합이 1,408~1,440MB(1.38~1.41GB)에서 다음 64MB 페이지를 얻지 못했다. 같은 크기의 태스크라도 동시에 몇 개가 실행되느냐에 따라 결과가 갈렸다. `customer_profile`을 읽은 18개 태스크(태스크당 92MB) 가운데 executor에서 4개가 겹쳐 실행된 3대의 12개 태스크는 모두 Spill했다. 3개가 겹친 2대의 6개 태스크는 peak가 1,504MB까지 올라가고도 Spill하지 않았다.

### 6.2 Spill 없이 읽는 파일 크기

파일 하나를 태스크 하나가 읽으면 그 태스크가 쌓을 행 데이터는 파일 크기에 배율을 곱한 값이다. 8g에서 Spill한 태스크가 한 번에 내보낸 행 데이터가 1,344~1,408MB였으므로 태스크 하나가 쌓을 수 있는 양을 약 1,376MB로 잡았다. 12g와 16g는 풀 크기에 비례해 2,090MB와 2,804MB로 늘렸다. 이 양을 배율로 나누면 Spill 없이 읽을 수 있는 파일 크기의 추정값이 나온다.

| 테이블 | 배율 | 8g | 12g | 16g | 실제로 읽은 파일 |
|---|--:|--:|--:|--:|--:|
| `event_log` | 21배 | 65MB | 99MB | 133MB | 98MB(압축 후) |
| `order_detail` | 17배 | 82MB | 125MB | 168MB | 119MB(압축 후) |
| `customer_profile` | 16배 | 87MB | 132MB | 177MB | 92MB |
| `product_stat` | 18배 | 77MB | 118MB | 158MB | 108MB |

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 268" role="img" aria-label="8g에서는 Spill이 난 파일이 모두 안전 크기 오른쪽에 있고 12g에서는 경계에, 16g에서는 왼쪽에 놓인다">
  <text class="s" x="0" y="14">안전 크기(추정)</text>
  <rect class="box" x="96" y="3" width="4" height="14"/><text class="s" x="106" y="14">8g</text>
  <rect class="accent" x="134" y="3" width="4" height="14"/><text class="s" x="144" y="14">12g</text>
  <rect class="good" x="178" y="3" width="4" height="14"/><text class="s" x="188" y="14">16g</text>
  <circle class="bad" cx="236" cy="10" r="5"/><text class="s" x="246" y="14">Spill이 난 파일</text>
  <circle class="good" cx="340" cy="10" r="5"/><text class="s" x="350" y="14">Spill이 없던 파일</text>
  <path class="wire dash" d="M479.2 30 V238"/>
  <text class="l" x="479.2" y="27" text-anchor="middle">압축 목표 128MB</text>
  <text class="t" x="0" y="72">event_log</text>
  <text class="s" x="0" y="88">배율 21배</text>
  <rect class="soft" x="140.0" y="71" width="477" height="6" rx="3"/>
  <rect class="box" x="311.2" y="63" width="4" height="22"/>
  <rect class="accent" x="401.1" y="63" width="4" height="22"/>
  <rect class="good" x="491.0" y="63" width="4" height="22"/>
  <circle class="good" cx="227.4" cy="74" r="6"/>
  <text class="l" x="227.4" y="58" text-anchor="middle">33MB</text>
  <circle class="bad" cx="399.7" cy="74" r="6"/>
  <text class="l" x="399.7" y="58" text-anchor="middle">98MB</text>
  <text class="t" x="0" y="118">order_detail</text>
  <text class="s" x="0" y="134">배율 17배</text>
  <rect class="soft" x="140.0" y="117" width="477" height="6" rx="3"/>
  <rect class="box" x="356.2" y="109" width="4" height="22"/>
  <rect class="accent" x="469.4" y="109" width="4" height="22"/>
  <rect class="good" x="582.7" y="109" width="4" height="22"/>
  <circle class="good" cx="193.0" cy="120" r="6"/>
  <text class="l" x="193.0" y="104" text-anchor="middle">20MB</text>
  <circle class="bad" cx="455.3" cy="120" r="6"/>
  <text class="l" x="455.3" y="104" text-anchor="middle">119MB</text>
  <text class="t" x="0" y="164">customer_profile</text>
  <text class="s" x="0" y="180">배율 16배</text>
  <rect class="soft" x="140.0" y="163" width="477" height="6" rx="3"/>
  <rect class="box" x="368.5" y="155" width="4" height="22"/>
  <rect class="accent" x="488.1" y="155" width="4" height="22"/>
  <rect class="good" x="607.7" y="155" width="4" height="22"/>
  <circle class="bad" cx="383.8" cy="166" r="6"/>
  <text class="l" x="383.8" y="150" text-anchor="middle">92MB</text>
  <text class="t" x="0" y="210">product_stat</text>
  <text class="s" x="0" y="226">배율 18배</text>
  <rect class="soft" x="140.0" y="209" width="477" height="6" rx="3"/>
  <rect class="box" x="343.0" y="201" width="4" height="22"/>
  <rect class="accent" x="449.4" y="201" width="4" height="22"/>
  <rect class="good" x="555.8" y="201" width="4" height="22"/>
  <circle class="bad" cx="426.2" cy="212" r="6"/>
  <text class="l" x="426.2" y="196" text-anchor="middle">108MB</text>
  <path class="wire" d="M140 244 H617"/>
  <path class="wire" d="M140.0 244 v4"/>
  <text class="l" x="140.0" y="260" text-anchor="middle">0</text>
  <path class="wire" d="M272.5 244 v4"/>
  <text class="l" x="272.5" y="260" text-anchor="middle">50</text>
  <path class="wire" d="M405.0 244 v4"/>
  <text class="l" x="405.0" y="260" text-anchor="middle">100</text>
  <path class="wire" d="M537.5 244 v4"/>
  <text class="l" x="537.5" y="260" text-anchor="middle">150MB</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 4.</b> 8g에서는 Spill이 난 파일이 모두 안전 크기 오른쪽에 있고 12g에서는 세 파일이 경계에, 16g에서는 모두 왼쪽에 놓인다. 정확한 값은 위 표 참고.</figcaption>
</figure>

8g에서는 Spill이 난 파일이 모두 추정값을 넘었고 Spill이 없던 250개 파일 배치(33MB, 20MB)는 추정값보다 훨씬 작았다. `customer_profile`은 추정값(87MB)을 조금 넘는 경계값이라 앞서 본 대로 4개 태스크가 겹친 executor에서만 Spill이 났다. 12g에서 `event_log`, `order_detail`, `product_stat` 파일의 여유는 1.5%, 5.3%, 8.5%에 그치고 16g에서는 36%, 41%, 46%다. 여유는 추정값을 실제 파일 크기로 나눈 값에서 1을 뺀 비율이고 한계선 부근의 몇 %는 오차 범위로 본다.

### 6.3 압축과 무관한 기준선

`product_stat`은 두 번의 압축 실행에서 모두 대상에 포함됐지만 파일 60개가 그대로였다. 파일 2개를 합치면 128MB를 넘기 때문이다. 이 파일은 이미 태스크당 108MB(중앙값)라 8g의 추정값 77MB를 넘은 상태였고 매일 18GB 안팎의 Spill이 여기서 나왔다. 압축과 무관한 기준선도 같은 원리로 만들어진다.

---

## 7. 조정 방법 비교

Spill을 없애려면 태스크가 읽는 파일의 크기를 줄이거나 태스크의 메모리를 늘려야 한다. 네 가지를 비교했다.

| 방법 | 기대 효과 | 제약 |
|---|---|---|
| 압축 목표를 낮춘다(48~64MB) | `order_detail` 압축 결과가 8g의 추정 크기(82MB) 안으로 들어온다. `event_log`는 압축해도 파일이 그대로다 | 전역 설정이라 큰 테이블의 결과 파일도 작아져 파일 수가 늘고 `product_stat` 같은 기존 대형 파일은 대상이 되기 어렵다 |
| 압축 대상에서 뺀다 | 압축 다음 새벽의 Spill이 없어진다 | 낮 동안 읽기에서 얻는 이점을 잃고 기준선 Spill은 그대로다 |
| executor 메모리를 올린다 | 태스크당 상한이 풀 크기에 비례해 커진다 | 컨테이너가 커져 노드당 executor 수가 줄고 앱당 사용량이 늘어난다 |
| 코어 수를 줄인다 | 같은 메모리에서 태스크 몫이 커진다(12g 3코어: 3.12GB) | 병렬도가 25% 줄거나 executor를 늘려야 한다 |

### 7.1 압축 목표를 낮추는 경우

목표를 64MB로 낮추면 `event_log`는 파일 2개를 묶어도 66MB로 목표를 넘어 250개 그대로이고 `order_detail`만 3개씩 묶여 84개(약 61MB, peak는 약 1.1GB로 추정)가 된다. 이 DAG의 압축 목표는 테이블별로 지정하지 않고 전체에 같은 값을 쓴다. Iceberg binpack은 기본적으로 목표의 75% 미만이거나 180%를 넘는 파일을 재작성 대상으로 본다. `product_stat`의 92~108MB 파일이 180%를 넘으려면 목표가 51MB보다 작아야 한다. 목표가 작으면 큰 테이블도 더 작은 파일로 압축된다. 86GB 규모의 merge-on-read 테이블은 현재 파일이 1,306개이고 128MB 기준으로 압축하면 약 700개, 48MB 기준이면 약 1,800개로 추정된다.

### 7.2 작은 파일의 비용

파일을 작게 유지하는 비용은 측정상 크지 않았다. 입력 4.9MB 태스크가 0.67초, 32.5MB 태스크가 2.9초여서 태스크당 고정 비용은 0.3초 안팎으로 추정된다. 서로 다른 테이블의 두 스테이지로 잡은 값이라 대략값이다. Spark가 파일 하나를 여는 비용을 4MB를 읽는 시간으로 보는 기본값(`spark.sql.files.openCostInBytes`)과 비슷한 크기다. 고정 비용이 0.3초라면 48MB 파일은 태스크 시간의 약 7%, 128MB 파일은 약 3%다. 반대로 Spill은 스캔 스테이지 시간을 18%, 79% 늘렸다. 파일 수가 늘어 driver의 계획 수립과 오브젝트 스토리지 요청이 늘어나는 비용은 측정하지 않았다.

### 7.3 압축 제외와 merge-on-read

매일 전체를 다시 쓰는 테이블은 압축 효과가 다음 새벽 MERGE까지만 가므로 대상에서 빼는 선택지도 있다. 낮 동안 읽기에서 얻는 이점과 새벽 Spill의 비용을 비교해야 해서 이번에는 정하지 않았다. merge-on-read로 전환하면 스캔이 필요한 컬럼만 읽어 peak가 줄어든다. 다른 테이블에서는 파일 70MB 중 22MB를 읽고 peak가 416MB였다. 다만 MERGE가 파일을 다시 쓰지 않아 압축 결과가 유지되므로 압축 다음 밤의 Spill을 다시 확인해야 한다. 이 두 가지는 이번 범위에서 제외했다.

---

## 8. executor 메모리 결정

메모리 크기는 이 잡에서 측정한 태스크 peak와 Spill 지점, 파일별 행 데이터 배율, YARN 자원 여유를 기준으로 정했다. 8g에서는 1.38~1.41GB 부근에서 Spill이 시작됐고, 12g에서는 태스크당 최대 몫이 2.34GB로 늘어난다.

### 8.1 클러스터 여유

| executor 설정 | 컨테이너 | 노드당(30GB) | 앱당 최대(5개) | 태스크당 최대 몫 |
|---|--:|--:|--:|--:|
| 8g + 1G | 9GB | 3개 | 45GB | 1.54GB |
| 12g + 2G | 14GB | 2개 | 70GB | 2.34GB |
| 16g + 2G | 18GB | 1개 | 90GB | 3.14GB |

YARN 노드는 30GB·16코어이고 컨테이너 최대 크기는 30GB다. 이 배치가 쓰는 큐는 전체 600GB의 10%(60GB)를 보장받고 최대 90%까지 쓸 수 있다. 야간에는 앱 2~3개가 동시에 떠서 12g에서는 최대 140~210GB를 쓴다. 보장 용량은 넘지만 큐 최대 용량 안이다. 최근 이 YARN 클러스터에 제출된 앱은 모두 이 배치의 것이라 다른 큐와의 경합은 확인하지 못했다. 다른 팀이 같은 클러스터를 쓰기 시작하면 앱당 70GB가 부담이 될 수 있다.

코어를 줄이는 방법(12g 3코어)은 태스크 몫이 3.12GB로 16g 4코어(3.14GB)와 같지만 동시 코어가 15개로 25% 줄어든다.

### 8.2 조회 쪽 자원

이 테이블들을 읽는 다른 잡도 같은 파일을 받는다. 매일 아침 실행되는 조회 잡은 스탠드얼론 클러스터에서 executor 16g, 코어 4개로 고정돼 돌고 기본 `memory.fraction`(0.6)에서 태스크당 상한이 2.36GB다. 이 잡은 executor가 8g였을 때 한 스테이지에서 7.56GB를 Spill했고 16g로 올린 뒤 Spill이 0이 됐으며 잡 시간은 약 11분으로 그대로였다. 이때 `memory.fraction`이 0.8에서 0.6으로 함께 바뀌어 실효 풀은 6.17GB에서 9.42GB로 53% 늘었다. 조회 쪽은 야간 적재보다 여유가 있다. 압축 목표(128MB)는 더 약한 쪽인 야간 적재가 받을 수 있는 크기를 기준으로 본다.

### 8.3 결정

executor를 12g(오버헤드 2G)로 올리는 쪽을 먼저 적용하기로 했다.

- 압축 목표를 낮춰도 `product_stat`의 기준선 Spill은 줄지 않는다. 이 파일들이 재작성 대상이 되려면 목표가 약 51MB보다 작아야 하고 그 값은 큰 테이블의 파일 수를 늘린다.
- 12g에서는 태스크당 최대 몫이 2.34GB로 늘어 실측 배율로 계산한 행 데이터 1.9~2.0GB를 수용할 수 있다. 노드당 executor는 3개에서 2개로 줄지만 30GB 안에 들어간다.
- 변경이 세션 생성 설정 두 줄이라 압축 목표와 압축 판정 기준을 건드리지 않는다.

16g는 여유가 크지만 노드당 executor가 1개로 줄고 앱당 90GB를 쓴다. 12g로 기준선 Spill이 사라지는지 본 뒤 잔여 Spill이 남으면 올린다.

---

## 9. 적용과 확인 계획

### 9.1 적용

야간 적재 잡이 Livy 세션을 만들 때 넘기는 Spark 설정 두 개를 바꾼다. 이 글의 수치는 모두 적용 전 기준이다.

```diff
-  "spark.executor.memory": "8g",
+  "spark.executor.memory": "12g",
-  "spark.executor.memoryOverhead": "1G",
+  "spark.executor.memoryOverhead": "2G",
```

`memoryOverhead`는 Spark 기본 비율(executor 메모리의 10%)보다 크게 잡았다. 이 YARN 클러스터에서는 executor 하나가 exit 137로 강제 종료돼 스테이지가 재시도된 적이 있고 오버헤드를 1G로 둔 뒤에는 재발하지 않았다. 원인까지는 확인하지 못했다. 힙을 12g로 키우면 1G의 비율이 12.5%에서 8.3%로 내려가 기본 비율보다 낮아지므로 2G(16.7%)로 함께 올렸다.

### 9.2 확인 계획

1. 적용 후 첫 앱의 환경 정보에서 `spark.executor.memory`가 12g, `memoryOverhead`가 2G인지 확인한다. 다르면 이후 비교는 의미가 없다.
2. 압축을 다시 실행하지 않으면 `event_log`와 `order_detail`은 250개 파일이라 12g와 관계없이 Spill이 0이어야 한다. 이번 확인 대상은 `product_stat`의 기준선 18.3GB가 0이 되는지다. 태스크당 행 데이터가 1.9GB이고 12g에서 쌓을 수 있는 양이 약 2.04GB(2,090MB)라 0이 될 것으로 예상하지만 여유는 약 8%뿐이다.
3. `customer_profile`은 조사한 기간에 하루만 Spill이 났으므로 0이어도 12g의 효과로 보지 않는다.
4. 잔여 Spill이 남으면 16g, 오버헤드 2G로 올린다.
5. 12g에서 압축 결과 파일(98MB, 119MB)을 Spill 없이 읽는지는 압축을 한 번 더 실행한 다음 새벽에 확인한다.

### 9.3 확인하지 못한 것

- 12g의 효과는 아직 확인하지 않았다. 위 계획이 첫 검증이다.
- 6.2절의 파일 크기는 네 테이블의 배율과 8g에서 Spill한 태스크의 값으로 계산한 추정이다. 12g와 16g의 상한은 풀 크기 비례로 늘린 값이고 직접 측정하지 않았다.
- 파일 수가 늘어 생기는 계획 수립과 오브젝트 스토리지 요청 비용은 측정하지 않았다.

---

## 10. 정리

- Spill 증가는 전날 오후 압축이 만든 파일 배치 때문이었다. `event_log`는 250개(약 33MB)에서 84개로, `order_detail`은 250개(약 20MB)에서 42개로 줄었고 새벽 MERGE가 파일 하나를 태스크 하나로 읽으면서 태스크 메모리가 상한을 넘었다.
- 압축은 파일을 통째로 묶어 128MB 이하의 새 파일을 만들고 MERGE는 셔플 파티션을 128MB까지 묶어 250개로 쓴다. 압축 결과는 다음 MERGE에서 250개 작은 파일로 돌아가서 영향은 압축 다음 새벽 한 번에 그쳤다.
- 태스크 메모리는 행 형식 크기를 따르고 행 형식은 Parquet의 16~21배였다. 8g 4코어에서 Spill 없이 읽는 파일 크기는 65~87MB로 추정되며 압축 결과(98~119MB)와 기준선 테이블(108MB)이 이를 넘었다.
- 압축 목표를 낮추는 방법은 기준선 Spill을 줄이지 못하고 큰 테이블의 파일 수를 늘린다. 그래서 executor를 12g(오버헤드 2G)로 올리는 쪽을 먼저 적용한다.
- 12g에서 압축 결과 파일의 여유는 1.5~5.3%라 경계이고 결과는 적용 후 새벽 Spill로 확인한다.
