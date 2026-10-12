# Backend(FastAPI/Python) 85 — `GET /dev-notes`, `GET /dev-notes/{note_id}` 라우터

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/dev_notes.py` |
| 작업 | P1-21 공지 API와 관리자 화면: 메인 페이지가 부르는 공지 API 주소 두 개 (PRD 01 FR-114) |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 이전 · 다음 | [84 `get_published()`](84_dev_note_get_published.md) · 86 `AdminAuth` (다음) |

## 1. 하는 일
83, 84번 서비스를 **API 주소**로 내보냅니다. 두 주소 모두 **로그인 없이** 읽을 수 있고, 쓰기는 없습니다 (작성은 관리자 화면에서만 합니다).

| 요청 | 응답 |
|---|---|
| `GET /api/v1/dev-notes` | 200 `{"items": [{note_id, title, summary, published_at}, …]}` 최대 4개 (기본) |
| `GET /api/v1/dev-notes?limit=10` | 최대 10개 (1~50, 밖이면 422 `VALIDATION_ERROR`) |
| `GET /api/v1/dev-notes/7` | 200 `{note_id, title, summary, published_at, content}` |
| 상세에서 초안, 지운 것, 예약 중, 없는 번호 | 404 `NOT_FOUND` |
| 상세에서 번호가 숫자가 아님 (`/dev-notes/abc`) | 422 `VALIDATION_ERROR` |

목록의 한 줄에는 **본문(`content`)이 없고**, 상세에만 있습니다. 카드 4개를 보여 줄 때 긴 본문을 함께 보내지 않기 위해서입니다.

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| `pages/home.js`의 `loadDevNotes()` (아직 비어 있음) | 메인 페이지의 Development 카드, View More 모달 |

## 3. 코드
**import** (이번에 추가한 것만)
```python
from app.schemas.dev_note import DEV_NOTES_LIMIT_MAX, DevNoteDetail, DevNoteItem, DevNoteListResponse
from app.services import dev_note_service
```
`router`, `Db`, `ErrorResponse`와 두 라우터의 모양(`response_model`, `limit` 범위)은 뼈대에 이미 있었습니다.

**함수**
```python
@router.get("", response_model=DevNoteListResponse)
def list_dev_notes(db: Db, limit: Annotated[int, Query(ge=1, le=DEV_NOTES_LIMIT_MAX)] = 4):
    notes = dev_note_service.list_published(db, limit)
    return DevNoteListResponse(
        items=[DevNoteItem.model_validate(n, from_attributes=True) for n in notes]
    )


@router.get("/{note_id}", response_model=DevNoteDetail, responses={404: {"model": ErrorResponse}})
def read_dev_note(note_id: int, db: Db):
    return DevNoteDetail.model_validate(
        dev_note_service.get_published(db, note_id), from_attributes=True
    )
```
백엔드(Python)는 지금 방식 그대로여서 "최신 문법" 버전은 따로 두지 않습니다.

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `Query(ge=1, le=50)` | 쿼리 `limit`이 1 이상 50 이하여야 합니다. 밖이면 FastAPI가 422를 냅니다 |
| `DevNoteItem.model_validate(n, from_attributes=True)` | DB 모델(`DevNote`)의 칸을 읽어 응답 모양(`DevNoteItem`)으로 바꿉니다. 응답 모양에 없는 칸(`content`, `author_id` 등)은 버려집니다 |
| `response_model=…` | 이 모양으로 응답을 한 번 더 걸러 냅니다 |
| `note_id: int` | 주소의 번호를 정수로 받으며, 숫자가 아니면 422입니다 |
| `db: Db` | 요청마다 DB 세션을 받습니다. 로그인한 회원(`CurrentUser`)은 받지 않으므로 토큰이 필요 없습니다 |

## 4. 흐름
1. 주소와 `limit`의 형식을 FastAPI가 먼저 검사합니다 (422).
2. 서비스(83 또는 84)가 공개된 공지를 찾습니다. 상세에서 못 찾으면 서비스가 404를 냅니다.
3. DB 모델을 응답 모양으로 바꿔 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 로그인 없이 | 메인 페이지는 로그인 전에도 보이므로, 공개 공지도 누구나 읽어야 합니다 (FR-114) |
| 목록과 상세의 응답 모양을 나눔 | 목록은 카드(날짜, 제목, 요약)만, 상세는 본문까지. 전송량이 줄어듭니다 |
| `content`는 Markdown 원문 그대로 | 화면(`home.js`)이 HTML로 바꿀 때 반드시 안전 처리(escape)해야 합니다. 서버는 원문을 건드리지 않습니다 |
| 라우터에는 판단을 두지 않음 | "무엇이 공개인가"는 서비스에만 있어서, 목록과 상세가 어긋나지 않습니다 |
| `author_id`는 응답에 없음 | 작성한 관리자의 번호를 공개할 이유가 없습니다 |

## 6. 시험 (`tests/test_dev_note_routes.py`, 13개)
| 시험 | 결과 |
|---|---|
| 두 주소가 앱에 등록됨 | 통과입니다 |
| 토큰 없이 목록 요청: 200, 한 줄에 네 칸(`note_id`, `title`, `summary`, `published_at`)뿐이고 `content` 없음 | 통과입니다 |
| 초안은 목록에 없고, 기본 개수는 4개 이하 | 통과입니다 |
| `limit`이 0, 51, -1, `abc` | 모두 422 `VALIDATION_ERROR` |
| 토큰 없이 상세 요청: 200, 본문(`content`) 포함, 다섯 칸 | 통과입니다 |
| 상세에서 초안, 지운 것, 예약 중, 없는 번호 | 모두 JSON 404 `NOT_FOUND` |
| 상세의 번호가 `abc` | 422 |

13개 모두 통과했습니다. 백엔드 전체는 **595개 통과**, `ruff`도 통과했습니다.

## 7. 남은 것
메인 페이지의 `loadDevNotes()`(JS)는 아직 비어 있습니다. P1-21은 백엔드 작업이고, 그 함수는 이 API가 준비된 뒤에 채우면 됩니다 (P1-19 이후 홈 화면 점검에서 정합니다).
