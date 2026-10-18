"""/api/v1/tracks 라우터 (S1-09 FR-251·263·264·265~269) — 트랙과 디바이스.

트랙 만들기·목록·수정·삭제, 악기·이펙트·연결선 붙이기와 고치기를 확인한다.
멤버는 보고(200), OWNER·EDITOR 만 고치고(403), 남의 프로젝트는 404 로 숨긴다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Plugin, Project, ProjectMember, Track, User
from app.models.plugin import PluginType
from app.models.project import MemberRole
from app.models.track import TrackType

URL = "/api/v1"
TRACK_KEYS = {
    "track_id", "project_id", "name", "track_type", "order_index", "color", "volume_db",
    "pan", "is_muted", "is_solo", "is_enabled", "parent_track_id", "frozen_sample_id",
    "routing_mode", "assignee_id", "locked_by", "locked_at",
}
INSTRUMENT_KEYS = {
    "track_instrument_id", "track_id", "plugin_id", "slot_index", "params",
    "volume_db", "pan", "is_solo", "is_enabled",
}
EFFECT_KEYS = {
    "track_plugin_id", "track_id", "plugin_id", "slot_index", "node_x", "node_y",
    "params", "is_bypassed",
}
LINK_KEYS = {
    "link_id", "track_id", "from_track_plugin_id", "from_port",
    "to_track_plugin_id", "to_port", "gain_db",
}


def test_track_routes_registered():
    paths = app.openapi()["paths"]

    def has(path, *methods):
        assert set(methods) <= set(paths[path])

    has(f"{URL}/projects/{{project_id}}/tracks", "get", "post")
    has(f"{URL}/tracks/{{track_id}}", "get", "patch", "delete")
    has(f"{URL}/tracks/{{track_id}}/instruments", "get", "post")
    has(f"{URL}/tracks/{{track_id}}/instruments/{{instrument_id}}", "patch", "delete")
    has(f"{URL}/tracks/{{track_id}}/plugins", "get", "post")
    has(f"{URL}/tracks/{{track_id}}/plugins/{{track_plugin_id}}", "patch", "delete")
    has(f"{URL}/tracks/{{track_id}}/links", "get", "post")
    has(f"{URL}/tracks/{{track_id}}/links/{{link_id}}", "delete")


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_tk",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-17",
    )
    db.add(user)
    db.flush()
    return user


def add_project(db, owner, role=MemberRole.OWNER, member=None):
    project = Project(owner_id=owner.user_id, title="Wire Song")
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(project_id=project.project_id, user_id=owner.user_id, role=MemberRole.OWNER)
    )
    if member is not None:
        db.add(ProjectMember(project_id=project.project_id, user_id=member.user_id, role=role))
    db.flush()
    return project


def add_track(db, project, name="Lead", order_index=0, track_type=TrackType.MIDI):
    track = Track(
        project_id=project.project_id, name=name, track_type=track_type, order_index=order_index
    )
    db.add(track)
    db.flush()
    return track


def add_plugin(db, code, plugin_type):
    plugin = Plugin(
        code=code,
        name=code.upper(),
        plugin_type=plugin_type,
        param_schema=[{"key": "gain", "name": "Gain", "min": -60, "max": 24, "default": 0}],
    )
    db.add(plugin)
    db.flush()
    return plugin


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_list_tracks_in_order(client, db):
    user = add_user(db, "tk_list")
    project = add_project(db, user)
    add_track(db, project, "Bass", order_index=1)
    add_track(db, project, "Lead", order_index=0)

    res = client.get(f"{URL}/projects/{project.project_id}/tracks", headers=auth(user))

    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert [t["name"] for t in data["items"]] == ["Lead", "Bass"]
    assert set(data["items"][0]) == TRACK_KEYS


def test_create_track_201_with_defaults(client, db):
    user = add_user(db, "tk_create")
    project = add_project(db, user)

    res = client.post(
        f"{URL}/projects/{project.project_id}/tracks",
        json={"project_id": project.project_id, "name": "Drums"},
        headers=auth(user),
    )

    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Drums"
    assert data["track_type"] == "MIDI"
    assert data["color"] == "#7C5CFF"
    assert data["routing_mode"] == "CHAIN"
    assert str(data["volume_db"]) == "0.00"
    assert data["parent_track_id"] is None


def test_create_track_validates_input(client, db):
    user = add_user(db, "tk_bad")
    project = add_project(db, user)
    body = {"project_id": project.project_id, "name": "Drums"}

    res = client.post(
        f"{URL}/projects/{project.project_id}/tracks",
        json={**body, "color": "red"},
        headers=auth(user),
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    res = client.post(
        f"{URL}/projects/{project.project_id}/tracks",
        json={**body, "volume_db": "99.00"},
        headers=auth(user),
    )
    assert res.status_code == 422


def test_patch_and_delete_track(client, db):
    user = add_user(db, "tk_patch")
    project = add_project(db, user)
    track = add_track(db, project)

    res = client.patch(
        f"{URL}/tracks/{track.track_id}",
        json={"name": "Lead 2", "volume_db": "-3.50", "routing_mode": "PATCHER"},
        headers=auth(user),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Lead 2"
    assert str(data["volume_db"]) == "-3.50"
    assert data["routing_mode"] == "PATCHER"

    res = client.delete(f"{URL}/tracks/{track.track_id}", headers=auth(user))
    assert res.status_code == 204

    res = client.get(f"{URL}/tracks/{track.track_id}", headers=auth(user))
    assert res.status_code == 404


def test_non_member_gets_404(client, db):
    owner = add_user(db, "tk_owner")
    project = add_project(db, owner)
    track = add_track(db, project)
    stranger = add_user(db, "tk_stranger")

    res = client.get(f"{URL}/tracks/{track.track_id}", headers=auth(stranger))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"

    res = client.get(f"{URL}/projects/{project.project_id}/tracks", headers=auth(stranger))
    assert res.status_code == 404

    res = client.post(
        f"{URL}/projects/{project.project_id}/tracks",
        json={"project_id": project.project_id, "name": "X"},
        headers=auth(stranger),
    )
    assert res.status_code == 404


def test_viewer_can_read_but_not_write(client, db):
    owner = add_user(db, "tk_owner2")
    viewer = add_user(db, "tk_viewer")
    project = add_project(db, owner, role=MemberRole.VIEWER, member=viewer)
    track = add_track(db, project)

    res = client.get(f"{URL}/projects/{project.project_id}/tracks", headers=auth(viewer))
    assert res.status_code == 200

    res = client.post(
        f"{URL}/projects/{project.project_id}/tracks",
        json={"project_id": project.project_id, "name": "Nope"},
        headers=auth(viewer),
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"

    res = client.patch(
        f"{URL}/tracks/{track.track_id}", json={"name": "Nope"}, headers=auth(viewer)
    )
    assert res.status_code == 403

    res = client.delete(f"{URL}/tracks/{track.track_id}", headers=auth(viewer))
    assert res.status_code == 403


def test_instrument_crud(client, db):
    user = add_user(db, "tk_inst")
    project = add_project(db, user)
    track = add_track(db, project)
    synth = add_plugin(db, "tk_synth", PluginType.INSTRUMENT)
    eq = add_plugin(db, "tk_eq", PluginType.EFFECT)

    res = client.post(
        f"{URL}/tracks/{track.track_id}/instruments",
        json={"plugin_id": synth.plugin_id, "params": {"cutoff": 1500}},
        headers=auth(user),
    )
    assert res.status_code == 201
    inst = res.json()
    assert set(inst) == INSTRUMENT_KEYS
    assert inst["params"] == {"cutoff": 1500}
    assert inst["is_enabled"] is True

    # 이펙트는 악기 칸에 못 넣는다 (400)
    res = client.post(
        f"{URL}/tracks/{track.track_id}/instruments",
        json={"plugin_id": eq.plugin_id},
        headers=auth(user),
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "BAD_REQUEST"

    # 없는 플러그인 (404)
    res = client.post(
        f"{URL}/tracks/{track.track_id}/instruments",
        json={"plugin_id": 999999},
        headers=auth(user),
    )
    assert res.status_code == 404

    res = client.get(f"{URL}/tracks/{track.track_id}/instruments", headers=auth(user))
    assert res.status_code == 200
    assert [i["track_instrument_id"] for i in res.json()] == [inst["track_instrument_id"]]

    res = client.patch(
        f"{URL}/tracks/{track.track_id}/instruments/{inst['track_instrument_id']}",
        json={"volume_db": "-6.00", "is_enabled": False},
        headers=auth(user),
    )
    assert res.status_code == 200
    assert str(res.json()["volume_db"]) == "-6.00"
    assert res.json()["is_enabled"] is False

    res = client.delete(
        f"{URL}/tracks/{track.track_id}/instruments/{inst['track_instrument_id']}",
        headers=auth(user),
    )
    assert res.status_code == 204
    assert client.get(
        f"{URL}/tracks/{track.track_id}/instruments", headers=auth(user)
    ).json() == []


def test_effect_chain_crud(client, db):
    user = add_user(db, "tk_fx")
    project = add_project(db, user)
    track = add_track(db, project)
    eq = add_plugin(db, "tk_eq", PluginType.EFFECT)
    synth = add_plugin(db, "tk_synth", PluginType.INSTRUMENT)

    res = client.post(
        f"{URL}/tracks/{track.track_id}/plugins",
        json={"plugin_id": eq.plugin_id, "slot_index": 0, "node_x": 40, "node_y": 80},
        headers=auth(user),
    )
    assert res.status_code == 201
    fx = res.json()
    assert set(fx) == EFFECT_KEYS
    assert fx["node_x"] == 40
    assert fx["is_bypassed"] is False

    # 악기는 이펙트 체인에 못 넣는다 (400)
    res = client.post(
        f"{URL}/tracks/{track.track_id}/plugins",
        json={"plugin_id": synth.plugin_id},
        headers=auth(user),
    )
    assert res.status_code == 400

    res = client.get(f"{URL}/tracks/{track.track_id}/plugins", headers=auth(user))
    assert res.status_code == 200
    assert len(res.json()) == 1

    res = client.patch(
        f"{URL}/tracks/{track.track_id}/plugins/{fx['track_plugin_id']}",
        json={"is_bypassed": True, "slot_index": 2},
        headers=auth(user),
    )
    assert res.status_code == 200
    assert res.json()["is_bypassed"] is True
    assert res.json()["slot_index"] == 2

    res = client.delete(
        f"{URL}/tracks/{track.track_id}/plugins/{fx['track_plugin_id']}",
        headers=auth(user),
    )
    assert res.status_code == 204


def test_slot_conflict_is_400(client, db):
    """같은 트랙의 같은 칸에는 한 행만 넣을 수 있다 (DB UNIQUE) — API 가 미리 막아 500을 피한다."""
    user = add_user(db, "tk_slot")
    project = add_project(db, user)
    track = add_track(db, project)
    synth = add_plugin(db, "tk_slot_syn", PluginType.INSTRUMENT)
    eq = add_plugin(db, "tk_slot_eq", PluginType.EFFECT)
    rev = add_plugin(db, "tk_slot_rev", PluginType.EFFECT)

    # 악기: 기본 칸 0 이 이미 찼으면 400, 1 번 칸은 넣을 수 있다
    res = client.post(
        f"{URL}/tracks/{track.track_id}/instruments",
        json={"plugin_id": synth.plugin_id},
        headers=auth(user),
    )
    assert res.status_code == 201
    res = client.post(
        f"{URL}/tracks/{track.track_id}/instruments",
        json={"plugin_id": synth.plugin_id},
        headers=auth(user),
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "BAD_REQUEST"
    res = client.post(
        f"{URL}/tracks/{track.track_id}/instruments",
        json={"plugin_id": synth.plugin_id, "slot_index": 1},
        headers=auth(user),
    )
    assert res.status_code == 201

    # 이펙트: 같은 칸에 두 번 (400)
    fx_a = client.post(
        f"{URL}/tracks/{track.track_id}/plugins",
        json={"plugin_id": eq.plugin_id, "slot_index": 0},
        headers=auth(user),
    ).json()
    res = client.post(
        f"{URL}/tracks/{track.track_id}/plugins",
        json={"plugin_id": rev.plugin_id, "slot_index": 0},
        headers=auth(user),
    )
    assert res.status_code == 400

    # 남이 쓰는 칸으로 옮기기 (400) — 자기 자리로는 그대로 두는 것도 가능
    res = client.patch(
        f"{URL}/tracks/{track.track_id}/plugins/{fx_a['track_plugin_id']}",
        json={"slot_index": 0},
        headers=auth(user),
    )
    assert res.status_code == 200
    res = client.post(
        f"{URL}/tracks/{track.track_id}/plugins",
        json={"plugin_id": rev.plugin_id, "slot_index": 1},
        headers=auth(user),
    )
    assert res.status_code == 201
    fx_b = res.json()
    res = client.patch(
        f"{URL}/tracks/{track.track_id}/plugins/{fx_b['track_plugin_id']}",
        json={"slot_index": 0},
        headers=auth(user),
    )
    assert res.status_code == 400


def test_patcher_links_crud(client, db):
    user = add_user(db, "tk_link")
    project = add_project(db, user)
    track = add_track(db, project)
    eq = add_plugin(db, "tk_eq", PluginType.EFFECT)
    rev = add_plugin(db, "tk_rev", PluginType.EFFECT)
    a = client.post(
        f"{URL}/tracks/{track.track_id}/plugins",
        json={"plugin_id": eq.plugin_id, "slot_index": 0},
        headers=auth(user),
    ).json()
    b = client.post(
        f"{URL}/tracks/{track.track_id}/plugins",
        json={"plugin_id": rev.plugin_id, "slot_index": 1},
        headers=auth(user),
    ).json()

    # 트랙 입력(소스) → 이펙트 A (from 은 NULL)
    res = client.post(
        f"{URL}/tracks/{track.track_id}/links",
        json={"to_track_plugin_id": a["track_plugin_id"]},
        headers=auth(user),
    )
    assert res.status_code == 201
    link = res.json()
    assert set(link) == LINK_KEYS
    assert link["from_track_plugin_id"] is None
    assert link["to_track_plugin_id"] == a["track_plugin_id"]

    # 이펙트 A → 이펙트 B
    res = client.post(
        f"{URL}/tracks/{track.track_id}/links",
        json={
            "from_track_plugin_id": a["track_plugin_id"],
            "to_track_plugin_id": b["track_plugin_id"],
            "gain_db": "-2.00",
        },
        headers=auth(user),
    )
    assert res.status_code == 201

    res = client.get(f"{URL}/tracks/{track.track_id}/links", headers=auth(user))
    assert res.status_code == 200
    assert len(res.json()) == 2

    res = client.delete(
        f"{URL}/tracks/{track.track_id}/links/{link['link_id']}", headers=auth(user)
    )
    assert res.status_code == 204
    assert len(client.get(f"{URL}/tracks/{track.track_id}/links", headers=auth(user)).json()) == 1
