"""/api/v1/projects/{id}/tempo-changes 라우터 (S1-13 FR-202a) — 연결 확인 + 실제 앱 · MySQL 요청.

템포 변경점 조회(멤버면 누구나), 통째 교체(OWNER·EDITOR 만), 입력값 검증(422), 그리고
GET /full 이 변경점을 함께 담는지 확인한다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Project, ProjectMember, TempoChange, User
from app.models.project import MemberRole

ITEM_KEYS = {"tempo_change_id", "tick", "bpm", "ramp"}


def url(project_id):
    return f"/api/v1/projects/{project_id}/tempo-changes"


def test_tempo_routes_registered():
    paths = app.openapi()["paths"]
    assert set(paths["/api/v1/projects/{project_id}/tempo-changes"]) == {"get", "put"}


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_tp",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-21",
    )
    db.add(user)
    db.flush()
    return user


def add_project(db, owner, role=MemberRole.OWNER, member=None):
    project = Project(owner_id=owner.user_id, title="Tempo Song")
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(project_id=project.project_id, user_id=owner.user_id, role=MemberRole.OWNER)
    )
    if member is not None:
        db.add(ProjectMember(project_id=project.project_id, user_id=member.user_id, role=role))
    db.flush()
    return project


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def put(client, project, user, changes):
    return client.put(url(project.project_id), json={"changes": changes}, headers=auth(user))


def test_get_empty(client, db):
    user = add_user(db, "tp_empty")
    project = add_project(db, user)

    res = client.get(url(project.project_id), headers=auth(user))

    assert res.status_code == 200
    assert res.json() == {"items": [], "total": 0}


def test_put_then_get_sorted_by_tick(client, db):
    user = add_user(db, "tp_put")
    project = add_project(db, user)

    res = put(client, project, user, [
        {"tick": 7680, "bpm": 160, "ramp": "LINEAR"},
        {"tick": 3840, "bpm": 140.5},
    ])

    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert set(data["items"][0]) == ITEM_KEYS
    # tick 오름차순, ramp 를 안 보내면 STEP, bpm 은 숫자(문자열이 아님)
    assert [(i["tick"], i["bpm"], i["ramp"]) for i in data["items"]] == [
        (3840, 140.5, "STEP"),
        (7680, 160.0, "LINEAR"),
    ]
    assert all(isinstance(i["bpm"], float) for i in data["items"])
    again = client.get(url(project.project_id), headers=auth(user)).json()
    assert again["items"] == data["items"]


def test_put_replaces_all(client, db):
    user = add_user(db, "tp_replace")
    project = add_project(db, user)
    db.add(TempoChange(project_id=project.project_id, tick=960, bpm=90))
    db.add(TempoChange(project_id=project.project_id, tick=1920, bpm=100))
    db.flush()

    res = put(client, project, user, [{"tick": 1920, "bpm": 150}])

    assert res.status_code == 200
    assert [(i["tick"], i["bpm"]) for i in res.json()["items"]] == [(1920, 150.0)]  # 960 은 사라짐


def test_put_empty_clears(client, db):
    user = add_user(db, "tp_clear")
    project = add_project(db, user)
    db.add(TempoChange(project_id=project.project_id, tick=960, bpm=90))
    db.flush()

    res = put(client, project, user, [])

    assert res.status_code == 200
    assert res.json() == {"items": [], "total": 0}


def test_bpm_rounded_to_two_decimals(client, db):
    user = add_user(db, "tp_round")
    project = add_project(db, user)

    res = put(client, project, user, [{"tick": 960, "bpm": 120.456}])

    assert res.status_code == 200
    assert res.json()["items"][0]["bpm"] == 120.46


def test_full_project_includes_tempo_changes(client, db):
    user = add_user(db, "tp_full")
    project = add_project(db, user)
    put(client, project, user, [{"tick": 3840, "bpm": 140}, {"tick": 960, "bpm": 100}])

    res = client.get(f"/api/v1/projects/{project.project_id}/full", headers=auth(user))

    assert res.status_code == 200
    changes = res.json()["tempo_changes"]
    assert [(c["tick"], c["bpm"], c["ramp"]) for c in changes] == [
        (960, 100.0, "STEP"),
        (3840, 140.0, "STEP"),
    ]
    assert set(changes[0]) == ITEM_KEYS


def test_viewer_can_read_but_not_save(client, db):
    owner = add_user(db, "tp_own")
    viewer = add_user(db, "tp_view")
    project = add_project(db, owner, role=MemberRole.VIEWER, member=viewer)
    db.add(TempoChange(project_id=project.project_id, tick=960, bpm=90))
    db.flush()

    assert client.get(url(project.project_id), headers=auth(viewer)).json()["total"] == 1
    res = put(client, project, viewer, [{"tick": 1920, "bpm": 100}])
    assert res.status_code == 403
    assert client.get(url(project.project_id), headers=auth(owner)).json()["total"] == 1  # 안 바뀜


def test_editor_can_save(client, db):
    owner = add_user(db, "tp_own2")
    editor = add_user(db, "tp_edit")
    project = add_project(db, owner, role=MemberRole.EDITOR, member=editor)

    res = put(client, project, editor, [{"tick": 960, "bpm": 100}])

    assert res.status_code == 200
    assert res.json()["total"] == 1


def test_non_member_gets_404(client, db):
    owner = add_user(db, "tp_own3")
    stranger = add_user(db, "tp_str")
    project = add_project(db, owner)

    assert client.get(url(project.project_id), headers=auth(stranger)).status_code == 404
    assert put(client, project, stranger, [{"tick": 960, "bpm": 100}]).status_code == 404
    assert client.get(url(99999999), headers=auth(owner)).status_code == 404


def test_requires_login(client, db):
    owner = add_user(db, "tp_own4")
    project = add_project(db, owner)

    assert client.get(url(project.project_id)).status_code == 401
    assert client.put(url(project.project_id), json={"changes": []}).status_code == 401


@pytest.mark.parametrize(
    "change",
    [
        {"tick": 0, "bpm": 120},          # 0 은 시작 템포(projects.bpm)의 자리
        {"tick": -5, "bpm": 120},
        {"tick": 960, "bpm": 19.99},      # 20 미만
        {"tick": 960, "bpm": 300.01},     # 300 초과
        {"tick": 960, "bpm": 120, "ramp": "SMOOTH"},
        {"tick": 960},                    # bpm 없음
        {"bpm": 120},                     # tick 없음
        {"tick": "abc", "bpm": 120},
    ],
)
def test_invalid_change_is_422(client, db, change):
    user = add_user(db, "tp_bad")
    project = add_project(db, user)

    assert put(client, project, user, [change]).status_code == 422


def test_duplicate_ticks_is_422(client, db):
    user = add_user(db, "tp_dup")
    project = add_project(db, user)

    res = put(client, project, user, [{"tick": 960, "bpm": 100}, {"tick": 960, "bpm": 110}])

    assert res.status_code == 422


def test_too_many_changes_is_422(client, db):
    user = add_user(db, "tp_many")
    project = add_project(db, user)

    res = put(client, project, user, [{"tick": i + 1, "bpm": 100} for i in range(501)])

    assert res.status_code == 422


def test_boundaries_accepted(client, db):
    user = add_user(db, "tp_edge")
    project = add_project(db, user)

    res = put(client, project, user, [{"tick": 1, "bpm": 20}, {"tick": 2, "bpm": 300}])

    assert res.status_code == 200
    assert [i["bpm"] for i in res.json()["items"]] == [20.0, 300.0]
