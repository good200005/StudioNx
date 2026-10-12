# Backend(FastAPI/Python) 88 — `DevNoteAdmin` (공지 관리 화면 설정)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/admin.py` |
| 작업 | P1-21 공지 API와 관리자 화면: `/admin`에서 공지를 쓰고 공개하는 화면의 설정 (PRD 01 FR-114, FR-115) |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 이전 · 다음 | [87 `AdminAuth` 로그아웃, 확인](87_admin_auth_logout_authenticate.md) · 89 소프트 삭제 (다음) |

## 1. 하는 일
SQLAdmin이 `DevNote` 모델로 만드는 화면을 공지 관리에 맞게 설정합니다.

| 영역 | 설정 |
|---|---|
| 목록 열 | 번호, 제목, 공개 여부, 공개 시각, 만든 시각 |
| 목록 정렬, 검색 | 번호 큰 것(최근)이 위, 제목으로 검색 |
| 작성, 수정 폼 | 제목, 요약, 본문, 공개 여부, 공개 시각 **다섯 칸만** (작성자, 만든 시각, 고친 시각, 삭제 시각은 폼에 없음) |
| 새 공지를 저장할 때 | 작성자(`author_id`)를 **로그인한 관리자**로 자동 입력 |
| 공개로 바꿨는데 공개 시각이 비어 있을 때 | **지금 시각**(UTC)을 자동 입력 |
| 본문(`content`) 입력칸 | **여러 줄 입력칸**(textarea). 실제 화면 시험에서 한 줄 입력창으로 나오는 것을 발견해 고쳤습니다 |
| 지운 공지(`deleted_at`이 있음) | 목록, 상세, 수정 화면에서 보이지 않음 |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| SQLAdmin이 `setup_admin()`으로 등록된 뒤 (92번) `/admin/dev-note/…` 화면 | 공지 목록, 새 공지, 수정 |

## 3. 코드
**import** (이번에 추가한 것)
```python
from datetime import UTC, datetime
from wtforms import TextAreaField
```

**설정과 함수**
```python
class DevNoteAdmin(ModelView, model=DevNote):
    name = "Dev note"
    name_plural = "Dev notes"

    column_list = [DevNote.note_id, DevNote.title, DevNote.is_published,
                   DevNote.published_at, DevNote.created_at]
    column_default_sort = [("note_id", True)]
    column_searchable_list = [DevNote.title]
    form_columns = [DevNote.title, DevNote.summary, DevNote.content,
                    DevNote.is_published, DevNote.published_at]
    form_overrides = {"content": TextAreaField}

    def list_query(self, request):
        return super().list_query(request).where(DevNote.deleted_at.is_(None))

    def count_query(self, request):
        return super().count_query(request).where(DevNote.deleted_at.is_(None))

    def form_details_query(self, request):
        return super().form_details_query(request).where(DevNote.deleted_at.is_(None))

    def form_edit_query(self, request):
        return super().form_edit_query(request).where(DevNote.deleted_at.is_(None))

    async def on_model_change(self, data, model, is_created, request):
        if is_created:
            data["author_id"] = request.session.get("admin_user_id")
        if data.get("is_published") and not data.get("published_at"):
            data["published_at"] = datetime.now(UTC).replace(tzinfo=None)
```
백엔드(Python)는 지금 방식 그대로여서 "최신 문법" 버전은 따로 두지 않습니다.

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `class DevNoteAdmin(ModelView, model=DevNote)` | `DevNote` 모델의 관리 화면을 만드는 SQLAdmin 클래스입니다 |
| `form_overrides = {"content": TextAreaField}` | `content` 칸의 입력 방식을 여러 줄 입력칸으로 바꿉니다. SQLAdmin은 `MEDIUMTEXT`를 한 줄 입력창(`<input type="text">`)으로 만들기 때문입니다 |
| `column_list`, `form_columns` | 목록에 보일 열, 폼에 넣을 칸입니다. 여기에 없는 칸은 폼에서 나오지 않습니다 |
| `column_default_sort = [("note_id", True)]` | `note_id` 내림차순(`True` = 내림차순)입니다 |
| `list_query`, `count_query` | 목록과 전체 개수를 세는 쿼리입니다. 같은 조건을 둘 다 걸어야 쪽 번호가 맞습니다 |
| `form_details_query`, `form_edit_query` | 상세와 수정 화면이 공지 하나를 찾는 쿼리입니다. 지운 공지를 주소로 직접 열지 못하게 같은 조건을 겁니다 |
| `super().list_query(request).where(...)` | 기본 쿼리에 조건을 더합니다 |
| `on_model_change(data, model, is_created, request)` | 저장 직전에 불립니다. **`data`(폼 값)를 고치면** 그 값이 모델에 들어갑니다. 새 공지일 때 `model`은 아직 빈 상태입니다 |
| `request.session.get("admin_user_id")` | 86번 로그인이 저장한 관리자 번호입니다 |

