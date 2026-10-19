"""패턴(피아노롤) API — S1-08, S1-10a, FR-231~233·2196. 라우터는 얇게, 로직은 pattern_service 로.

- GET    /patterns?project_id=   프로젝트의 패턴 목록 (노트 없이)
- POST   /patterns               새 빈 패턴 만들기
- GET    /patterns/{id}          패턴 한 건 + 노트 전부 (피아노롤이 열 때)
- PUT    /patterns/{id}/notes    노트를 보낸 목록으로 통째 교체
- PATCH  /patterns/{id}          이름·색·길이·스윙 수정
- DELETE /patterns/{id}          패턴 삭제 (클립이 쓰고 있으면 400)
"""

from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.api.deps import CurrentUser, Db
from app.schemas.common import ErrorResponse
from app.schemas.pattern import (
    NotesSaveRequest,
    PatternCreateRequest,
    PatternListResponse,
    PatternResponse,
    PatternUpdateRequest,
)
from app.services import pattern_service

router = APIRouter()


@router.get("", response_model=PatternListResponse)
def list_patterns(
    user: CurrentUser,
    db: Db,
    project_id: Annotated[int, Query(ge=1)],
) -> PatternListResponse:
    """프로젝트의 패턴 목록 (FR-233) — 멤버면 누구나. 노트는 담지 않는다."""
    return pattern_service.list_patterns(db, user, project_id)


@router.post(
    "",
    response_model=PatternResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def create_pattern(
    data: PatternCreateRequest,
    user: CurrentUser,
    db: Db,
) -> PatternResponse:
    """새 빈 패턴 만들기 (FR-2196) — OWNER·EDITOR 만."""
    return pattern_service.create_pattern(db, user, data)


@router.get(
    "/{pattern_id}",
    response_model=PatternResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_pattern(pattern_id: int, user: CurrentUser, db: Db) -> PatternResponse:
    """패턴 한 건과 노트 전부 (FR-232) — 피아노롤이 열 때 쓴다."""
    return pattern_service.get_pattern(db, user, pattern_id)


@router.put(
    "/{pattern_id}/notes",
    response_model=PatternResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def replace_notes(
    pattern_id: int,
    data: NotesSaveRequest,
    user: CurrentUser,
    db: Db,
) -> PatternResponse:
    """노트 통째 교체 (FR-231) — OWNER·EDITOR 만 (VIEWER 는 403)."""
    return pattern_service.replace_notes(db, user, pattern_id, data)


@router.patch(
    "/{pattern_id}",
    response_model=PatternResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def update_pattern(
    pattern_id: int,
    data: PatternUpdateRequest,
    user: CurrentUser,
    db: Db,
) -> PatternResponse:
    """패턴 이름·색·길이·스윙 수정 (FR-233) — OWNER·EDITOR 만."""
    return pattern_service.update_pattern(db, user, pattern_id, data)


@router.delete(
    "/{pattern_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def delete_pattern(
    pattern_id: Annotated[int, Path(ge=1)],
    user: CurrentUser,
    db: Db,
):
    """패턴 삭제 (FR-2196) — OWNER·EDITOR 만. 클립이 쓰고 있으면 400."""
    pattern_service.delete_pattern(db, user, pattern_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
