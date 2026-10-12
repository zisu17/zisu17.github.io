---
title: "[Spark] Spark Standalone과 YARN 클러스터 매니저 비교"
excerpt: "Spark Standalone과 YARN이 익스큐터를 배치하고 자원을 나누는 방식과, 같은 설정 키를 두 매니저가 다르게 읽는 지점을 Spark 3.5 기준으로 정리한다."
nav_section: data
nav_topic: processing

categories:
  - Data Engineering
tags:
  - Data Engineering
  - Spark
  - Standalone
  - YARN
  - Livy

permalink: /data/spark-standalone-vs-yarn/

toc: true
toc_sticky: true

date: 2026-10-12
last_modified_at: 2026-10-12
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

Spark는 클러스터의 CPU와 메모리를 직접 관리하지 않는다. 익스큐터를 몇 개, 어느 서버에, 코어와 메모리를 얼마씩 주고 띄울지는 클러스터 매니저가 정한다. 클러스터 매니저로는 Standalone, YARN, Kubernetes 등이 있고 이 글은 Standalone과 YARN만 다룬다.

Livy로 Spark 세션을 만드는 DAG의 설정을 정리하면서 한 세션 요청 안에 Standalone에서만 읽는 키와 YARN에서만 읽는 키가 함께 들어 있는 것을 확인했다. 어떤 키가 실제로 적용되는지는 세션이 어느 매니저에서 실행되는지에 따라 달라진다. Livy를 거치면 매니저가 세션 요청에 드러나지 않아서 설정만 읽어서는 실제 익스큐터 수를 알기 어렵다.

이 글에서는 두 매니저의 구성과 자원 배분 방식, 같은 설정 키를 각 매니저가 어떻게 읽는지를 Spark 3.5 문서와 소스 코드를 기준으로 정리한다.

---

## 2. 클러스터 구성

Standalone은 Spark 배포본에 포함된 클러스터 매니저다. 마스터 프로세스 하나가 클러스터 자원을 관리하고 서버마다 실행되는 워커 프로세스가 마스터의 지시를 받아 익스큐터 JVM을 띄운다. `start-master.sh`와 `start-worker.sh`만으로 구성되며 받을 수 있는 앱은 Spark 앱뿐이다.

