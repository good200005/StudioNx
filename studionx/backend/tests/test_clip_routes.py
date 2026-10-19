"""/api/v1 클립(타임라인) 라우터 (S1-10a FR-2196).

MIDI·AUDIO 클립 놓기·고치기·지우기와 검증(종류별로 pattern/sample 을 갖는 규칙),
권한(멤버 조회, OWNER·EDITOR 쓰기, 남의 프로젝트 404)을 확인한다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Pattern, Project, ProjectMember, Sample, Track, User
from app.models.project import MemberRole
from app.models.sample import SampleSource
from app.models.track import TrackType

URL = "/api/v1"
CLIP_KEYS = {
    "clip_id", "track_id", "clip_type", "sample_id", "pattern_id", "name", "start_tick",
    "length_tick", "offset_tick", "gain_db", "is_looped", "fade_in_tick", "fade_out_tick",
    "fade_in_curve", "fade_out_curve", "warp_mode", "warp_markers", "pitch_semitones",
    "is_reversed", "updated_at",
}


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_cl",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-19",
    )
    db.add(user)
    db.flush()
    return user


def add_project(db, owner, title="Clip Song"):
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


def add_track(db, project, name="Bass", order_index=0, track_type=TrackType.MIDI):
    track = Track(
        project_id=project.project_id, name=name, track_type=track_type, order_index=order_index
    )
    db.add(track)
    db.flush()
    return track


def add_pattern(db, project, name="Bass line"):
    pattern = Pattern(project_id=project.project_id, name=name)
    db.add(pattern)
    db.flush()
    return pattern


def add_sample(db, user, name="kick.wav"):
    sample = Sample(
        owner_id=user.user_id,
        name=name,
        original_filename=name,
        file_path=f"samples/{user.user_id}/{name}",
        mime_type="audio/wav",
        file_size=1234,
        source=SampleSource.UPLOAD,
    )
    db.add(sample)
    db.flush()
    return sample


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


def clips_url(track_id):
    return f"{URL}/tracks/{track_id}/clips"


def test_clip_routes_registered():
    paths = app.openapi()["paths"]
    assert set(paths[f"{URL}/tracks/{{track_id}}/clips"]) == {"get", "post"}
    assert set(paths[f"{URL}/clips/{{clip_id}}"]) == {"patch", "delete"}


def test_create_midi_clip_201(client, db):
    user = add_user(db, "cl_create")
    project = add_project(db, user)
    track = add_track(db, project)
    pattern = add_pattern(db, project)

    res = client.post(
        clips_url(track.track_id),
        json={
            "clip_type": "MIDI",
            "pattern_id": pattern.pattern_id,
            "name": "Bass line",
            "start_tick": 1920,
            "length_tick": 3840,
        },
        headers=auth(user),
    )
    assert res.status_code == 201
    data = res.json()
    assert set(data) == CLIP_KEYS
    assert data["clip_type"] == "MIDI"
    assert data["pattern_id"] == pattern.pattern_id
    assert data["sample_id"] is None
    assert data["start_tick"] == 1920
    assert data["warp_mode"] == "BEATS"

    res = client.get(clips_url(track.track_id), headers=auth(user))
    assert res.status_code == 200
    assert [c["clip_id"] for c in res.json()] == [data["clip_id"]]


def test_create_audio_clip_201(client, db):
    user = add_user(db, "cl_audio")
    project = add_project(db, user)
    track = add_track(db, project, "Drums", track_type=TrackType.AUDIO)
    sample = add_sample(db, user)

    res = client.post(
        clips_url(track.track_id),
        json={
            "clip_type": "AUDIO",
            "sample_id": sample.sample_id,
            "start_tick": 0,
            "length_tick": 960,
        },
        headers=auth(user),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["clip_type"] == "AUDIO"
    assert data["sample_id"] == sample.sample_id
    assert data["pattern_id"] is None


def test_create_clip_validates_kind(client, db):
    user = add_user(db, "cl_bad")
    project = add_project(db, user)
    track = add_track(db, project)
    pattern = add_pattern(db, project)

    # MIDI 인데 pattern_id 가 없음
    res = client.post(
        clips_url(track.track_id),
        json={"clip_type": "MIDI", "start_tick": 0, "length_tick": 960},
        headers=auth(user),
    )
    assert res.status_code == 422

    # MIDI 인데 sample_id 까지 있음
    sample = add_sample(db, user)
    res = client.post(
        clips_url(track.track_id),
        json={
            "clip_type": "MIDI",
            "pattern_id": pattern.pattern_id,
            "sample_id": sample.sample_id,
            "start_tick": 0,
            "length_tick": 960,
        },
        headers=auth(user),
    )
    assert res.status_code == 422

    # length_tick 이 0
    res = client.post(
        clips_url(track.track_id),
        json={
            "clip_type": "MIDI",
            "pattern_id": pattern.pattern_id,
            "start_tick": 0,
            "length_tick": 0,
        },
        headers=auth(user),
    )
    assert res.status_code == 422


def test_create_clip_to_other_project_pattern_is_404(client, db):
    user = add_user(db, "cl_otherpat")
    project = add_project(db, user)
    track = add_track(db, project)
    other = add_project(db, user, title="Other Song")
    other_pattern = add_pattern(db, other)

    res = client.post(
        clips_url(track.track_id),
        json={
            "clip_type": "MIDI",
            "pattern_id": other_pattern.pattern_id,
            "start_tick": 0,
            "length_tick": 960,
        },
        headers=auth(user),
    )
    assert res.status_code == 404


def test_create_clip_nonexistent_sample_is_404(client, db):
    user = add_user(db, "cl_nosample")
    project = add_project(db, user)
    track = add_track(db, project)

    res = client.post(
        clips_url(track.track_id),
        json={"clip_type": "AUDIO", "sample_id": 999_999_999, "start_tick": 0, "length_tick": 960},
        headers=auth(user),
    )
    assert res.status_code == 404


def test_patch_clip(client, db):
    user = add_user(db, "cl_patch")
    project = add_project(db, user)
    track = add_track(db, project)
    pattern = add_pattern(db, project)
    clip = client.post(
        clips_url(track.track_id),
        json={
            "clip_type": "MIDI",
            "pattern_id": pattern.pattern_id,
            "start_tick": 0,
            "length_tick": 960,
        },
        headers=auth(user),
    ).json()

    res = client.patch(
        f"{URL}/clips/{clip['clip_id']}",
        json={"start_tick": 3840, "length_tick": 1920, "is_looped": True, "warp_mode": "TONES"},
        headers=auth(user),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["start_tick"] == 3840
    assert data["length_tick"] == 1920
    assert data["is_looped"] is True
    assert data["warp_mode"] == "TONES"


def test_delete_clip(client, db):
    user = add_user(db, "cl_delete")
    project = add_project(db, user)
    track = add_track(db, project)
    pattern = add_pattern(db, project)
    clip = client.post(
        clips_url(track.track_id),
        json={
            "clip_type": "MIDI",
            "pattern_id": pattern.pattern_id,
            "start_tick": 0,
            "length_tick": 960,
        },
        headers=auth(user),
    ).json()

    assert client.delete(f"{URL}/clips/{clip['clip_id']}", headers=auth(user)).status_code == 204
    assert client.patch(
        f"{URL}/clips/{clip['clip_id']}", json={"start_tick": 0}, headers=auth(user)
    ).status_code == 404


def test_viewer_can_read_but_not_write(client, db):
    owner = add_user(db, "cl_owner")
    viewer = add_user(db, "cl_viewer")
    project = add_project(db, owner)
    add_member(db, project, viewer, MemberRole.VIEWER)
    track = add_track(db, project)
    pattern = add_pattern(db, project)

    assert client.get(clips_url(track.track_id), headers=auth(viewer)).status_code == 200

    res = client.post(
        clips_url(track.track_id),
        json={
            "clip_type": "MIDI",
            "pattern_id": pattern.pattern_id,
            "start_tick": 0,
            "length_tick": 960,
        },
        headers=auth(viewer),
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


def test_stranger_gets_404(client, db):
    owner = add_user(db, "cl_owner2")
    project = add_project(db, owner)
    track = add_track(db, project)
    pattern = add_pattern(db, project)
    stranger = add_user(db, "cl_stranger")

    assert client.get(clips_url(track.track_id), headers=auth(stranger)).status_code == 404
    res = client.post(
        clips_url(track.track_id),
        json={
            "clip_type": "MIDI",
            "pattern_id": pattern.pattern_id,
            "start_tick": 0,
            "length_tick": 960,
        },
        headers=auth(stranger),
    )
    assert res.status_code == 404


def test_needs_login(client, db):
    user = add_user(db, "cl_nologin")
    project = add_project(db, user)
    track = add_track(db, project)
    assert client.get(clips_url(track.track_id)).status_code == 401
