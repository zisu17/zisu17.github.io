---
title: "[Spark] Standalone Executor 메모리 부족 및 Spill 분석"
excerpt: "Spark standalone 집계 잡에서 반복되던 Spill과 Executor OOM을 History Server 지표로 추적하고, Executor 메모리와 memory.fraction 조정 전후를 비교한다."

categories:
  - Data Engineering
tags:
  - Data
  - Spark
  - Standalone
  - Livy
  - Spill

permalink: /data/spark-standalone-executor-memory-spill/

toc: true
toc_sticky: true

date: 2026-09-28
last_modified_at: 2026-10-01
---

## 1. 문제 상황

가공용 Spark standalone 클러스터의 일일 집계 잡에서 실행할 때마다 9GB 안팎의 디스크 Spill이 발생했다. 전체 실행 시간은 약 11분이었다.

클러스터는 워커 10대, 노드당 16코어와 메모리 30GB로 구성되어 있고 Livy 세션을 통해 잡을 제출한다. 해당 작업은 이하 `exam_progress_agg`로 표기한다. 테이블명과 잡 이름은 모두 예시 값이다.

문제는 Spill만이 아니었다. 어느 실행에서는 익스큐터 하나가 `exit 137`로 종료됐고, 이후 해당 익스큐터가 가지고 있던 셔플 블록을 읽지 못하면서 `FetchFailed`가 발생했다. 태스크 재시도와 스테이지 재실행도 이어졌다.

Spark standalone에서도 external shuffle service를 사용할 수 있지만, 이 클러스터에는 별도로 구성되어 있지 않았다. 따라서 익스큐터가 종료되면 그 프로세스가 보유하던 셔플 파일도 함께 사용할 수 없게 되는 구조였다.

분석에는 Spark History Server REST API에서 확인할 수 있는 익스큐터 메모리 지표와 스테이지별 Spill, 태스크 분위수를 사용했다.

```text
/api/v1/applications/{app}/allexecutors
/api/v1/applications/{app}/stages?status=complete
/api/v1/applications/{app}/stages/{id}/0/taskSummary?quantiles=0.5,0.9,1.0
```

---

## 2. 익스큐터 메모리 구조 확인

Spark 3.x의 기본 Unified Memory Manager에서는 익스큐터 힙 중 일부를 실행 메모리와 스토리지 메모리가 공유한다.

```text
힙            = spark.executor.memory
예약 영역     = 300MiB
통합 메모리 M = (힙 − 300MiB) × spark.memory.fraction
나머지 영역   = 힙 − 예약 영역 − M
```

`spark.memory.fraction`의 기본값은 0.6이다. 통합 메모리 M은 셔플, 정렬, 집계 같은 실행 작업과 캐시가 함께 사용한다. 나머지 영역은 사용자 데이터 구조, Spark 내부 메타데이터, 크기 추정 오차 등에 필요한 힙 여유로 남는다.

여기서 나머지 영역을 별도의 고정된 "사용자 메모리 파티션"처럼 보는 것은 정확하지 않다. JVM 힙 자체는 하나이고, `memory.fraction`은 Spark가 직접 관리하는 통합 메모리의 크기를 정하는 값에 가깝다.

실행 연산자가 Spark의 관리 메모리를 더 확보하지 못하면 정렬이나 집계 데이터 일부를 디스크로 Spill할 수 있다. JVM OOM은 Spark 관리 영역 밖의 객체나 직렬화 버퍼, 큰 레코드, Spill로 해소되지 않는 할당 등 여러 경로에서 발생한다. Spill과 OOM이 함께 나타나더라도 원인이 항상 같지는 않다.

실행 메모리 역시 `통합 풀 ÷ executor core 수`로 고정 배분되지는 않는다. Spark는 동시에 활성화된 태스크 사이에서 실행 메모리를 조정한다. 활성 태스크가 4개인 시점에는 태스크당 사용할 수 있는 몫이 대략 통합 풀의 1/4 수준까지 내려가지만, 태스크 수가 줄면 한 태스크가 더 많은 메모리를 사용할 수 있다.

