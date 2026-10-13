"""관리자 화면의 공지 설정 (app/admin.py DevNoteAdmin, P1-21).

설정 값과 저장 규칙은 SQLAdmin 을 띄우지 않고 확인한다. 실제 화면 흐름은 setup_admin 까지
구현한 뒤 서버를 띄워 확인한다 (사이트 시험).
"""

import asyncio
import contextlib
from datetime import UTC, datetime

import pytest

from app.admin import DevNoteAdmin
from app.models import DevNote


class FakeRequest:
    def __init__(self, session=None, pk="1"):
        self.session = session or {}
        self.path_params = {"pk": pk}


@pytest.fixture
def view():
    return DevNoteAdmin()


def sql(stmt) -> str:
    return str(stmt.compile(compile_kwargs={"literal_binds": True}))


# ── 화면 설정 ──
def test_form_has_only_five_writable_fields(view):
    names = [c.key for c in view.form_columns]
    assert names == ["title", "summary", "content", "is_published", "published_at"]
    for hidden in ("author_id", "created_at", "updated_at", "deleted_at", "note_id"):
        assert hidden not in names


def test_content_is_a_multiline_textarea(view):
    from wtforms import TextAreaField

    assert view.form_overrides == {"content": TextAreaField}


def test_list_columns_sort_and_search(view):
    assert [c.key for c in view.column_list] == [
        "note_id",
        "title",
        "is_published",
        "published_at",
        "created_at",
    ]
    assert view.column_default_sort == [("note_id", True)]  # 최근 것이 위
    assert [c.key for c in view.column_searchable_list] == ["title"]


def test_deleted_notes_are_hidden_everywhere(view):
    request = FakeRequest(pk="7")
    for stmt in (
        view.list_query(request),
        view.count_query(request),
        view.form_details_query(request),
        view.form_edit_query(request),
    ):
        assert "deleted_at IS NULL" in sql(stmt)


# ── on_model_change ──
def change(view, data, is_created, session=None):
    data = dict(data)
    asyncio.run(view.on_model_change(data, DevNote(), is_created, FakeRequest(session)))
    return data


def test_new_note_gets_logged_in_admin_as_author(view):
    data = change(view, {"title": "T", "is_published": False}, True, {"admin_user_id": 42})
    assert data["author_id"] == 42


def test_edit_does_not_change_author(view):
    data = change(view, {"title": "T"}, False, {"admin_user_id": 42})
    assert "author_id" not in data


def test_publishing_without_time_fills_now_utc(view):
    before = datetime.now(UTC).replace(tzinfo=None)
    data = change(view, {"is_published": True, "published_at": None}, True, {"admin_user_id": 1})
    assert isinstance(data["published_at"], datetime) and data["published_at"].tzinfo is None
    assert (data["published_at"] - before).total_seconds() < 5


def test_publishing_keeps_given_time_including_future(view):
    when = datetime(2030, 1, 2, 3, 4, 5)
    data = change(view, {"is_published": True, "published_at": when}, False)
    assert data["published_at"] == when


def test_draft_does_not_get_a_time(view):
    data = change(view, {"is_published": False, "published_at": None}, False)
    assert data["published_at"] is None


# ── delete_model (소프트 삭제) — 실제 MySQL, 시험마다 되돌림 ──
@pytest.fixture
def admin_user(db):
    from app.models import User

    user = User(
        email="adn_admin@example.com",
        password_hash="x",
        nickname="adn_admin_test",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-08",
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def soft_view(db):
    view = DevNoteAdmin()
    view.session_maker = lambda: contextlib.nullcontext(db)  # 시험용 세션을 그대로 씀
    return view


def add_note(db, admin_user, **kw):
    note = DevNote(author_id=admin_user.user_id, title="t", summary="s", content="c", **kw)
    db.add(note)
    db.flush()
    return note


def test_delete_sets_deleted_at_and_keeps_the_row(soft_view, db, admin_user):
    note = add_note(db, admin_user, is_published=True, published_at=datetime(2026, 1, 1))
    asyncio.run(soft_view.delete_model(FakeRequest(), str(note.note_id)))
    db.refresh(note)
    assert note.deleted_at is not None and note.deleted_at.tzinfo is None
    assert db.get(DevNote, note.note_id) is not None  # 행은 그대로 있음


def test_deleted_note_disappears_from_public_api_service(soft_view, db, admin_user):
    from app.core.errors import AppError
    from app.services import dev_note_service

    note = add_note(db, admin_user, is_published=True, published_at=datetime(2026, 1, 1))
    assert note.note_id in [n.note_id for n in dev_note_service.list_published(db, 100)]
    asyncio.run(soft_view.delete_model(FakeRequest(), str(note.note_id)))
    assert note.note_id not in [n.note_id for n in dev_note_service.list_published(db, 100)]
    with pytest.raises(AppError):
        dev_note_service.get_published(db, note.note_id)


def test_deleting_twice_keeps_first_deleted_time(soft_view, db, admin_user):
    note = add_note(db, admin_user)
    asyncio.run(soft_view.delete_model(FakeRequest(), str(note.note_id)))
    db.refresh(note)
    first = note.deleted_at
    asyncio.run(soft_view.delete_model(FakeRequest(), str(note.note_id)))
    db.refresh(note)
    assert note.deleted_at == first


def test_deleting_missing_note_does_nothing(soft_view):
    asyncio.run(soft_view.delete_model(FakeRequest(), "999999999"))  # 오류 없이 끝남


def test_restoring_by_clearing_deleted_at_brings_it_back(soft_view, db, admin_user):
    note = add_note(db, admin_user, is_published=True, published_at=datetime(2026, 1, 1))
    asyncio.run(soft_view.delete_model(FakeRequest(), str(note.note_id)))
    note.deleted_at = None
    db.flush()
    from app.services import dev_note_service

    assert note.note_id in [n.note_id for n in dev_note_service.list_published(db, 100)]
