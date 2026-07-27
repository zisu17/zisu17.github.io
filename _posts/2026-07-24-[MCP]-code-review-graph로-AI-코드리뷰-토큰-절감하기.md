---
title: "[MCP] code-review-graph로 AI 코드리뷰 토큰 절감하기"
excerpt: "로컬 코드 인텔리전스 그래프 MCP인 code-review-graph를 설치해 Claude Code에 등록하고, AI 코드리뷰의 토큰 사용량을 줄이는 방법을 정리한다."

categories:
  - Dev
tags:
  - Dev
  - MCP
  - ClaudeCode
  - CodeReview

permalink: /dev/code-review-graph-mcp-setup/

toc: true
toc_sticky: true
published: false

date: 2026-07-24
last_modified_at: 2026-07-24
---

## 1. 배경: AI 코드리뷰는 왜 토큰을 태우는가

AI에게 코드리뷰를 시키면 보통 관련 파일을 통째로 컨텍스트에 밀어 넣는다.

파일 하나를 고쳐도 그 파일을 부르는 곳, 그 파일이 부르는 대상, 관련 테스트까지 봐야 하기 때문이다. 저장소가 크면 이 과정에서 토큰이 폭발하고 비용과 속도가 나빠진다.

**code-review-graph**는 코드베이스를 미리 파싱해 구조를 그래프로 만들어 두고, 변경이 생기면 영향받는 코드만 골라 읽게 하는 로컬 우선 도구다.

파싱은 **Tree-sitter**, 저장은 로컬 **SQLite**를 쓰고, 결과를 **MCP(Model Context Protocol)**로 노출해 Claude Code 같은 도구가 바로 쓸 수 있게 한다. 40여 개 언어를 지원하고 MCP 도구를 약 30종 제공한다. 프로젝트가 밝힌 수치로는 질문당 토큰이 중앙값 기준 약 82배 줄어든다.

본문의 경로·명령 예시는 모두 예시 값이다. 실제 환경에 맞게 바꿔 쓰면 된다.

---

## 2. 동작 원리: 코드 인텔리전스 그래프

그래프는 두 가지로 구성된다.

- **노드**: 함수, 클래스, import 같은 코드 단위
- **엣지**: 호출 관계, 상속 관계, 테스트 커버리지 같은 연결

이 구조가 있으면 어떤 파일을 바꿨을 때 영향받는 모든 파일, 즉 **blast radius(영향 반경)**를 계산할 수 있다.

> 정확한 리뷰를 하려면 저장소 전체를 다 읽어야 하지 않을까?

그렇지 않다. 그래프가 실제 의존 관계를 이미 알고 있어서, 변경과 연결된 코드만 정확히 짚어낸다. 리뷰에 필요한 파일만 읽으므로 토큰이 크게 줄어든다.

전체 파이프라인은 다음 흐름으로 돈다.

```text
소스 파일  →  Tree-sitter 파싱  →  그래프 DB (SQLite)  →  blast radius 계산  →  영향받는 파일만 LLM에 투입
```

도구를 쓰는 경로는 두 가지이고, 둘은 같은 그래프 DB(`.code-review-graph/`)를 공유한다.

```text
그래프 DB (.code-review-graph/)
├─ 터미널 CLI          : code-review-graph ...
└─ Claude 안 MCP 도구  : mcp__code-review-graph__*
```

---

## 3. 설치와 등록

패키지는 PyPI에 `code-review-graph`로 올라와 있고 Python 3.10 이상을 요구한다. 격리 설치 도구인 pipx로 설치하는 것을 권장한다.

```bash
pipx install code-review-graph
```

설치하면 `code-review-graph`와 `crg-daemon` 두 실행 파일이 생긴다.

MCP 서버는 `serve` 서브커맨드가 stdio로 띄운다. Claude Code에는 `claude mcp add`로 등록하고, `--scope user`를 주면 모든 프로젝트에서 쓸 수 있다.

```bash
claude mcp add code-review-graph --scope user -- code-review-graph serve
```

등록과 연결 상태는 다음으로 확인한다.

```bash
claude mcp list
claude mcp get code-review-graph
```

등록 직후에는 실행 중이던 세션에 도구가 바로 뜨지 않는다. 새 도구를 쓰려면 그 세션에서 Claude Code를 재시작한다.

Cursor, Windsurf 같은 다른 툴까지 한 번에 설정하려면 `code-review-graph install`을 쓴다. 감지된 AI 코딩 플랫폼의 MCP 설정을 자동으로 잡아준다.

---

