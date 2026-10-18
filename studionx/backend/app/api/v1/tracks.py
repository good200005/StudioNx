"""트랙/디바이스 API — S1-09 (FR-251·263·264·265~269)."""

from typing import Annotated

from fastapi import APIRouter, Path, Response, status

from app.api.deps import CurrentUser, Db
from app.schemas.common import ErrorResponse
from app.schemas.device import (
    TrackInstrumentCreateRequest,
    TrackInstrumentResponse,
    TrackInstrumentUpdateRequest,
    TrackPluginCreateRequest,
    TrackPluginLinkCreateRequest,
    TrackPluginLinkResponse,
    TrackPluginResponse,
    TrackPluginUpdateRequest,
)
from app.schemas.track import (
    TrackCreateRequest,
    TrackListResponse,
    TrackResponse,
    TrackUpdateRequest,
)
from app.services import track_service

router = APIRouter(tags=["tracks"])


@router.get(
    "/projects/{project_id}/tracks",
    response_model=TrackListResponse,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def list_tracks(
    project_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    items = track_service.list_tracks(db, project_id, current_user.user_id)
    return TrackListResponse(
        items=[TrackResponse.model_validate(t) for t in items], total=len(items)
    )


@router.post(
    "/projects/{project_id}/tracks",
    response_model=TrackResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def create_track(
    project_id: Annotated[int, Path(ge=1)],
    req: TrackCreateRequest,
    db: Db,
    current_user: CurrentUser,
):
    t = track_service.create_track(
        db,
        project_id,
        current_user.user_id,
        name=req.name,
        track_type=req.track_type,
        color=req.color,
        volume_db=req.volume_db,
        pan=req.pan,
        is_muted=req.is_muted,
        is_solo=req.is_solo,
        is_enabled=req.is_enabled,
        routing_mode=req.routing_mode,
        order_index=req.order_index,
        parent_track_id=req.parent_track_id,
    )
    return TrackResponse.model_validate(t)


@router.get(
    "/tracks/{track_id}",
    response_model=TrackResponse,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def get_track(
    track_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    t = track_service.require_track(db, track_id, current_user.user_id)
    return TrackResponse.model_validate(t)


@router.patch(
    "/tracks/{track_id}",
    response_model=TrackResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def update_track(
    track_id: Annotated[int, Path(ge=1)],
    req: TrackUpdateRequest,
    db: Db,
    current_user: CurrentUser,
):
    data = req.model_dump(exclude_unset=True)
    t = track_service.update_track(db, track_id, current_user.user_id, **data)
    return TrackResponse.model_validate(t)


@router.delete(
    "/tracks/{track_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def delete_track(
    track_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    track_service.delete_track(db, track_id, current_user.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/tracks/{track_id}/instruments",
    response_model=list[TrackInstrumentResponse],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def list_instruments(
    track_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    t = track_service.require_track(db, track_id, current_user.user_id)
    return [TrackInstrumentResponse.model_validate(i) for i in t.instruments]


@router.post(
    "/tracks/{track_id}/instruments",
    response_model=TrackInstrumentResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def add_instrument(
    track_id: Annotated[int, Path(ge=1)],
    req: TrackInstrumentCreateRequest,
    db: Db,
    current_user: CurrentUser,
):
    inst = track_service.add_instrument(
        db,
        track_id,
        current_user.user_id,
        plugin_id=req.plugin_id,
        slot_index=req.slot_index,
        params=req.params,
        volume_db=req.volume_db,
        pan=req.pan,
        is_solo=req.is_solo,
        is_enabled=req.is_enabled,
    )
    return TrackInstrumentResponse.model_validate(inst)


@router.patch(
    "/tracks/{track_id}/instruments/{instrument_id}",
    response_model=TrackInstrumentResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def update_instrument(
    track_id: Annotated[int, Path(ge=1)],
    instrument_id: Annotated[int, Path(ge=1)],
    req: TrackInstrumentUpdateRequest,
    db: Db,
    current_user: CurrentUser,
):
    _ = track_service.require_track(db, track_id, current_user.user_id)
    data = req.model_dump(exclude_unset=True)
    inst = track_service.update_instrument(db, instrument_id, current_user.user_id, **data)
    return TrackInstrumentResponse.model_validate(inst)


@router.delete(
    "/tracks/{track_id}/instruments/{instrument_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def remove_instrument(
    track_id: Annotated[int, Path(ge=1)],
    instrument_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    _ = track_service.require_track(db, track_id, current_user.user_id)
    track_service.remove_instrument(db, instrument_id, current_user.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/tracks/{track_id}/plugins",
    response_model=list[TrackPluginResponse],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def list_effects(
    track_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    t = track_service.require_track(db, track_id, current_user.user_id)
    return [TrackPluginResponse.model_validate(p) for p in t.plugins]


@router.post(
    "/tracks/{track_id}/plugins",
    response_model=TrackPluginResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def add_effect(
    track_id: Annotated[int, Path(ge=1)],
    req: TrackPluginCreateRequest,
    db: Db,
    current_user: CurrentUser,
):
    tp = track_service.add_effect(
        db,
        track_id,
        current_user.user_id,
        plugin_id=req.plugin_id,
        slot_index=req.slot_index,
        node_x=req.node_x,
        node_y=req.node_y,
        params=req.params,
        is_bypassed=req.is_bypassed,
    )
    return TrackPluginResponse.model_validate(tp)


@router.patch(
    "/tracks/{track_id}/plugins/{track_plugin_id}",
    response_model=TrackPluginResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def update_effect(
    track_id: Annotated[int, Path(ge=1)],
    track_plugin_id: Annotated[int, Path(ge=1)],
    req: TrackPluginUpdateRequest,
    db: Db,
    current_user: CurrentUser,
):
    _ = track_service.require_track(db, track_id, current_user.user_id)
    data = req.model_dump(exclude_unset=True)
    tp = track_service.update_effect(db, track_plugin_id, current_user.user_id, **data)
    return TrackPluginResponse.model_validate(tp)


@router.delete(
    "/tracks/{track_id}/plugins/{track_plugin_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def remove_effect(
    track_id: Annotated[int, Path(ge=1)],
    track_plugin_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    _ = track_service.require_track(db, track_id, current_user.user_id)
    track_service.remove_effect(db, track_plugin_id, current_user.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/tracks/{track_id}/links",
    response_model=list[TrackPluginLinkResponse],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def list_links(
    track_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    links = track_service.list_links(db, track_id, current_user.user_id)
    return [TrackPluginLinkResponse.model_validate(lnk) for lnk in links]


@router.post(
    "/tracks/{track_id}/links",
    response_model=TrackPluginLinkResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def add_link(
    track_id: Annotated[int, Path(ge=1)],
    req: TrackPluginLinkCreateRequest,
    db: Db,
    current_user: CurrentUser,
):
    link = track_service.add_link(
        db,
        track_id,
        current_user.user_id,
        from_track_plugin_id=req.from_track_plugin_id,
        from_port=req.from_port,
        to_track_plugin_id=req.to_track_plugin_id,
        to_port=req.to_port,
        gain_db=req.gain_db,
    )
    return TrackPluginLinkResponse.model_validate(link)


@router.delete(
    "/tracks/{track_id}/links/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def remove_link(
    track_id: Annotated[int, Path(ge=1)],
    link_id: Annotated[int, Path(ge=1)],
    db: Db,
    current_user: CurrentUser,
):
    _ = track_service.require_track(db, track_id, current_user.user_id)
    track_service.remove_link(db, link_id, current_user.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
