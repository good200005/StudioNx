"""P1-13 프로젝트 라우터 — 연결 확인(DB 없이) + 실제 앱 · MySQL 로 요청 (62)."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Project, ProjectMember, User


def test_project_routes_registered():
    paths = app.openapi()["paths"]

    assert {"get", "post"} <= paths["/api/v1/projects"].keys()
    assert {"get", "patch", "delete"} <= paths["/api/v1/projects/{project_id}"].keys()


# ── 62 실제 앱 + 실제 MySQL (시험 뒤 rollback) ─────────────────────

URL = "/api/v1/projects"
ITEM_KEYS = {
    "project_id", "title", "description", "bpm", "time_sig_num", "time_sig_den", "music_key",
    "created_at", "updated_at", "my_role", "member_count", "opened",
}


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db  # 앱이 시험용 세션을 쓰게 함
    yield TestClient(app)
    app.dependency_overrides.clear()


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_pr",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-08",
    )
    db.add(user)
    db.flush()
    return user


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


def make(client, user, **body):
    body.setdefault("title", "Song")
    res = client.post(URL, json=body, headers=auth(user))
    assert res.status_code == 201
    return res.json()


def join(db, project_id, user, role):
    db.add(ProjectMember(project_id=project_id, user_id=user.user_id, role=role))
    db.flush()


def test_create_returns_201_item(client, db):
    user = add_user(db, "pr_create")
    data = make(client, user, title="  My Song ", bpm=128.5, time_sig_num=7, time_sig_den=8)
    assert set(data) == ITEM_KEYS
    assert (data["title"], data["description"], data["bpm"]) == ("My Song", None, "128.50")
    assert (data["time_sig_num"], data["time_sig_den"]) == (7, 8)
    assert (data["my_role"], data["member_count"], data["opened"]) == ("OWNER", 1, False)
    assert db.get(Project, data["project_id"]).owner_id == user.user_id


def test_create_invalid_422(client, db):
    res = client.post(URL, json={"title": "   "}, headers=auth(add_user(db, "pr_bad")))
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_requires_login_401(client):
    assert client.get(URL).status_code == 401
    assert client.post(URL, json={"title": "A"}).status_code == 401
    assert client.get(f"{URL}/1").status_code == 401


def test_list_search_sort_page(client, db):
    user = add_user(db, "pr_list")
    for title in ["Beta", "alpha", "Gamma"]:
        make(client, user, title=title)
    res = client.get(URL, params={"sort": "title", "size": 2}, headers=auth(user))
    assert res.status_code == 200
    data = res.json()
    assert [i["title"] for i in data["items"]] == ["alpha", "Beta"]
    assert (data["total"], data["page"], data["size"]) == (3, 1, 2)

    res = client.get(URL, params={"query": "  gam  "}, headers=auth(user))
    assert [i["title"] for i in res.json()["items"]] == ["Gamma"]


@pytest.mark.parametrize(
    "params", [{"page": 0}, {"size": 0}, {"size": 51}, {"sort": "random"}, {"query": "x" * 101}]
)
def test_list_bad_params_422(client, db, params):
    res = client.get(URL, params=params, headers=auth(add_user(db, "pr_params")))
    assert res.status_code == 422


def test_read_mine_and_others_404(client, db):
    owner = add_user(db, "pr_read")
    stranger = add_user(db, "pr_stranger")
    created = make(client, owner, title="Read Me")
    url = f"{URL}/{created['project_id']}"

    res = client.get(url, headers=auth(owner))
    assert res.status_code == 200 and res.json() == created

    for res in (client.get(url, headers=auth(stranger)),
                client.get(f"{URL}/999999999", headers=auth(owner))):
        assert res.status_code == 404
        error = res.json()["error"]
        assert (error["code"], error["message"]) == ("NOT_FOUND", "Project not found.")


def test_update_by_owner_editor_viewer(client, db):
    owner = add_user(db, "pr_up_owner")
    editor = add_user(db, "pr_up_editor")
    viewer = add_user(db, "pr_up_viewer")
    created = make(client, owner, title="Old", description="desc")
    url = f"{URL}/{created['project_id']}"
    join(db, created["project_id"], editor, "EDITOR")
    join(db, created["project_id"], viewer, "VIEWER")

    res = client.patch(url, json={"title": "By Owner"}, headers=auth(owner))
    assert res.status_code == 200
    assert (res.json()["title"], res.json()["description"]) == ("By Owner", "desc")
    assert res.json()["member_count"] == 3

    res = client.patch(url, json={"description": None}, headers=auth(editor))
    assert res.status_code == 200
    assert (res.json()["description"], res.json()["my_role"]) == (None, "EDITOR")

    res = client.patch(url, json={"title": "Nope"}, headers=auth(viewer))
    assert res.status_code == 403 and res.json()["error"]["code"] == "FORBIDDEN"
    assert client.patch(url, json={"title": None}, headers=auth(owner)).status_code == 422
    assert client.get(url, headers=auth(owner)).json()["title"] == "By Owner"


def test_delete_owner_only_then_404(client, db):
    owner = add_user(db, "pr_del_owner")
    editor = add_user(db, "pr_del_editor")
    created = make(client, owner, title="Delete Me")
    url = f"{URL}/{created['project_id']}"
    join(db, created["project_id"], editor, "EDITOR")

    assert client.delete(url, headers=auth(editor)).status_code == 403
    res = client.delete(url, headers=auth(owner))
    assert res.status_code == 204 and res.content == b""

    assert client.get(url, headers=auth(owner)).status_code == 404
    assert client.delete(url, headers=auth(owner)).status_code == 404
    assert client.get(URL, headers=auth(owner)).json()["total"] == 0
