"""track_plugins · track_plugin_links · track_instruments 테이블 — S1-09 (FR-245·263·267·269).

트랙의 소리 만들기 구성을 담는 세 표입니다.

- track_instruments: 트랙의 악기(가상악기) 한 칸. params 에 그 악기의 파라미터가 들어간다.
- track_plugins: 트랙의 이펙트 한 칸. slot_index 로 체인 순서를 정한다 (CHAIN 방식).
  node_x·node_y 는 갈래(패처) 화면에서 카드를 놓은 자리다 (FR-269).
- track_plugin_links: 갈래를 나누고 합치는 연결선 (PATCHER 방식, FR-267·269).
  from 하나에서 to 여럿으로 나가면 갈래, to 하나로 모이면 병합이다.
  from/to 가 NULL 이면 트랙 입력(소스) 또는 트랙 출력을 뜻한다.

트랙을 지우면 DB 의 ON DELETE CASCADE 로 함께 지워진다.
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    FetchedValue,
    ForeignKey,
    Numeric,
    text,
)
from sqlalchemy.dialects.mysql import DATETIME, INTEGER, TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:  # 타입 표시용 (실행 중에는 불러오지 않음 — 순환을 피함)
    from app.models.plugin import Plugin
    from app.models.track import Track


class TrackInstrument(Base):
    """트랙의 악기 한 칸 (track_instruments). 한 트랙에 여러 악기를 겹쳐 둘 수 있다 (레이어)."""

    __tablename__ = "track_instruments"

    track_instrument_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    track_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tracks.track_id", ondelete="CASCADE")
    )
    plugin_id: Mapped[int] = mapped_column(INTEGER(unsigned=True), ForeignKey("plugins.plugin_id"))
    slot_index: Mapped[int] = mapped_column(TINYINT(unsigned=True), server_default=text("0"))
    params: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    volume_db: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default=text("0.00"))
    pan: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("0.00"))
    is_solo: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"), server_onupdate=FetchedValue()
    )

    track: Mapped["Track"] = relationship(back_populates="instruments")
    plugin: Mapped["Plugin"] = relationship(back_populates="track_instruments")


class TrackPlugin(Base):
    """트랙의 이펙트 한 칸 (track_plugins). slot_index 순서가 체인 순서다."""

    __tablename__ = "track_plugins"

    track_plugin_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    track_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tracks.track_id", ondelete="CASCADE")
    )
    plugin_id: Mapped[int] = mapped_column(INTEGER(unsigned=True), ForeignKey("plugins.plugin_id"))
    slot_index: Mapped[int] = mapped_column(TINYINT(unsigned=True))
    node_x: Mapped[int | None] = mapped_column(INTEGER)
    node_y: Mapped[int | None] = mapped_column(INTEGER)
    params: Mapped[dict[str, Any]] = mapped_column(JSON)
    is_bypassed: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"), server_onupdate=FetchedValue()
    )

    track: Mapped["Track"] = relationship(back_populates="plugins")
    plugin: Mapped["Plugin"] = relationship(back_populates="track_plugins")


class TrackPluginLink(Base):
    """이펙트 연결선 (track_plugin_links). 갈래를 나누고(1→N) 합치는(N→1) 데 쓴다.

    from/to 가 NULL 이면 트랙 입력(소스) 또는 트랙 출력을 뜻한다 (FR-267·269).
    """

    __tablename__ = "track_plugin_links"

    link_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    track_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tracks.track_id", ondelete="CASCADE")
    )
    from_track_plugin_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("track_plugins.track_plugin_id", ondelete="CASCADE")
    )
    from_port: Mapped[int] = mapped_column(TINYINT(unsigned=True), server_default=text("0"))
    to_track_plugin_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("track_plugins.track_plugin_id", ondelete="CASCADE")
    )
    to_port: Mapped[int] = mapped_column(TINYINT(unsigned=True), server_default=text("0"))
    gain_db: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default=text("0.00"))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )

    track: Mapped["Track"] = relationship(back_populates="plugin_links")
