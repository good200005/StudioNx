"""/api/v1/samples 라우터 (S1-07 FR-221) — 연결 확인(DB 없이) + 실제 앱 · MySQL 요청.

저장 위치는 임시 폴더로 바꾸고, 행·사용량은 실제 MySQL 로 확인한다(끝나면 rollback).
"""

import io
import re
from datetime import UTC, datetime
from types import SimpleNamespace

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Sample, SampleTag, Tag, User
from app.services import sample_audio_service, sample_service

URL = "/api/v1/samples"
ITEM_KEYS = {
    "sample_id", "name", "original_filename", "file_size", "mime_type",
    "duration_ms", "sample_rate", "channels", "bpm", "music_key", "source", "created_at", "tags",
}


def test_sample_routes_registered():
    paths = app.openapi()["paths"]
    assert "post" in paths[URL]


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_sr",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-15",
        storage_quota_bytes=5 * 1024**3,
        storage_used_bytes=0,
    )
    db.add(user)
    db.flush()
    return user


def audio_bytes(seconds=0.25, samplerate=8000, fmt="WAV"):
    buffer = io.BytesIO()
    frames = int(round(seconds * samplerate))
    sf.write(buffer, np.zeros((frames, 1), dtype="float32"), samplerate, format=fmt)
    return buffer.getvalue()


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


@pytest.fixture
def client(db, tmp_path, monkeypatch):
    app.dependency_overrides[get_db] = lambda: db
    settings = SimpleNamespace(storage_dir=tmp_path, sample_max_bytes=100 * 1024 * 1024)
    monkeypatch.setattr(sample_service, "get_settings", lambda: settings)
    monkeypatch.setattr(sample_audio_service, "get_settings", lambda: settings)
    yield TestClient(app)
    app.dependency_overrides.clear()


def upload(client, user, data=None, filename="kick.wav", content_type="audio/wav"):
    data = audio_bytes() if data is None else data
    return client.post(
        URL, files={"file": (filename, data, content_type)}, headers=auth(user)
    )


def test_upload_returns_201_sample(client, db):
    user = add_user(db, "sr_upload")
    res = upload(client, user)

    assert res.status_code == 201
    data = res.json()
    assert set(data) == ITEM_KEYS
    assert data["name"] == "kick"
    assert data["original_filename"] == "kick.wav"
    assert data["mime_type"] == "audio/wav"
    assert data["duration_ms"] == 250
    assert data["sample_rate"] == 8000
    assert data["channels"] == 1
    assert data["source"] == "UPLOAD"
    assert data["bpm"] is None
    row = db.get(Sample, data["sample_id"])
    assert row.owner_id == user.user_id
    assert row.file_size == data["file_size"]


def test_upload_requires_login_401(client):
    assert client.post(URL, files={"file": ("a.wav", b"x", "audio/wav")}).status_code == 401


def test_upload_without_file_422(client, db):
    user = add_user(db, "sr_nofile")
    assert client.post(URL, headers=auth(user)).status_code == 422


def test_upload_unsupported_415(client, db):
    user = add_user(db, "sr_415")
    res = upload(client, user, filename="notes.txt")
    assert res.status_code == 415
    assert res.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"


def test_upload_over_quota_413(client, db):
    user = add_user(db, "sr_quota")
    user.storage_used_bytes = user.storage_quota_bytes  # 이미 한도까지 씀
    db.flush()
    res = upload(client, user)
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "STORAGE_QUOTA_EXCEEDED"


def test_upload_too_large_413(client, db, tmp_path, monkeypatch):
    user = add_user(db, "sr_big")
    settings = SimpleNamespace(storage_dir=tmp_path, sample_max_bytes=500)
    monkeypatch.setattr(sample_service, "get_settings", lambda: settings)
    monkeypatch.setattr(sample_audio_service, "get_settings", lambda: settings)
    res = upload(client, user, data=audio_bytes(seconds=0.5))
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_upload_file_name_is_random(client, db):
    user = add_user(db, "sr_name")
    res = upload(client, user)
    assert res.status_code == 201
    row = db.get(Sample, res.json()["sample_id"])
    assert re.fullmatch(rf"samples/{user.user_id}/[0-9a-f]{{32}}\.wav", row.file_path)


# ── 186 GET /samples 목록 ──


def make_sample(db, owner_id, name, **overrides):
    """시험용 샘플 행 — 업로드를 거치지 않고 바로 넣는다 (오디오 파일이 필요 없다)."""
    data = {
        "owner_id": owner_id,
        "name": name,
        "original_filename": f"{name}.wav",
        "file_path": f"samples/{owner_id}/{'a' * 32}.wav",
        "mime_type": "audio/wav",
        "file_size": 1234,
    }
    data.update(overrides)
    sample = Sample(**data)
    db.add(sample)
    db.flush()
    return sample


