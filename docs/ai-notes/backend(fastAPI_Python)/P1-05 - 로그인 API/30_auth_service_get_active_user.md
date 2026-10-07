# Backend(FastAPI/Python) 30 — `get_active_user()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/auth_service.py` |
| 작업 | P1-05 로그인 — 재발급 전 회원 확인 · PRD 01 FR-105 · FR-108 |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [29 `authenticate()`](29_auth_service_authenticate.md) · [31 리프레시 쿠키](31_auth_route_refresh_cookie.md) |

## 1. 하는 일
회원 번호로 회원을 찾아, **아직 활동 중(`ACTIVE`)** 이면 돌려준다. 없거나, 정지 · 탈퇴했으면 401.

| 회원 번호의 회원 | 결과 |
|---|---|
| 활동 중 | `User` |
| 정지 (`SUSPENDED`) · 탈퇴 (`DELETED`) | 401 `UNAUTHORIZED` "Please sign in again." |
| 없음 | 401 (같음) |

## 2. 언제 쓰나
| 쓰는 곳 | 하는 일 |
|---|---|
| P1-05 `POST /auth/refresh` (33) | 28 로 리프레시 토큰에서 회원 번호를 꺼낸 뒤, 이 함수로 회원을 확인하고 새 Access Token 을 줌 |

**없으면 생기는 일**

| 순서 | 일어나는 일 |
|---|---|
| ① | 회원이 자동 로그인(3일 쿠키)으로 로그인 |
| ② | 그날 탈퇴(P1-09) — 브라우저에는 리프레시 쿠키가 아직 남아 있음 |
| ③ | 다음 날 사이트를 열면 `api.js` 가 `/auth/refresh` 를 부름 → 토큰은 진짜이고 3일 안이라 28 은 통과 |
| ④ | **이 함수가 없으면** 탈퇴한 회원에게 새 Access Token 이 나간다. 이 함수가 `DELETED` 를 보고 401 → 로그인 화면으로 |

정지(관리자가 `SUSPENDED` 로 바꿈)도 같다. 바꾼 순간부터 재발급이 막히고, 남은 Access Token(최대 30분)도 06 `get_current_user()` 가 막는다.

### 06 `get_current_user()` 와 비교
| | 06 `get_current_user()` | **30 `get_active_user()`** |
|---|---|---|
| 회원 번호를 어디서 | Access Token (05) | Refresh Token (28) |
| 쓰는 곳 | 로그인이 필요한 모든 API | `/auth/refresh` 하나 |
| 검사 | 없거나 `ACTIVE` 아니면 401 | 같음 |

## 3. 코드
**import** (파일 맨 위)
```python
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.core.security import check_password_rules, hash_password, verify_password
from app.models import User
from app.models.user import UserStatus
from app.schemas.auth import PRIVACY_VERSION, AvailabilityResponse, SignupRequest
```
`auth_service.py` 맨 위의 import 이다 (이번에 추가한 것 없음). 이 함수는 **`Session` · `AppError` · `ErrorCode` · `User` · `UserStatus`** 를 쓴다.

**함수**
```python
def get_active_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise AppError(ErrorCode.UNAUTHORIZED, 401, "Please sign in again.")
    return user
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from app.models.user import UserStatus` | 08 의 회원 상태 목록 |

| 식 | 뜻 |
|---|---|
| `db.get(User, user_id)` | 기본 키로 한 행. 없으면 `None` (06 과 같음) |
| `user is None or …` | 앞이 참이면 뒤를 보지 않음 → `None.status` 오류가 나지 않음 |
| `user.status != UserStatus.ACTIVE` | 08 의 `StrEnum` 끼리 비교 (06 은 글자 `"ACTIVE"` 와 비교 — 결과는 같음) |

## 4. 흐름
1. 회원 번호로 회원을 찾는다.
2. 없거나 활동 중이 아니면 401.
3. 회원을 돌려준다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `UNAUTHORIZED` 401 (403 아님) | `api.js` 는 재발급이 실패하면(401) 로그인 화면으로 보낸다. 정지 · 탈퇴 회원도 "다시 로그인" 으로 끝난다. 정지 사실은 로그인(29)을 다시 시도할 때 비밀번호가 맞으면 403 으로 알려 준다 |
| 없는 회원 · 정지 · 탈퇴를 같은 응답으로 | 05 · 06 과 같은 이유 — 이유를 알려 주지 않는다 |
| 06 은 고치지 않음 | 템플릿은 "06 이 이 함수를 불러 써도 됨" 이라고 했지만, 06 은 이미 검토가 끝난 코드이고 검사는 두 줄이다. 06 을 바꾸면 P1-03 문서 · 시험도 다시 봐야 한다 |

## 6. 시험 (`tests/test_auth_service.py` 에 4개 추가 · 모두 48개, 실제 MySQL)
| 시험 | 확인한 것 |
|---|---|
| 활동 회원 | 그 회원을 돌려줌 |
| 정지 · 탈퇴 (2개) | 401 `UNAUTHORIZED` "Please sign in again." |
| 없는 회원 번호 | 401 |

전체 시험 213개 통과, `ruff` 검사 통과.
