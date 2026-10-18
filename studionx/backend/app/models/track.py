# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-03 백엔드 공통 — 모델 컬럼·오류 처리기·토큰 검사·get_current_user
#   브랜치  : feature/phase1/p1-03-backend-core
#   순서    : 1단계 — 가장 먼저 (나머지 API가 모두 이 작업을 씀)
#
# 시작 전 : git switch feature/phase1/p1-03-backend-core
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""tracks 테이블 (DB.md §3.2, db/02_phase2_sequencer.sql) — S1-09 에서 Phase 2 칸까지 채움.

트랙 한 줄. Phase 1 에서는 프로젝트 생성 시 MASTER 트랙 1개를 만드는 데만 썼고
(PRD 01 FR-122), S1-09 에서 색·볼륨·팬·뮤트·솔로, 라우팅 방식, 갈래 자리 등 Phase 2
칸을 모두 채워 트랙 헤더 믹서와 마스터 트랙을 다룬다 (FR-251·252·269).

- routing_mode: 이펙트 배치 방식. CHAIN 은 slot_index 순서의 일렬 체인, PATCHER 는
  갈래를 나눈 구성 (FR-267).
- parent_track_id: 그룹·레이어에서 부모 트랙 (FR-252).
- MASTER 트랙은 프로젝트마다 1개이고 화면에서 트랙 목록 맨 아래에 고정된다 (FR-252).
"""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    Enum,
    FetchedValue,
    ForeignKey,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:  # 타입 표시용 (실행 중에는 불러오지 않음)
    from app.models.project import Project
    from app.models.track_plugin import TrackInstrument, TrackPlugin, TrackPluginLink


class TrackType(StrEnum):
    AUDIO = "AUDIO"
    MIDI = "MIDI"
    MASTER = "MASTER"
    GROUP = "GROUP"
    RETURN = "RETURN"


class RoutingMode(StrEnum):
    """이펙트 배치 방식. CHAIN 은 한 줄(직렬), PATCHER 는 갈래(병렬)가 있는 구성 (FR-267)."""

    CHAIN = "CHAIN"
    PATCHER = "PATCHER"


class Track(Base):
    """트랙. track_type: AUDIO / MIDI / MASTER / GROUP / RETURN (프로젝트마다 MASTER 1개)."""

    __tablename__ = "tracks"

    track_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.project_id", ondelete="CASCADE")
    )

    name: Mapped[str] = mapped_column(String(100))
    track_type: Mapped[TrackType] = mapped_column(Enum(TrackType))
    order_index: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    color: Mapped[str] = mapped_column(String(7), server_default=text("'#7C5CFF'"))
    volume_db: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default=text("0.00"))
    pan: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("0.00"))
    is_muted: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    is_solo: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("1"))
    parent_track_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("tracks.track_id", ondelete="SET NULL")
    )
    frozen_sample_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("samples.sample_id", ondelete="SET NULL")
    )
    routing_mode: Mapped[RoutingMode] = mapped_column(
        Enum(RoutingMode), server_default=RoutingMode.CHAIN
    )
    assignee_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.user_id"))
    locked_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.user_id"))
    locked_at: Mapped[datetime | None] = mapped_column(DATETIME(fsp=3))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"), server_onupdate=FetchedValue()
    )

    project: Mapped["Project"] = relationship(back_populates="tracks")
    instruments: Mapped[list["TrackInstrument"]] = relationship(
        back_populates="track",
        order_by="TrackInstrument.slot_index",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    plugins: Mapped[list["TrackPlugin"]] = relationship(
        back_populates="track",
        order_by="TrackPlugin.slot_index",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    plugin_links: Mapped[list["TrackPluginLink"]] = relationship(
        back_populates="track",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
