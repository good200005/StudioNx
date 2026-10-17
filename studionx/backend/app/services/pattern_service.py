"""패턴 서비스 — S1-08 아코디언·피아노롤 (FR-231~233).

- `list_patterns`: 프로젝트의 패턴 목록 (노트는 빼고 가볍게).
- `get_pattern`(응답): 패턴 한 건과 그 노트 전부 — 피아노롤이 열 때 쓴다.
- `replace_notes`: 피아노롤이 바뀔 때마다 노트를 보낸 목록으로 통째 교체.
- `update_pattern`: 이름·색·길이·스윙 수정.

권한 규칙은 project_service 와 같다. 조회는 멤버면 누구나, 저장·수정은 OWNER·EDITOR 만.
남의 프로젝트 패턴은 있는지조차 알려 주지 않고 404 로 막는다 (get_membership).
"""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models import MidiNote, Pattern, Project, ProjectMember, User
from app.models.project import MemberRole
from app.schemas.pattern import (
    NoteItem,
    NotesSaveRequest,
    PatternListResponse,
    PatternResponse,
    PatternUpdateRequest,
)
from app.services import project_service


def _note_item(note: MidiNote) -> NoteItem:
    """MidiNote → NoteItem (응답 한 건). 칸을 하나씩 골라 넣는다."""
    return NoteItem(
        note_id=note.note_id,
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


def _notes(db: Session, pattern_id: int) -> list[MidiNote]:
    """패턴의 노트를 시작 위치, 음높이 순으로 읽는다.

    (구현: AI — 2026-10-17, S1-08) 관계(pattern.notes) 대신 쿼리로 읽는다 —
    통째 교체 직후에는 세션에 남은 옛 목록과 섞이지 않게 DB 에서 새로 읽어야 한다.
    """
    return list(
        db.scalars(
            select(MidiNote)
            .where(MidiNote.pattern_id == pattern_id)
            .order_by(MidiNote.start_tick, MidiNote.pitch)
        ).all()
    )


def to_response(pattern: Pattern, notes: list[MidiNote] | None = None) -> PatternResponse:
    """Pattern → PatternResponse (목록 한 줄 · 상세 · 노트 저장 응답).

    (구현: AI — 2026-10-17, S1-08) notes 를 넘기지 않으면 pattern.notes 를 읽는다.
    목록(135)은 가볍게 하려고 빈 목록을 넘긴다.
    """
    rows = pattern.notes if notes is None else notes
    return PatternResponse(
        pattern_id=pattern.pattern_id,
        project_id=pattern.project_id,
        name=pattern.name,
        color=pattern.color,
        length_tick=pattern.length_tick,
        swing=pattern.swing,
        updated_at=pattern.updated_at,
        notes=[_note_item(note) for note in rows],
    )


def _find(db: Session, user: User, pattern_id: int) -> tuple[Pattern, Project, ProjectMember]:
    """패턴과 그 프로젝트·내 멤버 행을 함께 찾는다. 없거나 남의 것이면 404."""
    pattern = db.get(Pattern, pattern_id)
    if pattern is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Pattern not found.")
    project, member = project_service.get_membership(db, pattern.project_id, user)
    return pattern, project, member


def list_patterns(db: Session, user: User, project_id: int) -> PatternListResponse:
    """프로젝트의 패턴 목록 (FR-233). 멤버면 누구나. 노트는 담지 않는다 (가볍게)."""
    project_service.get_membership(db, project_id, user)
    rows = list(
        db.scalars(
            select(Pattern).where(Pattern.project_id == project_id).order_by(Pattern.pattern_id)
        ).all()
    )
    return PatternListResponse(
        items=[to_response(pattern, notes=[]) for pattern in rows],
        total=len(rows),
    )


def get_pattern(db: Session, user: User, pattern_id: int) -> PatternResponse:
    """패턴 한 건과 노트 전부 (FR-232). 피아노롤이 열 때 쓴다."""
    pattern, _project, _member = _find(db, user, pattern_id)
    return to_response(pattern, _notes(db, pattern.pattern_id))


def replace_notes(
    db: Session, user: User, pattern_id: int, data: NotesSaveRequest
) -> PatternResponse:
    """패턴의 노트를 보낸 목록으로 통째 교체한다 (FR-231). OWNER·EDITOR 만.

    (구현: AI — 2026-10-17, S1-08) 지금 붙은 노트를 모두 지우고 보낸 것을 새로 넣는다.
    한 트랜잭션이라 반쪽 상태가 남지 않는다. 빈 목록이면 노트를 모두 지운다.
    """
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


def update_pattern(
    db: Session, user: User, pattern_id: int, data: PatternUpdateRequest
) -> PatternResponse:
    """패턴 이름·색·길이·스윙 수정 (FR-233). OWNER·EDITOR 만. 보낸 칸만 바꾼다."""
    pattern, _project, member = _find(db, user, pattern_id)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pattern, field, value)
    db.commit()
    db.refresh(pattern)
    return to_response(pattern, _notes(db, pattern.pattern_id))
