"""/api/v1/projects/{id}/meter-changes 라우터 (S1-18 FR-202b) — 연결 확인 + 실제 앱 · MySQL 요청.

박자 변경점 조회(멤버면 누구나), 통째 교체(OWNER·EDITOR 만), 입력값 검증(422), 그리고
GET /full 이 변경점을 함께 담는지 확인한다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import MeterChange, Project, ProjectMember, User
from app.models.project import MemberRole

ITEM_KEYS = {"meter_change_id", "tick", "time_sig_num", "time_sig_den"}


def url(project_id):
    return f"/api/v1/projects/{project_id}/meter-changes"


def test_meter_routes_registered():
    paths = app.openapi()["paths"]
    assert set(paths["/api/v1/projects/{project_id}/meter-changes"]) == {"get", "put"}


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_mt",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-21",
    )
    db.add(user)
    db.flush()
    return user


def add_project(db, owner, role=MemberRole.OWNER, member=None):
    project = Project(owner_id=owner.user_id, title="Meter Song")
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


def mc(tick, num=3, den=4):
    return {"tick": tick, "time_sig_num": num, "time_sig_den": den}



def test_get_empty(client, db):
    user = add_user(db, "mt_empty")
    project = add_project(db, user)

    res = client.get(url(project.project_id), headers=auth(user))

    assert res.status_code == 200
    assert res.json() == {"items": [], "total": 0}


def test_put_then_get_sorted_by_tick(client, db):
    user = add_user(db, "mt_put")
    project = add_project(db, user)

    res = put(client, project, user, [mc(7680, 6, 8), mc(3840, 3, 4)])

    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert set(data["items"][0]) == ITEM_KEYS
    assert [(i["tick"], i["time_sig_num"], i["time_sig_den"]) for i in data["items"]] == [
        (3840, 3, 4),
        (7680, 6, 8),
    ]
    again = client.get(url(project.project_id), headers=auth(user)).json()
    assert again["items"] == data["items"]


def test_put_replaces_all(client, db):
    user = add_user(db, "mt_replace")
    project = add_project(db, user)
    db.add(MeterChange(project_id=project.project_id, tick=960, time_sig_num=3, time_sig_den=4))
    db.add(MeterChange(project_id=project.project_id, tick=1920, time_sig_num=5, time_sig_den=4))
    db.flush()

    res = put(client, project, user, [mc(1920, 7, 8)])

    assert res.status_code == 200
    assert [(i["tick"], i["time_sig_num"]) for i in res.json()["items"]] == [(1920, 7)]


def test_put_empty_clears(client, db):
    user = add_user(db, "mt_clear")
    project = add_project(db, user)
    db.add(MeterChange(project_id=project.project_id, tick=960, time_sig_num=3, time_sig_den=4))
    db.flush()

    res = put(client, project, user, [])

    assert res.status_code == 200
    assert res.json() == {"items": [], "total": 0}


def test_full_project_includes_meter_changes(client, db):
    user = add_user(db, "mt_full")
    project = add_project(db, user)
    put(client, project, user, [mc(3840, 6, 8), mc(960, 3, 4)])

    res = client.get(f"/api/v1/projects/{project.project_id}/full", headers=auth(user))

    assert res.status_code == 200
    changes = res.json()["meter_changes"]
    assert [(c["tick"], c["time_sig_num"], c["time_sig_den"]) for c in changes] == [
        (960, 3, 4),
        (3840, 6, 8),
    ]
    assert set(changes[0]) == ITEM_KEYS


def test_viewer_can_read_but_not_save(client, db):
    owner = add_user(db, "mt_own")
    viewer = add_user(db, "mt_view")
    project = add_project(db, owner, role=MemberRole.VIEWER, member=viewer)
    db.add(MeterChange(project_id=project.project_id, tick=960, time_sig_num=3, time_sig_den=4))
    db.flush()

    assert client.get(url(project.project_id), headers=auth(viewer)).json()["total"] == 1
    assert put(client, project, viewer, [mc(1920)]).status_code == 403
    assert client.get(url(project.project_id), headers=auth(owner)).json()["total"] == 1


def test_editor_can_save(client, db):
    owner = add_user(db, "mt_own2")
    editor = add_user(db, "mt_edit")
    project = add_project(db, owner, role=MemberRole.EDITOR, member=editor)

    res = put(client, project, editor, [mc(960)])

    assert res.status_code == 200
    assert res.json()["total"] == 1


def test_non_member_gets_404(client, db):
    owner = add_user(db, "mt_own3")
    stranger = add_user(db, "mt_str")
    project = add_project(db, owner)

    assert client.get(url(project.project_id), headers=auth(stranger)).status_code == 404
    assert put(client, project, stranger, [mc(960)]).status_code == 404
    assert client.get(url(99999999), headers=auth(owner)).status_code == 404


def test_requires_login(client, db):
    owner = add_user(db, "mt_own4")
    project = add_project(db, owner)

    assert client.get(url(project.project_id)).status_code == 401
    assert client.put(url(project.project_id), json={"changes": []}).status_code == 401


@pytest.mark.parametrize(
    "change",
    [
        mc(0),  # 0 은 시작 박자(projects)의 자리
        mc(-5),
        mc(960, 0, 4),  # 분자 1 미만
        mc(960, 33, 4),  # 분자 32 초과
        mc(960, 3, 3),  # 분모는 1,2,4,8,16,32 만
        mc(960, 3, 64),
        {"tick": 960, "time_sig_num": 3},
        {"time_sig_num": 3, "time_sig_den": 4},
        {"tick": "abc", "time_sig_num": 3, "time_sig_den": 4},
    ],
)
def test_invalid_change_is_422(client, db, change):
    user = add_user(db, "mt_bad")
    project = add_project(db, user)

    assert put(client, project, user, [change]).status_code == 422


def test_duplicate_ticks_is_422(client, db):
    user = add_user(db, "mt_dup")
    project = add_project(db, user)

    assert put(client, project, user, [mc(960), mc(960, 5, 4)]).status_code == 422


def test_too_many_changes_is_422(client, db):
    user = add_user(db, "mt_many")
    project = add_project(db, user)

    assert put(client, project, user, [mc(i + 1) for i in range(501)]).status_code == 422


def test_boundaries_accepted(client, db):
    user = add_user(db, "mt_edge")
    project = add_project(db, user)

    res = put(client, project, user, [mc(1, 1, 1), mc(2, 32, 32)])

    assert res.status_code == 200
    assert [(i["time_sig_num"], i["time_sig_den"]) for i in res.json()["items"]] == [
        (1, 1),
        (32, 32),
    ]