def add_tag(db, name, category="INSTRUMENT"):
    tag = Tag(name=name, category=category)
    db.add(tag)
    db.flush()
    return tag


def attach(db, sample, tag):
    db.add(SampleTag(sample_id=sample.sample_id, tag_id=tag.tag_id))
    db.flush()


def names(data):
    return [item["name"] for item in data["items"]]


def test_list_returns_my_newest_first(client, db):
    owner = add_user(db, "sr_list")
    other = add_user(db, "sr_other")
    make_sample(db, owner.user_id, "Old")
    make_sample(db, owner.user_id, "New")
    make_sample(db, other.user_id, "Not mine")

    res = client.get(URL, headers=auth(owner))
    assert res.status_code == 200
    data = res.json()
    assert (data["total"], data["page"], data["size"]) == (2, 1, 10)
    assert names(data) == ["New", "Old"]


def test_list_requires_login(client):
    assert client.get(URL).status_code == 401


def test_list_search(client, db):
    user = add_user(db, "sr_search")
    make_sample(db, user.user_id, "Kick 01")
    make_sample(db, user.user_id, "Snare")
    make_sample(db, user.user_id, "100%")

    assert names(client.get(URL, params={"query": "kic"}, headers=auth(user)).json()) == ["Kick 01"]
    assert names(client.get(URL, params={"query": "SNARE"}, headers=auth(user)).json()) == ["Snare"]
    assert names(client.get(URL, params={"query": "100%"}, headers=auth(user)).json()) == ["100%"]


def test_list_tag_filter(client, db):
    user = add_user(db, "sr_tag")
    tagged = make_sample(db, user.user_id, "With tag")
    make_sample(db, user.user_id, "No tag")
    kick = add_tag(db, "Kick")
    attach(db, tagged, kick)

    data = client.get(URL, params={"tag": kick.tag_id}, headers=auth(user)).json()
    assert names(data) == ["With tag"]

    empty = client.get(URL, params={"tag": kick.tag_id + 1000}, headers=auth(user)).json()
    assert empty["items"] == []
    assert empty["total"] == 0


def test_list_includes_tags(client, db):
    user = add_user(db, "sr_tags")
    sample = make_sample(db, user.user_id, "Tagged")
    kick = add_tag(db, "Kick")
    jazz = add_tag(db, "Jazz", category="GENRE")
    attach(db, sample, jazz)
    attach(db, sample, kick)

    item = client.get(URL, headers=auth(user)).json()["items"][0]
    assert [tag["name"] for tag in item["tags"]] == ["Kick", "Jazz"]  # 태그 번호 순서
    assert item["tags"][1] == {"tag_id": jazz.tag_id, "name": "Jazz", "category": "GENRE"}


def test_list_search_and_tag_together(client, db):
    user = add_user(db, "sr_both")
    kick = add_tag(db, "Kick")
    keep = make_sample(db, user.user_id, "Kick Big")
    attach(db, keep, kick)
    drop = make_sample(db, user.user_id, "Kick Small")
    attach(db, drop, add_tag(db, "Snare"))

    data = client.get(URL, params={"query": "Kick", "tag": kick.tag_id}, headers=auth(user)).json()
    assert names(data) == ["Kick Big"]


def test_list_page(client, db):
    user = add_user(db, "sr_page")
    for index in range(3):
        make_sample(db, user.user_id, f"S{index}")

    page_one = client.get(URL, params={"size": 2, "page": 1}, headers=auth(user)).json()
    page_two = client.get(URL, params={"size": 2, "page": 2}, headers=auth(user)).json()
    assert (len(page_one["items"]), page_one["total"]) == (2, 3)
    assert (len(page_two["items"]), page_two["total"]) == (1, 3)


def test_list_hides_deleted(client, db):
    user = add_user(db, "sr_del")
    sample = make_sample(db, user.user_id, "Gone")
    sample.deleted_at = datetime.now(UTC).replace(tzinfo=None)
    db.flush()

    assert client.get(URL, headers=auth(user)).json()["items"] == []


def test_list_size_limit_422(client, db):
    user = add_user(db, "sr_size")
    res = client.get(URL, params={"size": 1000}, headers=auth(user))
    assert res.status_code == 422


# ── 187 GET /samples/{id}/file ──


def uploaded(client, user, **kwargs):
    res = upload(client, user, **kwargs)
    assert res.status_code == 201
    return res.json()


