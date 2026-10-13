# Backend(FastAPI/Python) 90 — `InquiryAdmin` (문의 확인, 답변 화면 설정)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/admin.py` |
| 작업 | P1-21 공지 API와 관리자 화면: `/admin`에서 문의를 읽고 답변을 기록하는 화면의 설정 (PRD 01 FR-115) |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 이전 · 다음 | [89 소프트 삭제](89_admin_dev_note_soft_delete.md) · 91 `UserAdmin` (다음) |

## 1. 하는 일
메인 페이지의 Contact 폼으로 들어온 문의를 관리자가 확인하고 답변을 적는 화면입니다.

| 영역 | 설정 |
|---|---|
| 만들기, 삭제 | **둘 다 없음.** 문의는 Contact 폼으로만 들어오고, 오래된 문의는 보관 기간(1년)이 지나면 정리 작업(`purge_old_inquiries`)이 지웁니다 |
| 목록 열 | 번호, 이메일, 제목, 상태, 받은 시각. 최근 것이 위 |
| 검색 | 이메일, 제목 |
| 상세 | 이름, 이메일, 제목, 본문, 개인정보 동의 시각 등 모든 칸을 볼 수 있음 |
| 수정 폼 | **답변(`answer`)과 상태(`status`) 두 칸만** |
| 답변 저장 | 답변이 새로 쓰였거나 바뀌면 `answered_at`을 지금 시각(UTC)으로, 상태가 아직 `RECEIVED`이면 `ANSWERED`로 |
| 답변을 비움 | `answered_at`도 비움 (상태는 그대로) |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| `setup_admin()`으로 등록된 뒤 (92번) `/admin/inquiry/…` | 문의 목록, 상세, 답변 수정 |

## 3. 코드
**import** (이번에 추가한 것)
```python
from app.models.inquiry import InquiryStatus
```

**설정과 함수**
```python
class InquiryAdmin(ModelView, model=Inquiry):
    can_create = False
    can_delete = False
    column_list = [Inquiry.inquiry_id, Inquiry.email, Inquiry.title,
                   Inquiry.status, Inquiry.created_at]
    column_default_sort = [("inquiry_id", True)]
    column_searchable_list = [Inquiry.email, Inquiry.title]
    form_columns = [Inquiry.answer, Inquiry.status]

    async def on_model_change(self, data, model, is_created, request):
        answer = (data.get("answer") or "").strip()
        if not answer:
            data["answered_at"] = None
        elif answer != (model.answer or "").strip():
            data["answered_at"] = datetime.now(UTC).replace(tzinfo=None)
            if str(getattr(data.get("status"), "value", data.get("status"))) == "RECEIVED":
                data["status"] = InquiryStatus.ANSWERED
```
백엔드(Python)는 지금 방식 그대로여서 "최신 문법" 버전은 따로 두지 않습니다.

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `can_create = False`, `can_delete = False` | 화면의 `New`, 삭제 버튼과 그 주소를 막습니다 |
| `form_columns = [answer, status]` | 수정 폼에 이 두 칸만 나옵니다. 이름, 이메일, 본문은 바꿀 수 없습니다 |
| `(data.get("answer") or "").strip()` | 답변이 `None`이거나 비어 있어도 빈 글자로 바꾸고 앞뒤 공백을 지웁니다 |
| `model.answer` | `on_model_change`가 불릴 때 `model`은 **저장돼 있던 문의 그대로**입니다. 그래서 이전 답변과 비교할 수 있습니다 |
| `data["answered_at"] = …` | 폼에 없는 칸이어도 `data`에 넣으면 SQLAdmin이 모델에 함께 넣어 저장합니다 |
| `getattr(data.get("status"), "value", data.get("status"))` | 상태가 열거형 값이든 평범한 글자든 같은 글자(`"RECEIVED"`)로 읽습니다 |

## 4. 흐름
답변을 쓰고 저장할 때:
1. 폼의 값(답변, 상태)이 `data`로 들어옵니다.
2. 답변이 비어 있으면 `answered_at`을 비웁니다.
3. 답변이 이전과 다르면 `answered_at`을 지금으로 넣고, 상태가 `RECEIVED`이면 `ANSWERED`로 바꿉니다.
4. 답변이 이전과 같으면(상태만 바꾸는 경우 등) `answered_at`을 그대로 둡니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `answered_at`을 직접 입력하지 않고 자동으로 | 답변 시각은 정리 작업의 **보관 기간 기준**(답변 후 1년)이어서, 정확하게 기록되어야 합니다 |
| 답변이 **바뀐 경우에만** 시각 갱신 | 상태만 바꾸거나 같은 답변을 다시 저장할 때 보관 기간이 새로 시작되지 않게 합니다 |
| 답변을 쓰면 상태를 자동으로 `ANSWERED` | 답변을 쓰고 상태를 바꾸는 걸 잊는 일을 줄입니다. 이미 `CLOSED` 등으로 정했으면 그 선택을 존중합니다 |
| 답변을 비우면 시각도 비움 | 답변이 없는데 답변 시각만 남는 모순을 막습니다 |
| 삭제 버튼 없음 | 답변 기록을 실수로 지우지 않게 하고, 지우는 일은 보관 기간 정리 작업이 맡습니다 |
| 이름, 이메일, 본문을 폼에서 뺌 | 사용자가 보낸 원문은 관리자가 고치지 않습니다 |
| 이메일로 답변을 보내지 않음 | 메일 발송 기능이 아직 없습니다. 답변은 이 화면에만 기록됩니다 (나중에 필요해지면 `after_model_change` 후크에서 보낼 수 있습니다) |

## 6. 시험 (`tests/test_admin_inquiry.py`, 12개)
| 시험 | 결과 |
|---|---|
| 새로 만들기와 삭제가 모두 막혀 있음 | 통과입니다 |
| 목록 열 5개, 번호 내림차순, 이메일과 제목 검색 | 통과입니다 |
| 수정 폼이 답변과 상태 두 칸뿐 | 통과입니다 |
| 새 답변: `answered_at`이 지금 UTC(시간대 없음), 상태 `RECEIVED` → `ANSWERED` | 통과입니다 |
| 상태가 열거형이 아니라 글자로 와도 같음 | 통과입니다 |
| 답변을 고침: 시각은 새로 정하되 `CLOSED`는 유지 | 통과입니다 |
| 같은 답변(앞뒤 공백만 다름 포함): 시각을 건드리지 않음 | 통과입니다 |
| 답변을 비움(빈 글자, 공백, `None`): `answered_at`이 비고 상태는 그대로 | 통과입니다 |
| 상태만 바꿈: 다른 값은 그대로 | 통과입니다 |

12개 모두 통과했습니다. `ruff`도 통과했습니다.
