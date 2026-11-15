"""오토메이션 API — S1-15. 트랙의 레인 목록과, 대상 하나의 곡선 저장."""

from typing import Annotated

from fastapi import APIRouter, Path, Response, status

from app.api.deps import CurrentUser, Db
from app.schemas.automation import AutomationLaneResponse, AutomationLaneSaveRequest
from app.schemas.common import ErrorResponse
from app.services import automation_service

router = APIRouter(tags=["automation"])

ERRORS = {
    400: {"model": ErrorResponse},
    401: {"model": ErrorResponse},
    403: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
}


@router.get(
    "/tracks/{track_id}/automation",
    response_model=list[AutomationLaneResponse],
    responses=ERRORS,
)
def list_automation(track_id: Annotated[int, Path(ge=1)], db: Db, current_user: CurrentUser):
    """트랙의 오토메이션 레인과 점. 멤버면 누구나."""
    return automation_service.list_lanes(db, current_user, track_id)


@router.put(
    "/tracks/{track_id}/automation",
    response_model=AutomationLaneResponse,
    responses={204: {"description": "점이 없어 레인을 지움"}, **ERRORS},
)
def save_automation(
    track_id: Annotated[int, Path(ge=1)],
    body: AutomationLaneSaveRequest,
    db: Db,
    current_user: CurrentUser,
):
    """대상 하나의 곡선을 통째로 저장한다. 점이 없으면 그 레인을 지운다(204). OWNER · EDITOR."""
    lane = automation_service.save_lane(db, current_user, track_id, body)
    if lane is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return lane
