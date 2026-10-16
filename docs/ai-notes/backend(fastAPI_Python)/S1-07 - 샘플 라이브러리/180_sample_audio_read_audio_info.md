# Backend(FastAPI/Python) 180 — `read_audio_info()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/sample_audio_service.py` |
| 작업 | S1-07 샘플 라이브러리: 업로드 시 길이·샘플레이트·채널 수 추출 (PRD 02 FR-223) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [179 `SampleTag`](179_models_sample_tag.md) · 181 파형 미리보기 데이터 (예정) |

## 1. 하는 일
파일을 열어 **헤더만** 읽고 길이(ms)·샘플레이트·채널 수를 뽑습니다. 샘플 내용을 전부 풀어 읽지 않으므로 100MB 파일(FR-222 한도)도 금방입니다.

| 넣은 것 | 결과 |
|---|---|
| 1초, 44100Hz, 모노 WAV | `AudioInfo(duration_ms=1000, sample_rate=44100, channels=1)` |
| 0.5초, 48000Hz, 스테레오 | `500 / 48000 / 2` |
| 10006 표본, 8000Hz | 1250.75ms → 반올림하여 `1251` |
| WAV, MP3, FLAC, OGG, AIFF | 다 같은 모양으로 읽힙니다 |
| AU (지원 목록 밖) | 이 함수는 **성공**합니다. 형식 목록 검사는 다음 함수가 합니다 |
| 없는 파일, 폴더 | 404 `NOT_FOUND` "Audio file not found." |
| 오디오가 아닌 파일, 빈 파일 | 415 `UNSUPPORTED_FILE_TYPE` "Use a WAV, MP3, FLAC, OGG or AIFF audio file." |
| 샘플레이트 0 (깨진 헤더) | 400 `BAD_REQUEST` "This audio file has an invalid sample rate." |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 샘플 업로드 API (다음 함수) | 업로드한 파일의 경로를 넘겨 세 칸을 채웁니다 (PRD 02 §4.2 FR-223) |
| `samples` 테이블 | `duration_ms`, `sample_rate`, `channels` 세 칸 (DB.md §3.2) |

파형 미리보기(`waveform_path`)는 FR-223의 나머지 부분이라 다음 함수(181)가 만듭니다.

## 3. 코드
**import** (파일 맨 위)
```python
from dataclasses import dataclass
from pathlib import Path

import soundfile as sf

from app.core.errors import AppError, ErrorCode

AUDIO_MESSAGE = "Use a WAV, MP3, FLAC, OGG or AIFF audio file."
```

**세 칸을 담는 값 묶음**
```python
@dataclass(frozen=True)
class AudioInfo:
    """파일 하나에서 읽은 오디오 기본 정보. samples 테이블의 해당 칸에 그대로 채운다.

    duration_ms 는 길이(밀리초), sample_rate 는 초당 표본 수,
    channels 는 채널 수이다 (모노 1, 스테레오 2).
    """

    duration_ms: int
    sample_rate: int
    channels: int
```

**함수**
```python
def read_audio_info(path: str | Path) -> AudioInfo:
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
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `@dataclass(frozen=True)` | 값이 고정된 값 묶음입니다. `mail_templates.py`와 같은 쓰임입니다 |
| `Path(path)`, `is_file()` | 문자열이든 `Path`든 같은 방식으로 파일만 있는지 봅니다 |
| `sf.info(file_path)` | 헤더 정보(`frames` 표본 수, `samplerate`, `channels`)만 읽습니다 |
| `sf.SoundFileError` | soundfile이 던지는 오류의 어머니입니다. 형식을 못 알아본 `LibsndfileError`를 포함합니다 |
| `raise … from exc` | 원인 오류를 남기고 AppError로 바꿔 던집니다 (Sentry에 두 오류가 함께 남습니다) |
| `int(round(...))` | 소수로 나오는 밀리초를 정수로 반올림합니다 |

## 4. 흐름
1. 파일이 있는지 봅니다 (없으면 404).
2. `sf.info()`로 헤더만 읽습니다 (내용은 디코딩하지 않습니다).
3. 형식을 못 읽으면 415, 샘플레이트가 0이면 400으로 바꿔 던집니다.
4. 표본 수(frames) ÷ 샘플레이트 × 1000으로 밀리초를 구해 세 칸을 담아 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `sf.info()`로 헤더만 | 길이·샘플레이트·채널 수는 샘플 전체를 메모리로 올리지 않아도 나옵니다. 파일이 커도 열 때 시간이 거의 걸리지 않습니다 |
| 형식 목록은 여기서 검사하지 않음 | libsndfile은 WAV 빼고 AU·VOC 같은 형식도 엽니다. "허용 목록"과 "libsndfile이 읽을 수 있는가"는 다르므로, 허용 목록 검사는 파일 확장자와 내용을 함께 보는 별도 함수로 둡니다 (다음) |
| 오류를 AppError로 바꿔 던짐 | 06번(오류 처리기)이 같은 모양으로 응답합니다. 읽지 못한 파일은 업로드 자체가 거부되어, 메타 칸이 NULL로 남지 않습니다 |
| 파일이 없으면 404 | 업로드 흐름에서는 저장한 뒤 다시 읽는 경우입니다. 사라진 샘플 파일은 "없는 것"으로 다루고(FR-2230 파일 관리), 그 형식 문제는 415로 구분합니다 |
| 세 칸을 한 값 묶음으로 | 세 값은 항상 같이 움직입니다. 다음 파형 함수도 같은 파일을 한 번 더 읽기 때문에, 그때도 같은 파일에서 함께 값을 얻습니다 |

## 6. 시험 (`tests/test_sample_audio_service.py`에 13개 추가, 전체 884개 통과)
시험용 파일은 임시 폴더(`tmp_path`)에 만들었고, 샘플 값은 0(소리 없음)이라 길이만 확인합니다. 이 함수는 DB를 쓰지 않아 실제 MySQL 시험은 없습니다.

| 시험 | 확인한 것 |
|---|---|
| 1초 44100Hz 모노 | 1000 / 44100 / 1 |
| 0.5초 48000Hz 스테레오 | 500 / 48000 / 2 |
| 밀리초 반올림 | 1250.75 → 1251 |
| 문자열 경로 | `Path`가 아니어도 같은 결과 |
| 값 묶음 | `AudioInfo`이고 값이 바뀌지 않음 (frozen) |
| 지원 형식 5가지 | WAV, MP3, FLAC, OGG, AIFF 모두 읽힘 |
| AU (목록 밖) | 이 함수는 성공 — 형식 목록 검사는 다음 함수가 함 |
| 없는 파일, 폴더 | 차례로 404, 404 |
| 텍스트 파일, 빈 파일 | 차례로 415, 415 |
| 샘플레이트 0 | 400 (`sf.info`를 가짜로 바꿔 확인) |
| 파일 내용 | 함수를 불러도 바뀌지 않음 (읽기 전용) |
