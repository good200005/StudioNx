"""SQLAlchemy 엔진 · 세션. 라우터에서는 Depends(get_db) 로 세션을 받는다."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

# 연결마다 시간대를 UTC 로 맞춤 — DB 에는 시각을 UTC 로 저장하기로 했는데(docs/DB.md),
# DEFAULT CURRENT_TIMESTAMP 는 MySQL 연결의 시간대를 따르므로,
# 정하지 않으면 서버 PC 의 시간대(예: 한국)로 저장됨
# (2026-10-12 P1-17 에서 발견: created_at 이 UTC 보다 9시간 앞서 화면에 'Just now' 로 보였음)
engine = create_engine(
    get_settings().database_url,
    pool_pre_ping=True,
    future=True,
    connect_args={"init_command": "SET time_zone = '+00:00'"},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """모든 ORM 모델의 부모 클래스 (app/models/ 에서 상속)."""


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
