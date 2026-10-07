# Backend(FastAPI/Python) 39 — `delete_profile_image()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/user_service.py` |
| 작업 | P1-08 회원 정보 — 프로필 사진 지우기 · PRD 01 FR-106 |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [38 `save_profile_image()`](38_user_service_save_profile_image.md) · [40 `profile_image_file()`](40_user_service_profile_image_file.md) |

## 1. 하는 일
내 프로필 사진을 지운다. DB 의 `profile_image_path` 를 비우고, 저장된 파일도 지운다. 화면은 닉네임 첫 글자 동그라미로 돌아간다.

| 상황 | 결과 |
|---|---|
| 사진 있음 | 경로 `None`, 파일 삭제, 응답 사진 주소 `null` |
| 사진 없음 · 두 번 누름 | 오류 없이 그대로 `None` |
| DB 에는 경로가 있는데 파일은 이미 없음 | 오류 없이 경로 `None` |
| DB 저장 실패 | 오류 그대로, **파일은 남김** |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `DELETE /users/me/profile-image` (42) | userInfo.html 의 Remove 버튼 (P1-10) → 이 함수 → 36 응답 |
| P1-09 회원 탈퇴 `withdraw()` | 템플릿 6번 "사진 파일 지우기 (delete_profile_image 재사용, commit 은 마지막에 한 번)". 탈퇴 상태를 바꾼 **뒤 마지막에** 이 함수를 부르면 이 안의 `commit` 이 탈퇴 상태와 사진 지우기를 **함께** 저장한다 |

## 3. 코드
**import** (파일 맨 위 — 38 과 같음, 추가 없음). 이 함수는 **`get_settings`** 를 쓴다.

**함수**
```python
def delete_profile_image(db: Session, user: User) -> User:
    old_relative = user.profile_image_path
    user.profile_image_path = None
    db.commit()
    if old_relative:
        (get_settings().storage_dir / old_relative).unlink(missing_ok=True)
    db.refresh(user)
    return user
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `old_relative = user.profile_image_path` | 지우기 전에 경로를 따로 기억 — 바로 아래에서 `None` 으로 바꾸므로 |
| `get_settings().storage_dir / old_relative` | 실제 파일 위치 (`studionx/storage/profiles/….jpg`) |
| `unlink(missing_ok=True)` | 파일 삭제, 이미 없어도 오류 없음 |
| `db.refresh(user)` | DB 가 바꾼 `updated_at` 까지 다시 읽음 |

## 4. 흐름
1. 지금 경로를 기억하고 DB 의 경로를 비운다.
2. 저장(commit). 실패하면 여기서 오류 — 파일은 그대로.
3. 성공했고 예전 경로가 있었으면 파일을 지운다.
4. 다시 읽어 돌려준다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| **DB 먼저, 파일은 나중** (템플릿은 "파일 삭제 → DB") | 38 과 같은 이유. 템플릿 순서로 하면 DB 저장이 실패할 때 DB 는 사진이 있다고 하는데 파일은 없어 사진이 깨진다. 이 순서면 실패해도 사진이 그대로 보인다 (반대로 파일 삭제가 실패하면 파일만 남음 — 화면에는 영향 없음) |
| 오류 없이 끝나는 경우를 넓게 | Remove 를 빠르게 두 번 누르거나, 파일을 손으로 지운 경우에도 사용자에게 오류를 보일 이유가 없다 |
| `commit` 을 안에서 함 (매개변수로 끄지 않음) | 템플릿은 탈퇴에서 "commit 은 마지막에 한 번" 이라고 했다. 탈퇴가 이 함수를 **맨 마지막에** 부르면 같은 결과가 된다. 켜고 끄는 매개변수를 두면 "파일을 언제 지우나" 가 부르는 쪽 책임이 되어 더 복잡해진다 |
| 38 의 `rollback` 같은 정리 코드가 없음 | 지울 새 파일이 없다. 오류가 나면 요청이 끝날 때 세션이 닫히며 되돌려진다 |

## 6. 시험 (`tests/test_user_service.py` 에 5개 추가 · 모두 44개, 실제 MySQL + 임시 폴더)
| 시험 | 확인한 것 |
|---|---|
| 사진 지우기 | 같은 객체를 돌려줌, 경로 · 응답 주소 · DB 모두 `None`, 파일 삭제, 폴더 비었음 |
| 사진 없음 · 두 번 | 오류 없음 |
| 파일이 이미 없음 | 오류 없이 경로 `None` |
| 다른 회원의 사진 | 지워지지 않음 |
| DB 저장 실패 | 오류 그대로, 파일 · 내용 그대로 |

전체 시험 278개 통과, `ruff` 검사 통과.
