# AI 구현 설명 57 — P1-22 오류 페이지 백엔드 연결 (화면은 HTML, API는 JSON)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-13 |
| 작업 | P1-22 오류 페이지 연결: PRD 01 FR-116 (오류가 나면 화면 요청에는 오류 페이지, API 요청에는 JSON) |
| 브랜치 | `feature/phase1/p1-22-error-pages` |
| 바꾼 파일 | `app/core/errors.py` / 시험 `tests/test_is_api_request.py`, `test_error_page.py`, `test_http_error_pages.py`, `test_errors.py`(주소 4곳) |
| 진행 방식 | **함수 하나씩** 구현하고 사용자가 검토한 뒤 다음 함수로 넘어갔습니다 |
| 함수별 설명 | `docs/ai-notes/backend(fastAPI_Python)/P1-22 - 오류 페이지 연결/78 ~ 81` (md, PDF), 합본 `P1-22_error_pages.pdf` |
| 실제 서버 시험 | [58_p1-22_site_test.md](58_p1-22_site_test.md): 서버 요청과 브라우저로 모두 통과 |
| 이전 문서 | [56_p1-17_site_test.md](56_p1-17_site_test.md) |

## 1. 한 일
오류 페이지 7종(`errors/400, 403, 404, 429, 500, 503, 504.html`)과 없는 주소의 404 처리는 전에 만들어져 있었지만, 서버가 나머지 오류를 **화면 요청에도 JSON으로** 돌려주고 있었습니다. 이제는 요청이 API인지 화면인지 가려서 답합니다.

| 요청 | 오류가 났을 때 응답 |
|---|---|
| API (`/api/v1/…`) | JSON `{"error": {"code", "message", "details"}}` (JS가 `error.code`로 분기합니다) |
| 화면 (그 밖의 주소) | 오류 페이지 HTML, 상태 코드는 그대로 |

![서버가 예상 못 한 오류를 낸 화면 주소: 500 오류 페이지](images/backend_p1-22/58_500_page.png)

## 2. 항목
| # | 함수 | 하는 일 | 설명 |
|---|---|---|---|
| 78 | `is_api_request()` | 주소가 `/api/v1`이거나 그 아래이면 API (`/api/v10` 같은 비슷한 주소는 아님) | [78](<backend(fastAPI_Python)/P1-22 - 오류 페이지 연결/78_errors_is_api_request.md>) |
| 79 | `error_page()` | 상태 코드에 맞는 오류 페이지를 같은 상태로 돌려줍니다. 페이지가 없는 번호는 4xx → 400 페이지, 5xx → 500 페이지 | [79](<backend(fastAPI_Python)/P1-22 - 오류 페이지 연결/79_errors_error_page.md>) |
| 80 | `http_error_handler()` 수정 | 404, 405 등 기본 오류: 화면이면 HTML, API이면 JSON, 헤더는 유지 | [80](<backend(fastAPI_Python)/P1-22 - 오류 페이지 연결/80_errors_http_error_handler.md>) |
| 81 | `unexpected_error_handler()` 수정 | 예상 못 한 500도 같은 기준 | [81](<backend(fastAPI_Python)/P1-22 - 오류 페이지 연결/81_errors_unexpected_error_handler.md>) |

## 3. 결정과 달라진 점
| 항목 | 내용 | 이유 |
|---|---|---|
| 상태 코드 유지 | 오류 페이지도 200이 아니라 원래 번호로 응답합니다 | 브라우저, 검색 로봇, Sentry가 진짜 오류로 인식해야 하고, "숫자 자체가 신호"라는 디자인과 맞습니다 |
| 가르는 기준 | `Accept` 헤더가 아니라 **주소**입니다 | 단순하고, 이미 있던 없는 주소 처리(`SiteFiles`)와 같은 기준입니다 |
| `AppError`, 입력 검사 처리기 | 그대로 JSON | 이 오류는 `/api/v1` 라우터 안에서만 나므로 화면 요청에서는 생기지 않습니다 |
| 503(점검 모드) | **하지 않음** | 계획서에서 선택 사항입니다. 점검 모드 설정이 생길 때 같은 `error_page(503)`을 쓰면 됩니다 |
| 기존 시험 | `test_errors.py`의 시험 4개가 API가 아닌 주소(`/teapot`, `/bug` 등)에서 JSON을 기대해서, 주소를 `/api/v1/…`로 옮겼습니다 | 이제는 그런 주소에서 HTML이 돌아오는 것이 맞는 동작입니다. 시험의 목적(오류 형식 확인)은 같습니다 |

## 4. 시험
| 방법 | 대상 | 결과 |
|---|---|---|
| 서비스 시험 | 78 ~ 81 | `test_is_api_request.py` 18개, `test_error_page.py` 17개, `test_http_error_pages.py` 9개: 모두 통과 |
| 백엔드 pytest 전체 | | **568개 통과**, `ruff` 통과 |
| 실제 서버, 브라우저 ([58](58_p1-22_site_test.md)) | 화면과 API의 404, 405, 500 | **모두 통과** |

## 5. 다음 작업, 남은 것
| 작업 | 내용 |
|---|---|
| **P1-21** | `feature/phase1/p1-21-dev-notes…`: Development 공지 API(`GET /dev-notes`)와 SQLAdmin 관리자 화면(`/admin`) 마무리 |
| P1-18 | 가입, 로그인, 재발급, 다른 사람 프로젝트 접근 차단, 탈퇴 계정 로그인 회귀 시험 |
| P1-19 | ai-notes 정리와 `develop`으로 PR. 그 뒤 `home.html` 등 화면을 점검하고 S1-05(오디오 엔진)로 갑니다 |
| 알게 된 것 (그대로 둠) | 실제 서버에서 405 응답에 `Allow` 헤더가 붙지 않습니다. 정적 파일 마운트(`/`)가 먼저 잡아서 생기는 P1-03 이전부터의 동작이고, 화면과 API 모두 상태와 본문은 맞습니다. 필요해지면 따로 고칩니다 |