def test_file_returns_audio(client, db):
    user = add_user(db, "sr_file")
    data = audio_bytes()
    item = uploaded(client, user, data=data)

    res = client.get(f"{URL}/{item['sample_id']}/file", headers=auth(user))
    assert res.status_code == 200
    assert res.content == data
    assert res.headers["content-type"] == "audio/wav"
    assert res.headers["cache-control"] == "private, no-cache"
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["etag"]


def test_file_requires_login_401(client, db):
    user = add_user(db, "sr_file401")
    item = uploaded(client, user)
    assert client.get(f"{URL}/{item['sample_id']}/file").status_code == 401


def test_file_other_user_404(client, db):
    owner = add_user(db, "sr_file_owner")
    stranger = add_user(db, "sr_file_stranger")
    item = uploaded(client, owner)

    res = client.get(f"{URL}/{item['sample_id']}/file", headers=auth(stranger))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_file_missing_id_and_deleted_404(client, db):
    user = add_user(db, "sr_file_del")
    item = uploaded(client, user)

    assert client.get(f"{URL}/999999999/file", headers=auth(user)).status_code == 404

    row = db.get(Sample, item["sample_id"])
    row.deleted_at = datetime.now(UTC).replace(tzinfo=None)
    db.flush()
    assert client.get(f"{URL}/{item['sample_id']}/file", headers=auth(user)).status_code == 404


def test_file_missing_on_disk_404(client, db):
    user = add_user(db, "sr_file_gone")
    sample = make_sample(db, user.user_id, "Ghost")  # 행만 만들고 파일은 없음

    assert client.get(f"{URL}/{sample.sample_id}/file", headers=auth(user)).status_code == 404


def test_file_etag_304(client, db):
    user = add_user(db, "sr_etag")
    item = uploaded(client, user)
    path = f"{URL}/{item['sample_id']}/file"

    first = client.get(path, headers=auth(user))
    etag = first.headers["etag"]
    second = client.get(path, headers={**auth(user), "If-None-Match": etag})
    assert second.status_code == 304
    assert second.content == b""


def test_file_range_request_206(client, db):
    user = add_user(db, "sr_range")
    data = audio_bytes()
    item = uploaded(client, user, data=data)

    res = client.get(
        f"{URL}/{item['sample_id']}/file",
        headers={**auth(user), "Range": "bytes=0-9"},
    )
    assert res.status_code == 206
    assert res.content == data[:10]
    assert res.headers["content-range"] == f"bytes 0-9/{len(data)}"


# ── 188 GET /samples/{id}/waveform ──


def waveform_url(item):
    return f"{URL}/{item['sample_id']}/waveform"


def test_waveform_returns_peaks(client, db):
    user = add_user(db, "sr_wave")
    item = uploaded(client, user, data=audio_bytes(seconds=0.25, samplerate=8000))

    res = client.get(waveform_url(item), headers=auth(user))
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/json")
    payload = res.json()
    assert payload["version"] == 1
    assert payload["sample_rate"] == 8000
    assert payload["channels"] == 1
    assert len(payload["peaks"]) == 1000  # 2000 표본 → 기본 칸 1000
    assert all(len(pair) == 2 for pair in payload["peaks"])


def test_waveform_requires_login_401(client, db):
    user = add_user(db, "sr_wave401")
    item = uploaded(client, user)
    assert client.get(waveform_url(item)).status_code == 401


def test_waveform_other_user_404(client, db):
    owner = add_user(db, "sr_wave_owner")
    stranger = add_user(db, "sr_wave_stranger")
    item = uploaded(client, owner)

    res = client.get(waveform_url(item), headers=auth(stranger))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_waveform_missing_404(client, db):
    user = add_user(db, "sr_wave_missing")
    sample = make_sample(db, user.user_id, "No wave")  # waveform_path 가 비어 있음

    res = client.get(f"{URL}/{sample.sample_id}/waveform", headers=auth(user))
    assert res.status_code == 404
    assert res.json()["error"]["message"] == "Waveform not found."


def test_waveform_file_missing_on_disk_404(client, db):
    user = add_user(db, "sr_wave_disk")
    sample = make_sample(db, user.user_id, "Path only", waveform_path="waveforms/1/none.json")

    assert client.get(f"{URL}/{sample.sample_id}/waveform", headers=auth(user)).status_code == 404


def test_waveform_etag_304(client, db):
    user = add_user(db, "sr_wave_etag")
    item = uploaded(client, user)

    first = client.get(waveform_url(item), headers=auth(user))
    etag = first.headers["etag"]
    second = client.get(waveform_url(item), headers={**auth(user), "If-None-Match": etag})
    assert second.status_code == 304
    assert second.content == b""


