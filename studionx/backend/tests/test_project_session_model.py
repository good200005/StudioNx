"""project_sessions 모델 컬럼 (models/project_session.py, P1-16) — 실제 MySQL 과 비교.

DB 세션(db)과 비교 도구(assert_matches_db)는 conftest.py 에 있다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import DBAPIError

from app.models import Project, ProjectSession, User


@pytest.fixture
def project(db):
    owner = User(
        email="ps_owner@example.com",
        password_hash="x",
        nickname="ps_owner_test",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-08",
    )
    db.add(owner)
    db.flush()
    project = Project(owner_id=owner.user_id, title="Session Song")
    db.add(project)
    db.flush()
    return project


def test_columns_match_db(assert_matches_db):
    # 6칸 전부 (이름 · 순서 · NULL 허용 · FK 2개, project_id 는 ON DELETE CASCADE)
    assert_matches_db(ProjectSession)


def test_defaults_from_db(db, project):
    row = ProjectSession(project_id=project.project_id, user_id=project.owner_id)
    db.add(row)
    db.flush()
    db.refresh(row)
    assert row.session_id is not None
    assert isinstance(row.started_at, datetime) and isinstance(row.last_seen_at, datetime)
    assert row.started_at.tzinfo is None  # 시간대 없이 (UTC 값)
    assert row.active_seconds == 0


def test_values_kept_with_milliseconds(db, project):
    started = datetime(2026, 10, 10, 3, 0, 0, 123000)
    row = ProjectSession(
        project_id=project.project_id,
        user_id=project.owner_id,
        started_at=started,
        last_seen_at=datetime(2026, 10, 10, 3, 45, 0),
        active_seconds=2400,
    )
    db.add(row)
    db.flush()
    db.refresh(row)
    assert (row.started_at, row.active_seconds) == (started, 2400)


def test_active_seconds_not_negative(db, project):
    row = ProjectSession(project_id=project.project_id, user_id=project.owner_id, active_seconds=-1)
    db.add(row)
    with pytest.raises(DBAPIError):  # INT UNSIGNED
        db.flush()
