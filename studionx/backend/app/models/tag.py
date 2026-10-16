"""tags · sample_tags 테이블 (DB.md §3.2, db/02_phase2_sequencer.sql) — S1-07, FR-224·225.

tags 는 분류(GENRE · INSTRUMENT · MOOD · ETC)별 이름이고, is_system 은 기본 제공 태그인지
나타낸다. sample_tags 는 샘플과 태그를 잇는 표(다대다)이며, 둘 중 하나가 지워지면 함께 지워진다.
"""

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, Enum, ForeignKey, Integer, String, text
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:  # 타입 표시용 (실행 중에는 불러오지 않음 — 순환을 피함)
    from app.models.sample import Sample


class TagCategory(StrEnum):
    """태그 분류. 목록의 필터 묶음이 된다."""

    GENRE = "GENRE"
    INSTRUMENT = "INSTRUMENT"
    MOOD = "MOOD"
    ETC = "ETC"


class Tag(Base):
    """태그. 같은 분류 안에서 이름은 유일하다 (UNIQUE(category, name))."""

    __tablename__ = "tags"

    tag_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50))
    category: Mapped[TagCategory] = mapped_column(
        Enum(TagCategory), server_default=TagCategory.ETC
    )
    is_system: Mapped[bool] = mapped_column(Boolean, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )

    samples: Mapped[list["Sample"]] = relationship(
        secondary="sample_tags", back_populates="tags"
    )


class SampleTag(Base):
    """샘플과 태그의 연결 한 건. 복합 기본 키 (sample_id, tag_id)."""

    __tablename__ = "sample_tags"

    sample_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("samples.sample_id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tags.tag_id", ondelete="CASCADE"), primary_key=True
    )
