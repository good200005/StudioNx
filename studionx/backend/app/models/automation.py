"""automation_lanes · automation_points 테이블 (db/02_phase2_sequencer.sql) — S1-15.

트랙의 한 파라미터(볼륨, 팬, 악기·장치 노브)를 시간에 따라 바꾸는 곡선을 담는다.
레인 하나가 대상 하나이고, 점(tick, value, curve)이 곡선을 이룬다. value 는 실제 단위
(볼륨 dB, 팬 -1~1, 노브는 그 노브의 값)이고 curve 는 다음 점까지의 휘어짐(-1~1)이다.
"""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import BigInteger, Boolean, Enum, ForeignKey, Numeric, text
from sqlalchemy.dialects.mysql import DATETIME, INTEGER, SMALLINT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AutomationTarget(StrEnum):
    VOLUME = "VOLUME"
    PAN = "PAN"
    INSTRUMENT_PARAM = "INSTRUMENT_PARAM"
    DEVICE_PARAM = "DEVICE_PARAM"


class AutomationLane(Base):
    __tablename__ = "automation_lanes"

    lane_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    track_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tracks.track_id", ondelete="CASCADE")
    )
    target_type: Mapped[AutomationTarget] = mapped_column(Enum(AutomationTarget))
    track_plugin_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("track_plugins.track_plugin_id", ondelete="CASCADE")
    )
    track_instrument_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("track_instruments.track_instrument_id", ondelete="CASCADE")
    )
    param_index: Mapped[int | None] = mapped_column(SMALLINT(unsigned=True))
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )


class AutomationPoint(Base):
    __tablename__ = "automation_points"

    point_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lane_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("automation_lanes.lane_id", ondelete="CASCADE")
    )
    tick: Mapped[int] = mapped_column(INTEGER(unsigned=True))
    value: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    curve: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("0.00"))
