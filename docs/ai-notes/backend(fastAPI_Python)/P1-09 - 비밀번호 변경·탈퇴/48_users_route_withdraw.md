# Backend(FastAPI/Python) 48 — `DELETE /api/v1/users/me`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/users.py`의 `withdraw()` |
| 작업 | P1-09 비밀번호 변경·탈퇴: 회원 탈퇴 (PRD 01 FR-108) |
| 작성 | Claude (AI), 2026-10-07, 사용자 검토 |
| 이전 · 다음 | [47 `PUT /users/me/password`](47_users_route_change_password.md) · [49 `purge_withdrawn_accounts()`](49_retention_purge_withdrawn_accounts.md) |

## 1. 하는 일
| 요청 | 응답 |
|---|---|
| 본문 `{"password": "Abcdef1!"}` (맞음) | **204**와 `Set-Cookie: snx_refresh=""; Max-Age=0; Path=/api/v1/auth; HttpOnly; SameSite=lax`(쿠키 삭제) |
| 비밀번호가 틀림 | 400 `WRONG_PASSWORD`이고, 쿠키는 그대로라서 계속 로그인 상태입니다 |
| 본문 없음, `{}`, 빈 문자열 | 422이고, 탈퇴하지 않습니다 |
| 토큰 없음 | 401 |

**204로 응답한 뒤 (실제 앱으로 확인했습니다)**

| 무엇 | 결과 |
|---|---|
| 남아 있는 Access Token으로 `GET /users/me` | 401 |
| `POST /auth/refresh` | 401입니다. 쿠키가 지워졌기 때문입니다 |
| 같은 이메일과 비밀번호로 로그인 | 401 |
| 사진 주소 | 404 |

## 2. 언제 쓰나
| 화면 (userInfo.html, P1-10) | |
|---|---|
| Delete account → FIX-01 `promptDialog` (비밀번호 입력, `check` 안에서 이 API를 부름) | `api.delete('/users/me', { body: { password } })` |
| 204 | `clearAccessToken()`을 부르고 `home.html`로 이동합니다 |
| 400 `WRONG_PASSWORD` | 창 안에 "Password is incorrect."를 표시하고, 창은 닫히지 않습니다 (21번 `check`) |

### 함께 고친 것 (화면 쪽 메모)
`api.js`(P1-02)의 `api.delete(path, options)`는 두 번째 인자가 **옵션**입니다. 그래서 본문은 `{ body: … }` 안에 넣어야 합니다. 그런데 `userinfo.js` 템플릿 주석과 FIX-01 21번 문서의 예시가 `api.delete('/users/me', { password })`로 되어 있었습니다. 이대로 쓰면 본문 없이 요청이 가서 422가 납니다. 그래서 두 곳 모두 `{ body: { password } }`로 고쳤습니다.

## 3. 코드
**import** (파일 맨 위)
```python
from app.api.deps import CurrentUser, Db
from app.api.v1.auth import clear_refresh_cookie
```
**`clear_refresh_cookie` 줄을 이번에 추가했습니다** (P1-05 31).

**함수** (경로와 응답 설정은 템플릿 그대로입니다)
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
| `from app.api.v1.auth import clear_refresh_cookie` | 로그아웃(34)이 쓰는 쿠키 삭제 함수입니다. 쿠키를 심을 때와 같은 속성으로 지워야 브라우저가 같은 쿠키로 알아봅니다 |

| 식 | 뜻 |
|---|---|
| `@router.delete("/me", …)` | `DELETE /api/v1/users/me`입니다. 같은 주소의 `GET`, `PATCH`(41)와 요청 방법(메서드)만 다릅니다 |
| `data: WithdrawRequest` | DELETE 요청인데도 **본문**을 받습니다 (HTTP가 허용합니다). 비밀번호를 주소에 넣으면 서버 기록과 브라우저 기록에 남기 때문입니다 |
| `response: Response` | FastAPI가 넣어 주는 응답 객체입니다. 여기에 쿠키 삭제를 붙이면 204 응답에 함께 실려 갑니다 |

## 4. 흐름
토큰을 확인하고(06), 본문을 검사한 뒤, 46번(비밀번호 확인 → 탈퇴 상태, 사진 처리, 저장)을 실행합니다. 그다음 쿠키를 지우고 204로 응답합니다.

46번이 오류(400)를 던지면 쿠키 삭제 줄까지 오지 않습니다. 그래서 계속 로그인 상태로 남습니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 쿠키는 **탈퇴에 성공한 뒤에만** 지움 | 비밀번호를 틀렸는데 로그아웃되면 안 됩니다 (시험으로 확인했습니다) |
| 쿠키를 지운 뒤에도 30번이 한 번 더 막음 | 다른 브라우저나 기기에 남은 쿠키는 이 응답으로 지울 수 없습니다. 그 쿠키로 재발급을 시도하면 30번 `get_active_user`가 `DELETED` 상태를 보고 401로 응답합니다 |
| 비밀번호는 본문으로 받음 | 주소(`?password=`)는 서버 접속 기록과 브라우저 방문 기록에 남습니다 |
| 204로 응답 | 탈퇴한 사람에게 돌려줄 정보가 없습니다 |

## 6. 시험 (`tests/test_user_routes.py`에 6개를 추가해서 모두 38개, 실제 앱과 MySQL, 임시 폴더로 실행)
| 시험 | 확인한 것 |
|---|---|
| 탈퇴 (실제 로그인 → 사진 올리기 → 재발급 200 → 탈퇴) | 204, 본문 없음, 쿠키 삭제 헤더(`Max-Age=0`, `Path=/api/v1/auth`)를 확인했습니다. 그 뒤 남은 토큰 401, 재발급 401, 다시 로그인 401, 사진 404이고 DB는 `DELETED`입니다 |
| 비밀번호가 틀림 | 400 `WRONG_PASSWORD`이고, 쿠키 삭제 헤더가 없으며, 내 정보 200과 재발급 200이 그대로 됩니다 |
| 본문 없음, `{}`, 빈 문자열 | 422이고, DB는 `ACTIVE` 그대로입니다 |
| 토큰 없음 | 401 |

전체 시험 344개가 통과했고, `ruff` 검사도 통과했습니다.
