# Backend(FastAPI/Python) 44 — `check_current_password()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/user_service.py` |
| 작업 | P1-09 비밀번호 변경 · 탈퇴 — 비밀번호 재확인 · PRD 01 FR-107 · FR-108 |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [43 `GET /profile-images/{name}`](<../P1-08 - 회원 정보 API/43_users_route_profile_image_file.md>) · [45 `change_password()`](45_user_service_change_password.md) |

## 1. 하는 일
**이미 로그인한** 회원에게 비밀번호를 한 번 더 확인한다. 맞으면 아무것도 하지 않고(`None`), 틀리면 400.

| 저장된 비밀번호 `Abcdef1!` 에 넣은 값 | 결과 |
|---|---|
| `Abcdef1!` | 통과 (`None`) |
| `Abcdef1?` · `abcdef1!` · `" Abcdef1!"` · 빈 글자 | 400 `WRONG_PASSWORD` "Password is incorrect." |
| 100자 (bcrypt 한도 72바이트 넘음) | 400 (같음 — 500 아님) |
| 해시가 `"!"` (보관 기간 정리 뒤) | 어떤 값이든 400 |

## 2. 언제 쓰나
| 쓰는 곳 | 왜 다시 묻나 |
|---|---|
| 45 `change_password` | "지금 비밀번호" 칸 — 잠깐 자리를 비운 사이 다른 사람이 비밀번호를 바꾸지 못하게 |
| 46 `withdraw` | 탈퇴 창의 비밀번호 (FIX-01 `promptDialog`) — 되돌릴 수 없는 일이라서 |

### 로그인(29 `authenticate`)과 다른 점
| | 29 로그인 | **44 재확인** |
|---|---|---|
| 회원은 | 아직 모름 (이메일로 찾음) | 이미 앎 (토큰의 회원) |
| 틀리면 | 401 `INVALID_CREDENTIALS` | **400** `WRONG_PASSWORD` |
| 시간 맞추기(가짜 해시) | 함 — 없는 이메일인지 숨기려고 | 필요 없음 — 숨길 것이 없음 |

## 3. 코드
**import** (파일 맨 위)
```python
from app.core.errors import AppError, ErrorCode
from app.core.security import verify_password
```
**`verify_password` 줄을 이번에 추가했다** (나머지 import 는 P1-08 그대로).

**함수**
```python
def check_current_password(user: User, password: str) -> None:
    if not verify_password(password, user.password_hash):
        raise AppError(ErrorCode.WRONG_PASSWORD, 400, "Password is incorrect.")
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from app.core.security import verify_password` | P1-04 (16) — bcrypt 로 비교, 오류는 `False` |

| 식 | 뜻 |
|---|---|
| `-> None` | 돌려주는 값 없음. "통과하면 조용히 끝나고, 아니면 오류" 인 검사 함수 |
| `if not …: raise …` | 틀릴 때만 멈춤 |

## 4. 흐름
1. 넣은 비밀번호를 저장된 해시와 비교한다.
2. 틀리면 400. 맞으면 끝.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| **400** (401 아님) | 화면의 `api.js`(P1-02 02)는 401 을 받으면 "토큰이 만료됐다" 고 보고 재발급을 시도하고, 그래도 401 이면 로그인 화면으로 보낸다. 비밀번호를 잘못 쳤을 뿐인데 **로그아웃되면 안 된다** |
| 별도 코드 `WRONG_PASSWORD` | 화면이 "Current password is incorrect." 처럼 그 칸에 문구를 붙일 수 있게 (P1-10) |
| 함수로 분리 (두 줄이지만) | 45 · 46 이 같은 규칙을 쓴다. 문구 · 코드가 한 곳에 있다 |
| DB 를 보지 않음 | 06 `CurrentUser` 가 이미 최신 회원을 읽어 왔다 |

**알아 둘 점 — 여러 번 틀리기:** 로그인한 사람이 이 창에서 비밀번호를 계속 바꿔 치며 맞혀 볼 수는 있다. 하지만 이미 그 계정으로 로그인한 상태라 얻을 것이 적다. 횟수 제한은 로그인 반복 제한과 함께 나중에 검토한다.

## 6. 시험 (`tests/test_user_service.py` 에 7개 추가 · 모두 63개)
| 시험 | 확인한 것 |
|---|---|
| 맞는 비밀번호 | `None` |
| 틀림 5가지 | 한 글자 · 대소문자 · 앞 공백 · 빈 글자 · 100자 → 400 `WRONG_PASSWORD` "Password is incorrect." |
| 해시 `"!"` | 400 |

전체 시험 321개 통과, `ruff` 검사 통과.
