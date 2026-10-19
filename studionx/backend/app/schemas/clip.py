"""클립(타임라인) 요청·응답 — S1-10a, FR-2196.

클립은 MIDI(패턴)와 AUDIO(샘플) 두 가지다. DB 의 CHECK(chk_clips_kind)와 같은 규칙을
요청에서도 지킨다 — MIDI 는 pattern_id 만, AUDIO 는 sample_id 만 가진다. 그래서 만들 때
(MIDI/AUDIO) 어긋나면 422 로 막고, DB 까지 가지 않는다.

칸 이름은 DB(clips)와 화면(sequencer-arrange.js)의 tick 기준을 그대로 쓴다:
start_tick · length_tick · offset_tick (1박 = 960 tick).
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

# 클립 종류 (DB ENUM 과 같음)
ClipType = Literal["AUDIO", "MIDI"]
# 오디오 클립의 시간 늘리기 방식 (DB ENUM 과 같음)
WarpMode = Literal["OFF", "BEATS", "TONES", "TEXTURE", "REPITCH", "COMPLEX"]

CLIP_NAME_MAX = 100  # clips.name 칸 길이(DB VARCHAR(100))와 같음

# 이름 — 앞뒤 공백을 지우고 길이를 잰다. 안 보내면 이름 없음(null)으로 둔다.
ClipName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=CLIP_NAME_MAX)
]


class ClipCreateRequest(BaseModel):
    """POST /tracks/{id}/clips — 타임라인에 클립을 놓는다.

    MIDI 클립은 pattern_id 를, AUDIO 클립은 sample_id 를 반드시 보낸다 (반대쪽은 비운다).
    """

    clip_type: ClipType
    pattern_id: int | None = Field(default=None, ge=1)
    sample_id: int | None = Field(default=None, ge=1)
    name: ClipName | None = None
    start_tick: int = Field(ge=0)
    length_tick: int = Field(ge=1)
    offset_tick: int = Field(default=0, ge=0)
    gain_db: Decimal = Field(default=Decimal("0.00"), ge=-60, le=24)
    is_looped: bool = False
    fade_in_tick: int = Field(default=0, ge=0)
    fade_out_tick: int = Field(default=0, ge=0)
    fade_in_curve: Decimal = Field(default=Decimal("0.00"), ge=-1, le=1)
    fade_out_curve: Decimal = Field(default=Decimal("0.00"), ge=-1, le=1)
    warp_mode: WarpMode = "BEATS"
    warp_markers: dict[str, Any] | None = None
    pitch_semitones: Decimal = Field(default=Decimal("0.00"), ge=-48, le=48)
    is_reversed: bool = False

    @model_validator(mode="after")
    def _kind_matches_ids(self) -> Self:
        """MIDI 는 pattern_id 만, AUDIO 는 sample_id 만 — DB CHECK 와 같은 규칙."""
        if self.clip_type == "MIDI":
            if self.pattern_id is None or self.sample_id is not None:
                raise ValueError("MIDI clip needs pattern_id only")
        elif self.sample_id is None or self.pattern_id is not None:
            raise ValueError("AUDIO clip needs sample_id only")
        return self


class ClipUpdateRequest(BaseModel):
    """PATCH /clips/{id} — 클립의 위치·길이·페이드·워프 등. 보낸 칸만 바꾼다.

    클립 종류·가리키는 패턴/샘플은 여기서 바꾸지 않는다 (다른 클립을 만들어야 한다).
    """

    name: ClipName | None = None
    start_tick: int | None = Field(default=None, ge=0)
    length_tick: int | None = Field(default=None, ge=1)
    offset_tick: int | None = Field(default=None, ge=0)
    gain_db: Decimal | None = Field(default=None, ge=-60, le=24)
    is_looped: bool | None = None
    fade_in_tick: int | None = Field(default=None, ge=0)
    fade_out_tick: int | None = Field(default=None, ge=0)
    fade_in_curve: Decimal | None = Field(default=None, ge=-1, le=1)
    fade_out_curve: Decimal | None = Field(default=None, ge=-1, le=1)
    warp_mode: WarpMode | None = None
    warp_markers: dict[str, Any] | None = None
    pitch_semitones: Decimal | None = Field(default=None, ge=-48, le=48)
    is_reversed: bool | None = None


class ClipResponse(BaseModel):
    """클립 한 건 — 전체 조회(/full)와 클립 목록·저장 응답이 모두 이 모양을 쓴다."""

    model_config = ConfigDict(from_attributes=True)

    clip_id: int
    track_id: int
    clip_type: ClipType
    sample_id: int | None
    pattern_id: int | None
    name: str | None
    start_tick: int
    length_tick: int
    offset_tick: int
    gain_db: Decimal
    is_looped: bool
    fade_in_tick: int
    fade_out_tick: int
    fade_in_curve: Decimal
    fade_out_curve: Decimal
    warp_mode: WarpMode
    warp_markers: dict[str, Any] | None
    pitch_semitones: Decimal
    is_reversed: bool
    updated_at: datetime