### 2.1 당시 설정과 지표

문제 당시 세션 설정은 익스큐터 8g, 코어 4개, `spark.memory.fraction=0.80`이었다.

```text
가용        = 8,192MiB − 300MiB      = 7,892MiB
통합 풀     = 7,892MiB × 0.80        = 6,314MiB ≈ 6.1GiB
나머지 영역 = 7,892MiB × 0.20        = 1,578MiB ≈ 1.5GiB

활성 태스크가 4개인 경우
태스크당 실행 메모리 몫 ≈ 6,314MiB ÷ 4 ≈ 1.5GiB
```

REST API의 `maxMemory`도 약 6.2GB로 계산값과 비슷했다.

Spill이 컸던 스테이지를 보면 다음과 같았다.

| 스테이지 | 태스크 | 태스크당 셔플 입력 | 태스크당 Peak Execution Memory | 관찰 결과 |
|---|---|---|---|---|
| 39 | 128 | 221MB | 1.8GB | 대부분의 태스크에서 약 0.9GB씩 Spill |
| 11 | 2 | 입력 51MB → 셔플 쓰기 2.8GB | 3.2GB | 2개 태스크에 작업이 집중되며 Spill 발생 |

스테이지 39에서 약 7.5GB, 스테이지 11과 63에서 약 1.5GB가 발생해 전체 디스크 Spill은 약 9GB였다.

태스크당 1.5GB는 전체 스테이지에 적용되는 고정 상한이 아니므로 `Peak Execution Memory 1.8GB > 1.5GB`만으로 Spill을 설명할 수는 없다. 다만 4개 태스크가 동시에 실행되는 구간이 많았고, 거의 모든 태스크에서 비슷한 크기의 Spill이 반복됐다. 특정 데이터 skew보다는 익스큐터 실행 메모리의 전반적인 압박에 가까웠다.

OOM은 Spill과 분리해 확인했다. 살아남은 익스큐터의 JVM 힙 피크는 약 6.5~6.8GB였고, 당시 `memory.fraction=0.8`로 Spark 관리 영역을 비교적 크게 잡고 있었다. JVM에는 `-XX:OnOutOfMemoryError='kill -9 %p'`도 설정돼 있어 OOM 발생 시 137로 종료될 수 있는 상태였다.

이 지표만으로 OOM을 일으킨 객체까지 확정할 수는 없다. 관리 메모리 밖에서 사용할 수 있는 힙 여유가 작았고, 메모리를 올린 뒤 같은 증상이 사라졌다. 두 결과를 근거로 익스큐터 전체의 힙 여유가 부족했던 것으로 판단했다.

GC 시간은 전체 태스크 시간의 약 2% 수준이었다. 적어도 지속적인 GC 과부하가 주된 병목으로 보이지는 않았다.

### 2.2 실제 효과가 없던 설정

세션 설정을 같이 확인하면서 현재 실행 방식에서는 의미가 없거나 Spark 셔플과 관계없는 값도 정리했다.

`spark.executor.memoryOverhead`는 YARN이나 Kubernetes처럼 컨테이너 메모리 요청을 관리하는 환경에서 사용하는 설정이다. Spark 3.x standalone에서는 이 값으로 익스큐터에 별도의 1GB 메모리가 추가되는 구조가 아니다.

`spark.storage.level`은 Spark core의 표준 설정 키가 아니다. 애플리케이션 코드에서 별도로 읽어 쓰지 않는다면 `persist()`의 StorageLevel을 바꾸지 않는다.

`mapreduce.map.output.compress`는 Hadoop MapReduce의 맵 출력 압축 설정이다. Spark 자체 셔플 압축은 `spark.shuffle.compress`가 담당하며 기본값도 `true`다.

---

## 3. 변경

익스큐터 메모리를 8g에서 16g로 올리고, `spark.memory.fraction=0.80`은 제거해 기본값 0.6으로 되돌렸다. 함께 확인한 불필요한 설정도 정리했다.

