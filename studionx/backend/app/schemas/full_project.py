"""프로젝트 전체(시퀀서 한 화면) 조회·곡 설정 스키마 — S1-10 (FR-253·254).

시퀀서는 화면을 열 때 `GET /projects/{id}/full` 한 번으로 곡 전체를 받는다.
그래서 여기의 응답(FullProjectResponse)은 프로젝트 설정, 트랙과 그 안의 악기·이펙트·연결선,
트랙 간 연결, 패턴과 그 노트, 그리고 클립을 한 덩어리에 담는다.

아직 DB 모델이 없는 것들(markers · tempo_changes · meter_changes)은 응답에 빈 목록으로
넣어 둔다. 화면이 이 칸들을 늘 읽으므로, 나중에 그 모델과 API 가 생기면 여기 목록만
채우면 화면을 고치지 않아도 된다.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.clip import ClipResponse
from app.schemas.connection import TrackConnectionResponse
from app.schemas.device import (
    TrackInstrumentResponse,
    TrackPluginLinkResponse,
    TrackPluginResponse,
)
from app.schemas.pattern import PatternResponse
from app.schemas.track import TrackResponse

# 곡 설정(BPM·박자·Key·마스터) 수정에서 허용하는 범위
BPM_MIN = 20
BPM_MAX = 300
SAMPLE_RATE_MIN = 8000
SAMPLE_RATE_MAX = 192000
TIME_SIG_MAX = 16


class FullProjectInfo(BaseModel):
    """GET /projects/{id}/full 의 project 칸 — 화면을 세우는 데 필요한 프로젝트 값 전부.

    목록 한 줄(ProjectItem)에 없는 곡 설정(scale_mode · sample_rate · master_settings ·
    revision)까지 담는다. revision 은 나중에 동시 편집(S3-02)이 어긋남을 알아채는 데 쓴다.
    """

    project_id: int
    title: str
    description: str | None
    bpm: Decimal
    time_sig_num: int
    time_sig_den: int
    music_key: str | None
    scale_mode: str | None
    sample_rate: int
    master_settings: dict[str, Any] | None
    revision: int
    my_role: str
    member_count: int
    opened: bool
    created_at: datetime
    updated_at: datetime


class FullTrackResponse(TrackResponse):
    """트랙 한 줄에 그 안의 장치와 나가는 연결을 붙인 모양 (FR-245·263·267·269·2197).

    instruments 는 악기 칸(slot_index 순), effects 는 이펙트 체인(slot_index 순),
    links 는 갈래 연결선이다. connections 는 이 트랙에서 다른 트랙으로 나가는 연결
    (0~1개, FR-2197) — 받는 쪽 연결은 다른 트랙의 connections 에 있으므로 화면이 모아 본다.
    화면의 악기·이펙트 칸(sequencer-devices.js)이 트랙마다 따로 세 번 요청하던 것을
    이 한 덩어리로 대신한다.
    """

    instruments: list[TrackInstrumentResponse]
    effects: list[TrackPluginResponse]
    links: list[TrackPluginLinkResponse]
    connections: list[TrackConnectionResponse]


class FullProjectResponse(BaseModel):
    """GET /projects/{id}/full 응답 — 한 번의 요청으로 곡 전체 (FR-254).

    clips 는 프로젝트의 모든 클립(track_id 로 트랙에 묶임), connections 는 각 트랙의
    나가는 연결이다. markers · tempo_changes · meter_changes 는 그 표와 API 가 아직 없어
    늘 빈 목록이다.
    """

    project: FullProjectInfo
    tracks: list[FullTrackResponse]
    patterns: list[PatternResponse]
    clips: list[ClipResponse] = Field(default_factory=list)
    markers: list[dict[str, Any]] = Field(default_factory=list)
    tempo_changes: list[dict[str, Any]] = Field(default_factory=list)
    meter_changes: list[dict[str, Any]] = Field(default_factory=list)


class FullProjectSettingsUpdateRequest(BaseModel):
    """PATCH /projects/{id}/settings — 화면이 저장하는 곡 전체 설정 (FR-253).

    보내지 않은 칸은 그대로 두고, 보낸 칸만 바꾼다 (exclude_unset).
    """

    bpm: Decimal | None = Field(default=None, ge=BPM_MIN, le=BPM_MAX, decimal_places=2)
    time_sig_num: int | None = Field(default=None, ge=1, le=TIME_SIG_MAX)
    time_sig_den: int | None = Field(default=None, ge=1, le=TIME_SIG_MAX)
    music_key: str | None = Field(default=None, max_length=10)
    scale_mode: str | None = Field(default=None, max_length=20)
    sample_rate: int | None = Field(default=None, ge=SAMPLE_RATE_MIN, le=SAMPLE_RATE_MAX)
    master_settings: dict[str, Any] | None = None
