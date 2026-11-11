---
title: "[Network] Ingress와 Ingress Controller의 차이"
excerpt: "Service와 Ingress 그리고 Controller의 역할을 구분하고 Istio Ingress Gateway와의 차이도 정리한다."
nav_section: engineering
nav_topic: infrastructure

categories:
  - Infra
tags:
  - Network

permalink: /infra/[Network]-Ingress-Gateway의-개념/

toc: true
toc_sticky: true

date: 2023-07-12
last_modified_at: 2026-11-12
---

## Ingress와 Egress

네트워크에서 Ingress는 기준이 되는 네트워크 안으로 들어오는 트래픽이고 Egress는 밖으로 나가는 트래픽이다. 클러스터를 기준으로 보면 외부 사용자의 요청은 Ingress 트래픽이고 파드가 외부 API를 호출하는 요청은 Egress 트래픽이다.

쿠버네티스를 공부하다 보면 `Ingress`와 `Ingress Controller`, Istio의 `Ingress Gateway`를 함께 접하게 된다. 모두 들어오는 트래픽과 관련이 있지만 같은 역할은 아니다.

## 쿠버네티스 Ingress와 Service

쿠버네티스에서 애플리케이션은 파드로 실행된다. 파드가 재생성되면 IP가 바뀔 수 있으므로 클라이언트가 파드 IP에 직접 의존하면 연결을 유지하기 어렵다. `Service`는 파드 집합에 접근할 수 있는 주소를 제공한다.

기본 유형인 `ClusterIP`는 클러스터 내부용이다. `NodePort`나 `LoadBalancer` 유형으로 외부에 노출할 수도 있다.

`Ingress`는 HTTP·HTTPS 요청의 호스트와 경로를 어떤 Service로 보낼지 정하는 리소스이다. 예를 들어 같은 도메인으로 들어와도 `/api`는 API Service로 보내고 `/web`은 웹 Service로 보내도록 정할 수 있다.

Ingress는 라우팅 **규칙**이지 요청을 직접 전달하는 서버가 아니다. 이 규칙을 실제 프록시나 로드 밸런서 설정에 반영하는 구성 요소가 Ingress Controller이다.

## Ingress Controller

Ingress Controller는 Ingress와 관련 리소스의 변경을 감시하고 트래픽을 전달하는 프록시나 로드 밸런서의 설정을 갱신한다. 구현체에 따라 Controller와 프록시가 같은 파드에 있거나 별도로 동작할 수 있다.

Ingress 리소스만 만든다고 동작하지는 않는다. 클러스터에 해당 Ingress를 처리할 Controller가 설치되어 있어야 한다. 어떤 Controller가 처리할지는 `IngressClass`로 구분한다.

사용자 인증이나 접근 권한 검사는 별도 기능이다. Ingress를 만들었다는 이유만으로 자동으로 적용되지는 않는다.

### 경로별로 다른 Service에 연결하기

다음은 같은 도메인의 요청을 경로에 따라 나누는 예시이다. `example-class`는 실제 클러스터에 설치한 IngressClass 이름으로 바꾼다. `api-service`와 `web-service`는 같은 네임스페이스에 이미 있고 각각 8080 포트와 80 포트를 제공한다고 가정한다.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
spec:
  ingressClassName: example-class
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 8080
          - path: /web
            pathType: Prefix
            backend:
              service:
                name: web-service
                port:
                  number: 80
```

`/api/orders` 요청은 `api-service`로 연결된다. 여기의 포트는 파드의 포트가 아니라 Service가 제공하는 포트이다. 또 이 설정만으로 `/api`가 자동으로 제거되지는 않는다. 애플리케이션이 `/orders`로 받아야 한다면 사용하는 Controller의 경로 재작성 설정을 따로 확인해야 한다.

외부에서 접속하려면 도메인도 Controller가 사용하는 진입 주소를 가리켜야 한다. 연결이 안 될 때는 도메인과 진입 주소부터 확인하고 Ingress의 경로 규칙과 Service에 연결된 파드를 차례로 확인하면 된다.

## Istio Ingress Gateway

Istio의 Ingress Gateway는 서비스 메시 외부에서 들어온 트래픽을 받는 프록시이다. Istio의 `Gateway` 리소스로 포트와 프로토콜, TLS 설정 등을 정하고 `VirtualService`로 요청을 보낼 서비스와 경로를 정할 수 있다.

Istio Ingress Gateway와 일반적인 Ingress Controller를 항상 함께 설치해야 하는 것은 아니다. 어떤 API와 구현체로 외부 트래픽을 처리할지에 따라 구성이 달라진다.

| 구성 요소 | 역할 |
|---|---|
| Service | 파드 집합에 접근할 주소와 포트를 제공 |
| Kubernetes Ingress | 호스트·경로별로 연결할 Service를 정의 |
| Ingress Controller | Ingress 규칙을 실제 트래픽 처리 설정에 반영 |
| Istio Ingress Gateway | 메시 외부에서 들어오는 트래픽을 받는 프록시 |
| Istio Gateway·VirtualService | Gateway의 수신 설정과 서비스 라우팅을 정의 |

쿠버네티스 Gateway API의 `Gateway`와 Istio API의 `Gateway`도 이름은 같지만 서로 다른 리소스이다. 설정 예제를 볼 때는 `apiVersion`까지 구분해야 한다.

## 마무리

스크래핑 파드와 클라이언트가 실시간으로 상호작용하는 요구사항이 있어 외부 요청을 연결하는 방식을 공부했다. 외부 요청을 어떤 Service로 보낼지는 Ingress 등에 정의하고 실제 전달은 Controller가 구성한 프록시나 Gateway가 처리한다.

Service를 통해 접근하면 클라이언트가 특정 파드의 IP나 실행 노드에 직접 의존하지 않아도 된다. WebSocket처럼 연결을 오래 유지하는 방식은 사용하는 프록시의 지원 여부와 타임아웃 설정도 함께 확인해야 한다.

## 참고자료

- [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Kubernetes Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Istio Ingress Gateways](https://istio.io/latest/docs/tasks/traffic-management/ingress/ingress-control/)