YARN은 Hadoop의 자원 관리 계층이다. ResourceManager가 클러스터 전체 자원과 큐를 관리하고 서버마다 실행되는 NodeManager가 컨테이너를 띄운다. Spark 앱은 먼저 ApplicationMaster 컨테이너를 하나 받고 ApplicationMaster가 ResourceManager에 익스큐터용 컨테이너를 요청한다. cluster 배포 모드에서는 드라이버가 ApplicationMaster 안에서 실행된다. 같은 NodeManager에 Hive(Tez)나 MapReduce 같은 다른 엔진의 컨테이너도 함께 올라간다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 296" role="img" aria-label="Standalone은 마스터가 워커에 Spark 익스큐터만 띄우고, YARN은 ResourceManager가 NodeManager에 Spark와 다른 엔진의 컨테이너를 함께 띄운다">
  <defs><marker id="tlv-2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <rect class="soft" x="1" y="1" width="298" height="290" rx="4"/>
  <text class="t" x="14" y="24">Standalone</text>
  <rect class="box" x="64" y="40" width="170" height="50" rx="4"/>
  <text class="t" x="149" y="61" text-anchor="middle">Master</text>
  <text class="s" x="149" y="78" text-anchor="middle">Spark 앱만 받음</text>
  <path class="wire" d="M149 90 V108 H56 V126" marker-end="url(#tlv-2-arrow)"/>
  <path class="wire" d="M149 90 V126" marker-end="url(#tlv-2-arrow)"/>
  <path class="wire" d="M149 90 V108 H242 V126" marker-end="url(#tlv-2-arrow)"/>
  <rect class="box" x="14" y="128" width="84" height="128" rx="4"/>
  <text class="s" x="56" y="148" text-anchor="middle">Worker</text>
  <rect class="accent" x="22" y="160" width="68" height="30" rx="3"/>
  <text class="s" x="56" y="179" text-anchor="middle">Executor</text>
  <rect class="accent" x="22" y="198" width="68" height="30" rx="3"/>
  <text class="s" x="56" y="217" text-anchor="middle">Executor</text>
  <rect class="box" x="107" y="128" width="84" height="128" rx="4"/>
  <text class="s" x="149" y="148" text-anchor="middle">Worker</text>
  <rect class="accent" x="115" y="160" width="68" height="30" rx="3"/>
  <text class="s" x="149" y="179" text-anchor="middle">Executor</text>
  <rect class="accent" x="115" y="198" width="68" height="30" rx="3"/>
  <text class="s" x="149" y="217" text-anchor="middle">Executor</text>
  <rect class="box" x="200" y="128" width="84" height="128" rx="4"/>
  <text class="s" x="242" y="148" text-anchor="middle">Worker</text>
  <rect class="accent" x="208" y="160" width="68" height="30" rx="3"/>
  <text class="s" x="242" y="179" text-anchor="middle">Executor</text>
  <rect class="accent" x="208" y="198" width="68" height="30" rx="3"/>
  <text class="s" x="242" y="217" text-anchor="middle">Executor</text>
  <text class="s" x="150" y="278" text-anchor="middle">Spark 앱의 익스큐터만 실행</text>
  <rect class="soft" x="331" y="1" width="298" height="290" rx="4"/>
  <text class="t" x="344" y="24">YARN</text>
  <rect class="box" x="397" y="40" width="170" height="50" rx="4"/>
  <text class="t" x="482" y="61" text-anchor="middle">ResourceManager</text>
  <text class="s" x="482" y="78" text-anchor="middle">큐 비율로 자원 배분</text>
  <path class="wire" d="M482 90 V108 H386 V126" marker-end="url(#tlv-2-arrow)"/>
  <path class="wire" d="M482 90 V126" marker-end="url(#tlv-2-arrow)"/>
  <path class="wire" d="M482 90 V108 H578 V126" marker-end="url(#tlv-2-arrow)"/>
  <rect class="box" x="342" y="128" width="88" height="128" rx="4"/>
  <text class="s" x="386" y="148" text-anchor="middle">NodeManager</text>
  <rect class="accent" x="350" y="160" width="72" height="30" rx="3"/>
  <text class="s" x="386" y="179" text-anchor="middle">Spark AM</text>
  <rect class="accent" x="350" y="198" width="72" height="30" rx="3"/>
  <text class="s" x="386" y="217" text-anchor="middle">Executor</text>
  <rect class="box" x="438" y="128" width="88" height="128" rx="4"/>
  <text class="s" x="482" y="148" text-anchor="middle">NodeManager</text>
  <rect class="accent" x="446" y="160" width="72" height="30" rx="3"/>
  <text class="s" x="482" y="179" text-anchor="middle">Executor</text>
  <rect class="box dash" x="446" y="198" width="72" height="30" rx="3"/>
  <text class="s" x="482" y="217" text-anchor="middle">Hive 작업</text>
  <rect class="box" x="534" y="128" width="88" height="128" rx="4"/>
  <text class="s" x="578" y="148" text-anchor="middle">NodeManager</text>
  <rect class="box dash" x="542" y="160" width="72" height="30" rx="3"/>
  <text class="s" x="578" y="179" text-anchor="middle">Hive 작업</text>
  <rect class="accent" x="542" y="198" width="72" height="30" rx="3"/>
  <text class="s" x="578" y="217" text-anchor="middle">Executor</text>
  <text class="s" x="480" y="278" text-anchor="middle">여러 엔진의 컨테이너가 함께 실행</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> Standalone 워커에는 Spark 익스큐터만 올라가고, YARN NodeManager에는 Spark와 다른 엔진의 컨테이너가 함께 올라간다.</figcaption>
</figure>

---

## 3. 자원 배분 방식

### 3.1 Standalone의 코어 기준 배분

Standalone 마스터는 앱이 받을 코어 수를 기준으로 워커에 익스큐터를 배치한다. 앱 하나가 받을 수 있는 코어의 상한은 `spark.cores.max`로 정하고 앱이 이 값을 지정하지 않으면 마스터의 `spark.deploy.defaultCores`를 쓴다. `spark.deploy.defaultCores`의 기본값은 무한대라서 `spark.cores.max` 없이 제출한 앱은 클러스터에 남은 코어를 모두 받는다. 뒤에 제출된 앱은 앞의 앱이 코어를 반환할 때까지 대기한다.

워커 3대, 워커당 8코어인 클러스터에 `spark.executor.cores=4`로 두 앱을 차례로 제출하면 코어가 다음과 같이 배분된다.