## 4. CLI로 그래프 다루기

실제 사용은 코드 저장소 안에서 이뤄진다. 최초 한 번 빌드하고, 이후에는 증분 갱신이나 자동 감시로 유지한다.

```bash
cd ~/projects/my-app

code-review-graph build     # 최초 전체 빌드
code-review-graph status    # 노드/엣지/언어/마지막 갱신 확인
code-review-graph watch     # 파일 변경 감지 후 자동 증분 갱신
```

자주 쓰는 명령은 다음과 같다.

| 명령 | 용도 |
|---|---|
| `build` | 전체 그래프 빌드 (최초 1회) |
| `update --base HEAD~1` | 변경 파일만 증분 갱신 |
| `watch` | 파일 변경 감지 후 자동 갱신 |
| `status --json` | 그래프 통계 확인 |
| `detect-changes --brief` | 변경 영향과 토큰 절감 패널 출력 (재파싱 없음, 읽기 전용) |
| `impact --files a.py b.py --depth 2` | 지정 파일의 blast radius |
| `search "login" --kind Function` | 이름/키워드로 엔티티 검색 |
| `query callers_of UserService.save` | 관계 질의 |
| `embed --provider local` | 의미 검색용 임베딩 생성 |

`query`가 지원하는 관계 패턴은 `callers_of`, `callees_of`, `imports_of`, `importers_of`, `children_of`, `tests_for`, `inheritors_of`, `file_summary`다. 이벤트나 엔드포인트, 스케줄러 구조를 다루는 프로젝트라면 `triggers_of`, `handlers_of` 같은 패턴도 함께 제공된다.

---

## 5. Claude 안에서 MCP 도구로 쓰기

Claude는 필요한 도구를 알아서 호출한다. 어떤 도구가 있는지 알아 두면 콕 집어 요청할 수 있다.

가장 먼저 불리는 것은 `get_minimal_context_tool`이다. 그래프 통계와 위험도, 다음에 쓸 도구 추천을 약 100토큰의 작은 응답으로 돌려준다. 여기서 시작해 토큰을 아끼는 구조다.

| MCP 도구 | 역할 |
|---|---|
| `get_minimal_context_tool` | 항상 먼저 호출. 통계와 위험도, 다음 도구 추천을 압축 제공 |
| `build_or_update_graph_tool` | 그래프 빌드 또는 증분 갱신 |
| `get_impact_radius_tool` | 변경의 영향 반경(함수/클래스/파일) |
| `query_graph_tool` | 관계 질의 (callers_of 등) |
| `semantic_search_nodes_tool` | 의미 기반 검색 (임베딩 있으면 벡터, 없으면 키워드) |
| `traverse_graph_tool` | 토큰 예산 안에서 그래프 탐색 |
| `get_hub_nodes_tool` | 연결이 가장 많은 핵심 노드 (변경 위험이 큰 지점) |
| `get_knowledge_gaps_tool` | 테스트 없는 핫스팟 등 구조적 약점 |

Claude에게는 자연어로 요청하면 된다.

- "이 브랜치 변경의 영향 반경을 분석해줘"
- "`UserService`를 호출하는 곳을 전부 찾아줘"
- "로그인 관련 코드가 어디 있는지 의미 검색해줘"

의미 검색을 제대로 쓰려면 임베딩을 먼저 만들어야 한다. 로컬 임베딩은 소스를 외부로 보내지 않는다. 클라우드 제공자(`openai`, `google`, `minimax`)는 소스에서 파생된 텍스트를 API로 전송하고 비용이 발생하므로, 사내 코드라면 `local`을 권장한다.

```bash
pip install 'code-review-graph[embeddings]'
code-review-graph embed --provider local
```

---

## 6. 정리

- code-review-graph는 코드베이스를 Tree-sitter로 파싱해 로컬 그래프로 만들고, 변경의 blast radius만 골라 읽게 해 AI 코드리뷰의 토큰을 줄이는 로컬 우선 MCP다.
- 설치는 `pipx install code-review-graph`, 등록은 `claude mcp add code-review-graph --scope user -- code-review-graph serve`로 끝난다. 등록 후에는 세션을 재시작해야 도구가 뜬다.
- CLI(`build`, `watch`, `detect-changes`)와 Claude 안의 MCP 도구(`get_minimal_context_tool`부터 시작)는 같은 그래프 DB를 공유한다.
- 의미 검색이 필요하면 임베딩을 만들되, 사내 코드는 소스를 외부로 보내지 않는 `local` 제공자를 쓴다.
