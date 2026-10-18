"""트랙 스키마 — S1-09 (FR-251·263·264)."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TrackType = Literal["AUDIO", "MIDI", "MASTER", "GROUP", "RETURN"]
RoutingMode = Literal["CHAIN", "PATCHER"]


class TrackBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    track_type: TrackType = "MIDI"
    color: str = Field(default="#7C5CFF", pattern=r"^#[0-9A-Fa-f]{6}$")
    volume_db: Decimal = Field(default=Decimal("0.00"), ge=-60, le=24)
    pan: Decimal = Field(default=Decimal("0.00"), ge=-1, le=1)
    is_muted: bool = False
    is_solo: bool = False
    is_enabled: bool = True
    routing_mode: RoutingMode = "CHAIN"


class TrackCreateRequest(TrackBase):
    project_id: int = Field(ge=1)
    order_index: int = Field(default=0, ge=0)
    parent_track_id: int | None = None


class TrackUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    volume_db: Decimal | None = Field(default=None, ge=-60, le=24)
    pan: Decimal | None = Field(default=None, ge=-1, le=1)
    is_muted: bool | None = None
    is_solo: bool | None = None
    is_enabled: bool | None = None
    routing_mode: RoutingMode | None = None
    order_index: int | None = Field(default=None, ge=0)
    parent_track_id: int | None = None


class TrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    track_id: int
    project_id: int
    name: str
    track_type: TrackType
    order_index: int
    color: str
    volume_db: Decimal
    pan: Decimal
    is_muted: bool
    is_solo: bool
    is_enabled: bool
    parent_track_id: int | None
    frozen_sample_id: int | None
    routing_mode: RoutingMode
    assignee_id: int | None
    locked_by: int | None
    locked_at: str | None = None


class TrackListResponse(BaseModel):
    items: list[TrackResponse]
    total: int
