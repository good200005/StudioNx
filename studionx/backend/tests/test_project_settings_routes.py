"""S1-10 곡 설정 저장 — 실제 앱 · 실제 MySQL 로 요청 (FR-253).

시퀀서의 Ctrl+S 수동 저장과 자동 저장이 부르는 `PATCH /api/v1/projects/{id}/settings` 가
바뀐 칸만 저장하고, 보내지 않은 칸은 그대로 두는지 확인한다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Project, ProjectMember, Track, User
from app.models.project import MemberRole
from app.models.track import TrackType

SETTINGS_URL = "/api/v1/projects/{}/settings"


def test_settings_route_registered():
    paths = app.openapi()["paths"]
    assert "patch" in paths["/api/v1/projects/{project_id}/settings"]


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_set",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-18",
    )
    db.add(user)
    db.flush()
    return user


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


def add_project(db, user, role=MemberRole.OWNER, title="Settings Song"):
    project = Project(owner_id=user.user_id, title=title)
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.project_id, user_id=user.user_id, role=role))
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


def test_settings_updates_only_sent_fields(client, db):
    user = add_user(db, "set_partial")
    project = add_project(db, user)

    res = client.patch(
        SETTINGS_URL.format(project.project_id),
        json={"bpm": 140.5, "music_key": "Am"},
        headers=auth(user),
    )

    assert res.status_code == 200
    data = res.json()
    assert float(data["bpm"]) == 140.5
    assert data["music_key"] == "Am"
    assert data["title"] == "Settings Song"  # 보내지 않은 값은 그대로
    assert data["time_sig_num"] == 4
    assert data["sample_rate"] == 48000
    assert data["my_role"] == "OWNER"


def test_settings_saves_scale_master_and_meter(client, db):
    user = add_user(db, "set_master")
    project = add_project(db, user)

    data = client.patch(
        SETTINGS_URL.format(project.project_id),
        json={
            "time_sig_num": 3,
            "time_sig_den": 8,
            "scale_mode": "dorian",
            "sample_rate": 44100,
            "master_settings": {"limiter_ceiling": -1.5},
        },
        headers=auth(user),
    ).json()

    assert (data["time_sig_num"], data["time_sig_den"]) == (3, 8)
    assert data["scale_mode"] == "dorian"
    assert data["sample_rate"] == 44100
    assert data["master_settings"] == {"limiter_ceiling": -1.5}


def test_settings_editor_can_save(client, db):
    user = add_user(db, "set_editor")
    owner = add_user(db, "set_editor_owner")
    project = add_project(db, owner)
    db.add(
        ProjectMember(project_id=project.project_id, user_id=user.user_id, role=MemberRole.EDITOR)
    )
    db.flush()

    res = client.patch(
        SETTINGS_URL.format(project.project_id), json={"bpm": 90}, headers=auth(user)
    )
    assert res.status_code == 200
    assert res.json()["my_role"] == "EDITOR"


def test_settings_viewer_is_403(client, db):
    user = add_user(db, "set_viewer")
    owner = add_user(db, "set_viewer_owner")
    project = add_project(db, owner)
    db.add(
        ProjectMember(project_id=project.project_id, user_id=user.user_id, role=MemberRole.VIEWER)
    )
    db.flush()

    res = client.patch(
        SETTINGS_URL.format(project.project_id), json={"bpm": 90}, headers=auth(user)
    )
    assert res.status_code == 403


def test_settings_stranger_is_404(client, db):
    user = add_user(db, "set_stranger")
    owner = add_user(db, "set_stranger_owner")
    project = add_project(db, owner)

    res = client.patch(
        SETTINGS_URL.format(project.project_id), json={"bpm": 90}, headers=auth(user)
    )
    assert res.status_code == 404


@pytest.mark.parametrize(
    "body",
    [{"bpm": 5}, {"bpm": 400}, {"time_sig_num": 0}, {"sample_rate": 100}],
)
def test_settings_out_of_range_is_422(client, db, body):
    user = add_user(db, f"set_range_{sorted(body)[0]}")
    project = add_project(db, user)

    res = client.patch(SETTINGS_URL.format(project.project_id), json=body, headers=auth(user))
    assert res.status_code == 422
