"""샘플 오디오 읽기 서비스 (services/sample_audio_service.py, S1-07 FR-223).

시험용 파일은 임시 폴더(tmp_path)에 만든다. 이 함수는 파일 헤더만 읽는 순수
함수라 DB(실제 MySQL)는 쓰지 않는다. 함수를 하나 구현할 때마다 시험을 더한다.
"""

import json
import re
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import pytest
import soundfile as sf

from app.core.errors import AppError, ErrorCode
from app.models import User
from app.services import sample_audio_service
from app.services.sample_audio_service import (
    DEFAULT_BUCKETS,
    AudioInfo,
    Waveform,
    check_upload,
    compute_waveform,
    read_audio_info,
    write_waveform,
)

# ── 180 read_audio_info ──

#: 허용할 지원 형식 (PRD 02 FR-222) — 이 함수 자체는 형식 검사를 하지 않는다
SUPPORTED = ["WAV", "MP3", "FLAC", "OGG", "AIFF"]


def write_audio(
    path: Path,
    seconds: float = 1.0,
    samplerate: int = 44100,
    channels: int = 1,
    fmt: str | None = None,
) -> Path:
    """시험용 오디오 파일을 만든다 (샘플 값은 0 — 소리가 없어도 길이는 같다)."""
    frames = int(round(seconds * samplerate))
    data = np.zeros((frames, channels), dtype="float32")
    sf.write(path, data, samplerate, format=fmt)
    return path


def test_reads_duration_rate_channels(tmp_path):
    path = write_audio(tmp_path / "a.wav", seconds=1.0, samplerate=44100, channels=1)
    info = read_audio_info(path)
    assert info == AudioInfo(duration_ms=1000, sample_rate=44100, channels=1)


def test_stereo_and_half_second(tmp_path):
    path = write_audio(tmp_path / "b.wav", seconds=0.5, samplerate=48000, channels=2)
    info = read_audio_info(path)
    assert (info.duration_ms, info.sample_rate, info.channels) == (500, 48000, 2)


def test_duration_rounds_to_nearest_ms(tmp_path):
    # 10006 표본 / 8000Hz = 1250.75ms → 반올림하여 1251ms
    path = write_audio(tmp_path / "c.wav", seconds=10006 / 8000, samplerate=8000)
    assert read_audio_info(path).duration_ms == 1251


def test_accepts_str_path(tmp_path):
    path = write_audio(tmp_path / "d.wav")
    assert read_audio_info(str(path)).duration_ms == 1000


def test_returns_frozen_dataclass(tmp_path):
    info = read_audio_info(write_audio(tmp_path / "e.wav"))
    assert isinstance(info, AudioInfo)
    assert (info.duration_ms, info.sample_rate, info.channels) == (1000, 44100, 1)
    try:
        info.duration_ms = 5  # frozen dataclass 는 값을 못 바꾼다
    except AttributeError:
        pass
    else:
        raise AssertionError("AudioInfo 는 값이 바뀌면 안 된다")


def test_reads_every_supported_format(tmp_path):
    # FR-222 지원 형식 5가지 모두 헤더를 읽는다
    for fmt in SUPPORTED:
        path = write_audio(tmp_path / f"t.{fmt.lower()}", fmt=fmt)
        info = read_audio_info(path)
        assert (info.sample_rate, info.channels) == (44100, 1), fmt


def test_au_format_is_still_readable_here(tmp_path):
    # AU 는 지원 목록 밖이지만 libsndfile 는 열 수 있다.
    # 형식 목록 검사는 다음 함수(허용 형식 확인)가 맡는다.
    path = write_audio(tmp_path / "t.au", fmt="AU")
    assert read_audio_info(path).sample_rate == 44100


def test_missing_file_404(tmp_path):
    try:
        read_audio_info(tmp_path / "nope.wav")
    except AppError as exc:
        assert exc.code == ErrorCode.NOT_FOUND
        assert exc.status_code == 404
    else:
        raise AssertionError("없는 파일은 404 여야 한다")


def test_directory_is_404(tmp_path):
    try:
        read_audio_info(tmp_path)
    except AppError as exc:
        assert (exc.code, exc.status_code) == (ErrorCode.NOT_FOUND, 404)
    else:
        raise AssertionError("폴더는 404 여야 한다")


