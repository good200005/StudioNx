"""/api/v1/patterns 라우터 (S1-08 FR-231~233) — 연결 확인(DB 없이) + 실제 앱 · MySQL 요청.

권한(멤버만 404, VIEWER 저장 403), 노트 통째 교체, 입력값 검증(422)을 확인한다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import MidiNote, Pattern, Project, ProjectMember, User
from app.models.project import MemberRole

URL = "/api/v1/patterns"
DATA_KEYS = {
    "pattern_id", "project_id", "name", "color", "length_tick", "swing", "updated_at", "notes",
}
NOTE_KEYS = {
    "note_id", "pitch", "velocity", "start_tick", "length_tick", "channel",
    "release_velocity", "is_muted", "probability", "velocity_deviation",
}


def test_pattern_routes_registered():
    paths = app.openapi()["paths"]
    assert "get" in paths[URL]
    assert "get" in paths[URL + "/{pattern_id}"]
    assert "put" in paths[URL + "/{pattern_id}/notes"]
    assert "patch" in paths[URL + "/{pattern_id}"]


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_pr",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-17",
    )
    db.add(user)
    db.flush()
    return user


def add_project(db, owner, role=MemberRole.OWNER, member=None):
    project = Project(owner_id=owner.user_id, title="Wired Song")
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(project_id=project.project_id, user_id=owner.user_id, role=MemberRole.OWNER)
    )
    if member is not None:
        db.add(ProjectMember(project_id=project.project_id, user_id=member.user_id, role=role))
    db.flush()
    return project


def add_pattern(db, project, name="Bass"):
    pattern = Pattern(project_id=project.project_id, name=name)
    db.add(pattern)
    db.flush()
    return pattern


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_list_patterns(client, db):
    user = add_user(db, "pr_list")
    project = add_project(db, user)
    add_pattern(db, project, "Bass")
    add_pattern(db, project, "Lead")

    res = client.get(URL, params={"project_id": project.project_id}, headers=auth(user))

    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert set(data["items"][0]) == DATA_KEYS
    assert data["items"][0]["name"] == "Bass"
    assert data["items"][0]["notes"] == []  # 목록은 노트를 담지 않는다


def test_get_pattern_with_notes(client, db):
    user = add_user(db, "pr_get")
    project = add_project(db, user)
    pattern = add_pattern(db, project)
    db.add(
        MidiNote(
            pattern_id=pattern.pattern_id, pitch=64, start_tick=960, length_tick=240, velocity=90
        )
    )
    db.add(MidiNote(pattern_id=pattern.pattern_id, pitch=60, start_tick=0, length_tick=480))
    db.flush()

    res = client.get(f"{URL}/{pattern.pattern_id}", headers=auth(user))

    assert res.status_code == 200
    data = res.json()
    assert data["pattern_id"] == pattern.pattern_id
    assert data["name"] == "Bass"
    assert len(data["notes"]) == 2
    assert set(data["notes"][0]) == NOTE_KEYS
    # 시작 위치 순으로 정렬
    assert [(n["start_tick"], n["pitch"]) for n in data["notes"]] == [(0, 60), (960, 64)]
    assert data["notes"][1]["velocity"] == 90


def test_replace_notes(client, db):
    user = add_user(db, "pr_put")
    project = add_project(db, user)
    pattern = add_pattern(db, project)
    db.add(MidiNote(pattern_id=pattern.pattern_id, pitch=1, start_tick=0, length_tick=10))
    db.flush()

    body = {"notes": [
        {"pitch": 60, "start_tick": 0, "length_tick": 480},
        {"pitch": 62, "start_tick": 480, "length_tick": 240, "velocity": 111},
    ]}
    res = client.put(f"{URL}/{pattern.pattern_id}/notes", json=body, headers=auth(user))

    assert res.status_code == 200
    notes = res.json()["notes"]
    assert len(notes) == 2  # 옛 노트는 사라지고 보낸 것으로 교체
    assert [n["pitch"] for n in notes] == [60, 62]
    assert notes[1]["velocity"] == 111

    # 빈 목록 → 모두 지움
    res = client.put(f"{URL}/{pattern.pattern_id}/notes", json={"notes": []}, headers=auth(user))
    assert res.status_code == 200
    assert res.json()["notes"] == []


def test_replace_notes_validates_pitch(client, db):
    user = add_user(db, "pr_bad")
    project = add_project(db, user)
    pattern = add_pattern(db, project)

    body = {"notes": [{"pitch": 200, "start_tick": 0, "length_tick": 480}]}
    res = client.put(f"{URL}/{pattern.pattern_id}/notes", json=body, headers=auth(user))

    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_non_member_gets_404(client, db):
    owner = add_user(db, "pr_owner")
    project = add_project(db, owner)
    pattern = add_pattern(db, project)
    stranger = add_user(db, "pr_stranger")

    res = client.get(f"{URL}/{pattern.pattern_id}", headers=auth(stranger))

    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_viewer_cannot_save_notes(client, db):
    owner = add_user(db, "pr_owner2")
    viewer = add_user(db, "pr_viewer")
    project = add_project(db, owner, role=MemberRole.VIEWER, member=viewer)
    pattern = add_pattern(db, project)

    res = client.put(
        f"{URL}/{pattern.pattern_id}/notes",
        json={"notes": [{"pitch": 60, "start_tick": 0, "length_tick": 480}]},
        headers=auth(viewer),
    )

    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


def test_patch_pattern(client, db):
    user = add_user(db, "pr_patch")
    project = add_project(db, user)
    pattern = add_pattern(db, project)

    res = client.patch(
        f"{URL}/{pattern.pattern_id}",
        json={"name": "Lead", "swing": 0.25, "length_tick": 7680},
        headers=auth(user),
    )

    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Lead"
    assert str(data["swing"]) == "0.25"
    assert data["length_tick"] == 7680
