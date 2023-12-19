---
title: "[Scraping] Selenium 없이 동적 웹페이지 스크래핑 하기"
excerpt: "정적/동적 스크래핑 차이, selenium과 requests 스크래핑 방식 차이"

categories:
  - Data
tags:
  - [Data, Scraping, BeautifulSoup, Selenium]

permalink: /data/[Scraping]-Selenium-없이-동적-웹페이지-스크래핑-하기/

toc: true
toc_sticky: true

date: 2023-12-12
last_modified_at: 2023-12-15
---

### 정적 스크래핑과 동적 스크래핑
![image](https://github.com/zisu17/zisu17.github.io/assets/108858121/7bcfdea6-6be7-4c67-8d73-21ae3b58027b)

웹에서 정적 페이지는 서버에 미리 저장된 파일을 사용자에게 그대로 제공한다. 접속할 웹 주소를 requests 하면 사용자가 보게되는 모든 정보를 HTML source를 통해 받을 수 있다. 
그에 반해 동적 페이지는 서버에서 실시간으로 데이터가 생성되거나 수정되는 웹 페이지라서 사용자의 요청이나 상호작용에 따라서 웹에 보여지는 컨텐츠가 달라진다. 
정적 웹 페이지 구성은 보통 소규모 기업의 사이트나 포트폴리오 같이 랜딩 페이지 변경이 많이 없을 때 사용되고 동적 웹 페이지 구성은 네이버나 유튜브 같이 사용자 상호작용 등에 따라 랜딩 페이지 변경이 많은 대형 웹 사이트에서 사용된다.

### 처음 요청했을 때 가져오는 HTML source가 페이지를 구성하는 모든 데이터일까?
앞서 말했듯 그럴 수도 있고 아닐 수도 있다. 일반적으로 정적 페이지라면 웹사이트 접근 주소에 요청했을 때 받는 HTML source가 내가 필요로 하는 모든 데이터일 수 있겠지만
javascript 등과 같이 동적으로 동작하는 웹 페이지 구성이라면 처음 가져오는 HTML source만으로는 내가 원하는 데이터를 모두 얻을 수 없다.
이전에 크롤링 성능을 몇십배 올렸다는 스크래핑 관련 포스트를 본 적이 있다. 사용하던 툴을 Selenium에서 requests/bs4로 변경한 후 HTML source에서 데이터를 파싱해 스크래핑 시간을 줄였다는 내용이었다.
하지만 그건 애초에 정적페이지를 스크래핑 대상으로 삼았기 때문에 쉽게 가능한 이야기였다. 정적페이지의 경우에는 원래 Selenium이 아니라 reqeusts와 BeautifulSoup 등을 사용해서 스크래핑 하는 것이 일반적이다.
동적 웹 사이트 주소에 단순히 requests 요청을 보내면 javascript가 실행되기 전의 HTML source를 받기 때문에 원하는 데이터를 모두 얻을 수 없다. 
그렇다면 동적페이지는 무조건 Selenium을 사용해야 하는 것일까?

### selenium 없이 동적 페이지 스크래핑 하기
간단하게 요즘 진행하고 있는 프로젝트의 일부 스크래핑 모듈로 예시를 들어보려고 한다! 네이버 트렌드랩에서 API를 제공하고 있지만 내가 원하는 날짜별 트렌드 키워드 데이터를 제공하지는 않는다. 그래서 해당 키워드 리스트를 스크래핑을 통해 가져오려고 한다. 이 웹 페이지는 쿼리 스트링이 사이트 주소에 남지 않고 모든 것이 javascript로 동작하는 동적 웹 페이지이다. 
아래의 값 선택 부분들을 내가 원하는 조건에 맞게 선택한 뒤 조회 버튼을 누르고 렌더링 되어 나오는 인기 검색어 20개를 스크래핑을 하려고 한다. 

<img width="1288" alt="image" src="https://github.com/zisu17/zisu17.github.io/assets/108858121/ab10d141-d6c4-45c3-a81b-5c117e610739">

이 페이지는 개발자 도구 설정에서 Disable JavaScript에 체크를 하면 이후로 드롭다운, 체크박스 같은 동작을 하지 않는다.(심지어 새로고침을 하면 있던 화면도 날아가버린다) 이 페이지는 자바 스크립트로 구성된 동적 페이지임을 알 수 있다. 사람이 실제로 해당 페이지에 접근을 해서 인기 검색어 20개를 보려고 한다면 8번 이상의 클릭을 해야만 한다. 

<img width="1287" alt="image" src="https://github.com/zisu17/zisu17.github.io/assets/108858121/0ea078e3-1980-49c2-a4bf-c2dfaa0a0ee8">

이런 경우에는 보통 Selenium을 활용해서 마치 사람이 해당 사이트에 접근을 하는 것처럼 웹 브라우저와 드라이버로 동적 스크래핑을 진행하게 된다. 

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service

def extract_naver_fashion_keyword():
    driver_path = './etl/infra/chromedriver'
    service = Service(executable_path=driver_path)
    options = webdriver.ChromeOptions()
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--no-sandbox')
    options.add_argument('--headless')
    options.add_argument('--window-size=1920,1080')
    options.add_argument("--disable-gpu")
    options.add_argument("lang=ko_KR")
    options.add_argument("--incognito")
    options.add_argument("--safebrowsing-disable-download-protection")
    driver = webdriver.Chrome(service=service, options=options)

    naver_shopping_insight_url = 'https://datalab.naver.com/shoppingInsight/sCategory.naver'
    driver.get(naver_shopping_insight_url)
    wait = WebDriverWait(driver, 10)

    click_target1 = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "#content > div.section_instie_area.space_top > div > div.section.insite_inquiry > div > div > div:nth-child(1) > div > div:nth-child(2) > span"))
    )
    click_target1.click()

    click_target2 = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "a[data-cid='50000167']"))
    )
    click_target2.click()

    click_target3 = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "#content > div.section_instie_area.space_top > div > div.section.insite_inquiry > div > div > div:nth-child(2) > div.set_period_target > span:nth-child(1) > div:nth-child(2) > span"))
    )
    click_target3.click()

    click_target4 = wait.until(
        EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#content > div.section_instie_area.space_top > div > div.section.insite_inquiry > div > div > div:nth-child(2) > div.set_period_target > span:nth-child(1) > div:nth-child(2) > ul > li"))
    )[-1]
    click_target4.click()

    click_target5 = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "#content > div.section_instie_area.space_top > div > div.section.insite_inquiry > div > div > div:nth-child(4) > div > div > span:nth-child(2)"))
    )
    click_target5.click()

    click_target6 = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "#content > div.section_instie_area.space_top > div > div.section.insite_inquiry > div > div > div:nth-child(5) > div > div > span:nth-child(3)"))
    )
    click_target6.click()

    click_target7 = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "#content > div.section_instie_area.space_top > div > div.section.insite_inquiry > div > div > div:nth-child(5) > div > div > span:nth-child(4)"))
    )
    click_target7.click()

    search_button = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "#content > div.section_instie_area.space_top > div > div.section.insite_inquiry > div > a"))
    )
    search_button.click()

    keyword_element = wait.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "ul[class='rank_top1000_list']"))
    )
    keyword_text = keyword_element.text
    keywords = keyword_text.split('\n')[1::2]

    return keywords    
