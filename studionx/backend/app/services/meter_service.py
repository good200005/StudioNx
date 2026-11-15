"""박자 변경점 서비스 — S1-18 (FR-202b). 템포 서비스(tempo_service)와 같은 구조.

- `list_meter_changes`: 프로젝트의 박자 변경점 (tick 오름차순). 멤버면 누구나.
- `replace_meter_changes`: 박자 줄이 바뀔 때마다 보낸 목록으로 통째 교체. OWNER·EDITOR 만.
- `meter_items`: 이미 권한을 확인한 곳(GET /full)이 쓰는 읽기 함수.
"""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import MeterChange, User
from app.models.project import MemberRole
from app.schemas.meter import MeterChangeItem, MeterChangesResponse, MeterChangesSaveRequest
from app.services import project_service


def meter_items(db: Session, project_id: int) -> list[MeterChangeItem]:
    """프로젝트의 박자 변경점을 tick 오름차순으로 읽는다 (권한 확인은 부르는 쪽이 한다)."""
    rows = db.scalars(
        select(MeterChange).where(MeterChange.project_id == project_id).order_by(MeterChange.tick)
    ).all()
    return [
        MeterChangeItem(
            meter_change_id=row.meter_change_id,
            tick=row.tick,
            time_sig_num=row.time_sig_num,
            time_sig_den=row.time_sig_den,
        )
        for row in rows
    ]


def list_meter_changes(db: Session, user: User, project_id: int) -> MeterChangesResponse:
    """프로젝트의 박자 변경점 목록 (FR-202b). 멤버면 누구나."""
    project_service.get_membership(db, project_id, user)
    items = meter_items(db, project_id)
    return MeterChangesResponse(items=items, total=len(items))


def replace_meter_changes(
    db: Session, user: User, project_id: int, data: MeterChangesSaveRequest
) -> MeterChangesResponse:
    """박자 변경점을 보낸 목록으로 통째 교체한다 (FR-202b). OWNER·EDITOR 만.

    한 트랜잭션에서 지우고 다시 넣으므로 반쪽 상태가 남지 않고, 같은 위치 중복은 요청 검증(422)이
    먼저 막는다. 빈 목록이면 모두 지워 시작 박자만 남는다.
    """
    project, member = project_service.get_membership(db, project_id, user)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)

    db.execute(delete(MeterChange).where(MeterChange.project_id == project.project_id))
    db.add_all(
        MeterChange(
            project_id=project.project_id,
            tick=change.tick,
            time_sig_num=change.time_sig_num,
            time_sig_den=change.time_sig_den,
        )
        for change in data.changes
    )
    db.commit()
    items = meter_items(db, project.project_id)
    return MeterChangesResponse(items=items, total=len(items))
