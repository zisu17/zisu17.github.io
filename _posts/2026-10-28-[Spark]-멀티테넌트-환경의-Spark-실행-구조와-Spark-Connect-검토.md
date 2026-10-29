---
title: "[Spark] 멀티테넌트 환경의 Spark 실행 구조와 Spark Connect 검토"
excerpt: "고객사·사용자 단위로 분리해야 하는 환경에서 Livy 세션으로 Spark를 운영하는 구조, 세션 요청 안에서 자격 증명과 카탈로그를 나누는 방식, Spark Connect PoC에서 확인한 공유 서버의 한계를 정리한다."
nav_section: data
nav_topic: processing

categories:
  - Data Engineering
tags:
  - Data Engineering
  - Spark
  - Livy
  - Spark Connect
  - Multi-tenant
  - Iceberg

permalink: /data/multitenant-spark-livy-vs-spark-connect/

toc: true
toc_sticky: true

date: 2026-10-28
last_modified_at: 2026-10-29
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

여러 테넌트의 데이터를 분리해야 하는 데이터 플랫폼에서 Spark를 어떻게 운영하고 있는지, 실행 창구를 Spark Connect로 바꾸는 검토가 어디서 막혔는지를 정리한다. 테넌트마다 랜딩존 버킷·Iceberg 카탈로그·저장소 자격 증명이 다르다. 한 테넌트의 세션이 다른 테넌트의 자격이나 데이터에 닿지 않아야 한다는 것이 이 플랫폼의 전제다.

Spark를 쓰는 워크로드는 Airflow 파이프라인과 사용자 요청을 처리하는 API 서비스다. 둘 다 Livy 세션을 실행 창구로 쓴다.

본문의 테넌트 이름, 버킷, 카탈로그, 큐 이름은 예시 값으로 바꿨다. Spark 3.5 기준이다.

---

## 2. 실행 구조

### 2.1 파이프라인의 세션 단위

Airflow DAG가 직접 데이터를 처리하지 않는다. DAG의 각 태스크가 PySpark 코드 문자열을 만들어 Livy REST API로 보내고 Livy가 띄운 Spark 세션이 그 코드를 실행한다.

세션은 테넌트의 파이프라인 실행 단위로 만든다. DAG가 시작할 때 `POST /sessions`로 세션을 하나 만들고 처리할 작업을 순서대로 statement로 보낸 뒤, 끝나면 세션을 삭제한다. 세션 하나가 Spark 애플리케이션 하나이므로 테넌트 실행마다 드라이버와 익스큐터가 새로 뜨고 끝나면 내려간다.

### 2.2 서비스의 세션 단위

서비스는 사용자 요청을 연속으로 처리하는 대화형 워크로드다. API 서버가 요청을 받으면 세션 관리 서비스가 사용자 전용 Livy 세션을 만들고 작업이 끝나거나 유휴 시간이 지나면 삭제한다.

처리 로직은 zip으로 묶어 HDFS에 올려 두고 세션 생성 요청의 `pyFiles`로 세션에 싣는다. API 서버가 statement로 보내는 코드는 모듈을 호출하는 몇 줄뿐이다.

```python
params = json.dumps({"column_name": column_name, "option": option})
code = "from service_jobs import run_task\nprint(run_task(sample_df, %s))" % params
send_request(f"{session_endpoint}/addcode", data={"code": code, "kind": "pyspark", "session_id": session_id})
```

`sample_df`는 데이터 로드 단계에서 세션에 만들어 둔 표본 DataFrame이다. 사용자가 여러 번 요청해도 같은 세션의 같은 DataFrame을 쓰고 결과는 statement 출력으로 돌아온다.

