# Backend(FastAPI/Python) 91 — `UserAdmin` (회원 보기 화면 설정)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/admin.py` |
| 작업 | P1-21 공지 API와 관리자 화면: `/admin`에서 회원을 보고 정지, 관리자 지정을 하는 화면의 설정 (PRD 01 FR-115) |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 이전 · 다음 | [90 `InquiryAdmin`](90_admin_inquiry_admin.md) · 92 `setup_admin()` (다음) |

## 1. 하는 일
회원 목록을 보고, 필요하면 **역할(`role`)과 상태(`status`)만** 바꾸는 읽기 위주의 화면입니다.

| 영역 | 설정 |
|---|---|
| 만들기, 삭제 | **둘 다 없음.** 가입은 join 화면에서, 탈퇴는 회원 본인이 합니다 |
| 목록 열 | 번호, 이메일, 닉네임, 역할, 상태, 마지막 로그인, 가입일. 최근 가입이 위 |
| 검색 | 이메일, 닉네임 |
| `password_hash` | **목록, 상세, 폼, CSV 내보내기 어디에도 나오지 않음** |
| 수정 폼 | 역할과 상태 두 칸만 (정지 처리, 관리자 지정용) |
| 막는 것 1 | 상태를 **탈퇴(`DELETED`)로 바꾸기** |
| 막는 것 2 | 로그인한 관리자가 **자기 자신**을 관리자에서 내리거나 정지하기 |

두 가지를 막을 때는 저장이 되지 않고, 수정 화면에 영어 오류 문구가 나옵니다.

| 막은 경우 | 화면에 나오는 문구 |
|---|---|
| `DELETED`로 바꾸기 | "Use the member's own withdrawal instead of setting DELETED here." |
| 자기 자신을 내리거나 정지 | "You cannot demote or suspend your own account." |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| `setup_admin()`으로 등록된 뒤 (92번) `/admin/user/…` | 회원 목록, 상세, 역할과 상태 수정 |

## 3. 코드
**import** (이번에 추가한 것)
```python
from app.models.user import UserRole, UserStatus   # UserStatus 추가
```

**설정과 함수**
```python
def enum_text(value) -> str:
    return str(getattr(value, "value", value))


class UserAdmin(ModelView, model=User):
    can_create = False
    can_delete = False
    column_list = [User.user_id, User.email, User.nickname, User.role,
                   User.status, User.last_login_at, User.created_at]
    column_default_sort = [("user_id", True)]
    column_searchable_list = [User.email, User.nickname]
    column_details_exclude_list = [User.password_hash]
    column_export_exclude_list = [User.password_hash]
    form_columns = [User.role, User.status]

    async def on_model_change(self, data, model, is_created, request):
        status = enum_text(data.get("status", model.status))
        role = enum_text(data.get("role", model.role))
        if status == UserStatus.DELETED and model.status != UserStatus.DELETED:
            raise ValueError("Use the member's own withdrawal instead of setting DELETED here.")
        if model.user_id is not None and model.user_id == request.session.get("admin_user_id"):
            if role != UserRole.ADMIN or status != UserStatus.ACTIVE:
                raise ValueError("You cannot demote or suspend your own account.")
```
백엔드(Python)는 지금 방식 그대로여서 "최신 문법" 버전은 따로 두지 않습니다.

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `column_list` | 목록에 보일 열입니다. 여기에 없는 `password_hash`는 목록에 나오지 않습니다 |
| `column_details_exclude_list` | 상세 화면에서 뺄 열입니다 (목록과 달리 상세는 기본이 모든 열이라 따로 빼야 합니다) |
| `column_export_exclude_list` | CSV 내보내기에서 뺄 열입니다. 이것도 기본이 모든 열이라 따로 빼야 합니다 |
| `form_columns` | 폼에 넣을 칸입니다. `password_hash`와 다른 칸은 수정할 수 없습니다 |
| `enum_text(value)` | 열거형(`UserRole.ADMIN`)이든 글자(`"ADMIN"`)든 같은 글자로 읽습니다. `getattr(값, "value", 값)`은 `value` 속성이 있으면 그것을, 없으면 값 자체를 씁니다 |
| `data.get("status", model.status)` | 폼에 상태가 있으면 그 값, 없으면 지금 저장된 값입니다 |
| `raise ValueError(문구)` | 저장을 중단합니다. SQLAdmin이 오류를 잡아 수정 화면 위에 문구를 보여 줍니다 |
| `request.session.get("admin_user_id")` | 86번 로그인이 저장한 지금 로그인한 관리자의 번호입니다 |

