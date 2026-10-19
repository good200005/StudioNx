"""트랙 간 연결 API (Connect to Another) — S1-10a, FR-2197.

한 트랙에서 나가는 연결은 하나뿐이라 저장은 PUT(통째로 맞추기), 끄기는 DELETE 로 둔다.
권한·404·고리 검사는 connection_service 에 맡기고, 여기는 요청 모양과 상태 코드만 정한다.
"""

from typing import Annotated

from fastapi import APIRouter, Path, Response, status

from app.api.deps import CurrentUser, Db
from app.schemas.common import ErrorResponse
from app.schemas.connection import TrackConnectionResponse, TrackConnectionSetRequest
from app.services import connection_service

router = APIRouter(tags=["connections"])

NOT_FOUND_404 = {404: {"model": ErrorResponse}}
WRITE_RESPONSES = {
    400: {"model": ErrorResponse},
    401: {"model": ErrorResponse},
    403: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
}


@router.get(
    "/tracks/{track_id}/connection",
    response_model=TrackConnectionResponse,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        **NOT_FOUND_404,
    },
)
def get_connection(
    track_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    """이 트랙에서 나가는 연결 (FR-2197). 없으면 404 (연결이 꺼진 상태)."""
    connection = connection_service.get_connection(db, current_user, track_id)
    return TrackConnectionResponse.model_validate(connection)


@router.put(
    "/tracks/{track_id}/connection",
    response_model=TrackConnectionResponse,
    responses=WRITE_RESPONSES,
)
def set_connection(
    track_id: Annotated[int, Path(ge=1)],
    req: TrackConnectionSetRequest,
    db: Db,
    current_user: CurrentUser,
):
    """연결을 보낸 값으로 통째로 맞춘다 (FR-2197) — OWNER·EDITOR 만."""
    connection = connection_service.set_connection(db, current_user, track_id, req)
    return TrackConnectionResponse.model_validate(connection)


@router.delete(
    "/tracks/{track_id}/connection",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        **NOT_FOUND_404,
    },
)
def delete_connection(
    track_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    """연결 끄기 (FR-2197) — OWNER·EDITOR 만. 연결이 없어도 204."""
    connection_service.delete_connection(db, current_user, track_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
