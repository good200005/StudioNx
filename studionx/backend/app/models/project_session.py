# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-16 마이페이지 대시보드
#   브랜치  : feature/phase1/p1-16-dashboard-api
#   순서    : 4단계 — P1-08·P1-13 병합 후
#
# 시작 전 : git switch feature/phase1/p1-16-dashboard-api
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""project_sessions 테이블 (DB.md §3.1) — 뼈대: 구현은 직접 (P1-16 읽기, 기록은 Phase 2 FR-257)."""

from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, text
from sqlalchemy.dialects.mysql import DATETIME, INTEGER
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ProjectSession(Base):
    """시퀀서 작업 세션. 마이페이지는 내 최근 7일 행만 읽어 작업 시간을 그림 (FR-128).

    내 세션이 0개인 프로젝트 = 아직 안 연 프로젝트 → Ready to start 배너 (FR-130)
    """

    __tablename__ = "project_sessions"

    session_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.project_id", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"))

    # (구현: AI — 2026-10-12, P1-16) 시각은 UTC · 시간대 없이 저장 (다른 시각 칸과 같음)
    started_at: Mapped[datetime] = mapped_column(  # 시퀀서에서 연 시각
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    last_seen_at: Mapped[datetime] = mapped_column(  # 마지막 신호 (1분마다, Phase 2)
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    active_seconds: Mapped[int] = mapped_column(  # 5분 넘게 입력 없는 구간은 뺀 작업 시간
        INTEGER(unsigned=True), server_default=text("0")
    )