## 4. 흐름
회원의 역할이나 상태를 저장할 때:
1. 폼의 값(없으면 지금 값)을 글자로 읽습니다.
2. 상태를 `DELETED`로 바꾸려 하면(원래 `DELETED`가 아니었다면) 막습니다.
3. 지금 수정하는 회원이 로그인한 관리자 본인이고 결과가 "ADMIN이 아님" 또는 "ACTIVE가 아님"이면 막습니다.
4. 통과하면 SQLAdmin이 저장합니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `password_hash`를 **네 곳 모두**에서 뺌 | 목록은 `column_list`로 이미 안 나오지만, 상세와 CSV 내보내기는 기본이 모든 열입니다. 하나라도 빠뜨리면 비밀번호 해시가 화면이나 파일로 나갑니다. 시험에서 네 곳 모두 확인합니다 |
| 폼을 역할과 상태 두 칸으로 | 닉네임, 이메일, 저장 용량을 관리자가 바꾸는 일은 없고, 바꿔야 하면 DB에서 직접 합니다 |
| `DELETED`로 바꾸기를 막음 | 탈퇴는 이메일 해제(3일 재가입 제한)와 보관 정리와 얽혀 있어서(P1-09), 상태 값만 바꾸면 그 절차가 빠집니다 |
| 이미 `DELETED`인 회원을 그대로 저장하는 것은 막지 않음 | 상태를 바꾸려는 것이 아니기 때문입니다 |
| 자기 자신을 내리거나 정지하는 것을 막음 | 마지막 관리자가 실수로 자기를 내리면 아무도 `/admin`에 들어올 수 없게 되고, DB에서 직접 고쳐야 합니다 |
| 다른 관리자를 내리는 것은 허용 | 관리자끼리 권한을 조정할 수 있어야 합니다 |
| 목록에서 삭제 버튼을 없앰 | 회원 삭제는 탈퇴 절차(소프트 삭제와 정리 작업)로만 합니다 |

## 6. 시험 (`tests/test_admin_user.py`, 14개)
| 시험 | 결과 |
|---|---|
| 만들기와 삭제가 막혀 있음 | 통과입니다 |
| `password_hash`가 목록, 상세, 폼, 내보내기 네 곳 어디에도 없음 | 통과입니다 |
| 상세에는 이메일, 닉네임, 역할, 상태, 마지막 로그인이 있음 | 통과입니다 |
| 목록 열 7개, 번호 내림차순, 이메일과 닉네임 검색 | 통과입니다 |
| 수정 폼이 역할과 상태 두 칸뿐 | 통과입니다 |
| 다른 회원을 정지, 다른 회원을 관리자로 지정 | 허용됨 (값이 글자로 와도 같음) |
| `DELETED`로 바꾸기 (열거형과 글자 두 경우) | `ValueError`, 문구에 "withdrawal" |
| 이미 `DELETED`인 회원을 그대로 저장 | 막지 않음 |
| 자기 자신을 `USER`로 내리거나 `SUSPENDED`로 정지 | `ValueError`, 문구에 "your own account" |
| 자기 자신을 그대로 저장, 폼에 값이 없을 때 지금 값 사용 | 통과입니다 |

14개 모두 통과했습니다. `ruff`도 통과했습니다.
