# Backend(FastAPI/Python) 185 — `POST /samples`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/samples.py` (새 파일), `app/schemas/sample.py` (새 파일), `app/api/v1/router.py`, `app/services/sample_service.py`(`to_response`) |
| 작업 | S1-07 샘플 라이브러리: 업로드 API — `POST /samples` (FR-221·222·227) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [184 `save_sample()`](184_sample_service_save_sample.md) · 186 `GET /samples` 목록 (예정) |

## 1. 하는 일
브라우저가 드롭한 파일 하나를 받아 저장하고, 저장된 샘플 정보를 201로 돌려줍니다. `POST /api/v1/samples`, `multipart/form-data`, 칸 이름 `file`입니다.

| 요청·결과 | 내용 |
|---|---|
| 성공 | 201 + `SampleResponse` |
| 로그인 안 함 | 401 |
| `file` 칸 없음 | 422 (FastAPI) |
| 지원하지 않는 형식 | 415 `UNSUPPORTED_FILE_TYPE` (183) |
| 100MB 초과 | 413 `FILE_TOO_LARGE` (183) |
| 남은 용량 부족 | 413 `STORAGE_QUOTA_EXCEEDED` (183) |

응답 `SampleResponse` 칸: `sample_id`, `name`, `original_filename`, `file_size`, `mime_type`, `duration_ms`, `sample_rate`, `channels`, `bpm`, `music_key`, `source`, `created_at`, `tags`. `tags`는 붙은 태그 목록인데, 186이 목록에서 채웁니다. 업로드 직후에는 아직 태그가 없어 빈 목록입니다.

## 2. 언제 쓰나
라이브러리 패널·타임라인에 파일을 드롭할 때 부릅니다(FR-221). 라우터는 `save_sample`(184)을 부르고 결과를 `to_response`로 바꿔 돌려주기만 합니다. 검사와 저장은 전부 서비스에 있습니다.

## 3. 코드
**라우터** (`app/api/v1/samples.py`)
```python
router = APIRouter()


@router.post(
    "",
    response_model=SampleResponse,
    status_code=status.HTTP_201_CREATED,
    responses={413: {"model": ErrorResponse}, 415: {"model": ErrorResponse}},
)
async def upload_sample(file: UploadFile, user: CurrentUser, db: Db) -> SampleResponse:
    sample = await sample_service.save_sample(db, user, file)
    return sample_service.to_response(sample)
```

**응답 스키마** (`app/schemas/sample.py`)
```python
class SampleResponse(BaseModel):
    sample_id: int
    name: str
    original_filename: str
    file_size: int
    mime_type: str
    duration_ms: int | None
    sample_rate: int | None
    channels: int | None
    bpm: Decimal | None
    music_key: str | None
    source: str
    created_at: datetime
    tags: list[TagItem] = []  # 186 이 목록에서 채운다. 업로드 때는 빈 목록
```

**응답 변환** (`app/services/sample_service.py`)
```python
def to_response(sample: Sample) -> SampleResponse:
    return SampleResponse(
        sample_id=sample.sample_id,
        name=sample.name,
        ...
        source=sample.source,
        created_at=sample.created_at,
    )
```

**라우터 등록** (`app/api/v1/router.py`)
```python
api_router.include_router(samples.router, prefix="/samples", tags=["samples"])  # S1-07
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `UploadFile` | multipart 로 올린 파일 한 개를 받습니다 (프로필 사진 38과 같음) |
| `CurrentUser` | `deps.py`가 토큰을 검사해 넣어 주는 로그인 사용자입니다 |
| `status.HTTP_201_CREATED` | 새 자원을 만들었으므로 200이 아니라 201을 씁니다 |
| `responses={413: …, 415: …}` | 이 오류 모양을 문서(OpenAPI)에 표시합니다 |
| `Decimal` | `bpm` 칸은 정확한 소수를 쓰려고 Decimal 로 받습니다 (프로젝트 응답과 같음) |

## 4. 흐름
1. 요청이 오면 `deps.get_current_user`가 먼저 로그인을 확인합니다 (401).
2. `UploadFile`을 꺼냅니다 (`file` 칸이 없으면 422).
3. `sample_service.save_sample`(184)가 저장하고 `Sample`을 돌려줍니다. 형식·크기·용량은 183이 막습니다.
4. `sample_service.to_response`가 응답 모양으로 바꿉니다.
5. 201과 함께 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 라우터는 얇게, 로직은 서비스에 | 프로젝트·회원 라우터와 같은 방식입니다. 검사·저장을 서비스에 두면 라우터 없이도 시험할 수 있습니다 (184 시험 12개) |
| 칸 이름 `file` | 프로필 사진(38)과 같게 맞춰 화면 코드가 한 가지 규칙만 알면 되게 합니다 |
| `to_response`를 서비스에 | 응답 칸을 하나씩 골라 넣어 DB 칸이 늘어도 응답에 섞이지 않게 합니다 (`to_me_response`와 같은 방식) |
| 형식·크기·용량을 문서에 표시 | 화면(라이브러리 패널)이 415·413을 코드로 구분해 안내합니다 (FR-227은 정리 유도) |
| 한 번에 한 파일 | 여러 파일 동시 업로드(FR-226)와 녹음 `source`는 우선순위가 낮아 뒤 작업으로 미룹니다. 지금은 드롭 한 건씩 처리합니다 |
| 응답에 파일·파형 주소 없음 | 그 라우터(`GET /samples/{id}/file`, `/waveform`)를 아직 안 만들었습니다. 만들 때 칸을 더합니다 |

## 6. 시험 (`tests/test_sample_routes.py` 새 파일 8개, 전체 937개 통과)
저장 위치는 임시 폴더로 바꾸고, 행·사용량은 실제 MySQL로 확인합니다.

| 시험 | 확인한 것 |
|---|---|
| 라우트 등록 | OpenAPI에 `POST /api/v1/samples`가 있음 |
| 업로드 성공 | 201, 응답 칸 전체, `name`·`mime_type`·`duration_ms`·`source`, DB 행의 소유자·파일 크기 |
| 로그인 필요 | 토큰 없이 401 |
| 파일 칸 없음 | 422 |
| 형식 거부 | `.txt`면 415 `UNSUPPORTED_FILE_TYPE` |
| 용량 초과 | 한도까지 쓴 사용자는 413 `STORAGE_QUOTA_EXCEEDED` |
| 크기 초과 | 한도를 500바이트로 줄이면 413 `FILE_TOO_LARGE` |
| 파일 이름 모양 | `samples/{owner_id}/{32자}.wav` |