두 워크로드의 세션 단위를 함께 놓으면 다음과 같다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 240" role="img" aria-label="파이프라인은 테넌트 실행마다, 서비스는 사용자 작업마다 Livy가 별도 Spark 애플리케이션을 띄우고 끝나면 세션과 함께 내린다">
  <defs><marker id="tlv-2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <rect class="box" x="0" y="40" width="130" height="56" rx="4"/>
  <text class="t" x="14" y="62">Airflow DAG</text>
  <text class="s" x="14" y="79">작업 코드 생성</text>
  <rect class="box" x="0" y="150" width="130" height="56" rx="4"/>
  <text class="t" x="14" y="172">API 서비스</text>
  <text class="s" x="14" y="189">호출 코드 생성</text>
  <path class="wire" d="M130 178 H146" marker-end="url(#tlv-2-arrow)"/>
  <rect class="box" x="148" y="150" width="124" height="56" rx="4"/>
  <text class="t" x="160" y="172">세션 관리 서비스</text>
  <text class="s" x="160" y="189">사용자별 세션</text>
  <path class="wire" d="M130 68 H285 V121 H298" marker-end="url(#tlv-2-arrow)"/>
  <path class="wire" d="M272 178 H285 V125 H298" marker-end="url(#tlv-2-arrow)"/>
  <rect class="box" x="300" y="95" width="100" height="56" rx="4"/>
  <text class="t" x="314" y="117">Livy 서버</text>
  <text class="s" x="314" y="134">REST API</text>
  <text class="l" x="300" y="172">끝나면 세션 삭제</text>
  <path class="wire" d="M400 123 H415 V53 H428" marker-end="url(#tlv-2-arrow)"/>
  <path class="wire" d="M400 123 H415 V193 H428" marker-end="url(#tlv-2-arrow)"/>
  <rect class="accent" x="430" y="20" width="200" height="66" rx="4"/>
  <text class="t" x="444" y="42">테넌트 A 파이프라인 세션</text>
  <text class="s" x="444" y="59">Spark 앱 1개 · 실행마다 생성·종료</text>
  <text class="l" x="444" y="76">YARN 큐 tenant_a</text>
  <rect class="accent" x="430" y="160" width="200" height="66" rx="4"/>
  <text class="t" x="444" y="182">사용자 U 서비스 세션</text>
  <text class="s" x="444" y="199">Spark 앱 1개 · 작업 단위 생성·종료</text>
  <text class="l" x="444" y="216">pyFiles: HDFS 모듈 zip</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> 파이프라인은 테넌트 실행마다, 서비스는 사용자 작업마다 별도 Spark 애플리케이션이 뜨고 세션 삭제와 함께 내려간다.</figcaption>
</figure>

### 2.3 클러스터 매니저

클러스터 매니저는 YARN과 Standalone을 함께 쓴다. 어느 매니저로 가는지는 세션 요청이 아니라 Livy 서버 설정(`livy.spark.master`)이 정하고 YARN 쪽 세션은 `spark.yarn.queue`로 테넌트 큐를 지정한다. 같은 설정 키를 두 매니저가 다르게 읽는 지점은 [Spark Standalone과 YARN 클러스터 매니저 비교](/data/spark-standalone-vs-yarn/)에 정리했다.

### 2.4 세션 기동 비용

이 구조의 비용은 세션마다 드는 기동 시간이다. 세션을 만들면 드라이버 JVM 기동, SparkContext 초기화, 익스큐터 확보를 거쳐야 첫 statement를 받을 수 있고 YARN 큐가 차 있으면 더 기다린다. 파이프라인 실행이 짧을수록 전체 실행에서 기동이 차지하는 비중이 커지고 서비스에서는 첫 요청의 대기 시간이 된다. Spark Connect를 검토하게 된 출발점이 이 비용이었다.

---

## 3. 테넌트 분리 지점

### 3.1 세션 요청에 담기는 값

테넌트 분리는 세션 생성 요청 하나에 모여 있다. 요청의 `conf`에는 그 테넌트의 값만 들어가고 세션이 끝나면 함께 사라진다.

| 분리 축 | 세션 요청 필드 | 격리 범위 |
|---|---|---|
| 실행 계정 | `proxyUser` | 세션이 지정한 계정으로 실행된다 |
| 자원 | `spark.yarn.queue`, 익스큐터 수·메모리 | 테넌트 큐 한도 안에서만 자원을 받는다 |
| 카탈로그 | `spark.sql.catalog.tenant_a.*` (REST 카탈로그 URI, warehouse 버킷) | 세션 기본 카탈로그가 그 테넌트 카탈로그다 |
| 저장소 자격 | `fs.s3a.*`, 카탈로그 `s3.*` 속성 | 해당 세션의 드라이버·익스큐터 프로세스에만 존재한다 |
| 라이브러리 | `jars`, `pyFiles` | 세션마다 다르게 줄 수 있다 |

