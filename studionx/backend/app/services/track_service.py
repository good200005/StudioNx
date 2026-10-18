"""트랙 서비스 — S1-09 (FR-251·263·264·265~269).

트랙 한 줄의 목록·만들기·수정·삭제와, 그 안에 붙는 악기·이펙트·연결선을 다룬다.

권한 규칙은 project_service 와 같다. 조회는 멤버면 누구나(404 로 숨김),
만들기·수정·삭제는 OWNER·EDITOR 만 (403). 남의 프로젝트는 있는지조차 404.
쓰기 뒤에는 db.commit() 을 해야 실제 DB 에 남는다 (get_db 는 commit 하지 않음).
"""

from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.plugin import PluginType
from app.models.project import MemberRole
from app.models.track import RoutingMode, Track, TrackType
from app.models.track_plugin import TrackInstrument, TrackPlugin, TrackPluginLink
from app.models.user import User
from app.services import plugin_service, project_service


def _find_track(db: Session, user: User, track_id: int):
    """트랙과 그 프로젝트·내 멤버 행을 함께 찾는다. 없거나 남의 것이면 404."""
    track = db.get(Track, track_id)
    if track is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Track not found.")
    project, member = project_service.get_membership(db, track.project_id, user)
    return track, project, member


def _require_editor_track(db: Session, user: User, track_id: int) -> Track:
    """쓰기가 필요한 작업용: 남의 트랙은 404, 권한이 없으면 403."""
    track, _project, member = _find_track(db, user, track_id)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)
    return track


def list_tracks(db: Session, user: User, project_id: int) -> Sequence[Track]:
    """프로젝트의 트랙 목록 (order_index, track_id 순). 멤버면 누구나 (FR-251)."""
    project_service.get_membership(db, project_id, user)
    stmt = (
        select(Track)
        .where(Track.project_id == project_id)
        .order_by(Track.order_index, Track.track_id)
    )
    return db.execute(stmt).scalars().all()