<figure class="tlv">
<div class="tlv-legend"><span>앱 A</span><span style="--sw:var(--tlv-line-2)">앱 B</span><span style="--sw:var(--tlv-line)">빈 코어</span></div>
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 126" role="img" aria-label="spark.cores.max가 없으면 앱 A가 코어 24개를 모두 받고 앱 B는 대기하며, 8로 제한하면 두 앱이 8개씩 받아 함께 실행된다">
  <text class="s" x="162" y="16">클러스터 코어 24개, 4칸 묶음이 익스큐터 1개</text>
  <text class="t" x="0" y="44">cores.max 미설정</text>
  <text class="s" x="0" y="60">앱 B는 대기</text>
  <rect class="bar" x="162" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="180" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="198" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="216" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="239" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="257" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="275" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="293" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="316" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="334" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="352" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="370" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="393" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="411" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="429" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="447" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="470" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="488" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="506" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="524" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="547" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="565" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="583" y="32" width="16" height="16" rx="2"/>
  <rect class="bar" x="601" y="32" width="16" height="16" rx="2"/>
  <text class="t" x="0" y="100">cores.max = 8</text>
  <text class="s" x="0" y="116">앱 A·B 함께 실행</text>
  <rect class="bar" x="162" y="88" width="16" height="16" rx="2"/>
  <rect class="bar" x="180" y="88" width="16" height="16" rx="2"/>
  <rect class="bar" x="198" y="88" width="16" height="16" rx="2"/>
  <rect class="bar" x="216" y="88" width="16" height="16" rx="2"/>
  <rect class="bar" x="239" y="88" width="16" height="16" rx="2"/>
  <rect class="bar" x="257" y="88" width="16" height="16" rx="2"/>
  <rect class="bar" x="275" y="88" width="16" height="16" rx="2"/>
  <rect class="bar" x="293" y="88" width="16" height="16" rx="2"/>
  <rect class="bar-mute" x="316" y="88" width="16" height="16" rx="2"/>
  <rect class="bar-mute" x="334" y="88" width="16" height="16" rx="2"/>
  <rect class="bar-mute" x="352" y="88" width="16" height="16" rx="2"/>
  <rect class="bar-mute" x="370" y="88" width="16" height="16" rx="2"/>
  <rect class="bar-mute" x="393" y="88" width="16" height="16" rx="2"/>
  <rect class="bar-mute" x="411" y="88" width="16" height="16" rx="2"/>
  <rect class="bar-mute" x="429" y="88" width="16" height="16" rx="2"/>
  <rect class="bar-mute" x="447" y="88" width="16" height="16" rx="2"/>
  <rect class="soft" x="470" y="88" width="16" height="16" rx="2"/>
  <rect class="soft" x="488" y="88" width="16" height="16" rx="2"/>
  <rect class="soft" x="506" y="88" width="16" height="16" rx="2"/>
  <rect class="soft" x="524" y="88" width="16" height="16" rx="2"/>
  <rect class="soft" x="547" y="88" width="16" height="16" rx="2"/>
  <rect class="soft" x="565" y="88" width="16" height="16" rx="2"/>
  <rect class="soft" x="583" y="88" width="16" height="16" rx="2"/>
  <rect class="soft" x="601" y="88" width="16" height="16" rx="2"/>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 2.</b> spark.cores.max가 없으면 먼저 제출된 앱이 클러스터 코어를 모두 받고 다음 앱은 대기한다.</figcaption>
</figure>

여러 앱이 함께 쓰는 클러스터라면 마스터 쪽 `spark.deploy.defaultCores`를 낮춰 두면 된다. 그러면 `spark.cores.max`를 빠뜨린 앱도 클러스터 코어 전체를 받지 않는다.

`spark.executor.cores`도 배치 결과를 바꾼다. 이 값을 지정하면 워커에 코어와 메모리가 남아 있는 한 같은 앱의 익스큐터 여러 개가 한 워커에 올라간다. 지정하지 않으면 익스큐터 하나가 워커에 남은 코어를 모두 받으므로 한 번의 스케줄링에서 앱당 워커 하나에 익스큐터가 하나씩만 뜬다.

### 3.2 YARN의 큐 기준 배분

YARN은 큐 단위로 자원을 나눈다. Hadoop의 기본 스케줄러인 Capacity Scheduler에서는 큐마다 클러스터 자원 중 보장받는 비율(`capacity`)과 최대 비율(`maximum-capacity`)을 정한다. 다른 큐가 자원을 쓰지 않으면 최대 비율까지 더 가져다 쓰고 선점(preemption)을 켜 두면 보장 비율보다 적게 받은 큐를 위해 다른 큐의 컨테이너를 회수한다. Spark 앱은 `spark.yarn.queue`로 제출할 큐를 지정하고 지정하지 않으면 `default` 큐로 들어간다.

자원 요청 단위는 컨테이너다. 익스큐터 하나는 `spark.executor.memory`와 `spark.executor.memoryOverhead`를 더한 크기의 컨테이너로 요청된다. Capacity Scheduler의 기본 자원 계산기인 `DefaultResourceCalculator`는 메모리만 기준으로 자원을 나눈다. 이 설정에서는 `spark.executor.cores`가 큐 자원 계산에 들어가지 않고 코어까지 계산하려면 `DominantResourceCalculator`로 바꿔야 한다.

