---
title: "[Network] Ingress란?"
excerpt: "Ingress Gateway와 Controller의 개념"

categories:
  - Network
tags:
  - [Network]

permalink: /network/[Network]-Ingress-Gateway란?/

toc: true
toc_sticky: true

date: 2023-07-13
last_modified_at: 2023-07-13
---

## Ingress와 Egress
네트워크 트래픽에서 Ingress는 일반적으로 서버 외부에서 내부로 네트워크 트래픽이 들어오는 방향을 뜻하고 이와 반대로 Egress는 서버 내부에서 외부로 네트워크 트래픽이 나가는 방향을 의미합니다.  
예를 들어 회사의 내부 네트워크에서 외부 인터넷으로 이메일을 보내는 것은 Egress 트래픽이고 반대로 외부 인터넷에서 회사의 내부 네트워크로 이메일을 받는 것은 Ingress 트래픽입니다.  
네트워크 관리자는 Ingress와 Egress 트래픽을 모니터링하고 분석하여 네트워크 성능을 최적화하고 보안을 유지하는데 사용합니다.  

## Ingress
<p float="left">
  <img src="https://github.com/zisu17/zisu17.github.io/assets/108858121/95ad6f25-15ba-421a-86ea-71fc1bedc414" width="45%" />
  <img src="https://github.com/zisu17/zisu17.github.io/assets/108858121/e695189b-80c2-4d8c-ad0e-bf4e89ed3a3b" width="45%" /> 
</p>


먼저 쿠버네티스에서의 Ingress라는 개념을 이해하려면 쿠버네티스가 어떻게 네트워크 트래픽을 관리하는지 이해하는 것이 중요합니다.  
쿠버네티스는 컨테이너화된 애플리케이션을 실행하고 관리하는 오픈 소스 플랫폼이고 클러스터라는 개념을 사용해 여러 노드(서버)를 하나의 단위로 묶어서 관리합니다.  
이런 컨테이너화된 애플리케이션들은 쿠버네티스 클러스터 내부에서 서비스(Service)라는 리소스 형태로 정의되고 해당 서비스는 보통 클러스터 내부에서만 접근 가능합니다.  
이 서비스를 클러스터 외부에서 사용하려면 외부에서 클러스터 내부로의 접근 경로가 필요합니다. 이때 Ingress가 그 역할을 하게 됩니다.  
Ingress는 말 그대로 '들어가는 길'을 의미하는데 쿠버네티스 클러스터로 들어오는 네트워크 요청을 어떻게 처리할지 정의하는 리소스입니다.  
클러스터 외부에서 특정 URL이나 도메인으로 HTTP/HTTPS 요청이 오면 Ingress는 이를 적절한 서비스로 라우팅하여 요청을 처리합니다. 

예를 들어 이웃집의 펫시터를 하는 상황을 생각해봅니다. 이웃집에는 강아지, 고양이, 햄스터, 토끼 등 다양한 반려동물이 있습니다.  
각각의 반려동물을 케어하려면 이웃집에 들어가야 하고 이웃집에 들어가기 위해선 '문'을 통해 들어가야 합니다.  
이 '문'은 이웃집에 들어가게 해주는 Ingress Gateway와 비슷합니다.  
Ingress Gateway는 외부에서 쿠버네티스 클러스터(이웃집)로 들어오는 트래픽을 처리하고 이 '문'을 통해 클러스터 내부의 애플리케이션(반려동물들)에 접근할 수 있게 합니다.  

그러나 단지 이 '문'을 통과하는 것만으로는 충분하지 않습니다.  
각 방(서비스)에 들어가려면 각 방에 맞는 특정 '키'(접근 권한이나 자격증명)가 필요합니다.  
예를 들어 강아지 방에 들어가려면 강아지 방 키가 고양이 방에 들어가려면 고양이 방 키가 필요합니다.  
이 '키'가 없으면, Ingress Gateway를 통해 특정 서비스에 접근하는 것은 제한될 수 있습니다.

Ingress Gateway는 사용자가 '문'을 통해 클러스터 내의 다양한 서비스에 접근하게 해주는 역할을 하고 '키'는 각 서비스에 접근할 수 있는 권한을 부여합니다.  

## Ingress Gateway와 Ingress Controller
<img width="1323" alt="image" src="https://github.com/zisu17/zisu17.github.io/assets/108858121/7253fc76-8486-49f8-a8b6-c91edaf766f7">

> 이미지 출처: [Jimmy Song's Blog](https://jimmysong.io/en/blog/why-gateway-api-is-the-future-of-ingress-and-mesh/)


### Ingress Gateway 
서비스 메쉬 아키텍처 특히 Istio와 같은 플랫폼에서 사용되는 개념입니다.  
Ingress Gateway는 클러스터 외부의 트래픽을 클러스터 내부로 라우팅하는데 사용되며 고급 라우팅 기능, SSL/TLS 종료, 로드 밸런싱 등의 기능을 제공합니다.  
또한 외부 요청을 클러스터 내부의 특정 서비스로 안전하게 라우팅하는 '문' 역할을 합니다.  
이 '문'은 외부에서 집 안으로 들어오는 방문객들을 통제합니다. 즉 외부 트래픽(방문객)이 클러스터(집) 내부로 어떻게 들어올 수 있는지를 관리합니다.

### Ingress Controller
쿠버네티스의 일부로 Ingress 리소스(트래픽 라우팅 규칙을 정의하는 쿠버네티스 오브젝트)를 해석하고 이를 바탕으로 트래픽을 적절한 서비스로 라우팅하는 역할을 합니다.  
Ingress Controller는 Ingress 리소스의 규칙을 '실제로' 실행하는 구성 요소입니다.  
예를 들면 집의 '관리인'이라고 볼 수 있습니다. 관리인은 집의 규칙(키를 어디에 두고, 어느 방을 어떻게 사용하는지 등)을 알고 있고 이 규칙에 따라 집을 관리합니다.  
즉 Ingress Controller는 Ingress 규칙(외부 요청을 어떻게 처리할 것인지에 대한 규칙)을 알고 있으며 이 규칙에 따라 트래픽을 적절한 서비스로 라우팅합니다.

따라서 이 두 개념은 각각 쿠버네티스의 트래픽 관리와 라우팅을 위한 도구이지만 그 사용법과 기능이 약간 다릅니다.  
Istio와 같은 서비스 메쉬를 사용하는 경우 Ingress Gateway와 Ingress Controller는 함께 작동하여 트래픽을 보다 안전하고 효율적으로 관리합니다.  

쿠버네티스 환경에서 스크래핑 파드가 클라이언트와 실시간으로 상호 작용하는 요구사항이 있어 Ingress Gateway와 Controller에 대해 공부해보았습니다.    
Ingress Controller는 클라이언트의 요청에 따라 적절한 파드로 라우팅하여 인터랙티브한 통신을 가능하게 합니다.  
또한 클라이언트는 특정 NodePort나 IP에 직접적으로 종속되지 않고 서비스의 위치(파드가 실행되는 노드)에 관계없이 원활하게 통신할 수 있습니다.  


