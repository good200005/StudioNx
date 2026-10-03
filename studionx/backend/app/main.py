"""Studio Nx FastAPI 진입점.

실행 (studionx/backend 에서):  uvicorn app.main:app --reload
- API:       http://localhost:8000/api/v1/...
- API 문서:  http://localhost:8000/docs
- 프론트:     http://localhost:8000/  (studionx/frontend 정적 파일)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.admin import setup_admin
from app.api.v1.router import api_router
from app.core.config import ROOT_DIR, get_settings
from app.core.errors import register_exception_handlers
from app.core.sentry import init_sentry
from app.core.site_files import SiteFiles

settings = get_settings()
init_sentry(settings)

app = FastAPI(title=settings.app_name, version="0.1.0")
register_exception_handlers(app)  # 오류 응답 형식 통일 (core/errors.py, P1-03)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # 리프레시 토큰 HttpOnly 쿠키
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)
setup_admin(app)  # 관리자 화면 /admin (app/admin.py, P1-21) — 프론트 마운트보다 먼저

# 프론트엔드 정적 파일 — API 라우터보다 뒤에 마운트해야 /api 경로를 가리지 않는다
# 없는 페이지 → errors/404.html (상태 404), 없는 API → JSON 404 (core/site_files.py)
app.mount(
    "/",
    SiteFiles(directory=ROOT_DIR / "frontend", api_prefix=settings.api_prefix),
    name="frontend",
)
