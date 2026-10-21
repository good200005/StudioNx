"""tempo_changes 테이블 (DB.md §3.3, db/02_phase2_sequencer.sql) — S1-13, FR-202a.

곡 중간의 템포 변경점 한 건. 시작 템포는 projects.bpm 이고(tick 0), 이 표는 그 뒤의 변경점만
가진다. tick 은 그대로이고 실제 시간(초)은 이 지도로 계산한다
(audio/timing.js 의 ticksToSecondsWithChanges).

- tick: 변경 위치 (> 0, 1박 = 960 tick). 한 프로젝트에서 같은 위치는 하나만 (UNIQUE).
- bpm: 20.00 ~ 300.00 (DB CHECK).
- ramp: STEP = 이 위치에서 바로 바뀜 / LINEAR = 직전 변경점부터 이 위치까지 서서히 바뀜.
- 프로젝트를 지우면 DB 의 ON DELETE CASCADE 로 함께 지워진다.
"""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import BigInteger, Enum, ForeignKey, Numeric, text
from sqlalchemy.dialects.mysql import DATETIME, INTEGER
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class TempoRamp(StrEnum):
    """템포가 바뀌는 방식."""

    STEP = "STEP"
    LINEAR = "LINEAR"


class TempoChange(Base):
    """템포 변경점. 프로젝트마다 여러 개를 가진다."""

    __tablename__ = "tempo_changes"

    tempo_change_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.project_id", ondelete="CASCADE")
    )
    tick: Mapped[int] = mapped_column(INTEGER(unsigned=True))
    bpm: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    ramp: Mapped[TempoRamp] = mapped_column(
        Enum(TempoRamp, native_enum=True), server_default=text("'STEP'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
