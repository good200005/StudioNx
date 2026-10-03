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