# ── 189 PATCH /samples/{id} 이름 변경 ──


def test_rename_returns_200_and_changes(client, db):
    user = add_user(db, "sr_rename")
    item = uploaded(client, user, filename="old.wav")

    res = client.patch(
        f"{URL}/{item['sample_id']}", json={"name": "  New Kick  "}, headers=auth(user)
    )
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "New Kick"  # 앞뒤 공백은 지워짐
    assert set(body) == ITEM_KEYS
    assert db.get(Sample, item["sample_id"]).name == "New Kick"


def test_rename_keeps_tags(client, db):
    user = add_user(db, "sr_rename_tags")
    item = uploaded(client, user)
    sample = db.get(Sample, item["sample_id"])
    attach(db, sample, add_tag(db, "KickTag"))

    res = client.patch(
        f"{URL}/{item['sample_id']}", json={"name": "Renamed"}, headers=auth(user)
    )
    assert res.status_code == 200
    assert [tag["name"] for tag in res.json()["tags"]] == ["KickTag"]


def test_rename_requires_login_401(client, db):
    user = add_user(db, "sr_rename401")
    item = uploaded(client, user)
    res = client.patch(f"{URL}/{item['sample_id']}", json={"name": "X"})
    assert res.status_code == 401


def test_rename_other_user_404(client, db):
    owner = add_user(db, "sr_rename_owner")
    stranger = add_user(db, "sr_rename_stranger")
    item = uploaded(client, owner)

    res = client.patch(
        f"{URL}/{item['sample_id']}", json={"name": "Mine"}, headers=auth(stranger)
    )
    assert res.status_code == 404
    assert db.get(Sample, item["sample_id"]).name != "Mine"


def test_rename_unknown_or_deleted_404(client, db):
    user = add_user(db, "sr_rename_404")
    item = uploaded(client, user)

    assert (
        client.patch(f"{URL}/999999999", json={"name": "X"}, headers=auth(user)).status_code
        == 404
    )

    row = db.get(Sample, item["sample_id"])
    row.deleted_at = datetime.now(UTC).replace(tzinfo=None)
    db.flush()
    assert (
        client.patch(
            f"{URL}/{item['sample_id']}", json={"name": "X"}, headers=auth(user)
        ).status_code
        == 404
    )


@pytest.mark.parametrize(
    "payload",
    [{"name": None}, {"name": ""}, {"name": "   "}, {"name": "x" * 201}],
)
def test_rename_bad_name_422(client, db, payload):
    user = add_user(db, "sr_rename_422")
    item = uploaded(client, user)

    res = client.patch(f"{URL}/{item['sample_id']}", json=payload, headers=auth(user))
    assert res.status_code == 422
    assert db.get(Sample, item["sample_id"]).name != payload.get("name")


# ── 190 PUT /samples/{id}/tags 태그 설정 ──


def tag_ids_of(db, sample_id):
    return sorted(
        db.scalars(select(SampleTag.tag_id).where(SampleTag.sample_id == sample_id)).all()
    )


def test_set_tags_returns_them(client, db):
    user = add_user(db, "sr_tags")
    item = uploaded(client, user)
    rock = add_tag(db, "RockTag")
    drum = add_tag(db, "DrumTag")

    res = client.put(
        f"{URL}/{item['sample_id']}/tags",
        json={"tag_ids": [rock.tag_id, drum.tag_id]},
        headers=auth(user),
    )
    assert res.status_code == 200
    assert sorted(tag["name"] for tag in res.json()["tags"]) == ["DrumTag", "RockTag"]
    assert tag_ids_of(db, item["sample_id"]) == sorted([rock.tag_id, drum.tag_id])


def test_set_tags_replaces_existing(client, db):
    user = add_user(db, "sr_tags_replace")
    item = uploaded(client, user)
    old = add_tag(db, "OldTag")
    new = add_tag(db, "NewTag")
    attach(db, db.get(Sample, item["sample_id"]), old)

    res = client.put(
        f"{URL}/{item['sample_id']}/tags",
        json={"tag_ids": [new.tag_id]},
        headers=auth(user),
    )
    assert res.status_code == 200
    assert [tag["name"] for tag in res.json()["tags"]] == ["NewTag"]
    assert tag_ids_of(db, item["sample_id"]) == [new.tag_id]


def test_set_tags_empty_clears(client, db):
    user = add_user(db, "sr_tags_clear")
    item = uploaded(client, user)
    attach(db, db.get(Sample, item["sample_id"]), add_tag(db, "GoneTag"))

    res = client.put(f"{URL}/{item['sample_id']}/tags", json={"tag_ids": []}, headers=auth(user))
    assert res.status_code == 200
    assert res.json()["tags"] == []
    assert tag_ids_of(db, item["sample_id"]) == []