def test_not_audio_415(tmp_path):
    path = tmp_path / "note.txt"
    path.write_text("이 파일은 오디오가 아닙니다", encoding="utf-8")
    try:
        read_audio_info(path)
    except AppError as exc:
        assert (exc.code, exc.status_code) == (ErrorCode.UNSUPPORTED_FILE_TYPE, 415)
        assert "WAV" in exc.message
    else:
        raise AssertionError("오디오가 아닌 파일은 415 여야 한다")


def test_empty_file_415(tmp_path):
    path = tmp_path / "empty.wav"
    path.write_bytes(b"")
    try:
        read_audio_info(path)
    except AppError as exc:
        assert (exc.code, exc.status_code) == (ErrorCode.UNSUPPORTED_FILE_TYPE, 415)
    else:
        raise AssertionError("빈 파일은 415 여야 한다")


def test_zero_sample_rate_400(tmp_path):
    # sf.info 를 가짜로 바꿔 깨진 헤더(샘플레이트 0)를 흉내낸다
    path = tmp_path / "broken.wav"
    path.write_bytes(b"RIFF")
    fake = SimpleNamespace(frames=100, samplerate=0, channels=1)
    with patch("app.services.sample_audio_service.sf.info", return_value=fake):
        try:
            read_audio_info(path)
        except AppError as exc:
            assert (exc.code, exc.status_code) == (ErrorCode.BAD_REQUEST, 400)
        else:
            raise AssertionError("샘플레이트 0 은 400 이어야 한다")


def test_does_not_modify_the_file(tmp_path):
    path = write_audio(tmp_path / "keep.wav")
    before = path.read_bytes()
    read_audio_info(path)
    assert path.read_bytes() == before


# ── 181 compute_waveform ──


def write_signal(
    path: Path, data, samplerate: int = 44100, subtype: str | None = None
) -> Path:
    """값을 직접 넣어 시험용 파일을 만든다 (data 는 1차원 또는 2차원)."""
    array = np.asarray(data, dtype="float32")
    if array.ndim == 1:
        array = array.reshape(-1, 1)
    sf.write(path, array, samplerate, subtype=subtype)
    return path


def test_waveform_length_and_meta(tmp_path):
    path = write_audio(tmp_path / "w.wav", seconds=1.0)
    wave = compute_waveform(path)
    assert len(wave.peaks) == DEFAULT_BUCKETS
    assert (wave.sample_rate, wave.channels) == (44100, 1)
    assert all(isinstance(pair, tuple) and len(pair) == 2 for pair in wave.peaks)


def test_waveform_silence_is_zero(tmp_path):
    wave = compute_waveform(write_audio(tmp_path / "s.wav", seconds=0.5))
    assert set(wave.peaks) == {(0.0, 0.0)}


def test_waveform_constant_level(tmp_path):
    path = write_signal(tmp_path / "c.wav", np.full(4410, 0.5))
    assert compute_waveform(path, buckets=10).peaks == tuple([(0.5, 0.5)] * 10)


def test_waveform_sine_has_both_signs(tmp_path):
    t = np.arange(4410) / 44100
    path = write_signal(tmp_path / "sine.wav", np.sin(2 * np.pi * 440 * t) * 0.8)
    wave = compute_waveform(path, buckets=20)
    low, high = wave.peaks[0]
    assert low < 0 < high
    assert all(-1.0 <= a <= b <= 1.0 for a, b in wave.peaks)


def test_waveform_mixes_channels_to_mono(tmp_path):
    # 왼쪽 +0.5, 오른쪽 -0.5 → 평균 0
    data = np.column_stack([np.full(1000, 0.5), np.full(1000, -0.5)])
    wave = compute_waveform(write_signal(tmp_path / "st.wav", data), buckets=5)
    assert wave.channels == 2
    assert wave.peaks == tuple([(0.0, 0.0)] * 5)


def test_waveform_bucket_count(tmp_path):
    path = write_audio(tmp_path / "b.wav", seconds=1.0)
    assert len(compute_waveform(path, buckets=10).peaks) == 10
    assert len(compute_waveform(path, buckets=1).peaks) == 1


def test_waveform_caps_buckets_to_frames(tmp_path):
    path = write_signal(tmp_path / "few.wav", np.arange(10, dtype="float32"))
    assert len(compute_waveform(path, buckets=100).peaks) == 10


