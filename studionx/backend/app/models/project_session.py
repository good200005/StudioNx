"""project_sessions 테이블 (DB.md §3.1) — 뼈대: 구현은 직접 (P1-16 읽기, 기록은 Phase 2 FR-257)."""

from sqlalchemy import BigInteger, ForeignKey
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

    # TODO: 나머지 컬럼
    #   started_at      DATETIME(3) NOT NULL 기본 CURRENT  — 시퀀서에서 연 시각 (UTC)
    #   last_seen_at    DATETIME(3) NOT NULL 기본 CURRENT  — 마지막 신호 (1분마다)
    #   active_seconds  INT NOT NULL 기본 0                 — 5분 넘게 입력 없는 구간은 뺀 작업 시간
