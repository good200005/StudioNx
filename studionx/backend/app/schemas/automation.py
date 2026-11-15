"""오토메이션 API 모양 — S1-15."""

from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models.automation import AutomationTarget

POINTS_MAX = 5000


class AutomationPointInput(BaseModel):
    tick: Annotated[int, Field(ge=0)]
    value: Annotated[Decimal, Field(ge=-100000, le=100000, decimal_places=4)]
    curve: Annotated[Decimal, Field(ge=-1, le=1, decimal_places=2)] = Decimal("0.00")


class AutomationPointItem(AutomationPointInput):
    model_config = ConfigDict(from_attributes=True)

    point_id: int


class AutomationLaneSaveRequest(BaseModel):
    """PUT /tracks/{id}/automation — 대상 하나의 곡선을 통째로 저장. 점이 없으면 레인을 지운다."""

    target_type: AutomationTarget
    track_plugin_id: Annotated[int, Field(ge=1)] | None = None
    track_instrument_id: Annotated[int, Field(ge=1)] | None = None
    param_index: Annotated[int, Field(ge=0, le=65535)] | None = None
    is_enabled: bool = True
    points: list[AutomationPointInput] = Field(default_factory=list, max_length=POINTS_MAX)


class AutomationLaneResponse(BaseModel):
    lane_id: int
    track_id: int
    target_type: AutomationTarget
    track_plugin_id: int | None
    track_instrument_id: int | None
    param_index: int | None
    is_enabled: bool
    points: list[AutomationPointItem]
