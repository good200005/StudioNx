# 백엔드 325 — 박자 변경점 서비스 (`services/meter_service.py`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/meter_service.py` |
| 작업 | S1-18 박자 줄: 박자 변경점을 읽고, 통째로 교체 (FR-202b) |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 324 모델과 스키마, 다음 326 API |

## 1. 하는 일

| 함수 | 하는 일 |
|---|---|
| `meter_items(db, project_id)` | 변경점을 tick 오름차순으로 읽습니다. 권한 확인은 부르는 쪽이 합니다. `GET /full`이 씁니다. |
| `list_meter_changes(db, user, project_id)` | 멤버인지 확인한 뒤 목록을 돌려줍니다. 멤버가 아니면 404입니다. |
| `replace_meter_changes(db, user, project_id, data)` | OWNER, EDITOR만 보낸 목록으로 통째 교체합니다. VIEWER는 403입니다. |

## 2. 코드

```python
def replace_meter_changes(db, user, project_id, data):
    project, member = project_service.get_membership(db, project_id, user)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)

    db.execute(delete(MeterChange).where(MeterChange.project_id == project.project_id))
    db.add_all(MeterChange(project_id=project.project_id, tick=c.tick,
                           time_sig_num=c.time_sig_num, time_sig_den=c.time_sig_den)
               for c in data.changes)
    db.commit()
    items = meter_items(db, project.project_id)
    return MeterChangesResponse(items=items, total=len(items))
```

한 트랜잭션에서 지우고 다시 넣으므로 반쪽 상태가 남지 않습니다. 빈 목록을 보내면 모두 지워지고 시작 박자만 남습니다.

## 3. Q&A

Q. 템포 서비스와 무엇이 다른가요?
A. 구조는 같고 값만 다릅니다. 템포는 `bpm`과 `ramp`를, 박자는 분자와 분모를 가집니다. 박자에는 소수 자리 반올림이 없습니다.