자격 증명은 세션을 만드는 시점에 외부 자격 저장소에서 테넌트 단위로 조회해 넣고 세션이 끝나면 반납한다. DAG 설정이나 코드에 값을 두지 않는다.

서비스에서는 데이터 로드 요청의 접근 권한을 먼저 확인하고 그 테넌트의 테이블만 세션에 읽어 들인다.

### 3.2 컴포넌트별 자격 전달 경로

세션 안에서도 S3 자격은 한 곳에 넣는다고 끝나지 않는다. Hadoop의 s3a 파일시스템은 `fs.s3a.*`를 읽지만 Iceberg의 S3FileIO는 Hadoop을 거치지 않는 자체 S3 클라이언트라 카탈로그 속성 `s3.access-key-id`·`s3.secret-access-key`를 읽는다. 엔드포인트가 AWS가 아닌 S3 호환 오브젝트 스토리지여도 같다. 둘 중 하나만 채우면 다른 쪽 컴포넌트가 403을 낸다. YARN에서 드라이버가 ApplicationMaster 안에서 돌면 환경 변수는 `spark.yarn.appMasterEnv.*`로 넘겨야 하고 Standalone에서는 드라이버에 환경 변수를 전달하는 경로가 없다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 190" role="img" aria-label="한 세션 요청의 S3 자격이 s3a, Iceberg S3FileIO, YARN 환경 변수 세 경로로 따로 전달된다">
  <defs><marker id="tlv-3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0,1 L10,5 L0,9 z"/></marker></defs>
  <rect class="box" x="0" y="58" width="170" height="74" rx="4"/>
  <text class="t" x="14" y="80">세션 생성 요청</text>
  <text class="s" x="14" y="97">conf: 테넌트 1개분</text>
  <text class="s" x="14" y="114">자격은 생성 시점에 주입</text>
  <path class="wire" d="M170 95 H235 V33 H298" marker-end="url(#tlv-3-arrow)"/>
  <path class="wire" d="M170 95 H298" marker-end="url(#tlv-3-arrow)"/>
  <path class="wire" d="M170 95 H235 V157 H298" marker-end="url(#tlv-3-arrow)"/>
  <rect class="box" x="300" y="8" width="330" height="50" rx="4"/>
  <text class="t" x="314" y="29">s3a (Hadoop FileSystem)</text>
  <text class="l" x="314" y="47">spark.hadoop.fs.s3a.access.key / .secret.key</text>
  <rect class="accent" x="300" y="70" width="330" height="50" rx="4"/>
  <text class="t" x="314" y="91">Iceberg S3FileIO (자체 S3 클라이언트)</text>
  <text class="l" x="314" y="109">spark.sql.catalog.tenant_a.s3.access-key-id</text>
  <rect class="box" x="300" y="132" width="330" height="50" rx="4"/>
  <text class="t" x="314" y="153">드라이버·AM 환경 변수 (YARN)</text>
  <text class="l" x="314" y="171">spark.yarn.appMasterEnv.AWS_ACCESS_KEY_ID</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 2.</b> 같은 세션 요청 안에서도 S3 자격은 컴포넌트마다 다른 키로 전달되고, 어느 하나도 다른 경로를 대신하지 않는다.</figcaption>
</figure>

세 경로가 모두 세션 요청 안에서 끝난다. 어떤 컴포넌트가 어떤 키로 서명하든 그 키는 이 세션의 프로세스에만 있고 다른 테넌트의 세션에서는 보이지 않는다.

---

## 4. Spark Connect 검토

### 4.1 검토 배경

Spark Connect는 미리 떠 있는 Spark 애플리케이션에 gRPC로 붙어 DataFrame 연산 계획을 보내는 방식이다. 세션 생성이 즉시 끝나고 클라이언트에 Spark 의존성이 필요 없다. 이미 조회 도구(메타데이터 조회 MCP, 대시보드) 백엔드로는 Connect 서버를 쓰고 있었다. 여러 호출자가 짧은 쿼리를 산발적으로 던지는 워크로드에서는 Livy처럼 호출자마다 세션을 잡는 모델이 맞지 않기 때문이다. 같은 서버를 파이프라인과 서비스의 실행 창구로도 쓸 수 있으면 2.4의 기동 비용이 사라진다.

