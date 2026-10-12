# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-21 Development 공지 API·SQLAdmin 관리자 화면
#   브랜치  : feature/phase1/p1-21-dev-notes-admin
#   순서    : 5단계 — P1-05·P1-12 병합 후
#
# 시작 전 : git switch feature/phase1/p1-21-dev-notes-admin
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""dev_notes 테이블 (DB.md §3.1) — 구현: AI, P1-21 (함수 하나씩 검토)."""

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, FetchedValue, ForeignKey, String, text
from sqlalchemy.dialects.mysql import DATETIME, MEDIUMTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class DevNote(Base):
    """메인 페이지 Development 공지. 작성·수정은 관리자 화면(SQLAdmin /admin)에서만 (FR-115).

    (구현: AI — 2026-10-13, P1-21) 시각은 UTC · 시간대 없이 저장 (다른 시각 칸과 같음)
    - is_published: 0 = 초안 (메인 페이지에 안 보임), 1 = 공개
    - published_at: 공개 시각. 미래로 두면 그때까지 숨김 (예약 공개), 메인 페이지 정렬 기준
    - deleted_at: 소프트 삭제 (관리자 화면에서 지워도 행은 남음)
    """

    __tablename__ = "dev_notes"

    note_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    author_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"))
    title: Mapped[str] = mapped_column(String(150))
    summary: Mapped[str] = mapped_column(String(300))  # 카드에 보이는 짧은 요약
    content: Mapped[str] = mapped_column(MEDIUMTEXT)  # 본문 (Markdown)
    is_published: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    published_at: Mapped[datetime | None] = mapped_column(DATETIME(fsp=3))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"), server_onupdate=FetchedValue()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DATETIME(fsp=3))
