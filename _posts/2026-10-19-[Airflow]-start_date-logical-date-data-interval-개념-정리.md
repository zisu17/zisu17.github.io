---
title: "[Airflow] start_date, logical date, data interval 개념 정리"
excerpt: "Airflow 스케줄링의 DAG Run, schedule, data interval, logical date, start_date 관계와 catchup·timetable에 따라 첫 실행 시각이 달라지는 조건을 정리한다."
nav_section: data
nav_topic: pipelines

categories:
  - Data
tags:
  - Data
  - Airflow
  - 스케줄링
  - Data Interval
  - 데이터파이프라인

permalink: /data/airflow-start-date-logical-date-data-interval/

toc: true
toc_sticky: true

date: 2026-10-19
last_modified_at: 2026-10-19
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

Airflow DAG을 처음 만들면 실행 시각이 예상과 다르게 나오는 경우가 많다. 매일 12시에 돌도록 `schedule="0 12 * * *"`을 걸었는데 첫 실행은 하루 뒤에 일어나고, 10월 3일에 실행된 DAG Run의 `ds` 값은 10월 2일이다. 매시 정각 스케줄을 5시 34분에 등록했더니 6시가 아니라 7시에 처음 실행되거나, 반대로 등록하자마자 4시~5시 구간이 바로 실행되기도 한다.

이런 차이는 Airflow가 실행 시각이 아니라 처리할 데이터 구간을 기준으로 스케줄을 계산하기 때문에 생긴다. 이 글에서는 다음 개념을 순서대로 정리한다.

- DAG Run과 schedule
- data interval
- logical date
- start_date와 첫 실행 시각
- catchup, 수동 실행, timetable 종류에 따른 차이
- 시간대

본문은 Airflow 2.4~2.10 기준으로 설명하고, Airflow 3.x에서 달라진 부분은 8장에 따로 모았다.

---

## 2. DAG Run과 schedule

### 2.1 DAG Run

DAG은 작업과 의존 관계를 정의한 것이고, DAG Run은 그 정의가 한 번 실행된 인스턴스다. 같은 DAG이라도 처리하는 시점마다 별도의 DAG Run이 생기고 Task Instance, XCom, 로그가 모두 DAG Run 단위로 나뉜다.

DAG Run은 생성 방식에 따라 `run_type`이 다르다.

| run_type | 생성 주체 | 예 |
|---|---|---|
| `scheduled` | 스케줄러가 schedule에 따라 생성 | 매일 12시 실행 |
| `manual` | UI·CLI·REST API에서 직접 트리거 | Trigger DAG 버튼 |
| `backfill` | backfill 명령 | 과거 구간 재처리 |
| `dataset_triggered` | Dataset 갱신 이벤트 | 상위 DAG 적재 완료 후 실행 |

이 글에서 다루는 data interval 계산은 주로 `scheduled` DAG Run에 해당한다. 수동 실행은 7장에서 따로 설명한다.

### 2.2 schedule 표기

schedule은 DAG Run을 언제 만들지 정한다. Airflow 2.4부터 `schedule_interval`과 `timetable` 파라미터가 `schedule` 하나로 통합됐고, 기존 `schedule_interval`은 2.x에서 deprecated 경고와 함께 계속 동작한다.

| 표기 | 예 | 내부 timetable |
|---|---|---|
| cron 문자열 | `"0 12 * * *"` | `CronDataIntervalTimetable` |
| preset | `"@daily"`, `"@hourly"` | `CronDataIntervalTimetable` |
| timedelta | `timedelta(hours=1)` | `DeltaDataIntervalTimetable` |
| None | `None` | `NullTimetable` (스케줄 없음) |
| `"@once"` | `"@once"` | `OnceTimetable` |
| Timetable 객체 | `CronTriggerTimetable("0 12 * * *", timezone="Asia/Seoul")` | 지정한 클래스 |
| Dataset 목록 | `[Dataset("s3://bucket/orders")]` | `DatasetTriggeredTimetable` |

cron 문자열과 timedelta를 쓰면 2.x에서는 모두 이름에 `DataInterval`이 붙은 timetable로 변환된다. 이 두 timetable이 data interval 방식으로 DAG Run을 만든다.

