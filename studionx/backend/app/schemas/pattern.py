"""패턴 API 요청·응답 스키마 (PRD 02 §4.16~4.17, FR-231~233) — 피아노롤과 이름을 맞춤.

패턴 한 건(PatternResponse)은 노트 목록을 함께 담는다. 노트를 통째로 바꾸는 요청
(NotesSaveRequest)은 피아노롤이 바뀔 때마다 화면의 노트 전부를 다시 보낸다.

칸 이름은 DB(midi_notes)와 피아노롤(sequencer-roll.js)의 이름을 그대로 쓴다:
start_tick · length_tick · pitch · velocity.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

PATTERN_NAME_MAX = 100  # patterns.name 칸 길이(DB VARCHAR(100))와 같음
PATTERN_COLOR_MAX = 7  # '#RRGGBB'
NOTES_MAX = 5000  # 한 패턴에 넣을 수 있는 노트 최대 개수 (실수로 큰 목록을 보내는 것 방지)

# 이름 — 앞뒤 공백을 먼저 지우고 길이를 잼 → 공백만 친 이름은 422 (SampleName 과 같은 방법)
PatternName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=PATTERN_NAME_MAX)
]

# 음높이 — MIDI 0~127 (60 = C4)
Pitch = Annotated[int, Field(ge=0, le=127)]
# 세기 — 1~127 (DB CHECK 와 같음)
Velocity = Annotated[int, Field(ge=1, le=127)]
# 시작 위치 — 0 이상 (1박 = 960 tick)
StartTick = Annotated[int, Field(ge=0)]
# 길이 — 1 이상 (0 길이 노트는 뜻이 없음)
LengthTick = Annotated[int, Field(ge=1)]
# 채널 — MIDI 0~15
Channel = Annotated[int, Field(ge=0, le=15)]


class NoteInput(BaseModel):
    """피아노롤이 보내는 노트 한 건. note_id 는 받지 않는다 (통째 교체라 새로 매긴다)."""

    pitch: Pitch
    start_tick: StartTick
    length_tick: LengthTick
    velocity: Velocity = 100
    channel: Channel = 0
    release_velocity: Annotated[int, Field(ge=0, le=127)] = 64
    is_muted: bool = False
    probability: Decimal = Field(default=Decimal("1.00"), ge=0, le=1, decimal_places=2)
    velocity_deviation: Annotated[int, Field(ge=0, le=127)] = 0


class NoteItem(NoteInput):
    """응답 노트 한 건 — NoteInput 에 note_id 를 더한 모양."""

    note_id: int


class NotesSaveRequest(BaseModel):
    """PUT /patterns/{id}/notes — 이 패턴의 노트를 보낸 목록으로 통째 교체."""

    notes: list[NoteInput] = Field(default_factory=list, max_length=NOTES_MAX)


class PatternUpdateRequest(BaseModel):
    """PATCH /patterns/{id} — 이름·색·길이·스윙. 보내지 않은 칸은 바꾸지 않음."""

    name: PatternName | None = None
    color: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=PATTERN_COLOR_MAX)]
        | None
    ) = None
    length_tick: Annotated[int, Field(ge=1)] | None = None
    swing: Annotated[Decimal, Field(ge=0, le=1, decimal_places=2)] | None = None

    @field_validator("name")
    @classmethod
    def _name_not_null(cls, value: str | None) -> str:
        # 보내지 않으면 이 검사는 돌지 않음 (기본값은 검사하지 않음) → null 을 직접 보낸 경우만
        if value is None:
            raise ValueError("name cannot be empty")
        return value


class PatternCreateRequest(BaseModel):
    """POST /patterns — 새 빈 패턴을 만든다. 노트는 나중에 피아노롤로 채운다."""

    project_id: int = Field(ge=1)
    name: PatternName
    color: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=PATTERN_COLOR_MAX)]
        | None
    ) = None
    length_tick: Annotated[int, Field(ge=1)] = 3840
    swing: Annotated[Decimal, Field(ge=0, le=1, decimal_places=2)] = Decimal("0.00")


class PatternResponse(BaseModel):
    """패턴 한 건 — 목록·상세·노트 저장 응답이 모두 이 모양을 쓴다."""

    pattern_id: int
    project_id: int
    name: str
    color: str | None
    length_tick: int
    swing: Decimal
    updated_at: datetime
    notes: list[NoteItem]


class PatternListResponse(BaseModel):
    """GET /patterns?project_id= — 그 프로젝트의 패턴 목록.

    목록에서는 가볍게 하려고 notes 가 늘 빈 목록이다. 노트가 필요하면 상세로 받는다.
    """

    items: list[PatternResponse]
    total: int
