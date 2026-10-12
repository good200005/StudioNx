"""P1-16 대시보드 라우터 — 연결 확인(DB 없이) + 실제 앱 · MySQL 로 요청."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Project, ProjectMember, User
from app.models.user import UserStatus


def test_dashboard_route_registered():
    paths = app.openapi()["paths"]

    assert "get" in paths["/api/v1/me/dashboard"]


# ── 실제 앱 + 실제 MySQL (시험 뒤 rollback) ─────────────────────


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def add_user(db, name, **fields):
    user = User(
        email=f"{name}@example.com",
        password_hash="$2b$12$secret-hash-must-not-leak",
        nickname=f"{name}_me",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-08",
        **fields,
    )
    db.add(user)
    db.flush()
    return user


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


def test_dashboard_requires_login(client):
    res = client.get("/api/v1/me/dashboard")

    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


def test_dashboard_ok_shape_and_no_secrets(client, db):
    user = add_user(db, "dash_shape")
    res = client.get("/api/v1/me/dashboard", headers=auth(user))

    assert res.status_code == 200
    data = res.json()
    assert set(data) == {"user", "storage", "ai", "ready_projects", "recent_projects"}
    assert data["user"]["email"] == "dash_shape@example.com"
    assert data["user"]["profile_image_url"] is None
    assert data["storage"]["quota_bytes"] == 5 * 1024**3
    assert data["ai"]["analyses"] == {"used": 0, "limit": 5}
    assert data["ai"]["questions"] == {"used": 0, "limit": 30}
    assert "password_hash" not in res.text and "secret-hash" not in res.text


def test_dashboard_shows_only_my_projects(client, db):
    me = add_user(db, "dash_mine")
    other = add_user(db, "dash_other")
    for owner, title in ((me, "Mine"), (other, "Theirs")):
        project = Project(owner_id=owner.user_id, title=title)
        db.add(project)
        db.flush()
        db.add(ProjectMember(project_id=project.project_id, user_id=owner.user_id, role="OWNER"))
    db.flush()
    data = client.get("/api/v1/me/dashboard", headers=auth(me)).json()

    assert [p["title"] for p in data["recent_projects"]] == ["Mine"]
    assert [p["title"] for p in data["ready_projects"]] == ["Mine"]


def test_dashboard_blocked_for_withdrawn_user(client, db):
    user = add_user(db, "dash_gone", status=UserStatus.DELETED)
    res = client.get("/api/v1/me/dashboard", headers=auth(user))

    assert res.status_code == 401
