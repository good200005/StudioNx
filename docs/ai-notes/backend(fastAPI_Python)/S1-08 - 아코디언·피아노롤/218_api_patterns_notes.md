# Backend(FastAPI/Python) 218 — 패턴 라우터 `PUT /patterns/{id}/notes` · `PATCH /patterns/{id}`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/patterns.py` |
| 작업 | S1-08 아코디언·피아노롤: 노트 저장·패턴 수정 API (PRD 02 FR-231, FR-233) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 217 패턴 라우터(목록·상세) · 219 마디 눈금 클릭으로 플레이헤드 |

## 1. 하는 일
패턴을 바꾸는 두 길을 엽니다. 둘 다 OWNER·EDITOR 만 되고 VIEWER 는 403 입니다.

| 메서드 · 경로 | 하는 일 | 권한 |
|---|---|---|
| `PUT /patterns/{id}/notes` | 노트를 보낸 목록으로 통째 교체 (215) | OWNER·EDITOR |
| `PATCH /patterns/{id}` | 이름·색·길이·스윙 수정 (216) | OWNER·EDITOR |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 피아노롤 | 노트를 찍고 고치고 지운 뒤 `PUT …/notes` 로 저장합니다 |
| 피아노롤 도구 | 패턴 이름·길이를 바꿀 때 `PATCH …` 를 씁니다 |

## 3. 코드
```python
@router.put(
    "/{pattern_id}/notes",
    response_model=PatternResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def replace_notes(
    pattern_id: int,
    data: NotesSaveRequest,
    user: CurrentUser,
    db: Db,
) -> PatternResponse:
    return pattern_service.replace_notes(db, user, pattern_id, data)

@router.patch(
    "/{pattern_id}",
    response_model=PatternResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def update_pattern(
    pattern_id: int,
    data: PatternUpdateRequest,
    user: CurrentUser,
    db: Db,
) -> PatternResponse:
    return pattern_service.update_pattern(db, user, pattern_id, data)
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `@router.put(...)` · `@router.patch(...)` | 각각 통째 교체, 일부 수정에 맞는 메서드입니다 |
| `/{pattern_id}/notes` | 그 패턴의 노트 묶음을 가리키는 하위 경로입니다 |
| `data: NotesSaveRequest` | 본문(JSON)을 스키마(213)로 검사해 받습니다 |
| `responses={403: ..., 404: ...}` | 문서에 두 오류 모양을 적어 둡니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 노트는 `PUT`(통째 교체) | 여러 노트가 한 번에 바뀌는 편집이라 목록 전체를 보내는 방식이 맞습니다 (215) |
| 패턴 정보는 `PATCH` | 이름 하나만 바꾸는 일이 많아 보낸 칸만 바꾸는 방식이 맞습니다 (216) |
| 403·404 를 문서에 명시 | 권한·없음 규칙을 API 문서에서 바로 알 수 있게 합니다 |

## 5. 시험
`tests/test_pattern_routes.py` 에서 노트 교체, 패턴 수정, 403·404·422 를 확인했습니다. 통과합니다.
