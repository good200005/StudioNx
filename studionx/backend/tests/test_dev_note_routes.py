"""P1-21 공지 라우터 — 연결 확인(DB 없이) + 실제 앱 · MySQL 로 요청 (로그인 없이 읽기)."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app
from app.models import DevNote, User


def test_dev_note_routes_registered():
    paths = app.openapi()["paths"]
    assert "get" in paths["/api/v1/dev-notes"]
    assert "get" in paths["/api/v1/dev-notes/{note_id}"]


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


@pytest.fixture
def admin(db):
    user = User(
        email="dnr_admin@example.com",
        password_hash="x",
        nickname="dnr_admin_test",
        privacy_agreed_at=utc_now(),
        privacy_version="2026-10-08",
    )
    db.add(user)
    db.flush()
    return user


def add_note(db, admin, title, **kw):
    note = DevNote(
        author_id=admin.user_id, title=title, summary=f"{title} summary", content="# Body", **kw
    )
    db.add(note)
    db.flush()
    return note


def test_list_without_login_returns_items_without_content(client, db, admin):
    ago = utc_now() - timedelta(hours=1)
    note = add_note(db, admin, "Hello", is_published=True, published_at=ago)
    res = client.get("/api/v1/dev-notes?limit=50")  # 토큰 없이
    assert res.status_code == 200
    item = next(i for i in res.json()["items"] if i["note_id"] == note.note_id)
    assert set(item) == {"note_id", "title", "summary", "published_at"}  # content 없음
    assert item["title"] == "Hello" and item["summary"] == "Hello summary"


def test_list_hides_draft_and_default_limit_is_4(client, db, admin):
    base = utc_now() - timedelta(days=5)
    draft = add_note(db, admin, "Draft", is_published=False, published_at=base)
    for i in range(6):
        add_note(db, admin, f"n{i}", is_published=True, published_at=base + timedelta(minutes=i))
    res = client.get("/api/v1/dev-notes")
    assert res.status_code == 200
    assert len(res.json()["items"]) <= 4
    all_ids = [i["note_id"] for i in client.get("/api/v1/dev-notes?limit=50").json()["items"]]
    assert draft.note_id not in all_ids


@pytest.mark.parametrize("limit", [0, 51, -1, "abc"])
def test_list_limit_out_of_range_is_422(client, limit):
    res = client.get(f"/api/v1/dev-notes?limit={limit}")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_detail_returns_content_without_login(client, db, admin):
    note = add_note(
        db, admin, "Detail", is_published=True, published_at=utc_now() - timedelta(minutes=1)
    )
    res = client.get(f"/api/v1/dev-notes/{note.note_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["content"] == "# Body" and body["title"] == "Detail"
    assert set(body) == {"note_id", "title", "summary", "published_at", "content"}


@pytest.mark.parametrize("kind", ["draft", "deleted", "future", "missing"])
def test_detail_hidden_or_missing_is_json_404(client, db, admin, kind):
    ago = utc_now() - timedelta(hours=1)
    cases = {
        "draft": dict(is_published=False, published_at=ago),
        "deleted": dict(is_published=True, published_at=ago, deleted_at=ago),
        "future": dict(is_published=True, published_at=utc_now() + timedelta(days=1)),
    }
    note_id = 999999999 if kind == "missing" else add_note(db, admin, kind, **cases[kind]).note_id
    res = client.get(f"/api/v1/dev-notes/{note_id}")
    assert res.status_code == 404
    assert res.headers["content-type"].startswith("application/json")
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_detail_non_numeric_id_is_422(client):
    assert client.get("/api/v1/dev-notes/abc").status_code == 422
