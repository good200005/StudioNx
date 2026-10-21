"""템포 변경점 API 요청·응답 스키마 (PRD 02 FR-202a) — 오디오 엔진(timing.js)이 읽는 모양.

변경점 한 건은 { tick, bpm, ramp } 이다. 시작 템포(tick 0)는 projects.bpm 이라 여기에 넣지 않는다.
템포 줄(Tempo lane)은 점 전체를 한 번에 고치는 편집이라, 요청은 목록을 통째로 보내 교체한다
(노트를 통째로 바꾸는 PUT /patterns/{id}/notes 와 같은 방식).

응답의 bpm 은 숫자(float)다. audio/timing.js 가 숫자만 받기 때문이다
(프로젝트 설정의 bpm 은 문자열).
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

TEMPO_BPM_MIN = 20  # DB CHECK (chk_tempo_bpm) 와 같음
TEMPO_BPM_MAX = 300
TEMPO_CHANGES_MAX = 500  # 한 프로젝트의 변경점 최대 개수 (실수로 큰 목록을 보내는 것 방지)

# 변경 위치 — 1 이상 (0 은 시작 템포 projects.bpm 의 자리. DB CHECK chk_tempo_tick)
TempoTick = Annotated[int, Field(ge=1, le=4294967295)]
TempoBpm = Annotated[float, Field(ge=TEMPO_BPM_MIN, le=TEMPO_BPM_MAX)]


class TempoChangeInput(BaseModel):
    """템포 줄이 보내는 변경점 한 건."""

    tick: TempoTick
    bpm: TempoBpm
    ramp: Literal["STEP", "LINEAR"] = "STEP"

    @field_validator("bpm")
    @classmethod
    def round_bpm(cls, value: float) -> float:
        """DB 칸(DECIMAL(6,2))에 맞춰 소수 둘째 자리까지만 쓴다."""
        return round(value, 2)


class TempoChangeItem(TempoChangeInput):
    """응답 변경점 한 건 — TempoChangeInput 에 번호를 더한 모양."""

    tempo_change_id: int


class TempoChangesSaveRequest(BaseModel):
    """PUT /projects/{id}/tempo-changes — 이 프로젝트의 템포 변경점을 보낸 목록으로 통째 교체."""

    changes: list[TempoChangeInput] = Field(default_factory=list, max_length=TEMPO_CHANGES_MAX)

    @model_validator(mode="after")
    def no_duplicate_ticks(self) -> "TempoChangesSaveRequest":
        """같은 위치에 변경점이 둘이면 거부한다 (DB UNIQUE(project_id, tick) 와 같은 규칙)."""
        ticks = [change.tick for change in self.changes]
        if len(ticks) != len(set(ticks)):
            raise ValueError("tempo changes must have distinct ticks")
        return self


class TempoChangesResponse(BaseModel):
    """템포 변경점 목록 — tick 오름차순."""

    items: list[TempoChangeItem]
    total: int
