# Backend(FastAPI/Python) 23 — 라우터 `GET /api/v1/auth/check-email`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/auth.py` (함수 이름 `check_email`) · `requirements.txt` |
| 작업 | P1-04 회원가입 — 이메일 실시간 중복 확인 API · PRD 01 FR-101 · FR-108 |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [22 `POST /auth/signup`](22_auth_route_signup.md) · [24 `GET /auth/check-nickname`](24_auth_route_check_nickname.md) |

## 1. 하는 일
주소의 `?email=` 값을 받아 **형식을 검사**하고, 19 `check_email()` 의 결과를 그대로 돌려준다.

| 요청 | 응답 |
|---|---|
| `GET /api/v1/auth/check-email?email=free@example.com` | 200 `{"available": true, "reason": null, "available_at": null}` |
| `…?email=ROUTE.user@example.COM` (이미 가입) | 200 `{"available": false, "reason": "TAKEN", …}` |
| `…?email=gone@example.com` (탈퇴 1일) | 200 `{"available": false, "reason": "REJOIN_TOO_SOON", "available_at": "2026-10-09T03:00:00Z"}` |
| `…?email=abc` (형식 틀림) | **422** `{"error": {"code": "VALIDATION_ERROR", "details": {"email": "value is not a valid email address: An email address must have an @-sign."}}}` |
| `…` (`email` 없음) | 422 |

## 2. 언제 쓰나
join.html 이메일 칸 옆 **Check** 버튼 → `join.js`(P1-07) 가 이 주소로 묻는다.

| 응답 | 이메일 칸 아래 문구 (P1-07) |
|---|---|
| `available: true` | ✓ Available |
| `TAKEN` | This email is already in use. |
| `REJOIN_TOO_SOON` | You can sign up again after Oct 9. (`available_at` 을 사용자 시간대로) |
| 422 | Enter a valid email address. |

**형식이 틀리면 422 인 이유 (2026-10-07 결정):** "이미 사용 중"(200 · `available: false`)과 "형식이 틀림"(422)을 구분해 다른 문구를 보여 준다. 가입(22)도 같은 `EmailStr` 규칙이라, 여기서 통과한 이메일은 가입에서도 형식으로 막히지 않는다.

## 3. 코드
**import** (파일 맨 위)
```python
from typing import Annotated

from fastapi import APIRouter, Cookie, Query, Response, status
from pydantic import EmailStr

from app.api.deps import Db
from app.schemas.auth import (
    NICKNAME_MAX,
    AvailabilityResponse,
    LoginRequest,
    SignupRequest,
    SignupResponse,
    TokenResponse,
)
from app.schemas.common import ErrorResponse
from app.services import auth_service
```
`auth.py` 맨 위의 import 이다. **`from pydantic import EmailStr` 를 이번에 추가했다.** 이 함수는 `Annotated` · `Query` · `EmailStr` · `Db` · `AvailabilityResponse` · `auth_service` 를 쓴다.

**`requirements.txt` 에 한 줄 추가 (새 패키지)**
```
email-validator>=2.2       # pydantic EmailStr — 이메일 형식 검사 (P1-04, 2026-10-07)
```
`EmailStr` 은 pydantic 에 있지만, 실제 검사는 이 패키지가 한다. 설치된 버전은 2.3.0. 다른 컴퓨터는 pull 뒤 의존성 다시 설치(CLAUDE.md)로 자동 설치된다.

**함수**
```python
@router.get("/check-email", response_model=AvailabilityResponse)
def check_email(db: Db, email: Annotated[EmailStr, Query(max_length=255)]) -> AvailabilityResponse:
    return auth_service.check_email(db, email)
```
템플릿은 `Annotated[str, …]` 였고, `str` 을 `EmailStr` 로 바꾸고 몸통 한 줄을 채웠다.

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from pydantic import EmailStr` | pydantic 의 "이메일 글자" 타입을 가져옴 |

| 식 | 뜻 |
|---|---|
| `@router.get("/check-email", …)` | `GET /api/v1/auth/check-email` 에 연결. `GET` = 보기만 하는 요청 |
| `Annotated[EmailStr, Query(max_length=255)]` | 이 인자는 **주소의 `?email=`** 에서 읽고(`Query`), 255자 이하이며 이메일 형식(`EmailStr`)이어야 함. 틀리면 FastAPI 가 라우터 실행 전에 422 (02 처리기) |
| `auth_service.check_email(db, email)` | 19 를 `release=False`(기본값)로 부름 → DB 를 바꾸지 않음 |
| `response_model=AvailabilityResponse` | 응답 모양. `available_at` 은 UTC 시각이라 `…Z` 로 나감 |

### `EmailStr` 이 받는 것 · 막는 것 (직접 확인)
| 입력 | 결과 |
|---|---|
| `kim@naver.com` | 통과 |
| `" kim@naver.com "` | 통과 — 앞뒤 공백을 지워 줌 |
| `Kim@Naver.COM` | 통과 → `Kim@naver.com` (도메인만 소문자. `@` 앞은 17 이 소문자로) |
| `abc` · `a b@x.com` · `kim@naver` · `user@localhost` | 422 |
| `deleted+85@withdrawn.invalid` | 422 — `.invalid` 는 쓸 수 없는 도메인. **18 에서 비켜 둔 이메일로는 누구도 가입할 수 없다** |
| `한글@naver.com` | 통과 — 국제 메일 규격(SMTPUTF8)상 맞는 형식 |

## 4. 흐름
1. FastAPI 가 `?email=` 을 읽어 길이 · 형식을 검사한다. 틀리면 422.
2. 19 로 쓸 수 있는지 확인한다 (DB 는 바꾸지 않음).
3. 결과를 200 으로 돌려준다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `GET` · 확인만 (`release=False`) | 19 에서 정한 대로. `GET` 은 여러 번 불려도 DB 가 바뀌면 안 된다 |
| "쓸 수 없음" 도 200 | 요청은 성공했고 답이 "아니요" 인 것이다. 오류(4xx)는 요청 자체가 잘못됐을 때(형식 틀림) |
| 형식 검사를 라우터 입구(`EmailStr`)에서 | 틀린 글로 DB 에 묻지 않는다. 오류 모양도 02 처리기가 다른 입력 오류와 똑같이 만든다 |
| `email-validator` 패키지 추가 | 정규식으로 흉내 내면 `a..b@x.com`, 국제 도메인 같은 경우를 놓친다. 이메일 규격을 따르는 검사를 쓴다 (2026-10-06 사용자 결정 "EmailStr") |

## 6. 시험 (`tests/test_auth_routes.py` 에 10개 추가 · 모두 16개, 실제 앱 + 실제 MySQL · rollback)
| 시험 | 확인한 것 |
|---|---|
| 없는 이메일 | 200, `{"available": true, "reason": null, "available_at": null}` |
| 가입된 이메일을 대소문자 섞어 물음 | `TAKEN` |
| 탈퇴 1일 | `REJOIN_TOO_SOON`, `available_at` 이 `Z`(UTC)로 끝남 |
| 형식 틀림 5개 | `abc` · `a b@x.com` · `kim@naver` · `deleted+85@withdrawn.invalid` · 빈 글자 → 422 `VALIDATION_ERROR`, `details` 에 `email` |
| `email` 없음 | 422 |
| 탈퇴 5일 행이 있을 때 | `available: true` 지만 그 행의 이메일은 **그대로** (GET 은 확인만) |

전체 시험 159개 통과, `ruff` 검사 통과.
