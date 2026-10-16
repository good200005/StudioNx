"""샘플 저장 서비스 (services/sample_service.py, S1-07 FR-221·131) — 184 save_sample.

시험용 오디오는 메모리에서 만들어 올리고(BytesIO), 저장 위치는 임시 폴더로 바꾼다.
행·사용량은 실제 MySQL(db 픽스처)로 확인한다.
"""

import asyncio
import io
import json
import re
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock

import numpy as np
import pytest
import soundfile as sf
from fastapi import UploadFile
from sqlalchemy import select
from starlette.datastructures import Headers

from app.core.errors import AppError, ErrorCode
from app.models import Sample, SampleSource, User
from app.services import sample_audio_service, sample_service
from app.services.sample_service import save_sample


def add_user(db, name, quota=5 * 1024**3, used=0):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_test",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-05",
        storage_quota_bytes=quota,
        storage_used_bytes=used,
    )
    db.add(user)
    db.flush()
    return user


def audio_bytes(seconds=0.25, samplerate=8000, channels=1, fmt="WAV"):
    """시험용 오디오 파일 내용(바이트)."""
    buffer = io.BytesIO()
    frames = int(round(seconds * samplerate))
    sf.write(buffer, np.zeros((frames, channels), dtype="float32"), samplerate, format=fmt)
    return buffer.getvalue()


def upload(data, filename="kick.wav", content_type="audio/wav"):
    return UploadFile(
        file=io.BytesIO(data), filename=filename, headers=Headers({"content-type": content_type})
    )


def save(db, user, file):
    return asyncio.run(save_sample(db, user, file))


def files_under(storage, folder):
    root = storage / folder
    return sorted(p for p in root.rglob("*") if p.is_file()) if root.exists() else []


def sample_row(db, user):
    return db.scalar(select(Sample).where(Sample.owner_id == user.user_id))


@pytest.fixture
def storage(tmp_path, monkeypatch):
    """저장 위치를 임시 폴더로 바꾼다 (파일 하나 한도는 기본 100MB)."""
    settings = SimpleNamespace(storage_dir=tmp_path, sample_max_bytes=100 * 1024 * 1024)
    monkeypatch.setattr(sample_service, "get_settings", lambda: settings)
    monkeypatch.setattr(sample_audio_service, "get_settings", lambda: settings)
    return tmp_path


@pytest.fixture
def tiny_limit(tmp_path, monkeypatch):
    """파일 하나 한도를 500바이트로 줄인다 (큰 파일 시험용)."""
    settings = SimpleNamespace(storage_dir=tmp_path, sample_max_bytes=500)
    monkeypatch.setattr(sample_service, "get_settings", lambda: settings)
    monkeypatch.setattr(sample_audio_service, "get_settings", lambda: settings)
    return tmp_path


def test_saves_audio_file_and_row(db, storage):
    user = add_user(db, "smp_save")
    data = audio_bytes(seconds=0.25, samplerate=8000)
    sample = save(db, user, upload(data))

    assert re.fullmatch(rf"samples/{user.user_id}/[0-9a-f]{{32}}\.wav", sample.file_path)
    assert (storage / sample.file_path).read_bytes() == data
    assert sample.name == "kick"
    assert sample.original_filename == "kick.wav"
    assert sample.mime_type == "audio/wav"
    assert sample.file_size == len(data)
    assert sample.duration_ms == 250
    assert sample.sample_rate == 8000
    assert sample.channels == 1
    assert sample.source is SampleSource.UPLOAD
    assert sample.deleted_at is None
    assert db.scalar(select(Sample.sample_id).where(Sample.sample_id == sample.sample_id))


def test_adds_to_storage_usage(db, storage):
    user = add_user(db, "smp_usage")
    data = audio_bytes()
    sample = save(db, user, upload(data))

    assert user.storage_used_bytes == len(data)
    in_db = db.scalar(select(User.storage_used_bytes).where(User.user_id == user.user_id))
    assert in_db == len(data)
    assert sample.file_size == len(data)


