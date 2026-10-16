"""/api/v1/tags 라우터 (S1-07 FR-224) — 실제 앱 · MySQL 요청 (끝나면 rollback)."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Tag, User

URL = "/api/v1/tags"


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_tr",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-15",
        storage_quota_bytes=5 * 1024**3,
        storage_used_bytes=0,
    )
    db.add(user)
    db.flush()
    return user


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


def add_tag(db, name, category="INSTRUMENT"):
    tag = Tag(name=name, category=category)
    db.add(tag)
    db.flush()
    return tag


def test_tags_route_registered():
    assert "get" in app.openapi()["paths"][URL]


def test_list_tags_returns_items_ordered(client, db):
    user = add_user(db, "tr_list")
    add_tag(db, "Zither", "INSTRUMENT")
    add_tag(db, "Ambient", "GENRE")
    add_tag(db, "Calm", "MOOD")

    res = client.get(URL, headers=auth(user))
    assert res.status_code == 200
    items = res.json()["items"]
    for tag in items:
        assert set(tag) == {"tag_id", "name", "category"}

    # 검사에 넣은 태그만 골라 분류 순(ENUM 차례) · 이름 순인지 확인
    mine = [t for t in items if t["name"] in {"Zither", "Ambient", "Calm"}]
    assert [t["name"] for t in mine] == ["Ambient", "Zither", "Calm"]  # GENRE → INSTRUMENT → MOOD


def test_list_tags_empty(client, db):
    user = add_user(db, "tr_empty")
    res = client.get(URL, headers=auth(user))
    assert res.status_code == 200
    assert isinstance(res.json()["items"], list)


def test_list_tags_requires_login_401(client, db):
    assert client.get(URL).status_code == 401