### 4.2 PoC 결과

테넌트 세션을 Connect 서버에 붙여 보고 두 가지를 확인했다.

첫째, 자격 증명과 카탈로그를 세션 단위로 나눌 수 없었다. Iceberg 카탈로그 설정은 세션 runtime conf로 줄 수 있지만, `spark.hadoop.fs.s3a.*` 같은 Hadoop 설정과 추가 jar, 드라이버·익스큐터 메모리는 서버 기동 시 한 번 정해지고 모든 세션이 공유한다. 테넌트 둘을 붙이면 두 테넌트의 S3 키가 같은 드라이버 JVM과 같은 익스큐터 프로세스에 함께 올라간다. 세션 conf로 넣은 카탈로그 자격도 프로세스 경계가 없으니 격리라고 부를 수 없다. 같은 JVM에서 도는 다른 세션의 UDF가 그 값에 닿는 것을 Spark가 막지 않는다.

둘째, 드라이버 메모리가 경합했다. 한 테넌트의 큰 파이프라인 작업이 드라이버 heap을 쓰는 동안 같은 서버의 다른 세션 작업이 실패했다. Livy 구조에서는 그 테넌트의 세션 하나가 죽고 끝나는 일이, Connect 서버에서는 서버에 붙은 모든 테넌트의 문제가 된다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 240" role="img" aria-label="Livy는 테넌트마다 Spark 앱이 분리되지만 Connect 서버는 모든 테넌트 세션이 드라이버 JVM과 익스큐터를 공유한다">
  <rect class="soft" x="1" y="1" width="298" height="238" rx="4"/>
  <text class="t" x="14" y="24">Livy 세션 (현재)</text>
  <rect class="box" x="14" y="40" width="270" height="88" rx="4"/>
  <text class="s" x="28" y="58">Spark 앱 A (테넌트 A)</text>
  <rect class="accent" x="28" y="66" width="115" height="34" rx="3"/>
  <text class="s" x="85" y="88" text-anchor="middle">Driver A</text>
  <rect class="accent" x="155" y="66" width="115" height="34" rx="3"/>
  <text class="s" x="212" y="88" text-anchor="middle">Executor A</text>
  <text class="l" x="28" y="118">자격 A만 · heap 독립</text>
  <rect class="box" x="14" y="142" width="270" height="88" rx="4"/>
  <text class="s" x="28" y="160">Spark 앱 B (테넌트 B)</text>
  <rect class="accent" x="28" y="168" width="115" height="34" rx="3"/>
  <text class="s" x="85" y="190" text-anchor="middle">Driver B</text>
  <rect class="accent" x="155" y="168" width="115" height="34" rx="3"/>
  <text class="s" x="212" y="190" text-anchor="middle">Executor B</text>
  <text class="l" x="28" y="220">자격 B만 · heap 독립</text>
  <rect class="soft" x="331" y="1" width="298" height="238" rx="4"/>
  <text class="t" x="344" y="24">Spark Connect 서버 (PoC)</text>
  <rect class="box" x="344" y="40" width="272" height="190" rx="4"/>
  <text class="s" x="358" y="58">Spark 앱 1개 (상주)</text>
  <rect class="bad" x="358" y="66" width="244" height="60" rx="3"/>
  <text class="s" x="480" y="84" text-anchor="middle">Driver JVM 1개 · heap 공유</text>
  <rect class="box" x="366" y="94" width="110" height="26" rx="3"/>
  <text class="s" x="421" y="111" text-anchor="middle">세션 A · 자격 A</text>
  <rect class="box" x="486" y="94" width="110" height="26" rx="3"/>
  <text class="s" x="541" y="111" text-anchor="middle">세션 B · 자격 B</text>
  <rect class="bad" x="358" y="136" width="244" height="40" rx="3"/>
  <text class="s" x="480" y="160" text-anchor="middle">Executor 공유 · 자격 A·B 함께</text>
  <text class="l" x="358" y="198">fs.s3a.* · jar · 메모리: 기동 시 고정</text>
  <text class="l" x="358" y="216">A의 큰 작업 → B 세션 실패</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 3.</b> Livy는 테넌트마다 프로세스가 다르지만, Connect 서버는 모든 테넌트 세션이 드라이버 JVM과 익스큐터를 공유한다.</figcaption>
