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
"""inquiries 테이블 (DB.md §3.1) — 뼈대: 구현은 직접 (P1-03, 사용처는 P1-12)."""

from sqlalchemy import BigInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Inquiry(Base):
    """메인 페이지 Contact 폼으로 받은 문의. 답변은 관리자 화면(SQLAdmin, P1-21)에서."""

    __tablename__ = "inquiries"

    inquiry_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # TODO: 나머지 컬럼
    #   user_id            BIGINT NULL, FK → users.user_id (로그인 상태로 보냈을 때만)
    #   name               VARCHAR(50)  NULL   (폼에서 받지 않음, 예비)
    #   email              VARCHAR(255) NOT NULL
    #   title              VARCHAR(200) NOT NULL
    #   content            TEXT         NOT NULL (최대 2,000자는 스키마에서 검사)
    #   privacy_agreed_at  DATETIME(3)  NOT NULL
    #   status             ENUM('RECEIVED','ANSWERED','CLOSED') 기본 'RECEIVED'
    #   answer             TEXT NULL
    #   answered_at        DATETIME(3) NULL
    #   created_at / updated_at
