"""midi_notes 테이블 (DB.md §3.3, db/02_phase2_sequencer.sql) — S1-08, FR-231~233.

피아노롤에 찍은 노트 한 건. 패턴(patterns) 아래에 매달린다.

- pitch: MIDI 음높이 0~127 (60 = C4).
- start_tick / length_tick: 시작과 길이 (1박 = 960 tick).
- velocity / release_velocity: 세기 1~127 (DB CHECK).
- is_muted / probability / velocity_deviation: Phase 2 재생 확장 칸.
- 패턴을 지우면 DB 의 ON DELETE CASCADE 로 함께 지워진다.
"""

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, ForeignKey, Numeric, text
from sqlalchemy.dialects.mysql import INTEGER, TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:  # 타입 표시용 (실행 중에는 불러오지 않음 — 순환을 피함)
    from app.models.pattern import Pattern


class MidiNote(Base):
    """MIDI 노트 한 건 (피아노롤)."""

    __tablename__ = "midi_notes"

    note_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pattern_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("patterns.pattern_id", ondelete="CASCADE")
    )
    pitch: Mapped[int] = mapped_column(TINYINT(unsigned=True))
    velocity: Mapped[int] = mapped_column(TINYINT(unsigned=True), server_default=text("100"))
    start_tick: Mapped[int] = mapped_column(INTEGER(unsigned=True))
    length_tick: Mapped[int] = mapped_column(INTEGER(unsigned=True))
    channel: Mapped[int] = mapped_column(TINYINT(unsigned=True), server_default=text("0"))
    release_velocity: Mapped[int] = mapped_column(TINYINT(unsigned=True), server_default=text("64"))
    is_muted: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    probability: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("1.00"))
    velocity_deviation: Mapped[int] = mapped_column(
        TINYINT(unsigned=True), server_default=text("0")
    )

    pattern: Mapped["Pattern"] = relationship(back_populates="notes")
