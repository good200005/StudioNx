"""템포 변경점 서비스 — S1-13 (FR-202a).

- `list_tempo_changes`: 프로젝트의 템포 변경점 (tick 오름차순). 멤버면 누구나.
- `replace_tempo_changes`: 템포 줄이 바뀔 때마다 보낸 목록으로 통째 교체. OWNER·EDITOR 만.
- `tempo_items`: 이미 권한을 확인한 곳(GET /full)이 쓰는 읽기 함수.

권한 규칙은 project_service 와 같다. 남의 프로젝트는 있는지조차 알려 주지 않고 404 로 막는다.
"""

from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import TempoChange, User
from app.models.project import MemberRole
from app.models.tempo_change import TempoRamp
from app.schemas.tempo import (
    TempoChangeItem,
    TempoChangesResponse,
    TempoChangesSaveRequest,
)
from app.services import project_service


def _item(row: TempoChange) -> TempoChangeItem:
    """TempoChange → TempoChangeItem. bpm 은 DECIMAL 을 숫자(float)로 바꿔 보낸다."""
    return TempoChangeItem(
        tempo_change_id=row.tempo_change_id,
        tick=row.tick,
        bpm=float(row.bpm),
        ramp=row.ramp.value,
    )


def tempo_items(db: Session, project_id: int) -> list[TempoChangeItem]:
    """프로젝트의 템포 변경점을 tick 오름차순으로 읽는다 (권한 확인은 부르는 쪽이 한다).

    (구현: AI — 2026-10-21, S1-13) 통째 교체 직후에는 세션에 남은 옛 목록과 섞이지 않게
    관계 대신 쿼리로 DB 에서 새로 읽는다.
    """
    rows = db.scalars(
        select(TempoChange).where(TempoChange.project_id == project_id).order_by(TempoChange.tick)
    ).all()
    return [_item(row) for row in rows]


def list_tempo_changes(db: Session, user: User, project_id: int) -> TempoChangesResponse:
    """프로젝트의 템포 변경점 목록 (FR-202a). 멤버면 누구나."""
    project_service.get_membership(db, project_id, user)
    items = tempo_items(db, project_id)
    return TempoChangesResponse(items=items, total=len(items))


def replace_tempo_changes(
    db: Session, user: User, project_id: int, data: TempoChangesSaveRequest
) -> TempoChangesResponse:
    """템포 변경점을 보낸 목록으로 통째 교체한다 (FR-202a). OWNER·EDITOR 만.

    (구현: AI — 2026-10-21, S1-13) 지금 붙은 변경점을 모두 지우고 보낸 것을 새로 넣는다.
    한 트랜잭션이라 반쪽 상태가 남지 않는다. 빈 목록이면 모두 지워 처음의 평평한 템포로 돌아간다.
    같은 위치(tick) 중복은 요청 검증(422)이 먼저 막고, 삭제와 삽입을 같은 트랜잭션에서 하므로
    UNIQUE(project_id, tick) 에 걸리지 않는다.
    """
    project, member = project_service.get_membership(db, project_id, user)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)

    db.execute(delete(TempoChange).where(TempoChange.project_id == project.project_id))
    db.add_all(
        TempoChange(
            project_id=project.project_id,
            tick=change.tick,
            bpm=Decimal(str(change.bpm)),
            ramp=TempoRamp(change.ramp),
        )
        for change in data.changes
    )
    db.commit()
    items = tempo_items(db, project.project_id)
    return TempoChangesResponse(items=items, total=len(items))
