# Backend(FastAPI/Python) 214 — `pattern_service` 조회 (`to_response` · `_note_item` · `_notes` · `_find` · `list_patterns` · `get_pattern`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/pattern_service.py` |
| 작업 | S1-08 아코디언·피아노롤: 패턴 목록·상세 (PRD 02 FR-232, FR-233) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 213 패턴 스키마 · 215 `replace_notes` |

## 1. 하는 일
패턴을 찾아 응답 모양으로 바꿉니다. 권한 규칙은 `project_service` 와 같습니다. 조회는 프로젝트 멤버면 누구나, 남의 프로젝트 패턴은 있는지조차 알려 주지 않고 404 로 막습니다(`get_membership`).

| 함수 | 하는 일 |
|---|---|
| `_note_item(note)` | `MidiNote` 행 → `NoteItem` |
| `_notes(db, pattern_id)` | 그 패턴의 노트를 시작 위치·음높이 차례로 읽음 |
| `to_response(pattern, notes)` | `Pattern` 행 → `PatternResponse` |
| `_find(db, user, pattern_id)` | 패턴·프로젝트·내 멤버 행을 함께 찾음 (없거나 남의 것이면 404) |
| `list_patterns(db, user, project_id)` | 프로젝트의 패턴 목록 (노트는 빼고 가볍게) |
| `get_pattern(db, user, pattern_id)` | 패턴 한 건과 노트 전부 (피아노롤이 열 때) |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `api/v1/patterns.py` (217) | 목록·상세 라우터가 부릅니다 |
| `replace_notes`·`update_pattern` (215·216) | 응답을 만들 때 `to_response` 를 함께 씁니다 |

```
GET /patterns?project_id=3
└─ list_patterns
   ├─ get_membership          ← 멤버 아니면 404
   └─ SELECT patterns WHERE project_id=3 ORDER BY pattern_id
      └─ to_response(notes=[])  ← 목록은 노트를 담지 않는다

GET /patterns/12
└─ get_pattern
   ├─ _find                    ← 패턴 없거나 남의 것이면 404
   └─ _notes(db, 12)           ← 시작 위치·음높이 차례
      └─ to_response
```

## 3. 코드
```python
def _note_item(note: MidiNote) -> NoteItem:
    return NoteItem(
        note_id=note.note_id,
        pitch=note.pitch,
        start_tick=note.start_tick,
        length_tick=note.length_tick,
        velocity=note.velocity,
        channel=note.channel,
        release_velocity=note.release_velocity,
        is_muted=note.is_muted,
        probability=note.probability,
        velocity_deviation=note.velocity_deviation,
    )

def _notes(db: Session, pattern_id: int) -> list[MidiNote]:
    return list(
        db.scalars(
            select(MidiNote)
            .where(MidiNote.pattern_id == pattern_id)
            .order_by(MidiNote.start_tick, MidiNote.pitch)
        ).all()
    )

def to_response(pattern: Pattern, notes: list[MidiNote] | None = None) -> PatternResponse:
    rows = pattern.notes if notes is None else notes
    return PatternResponse(
        pattern_id=pattern.pattern_id,
        project_id=pattern.project_id,
        name=pattern.name,
        color=pattern.color,
        length_tick=pattern.length_tick,
        swing=pattern.swing,
        updated_at=pattern.updated_at,
        notes=[_note_item(note) for note in rows],
    )

def _find(db: Session, user: User, pattern_id: int) -> tuple[Pattern, Project, ProjectMember]:
    pattern = db.get(Pattern, pattern_id)
    if pattern is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Pattern not found.")
    project, member = project_service.get_membership(db, pattern.project_id, user)
    return pattern, project, member

def list_patterns(db: Session, user: User, project_id: int) -> PatternListResponse:
    project_service.get_membership(db, project_id, user)
    rows = list(db.scalars(
        select(Pattern).where(Pattern.project_id == project_id).order_by(Pattern.pattern_id)
    ).all())
    return PatternListResponse(items=[to_response(p, notes=[]) for p in rows], total=len(rows))

def get_pattern(db: Session, user: User, pattern_id: int) -> PatternResponse:
    pattern, _project, _member = _find(db, user, pattern_id)
    return to_response(pattern, _notes(db, pattern.pattern_id))
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `notes: list[MidiNote] | None = None` | 값을 안 넘기면 `None` 이고, 그때만 `pattern.notes` 를 씁니다 |
| `pattern.notes if notes is None else notes` | "안 넘겼다"와 "빈 목록을 넘겼다"를 구분합니다 |
| `db.get(Pattern, id)` | 기본키로 한 행을 찾습니다 (없으면 `None`) |
| `raise AppError(ErrorCode.NOT_FOUND, 404, ...)` | 06번 오류 처리기가 같은 모양으로 응답합니다 |
| `select(...).order_by(...)` | SQL 로 정렬해 읽습니다 |
| `notes=[]` | 목록 응답은 빈 목록을 넘겨 노트를 빼둡니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 목록은 노트를 안 담음 | 프로젝트에 패턴이 많으면 노트까지 다 실으면 무겁습니다. 목록은 가볍게, 노트가 필요하면 상세로 받습니다 |
| `_notes` 로 직접 조회 | 통째 교체(215) 직후에는 세션에 옛 노트가 남아 있을 수 있습니다. 관계 대신 쿼리로 읽어 최신 상태를 봅니다 |
| 남의 것은 404 | 있는지조차 알려 주지 않는 편이 안전합니다. `get_membership` 이 이 규칙을 이미 갖고 있습니다 |
| `_find` 가 셋을 함께 돌려줌 | 뒤 두 함수(215·216)가 권한 검사를 위해 프로젝트·멤버 행을 같이 씁니다 |

## 5. 시험
`tests/test_pattern_routes.py` 에서 목록·상세 응답, 비멤버 404 를 확인했습니다. 통과합니다.