</figure>

테넌트마다 Connect 서버를 따로 두는 방법도 있지만 그러면 작업이 없는 시간에도 테넌트 수만큼 드라이버가 떠 있고 서버 수만큼 관리 대상이 늘어난다. 하루 몇 번 도는 배치에 상주 서버를 두는 것은 세션 기동 시간을 줄이려고 더 큰 비용을 내는 선택이었다. 서비스는 대화형이라 Connect의 세션 모델과 가깝지만 테넌트 단위로 데이터가 분리되어야 하는 요구가 같아서 같은 판단이 적용된다.

### 4.3 공유 서버 방식의 해법

공유 서버를 전제로 같은 문제를 푼 사례가 토스증권의 Spark Connect on Kubernetes 연재다. 한 쿼리의 실패가 서버를 죽이지 않게 `spark.executor.maxNumFailures` 같은 기본값을 다시 잡고, 테넌트별 서버 그룹과 replica로 SparkContext를 나누고, 부하 점수로 새 세션을 배치하는 Gateway와 서버를 교체·복구하는 Operator를 직접 만들었다.

이 해법이 여기에 그대로 오지 않는 이유는 테넌트의 뜻이 다르기 때문이다. 토스 글의 테넌트는 대화형 분석과 대용량 파이프라인처럼 워크로드 성격으로 나눈 자원 격리 단위이고 한 테넌트 안의 세션은 같은 드라이버의 같은 자격으로 저장소에 접근한다. 고객사 단위 자격 분리는 연재 2편까지 다루지 않았고 사용자 식별과 데이터 접근 제어는 3편으로 예고되어 있다. 고객사·사용자 단위로 프로세스를 나눠야 하는 요구는 세션이 곧 프로세스인 Livy 구조가 추가 구성 없이 충족한다.