def test_waveform_single_bucket_is_whole_file(tmp_path):
    path = write_signal(tmp_path / "ramp.wav", np.linspace(-0.5, 0.5, 1000))
    assert compute_waveform(path, buckets=1).peaks[0] == (-0.5, 0.5)


def test_waveform_rounds_and_clamps(tmp_path):
    # float WAV 에 1.0 을 넘는 값을 넣어도 그리기 값은 1.0 을 넘지 않는다
    loud = write_signal(tmp_path / "loud.wav", np.array([[2.0]]), subtype="FLOAT")
    assert compute_waveform(loud, buckets=1).peaks[0] == (1.0, 1.0)
    # 소수 넷째 자리에서 반올림
    tiny = write_signal(tmp_path / "tiny.wav", np.array([[0.123456]]), subtype="FLOAT")
    assert compute_waveform(tiny, buckets=1).peaks[0] == (0.1235, 0.1235)


def test_waveform_reads_other_formats(tmp_path):
    path = write_signal(tmp_path / "w.flac", np.full(22050, 0.25))
    assert compute_waveform(path, buckets=3).peaks == tuple([(0.25, 0.25)] * 3)


def test_waveform_zero_buckets_raises(tmp_path):
    path = write_audio(tmp_path / "z.wav")
    with pytest.raises(ValueError):
        compute_waveform(path, buckets=0)


def test_waveform_missing_file_404(tmp_path):
    with pytest.raises(AppError) as caught:
        compute_waveform(tmp_path / "nope.wav")
    assert caught.value.code == ErrorCode.NOT_FOUND
    assert caught.value.status_code == 404


def test_waveform_not_audio_415(tmp_path):
    path = tmp_path / "x.txt"
    path.write_text("no", encoding="utf-8")
    with pytest.raises(AppError) as caught:
        compute_waveform(path)
    assert caught.value.code == ErrorCode.UNSUPPORTED_FILE_TYPE


def test_waveform_empty_audio_400(tmp_path):
    path = write_signal(tmp_path / "empty.wav", np.zeros((0, 1)))
    with pytest.raises(AppError) as caught:
        compute_waveform(path)
    assert caught.value.status_code == 400


def test_waveform_is_frozen_dataclass(tmp_path):
    wave = compute_waveform(write_audio(tmp_path / "v.wav"), buckets=4)
    assert isinstance(wave, Waveform)
    with pytest.raises(AttributeError):
        wave.sample_rate = 1


# ── 182 write_waveform ──


@pytest.fixture
def storage(tmp_path, monkeypatch):
    """파형 JSON 을 시험용 임시 폴더에 저장 (진짜 storage/ 를 건드리지 않음)."""
    monkeypatch.setattr(
        sample_audio_service, "get_settings", lambda: SimpleNamespace(storage_dir=tmp_path)
    )
    return tmp_path


def sample_wave(tmp_path, buckets=4):
    return compute_waveform(write_signal(tmp_path / "src.wav", np.full(4000, 0.5)), buckets=buckets)


def test_write_waveform_creates_file(tmp_path, storage):
    relative = write_waveform(sample_wave(tmp_path), owner_id=7)
    assert re.fullmatch(r"waveforms/7/[0-9a-f]{32}\.json", relative)
    assert (storage / relative).is_file()


def test_write_waveform_json_content(tmp_path, storage):
    wave = sample_wave(tmp_path, buckets=3)
    relative = write_waveform(wave, owner_id=1)
    payload = json.loads((storage / relative).read_text(encoding="utf-8"))
    assert payload["version"] == 1
    assert payload["sample_rate"] == 44100
    assert payload["channels"] == 1
    assert payload["peaks"] == [list(pair) for pair in wave.peaks]


def test_write_waveform_is_compact(tmp_path, storage):
    relative = write_waveform(sample_wave(tmp_path), owner_id=1)
    text = (storage / relative).read_text(encoding="utf-8")
    assert ": " not in text and ", " not in text and "\n" not in text


def test_write_waveform_unique_names(tmp_path, storage):
    wave = sample_wave(tmp_path)
    first = write_waveform(wave, owner_id=1)
    second = write_waveform(wave, owner_id=1)
    assert first != second
    assert (storage / first).is_file() and (storage / second).is_file()


