# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-16 마이페이지 대시보드
#   브랜치  : feature/phase1/p1-16-dashboard-api
#   순서    : 4단계 — P1-08·P1-13 병합 후
#
# 시작 전 : git switch feature/phase1/p1-16-dashboard-api
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
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
