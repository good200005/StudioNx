"""트랙 간 연결(Connect to Another) 서비스 — S1-10a, FR-2197.

한 트랙에서 나가는 연결은 하나뿐이다(DB UNIQUE uq_connections_from). 그래서 저장은
"보낸 값으로 통째로 맞추기", 지우기는 "연결 끄기" 두 가지다.

저장 전에 말이 되는지 본다.
- 자기 자신으로는 못 보낸다.
- 받는 트랙은 같은 프로젝트의 트랙이어야 한다.
- 두 트랙이 서로를 가리킬 수 없다 (A→B 가 있으면 B→A 는 못 만든다).
- 고리가 생기면 안 된다 (A→B→C 가 있으면 C→A 는 못 만든다).

권한은 다른 트랙 API 와 같다. 조회는 멤버면 누구나(없으면 404), 저장·지우기는
OWNER·EDITOR 만 (403). 남의 트랙은 있는지조차 알려 주지 않고 404 로 막는다.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.project import MemberRole
from app.models.track import Track
from app.models.track_connection import ConnectionTarget, TrackConnection
from app.models.track_plugin import TrackPlugin
from app.models.user import User
from app.schemas.connection import TrackConnectionSetRequest
from app.services import project_service, track_service


def _require_editor_track(db: Session, user: User, track_id: int) -> Track:
    """쓰기용 트랙 확인 — 남의 트랙은 404, 권한이 없으면 403."""
    track = track_service.require_track(db, user, track_id)
    _project, member = project_service.get_membership(db, track.project_id, user)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)
    return track


def _outgoing(db: Session, from_track_id: int) -> TrackConnection | None:
    """이 트랙에서 나가는 연결 한 건 (없으면 None)."""
    return db.scalar(
        select(TrackConnection).where(TrackConnection.from_track_id == from_track_id)
    )


def get_connection(db: Session, user: User, track_id: int) -> TrackConnection:
    """이 트랙에서 나가는 연결 (FR-2197). 없거나 남의 트랙이면 404."""
    track = track_service.require_track(db, user, track_id)
    connection = _outgoing(db, track.track_id)
    if connection is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Track connection not found.")
    return connection


def _reaches(db: Session, start: int, target: int) -> bool:
    """start 에서 나가는 연결을 따라가다 target 에 닿는지 본다 (고리 검사).

    트랙마다 나가는 연결이 하나뿐이라 단순히 한 줄로 따라가면 된다. 지나간 트랙을
    다시 만나면 이미 고리이므로 멈춘다 (무한 반복 방지).
    """
    seen: set[int] = set()
    current: int | None = start
    while current is not None and current not in seen:
        if current == target:
            return True
        seen.add(current)
        nxt = _outgoing(db, current)
        current = nxt.to_track_id if nxt is not None else None
    return current == target


def set_connection(
    db: Session, user: User, track_id: int, data: TrackConnectionSetRequest
) -> TrackConnection:
    """연결을 보낸 값으로 통째로 맞춘다 (FR-2197). 새로 만들거나 지금 것을 고친다.

    잘못된 연결(자기 자신 · 서로 연결 · 고리 · 다른 프로젝트)은 400, 없는 받는 트랙이나
    이펙트는 404 로 막는다.
    """
    track = _require_editor_track(db, user, track_id)

    if data.to_track_id == track.track_id:
        raise AppError(ErrorCode.BAD_REQUEST, 400, "A track cannot connect to itself.")
    to_track = db.get(Track, data.to_track_id)
    if to_track is None or to_track.project_id != track.project_id:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Target track not found.")

    back = _outgoing(db, to_track.track_id)
    if back is not None and back.to_track_id == track.track_id:
        raise AppError(
            ErrorCode.BAD_REQUEST, 400, "Two tracks cannot be connected to each other."
        )
    # 받는 트랙에서 따라가다 이 트랙에 닿으면 고리가 된다. 지금 이 트랙에서 나가는
    # 연결은 곧 바뀌므로, 검사는 받는 트랙 쪽에서만 한다.
    if _reaches(db, to_track.track_id, track.track_id):
        raise AppError(ErrorCode.BAD_REQUEST, 400, "This connection would make a loop.")

    to_track_plugin_id = None
    if data.target == ConnectionTarget.PLUGIN and data.to_track_plugin_id is not None:
        plugin = db.get(TrackPlugin, data.to_track_plugin_id)
        if plugin is None or plugin.track_id != to_track.track_id:
            raise AppError(ErrorCode.NOT_FOUND, 404, "Target effect not found.")
        to_track_plugin_id = plugin.track_plugin_id

    connection = _outgoing(db, track.track_id)
    if connection is None:
        connection = TrackConnection(from_track_id=track.track_id)
        db.add(connection)
    connection.to_track_id = to_track.track_id
    connection.target = data.target
    connection.to_track_plugin_id = to_track_plugin_id
    connection.to_port = data.to_port
    connection.also_play = data.also_play
    connection.volume_db = data.volume_db
    connection.pan = data.pan
    connection.is_solo = data.is_solo
    db.commit()
    db.refresh(connection)
    return connection


def delete_connection(db: Session, user: User, track_id: int) -> None:
    """연결 끄기 (FR-2197). OWNER·EDITOR 만. 연결이 없어도 그냥 지나간다."""
    track = _require_editor_track(db, user, track_id)
    connection = _outgoing(db, track.track_id)
    if connection is not None:
        db.delete(connection)
        db.commit()
