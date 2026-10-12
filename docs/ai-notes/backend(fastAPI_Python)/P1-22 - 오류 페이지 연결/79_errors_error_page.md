# Backend(FastAPI/Python) 79 — `error_page()` (오류 페이지 HTML 만들기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/core/errors.py` |
| 작업 | P1-22 오류 페이지 연결: 상태 코드에 맞는 오류 페이지를 같은 상태 코드로 돌려주기 (PRD 01 FR-116) |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 이전 · 다음 | [78 `is_api_request()`](78_errors_is_api_request.md) · 80 `http_error_handler` 수정 (다음) |

## 1. 하는 일
상태 코드(404, 500 등)를 받아서, 그 번호의 **오류 페이지 HTML 파일**을 같은 상태 코드의 응답으로 만들어 줍니다. 78번이 "화면 요청"이라고 판단했을 때 오류 처리기가 이 함수를 부릅니다.

| 받은 상태 | 보여 주는 페이지 | 응답 상태 |
|---|---|---|
| 400, 403, 404, 429, 500, 503, 504 | 같은 번호의 페이지 (`errors/404.html` 등) | 그대로 |
| 405, 401, 409, 413, 415, 422 같은 나머지 4xx | `errors/400.html` | **원래 번호 그대로** |
| 501, 502, 507 같은 나머지 5xx | `errors/500.html` | **원래 번호 그대로** |

## 2. 언제 쓰나
| 호출하는 곳 | 용도 |
|---|---|
| 80 `http_error_handler` | 화면 요청의 404, 405 등 |
| 81 `unexpected_error_handler` | 화면 요청의 500 |

## 3. 코드
**import** (이번에 추가한 것만)
```python
from fastapi.responses import FileResponse, JSONResponse   # FileResponse 추가
from app.core.config import ROOT_DIR, get_settings          # ROOT_DIR 추가
```
`ERROR_PAGES` 표(번호 → 파일 경로)는 템플릿에 이미 있었습니다.

**함수**
```python
def error_page(status_code: int) -> FileResponse:
    if status_code in ERROR_PAGES:
        page = ERROR_PAGES[status_code]
    elif status_code >= 500:
        page = ERROR_PAGES[500]
    else:
        page = ERROR_PAGES[400]
    return FileResponse(ROOT_DIR / "frontend" / page, status_code=status_code)
```
백엔드(Python)는 지금 방식 그대로여서 "최신 문법" 버전은 따로 두지 않습니다.

### 문법 풀이
| 식 | 뜻 | 예 |
|---|---|---|
| `ERROR_PAGES[status_code]` | 표에서 번호로 파일 경로를 찾습니다 | `404` → `"errors/404.html"` |
| `status_code in ERROR_PAGES` | 표에 그 번호가 있는지 확인합니다 | `405 in ERROR_PAGES` → `False` |
| `ROOT_DIR / "frontend" / page` | 경로 이어 붙이기입니다 (`pathlib`) | `…/studionx/frontend/errors/404.html` |
| `FileResponse(경로, status_code=…)` | 파일 내용을 응답으로 보냅니다. 상태 코드를 직접 정할 수 있습니다 | 404 페이지를 상태 404로 |

## 4. 흐름
1. 상태 코드가 표(`ERROR_PAGES`)에 있으면 그 파일을 고릅니다.
2. 없으면 500 이상은 500 페이지, 그 밖은 400 페이지를 고릅니다.
3. 고른 파일을 **원래 상태 코드로** 응답합니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 상태 코드를 200으로 바꾸지 않고 원래 번호 유지 | 브라우저, 검색 로봇, 모니터링(Sentry)이 진짜 오류로 인식해야 합니다. 페이지의 큰 숫자와 응답 번호가 같아야 "숫자 자체가 신호"라는 디자인과도 맞습니다 |
| 표에 없는 번호는 400, 500 페이지로 대신함 | 오류 페이지는 7종뿐이라서, 405 같은 번호마다 새 화면을 만들지 않고 가장 가까운 것을 씁니다. 번호가 다른 페이지가 나올 수 있어도 상태는 맞게 나갑니다 |
| 5xx는 500 페이지, 나머지는 400 페이지 | 서버 잘못(5xx)과 요청 잘못(4xx)의 문구가 다르기 때문입니다 |
| 파일을 매번 새로 읽음 (`FileResponse`) | 오류는 드물어서 부담이 없고, 페이지를 고쳐도 서버를 다시 켜지 않아도 됩니다 |
| 표를 코드에 두지 않고 `ERROR_PAGES` 재사용 | 같은 표를 `core/site_files.py`의 404 처리도 씁니다 |

## 6. 시험 (`tests/test_error_page.py`, 17개)
| 시험 | 결과 |
|---|---|
| 표에 있는 7개 번호 각각 | 같은 번호의 파일 경로, 상태 코드, `text/html` |
| 표에 없는 4xx 6개 (401, 405, 409, 413, 415, 422) | `errors/400.html`을 쓰고 상태는 원래 번호 |
| 표에 없는 5xx 3개 (501, 502, 507) | `errors/500.html`을 쓰고 상태는 원래 번호 |
| 7개 페이지 파일이 실제로 있고 자기 번호가 들어 있음 | 통과입니다 |

17개 모두 통과했습니다 (78번 18개와 합쳐 35개). `ruff`도 통과했습니다.