```python
"executorMemory": "16g",          # 8g → 16g
"spark.executor.memory": "16g",

# 삭제: spark.memory.fraction=0.80  → 기본값 0.6
# 삭제: spark.executor.memoryOverhead
# 삭제: spark.storage.level
# 삭제: mapreduce.map.output.compress
```

변경 후 메모리 구성을 같은 방식으로 계산하면 다음과 같다.

```text
통합 풀     = (16,384 − 300) × 0.6 ≈ 9.4GiB
나머지 영역 = (16,384 − 300) × 0.4 ≈ 6.3GiB

활성 태스크가 4개인 경우
태스크당 실행 메모리 몫 ≈ 9.4GiB ÷ 4 ≈ 2.35GiB
```

통합 풀은 약 6.1GB에서 9.4GB로 늘었고, Spark 관리 영역 밖의 힙 여유도 약 1.5GB에서 6.3GB 수준으로 커졌다. 여기서 6.3GB 역시 별도로 예약된 공간이라기보다 관리 메모리 외에 남는 힙 여유로 보는 편이 맞다.

`spark.memory.fraction`을 0.8로 유지한 채 힙만 16g로 늘리면 실행 메모리는 더 커진다. 이번 변경은 Spill과 익스큐터 OOM을 함께 줄이는 것이 목적이었다. `memory.fraction`을 기본값으로 되돌려 JVM 전체의 여유 공간도 확보했다.

당시 클러스터는 워커 10대 × 30GB로 총 메모리가 약 300GB였고, 해당 세션은 익스큐터 4개를 사용했다. 16g로 올려도 총 익스큐터 힙은 64GB 수준이라 클러스터 전체 여유는 충분했다. 노드당 30GB이므로 한 워커에 16g 익스큐터가 여러 개 배치되는 구성도 아니었다.

### 3.1 셔플 파티션은 128 유지

이 잡의 전체 셔플 쓰기는 약 55GB였고, Spill이 큰 스테이지 39도 128개 태스크에 태스크당 셔플 입력이 약 221MB였다. YARN 쪽 대형 적재 잡과 달리 파티션 하나가 수 GB 단위로 커진 상태는 아니었다.

이 작업에서는 `spark.sql.shuffle.partitions`를 먼저 올리지 않았다.

추가로 `spark.shuffle.sort.bypassMergeThreshold`도 고려했다. 기본값은 200이며, 맵 쪽 집계가 없고 reduce partition 수가 이 값 이하일 때 sort merge 과정을 우회하는 셔플 writer를 사용할 수 있다. 파티션 수를 128에서 200보다 큰 값으로 바꾸면 조건에 따라 셔플 writer 경로 자체가 달라질 수 있다.

파티션 상향을 Spill의 일반적인 해결책으로 적용하지 않고, 이 잡에서는 메모리 변경 효과부터 확인하기로 했다.

---

## 4. 변경 결과

변경 후 6일 평균을 기존 실행과 비교했다.

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 익스큐터 통합 풀 | 6.2GB | 9.4GB |
| 디스크 Spill | 9.1GB | **1.6GB** |
| 메모리 Spill | 145.9GB | 22.9GB |
| 셔플 쓰기 | 55.3GB | 55.4GB |
| 태스크 수 | 1,750 | 1,770 |
| 실패 태스크 | 간헐적 | **0** |
| 앱 소요 | 11분 | 11분 |

디스크 Spill은 약 **82% 감소**했고, 관찰 기간에는 익스큐터 OOM으로 인한 실패도 다시 발생하지 않았다. 특히 스테이지 39에서 발생하던 약 7.5GB의 Spill이 사라진 영향이 컸다.

전체 실행 시간은 약 11분으로 거의 같았다. 익스큐터 실행 시간 합도 128분에서 129분으로 비슷했다. 이 잡에서는 Spill 감소가 곧바로 wall-clock 감소로 이어지지 않았다. 당시 스테이지별 실행 시간과 JDBC write 구간을 같이 보면 CPU 처리와 외부 쓰기 시간이 여전히 큰 비중을 차지했다.

