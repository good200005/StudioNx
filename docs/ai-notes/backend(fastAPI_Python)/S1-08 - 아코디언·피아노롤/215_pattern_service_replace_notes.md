# Backend(FastAPI/Python) 215 — `replace_notes()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/pattern_service.py` |
| 작업 | S1-08 아코디언·피아노롤: 노트 통째 교체 (PRD 02 FR-231) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 214 `pattern_service` 조회 · 216 `update_pattern` |

## 1. 하는 일
피아노롤이 보낸 노트 목록으로 그 패턴의 노트를 **통째로 갈아 끼웁니다**. 지금 붙은 노트를 모두 지우고 보낸 것을 새로 넣습니다. 한 트랜잭션이라 반쪽 상태가 남지 않습니다. 빈 목록이면 노트를 모두 지웁니다. 저장은 OWNER·EDITOR 만 하고, VIEWER 는 403 입니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `PUT /patterns/{id}/notes` (218) | 피아노롤이 노트를 바꿀 때마다 화면의 노트 전부를 다시 보냅니다 |
| 피아노롤 (sequencer-roll.js) | 노트 찍기·옮기기·지우기·겹쳐 찍기가 끝나면 이 API 를 부릅니다 (연결은 S1-10) |

## 3. 코드
```python
def replace_notes(
    db: Session, user: User, pattern_id: int, data: NotesSaveRequest
) -> PatternResponse:
    pattern, _project, member = _find(db, user, pattern_id)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)

    db.execute(delete(MidiNote).where(MidiNote.pattern_id == pattern.pattern_id))
    db.add_all(
        MidiNote(
            pattern_id=pattern.pattern_id,
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
        for note in data.notes
    )
    db.commit()
    return to_response(pattern, _notes(db, pattern.pattern_id))
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `require_role(member, OWNER, EDITOR)` | 둘 중 하나면 통과, 아니면 403 을 던집니다 |
| `db.execute(delete(...).where(...))` | 그 패턴의 노트 행을 한 번에 지웁니다 |
| `db.add_all(... for note in data.notes)` | 새 노트들을 한꺼번에 넣습니다 (제너레이터로 만듦) |
| `db.commit()` | 지우기와 넣기를 한 커밋으로 확정합니다 |
| `_notes(db, ...)` | 커밋 뒤 최신 노트를 다시 읽어 응답에 담습니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 통째 교체 | 피아노롤의 한 편집으로 여러 노트가 바뀝니다(겹침·이동). 노트마다 번호를 주고받으면 어긋나기 쉽습니다. 목록 전체를 다시 보내는 편이 간단하고 결과가 확실합니다 |
| 커밋 뒤 다시 읽음 | 교체 전에 세션이 들고 있던 옛 노트가 응답에 섞이지 않게, 쿼리로 최신 상태를 읽습니다 (214 `_notes`) |
| 빈 목록 허용 | 화면에서 노트를 다 지운 상태를 그대로 저장할 수 있어야 합니다 |
| 5000개 상한 | 실수로 아주 큰 목록을 보내는 것을 스키마(213)에서 막습니다 |

## 5. 시험
`tests/test_pattern_routes.py` 에서 교체 성공, 빈 목록으로 모두 지우기, 비멤버 404, VIEWER 403, 노트 422 를 확인했습니다. 통과합니다.
