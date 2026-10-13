"""Development 공지 서비스 (services/dev_note_service.py, P1-21) — 실제 MySQL, 시험마다 되돌림.

DB 세션(db)은 conftest.py 에 있다. 함수를 하나 구현할 때마다 시험을 더한다.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.errors import AppError, ErrorCode
from app.models import DevNote, User
from app.services import dev_note_service


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


@pytest.fixture
def admin(db):
    user = User(
        email="dns_admin@example.com",
        password_hash="x",
        nickname="dns_admin_test",
        privacy_agreed_at=utc_now(),
        privacy_version="2026-10-08",
    )
    db.add(user)
    db.flush()
    return user


def add_note(db, admin, title, **kw):
    note = DevNote(author_id=admin.user_id, title=title, summary="s", content="c", **kw)
    db.add(note)
    db.flush()
    return note


# ── 83 list_published ──
def test_list_only_published_visible_notes(db, admin):
    ago = utc_now() - timedelta(hours=1)
    add_note(db, admin, "draft", is_published=False, published_at=ago)
    add_note(db, admin, "deleted", is_published=True, published_at=ago, deleted_at=ago)
    add_note(db, admin, "future", is_published=True, published_at=utc_now() + timedelta(days=1))
    add_note(db, admin, "no-date", is_published=True)
    add_note(db, admin, "ok", is_published=True, published_at=ago)
    titles = [n.title for n in dev_note_service.list_published(db, 10)]
    assert "ok" in titles
    assert not {"draft", "deleted", "future", "no-date"} & set(titles)


def test_list_newest_first_and_same_time_by_id(db, admin):
    base = utc_now() - timedelta(days=2)
    older = add_note(db, admin, "older", is_published=True, published_at=base)
    newer = add_note(db, admin, "newer", is_published=True, published_at=base + timedelta(hours=5))
    tie_a = add_note(db, admin, "tie_a", is_published=True, published_at=base + timedelta(hours=9))
    tie_b = add_note(db, admin, "tie_b", is_published=True, published_at=base + timedelta(hours=9))
    mine = {older.note_id, newer.note_id, tie_a.note_id, tie_b.note_id}
    ids = [n.note_id for n in dev_note_service.list_published(db, 100) if n.note_id in mine]
    assert ids == [tie_b.note_id, tie_a.note_id, newer.note_id, older.note_id]


def test_list_respects_limit(db, admin):
    base = utc_now() - timedelta(days=3)
    for i in range(6):
        add_note(db, admin, f"n{i}", is_published=True, published_at=base + timedelta(minutes=i))
    assert len(dev_note_service.list_published(db, 4)) == 4
    assert len(dev_note_service.list_published(db, 1)) == 1


def test_scheduled_note_appears_once_time_passes(db, admin):
    soon = add_note(
        db, admin, "soon", is_published=True, published_at=utc_now() + timedelta(seconds=30)
    )
    assert soon.note_id not in [n.note_id for n in dev_note_service.list_published(db, 100)]
    soon.published_at = utc_now() - timedelta(seconds=1)  # 시각이 지난 것처럼
    db.flush()
    assert soon.note_id in [n.note_id for n in dev_note_service.list_published(db, 100)]


# ── 84 get_published ──
def test_get_returns_visible_note(db, admin):
    note = add_note(
        db, admin, "ok", is_published=True, published_at=utc_now() - timedelta(minutes=1)
    )
    got = dev_note_service.get_published(db, note.note_id)
    assert got.note_id == note.note_id and got.title == "ok" and got.content == "c"


@pytest.mark.parametrize("kind", ["draft", "deleted", "future", "no_date", "missing"])
def test_get_hidden_or_missing_is_404(db, admin, kind):
    ago = utc_now() - timedelta(hours=1)
    cases = {
        "draft": dict(is_published=False, published_at=ago),
        "deleted": dict(is_published=True, published_at=ago, deleted_at=ago),
        "future": dict(is_published=True, published_at=utc_now() + timedelta(days=1)),
        "no_date": dict(is_published=True),
    }
    note_id = 999999999 if kind == "missing" else add_note(db, admin, kind, **cases[kind]).note_id
    with pytest.raises(AppError) as err:
        dev_note_service.get_published(db, note_id)
    assert (err.value.status_code, err.value.code) == (404, ErrorCode.NOT_FOUND)
    assert err.value.message == "Note not found."


def test_get_and_list_use_same_rule(db, admin):
    ago = utc_now() - timedelta(hours=1)
    add_note(db, admin, "a", is_published=True, published_at=ago)
    add_note(db, admin, "b", is_published=False, published_at=ago)
    add_note(db, admin, "c", is_published=True, published_at=utc_now() + timedelta(days=1))
    listed = {n.note_id for n in dev_note_service.list_published(db, 100)}
    for n in db.query(DevNote).all():
        try:
            dev_note_service.get_published(db, n.note_id)
            visible = True
        except AppError:
            visible = False
        assert visible == (n.note_id in listed)