def test_writes_waveform_file(db, storage):
    user = add_user(db, "smp_wave")
    sample = save(db, user, upload(audio_bytes(seconds=0.25, samplerate=8000)))

    assert re.fullmatch(rf"waveforms/{user.user_id}/[0-9a-f]{{32}}\.json", sample.waveform_path)
    payload = json.loads((storage / sample.waveform_path).read_text(encoding="utf-8"))
    assert payload["sample_rate"] == 8000
    assert payload["channels"] == 1
    assert len(payload["peaks"]) == 1000  # 2000 표본 → 기본 칸 1000


def test_keeps_flac_format(db, storage):
    user = add_user(db, "smp_flac")
    data = audio_bytes(seconds=0.1, fmt="FLAC")
    sample = save(db, user, upload(data, filename="loop.flac", content_type="audio/flac"))

    assert sample.mime_type == "audio/flac"
    assert sample.file_path.endswith(".flac")


def test_extension_is_case_insensitive(db, storage):
    user = add_user(db, "smp_case")
    sample = save(db, user, upload(audio_bytes(), filename="LOOP.WAV"))
    assert sample.mime_type == "audio/wav"
    assert sample.file_path.endswith(".wav")


def test_unsupported_extension_leaves_nothing(db, storage):
    user = add_user(db, "smp_bad_ext")
    with pytest.raises(AppError) as err:
        save(db, user, upload(audio_bytes(), filename="notes.txt"))
    assert err.value.code == ErrorCode.UNSUPPORTED_FILE_TYPE
    assert files_under(storage, "samples") == []
    assert sample_row(db, user) is None
    assert user.storage_used_bytes == 0


def test_unreadable_audio_leaves_nothing(db, storage):
    user = add_user(db, "smp_fake")
    with pytest.raises(AppError) as err:
        save(db, user, upload(b"this is not audio", filename="fake.wav"))
    assert err.value.code == ErrorCode.UNSUPPORTED_FILE_TYPE
    assert files_under(storage, "samples") == []
    assert files_under(storage, "waveforms") == []
    assert sample_row(db, user) is None


def test_too_large_leaves_nothing(db, tiny_limit):
    user = add_user(db, "smp_big")
    with pytest.raises(AppError) as err:
        save(db, user, upload(audio_bytes(seconds=0.5)))
    assert err.value.code == ErrorCode.FILE_TOO_LARGE
    assert err.value.status_code == 413
    assert files_under(tiny_limit, "samples") == []
    assert sample_row(db, user) is None
    assert user.storage_used_bytes == 0


def test_over_quota_leaves_nothing(db, storage):
    user = add_user(db, "smp_quota", quota=1000, used=1000)
    with pytest.raises(AppError) as err:
        save(db, user, upload(audio_bytes(seconds=0.05)))
    assert err.value.code == ErrorCode.STORAGE_QUOTA_EXCEEDED
    assert err.value.status_code == 413
    assert files_under(storage, "samples") == []
    assert sample_row(db, user) is None
    assert user.storage_used_bytes == 1000


def test_rolls_back_when_commit_fails(db, storage, monkeypatch):
    user = add_user(db, "smp_rollback")
    monkeypatch.setattr(db, "commit", Mock(side_effect=RuntimeError("boom")))
    with pytest.raises(RuntimeError):
        save(db, user, upload(audio_bytes()))
    # 파일은 지우고, 행과 사용량은 commit 전이라 남지 않는다 (반쪽 상태 없음)
    assert files_under(storage, "samples") == []
    assert files_under(storage, "waveforms") == []
    assert db.scalar(select(Sample.sample_id).where(Sample.owner_id == user.user_id)) is None


def test_two_uploads_use_different_names(db, storage):
    user = add_user(db, "smp_two")
    first = save(db, user, upload(audio_bytes()))
    second = save(db, user, upload(audio_bytes()))

    assert first.file_path != second.file_path
    assert first.waveform_path != second.waveform_path
    assert user.storage_used_bytes == first.file_size + second.file_size


def test_long_filename_is_trimmed(db, storage):
    user = add_user(db, "smp_long")
    sample = save(db, user, upload(audio_bytes(), filename="a" * 300 + ".wav"))
    assert len(sample.name) == 200
    assert len(sample.original_filename) == 255
