# Backend(FastAPI/Python) 188 — `GET /samples/{id}/waveform`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/samples.py` (`read_sample_waveform` 추가), `app/services/sample_service.py` (`get_sample`·`_stored_file`·`sample_waveform` 추가) |
| 작업 | S1-07 샘플 라이브러리: 파형 미리보기 데이터 (FR-223·210) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [187 `GET /samples/{id}/file`](187_api_samples_file.md) · 189 이름 변경·태그·삭제(FR-225) (예정) |

## 1. 하는 일
샘플의 파형 데이터를 돌려줍니다. `GET /api/v1/samples/{id}/waveform`입니다. 라이브러리 패널과 타임라인 클립이 이 값으로 파형을 그립니다(FR-210).

응답은 업로드할 때(182 `write_waveform`) 만들어 둔 JSON 파일을 그대로 보냅니다 (`Content-Type: application/json`).
```json
{"version": 1, "sample_rate": 44100, "channels": 1, "peaks": [[-0.32, 0.41], [-0.28, 0.35], ...]}
```
`peaks`의 각 칸은 `[그 구간의 최솟값, 최댓값]`입니다. 칸 수는 최대 1000개(`DEFAULT_BUCKETS`)로, 소리가 길어도 전송량이 일정합니다.

| 경우 | 결과 |
|---|---|
| 내 샘플, 파형 있음 | 200 + 파형 JSON |
| 로그인 안 함 | 401 |
| 없는 번호 · 남의 샘플 · 지운 샘플 | 404 `"Sample not found."` |
| 파형을 아직 안 만든 샘플 · 파일 없음 | 404 `"Waveform not found."` |
| `If-None-Match`가 지금 ETag와 같음 | 304 (본문 없음) |

## 2. 언제 쓰나
```js
var res = await fetch("/api/v1/samples/12/waveform");
var wave = await res.json();      // wave.peaks 를 캔버스에 그린다
```
한 번 받은 뒤에는 ETag로 검증해 안 바뀌었으면 본문을 다시 받지 않습니다.

## 3. 코드
**서비스** (`app/services/sample_service.py`)
```python
def get_sample(db, user, sample_id) -> Sample:
    sample = db.get(Sample, sample_id)
    if sample is None or sample.deleted_at is not None or sample.owner_id != user.user_id:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Sample not found.")
    return sample


def _stored_file(relative: str) -> Path | None:
    storage_dir = get_settings().storage_dir.resolve()
    path = (storage_dir / relative).resolve()
    if not path.is_relative_to(storage_dir) or not path.is_file():
        return None
    return path


def sample_waveform(db, user, sample_id) -> tuple[Sample, Path]:
    sample = get_sample(db, user, sample_id)
    if sample.waveform_path is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Waveform not found.")
    path = _stored_file(sample.waveform_path)
    if path is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Waveform not found.")
    return sample, path
```

**라우터** (`app/api/v1/samples.py`)
```python
@router.get(
    "/{sample_id}/waveform",
    response_class=FileResponse,
    responses={404: {"model": ErrorResponse}},
)
def read_sample_waveform(sample_id, request, user, db) -> Response:
    sample, path = sample_service.sample_waveform(db, user, sample_id)
    etag = f'"{sample.sample_id}-waveform-{path.stat().st_mtime_ns}"'
    cache = "private, no-cache"
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": cache})
    return FileResponse(
        path,
        media_type="application/json",
        headers={"ETag": etag, "Cache-Control": cache, "X-Content-Type-Options": "nosniff"},
    )
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `sample.waveform_path is None` | 파형을 아직 안 만든 샘플입니다. 이때는 파일을 찾지 않고 바로 404입니다 |
| `f'"{…}-waveform-{…}"'` | 파형 ETag에는 `-waveform-`을 붙여 오디오 ETag(187)와 겹치지 않게 합니다 |
| `media_type="application/json"` | 파형은 항상 JSON이므로 DB 값을 쓰지 않고 고정합니다 |

## 4. 흐름
1. `get_sample`이 내 샘플인지 확인합니다. 아니면 404 "Sample not found.".
2. `waveform_path`가 비어 있으면 404 "Waveform not found.".
3. 저장 폴더 안의 실제 파일인지 확인합니다. 아니면 404 "Waveform not found.".
4. ETag(샘플 번호 + `waveform` + 수정 시각)를 만들어 `If-None-Match`와 비교합니다.
5. 같으면 304, 다르면 JSON 파일을 보냅니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 만든 파일을 그대로 보냄 | 파형은 올릴 때 182가 한 번 만들고 안 바뀝니다. 요청마다 다시 계산하면 낭비입니다 |
| JSON 피크 배열(사용자 결정 2026-10-15) | PNG·피크 서버 대신 JSON으로 보내 브라우저가 캔버스에 그립니다. 확대·색 바꾸기가 자유롭고 서버가 가볍습니다 |
| `Sample not found.`와 `Waveform not found.` 구분 | 샘플은 내 것이 확실한데 파형만 없는 경우라, 화면이 "파형 없음"을 구분해 표시할 수 있게 합니다 (남의 샘플은 여전히 "Sample not found.") |
| 404 판정을 도우미로 분리 | 187·188이 소유·경로 검사를 똑같이 필요로 합니다. `get_sample`·`_stored_file`로 묶어 규칙이 한 곳에 있게 했습니다 |
| 파형도 ETag·캐시 | 한 번 받으면 거의 안 바뀌므로 본문 전송을 아낍니다. 오디오(187)와 같은 방식으로 맞춰 두었습니다 |

## 6. 시험 (`tests/test_sample_routes.py`에 6개 추가, 전체 959개 통과)

| 시험 | 확인한 것 |
|---|---|
| 파형 반환 | 200, `application/json`, `version`·`sample_rate`·`channels`, `peaks` 1000칸, 각 칸이 2개 |
| 로그인 필요 | 토큰 없이 401 |
| 남의 샘플 | 다른 사용자면 404 `NOT_FOUND` |
| 파형 없음 | `waveform_path`가 빈 샘플이면 404 `"Waveform not found."` |
| 디스크에 없음 | 경로만 있고 파일이 없으면 404 |
| ETag | 같은 ETag를 보내면 304, 본문 없음 |

> 187 시험도 `make_sample`이 돌려주는 `sample.sample_id`를 쓰도록 함께 정리했습니다(결과는 그대로, 전체 959개 통과).
