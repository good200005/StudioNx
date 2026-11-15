"""meter_changes 테이블 (DB.md §3.3, db/02_phase2_sequencer.sql) — S1-18, FR-202b.

곡 중간의 박자 변경점 한 건. 시작 박자는 projects.time_sig_num/den 이고(tick 0),
이 표는 그 뒤의 변경점만 가진다.

- tick: 변경 위치 (> 0, 1박 = 960 tick). 한 프로젝트에서 같은 위치는 하나만 (UNIQUE).
- time_sig_num: 박자 분자 1 ~ 32, time_sig_den: 분모 1, 2, 4, 8, 16, 32 (DB CHECK).
- 프로젝트를 지우면 DB 의 ON DELETE CASCADE 로 함께 지워진다.
"""

from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, text
from sqlalchemy.dialects.mysql import DATETIME, INTEGER, TINYINT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class MeterChange(Base):
    """박자 변경점. 프로젝트마다 여러 개를 가진다."""

    __tablename__ = "meter_changes"

    meter_change_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.project_id", ondelete="CASCADE")
    )
    tick: Mapped[int] = mapped_column(INTEGER(unsigned=True))
    time_sig_num: Mapped[int] = mapped_column(TINYINT(unsigned=True))
    time_sig_den: Mapped[int] = mapped_column(TINYINT(unsigned=True))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
