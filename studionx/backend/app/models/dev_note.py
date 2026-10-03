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
