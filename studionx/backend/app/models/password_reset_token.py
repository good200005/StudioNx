"""password_reset_tokens 테이블 (DB.md §3.1, P1-28, FR-118) — 비밀번호 재설정 링크의 토큰.

토큰 원문은 저장하지 않고 SHA-256 해시(token_hash)만 저장한다. 원문은 메일 링크에만 있다.
"""

from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, String, text
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PasswordResetToken(Base):
    """재설정 토큰 한 건. 만료(expires_at)가 지났거나 사용(used_at)했으면 다시 쓸 수 없다."""

    __tablename__ = "password_reset_tokens"

    token_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DATETIME(fsp=3), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DATETIME(fsp=3))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