```

하지만 클라이언트가 서버에서 데이터를 받아와 DOM을 꾸리는 방식을 이해하면 보다 쉽고 빠르게 데이터를 스크래핑할 수 있다. 클라이언트(웹 브라우저)는 서버에 필요한 정보를 담은 파라미터를 전송하면서 데이터를 요청한다. 서버는 이 요청을 처리하고 요청된 데이터를 json 형식 등으로 클라이언트에 응답한다. 클라이언트는 서버로부터 받은 데이터를 사용해 웹 페이지의 DOM을 구성하고 사용자가 정보를 화면을 통해 볼 수 있게 된다. 개발자 도구 Network 탭에서 분석을 해보면 클라이언트와 서버 간 패킷이 어떻게 전송되는지를 확인할 수 있다. 

![image](https://github.com/zisu17/zisu17.github.io/assets/108858121/8439800d-5117-41be-a198-3ce4211b1fc1)

위 캡쳐 화면을 보면 내가 조회 버튼을 누른 순간에 클라이언트에서 서버로 여러 요청을 날리는 것을 볼 수 있다. 최종적으로는 아래의 요청을 날려 내가 원하는 키워드 정보에 대한 응답을 받고 있었다. 

```
Request URL : https://datalab.naver.com/shoppingInsight/getCategoryKeywordRank.naver
Request Method : POST
Payload :  
{
    "cid": "50000167",
    "timeUnit": "date",
    "startDate": "2023-12-18",
    "endDate": "2023-12-18",
    "age": "20,30",
    "gender": "f",
    "device": "",
    "page": 1,
    "count": 20
}

Response :
{
  "message": null,
  "statusCode": 200,
  "returnCode": 0,
  "date": "",
  "datetime": "",
  "range": "2023.12.18. ~ 2023.12.18.",
  "ranks": [
    {"rank": 1, "keyword": "롱패딩", "linkId": "롱패딩"},
    {"rank": 2, "keyword": "여성롱패딩", "linkId": "여성롱패딩"},
    {"rank": 3, "keyword": "여자롱패딩", "linkId": "여자롱패딩"},
    {"rank": 4, "keyword": "여성패딩", "linkId": "여성패딩"},
    {"rank": 5, "keyword": "숏패딩", "linkId": "숏패딩"},
    {"rank": 6, "keyword": "패딩", "linkId": "패딩"},
    {"rank": 7, "keyword": "원피스", "linkId": "원피스"},
    {"rank": 8, "keyword": "니트원피스", "linkId": "니트원피스"},
    {"rank": 9, "keyword": "니트", "linkId": "니트"},
    {"rank": 10, "keyword": "코트", "linkId": "코트"},
    {"rank": 11, "keyword": "몽클레어패딩", "linkId": "몽클레어패딩"},
    {"rank": 12, "keyword": "무스탕", "linkId": "무스탕"},
    {"rank": 13, "keyword": "코듀로이팬츠", "linkId": "코듀로이팬츠"},
    {"rank": 14, "keyword": "노르딕니트", "linkId": "노르딕니트"},
    {"rank": 15, "keyword": "퍼자켓", "linkId": "퍼자켓"},
    {"rank": 16, "keyword": "프라다패딩", "linkId": "프라다패딩"},
    {"rank": 17, "keyword": "트위드원피스", "linkId": "트위드원피스"},
    {"rank": 18, "keyword": "몽클레어여성패딩", "linkId": "몽클레어여성패딩"},
    {"rank": 19, "keyword": "듀엘패딩", "linkId": "듀엘패딩"},
    {"rank": 20, "keyword": "톰보이코트", "linkId": "톰보이코트"}
  ]
}