이번 변경으로 실행 시간이 줄지는 않았지만, 메모리 부족에 따른 익스큐터 종료와 재시도는 사라졌다.

---

## 5. 남은 Spill

변경 뒤에도 약 1.6GB의 디스크 Spill은 남았다. 대부분 태스크가 2개뿐인 스테이지 두 곳에서 발생했다.

`dw.exam_waitlist` 약 51MB를 작은 코드 테이블 3개와 브로드캐스트 조인한 뒤 `ROW_NUMBER` 윈도우를 적용하는 서브쿼리였다. 조인 이후 데이터가 약 1.2억 건까지 늘어나고, 셔플 쓰기는 약 2.8GB가 됐다.

브로드캐스트 조인 자체는 큰 테이블 쪽에 셔플을 만들지 않는다. 따라서 원본 스캔 파티션이 2개인 상태가 이후 데이터가 크게 늘어나는 구간까지 이어졌고, 결과적으로 일부 코어만 오래 사용하고 있었다.

메모리를 더 늘리면 이 구간의 Spill도 줄어들 수 있다. 그러나 태스크가 2개뿐인 낮은 병렬도는 그대로 남는다. 이 구간은 메모리를 더 늘리기보다 데이터가 크게 늘어나기 전에 파티션을 다시 나누는 편이 직접적인 조치다.

예를 들어 필터를 먼저 적용한 뒤 조인 전에 `REPARTITION`을 넣는 방안을 검토했다.

```sql
FROM (
    SELECT /*+ REPARTITION(32) */ *
    FROM lakehouse.dw.exam_waitlist
    WHERE finished_at IS NOT NULL
      AND (deleted_yn = 'N' OR deleted_yn IS NULL)
) s1
JOIN lakehouse.dw.exam_code m1 ON ...
```

이 위치에서 재분배하면 데이터가 크게 늘어나기 전의 입력을 대상으로 셔플을 한 번 추가하게 된다. 반대로 조인과 윈도우 이후에 repartition을 넣으면 이미 커진 데이터를 다시 분배해야 하므로 목적과 맞지 않는다.

이 변경은 아직 운영에 적용하지 않았다. 해당 두 스테이지가 차지하는 구간은 약 2분 12초지만, repartition으로 실제 얼마가 줄어들지는 별도 검증이 필요하다. 메모리 변경만으로 장애가 해소됐고 전체 수행 시간도 안정적이라 우선순위를 낮췄다.

---

## 6. 정리

- `spark.memory.fraction`은 JVM 힙을 두 개의 고정 영역으로 나누는 값이 아니라, Spark가 실행·스토리지 용도로 관리하는 통합 메모리의 크기를 정한다.
- 당시에는 대부분의 태스크에서 비슷한 Spill이 반복되고 실행 메모리 사용량도 높아, 특정 skew보다는 익스큐터 메모리 압박이 큰 상태였다.
- OOM의 정확한 객체 단위 원인은 heap dump 없이 확정하기 어렵지만, 8g/0.8 구성에서 힙 여유가 작았고 16g/0.6 변경 후 동일 장애가 재발하지 않았다.
- standalone에서는 `spark.executor.memoryOverhead`가 YARN/Kubernetes처럼 추가 컨테이너 메모리를 확보해 주지 않는다.
- 셔플 파티션 수는 잡마다 다르게 봐야 한다. 이 잡에서는 128개 파티션 자체보다 익스큐터 메모리 부족이 먼저 확인됐고, 파티션을 200 이상으로 올리면 조건에 따라 셔플 writer 경로도 달라질 수 있었다.
- 남은 Spill은 2개 태스크에 작업이 집중된 별도 구간에서 발생했다. 필요하다면 조인 전 repartition으로 병렬도를 늘리는 방향을 추가 검토할 수 있다.

같은 기간 YARN 클러스터에서 확인한 디스크 사용량 증가 사례는 [Spark Spill 및 디스크 사용량 증가 원인 분석](/data/spark-spill-disk-usage-root-cause/)에 정리했다.