```python
from datetime import timedelta

import pendulum
from airflow import DAG

with DAG(
    dag_id="daily_sales_summary",
    start_date=pendulum.datetime(2026, 10, 1, tz="UTC"),
    schedule="0 12 * * *",
    catchup=False,
):
    ...
```

---

## 3. Data Interval

data interval은 DAG Run 하나가 처리하는 데이터의 시간 범위다. `data_interval_start`부터 `data_interval_end` 직전까지의 반열린 구간이고, 스케줄된 DAG Run은 **이 구간이 끝난 뒤에** 실행된다.

`schedule="0 12 * * *"`이면 구간은 12시부터 다음 날 12시까지다. 10월 2일 12시~10월 3일 12시 구간의 데이터는 10월 3일 12시가 지나야 모두 쌓이므로 그 시각에 DAG Run이 실행된다. 일 단위 집계라면 하루치 데이터가 모두 들어온 뒤에 집계하는 것이 자연스럽고, Airflow는 이 순서를 스케줄 계산에 그대로 반영했다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 170" role="img" aria-label="각 DAG Run은 자기 data interval이 끝나는 시각에 실행된다">
  <rect class="box" x="42" y="30" width="176" height="44" rx="4"/>
  <text class="t" x="54" y="50">Run 1 처리 구간</text>
  <text class="l" x="54" y="66">logical 10-01 12:00</text>
  <rect class="accent" x="222" y="30" width="176" height="44" rx="4"/>
  <text class="t" x="234" y="50">Run 2 처리 구간</text>
  <text class="l" x="234" y="66">logical 10-02 12:00</text>
  <rect class="box" x="402" y="30" width="176" height="44" rx="4"/>
  <text class="t" x="414" y="50">Run 3 처리 구간</text>
  <text class="l" x="414" y="66">logical 10-03 12:00</text>
  <path class="wire" d="M20 100 H620"/>
  <path class="wire" d="M40 94 V106 M220 94 V106 M400 94 V106 M580 94 V106"/>
  <text class="l" x="40" y="124" text-anchor="middle">10-01 12:00</text>
  <text class="l" x="220" y="124" text-anchor="middle">10-02 12:00</text>
  <text class="l" x="400" y="124" text-anchor="middle">10-03 12:00</text>
  <text class="l" x="580" y="124" text-anchor="middle">10-04 12:00</text>
  <text class="s" x="40" y="148" text-anchor="middle">start_date</text>
  <text class="s" x="220" y="148" text-anchor="middle">Run 1 실행</text>
  <text class="s c-accent" x="400" y="148" text-anchor="middle">Run 2 실행</text>
  <text class="s" x="580" y="148" text-anchor="middle">Run 3 실행</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 1.</b> 매일 12시 스케줄에서 각 DAG Run은 자기 처리 구간이 끝나는 시각에 실행되고, logical date는 구간의 시작 시각이다.</figcaption>
</figure>

그래서 data interval은 날짜보다 데이터 범위로 이해하는 편이 정확하다. DAG Run은 "10월 3일에 실행된 작업"이라기보다 "10월 2일 12시~10월 3일 12시 데이터를 처리하는 작업"이다. 같은 구간을 다시 실행해도 같은 범위를 처리하므로 재실행과 backfill 결과가 실행 시점에 따라 달라지지 않는다.

작업 코드에서는 실행 시각(`datetime.now()`) 대신 data interval 경계로 조회 범위를 잡는다.

{% raw %}
```sql
SELECT order_id, amount
FROM sales.orders
WHERE created_at >= '{{ data_interval_start }}'
  AND created_at <  '{{ data_interval_end }}';
```
{% endraw %}

이렇게 쓰면 스케줄러 지연으로 DAG Run이 몇 분 늦게 시작되거나 며칠 뒤에 재실행해도 조회 범위가 바뀌지 않는다.

---

## 4. Logical Date

### 4.1 logical date와 data interval의 관계

logical date는 DAG Run을 식별하는 기준 시각이다. data interval 방식 timetable에서는 `data_interval_start`와 같은 값이다. 그림 1의 Run 2는 10월 3일 12시에 실행되지만 logical date는 10월 2일 12시다.

Airflow 2.2 이전에는 같은 값을 `execution_date`라고 불렀다. 이름 때문에 실행 시각으로 오해하는 경우가 많아 2.2에서 `logical_date`로 바꾸고 data interval 개념을 함께 도입했다. 2.x에서는 `execution_date`도 deprecated 상태로 남아 있다.

