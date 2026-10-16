# Backend(FastAPI/Python) 187 — `GET /samples/{id}/file`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/samples.py` (`read_sample_file` 추가), `app/services/sample_service.py` (`sample_file` 추가) |
| 작업 | S1-07 샘플 라이브러리: 오디오 파일 스트리밍 (FR-224 미리듣기) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [186 `GET /samples`](186_api_samples_list.md) · 188 `GET /samples/{id}/waveform` (예정) |

## 1. 하는 일
샘플의 오디오 파일을 그대로 돌려줍니다. `GET /api/v1/samples/{id}/file`입니다. 라이브러리 패널에서 미리듣기(FR-224)와 타임라인 재생에 씁니다.

| 경우 | 결과 |
|---|---|
| 내 샘플, 파일 있음 | 200 + 오디오 본문 |
| 로그인 안 함 | 401 |
| 없는 번호 · 남의 샘플 · 지운 샘플 · 디스크에 파일 없음 | 404 (모두 같은 문구) |
| `If-None-Match`가 지금 ETag와 같음 | 304 (본문 없음) |
| `Range: bytes=0-9` | 206 + 그 구간만 |

응답 헤더: `Content-Type`은 DB의 `mime_type`, `ETag`, `Cache-Control: private, no-cache`, `X-Content-Type-Options: nosniff`.

## 2. 언제 쓰나
브라우저 `<audio src="/api/v1/samples/12/file">`로 소리를 냅니다. ETag로 캐시를 검증하고(PRD 02 §7), Range 요청으로 오디오 탐색을 합니다.

## 3. 코드
**서비스** (`app/services/sample_service.py`)
```python
def sample_file(db: Session, user: User, sample_id: int) -> tuple[Sample, Path]:
    sample = get_sample(db, user, sample_id)          # 없음·남의 것·지운 것 → 404
    path = _stored_file(sample.file_path)             # 저장 폴더 밖·파일 없음 → None
    if path is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Sample not found.")
    return sample, path
```

**라우터** (`app/api/v1/samples.py`)
```python
@router.get(
    "/{sample_id}/file",
    response_class=FileResponse,
    responses={404: {"model": ErrorResponse}},
)
def read_sample_file(sample_id, request, user, db) -> Response:
    sample, path = sample_service.sample_file(db, user, sample_id)
    etag = f'"{sample.sample_id}-{sample.file_size}-{path.stat().st_mtime_ns}"'
    cache = "private, no-cache"
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": cache})
    return FileResponse(
        path,
        media_type=sample.mime_type,
        headers={"ETag": etag, "Cache-Control": cache, "X-Content-Type-Options": "nosniff"},
    )
```

> 188에서 404 판정을 `get_sample`(소유·삭제)과 `_stored_file`(경로·디스크) 두 도우미로 나누어 파형 서빙과 함께 쓰게 했습니다. `sample_file`은 그 둘을 부르기만 합니다.

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `FileResponse(path, media_type=…)` | 파일을 나눠 보내 줍니다. Range 요청도 처리합니다 (Starlette 1.7) |
| `path.resolve()` | `..` 같은 것을 펴서 실제 경로로 만듭니다 |
| `path.is_relative_to(storage_dir)` | 저장 폴더 밖을 가리키지 않는지 확인합니다 (경로 넘어가기 방지) |
| `path.stat().st_mtime_ns` | 파일 수정 시각(나노초)입니다. ETag에 넣어 파일이 바뀌면 값이 달라집니다 |
| `If-None-Match` | 브라우저가 "이 ETag 그대로인가?" 하고 물을 때 쓰는 헤더입니다 |
| `status.HTTP_304_NOT_MODIFIED` | 안 바뀌었으니 본문을 안 보내겠다는 응답입니다 |

## 4. 흐름
1. 로그인을 확인합니다 (401).
2. `sample_file`이 샘플을 찾습니다. 없거나 남의 것이거나 지운 것이면 404.
3. 저장 경로가 저장 폴더 안인지, 디스크에 파일이 있는지 확인합니다. 아니면 404.
4. ETag를 만듭니다 (샘플 번호 + 파일 크기 + 수정 시각).
5. 브라우저가 보낸 `If-None-Match`가 같으면 304로 본문 없이 돌려줍니다.
6. 다르면 `FileResponse`로 파일을 보냅니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 지금은 본인만 | PRD 02 §7은 "본인/프로젝트 멤버"지만, 그 샘플을 쓰는 클립이 아직 없습니다. 멤버 열람은 클립을 만들 때 함께 넣습니다 |
| 404를 하나로 | 없는 번호인지, 남의 것인지, 지운 것인지 알려 주지 않습니다. 남의 샘플이 있는지조차 알 수 없게 하려는 것입니다 (프로젝트 `get_membership`과 같은 방침) |
| ETag로 검증, `no-cache` | 샘플 파일은 한 번 올리면 안 바뀌므로, 매번 검증하되 안 바뀌었으면 본문을 안 받게 합니다 (PRD 02 §7 "ETag로 캐시 검증") |
| Content-Type을 DB 값으로 | 업로드(185)가 확장자로 정해 둔 값을 그대로 씁니다. 파일 이름을 다시 뜯어보지 않습니다 |
| `nosniff` | 브라우저가 내용을 보고 종류를 바꿔 추측하지 않게 합니다 (프로필 사진과 같음) |
| 파일 서빙은 라우터가 | 경로 찾기·권한은 서비스, 응답 만들기(헤더)는 라우터에 둡니다. 프로필 사진(41)과 같은 나눔입니다 |

## 6. 시험 (`tests/test_sample_routes.py`에 7개 추가, 전체 953개 통과)

| 시험 | 확인한 것 |
|---|---|
| 파일 반환 | 200, 본문이 올린 바이트와 같음, `Content-Type`·`Cache-Control`·`nosniff`·`ETag` |
| 로그인 필요 | 토큰 없이 401 |
| 남의 샘플 | 다른 사용자면 404 `NOT_FOUND` |
| 없음/지움 | 없는 번호 404, 소프트 삭제한 샘플 404 |
| 디스크에 없음 | 행만 있고 파일이 없으면 404 |
| ETag | 같은 ETag를 보내면 304, 본문 없음 |
| Range | `bytes=0-9`면 206, 앞 10바이트, `Content-Range` 머리말 |
