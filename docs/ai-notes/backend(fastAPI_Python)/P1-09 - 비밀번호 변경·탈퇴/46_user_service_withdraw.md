# Backend(FastAPI/Python) 46 — `withdraw()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/user_service.py` |
| 작업 | P1-09 비밀번호 변경 · 탈퇴 — 회원 탈퇴(소프트 삭제) · PRD 01 FR-108 |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [45 `change_password()`](45_user_service_change_password.md) · [47 `PUT /users/me/password`](47_users_route_change_password.md) |

## 1. 하는 일
비밀번호를 확인하고, 회원을 **탈퇴 상태**로 바꾼다. 행은 지우지 않는다(소프트 삭제). 프로필 사진은 지운다.

| 바뀌는 것 | 바뀌지 않는 것 |
|---|---|
| `status` → `DELETED` | 이메일 · 닉네임 (3일 동안 재가입을 막는 데 씀) |
| `deleted_at` → 지금 (UTC) | 회원 행 자체 |
| `profile_image_path` → `None`, 사진 파일 삭제 | 내가 OWNER 인 프로젝트 |

| 상황 | 결과 |
|---|---|
| 비밀번호 맞음 | 위처럼 바뀜 |
| 비밀번호 틀림 | 400 `WRONG_PASSWORD` — 아무것도 바뀌지 않음, 사진도 그대로 |
| 저장 실패 | 오류 그대로 — 사진 파일도 남음 |

**탈퇴 뒤에 일어나는 일 (다른 함수들이 이미 함)**

| 무엇 | 결과 | 막는 곳 |
|---|---|---|
| 로그인 | 401 (이유는 숨김) | 29 `authenticate` |
| 남은 Access Token (최대 30분) | 401 | 06 `get_current_user` |
| 자동 로그인 쿠키로 재발급 | 401 | 30 `get_active_user` |
| 같은 이메일 · 닉네임으로 3일 안 가입 | 409 `REJOIN_TOO_SOON` | 19 · 20 (P1-04) |
| 사진 주소 | 404 | 40 |
| 3일 뒤 | 이메일 · 닉네임 · 남은 개인 정보 비움 | 49 보관 기간 정리 (다음 다음) |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `DELETE /users/me` (48) | 본문 `{"password": "…"}` → 이 함수 → 리프레시 쿠키 삭제 → 204 |
| 화면 | userInfo.html Delete account → FIX-01 `promptDialog` (비밀번호만, 체크박스 없음) — P1-10 |

## 3. 코드
**import** (파일 맨 위)
```python
import re
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
…
```
**`from datetime import UTC, datetime` 을 이번에 추가했다.** `UserStatus` 는 40 에서 이미 넣었다.

**함수**
```python
def withdraw(db: Session, user: User, password: str) -> None:
    check_current_password(user, password)
    user.status = UserStatus.DELETED
    user.deleted_at = datetime.now(UTC).replace(tzinfo=None)
    delete_profile_image(db, user)
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from datetime import UTC, datetime` | 지금 시각 (UTC 기준) |

| 식 | 뜻 |
|---|---|
| `datetime.now(UTC).replace(tzinfo=None)` | UTC 지금 시각에서 시간대 표시를 뗌 — DB `DATETIME` 칸은 시간대를 저장하지 않고 늘 UTC 로 쓴다 (P1-04 와 같음) |
| `user.status = …` · `user.deleted_at = …` | 바꾸기만 — 아직 DB 에 저장되지 않음 |
| `delete_profile_image(db, user)` | 39 — 사진 경로를 비우고 **`commit`** → 위의 두 줄도 이 `commit` 으로 함께 저장. 저장 뒤 파일 삭제 |

## 4. 흐름
1. 비밀번호 확인 → 틀리면 400 (아무것도 바뀌지 않음).
2. 상태 · 탈퇴 시각을 바꾼다 (아직 저장 전).
3. 39 를 부른다 → 사진 경로를 비우고 한 번에 저장 → 사진 파일 삭제.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 39 를 **마지막에** 불러 저장을 한 번으로 | 템플릿 요구("commit 은 마지막에 한 번"). 상태만 저장되고 사진은 남는(또는 반대) 반쪽 탈퇴가 생기지 않는다. 39 를 만들 때 이 쓰임을 정해 두었다 (39 §5) |
| 이메일 · 닉네임을 바로 비우지 않음 | 2026-10-03 결정 — 탈퇴하고 같은 이메일로 바로 다시 가입해 제재 · 기록을 피하는 것을 3일 동안 막는다 |
| 프로젝트를 남김 | 2026-10-03 결정 — 함께 작업한 사람의 곡이 사라지면 안 된다. 다른 사람에게는 'Deleted user' 로 보임 (Phase 6, 추적 방지 ①) |
| 리프레시 쿠키는 라우터에서 | 쿠키는 **응답**에 붙는 것이라 서비스(DB 일)와 나눴다. 쿠키를 못 지워도 30 이 재발급을 막는다 |
| 사진 파일은 바로 지움 | 3일을 기다릴 이유가 없다 — 재가입을 막는 데 쓰이지 않는다 |

## 6. 시험 (`tests/test_user_service.py` 에 4개 추가 · 모두 74개, 실제 MySQL + 임시 폴더)
| 시험 | 확인한 것 |
|---|---|
| 탈퇴 | DB 에 `DELETED` · 지금 시각, 이메일 · 닉네임 그대로, 사진 경로 `None` · 파일 삭제, OWNER 프로젝트 그대로 |
| 비밀번호 틀림 | 400, 상태 `ACTIVE`, 사진 파일 그대로 |
| 탈퇴 뒤 | 로그인 401 · 재발급 401 · 같은 이메일 · 닉네임 `REJOIN_TOO_SOON` |
| 저장 실패 | 오류 그대로, 사진 파일 남음 |

전체 시험 332개 통과, `ruff` 검사 통과. (P1-08 사이트 시험이 남긴 빈 `storage/profiles/` 폴더를 지웠다 — 이제 `.gitkeep` 만)