---

## 4. 익스큐터 수와 메모리 설정

### 4.1 매니저별로 읽는 설정

익스큐터 수와 크기에 관련된 설정 중 일부는 한쪽 매니저에서만 읽힌다.

| 설정 | Standalone | YARN | 용도 |
|---|---|---|---|
| `spark.executor.cores` | 적용 | 적용 | 익스큐터 하나의 코어 수 |
| `spark.cores.max` | 적용 | 무시 | 앱 전체의 코어 상한 |
| `spark.executor.instances` | 무시 | 적용 | 익스큐터 수 |
| `spark.executor.memoryOverhead` | 무시 | 적용 | 힙 밖 메모리, 컨테이너 크기에 포함 |
| `spark.yarn.*` | 무시 | 적용 | 큐, ApplicationMaster 설정 |

Standalone에서 익스큐터 수를 정하는 설정은 `spark.executor.instances`가 아니다. Spark 3.5의 `StandaloneSchedulerBackend`는 동적 할당이 꺼져 있으면 익스큐터 수에 제한을 두지 않고 마스터에는 `spark.cores.max`만 전달한다. 마스터는 이 코어 상한이 찰 때까지 `spark.executor.cores` 크기의 익스큐터를 띄우므로 익스큐터 수는 `spark.cores.max ÷ spark.executor.cores`가 된다. 워커에 남은 코어나 메모리가 부족하면 이보다 적게 뜬다.

YARN에서는 반대로 `spark.executor.instances`가 익스큐터 수를 정하고 `spark.cores.max`는 읽지 않는다. 클러스터나 큐에 남은 메모리가 컨테이너를 놓기에 부족하면 나머지 익스큐터는 자원이 날 때까지 대기한다. 설정 문서에도 `spark.cores.max`는 Standalone과 Mesos에서 쓰는 값으로 적혀 있다.

