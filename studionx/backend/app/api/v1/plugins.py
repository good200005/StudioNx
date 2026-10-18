"""플러그인 API — S1-09."""

from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.api.deps import CurrentUser, Db
from app.schemas.common import ErrorResponse
from app.schemas.plugin import PluginListResponse, PluginPresetResponse, PluginResponse
from app.services import plugin_service

router = APIRouter(tags=["plugins"])


@router.get(
    "",
    response_model=PluginListResponse,
    responses={401: {"model": ErrorResponse}},
)
def list_plugins(
    db: Db,
    current_user: CurrentUser,
    active_only: Annotated[bool, Query(description="활성 플러그인만")] = True,
):
    items = plugin_service.list_plugins(db, active_only=active_only)
    return PluginListResponse(items=[PluginResponse.model_validate(p) for p in items])


@router.get(
    "/{plugin_id}",
    response_model=PluginResponse,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def get_plugin(
    plugin_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    p = plugin_service.require_plugin(db, plugin_id)
    return PluginResponse.model_validate(p)


@router.get(
    "/{plugin_id}/presets",
    response_model=list[PluginPresetResponse],
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def list_plugin_presets(
    plugin_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    p = plugin_service.require_plugin(db, plugin_id)
    presets = plugin_service.list_plugin_presets(db, p.plugin_id, user_id=current_user.user_id)
    return [PluginPresetResponse.model_validate(pr) for pr in presets]