logical date는 DAG Run의 식별자 역할도 한다. 하나의 DAG 안에서 같은 logical date를 가진 DAG Run은 하나만 존재할 수 있고, 기본 `run_id`도 `scheduled__2026-10-02T12:00:00+00:00`처럼 logical date로 만들어진다.

### 4.2 템플릿 변수

그림 1의 Run 2에서 작업이 받는 주요 템플릿 변수는 다음과 같다.

| 변수 | 값 | 설명 |
|---|---|---|
| `logical_date` | `2026-10-02 12:00:00+00:00` | 구간 시작 시각 |
| `data_interval_start` | `2026-10-02 12:00:00+00:00` | 구간 시작 시각 |
| `data_interval_end` | `2026-10-03 12:00:00+00:00` | 구간 끝 시각 |
| `ds` | `2026-10-02` | logical date의 날짜 |
| `ds_nodash` | `20261002` | logical date의 날짜(구분자 없음) |
| `prev_data_interval_start_success` | 직전 성공 DAG Run의 구간 시작 | 첫 실행이면 `None` |
| `dag_run.start_date` | `2026-10-03 12:00` 이후 | DAG Run이 실제로 시작된 시각 |

`ds`가 실행일보다 하루 이른 날짜로 나오는 것은 이 관계 때문이다. 일 단위 파티션을 `ds`로 지정하면 처리 대상 날짜의 파티션에 정확히 기록된다. 반대로 실행일 기준 경로가 필요하면 `data_interval_end`를 쓴다.

`dag_run.start_date`는 DAG의 `start_date` 인자와 이름만 같고 의미가 다르다. 앞의 것은 DAG Run이 실제로 시작된 시각, 뒤의 것은 다음 장에서 설명할 스케줄 계산의 기준점이다.

---

## 5. start_date

### 5.1 첫 번째 data interval의 시작점

`start_date`는 DAG이 처음 실행되는 시각이 아니라 **첫 번째 data interval이 시작될 수 있는 가장 이른 시각**이다. 첫 구간이 끝나야 첫 DAG Run이 실행되므로 실제 첫 실행 시각은 start_date와 schedule을 함께 봐야 계산된다.

`start_date=2026-10-01 12:00`, `schedule="0 12 * * *"`이면 첫 구간은 10월 1일 12시~10월 2일 12시이고 첫 실행은 10월 2일 12시다. start_date에서 한 구간을 온전히 지나야 첫 DAG Run이 생긴다.

### 5.2 cron과 timedelta의 정렬 차이

start_date가 schedule 경계와 맞지 않을 때 두 timetable은 다르게 동작한다.

- `CronDataIntervalTimetable`은 start_date 이후의 첫 cron 시각으로 구간 시작을 맞춘다. start_date가 cron 시각과 정확히 같으면 그 시각부터 시작한다.
- `DeltaDataIntervalTimetable`은 정렬 없이 start_date부터 timedelta만큼 구간을 자른다.

start_date를 10월 1일 05:34로 두고 1시간 주기를 걸면 차이가 바로 드러난다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 160" role="img" aria-label="cron 스케줄은 start_date 다음 정각부터, timedelta 스케줄은 start_date부터 첫 구간을 시작한다">
  <text class="t" x="0" y="34">cron</text>
  <text class="l" x="0" y="50">0 * * * *</text>
  <rect class="accent" x="272" y="20" width="156" height="36" rx="4"/>
  <text class="s" x="282" y="43">첫 구간, 07:00 실행</text>
  <text class="t" x="0" y="84">timedelta</text>
  <text class="l" x="0" y="100">hours=1</text>
  <rect class="accent" x="203" y="70" width="156" height="36" rx="4"/>
  <text class="s" x="213" y="93">첫 구간, 06:34 실행</text>
  <path class="wire dash" d="M201 12 V124"/>
  <path class="wire" d="M110 130 H620"/>
  <path class="wire" d="M110 124 V136 M270 124 V136 M430 124 V136 M590 124 V136"/>
  <text class="l" x="110" y="152" text-anchor="middle">05:00</text>
  <text class="l c-accent" x="201" y="152" text-anchor="middle">05:34</text>
  <text class="l" x="270" y="152" text-anchor="middle">06:00</text>
  <text class="l" x="430" y="152" text-anchor="middle">07:00</text>
  <text class="l" x="590" y="152" text-anchor="middle">08:00</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 2.</b> start_date가 05:34일 때 cron 스케줄의 첫 구간은 06:00에 시작하고 timedelta 스케줄의 첫 구간은 05:34에 시작한다.</figcaption>
