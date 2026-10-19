"""clips 모델 (S1-10a FR-2196) — 실제 MySQL 과 대조.

칸 이름 · 순서 · NULL 허용 · FK를 실제 테이블과 맞춰 보고(assert_matches_db),
기본값과 트랙을 지울 때의 함께 지우기, 패턴이 클립에 쓰이면 지워지지 않는 것(RESTRICT)을
확인한다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import (
    Clip,
    Pattern,
    Project,
    ProjectMember,
    Sample,
    Track,
    User,
)
from app.models.clip import ClipType, WarpMode
from app.models.project import MemberRole
from app.models.sample import SampleSource
from app.models.track import TrackType


@pytest.fixture
def project(db):
    user = User(
        email="clip_model@example.com",
        password_hash="x",
        nickname="clip_model_owner",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-19",
    )
    db.add(user)
    db.flush()
    project = Project(owner_id=user.user_id, title="Clip Song")
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(project_id=project.project_id, user_id=user.user_id, role=MemberRole.OWNER)
    )
    db.flush()
    return project


def add_track(db, project, name="Bass"):
    track = Track(
        project_id=project.project_id, name=name, track_type=TrackType.MIDI, order_index=0
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


def test_clip_columns_match_db(assert_matches_db):
    assert_matches_db(Clip)


def test_midi_clip_defaults(db, project):
    track = add_track(db, project)
    pattern = add_pattern(db, project)
    clip = Clip(
        track_id=track.track_id,
        clip_type=ClipType.MIDI,
        pattern_id=pattern.pattern_id,
        start_tick=960,
        length_tick=3840,
    )
    db.add(clip)
    db.flush()

    assert clip.clip_id > 0
    assert clip.sample_id is None
    assert clip.name is None
    assert clip.offset_tick == 0
    assert str(clip.gain_db) == "0.00"
    assert clip.is_looped is False
    assert (clip.fade_in_tick, clip.fade_out_tick) == (0, 0)
    assert (str(clip.fade_in_curve), str(clip.fade_out_curve)) == ("0.00", "0.00")
    assert clip.warp_mode == WarpMode.BEATS
    assert clip.warp_markers is None
    assert str(clip.pitch_semitones) == "0.00"
    assert clip.is_reversed is False


def test_audio_clip_defaults(db, project):
    track = add_track(db, project)
    sample = add_sample(db, db.get(User, project.owner_id))
    clip = Clip(
        track_id=track.track_id,
        clip_type=ClipType.AUDIO,
        sample_id=sample.sample_id,
        start_tick=0,
        length_tick=960,
    )
    db.add(clip)
    db.flush()
    assert clip.clip_id > 0
    assert clip.pattern_id is None


def test_deleting_track_deletes_clips(db, project):
    track = add_track(db, project)
    pattern = add_pattern(db, project)
    db.add(
        Clip(
            track_id=track.track_id,
            clip_type=ClipType.MIDI,
            pattern_id=pattern.pattern_id,
            start_tick=0,
            length_tick=3840,
        )
    )
    db.flush()
    count = select(func.count()).select_from(Clip).where(Clip.track_id == track.track_id)
    assert db.scalar(count) == 1

    db.delete(track)  # ON DELETE CASCADE
    db.flush()
    assert db.scalar(count) == 0


def test_pattern_used_by_clip_cannot_be_deleted(db, project):
    track = add_track(db, project)
    pattern = add_pattern(db, project)
    db.add(
        Clip(
            track_id=track.track_id,
            clip_type=ClipType.MIDI,
            pattern_id=pattern.pattern_id,
            start_tick=0,
            length_tick=3840,
        )
    )
    db.flush()

    db.delete(pattern)
    with pytest.raises(IntegrityError):  # RESTRICT — 클립이 가리키는 패턴은 못 지운다
        db.flush()
    db.rollback()
