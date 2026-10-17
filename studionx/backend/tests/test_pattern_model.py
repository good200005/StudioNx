"""patterns · midi_notes 모델 (S1-08 FR-231~233) — 실제 MySQL 과 대조.

칸 이름 · 순서 · NULL 허용 · FK(ON DELETE CASCADE)를 실제 테이블과 맞춰 보고
(assert_matches_db), 기본값과 관계(정렬 · 함께 지우기)를 확인한다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select

from app.models import MidiNote, Pattern, Project, ProjectMember, User
from app.models.project import MemberRole


@pytest.fixture
def project(db):
    user = User(
        email="pattern_model@example.com",
        password_hash="x",
        nickname="pattern_model_owner",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-17",
    )
    db.add(user)
    db.flush()
    project = Project(owner_id=user.user_id, title="Pattern Song")
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(project_id=project.project_id, user_id=user.user_id, role=MemberRole.OWNER)
    )
    db.flush()
    return project


def test_pattern_columns_match_db(assert_matches_db):
    assert_matches_db(Pattern)


def test_midi_note_columns_match_db(assert_matches_db):
    assert_matches_db(MidiNote)


def test_pattern_defaults(db, project):
    pattern = Pattern(project_id=project.project_id, name="Bass")
    db.add(pattern)
    db.flush()
    assert pattern.pattern_id > 0
    assert pattern.color is None
    assert pattern.length_tick == 3840  # DB 기본값
    assert str(pattern.swing) == "0.00"


def test_note_defaults(db, project):
    pattern = Pattern(project_id=project.project_id, name="Pad")
    db.add(pattern)
    db.flush()
    note = MidiNote(pattern_id=pattern.pattern_id, pitch=60, start_tick=0, length_tick=960)
    db.add(note)
    db.flush()
    assert note.note_id > 0
    assert (note.velocity, note.channel, note.release_velocity) == (100, 0, 64)
    assert note.is_muted is False
    assert str(note.probability) == "1.00"
    assert note.velocity_deviation == 0


def test_notes_are_ordered(db, project):
    pattern = Pattern(project_id=project.project_id, name="Lead")
    db.add(pattern)
    db.flush()
    db.add_all(
        [
            MidiNote(pattern_id=pattern.pattern_id, pitch=64, start_tick=960, length_tick=240),
            MidiNote(pattern_id=pattern.pattern_id, pitch=60, start_tick=0, length_tick=480),
        ]
    )
    db.flush()
    db.refresh(pattern)
    assert [(n.start_tick, n.pitch) for n in pattern.notes] == [(0, 60), (960, 64)]


def test_deleting_pattern_deletes_notes(db, project):
    pattern = Pattern(project_id=project.project_id, name="Drums")
    db.add(pattern)
    db.flush()
    db.add(MidiNote(pattern_id=pattern.pattern_id, pitch=36, start_tick=0, length_tick=240))
    db.flush()
    count = (
        select(func.count()).select_from(MidiNote).where(MidiNote.pattern_id == pattern.pattern_id)
    )
    assert db.scalar(count) == 1
    db.delete(pattern)
    db.flush()
    assert db.scalar(count) == 0  # ON DELETE CASCADE