def test_write_waveform_makes_owner_folder(tmp_path, storage):
    write_waveform(sample_wave(tmp_path), owner_id=42)
    assert (storage / "waveforms" / "42").is_dir()


def test_write_waveform_propagates_oserror(tmp_path, monkeypatch):
    # 저장 위치가 폴더가 아니라 파일이면 폴더를 못 만들어 OSError 가 올라간다
    blocked = tmp_path / "not_a_dir"
    blocked.write_text("x", encoding="utf-8")
    monkeypatch.setattr(
        sample_audio_service, "get_settings", lambda: SimpleNamespace(storage_dir=blocked)
    )
    with pytest.raises(OSError):
        write_waveform(sample_wave(tmp_path), owner_id=1)


# ── 183 check_upload ──


def make_user(quota=5 * 1024**3, used=0):
    # DB 를 거치지 않고 검사 대상 값만 채운 User (이 함수는 DB 를 안 쓴다)
    return User(storage_quota_bytes=quota, storage_used_bytes=used)


@pytest.fixture
def max_bytes(monkeypatch):
    """파일 하나 최대 크기를 시험하기 좋게 작게 바꾼다 (기본 100MB 대신)."""
    monkeypatch.setattr(
        sample_audio_service, "get_settings", lambda: SimpleNamespace(sample_max_bytes=1000)
    )
    return 1000


def test_check_upload_accepts_supported_names():
    for name in ["a.wav", "b.MP3", "c.Flac", "d.ogg", "e.aiff", "f.aif"]:
        check_upload(make_user(), name, file_size=123)


@pytest.mark.parametrize("name", ["a.au", "a.txt", "a", "a.wav.zip", "a.mp3.exe", ""])
def test_check_upload_rejects_unsupported_names(name, max_bytes):
    with pytest.raises(AppError) as caught:
        check_upload(make_user(), name, file_size=1)
    assert caught.value.code == ErrorCode.UNSUPPORTED_FILE_TYPE
    assert caught.value.status_code == 415


def test_check_upload_size_limit(max_bytes):
    check_upload(make_user(), "a.wav", file_size=max_bytes)  # 딱 한도는 통과
    with pytest.raises(AppError) as caught:
        check_upload(make_user(), "a.wav", file_size=max_bytes + 1)
    assert caught.value.code == ErrorCode.FILE_TOO_LARGE
    assert caught.value.status_code == 413
    assert "MB" in caught.value.message


def test_check_upload_quota(max_bytes):
    user = make_user(quota=100, used=40)  # 남은 60
    check_upload(user, "a.wav", file_size=60)  # 딱 남은 만큼은 통과
    with pytest.raises(AppError) as caught:
        check_upload(user, "a.wav", file_size=61)
    assert caught.value.code == ErrorCode.STORAGE_QUOTA_EXCEEDED
    assert caught.value.status_code == 413


def test_check_upload_quota_uses_the_users_numbers(max_bytes):
    # 한도를 이미 다 쓴 사람은 1바이트도 못 올린다
    with pytest.raises(AppError) as caught:
        check_upload(make_user(quota=100, used=100), "a.wav", file_size=1)
    assert caught.value.code == ErrorCode.STORAGE_QUOTA_EXCEEDED


def test_check_upload_size_is_checked_before_quota(monkeypatch):
    # 파일 크기 한도(50)와 남은 용량(모자람)이 둘 다 걸리면 파일 크기 오류가 먼저다
    monkeypatch.setattr(
        sample_audio_service, "get_settings", lambda: SimpleNamespace(sample_max_bytes=50)
    )
    with pytest.raises(AppError) as caught:
        check_upload(make_user(quota=100, used=999), "a.wav", file_size=51)
    assert caught.value.code == ErrorCode.FILE_TOO_LARGE


def test_check_upload_name_only_not_content(tmp_path, max_bytes):
    # 이름만 .wav 인 텍스트 파일은 여기서는 통과하고 180 에서 막힌다
    fake = tmp_path / "fake.wav"
    fake.write_text("not audio", encoding="utf-8")
    check_upload(make_user(), "fake.wav", file_size=fake.stat().st_size)
    with pytest.raises(AppError) as caught:
        read_audio_info(fake)
    assert caught.value.code == ErrorCode.UNSUPPORTED_FILE_TYPE
