# Backend(FastAPI/Python) 216 — `update_pattern()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/pattern_service.py` |
| 작업 | S1-08 아코디언·피아노롤: 패턴 이름·색·길이·스윙 수정 (PRD 02 FR-233) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 215 `replace_notes` · 217 패턴 라우터(목록·상세) |

## 1. 하는 일
패턴의 이름·색·길이·스윙을 고칩니다. **보낸 칸만** 바꾸고, 보내지 않은 칸은 그대로 둡니다. 저장은 OWNER·EDITOR 만 하고(VIEWER 403), 남의 프로젝트 패턴은 404 입니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `PATCH /patterns/{id}` (218) | 패턴 이름 바꾸기, 색 지정, 길이(마디)·스윙 조절 |
| 피아노롤 위쪽 도구 | 패턴 길이(마디)를 바꿀 때 (연결은 S1-10) |

## 3. 코드
```python
def update_pattern(
    db: Session, user: User, pattern_id: int, data: PatternUpdateRequest
) -> PatternResponse:
    pattern, _project, member = _find(db, user, pattern_id)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pattern, field, value)
    db.commit()
    db.refresh(pattern)
    return to_response(pattern, _notes(db, pattern.pattern_id))
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `data.model_dump(exclude_unset=True)` | **보낸 칸만** 꺼냅니다. 안 보낸 칸은 목록에서 빠집니다 |
| `setattr(pattern, field, value)` | 모델 행의 그 칸에 값을 넣습니다. `field` 는 칸 이름 문자열입니다 |
| `db.commit()` | 바뀐 칸을 확정합니다 |
| `db.refresh(pattern)` | `updated_at` 처럼 DB 가 채우는 칸을 다시 읽습니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `exclude_unset=True` | `PATCH` 는 "보낸 칸만 바꾼다"가 규칙입니다. 안 보낸 칸을 안 건드리려면 이 옵션이 필요합니다 |
| `refresh` | `updated_at` 은 DB 의 `ON UPDATE` 가 채웁니다. 커밋 뒤 다시 읽어야 응답에 최신 값이 담깁니다 |
| 이름은 빈 값 금지 | 스키마(213)의 `_name_not_null` 이 `null` 을 막고, `PatternName` 이 공백만 친 이름을 422 로 막습니다 |

## 5. 시험
`tests/test_pattern_routes.py` 에서 이름·색·길이 수정, 보낸 칸만 바뀌는지, VIEWER 403 을 확인했습니다. 통과합니다.
