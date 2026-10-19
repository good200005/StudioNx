"""clips 테이블 (DB.md §3.3, db/02_phase2_sequencer.sql) — S1-10a, FR-2196.

타임라인에 놓은 클립 한 건을 담는다. 클립은 두 가지다.

- MIDI 클립: pattern_id 로 패턴을 가리킨다. 노트는 패턴(midi_notes)에 있고, 클립은
  "그 패턴을 어디서부터 얼마나 재생할지"만 정한다. 그래서 같은 패턴을 여러 클립이
  가리킬 수 있고, 패턴 노트를 고치면 그 패턴을 쓰는 클립이 모두 함께 바뀐다 (FR-2196).
- AUDIO 클립: sample_id 로 오디오 파일을 가리킨다.

DB 의 CHECK(chk_clips_kind)가 이 규칙을 지킨다 — MIDI 는 pattern_id 만, AUDIO 는
sample_id 만 가진다. 나머지 칸(페이드·워프·피치·역재생)은 Phase 2 재생 확장용이다.

- start_tick / length_tick / offset_tick: 타임라인 위치와 길이, 안에서 읽기 시작할 위치.
- 트랙을 지우면 DB 의 ON DELETE CASCADE 로 함께 지워진다. 패턴·샘플을 지우면 그 클립이
  남아 있는 한 DB 가 막는다(RESTRICT) — 그래서 패턴 삭제는 클립이 없을 때만 된다.
"""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Enum,
    FetchedValue,
    ForeignKey,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.mysql import DATETIME, INTEGER
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ClipType(StrEnum):
    AUDIO = "AUDIO"
    MIDI = "MIDI"


class WarpMode(StrEnum):
    """오디오 클립의 시간 늘리기 방식 (FR-2196). BEATS 는 박자를 맞춰 늘린다."""

    OFF = "OFF"
    BEATS = "BEATS"
    TONES = "TONES"
    TEXTURE = "TEXTURE"
    REPITCH = "REPITCH"
    COMPLEX = "COMPLEX"


class Clip(Base):
    """타임라인 클립 한 건. MIDI 는 pattern_id, AUDIO 는 sample_id 를 가진다."""

    __tablename__ = "clips"

    clip_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    track_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tracks.track_id", ondelete="CASCADE")
    )
    clip_type: Mapped[ClipType] = mapped_column(Enum(ClipType))
    sample_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("samples.sample_id"))
    pattern_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("patterns.pattern_id")
    )
    name: Mapped[str | None] = mapped_column(String(100))
    start_tick: Mapped[int] = mapped_column(INTEGER(unsigned=True))
    length_tick: Mapped[int] = mapped_column(INTEGER(unsigned=True))
    offset_tick: Mapped[int] = mapped_column(INTEGER(unsigned=True), server_default=text("0"))
    gain_db: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default=text("0.00"))
    is_looped: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    fade_in_tick: Mapped[int] = mapped_column(INTEGER(unsigned=True), server_default=text("0"))
    fade_out_tick: Mapped[int] = mapped_column(INTEGER(unsigned=True), server_default=text("0"))
    fade_in_curve: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("0.00"))
    fade_out_curve: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("0.00"))
    warp_mode: Mapped[WarpMode] = mapped_column(
        Enum(WarpMode), server_default=WarpMode.BEATS
    )
    warp_markers: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    pitch_semitones: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default=text("0.00"))
    is_reversed: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"), server_onupdate=FetchedValue()
    )
