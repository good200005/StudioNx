"""박자 변경점 API 요청·응답 스키마 (PRD 02 FR-202b).

변경점 한 건은 { tick, time_sig_num, time_sig_den } 이다. 시작 박자(tick 0)는
projects.time_sig_num/den 이라 여기에 넣지 않는다. 템포 변경점과 같이 목록을 통째로 보내 교체한다.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

METER_CHANGES_MAX = 500

MeterTick = Annotated[int, Field(ge=1, le=4294967295)]
MeterNum = Annotated[int, Field(ge=1, le=32)]  # DB CHECK (chk_meter_num) 와 같음
MeterDen = Literal[1, 2, 4, 8, 16, 32]  # DB CHECK (chk_meter_den) 와 같음


class MeterChangeInput(BaseModel):
    """박자 줄이 보내는 변경점 한 건."""

    tick: MeterTick
    time_sig_num: MeterNum
    time_sig_den: MeterDen


class MeterChangeItem(MeterChangeInput):
    """응답 변경점 한 건 — MeterChangeInput 에 번호를 더한 모양."""

    meter_change_id: int


class MeterChangesSaveRequest(BaseModel):
    """PUT /projects/{id}/meter-changes — 이 프로젝트의 박자 변경점을 보낸 목록으로 통째 교체."""

    changes: list[MeterChangeInput] = Field(default_factory=list, max_length=METER_CHANGES_MAX)

    @model_validator(mode="after")
    def no_duplicate_ticks(self) -> "MeterChangesSaveRequest":
        """같은 위치에 변경점이 둘이면 거부한다 (DB UNIQUE(project_id, tick) 와 같은 규칙)."""
        ticks = [change.tick for change in self.changes]
        if len(ticks) != len(set(ticks)):
            raise ValueError("meter changes must have distinct ticks")
        return self


class MeterChangesResponse(BaseModel):
    """박자 변경점 목록 — tick 오름차순."""

    items: list[MeterChangeItem]
    total: int
