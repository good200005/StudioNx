"""patterns 테이블 (DB.md §3.3, db/02_phase2_sequencer.sql) — S1-08, FR-231~233.

MIDI 클립이 가리키는 노트 묶음(패턴) 한 건의 정보를 담는다. 노트 자체는 자식 표
(midi_notes)에 있고, 이 행은 이름·길이·스윙만 가진다.

- length_tick: 패턴 길이(1박 = 960 tick). 기본 3840 = 4박.
- swing: 0.00~1.00 (DB CHECK). 0이면 곧은 박자.
- 프로젝트를 지우면 DB 의 ON DELETE CASCADE 로 함께 지워진다.
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, FetchedValue, ForeignKey, Numeric, String, text
from sqlalchemy.dialects.mysql import DATETIME, INTEGER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:  # 타입 표시용 (실행 중에는 불러오지 않음 — 순환을 피함)
    from app.models.midi_note import MidiNote
    from app.models.project import Project


class Pattern(Base):
    """MIDI 패턴. 프로젝트마다 여러 개를 가진다."""

    __tablename__ = "patterns"

    pattern_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.project_id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str | None] = mapped_column(String(7))
    length_tick: Mapped[int] = mapped_column(INTEGER(unsigned=True), server_default=text("3840"))
    swing: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("0.00"))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"), server_onupdate=FetchedValue()
    )

    # 관계 — 행을 지우는 일은 DB 의 ON DELETE CASCADE 에 맡김 (passive_deletes)
    project: Mapped["Project"] = relationship(back_populates="patterns")
    notes: Mapped[list["MidiNote"]] = relationship(
        back_populates="pattern",
        order_by="MidiNote.start_tick, MidiNote.pitch",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
