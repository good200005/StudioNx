# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] S1-07 샘플 라이브러리 — 샘플 API
#
# S1-07 샘플 라이브러리 (FR-221~227)
#   브랜치  : feature/phase1/s1-07-sample-library
#   순서    : 업로드(184 저장) 뒤 라우터
#
# 시작 전 : git switch feature/phase1/s1-07-sample-library
# 끝나면  : PR → develop (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""/api/v1/samples 라우터 (PRD 02 §7, FR-221~227).

- `POST /samples` 업로드 (184 · 185)
- `GET /samples` 내 라이브러리 목록 (186)
- `GET /samples/{id}/file` 오디오 파일 스트리밍 (187)
- `GET /samples/{id}/waveform` 파형 미리보기 데이터 (188)
- `PATCH /samples/{id}` 이름 변경 (189, FR-225)
- `PUT /samples/{id}/tags` 태그 설정 (190, FR-225)
- `DELETE /samples/{id}` 소프트 삭제 (191, FR-225)

태그 목록(GET /tags) 표시는 이어서 추가한다.

화면 쪽: 라이브러리 패널 (드래그앤드롭 업로드, 목록 표시)
서비스: services/sample_service.py save_sample(184) · list_samples(186)
검사: sample_audio_service.py check_upload(183)
"""

from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, Db
from app.schemas.common import ErrorResponse
from app.schemas.sample import (
    SAMPLE_PAGE_SIZE_MAX,
    SampleListResponse,
    SampleResponse,
    SampleTagsRequest,
    SampleUpdateRequest,
)
from app.services import sample_service

router = APIRouter()


@router.get("", response_model=SampleListResponse)
def list_samples(
    user: CurrentUser,
    db: Db,
    query: Annotated[str, Query(max_length=100)] = "",
    tag: Annotated[int | None, Query(ge=1)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=SAMPLE_PAGE_SIZE_MAX)] = 10,
) -> SampleListResponse:
    """내 라이브러리 목록 (FR-224) — 검색 · 태그 필터 · 페이지.

    - `query`: 이름에 이 글자가 들어간 것만 (대소문자 무시, 공백만이면 전부)
    - `tag`: 그 태그가 붙은 샘플만 (없으면 전부)
    - 만든 순서, 같은 줄은 나중에 만든 것이 먼저
    - 화면은 라이브러리 패널을 열 때 부른다
    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)
    """
    return sample_service.list_samples(db, user, query.strip(), tag, page, size)


@router.post(
    "",
    response_model=SampleResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        413: {"model": ErrorResponse},
        415: {"model": ErrorResponse},
    },
)
async def upload_sample(file: UploadFile, user: CurrentUser, db: Db) -> SampleResponse:
    """샘플 올리기 (FR-221) — multipart/form-data, 칸 이름 file.

    - save_sample(184)로 저장 → 메타·파형 생성, samples 행, 사용량 증가 (한 트랜잭션)
    - 형식(415)·크기(413)·남은 용량(413 STORAGE_QUOTA_EXCEEDED)은 183 이 막음
    - file 칸이 없으면 422 (FastAPI)
    - 화면: formData.append('file', 파일) 로 보냄 (FormData 면 api.js 가 Content-Type 을 비워 둠)
    - 여러 파일 동시 업로드(FR-226)와 녹음 source 는 뒤 작업 — 지금은 한 번에 한 파일
    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)
    """
    sample = await sample_service.save_sample(db, user, file)
    return sample_service.to_response(sample)


@router.patch(
    "/{sample_id}",
    response_model=SampleResponse,
    responses={404: {"model": ErrorResponse}},
)
def update_sample(
    sample_id: int,
    data: SampleUpdateRequest,
    user: CurrentUser,
    db: Db,
) -> SampleResponse:
    """샘플 이름 바꾸기 (FR-225) — PATCH, 보낸 칸만 바꾼다.

    - 404: 없는 번호 · 남의 샘플 · 지운 샘플 (모두 "Sample not found.")
    - 422: 이름을 null 로 보내거나, 공백뿐이거나, 200자를 넘을 때
    - 응답: 목록 한 줄과 같은 모양(SampleResponse), 붙어 있는 태그 포함
    - 화면: 라이브러리 패널에서 이름을 고쳐 보낼 때
    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)
    """
    return sample_service.update_sample(db, user, sample_id, data)


@router.put(
    "/{sample_id}/tags",
    response_model=SampleResponse,
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def set_sample_tags(
    sample_id: int,
    data: SampleTagsRequest,
    user: CurrentUser,
    db: Db,
) -> SampleResponse:
    """샘플 태그 설정 (FR-225) — 보낸 태그 번호 목록으로 통째 교체.

    - 빈 목록(`[]`)은 태그를 모두 떼는 뜻
    - 404: 없는 번호 · 남의 샘플 · 지운 샘플 (모두 "Sample not found.")
    - 422: 목록에 없는 태그 번호가 하나라도 있을 때 (details.tag_ids 에 그 번호들).
      이때는 아무것도 바꾸지 않음
    - 응답: 목록 한 줄과 같은 모양(SampleResponse), 새로 붙은 태그 포함
    - 화면: 라이브러리 패널에서 태그를 고쳐 보낼 때
    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)
    """
    return sample_service.set_sample_tags(db, user, sample_id, data.tag_ids)


@router.delete(
    "/{sample_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorResponse}},
)
def delete_sample(sample_id: int, user: CurrentUser, db: Db) -> None:
    """샘플 삭제 (FR-225) — 소프트 삭제, 지운 만큼 저장 용량을 돌려준다.

    - 204: 지웠음 (본문 없음)
    - 404: 없는 번호 · 남의 샘플 · 이미 지운 샘플 (모두 "Sample not found.")
    - 행은 남기고 deleted_at 만 채운다 → 목록·재생·파형에서 바로 빠진다
    - 오디오·파형 파일은 디스크에 남기고, 실제 정리는 뒤 정리 작업(FR-137)이 한다
    - 화면: 라이브러리 패널에서 샘플을 지울 때
    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)
    """
    sample_service.delete_sample(db, user, sample_id)


@router.get(
    "/{sample_id}/file",
    response_class=FileResponse,
    responses={404: {"model": ErrorResponse}},
)
def read_sample_file(
    sample_id: int,
    request: Request,
    user: CurrentUser,
    db: Db,
) -> Response:
    """샘플 오디오 파일 스트리밍 (FR-224 미리듣기) — 지금은 올린 본인만.

    - 404: 없는 번호 · 남의 샘플 · 지운 샘플 · 디스크에 파일이 없음 (모두 같은 문구)
    - ETag(샘플 번호 + 파일 크기 + 수정 시각)로 캐시를 검증한다 → 그대로면 304 (PRD 02 §7)
    - Cache-Control: private, no-cache — 매번 검증하되 안 바뀌었으면 본문을 받지 않음
    - Range 요청은 FileResponse 가 처리한다 (오디오 탐색)
    - Content-Type 은 DB 의 mime_type(185 가 확장자로 정함)을 쓴다
    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)
    """
    sample, path = sample_service.sample_file(db, user, sample_id)
    etag = f'"{sample.sample_id}-{sample.file_size}-{path.stat().st_mtime_ns}"'
    cache = "private, no-cache"
    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED,
            headers={"ETag": etag, "Cache-Control": cache},
        )
    return FileResponse(
        path,
        media_type=sample.mime_type,
        headers={
            "ETag": etag,
            "Cache-Control": cache,
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get(
    "/{sample_id}/waveform",
    response_class=FileResponse,
    responses={404: {"model": ErrorResponse}},
)
def read_sample_waveform(
    sample_id: int,
    request: Request,
    user: CurrentUser,
    db: Db,
) -> Response:
    """파형 미리보기 데이터 (FR-223·210) — 182가 만든 JSON을 그대로 준다.

    - 모양: `{"version": 1, "sample_rate": …, "channels": …, "peaks": [[최솟값, 최댓값], …]}`
    - 404: 없는 번호 · 남의 샘플 · 지운 샘플은 "Sample not found.",
      파형을 아직 안 만든 샘플이나 파일이 없으면 "Waveform not found."
    - 오디오 파일(187)과 같은 방식으로 ETag·캐시를 쓴다
    - 파형은 올릴 때 한 번 만들고 안 바뀌므로 파일을 그대로 흘려보낸다 (다시 만들지 않음)
    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)
    """
    sample, path = sample_service.sample_waveform(db, user, sample_id)
    etag = f'"{sample.sample_id}-waveform-{path.stat().st_mtime_ns}"'
    cache = "private, no-cache"
    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED,
            headers={"ETag": etag, "Cache-Control": cache},
        )
    return FileResponse(
        path,
        media_type="application/json",
        headers={
            "ETag": etag,
            "Cache-Control": cache,
            "X-Content-Type-Options": "nosniff",
        },
    )
