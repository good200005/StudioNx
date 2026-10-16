"""samples 테이블 (DB.md §3.2, db/02_phase2_sequencer.sql) — S1-07, FR-221~227.

사용자가 올린 샘플 파일 한 건의 정보를 담는다. 파일 자체는 디스크에 있고
(경로 규칙: samples/{owner_id}/{uuid}.{확장자}), 이 행은 그 정보와 파형 파일 경로만 가진다.
삭제는 소프트 삭제(deleted_at)이며, 이미 지운 샘플은 목록에서 빠진다.
"""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Enum,
    FetchedValue,
    ForeignKey,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.mysql import DATETIME, INTEGER, TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:  # 타입 표시용 (실행 중에는 불러오지 않음 — 순환을 피함)
    from app.models.tag import Tag


class SampleSource(StrEnum):
    """샘플이 생긴 경로. 지금은 사용자가 올린 UPLOAD만 쓰고, 나머지는 뒤 단계에서 쓴다."""

    UPLOAD = "UPLOAD"
    SEPARATION = "SEPARATION"
    EXPORT = "EXPORT"
    RECORDING = "RECORDING"
    BOUNCE = "BOUNCE"
    RESAMPLE = "RESAMPLE"


class Sample(Base):
    """샘플. file_path는 디스크 경로, waveform_path는 파형 미리보기 데이터 파일의 경로이다.

    duration_ms · sample_rate · channels 는 올릴 때 파일에서 읽어 채운다 (FR-223, 180번).
    읽지 못하는 파일은 업로드 단계에서 415로 거부되어 이 칸들이 비는 일은 없다.
    bpm · music_key 는 채우는 작업이 뒤에 있어 지금은 비어 있다.
    """

    __tablename__ = "samples"

    sample_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.user_id"), index=True
    )

    name: Mapped[str] = mapped_column(String(200))
    original_filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    mime_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(BigInteger)

    duration_ms: Mapped[int | None] = mapped_column(INTEGER(unsigned=True))
    sample_rate: Mapped[int | None] = mapped_column(INTEGER(unsigned=True))
    channels: Mapped[int | None] = mapped_column(TINYINT(unsigned=True))
    bpm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    music_key: Mapped[str | None] = mapped_column(String(10))
    waveform_path: Mapped[str | None] = mapped_column(String(500))

    source: Mapped[SampleSource] = mapped_column(
        Enum(SampleSource), server_default=SampleSource.UPLOAD
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"), server_onupdate=FetchedValue()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DATETIME(fsp=3))

    # 관계 — 태그는 sample_tags 를 거치는 다대다. 표는 tag.py 의 SampleTag 가 만든다.
    tags: Mapped[list["Tag"]] = relationship(
        secondary="sample_tags", back_populates="samples"
    )
