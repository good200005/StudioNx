"""샘플 오디오와 업로드 검사 — S1-07.

- `check_upload`(183): 올리기 전에 지원 형식·파일 크기·남은 저장 용량을 검사한다.
- `read_audio_info`(180): 헤더만 읽어 길이·샘플레이트·채널 수를 얻는다.
- `compute_waveform`(181): 파일을 읽어 파형 미리보기 peaks 를 만든다.
- `write_waveform`(182): peaks 를 JSON 파일로 저장하고 상대 경로를 돌려준다.

파일을 다 풀어 읽지 않고 헤더만 읽는다(soundfile = libsndfile 바인딩).
파일이 아무리 커도 열 때 시간이 얼마 걸리지 않는다. 오류로 읽지 못한 파일은
업로드 단계에서 막으므로(415) 메타 칸이 NULL로 남는 일은 없다.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import numpy as np
import soundfile as sf

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.models import User

AUDIO_MESSAGE = "Use a WAV, MP3, FLAC, OGG or AIFF audio file."

#: 지원하는 오디오 확장자 (FR-222). 대소문자는 가리지 않는다.
SUPPORTED_AUDIO_EXTENSIONS = (".wav", ".mp3", ".flac", ".ogg", ".aiff", ".aif")

#: 파형 미리보기의 기본 칸 수(peaks 길이). 화면 폭(보통 1000px 남짓)에 맞춘다.
DEFAULT_BUCKETS = 1000

#: 파형 JSON 을 담는 저장소 폴더와 파일 형식 번호
WAVEFORM_DIR = "waveforms"
WAVEFORM_VERSION = 1


@dataclass(frozen=True)
class AudioInfo:
    """파일 하나에서 읽은 오디오 기본 정보. samples 테이블의 해당 칸에 그대로 채운다.

    duration_ms 는 길이(밀리초), sample_rate 는 초당 표본 수,
    channels 는 채널 수이다 (모노 1, 스테레오 2).
    """

    duration_ms: int
    sample_rate: int
    channels: int


def read_audio_info(path: str | Path) -> AudioInfo:
    """오디오 파일에서 길이(ms)·샘플레이트·채널 수를 읽는다.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    - 파일이 없으면 404 NOT_FOUND
    - 오디오로 읽을 수 없으면(깨진 파일, 지원하지 않는 형식) 415 UNSUPPORTED_FILE_TYPE
    - 샘플레이트가 0이면 나눗셈이 못 되므로 400 BAD_REQUEST (헤더가 깨진 경우)
    - 그 밖의 오류(권한, 디스크)는 그대로 흘려보내 500으로 간다

    확인한 것
    - 길이는 표본 수(frames)를 샘플레이트로 나눈 뒤 밀리초로 반올림한다.
    - `sf.info`는 헤더만 읽으므로 샘플 내용을 디코딩하지 않는다 (100MB 파일도 빠름).
    - 지원 형식 목록(WAV·MP3·FLAC·OGG·AIFF) 검사는 여기서 하지 않는다.
      libsndfile가 열 수 있는 AU 같은 형식까지 막으려면 파일마다 따로 봐야 해서,
      그 검사는 다음 함수가 맡는다.
    """
    file_path = Path(path)
    if not file_path.is_file():
        raise AppError(ErrorCode.NOT_FOUND, 404, "Audio file not found.")
    try:
        info = sf.info(file_path)
    except sf.SoundFileError as exc:
        raise AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, 415, AUDIO_MESSAGE) from exc
    if info.samplerate <= 0:
        raise AppError(
            ErrorCode.BAD_REQUEST, 400, "This audio file has an invalid sample rate."
        )
    duration_ms = int(round(info.frames * 1000 / info.samplerate))
    return AudioInfo(
        duration_ms=duration_ms,
        sample_rate=int(info.samplerate),
        channels=int(info.channels),
    )


@dataclass(frozen=True)
class Waveform:
    """파형 미리보기 데이터. peaks 는 (최솟값, 최댓값) 쌍의 목록이다 (각 -1.0 ~ 1.0).

    peaks 의 길이가 buckets 이고, 채널이 여럿이면 하나로 섞은(평균) 값을 쓴다.
    """

    sample_rate: int
    channels: int
    peaks: tuple[tuple[float, float], ...]


def compute_waveform(path: str | Path, buckets: int = DEFAULT_BUCKETS) -> Waveform:
    """오디오 파일에서 파형 미리보기 데이터(peaks)를 만든다.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    파일 전체를 float32로 읽어 채널을 하나로 섞은 뒤, 표본을 buckets 칸으로
    나눠 칸마다 최솟값·최댓값을 낸다. 그리기용이라 소수 넷째 자리에서 반올림하고
    값은 -1.0 ~ 1.0 으로 자른다.
    - 없는 파일은 404, 읽을 수 없는 파일은 415 (180 read_audio_info 를 그대로 재사용)
    - 표본이 하나도 없으면 400 (그릴 것이 없다)
    - buckets 이 1보다 작으면 ValueError (부르는 쪽 실수다)
    - 표본 수가 buckets 보다 적으면 칸을 표본 수만큼만 만든다 (빈 칸을 만들지 않는다)
    """
    if buckets < 1:
        raise ValueError("buckets must be 1 or more")
    info = read_audio_info(path)
    try:
        data, _ = sf.read(path, dtype="float32", always_2d=True)
    except sf.SoundFileError as exc:
        raise AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, 415, AUDIO_MESSAGE) from exc
    total = int(data.shape[0])
    if total == 0:
        raise AppError(ErrorCode.BAD_REQUEST, 400, "This audio file has no samples.")
    mono = data.mean(axis=1)
    count = min(buckets, total)
    edges = np.linspace(0, total, count + 1).astype(np.int64)
    peaks: list[tuple[float, float]] = []
    for i in range(count):
        segment = mono[edges[i] : edges[i + 1]]
        low = float(np.clip(segment.min(), -1.0, 1.0))
        high = float(np.clip(segment.max(), -1.0, 1.0))
        peaks.append((round(low, 4), round(high, 4)))
    return Waveform(sample_rate=info.sample_rate, channels=info.channels, peaks=tuple(peaks))


def write_waveform(waveform: Waveform, owner_id: int) -> str:
    """파형 데이터를 JSON 파일로 저장하고, 저장소 기준 상대 경로를 돌려준다.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    경로는 `waveforms/{owner_id}/{uuid}.json` 이다. 파일 이름이 무작위라 같은 파일을
    다시 처리하면 새 이름이 되고, 옛 파형 파일을 지우는 일은 부르는 쪽(업로드·삭제)이 맡는다.

    - JSON 모양: `{"version": 1, "sample_rate": …, "channels": …, "peaks": [[최솟값, 최댓값], …]}`
    - peaks 는 소수 넷째 자리까지라 파일 크기를 줄이려 빈칸 없이(separators) 쓴다.
    - 저장 폴더가 없으면 만든다 (parents=True).
    - 쓰기가 실패하면 OSError 가 그대로 올라가 500 이 된다 (Sentry 에 남는다).
    """
    payload = {
        "version": WAVEFORM_VERSION,
        "sample_rate": waveform.sample_rate,
        "channels": waveform.channels,
        "peaks": [list(pair) for pair in waveform.peaks],
    }
    text = json.dumps(payload, separators=(",", ":"))
    relative = f"{WAVEFORM_DIR}/{owner_id}/{uuid4().hex}.json"
    target = get_settings().storage_dir / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return relative


def check_upload(user: User, filename: str, file_size: int) -> None:
    """올려도 되는 파일인지 검사한다. 문제가 있으면 AppError 를 던진다.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    FR-222 (지원 형식·파일 크기)와 FR-227 (남은 저장 용량)을 본다. 파일 내용은
    여기서 보지 않는다. 확장자 이름과 크기만 보며, 실제로 소리로 읽히는지는
    저장 뒤 read_audio_info(180)가 확인한다.
    - 지원하지 않는 확장자면 415 UNSUPPORTED_FILE_TYPE
    - 파일 하나가 한도(설정값 sample_max_bytes, 기본 100MB)를 넘으면 413 FILE_TOO_LARGE
    - 남은 용량(한도 - 사용량)보다 크면 413 STORAGE_QUOTA_EXCEEDED (안내 문구는 정리 유도)

    헷갈리지 않게: `.wav` 라고 이름만 바꾼 텍스트 파일은 여기서는 통과하고,
    180에서 415로 막힌다 (이름이 아니라 내용을 보는 쪽이 180이다).
    """
    settings = get_settings()
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_AUDIO_EXTENSIONS:
        raise AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, 415, AUDIO_MESSAGE)
    if file_size > settings.sample_max_bytes:
        limit_mb = settings.sample_max_bytes // (1024 * 1024)
        message = f"Audio files must be {limit_mb} MB or smaller."
        raise AppError(ErrorCode.FILE_TOO_LARGE, 413, message)
    remaining_bytes = user.storage_quota_bytes - user.storage_used_bytes
    if file_size > remaining_bytes:
        raise AppError(
            ErrorCode.STORAGE_QUOTA_EXCEEDED,
            413,
            "Not enough storage space. Free up some space and try again.",
        )
