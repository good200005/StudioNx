# Backend(FastAPI/Python) 69 — `GET /me/dashboard` 라우터 (`read_dashboard()`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/me.py` |
| 작업 | P1-16 대시보드 API: 마이페이지가 부르는 API 주소 (PRD 01 FR-121, FR-128) |
| 작성 | Claude (AI), 2026-10-12, 사용자 검토 |
| 이전 · 다음 | [68 `get_dashboard()`](68_dashboard_get_dashboard.md) · (P1-16 끝, 사이트 시험은 개요 문서에서) |

## 1. 하는 일
로그인한 회원의 마이페이지 정보를 **요청 한 번으로** 돌려주는 API입니다. 계산은 68번 `get_dashboard`가 모두 하고, 이 라우터는 "로그인한 회원과 DB 세션을 넘기고 결과를 응답으로 내보내는" 일만 합니다.

`GET /api/v1/me/dashboard` + `Authorization: Bearer <Access Token>` → 200 `DashboardResponse`

| 요청 | 응답 |
|---|---|
| 토큰이 없거나 만료됨 | 401 `UNAUTHORIZED` ("Please sign in.") |
| 탈퇴하거나 정지된 회원의 토큰 | 401 `UNAUTHORIZED` ("Please sign in again.") |
| 정상 | 200, `user`, `storage`, `ai`, `ready_projects`, `recent_projects` 다섯 칸 |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| `pages/mypage.js`의 `loadDashboard()` (P1-17) | myPage.html을 열 때 한 번 |

주소에 회원 번호를 받는 칸이 없습니다. 항상 **토큰의 주인 본인**의 대시보드만 나오므로, 번호를 바꿔 남의 정보를 보는 일이 구조적으로 불가능합니다.

## 3. 코드
**import** (이번에 추가한 것만)
```python
from app.services import dashboard_service
```
`router`, `CurrentUser`, `Db`, `ErrorResponse`, `DashboardResponse`는 템플릿에 이미 있었습니다.

**함수**
```python
@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    responses={401: {"model": ErrorResponse}},
)
def read_dashboard(user: CurrentUser, db: Db) -> DashboardResponse:
    return dashboard_service.get_dashboard(db, user)
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `@router.get("/dashboard", …)` | 이 함수를 `GET /me/dashboard`에 연결합니다. 앞의 `/me`는 `router.py`에서 붙입니다 |
| `response_model=DashboardResponse` | 돌려주는 값을 이 모양으로 걸러서 JSON으로 만듭니다. 문서(`/docs`)에도 같은 모양이 나옵니다 |
| `responses={401: …}` | `/docs`에 401 응답 모양을 보여 주기 위한 표시입니다. 동작은 바꾸지 않습니다 |
| `user: CurrentUser` | FastAPI가 이 함수보다 **먼저** 06번 `get_current_user`를 실행해서, 검사를 통과한 회원을 넣어 줍니다 |
| `db: Db` | 요청마다 DB 세션을 열고, 끝나면 닫아 줍니다 |

## 4. 흐름
1. FastAPI가 `Authorization` 헤더를 검사합니다 (05, 06번). 실패하면 401로 응답하고 이 함수는 실행되지 않습니다.
2. 통과하면 회원(`user`)과 DB 세션(`db`)이 들어와 `read_dashboard`가 실행됩니다.
3. `get_dashboard`가 만든 `DashboardResponse`를 그대로 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 라우터에는 계산을 넣지 않음 | 계산은 서비스(63~68번)에 모아 두었기 때문에, 서비스는 서버를 켜지 않고도 시험할 수 있습니다 |
| `CurrentUser`를 씀 (`OptionalUser`가 아님) | 마이페이지는 로그인한 사람만 봅니다. 손님이면 라우터까지 오기 전에 401로 막습니다 |
| 요청 한 번으로 모두 돌려줌 | 마이페이지는 열 때 모든 칸이 필요하므로, 요청을 나누면 화면이 조금씩 채워지며 깜빡입니다 |
| 오류 처리를 따로 쓰지 않음 | 401은 `get_current_user`가, 예상 못 한 오류는 04번 처리기가 같은 JSON 모양으로 응답합니다 |

## 6. 시험 (`tests/test_me_routes.py`, 모두 5개)
실제 앱과 실제 MySQL로 요청했습니다 (`dependency_overrides`로 시험용 DB 세션을 넣고, 끝나면 되돌립니다).

| 시험 | 확인한 것 |
|---|---|
| 주소 연결 | `/api/v1/me/dashboard`에 `GET`이 등록되어 있습니다 |
| 토큰 없음 | 401, 오류 코드 `UNAUTHORIZED` |
| 정상 요청 | 200, 다섯 칸, 이메일, 사진 `null`, 저장 한도 5GB, AI 한도 5/30이 맞고, `password_hash`가 응답 어디에도 없습니다 |
| 내 프로젝트만 | 다른 회원의 프로젝트는 최근 목록과 이어 하기 목록 어디에도 나오지 않습니다 |
| 탈퇴한 회원 | 유효한 토큰이어도 401입니다 |

전체 시험 521개가 통과했고, `ruff` 검사도 통과했습니다.
