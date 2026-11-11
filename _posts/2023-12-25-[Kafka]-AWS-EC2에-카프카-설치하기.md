---
title: "[Kafka] EC2에서 Kafka 3.0 실행하고 메시지 주고받기"
excerpt: "Amazon Linux 2에서 ZooKeeper 기반 Kafka를 실행하고 EC2 간 연결 설정과 메시지 송수신을 확인한다."
nav_section: engineering
nav_topic: infrastructure

categories:
  - Infra
tags:
  - 데이터

permalink: /data/[Kafka]-AWS-EC2에-카프카-설치하기/

toc: true
toc_sticky: true

date: 2023-12-25
last_modified_at: 2026-11-12
---

## 실습 환경

EC2 한 대에서 Kafka 브로커를 실행하고 Producer가 보낸 메시지를 Consumer에서 읽어보려고 한다. 브로커는 메시지를 저장하고 클라이언트의 읽기·쓰기 요청을 처리하는 Kafka 서버이다.

2023년 실습 환경은 Amazon Linux 2와 Java 11, Kafka 3.0.0이다. 메타데이터 관리는 ZooKeeper를 사용한다. 아래는 이 버전을 기준으로 한 기록이며 새 환경을 구성할 때는 사용할 버전의 공식 설치 절차를 확인한다.

예제의 `<...>`는 자신의 호스트명이나 사설 IP로 바꾸고 꺾쇠는 제외한다. 명령은 별도 표시가 없으면 EC2에서 실행한다.

## macOS에서 EC2 접속하기

아래 두 명령은 로컬 터미널에서 실행한다. `chmod`에 지정한 파일과 SSH에서 사용하는 파일은 같아야 한다.

```bash
chmod 400 my-kafka.pem
ssh -i my-kafka.pem ec2-user@<EC2_PUBLIC_DNS>
```

EC2의 SSH 인바운드는 자신의 접속 IP로 제한한다. 키 파일의 권한을 바꿔도 네트워크 접근이 허용되는 것은 아니므로 보안 그룹은 별도로 확인해야 한다.

## Java 설치하기

Java 11을 설치한 뒤 `java -version`으로 실제 실행 버전을 확인한다.

```bash
sudo yum install -y java-11-amazon-corretto-headless
java -version
```

## Kafka 설치하기

Kafka 3.0.0은 오래된 릴리스이므로 Apache 보관소에서 받는다.

```bash
curl -fLO https://archive.apache.org/dist/kafka/3.0.0/kafka_2.13-3.0.0.tgz
tar -xzf kafka_2.13-3.0.0.tgz
cd kafka_2.13-3.0.0
```

### 브로커 접속 주소 설정

같은 EC2의 터미널에서만 실습하면 기본 설정으로 시작할 수 있다. 다른 EC2의 Producer에서 접속하려면 `config/server.properties`의 수신 주소와 클라이언트에 알릴 주소를 정해야 한다.

```properties
listeners=PLAINTEXT://0.0.0.0:9092
advertised.listeners=PLAINTEXT://<KAFKA_EC2_PRIVATE_IP>:9092
```

`listeners`는 브로커가 요청을 받을 주소이고 `advertised.listeners`는 클라이언트에게 알려줄 주소이다. 다른 EC2에 `localhost:9092`를 알려주면 그 클라이언트는 자기 자신의 9092 포트로 접속하려고 한다. 따라서 클라이언트가 접근할 수 있는 브로커의 사설 IP를 넣는다.

`--bootstrap-server`는 처음 브로커 정보를 얻을 때 사용하는 주소이다. 처음 접속에 성공해도 이후 전달받은 브로커 주소로 접근할 수 없으면 메시지 전송에 실패할 수 있다.

브로커 보안 그룹의 9092 포트는 실습할 클라이언트의 사설 네트워크나 보안 그룹에서만 접근하도록 제한한다. 이 예제는 인증·암호화가 없는 `PLAINTEXT`이므로 인터넷 전체에 공개하면 안 된다. ZooKeeper의 2181 포트도 외부에 공개할 필요가 없다.

