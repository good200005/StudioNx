"""/api/v1 라우터 모음. 기능별 라우터(auth, users, projects ...)는 여기에 include 한다."""

from fastapi import APIRouter
from sqlalchemy import text

from app.api.v1 import auth, users
from app.db.session import engine

api_router = APIRouter()


@api_router.get("/health", tags=["system"])
def health() -> dict:
    """서버 동작 확인용."""
    return {"status": "ok"}


@api_router.get("/health/db", tags=["system"])
def health_db() -> dict:
    """MySQL 연결 확인용."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"db": "ok"}
    except Exception as exc:  # 개발 환경 진단용이라 원인만 간단히 돌려준다
        return {"db": "error", "detail": type(exc).__name__}


api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
# TODO(Phase 1): users, projects, inquiries ... 라우터도 같은 방식으로 추가