</figure>

cron 스케줄은 첫 구간이 06:00에 시작하므로 첫 실행이 07:00까지 밀린다. timedelta 스케줄은 이후 실행도 06:34, 07:34처럼 34분에 고정된다. 정각 실행이 필요하면 cron을 쓰고, start_date도 정각으로 맞추는 것이 계산하기 쉽다.

### 5.3 start_date를 고정값으로 두는 이유

start_date에 `datetime.now()`처럼 DAG 파일을 파싱할 때마다 바뀌는 값을 넣으면 안 된다. 스케줄러는 DAG 파일을 주기적으로 다시 파싱하는데, 파싱할 때마다 start_date가 현재 시각으로 밀리면 첫 구간이 계속 미래에 있게 되어 DAG Run이 생기지 않거나 예상과 다른 시각에 생긴다.

서비스에서 사용자가 스케줄을 등록할 때 DAG 파일을 생성하는 구조라면, 등록 시각을 계산해 DAG 파일에 **리터럴 값으로 기록**한다. 파일 안에서 `now()`를 호출하지 않는다.

---

## 6. catchup과 첫 실행 시각

### 6.1 catchup

`catchup`은 start_date부터 현재까지 실행되지 않은 구간을 모두 채울지 정한다.

- `catchup=True`: start_date 이후 완료된 모든 구간에 대해 DAG Run을 만든다. start_date가 30일 전인 일 단위 DAG을 활성화하면 DAG Run 30개가 한꺼번에 생긴다(`max_active_runs`만큼씩 실행).
- `catchup=False`: 가장 최근에 완료된 구간 하나만 실행하고 그 이전 구간은 건너뛴다.

`catchup=False`에서 놓치기 쉬운 부분은 "가장 최근에 완료된 구간 하나"가 **활성화 직후 바로 실행**된다는 점이다. start_date가 과거인 매시 정각 DAG을 05:34에 활성화하면 04:00~05:00 구간이 05:34에 즉시 실행되고, 이어서 06:00에 05:00~06:00 구간이 실행된다. 2.x 기본값은 `catchup=True`이고 `[scheduler] catchup_by_default`로 바꿀 수 있다.

### 6.2 05:34에 매시 정각 스케줄을 등록한 경우

서비스에서 05:34에 매시 정각(`0 * * * *`) 스케줄을 등록하고, 첫 실행은 06:00이기를 기대하는 상황을 보면 설정에 따라 결과가 셋으로 나뉜다.

<figure class="tlv">
<div class="tlv-scroll" style="--tlv-min:560px">
<svg class="tlv-svg" viewBox="0 0 630 210" role="img" aria-label="같은 매시 정각 스케줄이라도 start_date와 timetable에 따라 첫 실행이 05:34, 07:00, 06:00으로 달라진다">
  <text class="t" x="0" y="37">과거 start_date</text>
  <text class="l" x="0" y="53">catchup=False</text>
  <path class="wire dash" d="M150 34 H610"/>
  <circle class="bad" cx="330" cy="34" r="6"/>
  <text class="l" x="330" y="56" text-anchor="middle">04~05</text>
  <circle class="box" cx="380" cy="34" r="6"/>
  <text class="l" x="380" y="56" text-anchor="middle">05~06</text>
  <circle class="box" cx="495" cy="34" r="6"/>
  <text class="l" x="495" y="56" text-anchor="middle">06~07</text>
  <text class="t" x="0" y="87">start_date 05:34</text>
  <text class="l" x="0" y="103">CronDataInterval</text>
  <path class="wire dash" d="M150 84 H610"/>
  <circle class="bad" cx="495" cy="84" r="6"/>
  <text class="l" x="495" y="106" text-anchor="middle">06~07</text>
  <circle class="box" cx="610" cy="84" r="6"/>
  <text class="l" x="610" y="106" text-anchor="middle">07~08</text>
  <text class="t" x="0" y="137">start_date 05:34</text>
  <text class="l" x="0" y="153">CronTrigger</text>
  <path class="wire dash" d="M150 134 H610"/>
  <circle class="good" cx="380" cy="134" r="6"/>
  <text class="l" x="380" y="156" text-anchor="middle">06:00</text>
  <circle class="box" cx="495" cy="134" r="6"/>
  <text class="l" x="495" y="156" text-anchor="middle">07:00</text>
  <circle class="box" cx="610" cy="134" r="6"/>
  <text class="l" x="610" y="156" text-anchor="middle">08:00</text>
  <path class="wire" d="M150 176 H620"/>
  <path class="wire" d="M150 170 V182 M265 170 V182 M380 170 V182 M495 170 V182 M610 170 V182"/>
  <text class="l" x="150" y="200" text-anchor="middle">04:00</text>
  <text class="l" x="265" y="200" text-anchor="middle">05:00</text>
  <text class="l c-accent" x="330" y="200" text-anchor="middle">05:34</text>
  <text class="l" x="380" y="200" text-anchor="middle">06:00</text>
  <text class="l" x="495" y="200" text-anchor="middle">07:00</text>
  <text class="l" x="610" y="200" text-anchor="middle">08:00</text>