### ZooKeeper와 브로커 시작

```bash
bin/zookeeper-server-start.sh -daemon config/zookeeper.properties
bin/kafka-server-start.sh -daemon config/server.properties
```

리스닝 포트를 확인한다.

```bash
sudo ss -lntp | grep -E ':(9092|2181)\b'
```

포트가 열렸다면 다음 단계에서 토픽을 만들고 실제 메시지가 오가는지 확인한다. 프로세스가 종료되면 `logs/server.log`와 `logs/zookeeper.out` 등 실행 로그를 먼저 확인한다. 운영 환경의 서비스 관리와 장애 복구는 이 단일 브로커 실습과 별도로 구성해야 한다.

## 토픽 만들기

토픽은 메시지를 분류해 저장하는 단위이다. 여기서는 `twitter`라는 토픽을 만들고 파티션 하나와 복제 계수 1로 설정한다. 토픽 생성 명령은 한 번 실행하고 끝나므로 백그라운드 실행 기호 `&`를 붙이지 않는다.

```bash
bin/kafka-topics.sh --create \
  --topic twitter \
  --partitions 1 \
  --replication-factor 1 \
  --bootstrap-server localhost:9092

bin/kafka-topics.sh --list --bootstrap-server localhost:9092
```

파티션은 토픽 안에서 메시지를 나누어 저장하는 단위이고 복제 계수는 각 파티션의 복사본 수이다. 복제 계수 1은 다른 브로커에 복사본이 없다는 뜻이므로 브로커가 중단되면 다른 복제본으로 서비스를 이어갈 수 없다.

## Consumer와 Producer로 확인하기

브로커 EC2의 터미널에서 Consumer를 실행한다.

```bash
bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic twitter \
  --from-beginning
```

다른 터미널에서 Producer를 실행하고 메시지를 입력한다. 같은 EC2라면 아래 주소를 사용한다.

```bash
bin/kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic twitter
```

Producer를 다른 EC2에서 실행한다면 그 EC2에도 Java와 Kafka 명령줄 도구를 준비한다. 접속 주소는 브로커의 사설 IP로 지정한다.

```bash
bin/kafka-console-producer.sh \
  --bootstrap-server <KAFKA_EC2_PRIVATE_IP>:9092 \
  --topic twitter
```

Producer에 `hello kafka`를 입력하고 Enter를 누른 뒤 Consumer에도 같은 문장이 표시되는지 확인한다. `--from-beginning`은 해당 Consumer 그룹의 기존 오프셋이 없을 때 보관 중인 처음 메시지부터 읽는 옵션이다. 기존 오프셋이 있는 그룹의 읽기 위치를 강제로 초기화하는 옵션은 아니다.

실습이 끝나면 Producer와 Consumer는 각각 `Ctrl+C`로 종료한다. ZooKeeper와 브로커는 `-daemon`으로 시작했으므로 터미널을 닫아도 종료되지 않는다. 브로커를 먼저 중지하고 ZooKeeper를 중지한다.

```bash
bin/kafka-server-stop.sh
bin/zookeeper-server-stop.sh
```

## 마무리

같은 EC2에서 메시지가 오가는지 먼저 확인하고 그다음 다른 EC2에서 연결하면 문제 범위를 좁히기 쉽다. 외부 클라이언트에서만 실패한다면 보안 그룹과 브로커가 알려주는 `advertised.listeners`를 함께 확인한다.

## 참고자료

- [Apache Kafka 3.0 Quick Start](https://kafka.apache.org/30/getting-started/quickstart/)
- [Amazon Corretto 11 설치](https://docs.aws.amazon.com/corretto/latest/corretto-11-ug/amazon-linux-install.html)
- [Apache Kafka 3.0 브로커 설정](https://kafka.apache.org/30/configuration/broker-configs/)

