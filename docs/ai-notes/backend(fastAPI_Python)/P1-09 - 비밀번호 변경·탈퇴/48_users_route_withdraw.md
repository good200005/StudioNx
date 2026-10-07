# Backend(FastAPI/Python) 48 — `DELETE /api/v1/users/me`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/users.py` — `withdraw()` |
| 작업 | P1-09 비밀번호 변경 · 탈퇴 — 회원 탈퇴 · PRD 01 FR-108 |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [47 `PUT /users/me/password`](47_users_route_change_password.md) · [49 `purge_withdrawn_accounts()`](49_retention_purge_withdrawn_accounts.md) |

## 1. 하는 일
| 요청 | 응답 |
|---|---|
| 본문 `{"password": "Abcdef1!"}` (맞음) | **204** + `Set-Cookie: snx_refresh=""; Max-Age=0; Path=/api/v1/auth; HttpOnly; SameSite=lax` (쿠키 삭제) |
| 비밀번호 틀림 | 400 `WRONG_PASSWORD` — 쿠키 그대로, 계속 로그인 상태 |
| 본문 없음 · `{}` · 빈 글자 | 422 — 탈퇴하지 않음 |
| 토큰 없음 | 401 |

**204 뒤 (실제 앱으로 확인)**

| 무엇 | 결과 |
|---|---|
| 남은 Access Token 으로 `GET /users/me` | 401 |
| `POST /auth/refresh` | 401 — 쿠키가 지워짐 |
| 같은 이메일 · 비밀번호로 로그인 | 401 |
| 사진 주소 | 404 |

## 2. 언제 쓰나
| 화면 (userInfo.html, P1-10) | |
|---|---|
| Delete account → FIX-01 `promptDialog` (비밀번호, `check` 안에서 이 API) | `api.delete('/users/me', { body: { password } })` |
| 204 | `clearAccessToken()` → `home.html` |
| 400 `WRONG_PASSWORD` | 창 안 "Password is incorrect." — 창이 닫히지 않음 (21 `check`) |

### 함께 고친 것 — 화면 쪽 메모
`api.js`(P1-02)의 `api.delete(path, options)` 는 두 번째 인자가 **옵션**이다. 본문은 `{ body: … }` 로 넣어야 한다. `userinfo.js` 템플릿 주석과 FIX-01 21 문서의 예시가 `api.delete('/users/me', { password })` 로 되어 있어 — 그대로 쓰면 본문 없이 가서 422 — 둘 다 `{ body: { password } }` 로 고쳤다.

## 3. 코드
**import** (파일 맨 위)
```python
from app.api.deps import CurrentUser, Db
from app.api.v1.auth import clear_refresh_cookie
```
**`clear_refresh_cookie` 줄을 이번에 추가했다** (P1-05 31).

**함수** (경로 · 응답 설정은 템플릿 그대로)
```python
@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={400: {"model": ErrorResponse}},
)
def withdraw(data: WithdrawRequest, response: Response, user: CurrentUser, db: Db) -> None:
    user_service.withdraw(db, user, data.password)
    clear_refresh_cookie(response)
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from app.api.v1.auth import clear_refresh_cookie` | 로그아웃(34)이 쓰는 쿠키 지우기 — 심을 때와 같은 속성으로 지워야 브라우저가 같은 쿠키로 알아봄 |

| 식 | 뜻 |
|---|---|
| `@router.delete("/me", …)` | `DELETE /api/v1/users/me` — 같은 주소의 `GET` · `PATCH` (41) 와 방법(메서드)만 다름 |
| `data: WithdrawRequest` | DELETE 인데도 **본문**을 받음 (HTTP 가 허용함). 비밀번호를 주소에 넣으면 서버 기록 · 브라우저 기록에 남기 때문 |
| `response: Response` | FastAPI 가 넣어 주는 응답 객체 — 여기에 쿠키 삭제를 붙이면 204 응답에 실려 감 |

## 4. 흐름
토큰 확인(06) → 본문 검사 → 46 (비밀번호 → 탈퇴 상태 · 사진 · 저장) → 쿠키 삭제 → 204.
46 이 오류(400)를 던지면 쿠키 삭제 줄까지 오지 않는다 → 계속 로그인 상태.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 쿠키 삭제는 **탈퇴 성공 뒤에만** | 비밀번호를 틀렸는데 로그아웃되면 안 된다 (시험으로 확인) |
| 쿠키를 지워도 30 이 이중으로 막음 | 다른 브라우저 · 기기에 남은 쿠키는 이 응답이 지울 수 없다 — 그 쿠키로 재발급을 시도하면 30 `get_active_user` 가 `DELETED` 를 보고 401 |
| 비밀번호는 본문으로 | 주소(`?password=`)는 서버 접속 기록 · 브라우저 방문 기록에 남는다 |
| 204 | 탈퇴한 사람에게 돌려줄 정보가 없다 |

## 6. 시험 (`tests/test_user_routes.py` 에 6개 추가 · 모두 38개, 실제 앱 + MySQL + 임시 폴더)
| 시험 | 확인한 것 |
|---|---|
| 탈퇴 (실제 로그인 → 사진 → 재발급 200 → 탈퇴) | 204 · 본문 없음 · 쿠키 삭제 헤더(`Max-Age=0`, `Path=/api/v1/auth`) → 남은 토큰 401 · 재발급 401 · 다시 로그인 401 · 사진 404 · DB `DELETED` |
| 비밀번호 틀림 | 400 `WRONG_PASSWORD`, 쿠키 삭제 헤더 없음, 내 정보 200 · 재발급 200 그대로 |
| 본문 없음 · `{}` · 빈 글자 | 422, DB `ACTIVE` 그대로 |
| 토큰 없음 | 401 |

전체 시험 344개 통과, `ruff` 검사 통과.
