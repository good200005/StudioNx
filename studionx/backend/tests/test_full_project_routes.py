"""S1-10 프로젝트 전체 조회 — 실제 앱 · 실제 MySQL 로 요청 (FR-254).

시퀀서가 화면을 열 때 부르는 `GET /api/v1/projects/{id}/full` 한 번이
프로젝트 설정 · 트랙(+악기·이펙트·연결선) · 패턴(+노트)을 모두 담아 주는지 확인한다.
시험 세션(db)은 conftest.py 가 만들고 끝나면 rollback 한다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import (
    Clip,
    MidiNote,
    Pattern,
    Plugin,
    Project,
    ProjectMember,
    Track,
    TrackConnection,
    TrackInstrument,
    TrackPlugin,
    TrackPluginLink,
    User,
)
from app.models.clip import ClipType
from app.models.plugin import PluginType
from app.models.project import MemberRole
from app.models.track import TrackType
from app.models.track_connection import ConnectionTarget

FULL_URL = "/api/v1/projects/{}/full"

PROJECT_KEYS = {
    "project_id", "title", "description", "bpm", "time_sig_num", "time_sig_den", "music_key",
    "scale_mode", "sample_rate", "master_settings", "revision", "my_role", "member_count",
    "opened", "created_at", "updated_at",
}
TRACK_KEYS = {
    "track_id", "project_id", "name", "track_type", "order_index", "color", "volume_db", "pan",
    "is_muted", "is_solo", "is_enabled", "parent_track_id", "frozen_sample_id", "routing_mode",
    "assignee_id", "locked_by", "locked_at", "instruments", "effects", "links", "connections",
}
PATTERN_KEYS = {
    "pattern_id", "project_id", "name", "color", "length_tick", "swing", "updated_at", "notes",
}
NOTE_KEYS = {
    "note_id", "pitch", "start_tick", "length_tick", "velocity", "channel", "release_velocity",
    "is_muted", "probability", "velocity_deviation",
}
CLIP_KEYS = {
    "clip_id", "track_id", "clip_type", "sample_id", "pattern_id", "name", "start_tick",
    "length_tick", "offset_tick", "gain_db", "is_looped", "fade_in_tick", "fade_out_tick",
    "fade_in_curve", "fade_out_curve", "warp_mode", "warp_markers", "pitch_semitones",
    "is_reversed", "updated_at",
}
CONNECTION_KEYS = {
    "connection_id", "from_track_id", "to_track_id", "target", "to_track_plugin_id", "to_port",
    "also_play", "volume_db", "pan", "is_solo",
}
EMPTY_LATER = ("markers", "tempo_changes", "meter_changes")


def test_full_route_registered():
    paths = app.openapi()["paths"]
    assert "get" in paths["/api/v1/projects/{project_id}/full"]


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db  # 앱이 시험용 세션을 쓰게 함
    yield TestClient(app)
    app.dependency_overrides.clear()


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_full",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-18",
    )
    db.add(user)
    db.flush()
    return user


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


def add_project(db, user, title="Full Song"):
    """프로젝트 + OWNER 멤버 + MASTER 트랙 (실제 create_project 와 같은 모양)."""
    project = Project(owner_id=user.user_id, title=title)
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(
            project_id=project.project_id,
            user_id=user.user_id,
            role=MemberRole.OWNER,
        )
    )
    db.add(
        Track(
            project_id=project.project_id,
            name="Master",
            track_type=TrackType.MASTER,
            order_index=0,
        )
    )
    db.flush()
    return project


def add_track(db, project, name, order_index, track_type=TrackType.MIDI):
    track = Track(
        project_id=project.project_id,
        name=name,
        track_type=track_type,
        order_index=order_index,
        color="#7C5CFF",
    )
    db.add(track)
    db.flush()
    return track


def add_plugin(db, code, plugin_type=PluginType.EFFECT):
    plugin = Plugin(
        code=code,
        name=code,
        plugin_type=plugin_type,
        param_schema=[{"key": "gain", "name": "Gain", "min": -60, "max": 24, "default": 0}],
    )
    db.add(plugin)
    db.flush()
    return plugin


def add_effect(db, track, plugin, slot, params=None):
    effect = TrackPlugin(
        track_id=track.track_id,
        plugin_id=plugin.plugin_id,
        slot_index=slot,
        params=params or {},
    )
    db.add(effect)
    db.flush()
    return effect


def add_pattern(db, project, name):
    pattern = Pattern(project_id=project.project_id, name=name, color="#7C5CFF", length_tick=3840)
    db.add(pattern)
    db.flush()
    return pattern


def add_note(db, pattern, pitch, start_tick, length_tick=480):
    note = MidiNote(
        pattern_id=pattern.pattern_id, pitch=pitch, start_tick=start_tick, length_tick=length_tick
    )
    db.add(note)
    db.flush()
    return note


def add_midi_clip(db, track, pattern, start_tick, length_tick=3840, name="Bass line"):
    clip = Clip(
        track_id=track.track_id,
        clip_type=ClipType.MIDI,
        pattern_id=pattern.pattern_id,
        name=name,
        start_tick=start_tick,
        length_tick=length_tick,
    )
    db.add(clip)
    db.flush()
    return clip


def add_connection(db, from_track, to_track):
    connection = TrackConnection(
        from_track_id=from_track.track_id,
        to_track_id=to_track.track_id,
        target=ConnectionTarget.PLUGIN,
    )
    db.add(connection)
    db.flush()
    return connection


def get(client, user, project_id):
    res = client.get(FULL_URL.format(project_id), headers=auth(user))
    assert res.status_code == 200
    return res.json()


def test_full_returns_project_tracks_and_patterns(client, db):
    user = add_user(db, "full_basic")
    project = add_project(db, user, title="Full Basic")
    add_track(db, project, "Bass Synth", order_index=1)
    add_track(db, project, "Keys", order_index=2)
    pattern = add_pattern(db, project, "Bass line")
    add_note(db, pattern, pitch=40, start_tick=960)
    add_note(db, pattern, pitch=43, start_tick=0)

    data = get(client, user, project.project_id)

    assert set(data) == {"project", "tracks", "patterns", "clips", *EMPTY_LATER}
    assert set(data["project"]) == PROJECT_KEYS
    assert data["project"]["title"] == "Full Basic"
    assert data["project"]["my_role"] == "OWNER"
    assert data["project"]["member_count"] == 1
    assert data["clips"] == []  # 클립이 없으면 빈 목록
    for key in EMPTY_LATER:  # 모델·API 가 아직 없는 표는 빈 목록
        assert data[key] == []

    # MASTER 부터 order_index 순
    assert [t["name"] for t in data["tracks"]] == ["Master", "Bass Synth", "Keys"]
    assert data["tracks"][0]["track_type"] == "MASTER"
    assert set(data["tracks"][1]) == TRACK_KEYS
    assert data["tracks"][1]["instruments"] == []
    assert data["tracks"][1]["effects"] == []
    assert data["tracks"][1]["connections"] == []

    assert len(data["patterns"]) == 1
    pattern_data = data["patterns"][0]
    assert set(pattern_data) == PATTERN_KEYS
    assert pattern_data["name"] == "Bass line"
    assert [note["pitch"] for note in pattern_data["notes"]] == [43, 40]  # start_tick 순
    assert set(pattern_data["notes"][0]) == NOTE_KEYS


def test_full_attaches_devices_to_their_own_track(client, db):
    user = add_user(db, "full_devices")
    project = add_project(db, user)
    bass = add_track(db, project, "Bass Synth", order_index=1)
    keys = add_track(db, project, "Keys", order_index=2)
    synth = add_plugin(db, "full_synth", PluginType.INSTRUMENT)
    eq = add_plugin(db, "full_eq")
    reverb = add_plugin(db, "full_reverb")
    db.add(
        TrackInstrument(track_id=bass.track_id, plugin_id=synth.plugin_id, slot_index=0, params={})
    )
    bass_eq = add_effect(db, bass, eq, slot=0, params={"gain": -3})
    keys_reverb = add_effect(db, keys, reverb, slot=0)
    db.add(
        TrackPluginLink(
            track_id=keys.track_id,
            from_track_plugin_id=None,
            to_track_plugin_id=keys_reverb.track_plugin_id,
        )
    )
    db.flush()

    data = get(client, user, project.project_id)
    by_name = {track["name"]: track for track in data["tracks"]}

    assert [i["plugin_id"] for i in by_name["Bass Synth"]["instruments"]] == [synth.plugin_id]
    assert [e["track_plugin_id"] for e in by_name["Bass Synth"]["effects"]] == [
        bass_eq.track_plugin_id
    ]
    assert by_name["Bass Synth"]["links"] == []
    assert [e["track_plugin_id"] for e in by_name["Keys"]["effects"]] == [
        keys_reverb.track_plugin_id
    ]
    assert by_name["Keys"]["instruments"] == []
    assert len(by_name["Keys"]["links"]) == 1
    assert by_name["Keys"]["links"][0]["to_track_plugin_id"] == keys_reverb.track_plugin_id
    assert by_name["Master"]["effects"] == []


def test_full_without_devices_returns_empty_lists(client, db):
    user = add_user(db, "full_empty")
    project = add_project(db, user)

    data = get(client, user, project.project_id)

    assert [t["name"] for t in data["tracks"]] == ["Master"]
    assert data["patterns"] == []
    assert data["tracks"][0]["instruments"] == []


def test_full_includes_song_settings(client, db):
    user = add_user(db, "full_settings")
    project = add_project(db, user)
    project.bpm = 128
    project.music_key = "Dm"
    project.scale_mode = "minor"
    project.master_settings = {"limiter": True}
    project.revision = 7
    db.flush()

    data = get(client, user, project.project_id)["project"]

    assert float(data["bpm"]) == 128.0
    assert (data["music_key"], data["scale_mode"]) == ("Dm", "minor")
    assert data["master_settings"] == {"limiter": True}
    assert data["revision"] == 7
    assert data["sample_rate"] == 48000


def test_full_viewer_can_read(client, db):
    user = add_user(db, "full_viewer")
    other = add_user(db, "full_viewer_owner")
    project = add_project(db, other)
    db.add(
        ProjectMember(
            project_id=project.project_id, user_id=user.user_id, role=MemberRole.VIEWER
        )
    )
    db.flush()

    data = get(client, user, project.project_id)
    assert data["project"]["my_role"] == "VIEWER"


def test_full_unknown_project_is_404(client, db):
    user = add_user(db, "full_missing")
    assert client.get(FULL_URL.format(999_999_999), headers=auth(user)).status_code == 404


def test_full_of_someone_elses_project_is_404(client, db):
    user = add_user(db, "full_stranger")
    owner = add_user(db, "full_stranger_owner")
    project = add_project(db, owner)

    assert client.get(FULL_URL.format(project.project_id), headers=auth(user)).status_code == 404


def test_full_needs_login(client, db):
    user = add_user(db, "full_nologin")
    project = add_project(db, user)
    assert client.get(FULL_URL.format(project.project_id)).status_code == 401


def test_full_includes_clips_and_connections(client, db):
    user = add_user(db, "full_clips")
    project = add_project(db, user)
    bass = add_track(db, project, "Bass Synth", order_index=1)
    keys = add_track(db, project, "Keys", order_index=2)
    pattern = add_pattern(db, project, "Bass line")
    add_note(db, pattern, pitch=40, start_tick=0)
    clip = add_midi_clip(db, bass, pattern, start_tick=1920)
    add_connection(db, keys, bass)

    data = get(client, user, project.project_id)

    assert len(data["clips"]) == 1
    clip_data = data["clips"][0]
    assert set(clip_data) == CLIP_KEYS
    assert clip_data["clip_id"] == clip.clip_id
    assert clip_data["track_id"] == bass.track_id
    assert (clip_data["clip_type"], clip_data["pattern_id"]) == ("MIDI", pattern.pattern_id)
    assert clip_data["start_tick"] == 1920

    by_name = {t["name"]: t for t in data["tracks"]}
    assert by_name["Bass Synth"]["connections"] == []
    conns = by_name["Keys"]["connections"]
    assert len(conns) == 1
    assert set(conns[0]) == CONNECTION_KEYS
    assert conns[0]["to_track_id"] == bass.track_id
    assert conns[0]["target"] == "PLUGIN"
