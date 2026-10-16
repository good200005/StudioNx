# Backend(FastAPI/Python) 182 — `write_waveform()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/sample_audio_service.py` |
| 작업 | S1-07 샘플 라이브러리: 파형 미리보기 JSON 파일 저장 (PRD 02 FR-223) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [181 `compute_waveform()`](181_sample_audio_compute_waveform.md) · 183 샘플 업로드 (예정) |

## 1. 하는 일
181이 만든 peaks를 JSON 파일로 저장하고, 저장소 기준 상대 경로(`waveforms/{owner_id}/{uuid}.json`)를 돌려줍니다. 이 경로가 `samples.waveform_path`에 들어갑니다.

| 넣은 것 | 결과 |
|---|---|
| 4칸 peaks, owner 7 | `waveforms/7/{32자}.json` 파일이 만들어짐 |
| 같은 값을 다시 저장 | 새 무작위 이름으로 또 만들어짐 (이름이 겹치지 않음) |
| 저장 폴더가 없음 | `waveforms/{owner_id}/`까지 만들어짐 |
| 저장 위치가 폴더가 아니라 파일 | `OSError`가 올라가 500이 됨 |

파일 내용의 예는 이렇습니다 (빈칸 없이 씁니다).
```json
{"version":1,"sample_rate":44100,"channels":1,"peaks":[[0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5]]}
```

## 2. 언제 쓰나
업로드 흐름이 이어집니다: 파일 저장 → `read_audio_info`(180) → `compute_waveform`(181) → `write_waveform`(182) → `samples.waveform_path`.

| 쓰는 곳 | |
|---|---|
| 라이브러리 패널 미리보기 | FR-224 |
| 타임라인 클립 파형 | FR-210 |
| 화면에 내려보내는 길 | `GET /samples/{id}/waveform` (PRD 02 §4.2) |

## 3. 코드
**import** (파일 맨 위, `json`, `uuid4`, `get_settings` 추가)
```python
import json
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import numpy as np
import soundfile as sf

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode

#: 파형 JSON 을 담는 저장소 폴더와 파일 형식 번호
WAVEFORM_DIR = "waveforms"
WAVEFORM_VERSION = 1
```

**함수**
```python
def write_waveform(waveform: Waveform, owner_id: int) -> str:
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
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `json.dumps(payload, separators=(",", ":"))` | 빈칸 없이 씁니다 (파일 크기를 줄입니다) |
| `uuid4().hex` | 32자 무작위 이름입니다. 같은 파일을 다시 처리해도 겹치지 않습니다 |
| `get_settings().storage_dir` | 설정의 저장 위치(`studionx/storage`, git에서 제외된 폴더)입니다 |
| `target.parent.mkdir(parents=True, exist_ok=True)` | 중간 폴더까지 만들고, 이미 있어도 오류를 내지 않습니다 |
| `write_text(text, encoding="utf-8")` | 문자열을 한 번에 씁니다 (한글이 섞여도 utf-8로 고정) |

## 4. 흐름
1. peaks, samplerate, channels를 JSON 문자열로 만듭니다 (빈칸 없이).
2. `waveforms/{owner_id}/{uuid}.json` 상대 경로와 실제 경로를 만듭니다.
3. 폴더를 만들고 파일을 씁니다.
4. 상대 경로를 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 파일로 따로 저장 (DB에 peaks를 안 넣음) | 1000칸 peaks는 30KB 남짓이라 DB 행에 넣기엔 큽니다. DB.md가 `waveform_path`(파일 경로)로 정해 둔 것과 맞습니다 |
| 무작위 파일 이름 | 같은 샘플을 다시 처리해도 이름이 겹치지 않습니다. 옛 파형 파일 정리는 부르는 쪽(업로드·삭제)이 맡습니다 |
| 상대 경로로 저장 | 저장소 위치(`storage_dir`)가 바뀌어도 DB 값은 그대로 쓸 수 있습니다 (프로필 사진 38번과 같은 방식) |
| `version` 칸 | 나중에 peaks 형식(예: 채널별)이 바뀌면 화면이 `version`을 보고 처리합니다 |
| 빈칸 없이 (separators) | peaks 1000쌍이면 공백만으로도 수 KB가 늘어납니다 |
| peaks를 `list`로 변환 | JSON은 tuple도 배열로 쓰지만, 넣는 값의 모양을 분명히 하려고 list로 바꿉니다 |
| 쓰기 실패는 그대로 `OSError` | 서버·디스크 오류라 500으로 가게 둡니다. 06번 오류 처리기가 파일 경로가 새지 않게 일반 문장으로 바꿉니다 |

## 6. 시험 (`tests/test_sample_audio_service.py`에 6개 추가, 전체 905개 통과)
파일은 임시 폴더(`tmp_path`)에 만들었고, `storage_dir`를 그 임시 폴더로 바꿔 진짜 `storage/`를 건드리지 않았습니다.

| 시험 | 확인한 것 |
|---|---|
| 파일 만들기 | 경로가 `waveforms/7/{32자}.json` 꼴이고 파일이 있음 |
| JSON 내용 | `version=1`, `sample_rate`, `channels`, `peaks`가 181의 값과 같음 |
| 빈칸 없음 | `": "`, `", "`, 줄바꿈이 없음 |
| 이름이 겹치지 않음 | 같은 값을 두 번 저장하면 서로 다른 파일 두 개 |
| 폴더 만들기 | `waveforms/42/` 폴더가 생김 |
| 쓰기 실패 | 저장 위치가 파일이면 `OSError`가 올라감 |
