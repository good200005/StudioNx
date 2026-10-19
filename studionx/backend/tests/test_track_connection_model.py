"""track_connections 모델 (S1-10a FR-2197) — 실제 MySQL 과 대조.

칸 이름 · 순서 · NULL 허용 · FK(ON DELETE CASCADE)를 실제 테이블과 맞춰 보고
(assert_matches_db), 기본값과 트랙을 지울 때의 함께 지우기를 확인한다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select

from app.models import Project, ProjectMember, Track, TrackConnection, User
from app.models.project import MemberRole
from app.models.track import TrackType
from app.models.track_connection import ConnectionTarget


@pytest.fixture
def project(db):
    user = User(
        email="conn_model@example.com",
        password_hash="x",
        nickname="conn_model_owner",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-19",
    )
    db.add(user)
    db.flush()
    project = Project(owner_id=user.user_id, title="Conn Song")
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(project_id=project.project_id, user_id=user.user_id, role=MemberRole.OWNER)
    )
    db.flush()
    return project


def add_track(db, project, name):
    track = Track(
        project_id=project.project_id, name=name, track_type=TrackType.MIDI, order_index=0
    )
    db.add(track)
    db.flush()
    return track


def test_connection_columns_match_db(assert_matches_db):
    assert_matches_db(TrackConnection)


def test_connection_defaults(db, project):
    source = add_track(db, project, "Source")
    target = add_track(db, project, "Target")
    connection = TrackConnection(from_track_id=source.track_id, to_track_id=target.track_id)
    db.add(connection)
    db.flush()

    assert connection.connection_id > 0
    assert connection.target == ConnectionTarget.PLUGIN
    assert connection.to_track_plugin_id is None
    assert connection.to_port == 1
    assert connection.also_play is None
    assert str(connection.volume_db) == "0.00"
    assert str(connection.pan) == "0.00"
    assert connection.is_solo is False


def test_deleting_source_track_deletes_connection(db, project):
    source = add_track(db, project, "Source")
    target = add_track(db, project, "Target")
    db.add(TrackConnection(from_track_id=source.track_id, to_track_id=target.track_id))
    db.flush()
    count = (
        select(func.count())
        .select_from(TrackConnection)
        .where(TrackConnection.from_track_id == source.track_id)
    )
    assert db.scalar(count) == 1

    db.delete(source)  # ON DELETE CASCADE (from 쪽)
    db.flush()
    assert db.scalar(count) == 0


def test_deleting_target_track_deletes_connection(db, project):
    source = add_track(db, project, "Source")
    target = add_track(db, project, "Target")
    db.add(TrackConnection(from_track_id=source.track_id, to_track_id=target.track_id))
    db.flush()
    count = (
        select(func.count())
        .select_from(TrackConnection)
        .where(TrackConnection.to_track_id == target.track_id)
    )
    assert db.scalar(count) == 1

    db.delete(target)  # ON DELETE CASCADE (to 쪽) → 받는 트랙이 사라지면 연결도 사라진다
    db.flush()
    assert db.scalar(count) == 0