## 4. 흐름
공지를 새로 쓰고 저장할 때:
1. 폼의 다섯 칸 값이 `data`로 들어옵니다.
2. `on_model_change`가 `data`에 작성자(로그인한 관리자)를 넣습니다.
3. 공개를 켜고 공개 시각이 비어 있으면 지금 시각을 넣습니다.
4. SQLAdmin이 `data`를 모델에 넣고 저장합니다.

수정할 때는 작성자를 바꾸지 않고, 공개 시각만 위 규칙대로 채웁니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 작성자를 폼에서 받지 않고 로그인한 관리자로 | 다른 사람 이름으로 쓰는 일을 막습니다 |
| 수정할 때는 작성자를 그대로 | 처음 쓴 사람이 기록으로 남아야 합니다 |
| 공개 시각이 비면 지금 시각 | 83번 목록이 `published_at <= 지금`인 공지만 보여 주므로, 시각이 비면 공개해도 안 보입니다. 관리자가 시각을 따로 안 정해도 바로 보이게 합니다 |
| 공개 시각을 직접 입력하면 그대로 (미래 포함) | 예약 공개를 쓸 수 있습니다 |
| 초안(공개 안 함)에는 시각을 넣지 않음 | 나중에 공개할 때 그 시점의 시각이 들어가야 합니다 |
| 모델이 아니라 `data`를 고침 | SQLAdmin이 `on_model_change` 뒤에 `data`를 모델에 덮어쓰기 때문에, 모델에 먼저 넣으면 사라집니다 (SQLAdmin 0.32의 `_queries.py`에서 순서를 확인했습니다) |
| 지운 공지를 네 쿼리에서 모두 제외 | 목록에서만 빼면 주소로 직접 열고 고칠 수 있습니다 |
| 본문만 `TextAreaField`로 바꿈 | 제목과 요약은 한 줄이면 되지만, Markdown 본문은 줄바꿈이 필요합니다 |
| 요약(`summary`)과 본문(`content`)을 폼에 둠 | 메인 페이지 카드와 View More 모달이 각각 씁니다 |

## 6. 시험 (`tests/test_admin_dev_note.py`, 9개)
| 시험 | 결과 |
|---|---|
| 폼의 칸이 정확히 다섯 개이고, 작성자, 시각 세 개, 번호는 없음 | 통과입니다 |
| 본문 칸이 `TextAreaField`로 바뀌어 있음 | 통과입니다 |
| 목록 열 다섯 개, 번호 내림차순, 제목 검색 | 통과입니다 |
| 목록, 개수, 상세, 수정 쿼리 네 개에 모두 `deleted_at IS NULL` | 통과입니다 |
| 새 공지: 로그인한 관리자 번호가 `author_id`로 들어감 | 통과입니다 |
| 수정: `author_id`를 건드리지 않음 | 통과입니다 |
| 공개로 저장하고 시각이 비어 있으면: 지금 UTC 시각(시간대 없음)이 들어감 | 통과입니다 |
| 직접 입력한 시각(미래 포함)은 그대로 | 통과입니다 |
| 초안은 시각이 비어 있는 그대로 | 통과입니다 |

9개 모두 통과했습니다. `ruff`도 통과했습니다. SQLAdmin 화면에서 실제로 쓰고 공개하는 흐름은 `setup_admin()`(92번)까지 구현한 뒤 서버를 띄워 확인합니다.