def create_track(
    db: Session,
    user: User,
    project_id: int,
    *,
    name: str,
    track_type: TrackType = TrackType.MIDI,
    color: str = "#7C5CFF",
    volume_db: Decimal = Decimal("0.00"),
    pan: Decimal = Decimal("0.00"),
    is_muted: bool = False,
    is_solo: bool = False,
    is_enabled: bool = True,
    routing_mode: RoutingMode = RoutingMode.CHAIN,
    order_index: int = 0,
    parent_track_id: int | None = None,
) -> Track:
    """트랙 만들기 (FR-251). OWNER·EDITOR 만. 부모는 같은 프로젝트의 트랙이어야 한다."""
    project, member = project_service.get_membership(db, project_id, user)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)
    if parent_track_id:
        parent = db.get(Track, parent_track_id)
        if parent is None or parent.project_id != project.project_id:
            raise AppError(ErrorCode.BAD_REQUEST, 400, "Invalid parent track.")
    track = Track(
        project_id=project.project_id,
        name=name,
        track_type=track_type,
        order_index=order_index,
        color=color,
        volume_db=volume_db,
        pan=pan,
        is_muted=is_muted,
        is_solo=is_solo,
        is_enabled=is_enabled,
        routing_mode=routing_mode,
        parent_track_id=parent_track_id,
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return track


def require_track(db: Session, user: User, track_id: int) -> Track:
    """트랙 한 건. 없거나 남의 것이면 404 (조회 권한)."""
    track, _project, _member = _find_track(db, user, track_id)
    return track


def update_track(db: Session, user: User, track_id: int, **kwargs) -> Track:
    """트랙 수정 (FR-251·269). OWNER·EDITOR 만. 보낸 칸만 바꾸고 None 은 넘겨도 그대로."""
    track = _require_editor_track(db, user, track_id)
    for key, value in kwargs.items():
        if value is not None and hasattr(track, key):
            setattr(track, key, value)
    db.commit()
    db.refresh(track)
    return track


def delete_track(db: Session, user: User, track_id: int) -> None:
    """트랙 삭제 (FR-251). OWNER·EDITOR 만. 악기·이펙트·연결선은 DB CASCADE 로 함께 지워진다."""
    track = _require_editor_track(db, user, track_id)
    db.delete(track)
    db.commit()


def _require_free_slot(
    db: Session, model, track_id: int, slot_index: int, what: str, exclude_id: int | None = None
) -> None:
    """같은 트랙의 같은 칸에는 한 행만 넣을 수 있다 (DB UNIQUE (track_id, slot_index)).

    안 막으면 DB 가 IntegrityError 를 뱉어 500 이 된다. 화면이 이미 찬 칸에 넣으려 하면
    400 으로 알려 주어, 다른 칸 번호를 골라 다시 보내게 한다 (FR-263 순서 편집).
    exclude_id 는 고쳐지는 칸 자신이다 (자기 자리에 다시 넣는 것은 막지 않는다).
    """
    pk_name = model.__mapper__.primary_key[0].name
    stmt = (
        select(func.count())
        .select_from(model)
        .where(model.track_id == track_id, model.slot_index == slot_index)
    )
    if exclude_id is not None:
        stmt = stmt.where(getattr(model, pk_name) != exclude_id)
    if db.scalar(stmt):
        raise AppError(
            ErrorCode.BAD_REQUEST, 400, f"Slot {slot_index} is already used by another {what}."
        )


def list_instruments(db: Session, user: User, track_id: int) -> Sequence[TrackInstrument]:
    """트랙의 악기 칸 목록 (slot_index 순). 멤버면 누구나 (FR-245).

    (구현: AI — 2026-10-18, S1-09) 관계(track.instruments) 대신 쿼리로 읽는다 —
    같은 요청 안에서 지우고 다시 읽을 때 지난 결과와 섞이지 않도록 한다.
    """
    track = require_track(db, user, track_id)
    stmt = (
        select(TrackInstrument)
        .where(TrackInstrument.track_id == track.track_id)
        .order_by(TrackInstrument.slot_index, TrackInstrument.track_instrument_id)
    )
    return db.execute(stmt).scalars().all()


def list_effects(db: Session, user: User, track_id: int) -> Sequence[TrackPlugin]:
    """트랙의 이펙트 칸 목록 (slot_index 순 = 체인 순서). 멤버면 누구나 (FR-263)."""
    track = require_track(db, user, track_id)
    stmt = (
        select(TrackPlugin)
        .where(TrackPlugin.track_id == track.track_id)
        .order_by(TrackPlugin.slot_index, TrackPlugin.track_plugin_id)
    )
    return db.execute(stmt).scalars().all()


def _require_instrument(db: Session, user: User, track_id: int, instrument_id: int):
    """경로의 트랙에 속한 악기인지 확인하고 쓰기 권한까지 검사한다."""
    inst = db.get(TrackInstrument, instrument_id)
    if inst is None or inst.track_id != track_id:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Track instrument not found.")
    _require_editor_track(db, user, track_id)
    return inst


def add_instrument(
    db: Session,
    user: User,
    track_id: int,
    *,
    plugin_id: int,
    slot_index: int = 0,
    params: dict | None = None,
    volume_db: Decimal = Decimal("0.00"),
    pan: Decimal = Decimal("0.00"),
    is_solo: bool = False,
    is_enabled: bool = True,
) -> TrackInstrument:
    """트랙에 악기 한 칸 붙이기 (FR-245·264). OWNER·EDITOR 만, INSTRUMENT 만 가능."""
    _require_editor_track(db, user, track_id)
    plugin = plugin_service.require_plugin(db, plugin_id)
    if plugin.plugin_type != PluginType.INSTRUMENT:
        raise AppError(
            ErrorCode.BAD_REQUEST, 400, "Only INSTRUMENT plugins can be added to instruments."
        )
    _require_free_slot(db, TrackInstrument, track_id, slot_index, "instrument")
    inst = TrackInstrument(
        track_id=track_id,
        plugin_id=plugin_id,
        slot_index=slot_index,
        params=params or {},
        volume_db=volume_db,
        pan=pan,
        is_solo=is_solo,
        is_enabled=is_enabled,
    )
    db.add(inst)
    db.commit()
    db.refresh(inst)
    return inst


def update_instrument(
    db: Session, user: User, track_id: int, instrument_id: int, **kwargs
) -> TrackInstrument:
    """악기 칸 수정 (파라미터·볼륨·팬·켜기). OWNER·EDITOR 만."""
    inst = _require_instrument(db, user, track_id, instrument_id)
    if "slot_index" in kwargs and kwargs["slot_index"] is not None:
        _require_free_slot(
            db,
            TrackInstrument,
            track_id,
            kwargs["slot_index"],
            "instrument",
            exclude_id=inst.track_instrument_id,
        )
    for key, value in kwargs.items():
        if value is not None and hasattr(inst, key):
            setattr(inst, key, value)
    db.commit()
    db.refresh(inst)
    return inst


def remove_instrument(db: Session, user: User, track_id: int, instrument_id: int) -> None:
    """악기 칸 떼기 (FR-264). OWNER·EDITOR 만."""
    inst = _require_instrument(db, user, track_id, instrument_id)
    db.delete(inst)
    db.commit()


def _require_effect(db: Session, user: User, track_id: int, track_plugin_id: int):
    """경로의 트랙에 속한 이펙트인지 확인하고 쓰기 권한까지 검사한다."""
    tp = db.get(TrackPlugin, track_plugin_id)
    if tp is None or tp.track_id != track_id:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Track effect not found.")
    _require_editor_track(db, user, track_id)
    return tp


def add_effect(
    db: Session,
    user: User,
    track_id: int,
    *,
    plugin_id: int,
    slot_index: int,
    node_x: int | None = None,
    node_y: int | None = None,
    params: dict | None = None,
    is_bypassed: bool = False,
) -> TrackPlugin:
    """트랙에 이펙트 한 칸 붙이기 (FR-245·263). OWNER·EDITOR 만, EFFECT 만 가능.

    slot_index 가 체인 순서, node_x·node_y 는 갈래(패처) 화면의 자리다 (FR-269).
    """
    _require_editor_track(db, user, track_id)
    plugin = plugin_service.require_plugin(db, plugin_id)
    if plugin.plugin_type != PluginType.EFFECT:
        raise AppError(
            ErrorCode.BAD_REQUEST, 400, "Only EFFECT plugins can be added to effects chain."
        )
    _require_free_slot(db, TrackPlugin, track_id, slot_index, "effect")
    tp = TrackPlugin(
        track_id=track_id,
        plugin_id=plugin_id,
        slot_index=slot_index,
        node_x=node_x,
        node_y=node_y,
        params=params or {},
        is_bypassed=is_bypassed,
    )
    db.add(tp)
    db.commit()
    db.refresh(tp)
    return tp


def update_effect(
    db: Session, user: User, track_id: int, track_plugin_id: int, **kwargs
) -> TrackPlugin:
    """이펙트 칸 수정 (순서·자리·파라미터·바이패스). OWNER·EDITOR 만."""
    tp = _require_effect(db, user, track_id, track_plugin_id)
    if "slot_index" in kwargs and kwargs["slot_index"] is not None:
        _require_free_slot(
            db, TrackPlugin, track_id, kwargs["slot_index"], "effect", exclude_id=tp.track_plugin_id
        )
    for key, value in kwargs.items():
        if value is not None and hasattr(tp, key):
            setattr(tp, key, value)
    db.commit()
    db.refresh(tp)
    return tp


def remove_effect(db: Session, user: User, track_id: int, track_plugin_id: int) -> None:
    """이펙트 칸 떼기 (FR-263). OWNER·EDITOR 만."""
    tp = _require_effect(db, user, track_id, track_plugin_id)
    db.delete(tp)
    db.commit()


def list_links(db: Session, user: User, track_id: int) -> Sequence[TrackPluginLink]:
    """트랙의 연결선 목록 (FR-267). 멤버면 누구나."""
    track = require_track(db, user, track_id)
    stmt = (
        select(TrackPluginLink)
        .where(TrackPluginLink.track_id == track.track_id)
        .order_by(TrackPluginLink.link_id)
    )
    return db.execute(stmt).scalars().all()


def add_link(
    db: Session,
    user: User,
    track_id: int,
    *,
    from_track_plugin_id: int | None = None,
    from_port: int = 0,
    to_track_plugin_id: int | None = None,
    to_port: int = 0,
    gain_db: Decimal = Decimal("0.00"),
) -> TrackPluginLink:
    """갈래 연결선 붙이기 (FR-267·269). OWNER·EDITOR 만.

    from 이 NULL 이면 트랙 입력(소스), to 가 NULL 이면 트랙 출력이다.
    한쪽이 NULL 이 아닌 연결선은 같은 트랙의 이펙트를 가리켜야 한다 (404).
    """
    track = _require_editor_track(db, user, track_id)
    for plugin_id in (from_track_plugin_id, to_track_plugin_id):
        if plugin_id is None:
            continue
        tp = db.get(TrackPlugin, plugin_id)
        if tp is None or tp.track_id != track.track_id:
            raise AppError(ErrorCode.NOT_FOUND, 404, "Track effect not found.")
    link = TrackPluginLink(
        track_id=track.track_id,
        from_track_plugin_id=from_track_plugin_id,
        from_port=from_port,
        to_track_plugin_id=to_track_plugin_id,
        to_port=to_port,
        gain_db=gain_db,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def remove_link(db: Session, user: User, track_id: int, link_id: int) -> None:
    """연결선 떼기 (FR-267). OWNER·EDITOR 만."""
    link = db.get(TrackPluginLink, link_id)
    if link is None or link.track_id != track_id:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Track plugin link not found.")
    _require_editor_track(db, user, track_id)
    db.delete(link)
    db.commit()
