"""users 테이블 (DB.md §3.1, db/01_phase1_account.sql) — 뼈대: 구현은 직접 (P1-03)."""

from sqlalchemy import BigInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    """회원. 탈퇴는 소프트 삭제(status='DELETED', deleted_at 기록)."""

    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # TODO: 나머지 컬럼 (SQL과 같은 이름·타입·NULL 여부)
    #   email               VARCHAR(255) NOT NULL, UNIQUE
    #   password_hash       VARCHAR(255) NOT NULL
    #   nickname            VARCHAR(50)  NOT NULL, UNIQUE
    #   profile_image_path  VARCHAR(500) NULL
    #   role                ENUM('USER','ADMIN')                 기본 'USER'
    #   status              ENUM('ACTIVE','SUSPENDED','DELETED') 기본 'ACTIVE'
    #   last_login_at       DATETIME(3) NULL
    #   storage_quota_bytes BIGINT NOT NULL 기본 5368709120 (5GB)
    #   storage_used_bytes  BIGINT NOT NULL 기본 0
    #   created_at / updated_at / deleted_at  DATETIME(3)
    #   - 기본값·자동 갱신은 DB가 처리 → server_default 로 표시만
    #     (예: server_default=func.now())
    #   - ENUM은 Python Enum 클래스 + sqlalchemy.Enum(..., native_enum=True) 권장

    # TODO: 관계 (필요해지면)
    #   projects: Mapped[list["Project"]] = relationship(back_populates="owner")
