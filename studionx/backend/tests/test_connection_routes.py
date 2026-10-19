"""/api/v1/tracks/{id}/connection 라우터 (S1-10a FR-2197) — Connect to Another.

연결 만들기·바꾸기·끄기와 함께, 자기 자신·서로 연결·고리·다른 프로젝트를 막는지 본다.
멤버는 보고(200), OWNER·EDITOR 만 고치고(403), 남의 프로젝트는 404 로 숨긴다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Plugin, Project, ProjectMember, Track, TrackPlugin, User
from app.models.plugin import PluginType
from app.models.project import MemberRole
from app.models.track import TrackType

URL = "/api/v1"


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_cx",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-19",
    )
    db.add(user)
    db.flush()
    return user


def add_project(db, owner, title="Conn Song"):
    project = Project(owner_id=owner.user_id, title=title)
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(project_id=project.project_id, user_id=owner.user_id, role=MemberRole.OWNER)
    )
    db.flush()
    return project


def add_member(db, project, user, role):
    db.add(ProjectMember(project_id=project.project_id, user_id=user.user_id, role=role))
    db.flush()


def add_track(db, project, name="Lead", order_index=0, track_type=TrackType.MIDI):
    track = Track(
        project_id=project.project_id, name=name, track_type=track_type, order_index=order_index
    )
    db.add(track)
    db.flush()
    return track


def add_effect(db, track, code="eq"):
    plugin = Plugin(
        code=f"{code}_{track.track_id}",
        name=code.upper(),
        plugin_type=PluginType.EFFECT,
        param_schema=[{"key": "gain", "name": "Gain", "min": -60, "max": 24, "default": 0}],
    )
    db.add(plugin)
    db.flush()
    effect = TrackPlugin(
        track_id=track.track_id, plugin_id=plugin.plugin_id, slot_index=0, params={}
    )
    db.add(effect)
    db.flush()
    return effect


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


def url(track_id):
    return f"{URL}/tracks/{track_id}/connection"


def test_connection_routes_registered():
    paths = app.openapi()["paths"]
    assert set(paths[f"{URL}/tracks/{{track_id}}/connection"]) == {"get", "put", "delete"}


def test_put_creates_and_get_returns(client, db):
    user = add_user(db, "cx_create")
    project = add_project(db, user)
    source = add_track(db, project, "Source", 1)
    target = add_track(db, project, "Target", 2)

    res = client.put(
        url(source.track_id), json={"to_track_id": target.track_id}, headers=auth(user)
    )
    assert res.status_code == 200
    data = res.json()
    assert data["from_track_id"] == source.track_id
    assert data["to_track_id"] == target.track_id
    assert data["target"] == "PLUGIN"
    assert data["to_track_plugin_id"] is None
    assert data["to_port"] == 1
    assert data["also_play"] is None

    res = client.get(url(source.track_id), headers=auth(user))
    assert res.status_code == 200
    assert res.json()["to_track_id"] == target.track_id

    res = client.get(url(target.track_id), headers=auth(user))
    assert res.status_code == 404  # 나가는 연결이 없는 트랙


def test_put_replaces_existing(client, db):
    user = add_user(db, "cx_replace")
    project = add_project(db, user)
    source = add_track(db, project, "Source", 1)
    first = add_track(db, project, "First", 2)
    second = add_track(db, project, "Second", 3)

    client.put(url(source.track_id), json={"to_track_id": first.track_id}, headers=auth(user))
    res = client.put(
        url(source.track_id),
        json={"to_track_id": second.track_id, "also_play": True, "volume_db": "-6.00"},
        headers=auth(user),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["to_track_id"] == second.track_id
    assert data["also_play"] is True
    assert str(data["volume_db"]) == "-6.00"

    res = client.get(url(first.track_id), headers=auth(user))
    assert res.status_code == 404  # 예전 받는 트랙에는 연결이 없다


def test_put_with_plugin_target(client, db):
    user = add_user(db, "cx_plugin")
    project = add_project(db, user)
    source = add_track(db, project, "Source", 1)
    target = add_track(db, project, "Target", 2)
    effect = add_effect(db, target)

    res = client.put(
        url(source.track_id),
        json={
            "to_track_id": target.track_id,
            "target": "PLUGIN",
            "to_track_plugin_id": effect.track_plugin_id,
        },
        headers=auth(user),
    )
    assert res.status_code == 200
    assert res.json()["to_track_plugin_id"] == effect.track_plugin_id

    # 이펙트가 다른 트랙의 것이면 404
    other = add_track(db, project, "Other", 3)
    other_effect = add_effect(db, other, code="rev")
    res = client.put(
        url(source.track_id),
        json={"to_track_id": target.track_id, "to_track_plugin_id": other_effect.track_plugin_id},
        headers=auth(user),
    )
    assert res.status_code == 404


def test_put_instruments_target_drops_plugin(client, db):
    user = add_user(db, "cx_instr")
    project = add_project(db, user)
    source = add_track(db, project, "Source", 1)
    target = add_track(db, project, "Target", 2)
    effect = add_effect(db, target)

    res = client.put(
        url(source.track_id),
        json={
            "to_track_id": target.track_id,
            "target": "INSTRUMENTS",
            "to_track_plugin_id": effect.track_plugin_id,
        },
        headers=auth(user),
    )
    assert res.status_code == 200
    assert res.json()["target"] == "INSTRUMENTS"
    assert res.json()["to_track_plugin_id"] is None


def test_put_rejects_self_connection(client, db):
    user = add_user(db, "cx_self")
    project = add_project(db, user)
    track = add_track(db, project)

    res = client.put(url(track.track_id), json={"to_track_id": track.track_id}, headers=auth(user))
    assert res.status_code == 400


def test_put_rejects_mutual_connection(client, db):
    user = add_user(db, "cx_mutual")
    project = add_project(db, user)
    a = add_track(db, project, "A", 1)
    b = add_track(db, project, "B", 2)

    client.put(url(a.track_id), json={"to_track_id": b.track_id}, headers=auth(user))
    res = client.put(url(b.track_id), json={"to_track_id": a.track_id}, headers=auth(user))
    assert res.status_code == 400


def test_put_rejects_loop(client, db):
    user = add_user(db, "cx_loop")
    project = add_project(db, user)
    a = add_track(db, project, "A", 1)
    b = add_track(db, project, "B", 2)
    c = add_track(db, project, "C", 3)

    client.put(url(a.track_id), json={"to_track_id": b.track_id}, headers=auth(user))
    client.put(url(b.track_id), json={"to_track_id": c.track_id}, headers=auth(user))
    res = client.put(url(c.track_id), json={"to_track_id": a.track_id}, headers=auth(user))
    assert res.status_code == 400


def test_put_to_other_project_is_404(client, db):
    user = add_user(db, "cx_other")
    project = add_project(db, user)
    source = add_track(db, project, "Source", 1)
    other = add_project(db, user, title="Other Song")
    stranger_track = add_track(db, other, "Elsewhere", 1)

    res = client.put(
        url(source.track_id), json={"to_track_id": stranger_track.track_id}, headers=auth(user)
    )
    assert res.status_code == 404


def test_delete_turns_connection_off(client, db):
    user = add_user(db, "cx_delete")
    project = add_project(db, user)
    source = add_track(db, project, "Source", 1)
    target = add_track(db, project, "Target", 2)
    client.put(url(source.track_id), json={"to_track_id": target.track_id}, headers=auth(user))

    res = client.delete(url(source.track_id), headers=auth(user))
    assert res.status_code == 204
    assert client.get(url(source.track_id), headers=auth(user)).status_code == 404

    res = client.delete(url(source.track_id), headers=auth(user))  # 없어도 204
    assert res.status_code == 204


def test_viewer_cannot_write(client, db):
    owner = add_user(db, "cx_owner")
    viewer = add_user(db, "cx_viewer")
    project = add_project(db, owner)
    add_member(db, project, viewer, MemberRole.VIEWER)
    source = add_track(db, project, "Source", 1)
    target = add_track(db, project, "Target", 2)
    client.put(url(source.track_id), json={"to_track_id": target.track_id}, headers=auth(owner))

    assert client.get(url(source.track_id), headers=auth(viewer)).status_code == 200  # 보기는 됨
    res = client.put(
        url(source.track_id), json={"to_track_id": target.track_id}, headers=auth(viewer)
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"
    assert client.delete(url(source.track_id), headers=auth(viewer)).status_code == 403


def test_stranger_gets_404(client, db):
    owner = add_user(db, "cx_owner2")
    project = add_project(db, owner)
    source = add_track(db, project, "Source", 1)
    target = add_track(db, project, "Target", 2)
    stranger = add_user(db, "cx_stranger")

    assert client.get(url(source.track_id), headers=auth(stranger)).status_code == 404
    res = client.put(
        url(source.track_id), json={"to_track_id": target.track_id}, headers=auth(stranger)
    )
    assert res.status_code == 404


def test_needs_login(client, db):
    user = add_user(db, "cx_nologin")
    project = add_project(db, user)
    source = add_track(db, project, "Source", 1)
    target = add_track(db, project, "Target", 2)
    assert client.put(
        url(source.track_id), json={"to_track_id": target.track_id}
    ).status_code == 401
    assert client.get(url(source.track_id)).status_code == 401
