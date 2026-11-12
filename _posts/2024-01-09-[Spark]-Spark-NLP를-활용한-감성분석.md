---
title: "[Spark] Spark NLP와 한국어 감성 분석 모델 사용하기"
excerpt: "사전 학습 파이프라인과 한국어 분류 모델을 실행하고 Spark 처리와 로컬 추론의 차이와 결과 해석 방법을 정리한다."
nav_section: data
nav_topic: processing

categories:
  - Data Engineering
tags:
  - Data

permalink: /data/[Spark]-Spark-NLP를-활용한-감성분석/

toc: true
toc_sticky: true

date: 2024-01-09
last_modified_at: 2026-11-12
---

## Spark NLP

텍스트 수집 파이프라인이 Spark로 구성되어 있다면 감성 분석도 Spark DataFrame 처리에 연결할 수 있다. Spark NLP는 Apache Spark 기반의 자연어 처리 라이브러리로 토큰화와 개체명 인식, 문장 분류 등을 파이프라인으로 구성할 수 있다.

분산 처리를 지원한다는 것과 어떤 호출이든 클러스터 전체에서 실행된다는 것은 다르다. 간단한 문자열 추론과 DataFrame 변환을 나누어 확인해야 한다.

## 사전 학습 파이프라인 실행하기

`PretrainedPipeline`은 이미 구성된 파이프라인과 모델을 내려받아 사용하게 해준다. 아래는 영문 감성 분석 예제이다. Spark NLP와 Spark, Java의 호환 환경을 먼저 준비해야 하며 처음에는 모델 다운로드 시간도 든다.

```python
import sparknlp
from sparknlp.pretrained import PretrainedPipeline

spark = sparknlp.start()
pipeline = PretrainedPipeline("analyze_sentiment", lang="en")

test_docs = [
    "I felt so disapointed to see this very uninspired film. I recommend others to awoid this movie is not good.",
    "This was movie was amesome, everything was nice.",
]

results = pipeline.annotate(test_docs)
for result in results:
    print(result["sentence"], result["sentiment"])
```

아래는 2024년 실습 출력에서 문장별 감성만 추린 것이다. 입력 문장의 오타도 그대로 두었다. 모델 버전이 달라지면 결과도 달라질 수 있다.

| 입력 | 반환된 감성 |
|---|---|
| 첫 번째 입력의 두 문장 | `positive`와 `negative` |
| 두 번째 입력의 한 문장 | `negative` |

좋다는 내용이 담긴 문장에도 `negative`가 반환됐다. 코드가 실행되는 것과 분류가 맞는 것은 별개이다. 오타가 있는 입력이나 실제 수집할 분야의 문장을 넣어 결과를 직접 확인해야 한다.

### 문자열 추론과 DataFrame 처리

`annotate()`는 문자열을 받아 결과를 확인하기 편하지만 내부의 LightPipeline을 사용하는 로컬 추론 방식이다. 대량 데이터를 이 함수에 리스트로 모아 넣으면 Driver에 데이터를 모으게 된다.

Spark DataFrame에 적용하려면 `transform()`을 사용한다.

```python
data = spark.createDataFrame([(text,) for text in test_docs], ["text"])
result_df = pipeline.transform(data)
result_df.select("text", "sentiment.result").show(truncate=False)
```

이 경우 Spark 파이프라인의 변환으로 처리할 수 있다. 다만 모델을 실행하는 데 필요한 메모리와 파티션별 데이터량은 별도로 확인해야 한다. Spark를 사용했다는 이유만으로 모든 환경에서 더 빨라지는 것은 아니다.

## 한국어 모델은 어디에서 실행할까?

