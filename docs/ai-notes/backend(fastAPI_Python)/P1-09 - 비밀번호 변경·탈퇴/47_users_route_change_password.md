# Backend(FastAPI/Python) 47 — `PUT /api/v1/users/me/password`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/users.py`의 `change_password()` |
| 작업 | P1-09 비밀번호 변경·탈퇴: 비밀번호 변경 (PRD 01 FR-107) |
| 작성 | Claude (AI), 2026-10-07, 사용자 검토 |
| 이전 · 다음 | [46 `withdraw()`](46_user_service_withdraw.md) · [48 `DELETE /users/me`](48_users_route_withdraw.md) |

## 1. 하는 일
| 요청 본문 (지금 비밀번호 `Abcdef1!`) | 응답 |
|---|---|
| `{"current_password": "Abcdef1!", "new_password": "Newpass9#"}` | **204**(본문 없음)이고, 이후로는 `Newpass9#`로만 로그인할 수 있습니다 |
| 지금 비밀번호가 틀림 | **400** `WRONG_PASSWORD` "Password is incorrect." |
| 새 비밀번호가 `abcdefgh` | 422 "Check the password requirements."와 `details: {"new_password": ["upper", "number", "special"]}` |
| 새 비밀번호가 지금과 같음 | 422 "Use a different password."와 `details: {"new_password": "same_as_current"}` |
| `current_password`가 빈 문자열 | 422 (스키마)이고, `details`에 `current_password`가 담깁니다 |
| 토큰 없음 | 401 |

## 2. 언제 쓰나
| 화면 (userInfo.html, P1-10) | |
|---|---|
| Current password, New password, Confirm을 채우고 Change password | `api.put('/users/me/password', { current_password, new_password })`로 보냅니다. 확인 칸과의 비교는 화면이 합니다 (가입 16번과 같은 방식) |
| 400 `WRONG_PASSWORD` | 지금 비밀번호 칸 아래에 "Current password is incorrect."를 표시합니다 |
| 422 `details.new_password` | 새 비밀번호 칸 아래에 문구를 표시합니다 |

## 3. 코드
**import** (파일 맨 위: 41번과 같고, 새로 추가한 것은 없습니다)

**함수** (경로와 응답 설정은 템플릿 그대로입니다)
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
| `@router.put(…)` | **PUT**은 "이 값으로 바꿔 놓으라"는 요청입니다. 비밀번호는 통째로 새 값이 되므로 PATCH(일부 수정)가 아니라 PUT을 씁니다 |
| `status_code=status.HTTP_204_NO_CONTENT` | 성공하면 204로 응답합니다. 돌려줄 내용이 없기 때문입니다 |
| `data: PasswordChangeRequest` | 템플릿 스키마입니다. 두 칸 모두 1~100자여야 하며, 빈 칸이면 422입니다 |
| `-> None` | 본문이 없습니다 |

## 4. 흐름
토큰을 확인하고(06), 본문을 검사한 뒤(스키마), 45번(지금 비밀번호 확인 → 규칙 검사 → 같음 검사 → 저장)을 실행하고 204로 응답합니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 라우터는 한 줄 | 규칙은 44번과 45번에서 이미 시험을 마쳤습니다 |
| 204로 응답하고 새 토큰을 주지 않음 | Access Token에는 회원 번호만 담겨 있어서, 비밀번호가 바뀌어도 그대로 쓸 수 있습니다. 그래서 다시 로그인시키지 않습니다 |
| 틀리면 400 | 44번 §5에서 설명했듯이, 401로 응답하면 화면이 로그아웃시킵니다 |
| 새 비밀번호 확인 칸은 서버로 보내지 않음 | 두 칸이 같은지는 화면이 확인합니다 (가입과 같음). 서버는 같은 값을 두 번 받아도 할 일이 없습니다 |

## 6. 시험 (`tests/test_user_routes.py`에 6개를 추가해서 모두 32개, 실제 앱과 MySQL로 실행)
| 시험 | 확인한 것 |
|---|---|
| 바꾸기 | 204와 본문 없음을 확인한 뒤, **실제 로그인 API**로 새 비밀번호는 200, 옛 비밀번호는 401임을 확인했습니다 |
| 지금 비밀번호가 틀림 | 400 `WRONG_PASSWORD` "Password is incorrect." |
| 규칙 위반, 지금과 같음 | 422와 문구, `details.new_password` |
| 지금 비밀번호가 빈 칸 | 422이고, `details`에 `current_password`가 담깁니다 |
| 토큰 없음 | 401 |

전체 시험 338개가 통과했고, `ruff` 검사도 통과했습니다.
