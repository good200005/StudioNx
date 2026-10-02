"""projects · project_members 테이블 (DB.md §3.1) — 뼈대: 구현은 직접.

P1-03에서 모델을 채우고, 사용은 P1-13(프로젝트 CRUD).
"""

from sqlalchemy import BigInteger, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Project(Base):
    """프로젝트. 삭제는 소프트 삭제(deleted_at).

    생성 시 OWNER 멤버 + MASTER 트랙을 한 트랜잭션으로 (FR-122).
    """

    __tablename__ = "projects"

    project_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # TODO: 나머지 컬럼
    #   owner_id         BIGINT NOT NULL, FK → users.user_id
    #   title            VARCHAR(100) NOT NULL
    #   description      VARCHAR(500) NULL
    #   bpm              DECIMAL(6,2) 기본 120.00   (Python 쪽은 Decimal)
    #   time_sig_num / time_sig_den  TINYINT 기본 4 / 4
    #   music_key        VARCHAR(10) NULL
    #   scale_mode       VARCHAR(20) NULL
    #   sample_rate      INT 기본 48000
    #   master_settings  JSON NULL
    #   revision         INT 기본 0  (저장할 때마다 +1, 동시 저장 충돌 확인용)
    #   thumbnail_path   VARCHAR(500) NULL
    #   template_id      BIGINT NULL (Phase 2)
    #   created_at / updated_at / deleted_at

    # TODO: 관계
    #   members: Mapped[list["ProjectMember"]] = relationship(
    #       back_populates="project", cascade="all, delete-orphan")
    #   tracks: Mapped[list["Track"]] = relationship(
    #       back_populates="project", order_by="Track.order_index")


class ProjectMember(Base):
    """프로젝트 멤버. Phase 1에서는 생성자 OWNER 한 행만 씀 (협업은 Phase 6)."""

    __tablename__ = "project_members"

    # 복합 기본 키 (project_id, user_id)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.project_id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), primary_key=True)

    # TODO: 나머지 컬럼
    #   role                  ENUM('OWNER','EDITOR','VIEWER') 기본 'EDITOR'
    #   last_read_message_id  BIGINT NULL (Phase 6 톡방)
    #   joined_at             DATETIME(3)
