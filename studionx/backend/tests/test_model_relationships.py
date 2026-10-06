"""모델 관계 (project.members · project.tracks, P1-03) — 실제 MySQL.

DB 세션(db)은 conftest.py 에 있다. 넣은 행은 끝나면 되돌린다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import Project, ProjectMember, Track, User
from app.models.project import MemberRole
from app.models.track import TrackType


@pytest.fixture
def owner(db):
    user = User(
        email="rel_owner@example.com",
        password_hash="x",
        nickname="rel_owner_test",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-05",
    )
    db.add(user)
    db.flush()
    return user


def new_project(owner):
    """P1-13 create_project 와 같은 모양 — 프로젝트 + OWNER 멤버 + MASTER 트랙."""
    project = Project(owner_id=owner.user_id, title="Rel Song")
    project.members.append(ProjectMember(user_id=owner.user_id, role=MemberRole.OWNER))
    project.tracks.append(Track(name="Master", track_type=TrackType.MASTER, order_index=0))
    return project


def count(db, model, project_id):
    return db.scalar(select(func.count()).select_from(model).where(model.project_id == project_id))


def test_children_saved_with_project(db, owner):
    project = new_project(owner)
    db.add(project)  # 프로젝트만 add 해도 members · tracks 가 함께 저장됨
    db.flush()
    assert project.project_id > 0
    assert project.members[0].project_id == project.project_id  # 번호를 직접 넣지 않아도 채워짐
    assert project.tracks[0].project_id == project.project_id
    assert count(db, ProjectMember, project.project_id) == 1
    assert count(db, Track, project.project_id) == 1


def test_back_references(db, owner):
    project = new_project(owner)
    db.add(project)
    db.flush()
    assert project.members[0].project is project
    assert project.tracks[0].project is project


def test_tracks_sorted_by_order_index(db, owner):
    project = new_project(owner)
    project.tracks.append(Track(name="Drums", track_type=TrackType.AUDIO, order_index=2))
    project.tracks.append(Track(name="Bass", track_type=TrackType.MIDI, order_index=1))
    db.add(project)
    db.flush()
    db.expire(project, ["tracks"])  # DB 에서 다시 읽게 함
    assert [t.name for t in project.tracks] == ["Master", "Bass", "Drums"]


def test_removed_member_is_deleted(db, owner):
    project = new_project(owner)
    db.add(project)
    db.flush()
    project.members.remove(project.members[0])  # 목록에서 빼면 행도 지움 (delete-orphan)
    db.flush()
    assert count(db, ProjectMember, project.project_id) == 0


def test_delete_project_with_loaded_children(db, owner):
    project = new_project(owner)
    db.add(project)
    db.flush()
    project_id = project.project_id
    db.delete(project)
    db.flush()
    assert count(db, ProjectMember, project_id) == 0
    assert count(db, Track, project_id) == 0


def test_one_failure_saves_nothing(db, owner):
    project = new_project(owner)
    project.tracks.append(Track(name="Broken"))  # track_type 빠짐 → DB 가 거절
    db.add(project)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()
    title_count = db.scalar(
        select(func.count()).select_from(Project).where(Project.title == "Rel Song")
    )
    assert title_count == 0  # 프로젝트 · 멤버도 저장되지 않음 (FR-122)