</svg>
</div>
<figcaption class="tlv-cap"><b>그림 3.</b> 05:34에 등록한 매시 정각 스케줄의 실행 시점과 처리 구간(점 아래 라벨)이며, 첫 실행은 설정에 따라 05:34, 07:00, 06:00으로 달라진다.</figcaption>
</figure>

1. start_date가 과거, catchup=False: 가장 최근에 완료된 04:00~05:00 구간이 등록 직후 바로 실행된다.
2. start_date를 등록 시각(05:34)으로, cron data interval: 5.2의 정렬 규칙으로 첫 구간이 06:00~07:00이 되어 07:00에 처음 실행된다.
3. start_date를 등록 시각으로, `CronTriggerTimetable`: cron 시각에 바로 실행되므로 06:00에 처음 실행된다.

06:00 첫 실행을 원하면 두 가지 방법이 있다.

- 처리 구간 개념이 필요 없는 작업(리프레시, 알림, 외부 API 호출)이면 `CronTriggerTimetable`을 쓰고 start_date에 등록 시각을 넣는다.
- data interval 기반으로 유지하려면 start_date를 등록 시각이 속한 정각(05:00)으로 내림한다. 첫 구간이 05:00~06:00이 되어 06:00에 실행된다. 이 경우 첫 DAG Run은 05:00~06:00 데이터를 처리한다는 점을 함께 고려한다.

```python
import pendulum
from airflow import DAG
from airflow.timetables.trigger import CronTriggerTimetable

# 등록 시각 05:34 → DAG 파일 생성 시 리터럴로 기록
with DAG(
    dag_id="refresh_sales_summary",
    start_date=pendulum.datetime(2026, 10, 19, 5, 34, tz="Asia/Seoul"),
    schedule=CronTriggerTimetable("0 * * * *", timezone="Asia/Seoul"),
    catchup=False,
):
    ...
```

---

## 7. 수동 실행과 외부 트리거

UI의 Trigger DAG 버튼이나 REST API로 실행한 DAG Run은 schedule과 관계없이 즉시 실행된다. 2.x에서 수동 DAG Run의 logical date는 트리거한 시각이고, data interval은 timetable의 `infer_manual_data_interval`이 트리거 시각을 기준으로 추정한다. `CronDataIntervalTimetable`은 트리거 시각 직전에 완료된 구간을 data interval로 넣는다.

같은 logical date를 가진 DAG Run은 하나만 존재할 수 있으므로, 이미 스케줄로 실행된 logical date를 지정해 수동 트리거하면 충돌로 실패한다. 특정 구간을 다시 처리하려면 해당 DAG Run을 Clear하거나 backfill을 쓴다.

수동 실행에서도 작업 코드가 `data_interval_start`/`data_interval_end`로 범위를 잡고 있다면 처리 범위는 timetable이 추정한 구간이 된다. 수동 실행 때만 다른 범위를 처리해야 하면 `params`나 `dag_run.conf`로 범위를 넘겨 받는 방식이 명확하다.

---

## 8. Airflow 3.x에서 달라진 부분

Airflow 3.0에서 스케줄링 기본값과 일부 파라미터가 바뀌었다.

