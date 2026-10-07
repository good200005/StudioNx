# Backend(FastAPI/Python) 47 — `PUT /api/v1/users/me/password`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/users.py` — `change_password()` |
| 작업 | P1-09 비밀번호 변경 · 탈퇴 — 비밀번호 변경 · PRD 01 FR-107 |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [46 `withdraw()`](46_user_service_withdraw.md) · [48 `DELETE /users/me`](48_users_route_withdraw.md) |

## 1. 하는 일
| 요청 본문 (지금 `Abcdef1!`) | 응답 |
|---|---|
| `{"current_password": "Abcdef1!", "new_password": "Newpass9#"}` | **204** (본문 없음) — 이후 `Newpass9#` 로만 로그인 |
| 지금 비밀번호 틀림 | **400** `WRONG_PASSWORD` "Password is incorrect." |
| 새 비밀번호 `abcdefgh` | 422 "Check the password requirements." · `details: {"new_password": ["upper", "number", "special"]}` |
| 새 비밀번호 = 지금 | 422 "Use a different password." · `details: {"new_password": "same_as_current"}` |
| `current_password` 빈 글자 | 422 (스키마) · `details` 에 `current_password` |
| 토큰 없음 | 401 |

## 2. 언제 쓰나
| 화면 (userInfo.html, P1-10) | |
|---|---|
| Current password · New password · Confirm → Change password | `api.put('/users/me/password', { current_password, new_password })`. 확인 칸 비교는 화면이 함 (가입 16 과 같은 방식) |
| 400 `WRONG_PASSWORD` | 지금 비밀번호 칸 아래 "Current password is incorrect." |
| 422 `details.new_password` | 새 비밀번호 칸 아래 |

## 3. 코드
**import** (파일 맨 위 — 41 과 같음, 추가 없음)

**함수** (경로 · 응답 설정은 템플릿 그대로)
```python
@router.put(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={400: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def change_password(data: PasswordChangeRequest, user: CurrentUser, db: Db) -> None:
    user_service.change_password(db, user, data.current_password, data.new_password)
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `@router.put(…)` | **PUT** — "이 값으로 바꿔 놓아라". 비밀번호는 통째로 새 값이 되므로 PATCH(일부 수정)가 아니라 PUT |
| `status_code=status.HTTP_204_NO_CONTENT` | 성공하면 204 — 돌려줄 내용이 없음 |
| `data: PasswordChangeRequest` | 템플릿 스키마 — 두 칸 모두 1~100자 (빈 칸이면 422) |
| `-> None` | 본문 없음 |

## 4. 흐름
토큰 확인(06) → 본문 검사(스키마) → 45 (지금 비밀번호 → 규칙 → 같음 → 저장) → 204.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 라우터는 한 줄 | 규칙은 44 · 45 에서 시험을 마쳤다 |
| 204 (새 토큰을 주지 않음) | Access Token 은 회원 번호만 담는다 — 비밀번호가 바뀌어도 그대로 쓸 수 있다. 다시 로그인시키지 않는다 |
| 틀리면 400 | 44 §5 — 401 이면 화면이 로그아웃시킴 |
| 새 비밀번호 확인 칸은 서버에 보내지 않음 | 두 칸이 같은지는 화면이 확인한다 (가입과 같음). 서버는 같은 값을 두 번 받아도 할 일이 없다 |

## 6. 시험 (`tests/test_user_routes.py` 에 6개 추가 · 모두 32개, 실제 앱 + MySQL)
| 시험 | 확인한 것 |
|---|---|
| 바꾸기 | 204 · 본문 없음 → **실제 로그인 API** 로 새 비밀번호 200, 옛 비밀번호 401 |
| 지금 비밀번호 틀림 | 400 `WRONG_PASSWORD` "Password is incorrect." |
| 규칙 · 지금과 같음 | 422 + 문구 + `details.new_password` |
| 지금 비밀번호 빈 칸 | 422 · `details` 에 `current_password` |
| 토큰 없음 | 401 |

전체 시험 338개 통과, `ruff` 검사 통과.
