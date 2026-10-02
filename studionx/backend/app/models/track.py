"""tracks 테이블 (DB.md §3.2, db/02_phase2_sequencer.sql) — 뼈대: 구현은 직접 (P1-03).

Phase 1에서는 프로젝트 생성 시 MASTER 트랙 1개를 만드는 데만 씀 (PRD 01 FR-122).
"""

from sqlalchemy import BigInteger, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Track(Base):
    """트랙. track_type: AUDIO / MIDI / MASTER (프로젝트마다 MASTER 1개)."""

    __tablename__ = "tracks"

    track_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.project_id", ondelete="CASCADE")
    )

    # TODO: Phase 1에 필요한 컬럼 (MASTER 트랙 생성용)
    #   name         VARCHAR(100) NOT NULL       예: 'Master'
    #   track_type   ENUM('AUDIO','MIDI','MASTER') NOT NULL
    #   order_index  INT 기본 0
    # TODO(Phase 2): color, volume_db, pan, is_muted, is_solo,
    #   instrument_plugin_id, instrument_params,
    #   routing_mode, assignee_id, locked_by, locked_at, created_at, updated_at