- [Spark Connect on Kubernetes #1: 견고한 Spark Connect 만들기](https://toss.tech/article/spark-connect-on-kubernetes-1) — 공유 서버에서 서버를 죽이는 설정 기본값, replica, 부하 기반 Gateway
- [Spark Connect on Kubernetes #2: Operator로 만드는 Control Plane](https://toss.tech/article/spark-connect-on-kubernetes-2) — Tenant Operator, generation Blue-Green 교체, readiness·메모리 함정

---

## 5. 남은 문제와 방향

### 5.1 코드 문자열 전달

세션 모델은 유지하되 코드 전달 방식에는 문제가 남아 있다. 파이프라인은 각 단계의 PySpark 코드 전체가 f-string으로 조립된 문자열이라 단위 테스트가 어렵고 테이블명·경로 같은 외부 입력값이 코드 문자열에 그대로 섞인다. 입력값이 실행 코드가 되는 구조라 코드 인젝션을 막을 별도 장치가 필요하다.

단계 사이의 데이터도 Spark 세션의 전역 변수로 넘어간다. 앞 단계 코드가 만든 DataFrame을 뒤 단계가 같은 변수명으로 읽는 방식이라 DAG 정의만 봐서는 의존 관계가 보이지 않는다.

서비스는 처리 로직이 모듈 zip에 있고 statement에는 호출 코드만 들어가므로 이 문제가 작다.

### 5.2 패키지 배포와 호출 분리

파이프라인의 개선 방향은 서비스와 같은 형태다. 처리 로직을 Python 패키지로 만들어 세션 생성 시 `pyFiles`로 올리고 각 단계는 함수 호출 한 줄만 statement로 보낸다.

<div class="tlv tlv-tabs" id="tlv-5-code">
  <div class="tlv-panel" data-label="변경 전 · 코드 문자열"><div class="tlv-panel-title">변경 전 · 코드 문자열</div><div class="language-python highlighter-rouge"><div class="highlight"><pre class="highlight"><code>code = f"""
df = spark.read.parquet("{landing_path}")
df.createOrReplaceTempView("src")
spark.sql("MERGE INTO {catalog}.{schema}.{table} t USING src s ON t.id = s.id ...")
"""
requests.post(f"{livy}/sessions/{session_id}/statements", json={"code": code})</code></pre></div></div></div>
  <div class="tlv-panel" data-label="변경 후 · 패키지 호출"><div class="tlv-panel-title">변경 후 · 패키지 호출</div><div class="language-python highlighter-rouge"><div class="highlight"><pre class="highlight"><code># 세션 생성 요청: "pyFiles": ["hdfs:///deploy/etl_steps.zip"]
params = {"landing_path": landing_path, "catalog": catalog, "table": table}
code = "from etl_steps import run_step\nrun_step('data_save', %s)" % json.dumps(params)
requests.post(f"{livy}/sessions/{session_id}/statements", json={"code": code})</code></pre></div></div></div>
</div>

입력값은 코드가 아니라 JSON 인자로 넘어가고 단계 간 상태는 전역 변수 대신 함수 인자와 반환값으로 드러난다. 패키지는 로컬에서 단위 테스트할 수 있다. 실패한 단계만 다시 실행해야 하는 요구가 생기면 Livy batch나 Kubernetes Spark Operator로 단계마다 애플리케이션을 띄우는 방식을 검토하고, 테넌트 수가 더 늘면 사용자·그룹 단위로 엔진을 띄우고 유휴 시 내리는 Apache Kyuubi를 비교 대상에 둔다.

### 5.3 Livy 프로젝트 상태

Livy는 2020년 2월 0.7.0 이후 3년 8개월 동안 릴리스가 없었고 2021년에는 커밋이 없었다. 2026년 2월 0.9.0-incubating(Kubernetes 제출, Spark 3.5.6, Java 17 지원)이 나왔고 2026년 6월 4일 Apache 최상위 프로젝트로 졸업했다. 졸업은 커뮤니티 거버넌스에 대한 인증이지 개발 속도의 보증이 아니므로, 첫 TLP 릴리스와 Spark 4.x 지원이 실제로 나오는지를 보고 판단한다. Spark 4로 올릴 계획이 Livy의 지원보다 먼저 오면 그때는 실행 창구를 다시 검토해야 한다.

---

## 6. 정리

- 파이프라인은 테넌트 실행마다, 서비스는 사용자 작업마다 Livy 세션(= Spark 애플리케이션)을 만들고 끝나면 삭제한다. 테넌트 자격·카탈로그·큐는 세션 요청 안에서만 존재한다.
- S3 자격은 s3a와 Iceberg S3FileIO가 다른 키를 읽으므로 세션 요청에 두 경로를 모두 채운다.
- Spark Connect PoC에서는 Hadoop 설정·jar·메모리가 서버 기동 시 고정되어 테넌트 자격이 한 JVM에 모였고 한 테넌트의 작업이 드라이버 메모리를 쓰는 동안 다른 세션이 실패했다. 고객사 단위 분리가 요구인 워크로드에는 쓰지 않는다.
- Connect 서버는 여러 호출자가 짧은 쿼리를 보내는 조회 도구 백엔드로만 쓴다.
- 남은 문제는 세션 모델이 아니라 코드 문자열 전달이다. 서비스처럼 처리 로직을 pyFiles 패키지로 올리고 statement는 호출 한 줄만 보내는 방식으로 바꾼다.

---

## 7. 참고 자료

- [Apache Spark 3.5 - Spark Connect Overview](https://spark.apache.org/docs/3.5.7/spark-connect-overview.html)
- [Apache Spark 3.5 - SparkSession Runtime Configuration](https://spark.apache.org/docs/3.5.6/api/python/reference/pyspark.sql/api/pyspark.sql.SparkSession.conf.html)
- [Apache Livy - Release History](https://livy.apache.org/history/)
- [Apache Software Foundation - Apache Livy Top-Level Project 발표](https://news.apache.org/foundation/entry/the-apache-software-foundation-announces-new-top-level-project-4)

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
