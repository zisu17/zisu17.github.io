---
title: "[Spark] Livy REST API로 Spark 작업 실행하기"
excerpt: "Livy의 대화형 세션과 배치 제출을 구분하고 세션 생성부터 코드 실행과 결과 조회까지 연결한다."
nav_section: data
nav_topic: processing

categories:
  - Data Engineering
tags:
  - Data

permalink: /data/[Data]-Apache-Livy로-Spark-사용하기/

toc: true
toc_sticky: true

date: 2024-01-08
last_modified_at: 2026-11-12
---

## Apache Livy

애플리케이션에서 Spark 작업을 실행하려면 코드를 제출하고 실행 상태와 결과를 확인할 방법이 필요하다. Apache Livy는 이 과정을 REST API로 제공하는 서비스이다. Spark 자체를 대체하는 처리 엔진이나 클러스터 매니저는 아니다.

클라이언트는 Livy에 HTTP 요청을 보내고 실제 계산은 Spark 드라이버와 Executor가 수행한다. 자원 할당은 Spark가 연결한 YARN이나 Kubernetes 같은 클러스터 매니저의 역할이다.

![클라이언트와 Livy 그리고 Spark 클러스터의 연결 구조](https://user-images.githubusercontent.com/108858121/234543403-b5775771-2a61-4ca0-9e8e-fa8078dd0018.png)

클라이언트에서 Spark 클러스터의 내부 구성까지 직접 다루지 않아도 된다는 장점이 있다. 다만 REST API라는 이유만으로 인증과 권한 관리가 해결되지는 않는다. 실제 서비스에서는 인증과 네트워크 접근 범위도 별도로 설정해야 한다.

## 대화형 세션과 배치 작업

Livy에는 두 가지 제출 방식이 있다.

| 방식 | API | 용도 |
|---|---|---|
| 대화형 세션 | `/sessions` | 같은 실행 환경에서 코드를 여러 번 제출 |
| 배치 작업 | `/batches` | 준비한 애플리케이션 파일을 제출 |

대화형 세션에서는 먼저 세션을 만든 뒤 `/sessions/{id}/statements`에 코드 문자열을 보낸다. 변수와 SparkContext를 유지하며 다음 코드를 실행할 수 있다.

반면 `.py`나 JAR 파일을 실행하려면 `/batches`에 `file`을 지정한다. `/sessions/{id}/jobs`에 파일을 보내는 방식은 Livy REST API에 없다.

## 세션을 만들고 코드 실행하기

아래는 Livy 서버와 Spark 연동이 준비된 환경에서 실행하는 클라이언트 예제이다. `BASE_URL`은 자신의 Livy 주소로 바꾼다. `requests` 패키지도 필요하다.

실행 순서는 세션 생성 → `idle` 대기 → 코드 제출 → 결과 조회 → 세션 종료이다.

```python
import time
import requests

BASE_URL = "http://localhost:8998"
HTTP_TIMEOUT = (5, 30)

def request_json(method, path, **kwargs):
    response = requests.request(
        method,
        f"{BASE_URL}{path}",
        timeout=HTTP_TIMEOUT,
        **kwargs,
    )
    response.raise_for_status()
    return response.json()

def wait_until(path, done, failed, timeout=120):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = request_json("GET", path)
        state = result["state"]
        if state in done:
            return result
        if state in failed:
            raise RuntimeError(result)
        time.sleep(1)
    raise TimeoutError(f"Livy 응답 대기 시간 초과: {path}")

session = request_json("POST", "/sessions", json={"kind": "pyspark"})
session_path = f"/sessions/{session['id']}"

try:
    wait_until(session_path, {"idle"}, {"error", "dead", "killed", "success"})

    statement = request_json(
        "POST",
        f"{session_path}/statements",
        json={"code": "print(spark.range(10).count())"},
    )
    result = wait_until(
        f"{session_path}/statements/{statement['id']}",
        {"available"},
        {"error", "cancelled"},
    )
    output = result.get("output") or {}
    if output.get("status") != "ok":
        raise RuntimeError(output)
    print(output.get("data", {}).get("text/plain"))
finally:
    response = requests.delete(
        f"{BASE_URL}{session_path}",
        timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
```

세션 생성 응답의 `id`로 이후 API 경로를 만든다. 응답에 `url`이라는 필드가 있다고 가정하지 않는다.

코드 제출 응답을 받았다고 계산이 끝난 것도 아니다. statement의 상태가 `available`이 되면 `output.status`를 확인한다. 코드 실행 오류는 HTTP 요청 자체가 성공해도 출력의 `error`로 전달될 수 있다.

반복 조회에는 간격과 대기 시간 제한을 둔다. 간격 없이 요청하면 Livy에 불필요한 부하가 생기고 실패 상태를 확인하지 않으면 계속 기다릴 수 있다. 위의 시간 제한은 예제 값이므로 실제 작업 시간에 맞게 정한다.

이 예제의 클라이언트는 동기 방식의 `requests`를 사용한다. Livy가 Spark 작업을 비동기로 처리하더라도 HTTP 응답을 기다리는 클라이언트 스레드까지 자동으로 논블로킹이 되는 것은 아니다.

## 애플리케이션 파일 제출하기

독립적인 Spark 애플리케이션을 실행하려면 `/batches`를 사용한다.

```python
batch = request_json(
    "POST",
    "/batches",
    json={
        "file": "hdfs:///apps/example.py",
        "args": ["--date", "2024-01-08"],
    },
)
batch_id = batch["id"]
print(request_json("GET", f"/batches/{batch_id}"))
```

여기서 `file`은 클라이언트 PC의 파일을 업로드하는 옵션이 아니다. Livy와 Spark 실행 환경에서 접근할 수 있는 경로를 지정해야 한다. 파일을 배치한 뒤 배치 ID로 상태를 조회하고 필요하면 `/batches/{id}/log`에서 로그를 확인한다.

## 마무리

같은 세션에서 코드를 이어 실행하려면 `sessions`와 `statements`를 사용하고 준비한 파일을 실행하려면 `batches`를 사용한다. API 요청 성공과 Spark 작업 성공은 별개이므로 상태와 실행 결과를 모두 확인해야 한다.

## 참고자료

- [Apache Livy REST API](https://livy.apache.org/docs/latest/rest-api.html)
- [Apache Livy 시작하기](https://livy.apache.org/get-started/)
- [Spark 클러스터 구성 요소](https://spark.apache.org/docs/3.5.6/cluster-overview.html)
