# Backend(FastAPI/Python) 84 — `get_published()` (공개된 공지 하나)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/dev_note_service.py` |
| 작업 | P1-21 공지 API와 관리자 화면: View More 모달이 보여 줄 공지 하나 가져오기 (PRD 01 FR-114) |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 이전 · 다음 | [83 `list_published()`](83_dev_note_list_published.md) · 85 `GET /dev-notes` 라우터 (다음) |

## 1. 하는 일
번호로 공지 하나를 찾아 돌려줍니다. 그 공지가 보이면 안 되는 상태이거나 없는 번호이면 **404**를 냅니다.

| 요청한 공지 | 결과 |
|---|---|
| 공개했고 공개 시각이 지남 | 공지를 돌려줌 |
| 초안 | 404 `NOT_FOUND` ("Note not found.") |
| 지운 공지 | 404 |
| 공개 시각이 미래 (예약 중) | 404 |
| 공개했는데 공개 시각이 비어 있음 | 404 |
| 없는 번호 | 404 |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 85 `GET /dev-notes/{note_id}` 라우터 (다음) | 메인 페이지 Development 카드의 View More 모달 |

## 3. 코드
**import** (이번에 추가한 것만)
```python
from app.core.errors import AppError, ErrorCode
```

**함수**
```python
def get_published(db: Session, note_id: int) -> DevNote:
    now = datetime.now(UTC).replace(tzinfo=None)
    note = db.scalar(select(DevNote).where(DevNote.note_id == note_id, *published_filters(now)))
    if note is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Note not found.")
    return note
```
백엔드(Python)는 지금 방식 그대로여서 "최신 문법" 버전은 따로 두지 않습니다.

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `db.scalar(select(...))` | 결과의 첫 행 하나를 가져옵니다. 없으면 `None`입니다 |
| `.where(번호 조건, *published_filters(now))` | 번호가 같다는 조건과, 83번에서 만든 "보여도 되는" 조건 세 개를 모두 `AND`로 묶습니다 |
| `raise AppError(코드, 404, 문구)` | 서비스가 일부러 내는 오류입니다. 오류 처리기가 `{"error": {"code": "NOT_FOUND", ...}}` JSON으로 바꿔 응답합니다 |

## 4. 흐름
1. 지금 시각(UTC)을 구합니다.
2. 번호가 같고 보여도 되는 조건(공개, 삭제 안 됨, 공개 시각이 지남)을 모두 만족하는 공지를 찾습니다.
3. 없으면 404를, 있으면 공지를 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 목록과 같은 조건(`published_filters`)을 씀 | 목록에 안 보이는 공지는 주소를 알아도 안 보여야 합니다. 초안 공지의 번호를 주소에 직접 치는 경우를 막습니다 |
| 없는 번호와 숨겨진 공지를 같은 404로 | "초안이 있다"는 사실도 알려 주지 않기 위해서입니다 |
| 먼저 찾고 나서 상태를 검사하지 않고 조건을 쿼리에 넣음 | 쿼리 한 번으로 끝나고, 초안의 내용이 파이썬 쪽으로 넘어올 일도 없습니다 |
| 문구는 "Note not found." 고정 | 번호나 내부 정보를 넣지 않습니다 |

## 6. 시험 (`tests/test_dev_note_service.py`, 이번에 7개 추가)
| 시험 | 결과 |
|---|---|
| 보이는 공지는 제목과 본문까지 돌려줌 | 통과입니다 |
| 초안, 지운 것, 예약 중, 공개 시각 없음, 없는 번호 5가지 | 모두 404, 코드 `NOT_FOUND`, 문구 `Note not found.` |
| 공지 여러 개를 두고, 목록에 있는 것만 상세로도 열리는지 비교 | 목록과 상세의 기준이 같음 |

이 파일의 시험은 83번의 4개와 합쳐 11개이며 모두 통과했습니다. `ruff`도 통과했습니다.
