---
title: "[PostgreSQL] PostgreSQL 19 주요 업데이트 정리"
excerpt: "PostgreSQL 19 베타에서 공개된 주요 신규 기능과 변경점을 정리한다."

categories:
  - Data
tags:
  - Data
  - PostgreSQL
  - Autovacuum
  - 논리복제
  - SQL
  - 릴리스

permalink: /data/postgresql-19-major-updates/

toc: true
toc_sticky: true

date: 2026-07-24
last_modified_at: 2026-07-24
---

## 1. 개요

PostgreSQL 19는 PostgreSQL의 다음 메이저 버전이다. 2026년 7월 현재 정식 출시 전이며 베타 단계다.

Beta 1은 2026년 6월 4일, Beta 2는 2026년 7월 16일에 공개됐다. 정식 릴리스(GA)는 예년 일정대로 2026년 9~10월로 예상된다.

이 글은 베타 기준으로 공개된 주요 신규 기능과 변경점을 정리한다. 베타 단계이므로 정식 출시까지 설정명, 기본값, 세부 동작이 바뀌거나 일부 기능이 빠질 수 있다. 실제 도입 시점에는 공식 릴리스 노트로 최종 내용을 다시 확인해야 한다.

큰 흐름은 다섯 갈래다.

- 유지보수 부담을 줄이는 **병렬 Autovacuum**과 **REPACK**
- PostgreSQL 18의 비동기 I/O를 발전시킨 **I/O 워커 자동 스케일링**
- SQL 표준을 따라가는 **프로퍼티 그래프(SQL/PGQ)**와 여러 쿼리 문법
- 논리 복제의 **시퀀스 값 복제**
- **온라인 체크섬**과 기본값 현실화(JIT, TOAST 압축)

---

## 2. 유지보수와 Autovacuum

DBA 입장에서 PostgreSQL 19의 가장 큰 변화는 유지보수 영역이다.

### 2.1 병렬 Autovacuum

기존 autovacuum은 테이블 하나를 워커 하나가 순차로 처리했다. 대형 테이블에서는 인덱스 정리 구간이 특히 오래 걸렸다.

PostgreSQL 19는 autovacuum이 **병렬 워커**를 쓸 수 있게 한다. 병렬도는 `autovacuum_max_parallel_workers` 설정으로 제어한다.

수동 `VACUUM`의 `PARALLEL` 옵션은 이전 버전에서도 인덱스를 병렬로 처리했다. 하지만 autovacuum 자체가 병렬로 도는 것은 19에서 처음이다.

### 2.2 Autovacuum 스코어링

어떤 테이블을 먼저 청소할지 정하는 우선순위 방식도 바뀐다.

PostgreSQL 19는 테이블별로 점수를 매겨 청소 순서를 정하는 **스코어링 시스템**을 도입한다. 데드튜플 양, 트랜잭션 ID 나이 등을 반영해 급한 테이블을 먼저 처리한다.

### 2.3 REPACK 명령

테이블 bloat를 제거하려면 그동안 `VACUUM FULL`(테이블에 배타 락)이나 외부 확장인 `pg_repack`을 써야 했다.

PostgreSQL 19는 **`REPACK`** 명령을 코어에 추가한다. `REPACK CONCURRENTLY`는 테이블을 재구성하는 동안 읽기와 쓰기를 막지 않는다.

`VACUUM FULL`과 달리 서비스 중단 없이 테이블을 재작성할 수 있는 것이 핵심이다.

### 2.4 진행 상황 모니터링

`pg_stat_progress_vacuum` 뷰에 `started_by`와 `mode` 컬럼이 추가된다. 수동 실행인지 autovacuum인지, 누가 시작했는지 구분할 수 있다.

---

## 3. 성능과 I/O

### 3.1 비동기 I/O 워커 자동 스케일링

PostgreSQL 18은 비동기 I/O(AIO) 서브시스템을 처음 도입했다.

PostgreSQL 19는 여기에 자동 스케일링을 얹는다. `io_method=worker`일 때 I/O 워커 수를 `io_min_workers`와 `io_max_workers` 범위 안에서 부하에 따라 자동으로 조절한다.

관리자가 워커 수를 고정하지 않아도 워크로드에 맞춰 늘고 준다.

### 3.2 옵티마이저 개선

쿼리 플래너도 여러 부분이 개선된다.

- anti-join 최적화
- incremental sort 적용 범위 확대
- `enable_eager_aggregate` 설정으로 집계를 앞당겨 처리
- 병렬 순차 스캔 속도 향상
- 입력이 NULL이 될 수 없을 때 `IS DISTINCT FROM` / `IS NOT DISTINCT FROM`을 `<>` / `=`로 단순화
- 외래 키 제약이 있는 INSERT 성능 약 2배 향상

### 3.3 플랜 안정화

같은 쿼리인데 실행 계획이 갑자기 바뀌어 성능이 크게 달라지는 문제는 운영에서 자주 겪는다.

PostgreSQL 19는 `pg_plan_advice` 확장으로 플래너 결정을 고정하고 제어할 수 있게 한다. `pg_stash_advice`는 쿼리 식별자를 기준으로 저장해 둔 advice를 자동 적용한다.

### 3.4 기본값 변경

실무 관점에서 기본값 두 가지가 바뀐다.

| 항목 | 이전 버전 | PostgreSQL 19 |
|---|---|---|
| JIT 컴파일 | 기본 활성화(on) | 기본 비활성화(off) |
| TOAST 기본 압축 | pglz | lz4 |

JIT는 짧은 OLTP 쿼리에서 컴파일 비용 때문에 오히려 느려지는 사례가 많았다. 19는 기본을 off로 바꾼다. 필요하면 `jit = on`으로 켠다.

