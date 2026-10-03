"""/api/v1/me 라우터 — 마이페이지용 묶음 API (PRD 01 §7) — 템플릿: 구현은 직접 (P1-16).

화면 쪽: static/js/pages/mypage.js (P1-17)
GET /me/storage (용량 상세, FR-134)는 권장 항목이라 나중에 이 파일에 추가
"""

from fastapi import APIRouter

from app.api.deps import CurrentUser, Db
from app.schemas.common import ErrorResponse
from app.schemas.dashboard import DashboardResponse

router = APIRouter()


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    responses={401: {"model": ErrorResponse}},
)
def read_dashboard(user: CurrentUser, db: Db) -> DashboardResponse:
    """대시보드 요약 — 프로필, 용량, AI 사용량, 이어 하기, 최근 프로젝트 5개 (FR-121).

    TODO(P1-16): return dashboard_service.get_dashboard(db, user)
    """
    raise NotImplementedError
