"""오토메이션 레인·점 저장과 조회 — S1-15.

읽기는 프로젝트 멤버 누구나, 쓰기는 OWNER · EDITOR 만 한다 (clip_service 와 같은 규칙).
같은 대상(트랙, 종류, 장치, 파라미터)의 레인은 하나만 두고, 저장은 점을 통째로 바꾼다.
"""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.automation import AutomationLane, AutomationPoint, AutomationTarget
from app.models.project import MemberRole
from app.models.track_plugin import TrackInstrument, TrackPlugin
from app.models.user import User
from app.schemas.automation import (
    AutomationLaneResponse,
    AutomationLaneSaveRequest,
    AutomationPointItem,
)
from app.services import project_service, track_service


def _lane_response(lane: AutomationLane, points: list[AutomationPoint]) -> AutomationLaneResponse:
    return AutomationLaneResponse(
        lane_id=lane.lane_id,
        track_id=lane.track_id,
        target_type=lane.target_type,
        track_plugin_id=lane.track_plugin_id,
        track_instrument_id=lane.track_instrument_id,
        param_index=lane.param_index,
        is_enabled=bool(lane.is_enabled),
        points=[AutomationPointItem.model_validate(p) for p in points],
    )


def lanes_for_tracks(db: Session, track_ids: list[int]) -> dict[int, list[AutomationLaneResponse]]:
    """트랙 번호 → 그 트랙의 레인 목록 (프로젝트 전체 불러오기용)."""
    if not track_ids:
        return {}
    lanes = db.scalars(
        select(AutomationLane)
        .where(AutomationLane.track_id.in_(track_ids))
        .order_by(AutomationLane.lane_id)
    ).all()
    if not lanes:
        return {}
    points = db.scalars(
        select(AutomationPoint)
        .where(AutomationPoint.lane_id.in_([ln.lane_id for ln in lanes]))
        .order_by(AutomationPoint.lane_id, AutomationPoint.tick)
    ).all()
    by_lane: dict[int, list[AutomationPoint]] = {}
    for p in points:
        by_lane.setdefault(p.lane_id, []).append(p)
    out: dict[int, list[AutomationLaneResponse]] = {}
    for ln in lanes:
        out.setdefault(ln.track_id, []).append(_lane_response(ln, by_lane.get(ln.lane_id, [])))
    return out


def list_lanes(db: Session, user: User, track_id: int) -> list[AutomationLaneResponse]:
    track = track_service.require_track(db, user, track_id)
    project_service.get_membership(db, track.project_id, user)
    return lanes_for_tracks(db, [track_id]).get(track_id, [])


def save_lane(
    db: Session, user: User, track_id: int, data: AutomationLaneSaveRequest
) -> AutomationLaneResponse | None:
    """대상 하나의 곡선을 통째로 저장한다. 점이 없으면 레인을 지우고 None 을 돌려준다."""
    track = track_service.require_track(db, user, track_id)
    _project, member = project_service.get_membership(db, track.project_id, user)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)

    plugin_id = None
    instrument_id = None
    param_index = None
    if data.target_type == AutomationTarget.INSTRUMENT_PARAM:
        if data.track_instrument_id is None or data.param_index is None:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                400,
                "Instrument automation needs track_instrument_id and param_index.",
            )
        owner = db.scalar(
            select(TrackInstrument.track_id).where(
                TrackInstrument.track_instrument_id == data.track_instrument_id
            )
        )
        if owner != track_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, 400, "The instrument is not on this track.")
        instrument_id = data.track_instrument_id
        param_index = data.param_index
    elif data.target_type == AutomationTarget.DEVICE_PARAM:
        if data.track_plugin_id is None or data.param_index is None:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                400,
                "Plugin automation needs track_plugin_id and param_index.",
            )
        owner = db.scalar(
            select(TrackPlugin.track_id).where(TrackPlugin.track_plugin_id == data.track_plugin_id)
        )
        if owner != track_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, 400, "The plugin is not on this track.")
        plugin_id = data.track_plugin_id
        param_index = data.param_index

    query = select(AutomationLane).where(
        AutomationLane.track_id == track_id, AutomationLane.target_type == data.target_type
    )
    query = query.where(
        AutomationLane.track_plugin_id.is_(None)
        if plugin_id is None
        else AutomationLane.track_plugin_id == plugin_id
    )
    query = query.where(
        AutomationLane.track_instrument_id.is_(None)
        if instrument_id is None
        else AutomationLane.track_instrument_id == instrument_id
    )
    query = query.where(
        AutomationLane.param_index.is_(None)
        if param_index is None
        else AutomationLane.param_index == param_index
    )
    lane = db.scalars(query).first()

    if not data.points:
        if lane is not None:
            db.delete(lane)
            db.commit()
        return None
    if lane is None:
        lane = AutomationLane(
            track_id=track_id,
            target_type=data.target_type,
            track_plugin_id=plugin_id,
            track_instrument_id=instrument_id,
            param_index=param_index,
        )
        db.add(lane)
        db.flush()
    lane.is_enabled = data.is_enabled
    db.execute(delete(AutomationPoint).where(AutomationPoint.lane_id == lane.lane_id))
    rows = [
        AutomationPoint(lane_id=lane.lane_id, tick=p.tick, value=p.value, curve=p.curve)
        for p in sorted(data.points, key=lambda p: p.tick)
    ]
    db.add_all(rows)
    db.commit()
    db.refresh(lane)
    for row in rows:
        db.refresh(row)
    return _lane_response(lane, rows)
