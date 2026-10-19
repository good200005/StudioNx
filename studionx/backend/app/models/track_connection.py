"""track_connections 테이블 (DB.md §3.2, db/02_phase2_sequencer.sql) — S1-10a, FR-2197.

트랙에서 다른 트랙으로 보내는 연결(Connect to Another) 한 건을 담는다. 보내는 트랙
하나에 연결은 하나뿐이다(DB 의 UNIQUE uq_connections_from). 그래서 저장은 "새로 만들기"
가 아니라 "지금 값을 통째로 바꾸기"로 다룬다.

- target: 받는 쪽에서 무엇으로 받을지 PLUGIN(이펙트 입력) 또는 INSTRUMENTS(악기 입력)로
  정한다. 화면은 이 값에 따라 엿듣기(사이드체인·변조 등) 칸을 켠다 (FR-2197).
- to_track_plugin_id: target 이 PLUGIN 일 때 받는 트랙의 이펙트 한 칸. 없으면 null.
- to_port: 받는 트랙의 입력 번호. 기본 1.
- also_play: null 이면 받는 쪽이 소리도 내는지 자동으로 정한다. 켜짐/꺼짐을 직접 정하면
  true/false 가 들어간다.
- 보내는 트랙이나 받는 트랙을 지우면 DB 의 ON DELETE CASCADE 로 함께 지워진다.
  그래서 "받는 트랙을 지우면 연결이 None 으로 돌아간다"가 따로 코드 없이 지켜진다.
"""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import BigInteger, Boolean, Enum, ForeignKey, Numeric, text
from sqlalchemy.dialects.mysql import DATETIME, TINYINT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ConnectionTarget(StrEnum):
    """받는 쪽에서 무엇으로 받을지. PLUGIN 이면 이펙트 입력, INSTRUMENTS 면 악기 입력이다."""

    PLUGIN = "PLUGIN"
    INSTRUMENTS = "INSTRUMENTS"


class TrackConnection(Base):
    """트랙 → 트랙 연결 한 건. 보내는 트랙마다 최대 하나다 (UNIQUE from_track_id)."""

    __tablename__ = "track_connections"

    connection_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    from_track_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tracks.track_id", ondelete="CASCADE")
    )
    to_track_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tracks.track_id", ondelete="CASCADE")
    )
    target: Mapped[ConnectionTarget] = mapped_column(
        Enum(ConnectionTarget), server_default=ConnectionTarget.PLUGIN
    )
    to_track_plugin_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("track_plugins.track_plugin_id", ondelete="CASCADE")
    )
    to_port: Mapped[int] = mapped_column(TINYINT(unsigned=True), server_default=text("1"))
    also_play: Mapped[bool | None] = mapped_column(Boolean)
    volume_db: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default=text("0.00"))
    pan: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("0.00"))
    is_solo: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
