"""트랙 서비스 — S1-09 (FR-251·263·264·265~269)."""

from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.project import MemberRole
from app.models.track import RoutingMode, Track, TrackType
from app.models.track_plugin import TrackInstrument, TrackPlugin, TrackPluginLink
from app.services import plugin_service, project_service


def _require_membership(db: Session, project_id: int, user_id: int):
    m = project_service.get_membership(db, project_id, user_id)
    if not m:
        raise AppError(ErrorCode.NOT_FOUND, "Project not found")
    return m


def _require_editor_or_owner(db: Session, project_id: int, user_id: int):
    m = _require_membership(db, project_id, user_id)
    if m.role not in (MemberRole.OWNER, MemberRole.EDITOR):
        raise AppError(ErrorCode.FORBIDDEN, "Permission denied")
    return m


def list_tracks(db: Session, project_id: int, user_id: int) -> Sequence[Track]:
    _require_membership(db, project_id, user_id)
    stmt = (
        select(Track)
        .where(Track.project_id == project_id)
        .order_by(Track.order_index, Track.track_id)
    )
    return db.execute(stmt).scalars().all()


def create_track(
    db: Session,
    project_id: int,
    user_id: int,
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
    _require_editor_or_owner(db, project_id, user_id)
    if parent_track_id:
        parent = db.get(Track, parent_track_id)
        if not parent or parent.project_id != project_id:
            raise AppError(ErrorCode.BAD_REQUEST, "Invalid parent track")
    t = Track(
        project_id=project_id,
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
    db.add(t)
    db.flush()
    return t


def get_track(db: Session, track_id: int, user_id: int) -> Track | None:
    t = db.get(Track, track_id)
    if not t:
        return None
    _require_membership(db, t.project_id, user_id)
    return t


def require_track(db: Session, track_id: int, user_id: int) -> Track:
    t = get_track(db, track_id, user_id)
    if not t:
        raise AppError(ErrorCode.NOT_FOUND, "Track not found")
    return t


def update_track(db: Session, track_id: int, user_id: int, **kwargs) -> Track:
    t = require_track(db, track_id, user_id)
    _require_editor_or_owner(db, t.project_id, user_id)
    for k, v in kwargs.items():
        if v is not None and hasattr(t, k):
            setattr(t, k, v)
    db.flush()
    return t


def delete_track(db: Session, track_id: int, user_id: int) -> None:
    t = require_track(db, track_id, user_id)
    _require_editor_or_owner(db, t.project_id, user_id)
    db.delete(t)
    db.flush()


def add_instrument(
    db: Session,
    track_id: int,
    user_id: int,
    *,
    plugin_id: int,
    slot_index: int = 0,
    params: dict | None = None,
    volume_db: Decimal = Decimal("0.00"),
    pan: Decimal = Decimal("0.00"),
    is_solo: bool = False,
    is_enabled: bool = True,
) -> TrackInstrument:
    t = require_track(db, track_id, user_id)
    _require_editor_or_owner(db, t.project_id, user_id)
    plugin = plugin_service.require_plugin(db, plugin_id)
    if plugin.plugin_type != "INSTRUMENT":
        raise AppError(ErrorCode.BAD_REQUEST, "Only INSTRUMENT plugins can be added to instruments")
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
    db.flush()
    return inst


def update_instrument(
    db: Session,
    instrument_id: int,
    user_id: int,
    **kwargs,
) -> TrackInstrument:
    inst = db.get(TrackInstrument, instrument_id)
    if not inst:
        raise AppError(ErrorCode.NOT_FOUND, "Track instrument not found")
    t = require_track(db, inst.track_id, user_id)
    _require_editor_or_owner(db, t.project_id, user_id)
    for k, v in kwargs.items():
        if v is not None and hasattr(inst, k):
            setattr(inst, k, v)
    db.flush()
    return inst


def remove_instrument(db: Session, instrument_id: int, user_id: int) -> None:
    inst = db.get(TrackInstrument, instrument_id)
    if not inst:
        raise AppError(ErrorCode.NOT_FOUND, "Track instrument not found")
    t = require_track(db, inst.track_id, user_id)
    _require_editor_or_owner(db, t.project_id, user_id)
    db.delete(inst)
    db.flush()


def add_effect(
    db: Session,
    track_id: int,
    user_id: int,
    *,
    plugin_id: int,
    slot_index: int,
    node_x: int | None = None,
    node_y: int | None = None,
    params: dict | None = None,
    is_bypassed: bool = False,
) -> TrackPlugin:
    t = require_track(db, track_id, user_id)
    _require_editor_or_owner(db, t.project_id, user_id)
    plugin = plugin_service.require_plugin(db, plugin_id)
    if plugin.plugin_type != "EFFECT":
        raise AppError(ErrorCode.BAD_REQUEST, "Only EFFECT plugins can be added to effects chain")
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
    db.flush()
    return tp


def update_effect(
    db: Session,
    track_plugin_id: int,
    user_id: int,
    **kwargs,
) -> TrackPlugin:
    tp = db.get(TrackPlugin, track_plugin_id)
    if not tp:
        raise AppError(ErrorCode.NOT_FOUND, "Track effect not found")
    t = require_track(db, tp.track_id, user_id)
    _require_editor_or_owner(db, t.project_id, user_id)
    for k, v in kwargs.items():
        if v is not None and hasattr(tp, k):
            setattr(tp, k, v)
    db.flush()
    return tp


def remove_effect(db: Session, track_plugin_id: int, user_id: int) -> None:
    tp = db.get(TrackPlugin, track_plugin_id)
    if not tp:
        raise AppError(ErrorCode.NOT_FOUND, "Track effect not found")
    t = require_track(db, tp.track_id, user_id)
    _require_editor_or_owner(db, t.project_id, user_id)
    db.delete(tp)
    db.flush()


def list_links(db: Session, track_id: int, user_id: int) -> Sequence[TrackPluginLink]:
    t = require_track(db, track_id, user_id)
    stmt = (
        select(TrackPluginLink)
        .where(TrackPluginLink.track_id == t.track_id)
        .order_by(TrackPluginLink.link_id)
    )
    return db.execute(stmt).scalars().all()


def add_link(
    db: Session,
    track_id: int,
    user_id: int,
    *,
    from_track_plugin_id: int | None = None,
    from_port: int = 0,
    to_track_plugin_id: int | None = None,
    to_port: int = 0,
    gain_db: Decimal = Decimal("0.00"),
) -> TrackPluginLink:
    t = require_track(db, track_id, user_id)
    _require_editor_or_owner(db, t.project_id, user_id)
    link = TrackPluginLink(
        track_id=track_id,
        from_track_plugin_id=from_track_plugin_id,
        from_port=from_port,
        to_track_plugin_id=to_track_plugin_id,
        to_port=to_port,
        gain_db=gain_db,
    )
    db.add(link)
    db.flush()
    return link


def remove_link(db: Session, link_id: int, user_id: int) -> None:
    link = db.get(TrackPluginLink, link_id)
    if not link:
        raise AppError(ErrorCode.NOT_FOUND, "Track plugin link not found")
    t = require_track(db, link.track_id, user_id)
    _require_editor_or_owner(db, t.project_id, user_id)
    db.delete(link)
    db.flush()