TOAST 압축 기본값은 `default_toast_compression`이 `lz4`가 된다. lz4는 pglz보다 압축과 해제 속도가 빠르다.

---

## 4. SQL과 쿼리 기능

### 4.1 프로퍼티 그래프 (SQL/PGQ)

PostgreSQL 19는 **SQL/PGQ**(SQL Property Graph Queries)를 지원한다. SQL 표준 문법으로 그래프 패턴 질의를 작성할 수 있다.

관계형 테이블 위에 프로퍼티 그래프를 정의하고, 노드와 간선 패턴으로 조회하는 방식이다.

### 4.2 ON CONFLICT DO SELECT

`INSERT ... ON CONFLICT`는 그동안 `DO NOTHING`과 `DO UPDATE`만 지원했다. 충돌 시 기존 행을 그대로 돌려받으려면 별도 SELECT가 필요했다.

PostgreSQL 19는 **`ON CONFLICT DO SELECT ... RETURNING`**을 추가한다. 있으면 조회하고 없으면 삽입하는 get-or-create를 한 번의 원자적 문장으로 처리한다.

### 4.3 FOR PORTION OF

**`FOR PORTION OF`** 절이 UPDATE와 DELETE에 추가된다. 기간(temporal) 컬럼의 특정 구간만 잘라 수정하거나 삭제한다. SQL:2011 temporal 표준을 채운다.

### 4.4 파티션 MERGE와 SPLIT

`ALTER TABLE ... MERGE PARTITIONS`로 여러 파티션을 하나로 합치고, `ALTER TABLE ... SPLIT PARTITIONS`로 하나를 여러 개로 나눌 수 있다.

### 4.5 그 외 문법

- **`GROUP BY ALL`**: SELECT 목록의 비집계 컬럼을 자동으로 GROUP BY 대상에 넣는다
- **`WAIT FOR LSN`**: 복제본에서 특정 LSN까지 적용되길 기다려 read-your-writes 일관성을 보장한다
- JSONPath 문자열 함수 추가: `lower()`, `upper()`, `replace()`, `split_part()` 등
- `random()`이 `date`, `timestamp` 타입도 지원

---

## 5. 논리 복제

### 5.1 시퀀스 값 복제

논리 복제는 그동안 테이블 데이터는 복제하면서 시퀀스 값은 복제하지 않았다. 페일오버 후 시퀀스를 수동으로 맞춰야 하는 불편이 있었다.

PostgreSQL 19는 **시퀀스 값을 논리 복제로 전송**한다. 오래 요청돼 온 기능이다.

### 5.2 발행과 구독 개선

- **`CREATE PUBLICATION ... EXCEPT`**: 특정 테이블만 제외하고 나머지를 발행한다
- **`CREATE SUBSCRIPTION ... SERVER`**: foreign server 정의를 재사용해 접속 정보 관리를 단순화한다

### 5.3 재시작 없는 활성화

기존에는 논리 복제를 쓰려면 `wal_level`을 `logical`로 올리고 서버를 재시작해야 했다.

PostgreSQL 19는 `wal_level=replica` 상태에서도 서버 재시작 없이 논리 복제를 필요할 때 활성화할 수 있다. 현재 적용 중인 WAL 레벨은 읽기 전용 파라미터 `effective_wal_level`로 확인한다.

---

## 6. 보안과 운영

### 6.1 인증 변경

- **서버 측 SNI 지원**: `pg_hosts.conf` 파일로 호스트명별 TLS 인증서를 지정한다. 한 서버가 여러 도메인의 인증서를 제공할 수 있다.
- **MD5 사용 경고**: `md5` 인증이 성공하면 경고를 남긴다. `md5_password_warnings`로 제어하며 MD5 폐기를 유도한다.
- **RADIUS 인증 제거**: RADIUS 인증 지원이 삭제된다.
- **비밀번호 만료 경고**: `password_expiration_warning_threshold`(기본 7일)로 만료 임박 시 경고한다.

### 6.2 온라인 체크섬

데이터 체크섬은 그동안 클러스터 초기화 시점에 정하거나, 오프라인에서 `pg_checksums`로만 바꿀 수 있었다.

PostgreSQL 19는 **데이터 체크섬을 서버 재시작 없이 온라인으로 켜고 끌 수 있다.**

### 6.3 모니터링 뷰 추가

- `pg_stat_lock`: 락 종류별 통계
- `pg_stat_recovery`: 복구 진행 가시성
- `EXPLAIN (ANALYZE, IO)`로 비동기 I/O 통계 확인
- 프로세스 타입별 `log_min_messages` 설정

---

## 7. 정리

PostgreSQL 19 베타의 핵심을 요약하면 다음과 같다.

- **유지보수**: 병렬 Autovacuum과 `REPACK CONCURRENTLY`로 대형 테이블 청소와 재구성 부담이 크게 준다
- **성능**: PostgreSQL 18의 비동기 I/O가 워커 자동 스케일링으로 이어지고, 옵티마이저와 플랜 안정화가 보강된다
- **SQL**: SQL/PGQ 그래프 질의, `ON CONFLICT DO SELECT`, `FOR PORTION OF`, 파티션 MERGE/SPLIT 등 표준 문법이 넓어진다
- **논리 복제**: 시퀀스 값 복제로 페일오버 시나리오가 편해진다
- **운영**: 온라인 체크섬, 기본값 현실화(JIT off, TOAST lz4), 신규 모니터링 뷰

다시 강조하면 위 내용은 베타 기준이다. 정식 GA는 2026년 9~10월로 예상되며, 도입 전에는 공식 릴리스 노트로 최종 확정된 기능과 기본값을 확인해야 한다.
