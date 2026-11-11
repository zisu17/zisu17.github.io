---
title: "[Scraping] Selenium 없이 동적 웹페이지 데이터 가져오기"
excerpt: "개발자 도구에서 데이터 요청을 찾아 requests로 호출하고 Selenium 방식과 실행 시간을 비교한다."
nav_section: data
nav_topic: pipelines

categories:
  - Data Engineering
tags:
  - Data
  - Scraping
  - BeautifulSoup
  - Selenium

permalink: /data/[Scraping]-Selenium-없이-동적-웹페이지-스크래핑-하기/

toc: true
toc_sticky: true

date: 2023-12-12
last_modified_at: 2026-11-12
---

## HTML 응답과 브라우저 렌더링의 차이

![정적 응답과 동적 렌더링 비교](https://github.com/zisu17/zisu17.github.io/assets/108858121/7bcfdea6-6be7-4c67-8d73-21ae3b58027b)

서버가 처음 반환하는 HTML과 브라우저가 JavaScript를 실행한 뒤의 화면은 다를 수 있다. `requests`는 HTTP 응답을 받지만 JavaScript를 실행해 화면을 만들지는 않는다.

서버가 요청마다 HTML을 만들어 반환하는 페이지도 있고 초기 HTML을 받은 뒤 브라우저가 별도 요청으로 데이터를 가져오는 페이지도 있다. 동적 페이지라는 이유만으로 필요한 데이터가 HTML에 없다고 판단할 수는 없다. 사이트 규모보다 실제 응답에 원하는 데이터가 있는지를 먼저 확인해야 한다.

## 처음 받은 HTML에 필요한 데이터가 있을까?

이전에 Selenium을 requests와 BeautifulSoup으로 바꿔 스크래핑 시간을 줄였다는 글을 본 적이 있다. 도구를 바꾸기 전에 확인할 것은 필요한 데이터가 어디에 있는지이다.

처음 받은 HTML에 데이터가 있다면 `requests`와 BeautifulSoup으로 처리할 수 있다. HTML에 없다면 개발자 도구의 Network 탭에서 별도로 데이터를 가져오는 요청이 있는지 살펴본다. 그 응답을 직접 받을 수 있다면 JSON을 처리하는 방식도 가능하다. 브라우저 실행이나 사용자 조작이 꼭 필요한 경우에는 Selenium 같은 도구를 사용한다.

## Selenium으로 조회하기

당시 프로젝트에서 네이버 데이터랩의 날짜별 인기 검색어 20개가 필요했다. 원하는 데이터를 공개 API에서 찾지 못해 화면에서 조건을 선택하고 조회한 뒤 결과를 가져오는 방식으로 구현했다.

아래 URL과 CSS 선택자, 결과와 실행 시간은 2023년 실습 기록이다. 현재 사이트에서 다시 동작을 확인한 예제는 아니므로 사용하기 전에는 사이트 구조와 수집 허용 범위를 확인해야 한다.

![네이버 데이터랩 조회 조건 화면](https://github.com/zisu17/zisu17.github.io/assets/108858121/ab10d141-d6c4-45c3-a81b-5c117e610739)

JavaScript를 비활성화하자 드롭다운과 체크박스가 동작하지 않았다. 조건 선택과 조회 결과 표시가 JavaScript에 의존하고 있었기 때문이다.

![JavaScript를 비활성화한 데이터랩 화면](https://github.com/zisu17/zisu17.github.io/assets/108858121/0ea078e3-1980-49c2-a4bf-c2dfaa0a0ee8)

Selenium에서는 조건을 선택하고 조회 버튼을 누른 뒤 결과 요소가 나타날 때까지 기다린다. 작업이 끝나거나 오류가 나면 `finally`에서 브라우저를 종료한다.

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service

def extract_naver_fashion_keyword():
    driver_path = '/path/to/web-driver/chromedriver'
    service = Service(executable_path=driver_path)
    options = webdriver.ChromeOptions()
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--headless')
    options.add_argument('--window-size=1920,1080')
    options.add_argument("--disable-gpu")
    options.add_argument("--lang=ko-KR")
    options.add_argument("--incognito")
    driver = webdriver.Chrome(service=service, options=options)
    try:
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
    finally:
        driver.quit()
```

`driver_path`는 설치한 ChromeDriver 경로로 바꾼다. Selenium Manager에 드라이버 관리를 맡기려면 직접 지정한 `Service` 설정을 빼고 `webdriver.Chrome(options=options)`로 생성할 수 있다.

## 데이터 요청을 직접 확인하기

이 화면은 브라우저가 별도 요청으로 데이터를 받아 DOM을 만드는 방식이었다. 같은 응답을 직접 받을 수 있다면 브라우저를 실행하지 않고도 처리할 수 있다.

1. 클라이언트(웹 브라우저)는 서버에 필요한 정보를 담은 파라미터를 전송하면서 데이터를 요청한다.
2. 서버는 이 요청을 처리하고 요청된 데이터를 json 형식 등으로 클라이언트에 응답한다.
3. 클라이언트는 서버로부터 받은 데이터를 사용해 웹 페이지의 DOM을 구성하고 사용자에게 화면을 띄워 준다.

개발자 도구의 Network 탭을 연 상태에서 조회 버튼을 누르면 어떤 HTTP 요청이 추가되는지 확인할 수 있다. Fetch/XHR 요청의 URL과 메서드, 보낸 값과 응답 내용을 비교한다.

![개발자 도구에서 확인한 데이터 요청](https://github.com/zisu17/zisu17.github.io/assets/108858121/8439800d-5117-41be-a198-3ce4211b1fc1)

조회 버튼을 누르자 여러 요청이 발생했다. 그중 아래 POST 요청의 응답에 필요한 키워드 목록이 들어 있었다.

```text
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

같은 파라미터로 요청하면 HTML을 파싱하지 않고 JSON에서 키워드를 꺼낼 수 있다. 다만 개발자 도구에서 찾은 내부 요청은 공개 API와 다르다. 주소와 인증, 파라미터, 응답 구조가 바뀔 수 있으므로 제공자의 수집 정책과 호출 제한을 확인하고 허용된 범위에서 사용한다.

```python
import requests
from datetime import datetime, timedelta

def extract_naver_fashion_keyword2():
    datalab_url = "https://datalab.naver.com/shoppingInsight/getCategoryKeywordRank.naver"
    yesterday = datetime.now() - timedelta(days=1)
    std_date = yesterday.strftime("%Y-%m-%d")
    payload = {
        "cid": "50000167",
        "timeUnit": "date",
        "startDate": std_date,
        "endDate": std_date,
        "age": "20,30",
        "gender": "f",
        "device": "",
        "page": 1,
        "count": 20,
    }
    headers = {
      'Referer': 'https://datalab.naver.com/shoppingInsight/sCategory.naver',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
    response = requests.post(datalab_url, headers=headers, data=payload, timeout=(5, 15))
    response.raise_for_status()
    data = response.json()
    keywords = [item['keyword'] for item in data['ranks']]
    return keywords

```

`data=payload`는 값을 폼 형식으로 보낸다. 개발자 도구에서 확인한 요청이 JSON 형식이라면 `json=payload`처럼 실제 전송 형식에 맞춰야 한다. 두 방식을 무조건 바꿔 쓸 수는 없다.

`raise_for_status()`는 HTTP 오류 상태를 확인하고 `response.json()`은 응답 본문을 JSON으로 읽는다. HTTP 200이더라도 서비스가 오류 내용을 본문에 넣어 보낼 수 있으므로 필요한 `ranks` 필드가 있는지도 확인해야 한다. `timeout=(5, 15)`는 연결 대기와 읽기 대기의 제한이며 전체 작업 시간을 20초로 제한한다는 뜻은 아니다.

## 실행 시간 비교

아래는 작성 당시 Selenium과 requests로 실행해 기록한 결과다. 다시 비교할 때는 조회 날짜와 카테고리, 성별과 연령 조건부터 같게 맞춰야 한다. 특히 requests 예제의 날짜는 실행 시점의 어제로 계산된다. 이 한 번의 결과가 모든 사이트나 실행 환경의 성능 차이를 보장하는 것은 아니다.

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

```text
셀레니움을 활용한 스크래핑 소요시간 : 0:00:01.806942
리퀘스트를 활용한 스크래핑 소요시간 : 0:00:00.048473
셀레니움 결과 : ['원피스', '숏패딩', '니트원피스', '코트', '니트', '롱패딩', '여성패딩', '캐시미어코트', '핸드메이드코트', '트위드원피스', '코듀로이팬츠', '무스탕', '노르딕니트', '겨울원피스', '하프코트', '여성롱패딩', '톰보이코트', '패딩', '퍼자켓', '케네스레이디원피스']
리퀘스트 결과 : ['원피스', '숏패딩', '니트원피스', '코트', '니트', '롱패딩', '여성패딩', '캐시미어코트', '핸드메이드코트', '트위드원피스', '코듀로이팬츠', '무스탕', '노르딕니트', '겨울원피스', '하프코트', '여성롱패딩', '톰보이코트', '패딩', '퍼자켓', '케네스레이디원피스']
```

## 마무리

필요한 데이터 요청을 직접 찾을 수 있다면 브라우저 실행과 화면 조작을 생략할 수 있다. 이 예제에서는 그 차이로 실행 시간이 줄었다. 다만 내부 요청도 바뀔 수 있으므로 Selenium보다 항상 안정적이라고 볼 수는 없다.

Selenium을 쓸 때는 선택자와 대기 조건을 관리해야 한다. 드라이버는 Selenium 4.6부터 포함된 Selenium Manager를 이용해 관리할 수도 있다. 드라이버 설치와 페이지 요소 대기는 별개이므로 요소 대기 타임아웃이 나면 선택자와 로딩 상태를 확인한다.

스크래핑은 무조건 빠른 것이 좋은 것은 아니다. 짧은 시간에 요청을 몰아 보내면 상대 서버에 부하를 주거나 차단될 수 있다. 불필요한 재요청을 줄이고 사이트의 정책과 호출 제한에 맞춰 수집하는 것이 먼저다.

## 참고자료

- [MDN: 클라이언트와 서버의 요청·응답](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/First_steps/Client-Server_overview)
- [Requests: 응답 확인과 타임아웃](https://requests.readthedocs.io/en/latest/user/quickstart/)
- [Selenium Manager](https://www.selenium.dev/documentation/selenium_manager/)



