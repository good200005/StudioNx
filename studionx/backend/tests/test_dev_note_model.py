"""dev_notes 모델 컬럼 (models/dev_note.py, P1-21) — 실제 MySQL 과 비교.

DB 세션(db)과 비교 도구(assert_matches_db)는 conftest.py 에 있다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import DBAPIError

from app.models import DevNote, User


@pytest.fixture
def admin(db):
    user = User(
        email="dn_admin@example.com",
        password_hash="x",
        nickname="dn_admin_test",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-08",
    )
    db.add(user)
    db.flush()
    return user


def test_columns_match_db(assert_matches_db):
    # 10칸 전부 (이름 · 순서 · NULL 허용 · FK 1개)
    assert_matches_db(DevNote)


def test_defaults_from_db(db, admin):
    note = DevNote(author_id=admin.user_id, title="Hello", summary="Short", content="# Body")
    db.add(note)
    db.flush()
    db.refresh(note)
    assert note.note_id is not None
    assert note.is_published is False  # 초안으로 시작
    assert note.published_at is None and note.deleted_at is None
    assert isinstance(note.created_at, datetime) and note.created_at.tzinfo is None


def test_long_content_and_milliseconds_kept(db, admin):
    body = "가나다 ✔ " * 20000  # 수십만 글자 (MEDIUMTEXT, 한글과 기호 포함)
    when = datetime(2026, 10, 10, 3, 0, 0, 123000)
    note = DevNote(
        author_id=admin.user_id,
        title="T" * 150,
        summary="S" * 300,
        content=body,
        is_published=True,
        published_at=when,
    )
    db.add(note)
    db.flush()
    db.refresh(note)
    assert note.content == body and len(note.title) == 150 and len(note.summary) == 300
    assert note.is_published is True and note.published_at == when


def test_author_must_exist(db):
    db.add(DevNote(author_id=999999999, title="x", summary="x", content="x"))
    with pytest.raises(DBAPIError):
        db.flush()
