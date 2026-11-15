"""/api/v1/tracks/{id}/automation 라우터 (S1-15) — 오토메이션 레인과 점, 클립 페이드 저장.

곡선을 통째로 저장하고(PUT), 같은 대상은 레인 하나만 두며, 점이 없으면 레인을 지우는지 본다.
멤버는 보고(200), OWNER·EDITOR 만 고치고(403), 남의 프로젝트는 404 로 숨긴다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Plugin, Project, ProjectMember, Track, TrackInstrument, TrackPlugin, User
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
        nickname=f"{name}_au",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-19",
    )
    db.add(user)
    db.flush()
    return user


def add_project(db, owner, title="Auto Song"):
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


def add_instrument(db, track, code="synth"):
    plugin = Plugin(
        code=f"{code}_{track.track_id}",
        name=code.upper(),
        plugin_type=PluginType.INSTRUMENT,
        param_schema=[{"key": "cutoff", "name": "Cutoff", "min": 0, "max": 1, "default": 0.5}],
    )
    db.add(plugin)
    db.flush()
    instrument = TrackInstrument(
        track_id=track.track_id, plugin_id=plugin.plugin_id, slot_index=0, params={}
    )
    db.add(instrument)
    db.flush()
    return instrument


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


def url(track_id):
    return f"{URL}/tracks/{track_id}/automation"


def volume(points):
    return {"target_type": "VOLUME", "points": points}


def test_automation_routes_registered():
    paths = app.openapi()["paths"]
    assert set(paths[f"{URL}/tracks/{{track_id}}/automation"]) == {"get", "put"}


def test_get_without_lanes_is_empty_list(client, db):
    user = add_user(db, "au_empty")
    track = add_track(db, add_project(db, user))
    res = client.get(url(track.track_id), headers=auth(user))
    assert res.status_code == 200
    assert res.json() == []


def test_put_saves_points_sorted_by_tick_and_get_returns_them(client, db):
    user = add_user(db, "au_save")
    track = add_track(db, add_project(db, user))
    points = [
        {"tick": 1920, "value": -6, "curve": 0.5},
        {"tick": 0, "value": 0},
        {"tick": 960, "value": -12.5, "curve": -0.25},
    ]
    res = client.put(url(track.track_id), json=volume(points), headers=auth(user))
    assert res.status_code == 200
    data = res.json()
    assert data["track_id"] == track.track_id
    assert data["target_type"] == "VOLUME"
    assert data["track_plugin_id"] is None
    assert data["param_index"] is None
    assert data["is_enabled"] is True
    assert [p["tick"] for p in data["points"]] == [0, 960, 1920]
    assert [float(p["value"]) for p in data["points"]] == [0, -12.5, -6]
    assert [float(p["curve"]) for p in data["points"]] == [0, -0.25, 0.5]  # 빠진 curve 는 0

    res = client.get(url(track.track_id), headers=auth(user))
    assert res.status_code == 200
    assert [lane["lane_id"] for lane in res.json()] == [data["lane_id"]]
    assert [p["tick"] for p in res.json()[0]["points"]] == [0, 960, 1920]


def test_put_same_target_replaces_points_in_the_same_lane(client, db):
    user = add_user(db, "au_replace")
    track = add_track(db, add_project(db, user))
    first = client.put(
        url(track.track_id),
        json=volume([{"tick": 0, "value": 0}, {"tick": 480, "value": -3}]),
        headers=auth(user),
    ).json()
    second = client.put(
        url(track.track_id),
        json={**volume([{"tick": 960, "value": -9}]), "is_enabled": False},
        headers=auth(user),
    ).json()
    assert second["lane_id"] == first["lane_id"]  # 같은 대상은 레인 하나
    assert second["is_enabled"] is False
    assert [p["tick"] for p in second["points"]] == [960]
    lanes = client.get(url(track.track_id), headers=auth(user)).json()
    assert len(lanes) == 1
    assert [p["tick"] for p in lanes[0]["points"]] == [960]


def test_put_empty_points_deletes_lane_with_204(client, db):
    user = add_user(db, "au_delete")
    track = add_track(db, add_project(db, user))
    client.put(url(track.track_id), json=volume([{"tick": 0, "value": 0}]), headers=auth(user))
    res = client.put(url(track.track_id), json=volume([]), headers=auth(user))
    assert res.status_code == 204
    assert client.get(url(track.track_id), headers=auth(user)).json() == []


def test_put_empty_points_without_lane_is_still_204(client, db):
    user = add_user(db, "au_delete_none")
    track = add_track(db, add_project(db, user))
    res = client.put(url(track.track_id), json=volume([]), headers=auth(user))
    assert res.status_code == 204


def test_volume_and_pan_are_separate_lanes(client, db):
    user = add_user(db, "au_two")
    track = add_track(db, add_project(db, user))
    client.put(url(track.track_id), json=volume([{"tick": 0, "value": 0}]), headers=auth(user))
    client.put(
        url(track.track_id),
        json={"target_type": "PAN", "points": [{"tick": 0, "value": -1}]},
        headers=auth(user),
    )
    lanes = client.get(url(track.track_id), headers=auth(user)).json()
    assert sorted(lane["target_type"] for lane in lanes) == ["PAN", "VOLUME"]


def test_device_lane_is_kept_per_plugin_and_param(client, db):
    user = add_user(db, "au_device")
    track = add_track(db, add_project(db, user))
    effect = add_effect(db, track)
    body = {
        "target_type": "DEVICE_PARAM",
        "track_plugin_id": effect.track_plugin_id,
        "param_index": 0,
        "points": [{"tick": 0, "value": 3}],
    }
    first = client.put(url(track.track_id), json=body, headers=auth(user)).json()
    assert first["track_plugin_id"] == effect.track_plugin_id
    assert first["param_index"] == 0

    again = client.put(
        url(track.track_id),
        json={**body, "points": [{"tick": 0, "value": 6}]},
        headers=auth(user),
    ).json()
    assert again["lane_id"] == first["lane_id"]  # 같은 장치, 같은 파라미터

    other = client.put(
        url(track.track_id), json={**body, "param_index": 1}, headers=auth(user)
    ).json()
    assert other["lane_id"] != first["lane_id"]  # 파라미터가 다르면 다른 레인
    assert len(client.get(url(track.track_id), headers=auth(user)).json()) == 2


def test_instrument_lane_is_saved_with_track_instrument_id(client, db):
    user = add_user(db, "au_inst")
    track = add_track(db, add_project(db, user))
    inst = add_instrument(db, track)
    body = {
        "target_type": "INSTRUMENT_PARAM",
        "track_instrument_id": inst.track_instrument_id,
        "param_index": 0,
        "points": [{"tick": 0, "value": 0.2}, {"tick": 960, "value": 0.8}],
    }
    res = client.put(url(track.track_id), json=body, headers=auth(user))
    assert res.status_code == 200
    data = res.json()
    assert data["track_instrument_id"] == inst.track_instrument_id
    assert data["track_plugin_id"] is None
    again = client.put(url(track.track_id), json=body, headers=auth(user)).json()
    assert again["lane_id"] == data["lane_id"]
    assert len(client.get(url(track.track_id), headers=auth(user)).json()) == 1


def test_instrument_lane_of_another_track_is_400(client, db):
    user = add_user(db, "au_inst_other")
    project = add_project(db, user)
    track = add_track(db, project)
    other = add_track(db, project, name="Other", order_index=1)
    inst = add_instrument(db, other)
    body = {
        "target_type": "INSTRUMENT_PARAM",
        "track_instrument_id": inst.track_instrument_id,
        "param_index": 0,
        "points": [{"tick": 0, "value": 0.2}],
    }
    res = client.put(url(track.track_id), json=body, headers=auth(user))
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_device_lane_of_another_track_is_400(client, db):
    user = add_user(db, "au_dev_other")
    project = add_project(db, user)
    track = add_track(db, project)
    other = add_track(db, project, name="Other", order_index=1)
    effect = add_effect(db, other)
    body = {
        "target_type": "DEVICE_PARAM",
        "track_plugin_id": effect.track_plugin_id,
        "param_index": 0,
        "points": [{"tick": 0, "value": 1}],
    }
    res = client.put(url(track.track_id), json=body, headers=auth(user))
    assert res.status_code == 400


def test_instrument_lane_is_removed_with_its_instrument(client, db):
    user = add_user(db, "au_inst_cascade")
    track = add_track(db, add_project(db, user))
    inst = add_instrument(db, track)
    client.put(
        url(track.track_id),
        json={
            "target_type": "INSTRUMENT_PARAM",
            "track_instrument_id": inst.track_instrument_id,
            "param_index": 0,
            "points": [{"tick": 0, "value": 0.5}],
        },
        headers=auth(user),
    )
    db.delete(inst)
    db.flush()
    db.expire_all()
    assert client.get(url(track.track_id), headers=auth(user)).json() == []


@pytest.mark.parametrize("target", ["INSTRUMENT_PARAM", "DEVICE_PARAM"])
def test_device_lane_without_plugin_or_param_is_400(client, db, target):
    user = add_user(db, "au_device_bad_" + target[:3].lower())
    track = add_track(db, add_project(db, user))
    body = {"target_type": target, "points": [{"tick": 0, "value": 1}]}
    res = client.put(url(track.track_id), json=body, headers=auth(user))
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_volume_lane_ignores_plugin_and_param(client, db):
    user = add_user(db, "au_ignore")
    track = add_track(db, add_project(db, user))
    body = {
        **volume([{"tick": 0, "value": 0}]),
        "track_plugin_id": 99,
        "track_instrument_id": 98,
        "param_index": 7,
    }
    data = client.put(url(track.track_id), json=body, headers=auth(user)).json()
    assert data["track_plugin_id"] is None
    assert data["track_instrument_id"] is None
    assert data["param_index"] is None


@pytest.mark.parametrize(
    "point",
    [
        {"tick": -1, "value": 0},
        {"tick": 0, "value": 100001},
        {"tick": 0, "value": 0, "curve": 1.5},
        {"tick": 0, "value": 0, "curve": -1.01},
    ],
)
def test_invalid_point_is_rejected(client, db, point):
    user = add_user(db, "au_invalid")
    track = add_track(db, add_project(db, user))
    res = client.put(url(track.track_id), json=volume([point]), headers=auth(user))
    assert res.status_code in (400, 422)


def test_unknown_target_type_is_rejected(client, db):
    user = add_user(db, "au_unknown")
    track = add_track(db, add_project(db, user))
    res = client.put(
        url(track.track_id),
        json={"target_type": "TEMPO", "points": [{"tick": 0, "value": 0}]},
        headers=auth(user),
    )
    assert res.status_code in (400, 422)


def test_too_many_points_is_rejected(client, db):
    user = add_user(db, "au_many")
    track = add_track(db, add_project(db, user))
    points = [{"tick": i, "value": 0} for i in range(5001)]
    res = client.put(url(track.track_id), json=volume(points), headers=auth(user))
    assert res.status_code in (400, 422)


def test_roles_viewer_reads_but_cannot_write(client, db):
    owner = add_user(db, "au_owner")
    viewer = add_user(db, "au_viewer")
    editor = add_user(db, "au_editor")
    project = add_project(db, owner)
    add_member(db, project, viewer, MemberRole.VIEWER)
    add_member(db, project, editor, MemberRole.EDITOR)
    track = add_track(db, project)
    body = volume([{"tick": 0, "value": 0}])

    assert client.put(url(track.track_id), json=body, headers=auth(editor)).status_code == 200
    assert client.get(url(track.track_id), headers=auth(viewer)).status_code == 200
    assert client.put(url(track.track_id), json=body, headers=auth(viewer)).status_code == 403


def test_outsider_gets_404_and_unknown_track_404(client, db):
    owner = add_user(db, "au_owner2")
    outsider = add_user(db, "au_outsider")
    track = add_track(db, add_project(db, owner))
    body = volume([{"tick": 0, "value": 0}])

    assert client.get(url(track.track_id), headers=auth(outsider)).status_code == 404
    assert client.put(url(track.track_id), json=body, headers=auth(outsider)).status_code == 404
    assert client.get(url(999999999), headers=auth(owner)).status_code == 404


def test_requires_login(client, db):
    owner = add_user(db, "au_anon")
    track = add_track(db, add_project(db, owner))
    assert client.get(url(track.track_id)).status_code == 401
    assert client.put(url(track.track_id), json=volume([])).status_code == 401


def test_full_project_includes_automation_lanes(client, db):
    user = add_user(db, "au_full")
    project = add_project(db, user)
    track = add_track(db, project)
    other = add_track(db, project, "Other", 1)
    client.put(url(track.track_id), json=volume([{"tick": 0, "value": -3}]), headers=auth(user))
    client.put(
        url(other.track_id),
        json={"target_type": "PAN", "points": [{"tick": 0, "value": 1}]},
        headers=auth(user),
    )
    full = client.get(f"{URL}/projects/{project.project_id}/full", headers=auth(user)).json()
    got = {(lane["track_id"], lane["target_type"]) for lane in full["automation"]}
    assert got == {(track.track_id, "VOLUME"), (other.track_id, "PAN")}


def test_deleting_track_removes_its_lanes(client, db):
    from sqlalchemy import select

    from app.models.automation import AutomationLane

    user = add_user(db, "au_cascade")
    track = add_track(db, add_project(db, user))
    lane_id = client.put(
        url(track.track_id), json=volume([{"tick": 0, "value": 0}]), headers=auth(user)
    ).json()["lane_id"]
    assert client.delete(f"{URL}/tracks/{track.track_id}", headers=auth(user)).status_code == 204
    db.expire_all()
    assert db.scalar(select(AutomationLane).where(AutomationLane.lane_id == lane_id)) is None


# ── 클립 페이드 (항목 i) ──


def clip_url(track_id):
    return f"{URL}/tracks/{track_id}/clips"


def make_audio_clip(client, db, user, track):
    from app.models import Sample

    sample = Sample(
        owner_id=user.user_id,
        name="fade_probe",
        original_filename="fade_probe.wav",
        file_path="x/fade_probe.wav",
        mime_type="audio/wav",
        file_size=1,
    )
    db.add(sample)
    db.flush()
    res = client.post(
        clip_url(track.track_id),
        json={
            "clip_type": "AUDIO",
            "sample_id": sample.sample_id,
            "start_tick": 0,
            "length_tick": 3840,
        },
        headers=auth(user),
    )
    assert res.status_code in (200, 201), res.text
    return res.json()


def test_clip_fade_defaults_to_zero_then_saves_and_returns(client, db):
    user = add_user(db, "au_fade")
    track = add_track(db, add_project(db, user), track_type=TrackType.AUDIO)
    clip = make_audio_clip(client, db, user, track)
    assert clip["fade_in_tick"] == 0
    assert clip["fade_out_tick"] == 0
    assert float(clip["fade_in_curve"]) == 0
    assert float(clip["fade_out_curve"]) == 0

    res = client.patch(
        f"{URL}/clips/{clip['clip_id']}",
        json={
            "fade_in_tick": 480,
            "fade_out_tick": 960,
            "fade_in_curve": 0.4,
            "fade_out_curve": -0.6,
        },
        headers=auth(user),
    )
    assert res.status_code == 200
    got = res.json()
    assert (got["fade_in_tick"], got["fade_out_tick"]) == (480, 960)
    assert (float(got["fade_in_curve"]), float(got["fade_out_curve"])) == (0.4, -0.6)

    listed = client.get(clip_url(track.track_id), headers=auth(user)).json()
    row = [c for c in (listed if isinstance(listed, list) else listed["items"])][0]
    assert row["fade_in_tick"] == 480
    assert float(row["fade_out_curve"]) == -0.6


@pytest.mark.parametrize(
    "patch",
    [{"fade_in_tick": -1}, {"fade_out_curve": 1.5}, {"fade_in_curve": -1.1}],
)
def test_clip_fade_out_of_range_is_rejected(client, db, patch):
    user = add_user(db, "au_fade_bad_" + next(iter(patch))[5:8])
    track = add_track(db, add_project(db, user), track_type=TrackType.AUDIO)
    clip = make_audio_clip(client, db, user, track)
    res = client.patch(f"{URL}/clips/{clip['clip_id']}", json=patch, headers=auth(user))
    assert res.status_code in (400, 422)
