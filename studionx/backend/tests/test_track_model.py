"""tracks 모델 컬럼 (models/track.py, P1-03) — Phase 1 칸만. 실제 MySQL 과 비교.

DB 세션(db)과 비교 도구(assert_matches_db)는 conftest.py 에 있다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import Project, Track, User
from app.models.track import TrackType


@pytest.fixture
def project(db):
    owner = User(
        email="track_owner@example.com",
        password_hash="x",
        nickname="track_owner_test",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-05",
    )
    db.add(owner)
    db.flush()
    project = Project(owner_id=owner.user_id, title="Track Song")
    db.add(project)
    db.flush()
    return project


def test_columns_match_db(assert_matches_db):
    # Phase 1 칸 5개만 비교 (이름 · 순서 · NULL 허용 · project_id FK 의 ON DELETE CASCADE)
    assert_matches_db(Track, partial=True)


def test_master_track(db, project):
    master = Track(project_id=project.project_id, name="Master", track_type=TrackType.MASTER)
    db.add(master)
    db.flush()
    db.refresh(master)
    assert master.track_id > 0
    assert master.track_type is TrackType.MASTER
    assert master.order_index == 0  # DB 기본값

    # 모델에 없는 Phase 2 칸도 DB 가 기본값으로 채웠는지
    row = db.execute(
        text("SELECT color, volume_db, is_muted, routing_mode FROM tracks WHERE track_id = :id"),
        {"id": master.track_id},
    ).one()
    assert (row.color, str(row.volume_db), row.is_muted, row.routing_mode) == (
        "#7C5CFF",
        "0.00",
        0,
        "CHAIN",
    )


def test_track_type_is_required(db, project):
    db.add(Track(project_id=project.project_id, name="No type"))
    with pytest.raises(IntegrityError):  # track_type 은 NOT NULL · 기본값 없음
        db.flush()


def test_deleting_project_deletes_tracks(db, project):
    db.add(Track(project_id=project.project_id, name="Master", track_type=TrackType.MASTER))
    db.flush()
    stmt = select(func.count()).select_from(Track).where(Track.project_id == project.project_id)
    assert db.scalar(stmt) == 1
    db.delete(project)
    db.flush()
    assert db.scalar(stmt) == 0