<style>
.tlv-calc .seg{display:inline-flex;border:1px solid var(--tlv-line-2);border-radius:4px;overflow:hidden;margin-bottom:.7em}
.tlv-calc .seg button{border:0;background:#fff;padding:.3em .9em;font-size:.8em;color:var(--tlv-sub)}
.tlv-calc .seg button[aria-pressed="true"]{background:var(--tlv-accent-bg);color:var(--tlv-accent-text);font-weight:600}
.tlv-calc .row{display:grid;grid-template-columns:10.5em 1fr 2.6em;align-items:center;gap:.6em;font-size:.8em;margin:.3em 0}
.tlv-calc .row label{font-family:var(--tlv-mono);color:var(--tlv-sub)}
.tlv-calc .row label.chk{font-family:inherit;display:flex;align-items:center;gap:.4em}
.tlv-calc input[type=range]{width:100%;accent-color:var(--tlv-accent)}
.tlv-calc .row output{text-align:right;font-weight:600;color:var(--tlv-ink);font-variant-numeric:tabular-nums}
.tlv-calc .row.is-off{opacity:.4}
.tlv-calc .row input:disabled{cursor:not-allowed}
.tlv-calc .tlv-stats{margin-top:.9em}
.tlv-calc .tlv-stat .d{color:var(--tlv-sub);font-weight:400}
.tlv-calc .exs{display:flex;flex-wrap:wrap;gap:5px;margin:.8em 0 .2em;min-height:1.4em}
.tlv-calc .ex{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--tlv-accent);border-radius:3px;background:var(--tlv-accent-bg)}
.tlv-calc .ex i{display:block;width:9px;height:9px;border-radius:1px;background:var(--tlv-accent-2)}
.tlv-calc .ex.is-wait{border:1px dashed var(--tlv-line-2);background:#fff}
.tlv-calc .ex.is-wait i{background:var(--tlv-line)}
.tlv-calc .kl{font-size:.75em;color:var(--tlv-sub);margin-top:.7em}
.tlv-calc .keys{display:flex;flex-wrap:wrap;gap:.35em;margin:.35em 0 .2em}
.tlv-calc .keys .off{text-decoration:line-through;color:var(--tlv-mute)}
.tlv-calc .out{font-size:.85em}
.tlv-calc .out strong{color:var(--tlv-accent-text)}
@media (max-width:600px){.tlv-calc .row{grid-template-columns:1fr 2.6em}.tlv-calc .row label{grid-column:1/-1}.tlv-calc .row .sp{display:none}}
</style>

<figure class="tlv tlv-calc" id="tlv-4-calc">
<div class="tlv-box">
<div class="seg" role="group" aria-label="클러스터 매니저"><button type="button" data-mgr="sa" aria-pressed="true">Standalone</button><button type="button" data-mgr="yn" aria-pressed="false">YARN</button></div>
<div class="row"><label for="tlv-4-ec">executor.cores</label><input id="tlv-4-ec" type="range" min="1" max="8" step="1" value="2"><output data-v="ec">2</output></div>
<div class="row" data-row="cm"><label for="tlv-4-cm">cores.max</label><input id="tlv-4-cm" type="range" min="1" max="24" step="1" value="4"><output data-v="cm">4</output></div>
<div class="row" data-row="cmset"><span class="sp"></span><label class="chk" for="tlv-4-cmset"><input id="tlv-4-cmset" type="checkbox" checked>cores.max 지정</label><span class="sp"></span></div>
<div class="row is-off" data-row="ei"><label for="tlv-4-ei">executor.instances</label><input id="tlv-4-ei" type="range" min="1" max="12" step="1" value="12" disabled><output data-v="ei">12</output></div>
<div class="row"><label for="tlv-4-mem">executor.memory</label><input id="tlv-4-mem" type="range" min="1" max="16" step="1" value="4"><output data-v="mem">4G</output></div>
<div class="row is-off" data-row="ovh"><label for="tlv-4-ovh">memoryOverhead</label><input id="tlv-4-ovh" type="range" min="0.5" max="4" step="0.5" value="1" disabled><output data-v="ovh">1G</output></div>
<div class="tlv-stats">
<div class="tlv-stat"><div class="n" data-v="n">2<small>개</small></div><div class="l">실행되는 익스큐터</div><div class="d" data-v="n-d">&nbsp;</div></div>
<div class="tlv-stat"><div class="n" data-v="cores">4<small>개</small></div><div class="l">코어 합계</div><div class="d" data-v="cores-d">물리 코어 24개 중</div></div>
<div class="tlv-stat"><div class="n" data-v="memt">8<small>GB</small></div><div class="l">메모리 합계</div><div class="d" data-v="memt-d">힙 기준, 힙 밖은 별도</div></div>
</div>
<div class="exs" data-v="exs"><span class="ex"><i></i><i></i></span><span class="ex"><i></i><i></i></span></div>
<div class="kl">적용되는 설정(주황)과 무시되는 설정(취소선)</div>
<div class="keys" data-v="keys"><span class="tlv-chip is-accent">spark.executor.cores</span><span class="tlv-chip is-accent">spark.cores.max</span><span class="tlv-chip is-accent">spark.executor.memory</span><span class="tlv-chip off">spark.executor.instances</span><span class="tlv-chip off">spark.executor.memoryOverhead</span><span class="tlv-chip off">spark.yarn.*</span></div>
<p class="out" data-v="note">익스큐터 수 = cores.max 4 ÷ executor.cores 2 = <strong>2개</strong>. 워커는 남은 코어와 힙 크기(executor.memory)로 익스큐터를 놓을 자리를 판단하고 memoryOverhead와 executor.instances는 반영하지 않는다. 남은 자원은 코어 20개, 메모리 88GB다.</p>
</div>
<figcaption class="tlv-cap"><b>그림 3.</b> Standalone은 cores.max와 워커의 코어·힙 크기로, YARN은 executor.instances와 노드 메모리로 실행되는 익스큐터 수가 정해진다. 노드 3대 × 8코어 × 32GB, 동적 할당 꺼짐, YARN 최소 할당 단위 1GB, ApplicationMaster 제외를 가정했다.</figcaption>
</figure>

<script>
(function(){
  var root = document.getElementById('tlv-4-calc'); if (!root) return;
  var NODES = 3, CORES = 8, MEMG = 32, mgr = 'sa';
  var ec = root.querySelector('#tlv-4-ec'), cm = root.querySelector('#tlv-4-cm'), cmset = root.querySelector('#tlv-4-cmset'), ei = root.querySelector('#tlv-4-ei'), mem = root.querySelector('#tlv-4-mem'), ovh = root.querySelector('#tlv-4-ovh');
  var btns = root.querySelectorAll('[data-mgr]');
  function v(k){ return root.querySelector('[data-v="' + k + '"]'); }
  function row(k){ return root.querySelector('[data-row="' + k + '"]'); }
  function g(x){ return (x % 1 ? x.toFixed(1) : String(x)) + 'G'; }
  function chip(name, on){ return '<span class="tlv-chip ' + (on ? 'is-accent' : 'off') + '">' + name + '</span>'; }
  function boxes(cnt, c, cls){ var h = '', i, j; for (i = 0; i < cnt; i++) { h += '<span class="ex' + cls + '">'; for (j = 0; j < c; j++) h += '<i></i>'; h += '</span>'; } return h; }
  function update(){
    var c = +ec.value, m = +cm.value, set = cmset.checked, k = +ei.value, me = +mem.value, ov = +ovh.value, sa = mgr === 'sa';
    var n, wait = 0, memt, note, keys, memd;
    cm.disabled = !sa || !set; cmset.disabled = !sa; ei.disabled = sa; ovh.disabled = sa;
    row('cm').classList.toggle('is-off', cm.disabled); row('cmset').classList.toggle('is-off', !sa); row('ei').classList.toggle('is-off', sa); row('ovh').classList.toggle('is-off', sa);
    v('ec').textContent = c; v('cm').textContent = set ? m : '-'; v('ei').textContent = k; v('mem').textContent = g(me); v('ovh').textContent = g(ov);
    if (sa) {
      var per = Math.min(Math.floor(CORES / c), Math.floor(MEMG / me)), cap = NODES * per, want = Math.floor(m / c);
      n = set ? Math.min(want, cap) : cap;
      memt = n * me; memd = '힙 기준, 힙 밖은 별도';
      var rest = '남은 자원은 코어 ' + (NODES * CORES - n * c) + '개, 메모리 ' + (NODES * MEMG - memt) + 'GB다.';
      if (set && want === 0) note = 'cores.max가 executor.cores보다 작아 익스큐터를 하나도 띄우지 못한다.';
      else if (set) note = '익스큐터 수 = cores.max ' + m + ' ÷ executor.cores ' + c + ' = <strong>' + n + '개</strong>' + (want > cap ? '(워커 코어·메모리에 들어가는 최대 개수)' : '') + '. 워커는 남은 코어와 힙 크기(executor.memory)로 익스큐터를 놓을 자리를 판단하고 memoryOverhead와 executor.instances는 반영하지 않는다. ' + rest;
      else note = 'cores.max가 없어 워커 코어·메모리에 들어가는 만큼 <strong>' + n + '개</strong>를 띄운다. ' + rest;
      keys = chip('spark.executor.cores', 1) + chip('spark.cores.max', set) + chip('spark.executor.memory', 1) + chip('spark.executor.instances', 0) + chip('spark.executor.memoryOverhead', 0) + chip('spark.yarn.*', 0);
    } else {
      var ct = Math.ceil(me + ov), perY = Math.floor(MEMG / ct), capY = NODES * perY;
      n = Math.min(k, capY); wait = k - n;
      memt = n * ct; memd = '컨테이너 ' + ct + 'G × ' + n + '개';
      note = '컨테이너 = executor.memory ' + g(me) + ' + memoryOverhead ' + g(ov) + (ct !== me + ov ? ' → 최소 할당 단위로 올려 ' + ct + 'G' : ' = ' + ct + 'G') + '. 노드 메모리 32GB에 ' + perY + '개씩 들어가 최대 ' + capY + '개다. ';
      note += wait ? 'executor.instances ' + k + '개 중 <strong>' + n + '개</strong>만 실행되고 ' + wait + '개는 자원이 날 때까지 대기한다.' : 'executor.instances <strong>' + k + '개</strong>가 모두 실행된다.';
      if (n * c > NODES * CORES) note += ' 기본 자원 계산기는 코어를 세지 않아 코어 합계 ' + (n * c) + '개가 물리 코어 24개를 넘어도 컨테이너가 배치된다.';
      note += ' cores.max는 읽지 않는다.';
      keys = chip('spark.executor.cores', 1) + chip('spark.cores.max', 0) + chip('spark.executor.memory', 1) + chip('spark.executor.instances', 1) + chip('spark.executor.memoryOverhead', 1) + chip('spark.yarn.*', 1);
    }
    v('n').innerHTML = n + '<small>개</small>';
    v('n-d').innerHTML = wait ? wait + '개 대기' : '&nbsp;';
    v('cores').innerHTML = (n * c) + '<small>개</small>';
    v('cores-d').textContent = n * c > NODES * CORES ? '물리 코어 24개 초과' : '물리 코어 24개 중';
    v('memt').innerHTML = memt + '<small>GB</small>';
    v('memt-d').textContent = memd;
    v('exs').innerHTML = boxes(n, c, '') + boxes(wait, c, ' is-wait');
    v('keys').innerHTML = keys;
    v('note').innerHTML = note;
  }
  Array.prototype.forEach.call(btns, function(b){
    b.addEventListener('click', function(){
      mgr = b.getAttribute('data-mgr');
      Array.prototype.forEach.call(btns, function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      update();
    });
  });
  [ec, cm, ei, mem, ovh].forEach(function(el){ el.addEventListener('input', update); });
  cmset.addEventListener('change', update);
  update();
})();
</script>

### 4.2 메모리 한도 처리

YARN NodeManager는 기본 설정에서 컨테이너의 실제 메모리 사용량을 감시한다. 익스큐터 프로세스가 컨테이너 크기를 넘으면 NodeManager가 프로세스를 종료하고 Spark 로그에는 `Container killed by YARN for exceeding physical memory limits` 메시지가 남는다. 컨테이너 크기는 `spark.executor.memory`와 `spark.executor.memoryOverhead`의 합이고 오프힙 메모리나 PySpark 메모리를 따로 설정하면 그 값도 더해진다. `spark.executor.memoryOverhead`를 지정하지 않으면 `spark.executor.memory`의 10%와 384MiB 중 큰 값이 쓰인다.

Standalone 워커에는 이런 감시가 없다. `spark.executor.memory`가 그대로 익스큐터 JVM의 `-Xmx`가 되어 힙 크기는 제한되지만 힙 밖에서 쓰는 메모리에는 매니저가 두는 상한이 없다. 서버 메모리가 부족해지면 OS의 OOM killer가 프로세스를 종료한다. `spark.executor.memoryOverhead`는 Standalone에서 읽지 않으므로 이 값을 넣어도 힙 밖 메모리가 따로 확보되지 않는다. Standalone 클러스터에서 익스큐터가 메모리 부족으로 종료된 사례는 [Spark Standalone 익스큐터 메모리 부족과 Spill 원인 분석](/data/spark-standalone-executor-memory-spill/)에 정리했다.

`spark.executor.memory=4G`와 `spark.executor.memoryOverhead=1G`를 넣은 같은 설정을 두 매니저가 해석한 결과는 그림 4와 같다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 126" role="img" aria-label="executor.memory 4G와 memoryOverhead 1G를 YARN은 합쳐서 5G 컨테이너 한도로 감시하고, Standalone은 힙 4G만 제한하며 overhead는 읽지 않는다">
  <text class="l" x="130" y="14">0</text>
  <text class="l" x="434" y="14" text-anchor="middle">4G</text>
  <text class="l" x="510" y="14" text-anchor="middle">5G</text>
  <text class="t" x="0" y="40">YARN</text>
  <text class="s" x="0" y="54">컨테이너 크기로 감시</text>
  <rect class="bar" x="130" y="24" width="304" height="32" rx="2"/>
  <text class="s" x="282" y="44" text-anchor="middle">힙 4G</text>
  <rect class="accent" x="434" y="24" width="76" height="32" rx="2"/>
  <text class="s" x="472" y="44" text-anchor="middle">오버헤드 1G</text>
  <rect class="bad" x="510" y="20" width="2" height="40"/>
  <text class="s" x="520" y="38">컨테이너 5G 한도</text>
  <text class="s c-bad" x="520" y="53">넘으면 종료</text>
  <text class="l" x="438" y="78">-Xmx 4G</text>
  <text class="t" x="0" y="100">Standalone</text>
  <text class="s" x="0" y="114">힙만 제한</text>
  <rect class="bar" x="130" y="84" width="304" height="32" rx="2"/>
  <text class="s" x="282" y="104" text-anchor="middle">힙 4G</text>
  <rect class="box dash" x="434" y="84" width="76" height="32" rx="2"/>
  <text class="s" x="472" y="104" text-anchor="middle">1G 무시</text>
  <rect class="bad" x="434" y="80" width="2" height="40"/>
  <text class="s" x="520" y="98">힙 밖 메모리는</text>
  <text class="s" x="520" y="113">매니저 상한 없음</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 4.</b> 같은 메모리 설정에서 YARN은 힙과 오버헤드를 합친 5G를 컨테이너 한도로 감시하고, Standalone은 힙 4G만 제한한다.</figcaption>
</figure>

디스크 스필은 이 한도와 별개로 동작한다. 스필은 힙 안의 실행 메모리 영역이 부족할 때 Spark가 데이터를 디스크에 쓰는 동작이고 그동안 힙은 `-Xmx` 안에 머무르므로 스필 때문에 프로세스 메모리가 컨테이너 크기를 넘지는 않는다. 컨테이너 종료는 셔플 네트워크 버퍼(Netty 다이렉트 메모리), PySpark 워커 프로세스, zstd 같은 네이티브 압축 라이브러리처럼 Spark 메모리 관리자가 세지 않는 힙 밖 메모리가 오버헤드 몫을 넘을 때 생긴다.

---

## 5. 두 매니저용 키가 섞인 세션 설정

1장에서 언급한 세션 요청에서 익스큐터와 메모리에 관련된 키 일부만 남기면 다음과 같다.

```json
{
  "kind": "pyspark",
  "executorCores": 2,
  "executorMemory": "4G",
  "conf": {
    "spark.cores.max": 4,
    "spark.executor.instances": 12,
    "spark.yarn.executor.memoryOverhead": "1G",
    "spark.yarn.appMasterEnv.LANG": "ko_KR.UTF-8"
  }
}
```

`spark.yarn.executor.memoryOverhead`는 Spark 2.3에서 `spark.executor.memoryOverhead`로 이름이 바뀐 키다. 지금도 대체 키로 등록되어 있어 YARN에서는 같은 설정으로 읽힌다. 이 요청을 매니저별로 해석하면 다음과 같다.

| 키 | Standalone | YARN |
|---|---|---|
| `executorCores: 2` | 익스큐터당 2코어 | 익스큐터당 2코어 |
| `spark.cores.max: 4` | 앱 코어 상한 4개 | 읽지 않음 |
| `spark.executor.instances: 12` | 읽지 않음 | 익스큐터 12개 |
| `spark.yarn.executor.memoryOverhead: 1G` | 읽지 않음 | 컨테이너 크기 4G + 1G |
| `spark.yarn.appMasterEnv.LANG` | 읽지 않음 | ApplicationMaster 환경 변수 |

동적 할당이 꺼져 있으면 이 요청은 Standalone에서 익스큐터 2개, 코어 4개로 실행된다. YARN에서는 익스큐터 12개, 코어 24개, 컨테이너 메모리 합계 60GB를 요청한다. 그림 3 계산기의 기본값이 이 요청과 같다.

Livy로 만든 세션이 어느 매니저에서 실행되는지는 요청 본문이 아니라 Livy 서버 설정 `livy.spark.master`가 정한다. 실행 중인 세션의 Spark UI에서 Environment 탭의 `spark.master` 값이 `spark://`로 시작하면 Standalone, `yarn`이면 YARN이다. 한쪽 매니저에서만 쓰는 세션이라면 다른 매니저용 키를 지워 두어야 설정에 적힌 익스큐터 수와 실제 익스큐터 수가 다르게 보이지 않는다.

---

## 6. 그 밖의 차이

| 항목 | Standalone | YARN |
|---|---|---|
| 설치 | Spark 배포본만 있으면 된다 | Hadoop(YARN) 클러스터가 필요하다 |
| 다른 엔진과 자원 공유 | 하지 않는다 | Hive, MapReduce 등과 공유한다 |
| Python 앱의 cluster 배포 모드 | 지원하지 않는다 | 지원한다 |
| 관리 노드 장애 대비 | ZooKeeper 기반 대기 마스터 또는 파일시스템 기반 복구 | ResourceManager HA |
| Kerberos 위임 토큰 배포 | 지원하지 않는다 | 지원한다 |

위임 토큰 지원 범위는 Spark 3.5 문서 기준이다. 익스큐터가 Kerberos가 적용된 HDFS나 Hive 메타스토어에 접근해야 하는 환경이라면 Standalone으로는 구성하기 어렵다.

---

## 7. 정리

- Standalone은 코어 수를 기준으로 익스큐터를 배치하고 `spark.cores.max`가 없으면 앱 하나가 클러스터에 남은 코어를 모두 받는다.
- YARN은 큐 비율로 자원을 나누고 익스큐터를 `spark.executor.memory + spark.executor.memoryOverhead` 크기의 컨테이너로 띄워 이 크기를 넘으면 종료한다.
- 익스큐터 수는 Standalone에서 `spark.cores.max ÷ spark.executor.cores`로, YARN에서 `spark.executor.instances`로 정해지고 두 매니저는 서로의 키를 읽지 않는다.
- Livy 세션 요청에는 매니저가 드러나지 않으므로 Spark UI의 `spark.master`로 확인하고 쓰지 않는 매니저의 키는 설정에서 지운다.

---

## 8. 참고 자료

- [Spark 3.5.7 Configuration](https://spark.apache.org/docs/3.5.7/configuration.html)
- [Spark 3.5.7 Standalone Mode](https://spark.apache.org/docs/3.5.7/spark-standalone.html)
- [Spark 3.5.7 Running on YARN](https://spark.apache.org/docs/3.5.7/running-on-yarn.html)
- [Apache Hadoop Capacity Scheduler](https://hadoop.apache.org/docs/r3.4.3/hadoop-yarn/hadoop-yarn-site/CapacityScheduler.html)