```

같은 방식으로 해당 API를 request하면 원하는 데이터를 받을 수 있게 된다.

```python
import json
import requests
from datetime import datetime, timedelta

def extract_naver_fashion_keyword2():
    datalab_url = "https://datalab.naver.com/shoppingInsight/getCategoryKeywordRank.naver"
    yesterday = datetime.now() - timedelta(days=1)
    std_date = yesterday.strftime("%Y-%m-%d")
    payload = f'cid=50000167&timeUnit=date&startDate={std_date}&endDate={std_date}&age=20%2C30&gender=f&device=%20&page=1&count=20'
    headers = {
      'Referer': 'https://datalab.naver.com/shoppingInsight/sCategory.naver',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
    response = requests.request("POST", datalab_url, headers=headers, data=payload)
    data = json.loads(response.text)
    keywords = [item['keyword'] for item in data['ranks']]
    return keywords

```

아래는 셀레니움을 활용해 데이터를 스크래핑 할 때와 리퀘스트로 직접 API를 요청했을 때 걸리는 시간이다.

```python
start_time = datetime.now()
result1 = extract_naver_fashion_keyword()
end_time = datetime.now()

print("셀레니움을 활용한 스크래핑 소요시간 :", end_time - start_time)

start_time = datetime.now()
result2 = extract_naver_fashion_keyword2()
end_time = datetime.now()

print("리퀘스트를 활용한 스크래핑 소요시간 :", end_time - start_time)

print("셀레니움 결과 :", result1)
print("리퀘스트 결과 :", result2)
```

```
셀레니움을 활용한 스크래핑 소요시간 : 0:00:01.806942
리퀘스트를 활용한 스크래핑 소요시간 : 0:00:00.048473
셀레니움 결과 : ['원피스', '숏패딩', '니트원피스', '코트', '니트', '롱패딩', '여성패딩', '캐시미어코트', '핸드메이드코트', '트위드원피스', '코듀로이팬츠', '무스탕', '노르딕니트', '겨울원피스', '하프코트', '여성롱패딩', '톰보이코트', '패딩', '퍼자켓', '케네스레이디원피스']
리퀘스트 결과 : ['원피스', '숏패딩', '니트원피스', '코트', '니트', '롱패딩', '여성패딩', '캐시미어코트', '핸드메이드코트', '트위드원피스', '코듀로이팬츠', '무스탕', '노르딕니트', '겨울원피스', '하프코트', '여성롱패딩', '톰보이코트', '패딩', '퍼자켓', '케네스레이디원피스']
```

### 마무리
셀레니움은 좋은 스크래핑 툴이지만 관리 포인트가 많다. 예를 들어 웹 페이지 소스에 조금이라도 변동사항이 생기면 웹 요소를 못 찾는다거나 자동 업데이트 되는 크롬 브라우저 버전에 맞춰 드라이버 버전도 맞춰줘야 한다는 번거로움이 있다.
selenium 4.6 버전 이후로 webdriver-manager를 사용하지 않아도 웹 드라이버 자동설치가 가능하도록 개발되고 있는 거 같긴하다. 아직 stable한 버전은 아니지만 베타 버전이 나왔다. 근데 webdriver-manager 사용했을 때도 엄청 느렸기 때문에 기대가 크지 않다...
아무튼 여러모로 스크래핑을 빠르게 진행하도록 하는 방법이 많은데 사실 스크래핑은 무조건 빠르다고 좋은 것이 아니다. 실제로 스크래핑 데이터 파이프라인을 운영하다보면 너무 빨라서 문제가 되는 경우가 많다. 
대형 웹 사이트 같은 경우에 이런 식으로 짧은 시간 트래픽을 과도하게 발생시키는 자동화 봇은 막고 있기 때문에 무조건 빠르게 데이터를 스크래핑하도록 만들면 IP를 차단당하기 마련이다. 
해당 사이트 입장에서도 무리가 가지 않는 선에서 스크래핑 데이터 파이프라인을 만드는 것이 가장 좋은 방안이다. 