| 항목 | 2.x | 3.x |
|---|---|---|
| 스케줄 파라미터 | `schedule` (`schedule_interval` deprecated) | `schedule`만 사용 (`schedule_interval`, `timetable` 제거) |
| `execution_date` | deprecated, 사용 가능 | 제거, `logical_date` 사용 |
| cron 문자열 기본 timetable | `CronDataIntervalTimetable` | `CronTriggerTimetable` |
| `catchup` 기본값 | `True` | `False` |
| 수동 실행 logical date | 트리거 시각 | 지정하지 않으면 비어 있을 수 있음 |

가장 영향이 큰 변경은 cron 문자열의 기본 timetable이다. 3.x에서는 `[scheduler] create_cron_data_intervals` 기본값이 `False`라서 `schedule="0 12 * * *"`이 `CronTriggerTimetable`로 해석된다. 이때 DAG Run은 cron 시각에 바로 실행되고 logical date도 실행 시각이 된다. 2.x에서 만든 DAG을 3.x로 옮기면 같은 cron 문자열이라도 `ds`가 하루 뒤로 바뀌므로, 날짜 파티션을 `ds`로 지정한 작업은 결과 경로가 달라진다. 2.x 방식이 필요하면 설정값을 `True`로 두거나 `CronDataIntervalTimetable`을 명시한다.

---

## 9. 시간대

Airflow는 DAG Run의 시각을 UTC로 저장하고, 템플릿 변수도 UTC 기준의 timezone-aware 값으로 넘긴다. 시간대와 관련해 다음을 확인한다.

- start_date에 시간대 없는 `datetime`을 넣으면 `[core] default_timezone`(기본 `utc`)으로 해석된다.
- cron 식은 DAG의 시간대로 계산된다. DAG의 시간대는 start_date의 시간대를 따르므로 `pendulum.datetime(..., tz="Asia/Seoul")`로 지정하면 `"0 9 * * *"`이 한국 시각 09시가 된다.
- 템플릿 변수를 한국 시각 문자열로 쓰려면 변환이 필요하다. Python 코드에서는 `airflow.utils.timezone.make_naive(value, timezone)`로 지정 시간대 기준의 naive datetime을 만들 수 있다.

```python
import pendulum
from airflow.utils.timezone import make_naive

KST = pendulum.timezone("Asia/Seoul")

def load(data_interval_start, data_interval_end, **_):
    start = make_naive(data_interval_start, KST)  # 2026-10-19 05:00:00 (tzinfo 없음)
    end = make_naive(data_interval_end, KST)
    ...
```

매시 정각 스케줄은 UTC와 KST의 차이가 정수 시간이라 영향이 없지만, 일 단위 이상 스케줄에서 시간대를 지정하지 않으면 실행 시각과 `ds`가 9시간 어긋난다.

---

## 10. 정리

- DAG Run은 data interval 하나를 처리하는 실행 단위이고, data interval 방식 timetable에서는 구간이 끝난 뒤에 실행된다.
- logical date는 구간의 시작 시각이라 실행 시각보다 한 주기 이르다. `ds`가 실행일 전날로 나오는 이유다.
- start_date는 첫 구간이 시작될 수 있는 가장 이른 시각이다. cron 스케줄은 다음 cron 시각으로 맞춰서, timedelta 스케줄은 start_date 그대로 구간을 시작한다.
- `catchup=False`는 가장 최근 완료 구간을 활성화 직후 실행한다. 05:34에 등록한 매시 정각 스케줄을 06:00에 처음 실행하려면 `CronTriggerTimetable`을 쓰거나 start_date를 05:00으로 내린다.
- Airflow 3.x에서는 cron 문자열의 기본 timetable이 `CronTriggerTimetable`로 바뀌어 logical date가 실행 시각과 같아진다.

---

## 11. 참고 자료

- [Apache Airflow - DAG Runs](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dag-run.html)
- [Apache Airflow - Timetables](https://airflow.apache.org/docs/apache-airflow/stable/authoring-and-scheduling/timetable.html)
- [Apache Airflow - Upgrading to Airflow 3](https://airflow.apache.org/docs/apache-airflow/stable/installation/upgrading_to_airflow3.html)
- [Apache Airflow - FAQ](https://airflow.apache.org/docs/apache-airflow/stable/faq.html)