[한국어 ELECTRA 분류 모델](https://sparknlp.org/2022/09/14/electra_classifier_ko_base_v3_generalized_sentiment_analysis_ko.html)은 원래 `jaehyeong`의 Hugging Face 모델을 Spark NLP에서 사용할 수 있게 제공한 모델이다. 원 모델의 출처와 Spark NLP에서 제공하는 실행 경로를 나누어 보면 된다.

Spark NLP의 분류기와 Pipeline을 쓰면 Spark DataFrame에 연결할 수 있다. 반면 아래의 Hugging Face Transformers 코드는 Python 프로세스에서 모델을 실행한다. Spark Executor에 작업을 보내는 코드가 아니다.

모델 카드에서 안내하는 `Copycats/koelectra-base-v3-generalized-sentiment-analysis` 경로를 사용한다. `transformers`와 PyTorch 같은 지원 백엔드가 필요하다. 긴 입력은 잘릴 수 있으므로 실제 텍스트의 길이도 확인한다.

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TextClassificationPipeline

# load model
tokenizer = AutoTokenizer.from_pretrained("Copycats/koelectra-base-v3-generalized-sentiment-analysis")
model = AutoModelForSequenceClassification.from_pretrained("Copycats/koelectra-base-v3-generalized-sentiment-analysis")
sentiment_classifier = TextClassificationPipeline(tokenizer=tokenizer, model=model)

# target reviews
review_list = [
    '이쁘고 좋아요~~~씻기도 편하고 아이고 이쁘다고 자기방에 갖다놓고 잘써요~^^',
    '아직 입어보진 않았지만 굉장히 가벼워요~~ 다른 리뷰처럼 어깡이 좀 되네요ㅋ 만족합니다. 엄청 빠른발송 감사드려요 :)',
    '재구매 한건데 너무너무 가성비인거 같아요!! 다음에 또 생각나면 3개째 또 살듯..ㅎㅎ',
    '가습량이 너무 적어요. 방이 작지 않다면 무조건 큰걸로구매하세요. 물량도 조금밖에 안들어가서 쓰기도 불편함',
    '한번입었는데 옆에 봉제선 다 풀리고 실밥도 계속 나옵니다. 마감 처리 너무 엉망 아닌가요?',
    '따뜻하고 좋긴한데 배송이 느려요',
    '맛은 있는데 가격이 있는 편이에요'
]

# predict
for review in review_list:
  pred = sentiment_classifier(review, truncation=True)
  print(f'{review}\n>> {pred[0]}')
```

아래 출력은 기존 실습 기록이다. 모델 경로나 리비전, 라이브러리 버전이 달라지면 위 코드를 실행한 결과와 같지 않을 수 있다.

```text
이쁘고 좋아요~~~씻기도 편하고 아이고 이쁘다고 자기방에 갖다놓고 잘써요~^^
>> {'label': '1', 'score': 0.9906477332115173}
아직 입어보진 않았지만 굉장히 가벼워요~~ 다른 리뷰처럼 어깡이 좀 되네요ㅋ 만족합니다. 엄청 빠른발송 감사드려요 :)
>> {'label': '1', 'score': 0.9912862181663513}
재구매 한건데 너무너무 가성비인거 같아요!! 다음에 또 생각나면 3개째 또 살듯..ㅎㅎ
>> {'label': '1', 'score': 0.9904279708862305}
가습량이 너무 적어요. 방이 작지 않다면 무조건 큰걸로구매하세요. 물량도 조금밖에 안들어가서 쓰기도 불편함
>> {'label': '0', 'score': 0.9968683123588562}
한번입었는데 옆에 봉제선 다 풀리고 실밥도 계속 나옵니다. 마감 처리 너무 엉망 아닌가요?
>> {'label': '0', 'score': 0.9988909363746643}
따뜻하고 좋긴한데 배송이 느려요
>> {'label': '0', 'score': 0.5224758386611938}
맛은 있는데 가격이 있는 편이에요
>> {'label': '1', 'score': 0.7503753900527954}

label 0 : negative review
label 1 : positive review
```

## 레이블과 점수 읽기

이 모델의 `0`은 부정이고 `1`은 긍정이다. 다른 모델에서도 숫자의 의미가 같다고 가정하지 말고 모델 카드와 `model.config.id2label`을 확인한다.

`score`는 선택한 레이블에 대해 모델이 계산한 점수이다. 실제 정답일 확률이 검증된 값이라고 볼 수는 없다. 예를 들어 “따뜻하고 좋긴한데 배송이 느려요”는 상품과 배송에 대한 평가가 함께 들어 있다. 낮은 점수 하나만으로 중립이라고 확정하기 어렵다.

이 모델에는 중립 레이블이 없다. 애매한 결과를 따로 처리하려면 실제 리뷰에 정답을 붙여 임계값을 검증하고 “보류” 같은 업무 기준을 정할 수 있다. 중립을 직접 분류하려면 그 레이블을 학습한 모델이 필요하다.

또 Transformer의 토크나이저는 모델 입력을 만드는 도구이지 Okt 같은 한국어 품사 분석기의 결과를 제공하는 도구는 아니다. 명사 추출이나 품사 태깅이 필요하다면 감성 분류와 별도로 구성한다.

## 마무리

Spark NLP의 DataFrame 변환과 Transformers의 로컬 추론은 실행 환경이 다르다. 먼저 실제 파이프라인에 어느 방식으로 연결할지 정하고 대표 문장에서 레이블과 점수를 확인해야 한다. 모델이 실행된다는 이유만으로 결과를 그대로 분석 지표에 넣어서는 안 된다.

## 참고자료

- [Spark NLP 설치와 호환 환경](https://sparknlp.org/docs/en/quickstart)
- [Spark NLP LightPipeline](https://sparknlp.org/api/python/user_guide/light_pipelines.html)
- [Spark NLP 한국어 ELECTRA 모델](https://sparknlp.org/2022/09/14/electra_classifier_ko_base_v3_generalized_sentiment_analysis_ko.html)
- [원 모델의 모델 카드](https://huggingface.co/Copycats/koelectra-base-v3-generalized-sentiment-analysis)
- [Transformers 텍스트 분류](https://huggingface.co/docs/transformers/tasks/sequence_classification)
