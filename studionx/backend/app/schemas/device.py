"""디바이스(악기/이펙트/연결선) 관련 요청/응답 — S1-09 (FR-245·251·263·267·269)."""

from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

RoutingMode = Literal["CHAIN", "PATCHER"]


class TrackInstrumentCreateRequest(BaseModel):
    plugin_id: int = Field(ge=1)
    slot_index: int = Field(ge=0, le=127, default=0)
    params: dict[str, Any] | None = None
    volume_db: Decimal = Field(default=Decimal("0.00"), ge=-60, le=24)
    pan: Decimal = Field(default=Decimal("0.00"), ge=-1, le=1)
    is_solo: bool = False
    is_enabled: bool = True


class TrackInstrumentUpdateRequest(BaseModel):
    slot_index: int | None = Field(default=None, ge=0, le=127)
    params: dict[str, Any] | None = None
    volume_db: Decimal | None = Field(default=None, ge=-60, le=24)
    pan: Decimal | None = Field(default=None, ge=-1, le=1)
    is_solo: bool | None = None
    is_enabled: bool | None = None


class TrackInstrumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    track_instrument_id: int
    track_id: int
    plugin_id: int
    slot_index: int
    params: dict[str, Any] | None
    volume_db: Decimal
    pan: Decimal
    is_solo: bool
    is_enabled: bool


class TrackPluginCreateRequest(BaseModel):
    plugin_id: int = Field(ge=1)
    slot_index: int = Field(ge=0, le=127, default=0)
    node_x: int | None = None
    node_y: int | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    is_bypassed: bool = False


class TrackPluginUpdateRequest(BaseModel):
    slot_index: int | None = Field(default=None, ge=0, le=127)
    node_x: int | None = None
    node_y: int | None = None
    params: dict[str, Any] | None = None
    is_bypassed: bool | None = None


class TrackPluginResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    track_plugin_id: int
    track_id: int
    plugin_id: int
    slot_index: int
    node_x: int | None
    node_y: int | None
    params: dict[str, Any]
    is_bypassed: bool


class TrackPluginLinkCreateRequest(BaseModel):
    from_track_plugin_id: int | None = None
    from_port: int = Field(default=0, ge=0, le=15)
    to_track_plugin_id: int | None = None
    to_port: int = Field(default=0, ge=0, le=15)
    gain_db: Decimal = Field(default=Decimal("0.00"), ge=-60, le=24)


class TrackPluginLinkUpdateRequest(BaseModel):
    from_track_plugin_id: int | None = None
    from_port: int | None = Field(default=None, ge=0, le=15)
    to_track_plugin_id: int | None = None
    to_port: int | None = Field(default=None, ge=0, le=15)
    gain_db: Decimal | None = Field(default=None, ge=-60, le=24)


class TrackPluginLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    link_id: int
    track_id: int
    from_track_plugin_id: int | None
    from_port: int
    to_track_plugin_id: int | None
    to_port: int
    gain_db: Decimal
