"""클립(타임라인) 서비스 — S1-10a, FR-2196.

트랙에 놓인 클립의 목록·만들기·수정·삭제를 다룬다. MIDI 클립은 패턴을 가리키고,
AUDIO 클립은 샘플을 가리킨다 (DB CHECK 와 같은 규칙 — 요청 스키마가 먼저 막는다).

패턴은 같은 프로젝트의 것이어야 하고, 샘플은 있어야 한다. 권한은 다른 트랙 API 와 같다.
조회는 멤버면 누구나(없으면 404), 쓰기는 OWNER·EDITOR 만 (403).
"""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.clip import Clip, ClipType
from app.models.pattern import Pattern
from app.models.project import MemberRole
from app.models.sample import Sample
from app.models.track import Track
from app.models.user import User
from app.schemas.clip import ClipCreateRequest, ClipUpdateRequest
from app.services import project_service, track_service


def _require_editor_track(db: Session, user: User, track_id: int) -> Track:
    """쓰기용 트랙 확인 — 남의 트랙은 404, 권한이 없으면 403."""
    track = track_service.require_track(db, user, track_id)
    _project, member = project_service.get_membership(db, track.project_id, user)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)
    return track


def _require_clip(db: Session, user: User, clip_id: int) -> Clip:
    """클립 한 건. 없거나 남의 것이면 404 (권한은 트랙 쪽에서 다시 본다)."""
    clip = db.get(Clip, clip_id)
    if clip is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Clip not found.")
    track = track_service.require_track(db, user, clip.track_id)
    if track.track_id != clip.track_id:  # 방어: require_track 이 다른 트랙을 돌려줄 일은 없음
        raise AppError(ErrorCode.NOT_FOUND, 404, "Clip not found.")
    return clip


def list_clips(db: Session, user: User, track_id: int) -> Sequence[Clip]:
    """트랙에 놓인 클립 목록 (start_tick 순). 멤버면 누구나 (FR-2196)."""
    track = track_service.require_track(db, user, track_id)
    stmt = (
        select(Clip)
        .where(Clip.track_id == track.track_id)
        .order_by(Clip.start_tick, Clip.clip_id)
    )
    return db.execute(stmt).scalars().all()


def create_clip(
    db: Session, user: User, track_id: int, data: ClipCreateRequest
) -> Clip:
    """트랙에 클립을 놓는다 (FR-2196). OWNER·EDITOR 만.

    MIDI 클립의 패턴은 같은 프로젝트의 것이어야 하고(404), AUDIO 클립의 샘플은
    있어야 한다(404). 종류와 가리키는 칸이 어긋나는 것은 요청 스키마가 422 로 막는다.
    """
    track = _require_editor_track(db, user, track_id)

    if data.clip_type == ClipType.MIDI:
        pattern = db.get(Pattern, data.pattern_id)
        if pattern is None or pattern.project_id != track.project_id:
            raise AppError(ErrorCode.NOT_FOUND, 404, "Pattern not found.")
    else:
        sample = db.get(Sample, data.sample_id)
        if sample is None:
            raise AppError(ErrorCode.NOT_FOUND, 404, "Sample not found.")

    clip = Clip(
        track_id=track.track_id,
        clip_type=data.clip_type,
        sample_id=data.sample_id,
        pattern_id=data.pattern_id,
        name=data.name,
        start_tick=data.start_tick,
        length_tick=data.length_tick,
        offset_tick=data.offset_tick,
        gain_db=data.gain_db,
        is_looped=data.is_looped,
        fade_in_tick=data.fade_in_tick,
        fade_out_tick=data.fade_out_tick,
        fade_in_curve=data.fade_in_curve,
        fade_out_curve=data.fade_out_curve,
        warp_mode=data.warp_mode,
        warp_markers=data.warp_markers,
        pitch_semitones=data.pitch_semitones,
        is_reversed=data.is_reversed,
    )
    db.add(clip)
    db.commit()
    db.refresh(clip)
    return clip


def update_clip(db: Session, user: User, clip_id: int, data: ClipUpdateRequest) -> Clip:
    """클립의 위치·길이·페이드·워프 등 (FR-2196). OWNER·EDITOR 만. 보낸 칸만 바꾼다."""
    clip = _require_clip(db, user, clip_id)
    _require_editor_track(db, user, clip.track_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(clip, field, value)
    db.commit()
    db.refresh(clip)
    return clip


def delete_clip(db: Session, user: User, clip_id: int) -> None:
    """클립 삭제 (FR-2196). OWNER·EDITOR 만. 클립이 가리키던 패턴은 그대로 남는다."""
    clip = _require_clip(db, user, clip_id)
    _require_editor_track(db, user, clip.track_id)
    db.delete(clip)
    db.commit()


def pattern_is_used(db: Session, pattern_id: int) -> bool:
    """이 패턴을 가리키는 클립이 있는지 — 패턴 삭제 전에 본다 (FR-2196)."""
    return (
        db.scalar(select(Clip.clip_id).where(Clip.pattern_id == pattern_id).limit(1))
        is not None
    )
