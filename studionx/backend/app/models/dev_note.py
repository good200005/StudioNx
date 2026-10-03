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
"""dev_notes 테이블 (DB.md §3.1) — 뼈대: 구현은 직접 (P1-21)."""

from sqlalchemy import BigInteger, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class DevNote(Base):
    """메인 페이지 Development 공지. 작성·수정은 관리자 화면(SQLAdmin /admin)에서만 (FR-115)."""

    __tablename__ = "dev_notes"

    note_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    author_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"))

    # TODO: 나머지 컬럼
    #   title         VARCHAR(150) NOT NULL
    #   summary       VARCHAR(300) NOT NULL   — 카드에 보이는 짧은 요약
    #   content       MEDIUMTEXT   NOT NULL   — 본문 (Markdown)
    #                 → from sqlalchemy.dialects.mysql import MEDIUMTEXT
    #   is_published  TINYINT(1)   기본 0     — Python 쪽은 bool (Boolean)
    #   published_at  DATETIME(3) NULL        — 메인 페이지 정렬 기준
    #   created_at / updated_at / deleted_at
