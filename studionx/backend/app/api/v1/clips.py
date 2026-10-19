"""클립(타임라인) API — S1-10a, FR-2196.

트랙에 놓인 클립의 목록·만들기(POST /tracks/{id}/clips)와, 클립 하나의 수정·삭제
(PATCH·DELETE /clips/{id})를 제공한다. 권한·404 처리는 clip_service 에 맡기고,
여기는 요청 모양과 상태 코드만 정한다.
"""

from typing import Annotated

from fastapi import APIRouter, Path, Response, status

from app.api.deps import CurrentUser, Db
from app.schemas.clip import ClipCreateRequest, ClipResponse, ClipUpdateRequest
from app.schemas.common import ErrorResponse
from app.services import clip_service

router = APIRouter(tags=["clips"])

NOT_FOUND_404 = {404: {"model": ErrorResponse}}
WRITE_RESPONSES = {
    400: {"model": ErrorResponse},
    401: {"model": ErrorResponse},
    403: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
}


@router.get(
    "/tracks/{track_id}/clips",
    response_model=list[ClipResponse],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        **NOT_FOUND_404,
    },
)
def list_clips(
    track_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    """트랙에 놓인 클립 목록 (FR-2196). 멤버면 누구나."""
    clips = clip_service.list_clips(db, current_user, track_id)
    return [ClipResponse.model_validate(clip) for clip in clips]


@router.post(
    "/tracks/{track_id}/clips",
    response_model=ClipResponse,
    status_code=status.HTTP_201_CREATED,
    responses=WRITE_RESPONSES,
)
def create_clip(
    track_id: Annotated[int, Path(ge=1)],
    req: ClipCreateRequest,
    db: Db,
    current_user: CurrentUser,
):
    """트랙에 클립을 놓는다 (FR-2196) — OWNER·EDITOR 만."""
    clip = clip_service.create_clip(db, current_user, track_id, req)
    return ClipResponse.model_validate(clip)


@router.patch(
    "/clips/{clip_id}",
    response_model=ClipResponse,
    responses=WRITE_RESPONSES,
)
def update_clip(
    clip_id: Annotated[int, Path(ge=1)],
    req: ClipUpdateRequest,
    db: Db,
    current_user: CurrentUser,
):
    """클립의 위치·길이·페이드·워프 등 수정 (FR-2196) — OWNER·EDITOR 만."""
    clip = clip_service.update_clip(db, current_user, clip_id, req)
    return ClipResponse.model_validate(clip)


@router.delete(
    "/clips/{clip_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        **NOT_FOUND_404,
    },
)
def delete_clip(
    clip_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    """클립 삭제 (FR-2196) — OWNER·EDITOR 만."""
    clip_service.delete_clip(db, current_user, clip_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
