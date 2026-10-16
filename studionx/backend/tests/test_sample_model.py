"""samples 모델 컬럼 (models/sample.py Sample, S1-07) — 실제 MySQL 과 비교.

DB 세션(db)과 비교 도구(assert_matches_db)는 conftest.py 에 있다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Sample, SampleSource, User


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_test",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-05",
    )
    db.add(user)
    db.flush()
    return user


def make_sample(owner_id, **overrides):
    data = {
        "owner_id": owner_id,
        "name": "Kick 01",
        "original_filename": "kick01.wav",
        "file_path": "samples/1/abc.wav",
        "mime_type": "audio/wav",
        "file_size": 12345,
    }
    data.update(overrides)
    return Sample(**data)


def test_columns_match_db(assert_matches_db):
    assert_matches_db(Sample)  # 칸 이름 · 순서 · NULL 허용 · owner_id → users FK


def test_defaults_and_null_metadata(db):
    owner = add_user(db, "smp_owner")
    sample = make_sample(owner.user_id)
    db.add(sample)
    db.flush()
    db.refresh(sample)
    assert sample.source is SampleSource.UPLOAD  # DB 기본값
    assert isinstance(sample.created_at, datetime)
    assert sample.deleted_at is None
    assert sample.duration_ms is None
    assert sample.sample_rate is None
    assert sample.channels is None
    assert sample.bpm is None
    assert sample.waveform_path is None


def test_metadata_values_are_saved(db):
    owner = add_user(db, "smp_meta")
    sample = make_sample(
        owner.user_id,
        duration_ms=1500,
        sample_rate=48000,
        channels=2,
        bpm="128.00",
        music_key="Am",
        waveform_path="samples/1/abc.waveform.json",
    )
    db.add(sample)
    db.flush()
    db.refresh(sample)
    assert sample.duration_ms == 1500
    assert sample.sample_rate == 48000
    assert sample.channels == 2
    assert str(sample.bpm) == "128.00"
    assert sample.music_key == "Am"
    assert sample.waveform_path == "samples/1/abc.waveform.json"


def test_soft_delete_keeps_row(db):
    owner = add_user(db, "smp_del")
    sample = make_sample(owner.user_id)
    db.add(sample)
    db.flush()
    sample.deleted_at = datetime.now(UTC).replace(tzinfo=None)
    db.flush()
    db.refresh(sample)
    assert sample.deleted_at is not None


def test_owner_fk_blocks_owner_delete(db):
    owner = add_user(db, "smp_fk")
    db.add(make_sample(owner.user_id))
    db.flush()
    with pytest.raises(IntegrityError):  # FK 에 ON DELETE 가 없어 DB 가 막는다
        db.delete(owner)
        db.flush()