def test_set_tags_dedupes(client, db):
    user = add_user(db, "sr_tags_dup")
    item = uploaded(client, user)
    tag = add_tag(db, "OnceTag")

    res = client.put(
        f"{URL}/{item['sample_id']}/tags",
        json={"tag_ids": [tag.tag_id, tag.tag_id]},
        headers=auth(user),
    )
    assert res.status_code == 200
    assert [t["name"] for t in res.json()["tags"]] == ["OnceTag"]
    assert tag_ids_of(db, item["sample_id"]) == [tag.tag_id]


def test_set_tags_unknown_422_no_change(client, db):
    user = add_user(db, "sr_tags_unknown")
    item = uploaded(client, user)
    keep = add_tag(db, "KeepTag")
    attach(db, db.get(Sample, item["sample_id"]), keep)

    res = client.put(
        f"{URL}/{item['sample_id']}/tags",
        json={"tag_ids": [keep.tag_id, 999999999]},
        headers=auth(user),
    )
    assert res.status_code == 422
    assert res.json()["error"]["details"]["tag_ids"] == [999999999]
    assert tag_ids_of(db, item["sample_id"]) == [keep.tag_id]  # 그대로


def test_set_tags_bad_id_422(client, db):
    user = add_user(db, "sr_tags_badid")
    item = uploaded(client, user)
    res = client.put(
        f"{URL}/{item['sample_id']}/tags", json={"tag_ids": [0]}, headers=auth(user)
    )
    assert res.status_code == 422


def test_set_tags_requires_login_401(client, db):
    user = add_user(db, "sr_tags401")
    item = uploaded(client, user)
    res = client.put(f"{URL}/{item['sample_id']}/tags", json={"tag_ids": []})
    assert res.status_code == 401


def test_set_tags_other_user_404(client, db):
    owner = add_user(db, "sr_tags_owner")
    stranger = add_user(db, "sr_tags_stranger")
    item = uploaded(client, owner)

    res = client.put(
        f"{URL}/{item['sample_id']}/tags", json={"tag_ids": []}, headers=auth(stranger)
    )
    assert res.status_code == 404


# ── 191 DELETE /samples/{id} 소프트 삭제 ──


def test_delete_returns_204_and_frees_storage(client, db):
    user = add_user(db, "sr_delete")
    item = uploaded(client, user)
    used = user.storage_used_bytes
    assert used == item["file_size"]

    res = client.delete(f"{URL}/{item['sample_id']}", headers=auth(user))
    assert res.status_code == 204
    assert res.content == b""

    row = db.get(Sample, item["sample_id"])
    assert row.deleted_at is not None
    assert user.storage_used_bytes == 0


def test_delete_removes_from_list_and_reads(client, db):
    user = add_user(db, "sr_delete_hide")
    item = uploaded(client, user)

    assert client.delete(f"{URL}/{item['sample_id']}", headers=auth(user)).status_code == 204
    assert client.get(f"{URL}/{item['sample_id']}/file", headers=auth(user)).status_code == 404
    assert client.get(f"{URL}/{item['sample_id']}/waveform", headers=auth(user)).status_code == 404
    assert client.get(URL, headers=auth(user)).json()["items"] == []


def test_delete_twice_404(client, db):
    user = add_user(db, "sr_delete_twice")
    item = uploaded(client, user)

    assert client.delete(f"{URL}/{item['sample_id']}", headers=auth(user)).status_code == 204
    res = client.delete(f"{URL}/{item['sample_id']}", headers=auth(user))
    assert res.status_code == 404
    assert user.storage_used_bytes == 0  # 두 번째는 용량을 또 빼지 않음


def test_delete_requires_login_401(client, db):
    user = add_user(db, "sr_delete401")
    item = uploaded(client, user)
    assert client.delete(f"{URL}/{item['sample_id']}").status_code == 401


def test_delete_other_user_404(client, db):
    owner = add_user(db, "sr_delete_owner")
    stranger = add_user(db, "sr_delete_stranger")
    item = uploaded(client, owner)

    assert client.delete(f"{URL}/{item['sample_id']}", headers=auth(stranger)).status_code == 404
    assert db.get(Sample, item["sample_id"]).deleted_at is None  # 안 지워짐


def test_delete_unknown_404(client, db):
    user = add_user(db, "sr_delete_unknown")
    assert client.delete(f"{URL}/999999999", headers=auth(user)).status_code == 404
