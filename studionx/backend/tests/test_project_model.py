"""projects 모델 컬럼 (models/project.py Project, P1-03) — 실제 MySQL 의 projects 테이블과 비교.

DB 세션(db)과 비교 도구(assert_matches_db)는 conftest.py 에 있다.
"""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Project, User


@pytest.fixture
def owner(db):
    user = User(
        email="owner@example.com",
        password_hash="x",
        nickname="owner_test",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-05",
    )
    db.add(user)
    db.flush()
    return user


def test_columns_match_db(assert_matches_db):
    assert_matches_db(Project)  # 칸 이름 · 순서 · NULL 허용 · owner_id → users FK


def test_new_project_fills_db_defaults(db, owner):
    project = Project(owner_id=owner.user_id, title="My Song")
    db.add(project)
    db.flush()
    db.refresh(project)
    assert project.project_id > 0
    assert project.bpm == Decimal("120.00")
    assert (project.time_sig_num, project.time_sig_den) == (4, 4)
    assert project.sample_rate == 48000
    assert project.revision == 0
    assert project.master_settings is None
    assert isinstance(project.created_at, datetime) and project.deleted_at is None


def test_values_round_trip(db, owner):
    project = Project(
        owner_id=owner.user_id,
        title="Waltz",
        bpm=Decimal("98.50"),
        time_sig_num=3,
        time_sig_den=4,
        music_key="F#",
        scale_mode="minor",
        master_settings={"gain_db": -1.5, "limiter": {"on": True}},
    )
    db.add(project)
    db.flush()
    db.expire(project)  # 파이썬에 남은 값을 버리고 DB 에서 다시 읽게 함
    assert project.bpm == Decimal("98.50")
    assert project.time_sig_num == 3
    assert project.master_settings == {"gain_db": -1.5, "limiter": {"on": True}}


def test_unknown_owner_is_rejected(db):
    db.add(Project(owner_id=999_999_999, title="Orphan"))
    with pytest.raises(IntegrityError):
        db.flush()
