"""Connect to Another(트랙 → 트랙 연결) 요청·응답 — S1-10a, FR-2197.

화면의 "Connect to Another" 칸은 세 가지를 고른다 — Connect(None/Connected) ·
Track(받는 트랙 번호) · Plugin(받는 이펙트). Connect 를 켜면 Track·Plugin 이 살아나고,
끄면 연결을 지운다. 그래서 저장은 만들기(POST)와 지우기(DELETE) 대신 통째로 맞추기(PUT)로 둔다.
"""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# 받는 쪽에서 무엇으로 받을지 (DB 의 ENUM 과 같음)
ConnectionTarget = Literal["PLUGIN", "INSTRUMENTS"]


class TrackConnectionSetRequest(BaseModel):
    """PUT /tracks/{id}/connection — 이 트랙에서 나가는 연결을 통째로 맞춘다.

    to_track_id 는 받는 트랙이다. target 이 PLUGIN 이면 to_track_plugin_id 로 그 트랙의
    이펙트 한 칸을 고른다(없으면 트랙 입력). INSTRUMENTS 면 악기 입력이라 이펙트는 없다.
    """

    to_track_id: int = Field(ge=1)
    target: ConnectionTarget = "PLUGIN"
    to_track_plugin_id: int | None = Field(default=None, ge=1)
    to_port: int = Field(default=1, ge=1, le=16)
    also_play: bool | None = None
    volume_db: Decimal = Field(default=Decimal("0.00"), ge=-60, le=24)
    pan: Decimal = Field(default=Decimal("0.00"), ge=-1, le=1)
    is_solo: bool = False


class TrackConnectionResponse(BaseModel):
    """연결 한 건 — 화면이 보낸 트랙의 연결을 다시 그릴 때 쓴다."""

    model_config = ConfigDict(from_attributes=True)

    connection_id: int
    from_track_id: int
    to_track_id: int
    target: ConnectionTarget
    to_track_plugin_id: int | None
    to_port: int
    also_play: bool | None
    volume_db: Decimal
    pan: Decimal
    is_solo: bool
