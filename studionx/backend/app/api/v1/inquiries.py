# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-12 문의 등록·반복 전송 제한(메모리)
#   브랜치  : feature/phase1/p1-12-inquiry-api
#   순서    : 3단계 — P1-03~05 병합 후
#
# 시작 전 : git switch feature/phase1/p1-12-inquiry-api
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""/api/v1/inquiries 라우터 (PRD 01 §7, FR-112~113) — 템플릿: 구현은 직접 (P1-12).

화면 쪽: static/js/pages/home.js initContactForm
답변은 관리자 화면(SQLAdmin /admin, P1-21)에서 함
"""

from fastapi import APIRouter, Request, status

from app.api.deps import Db, OptionalUser
from app.schemas.common import ErrorResponse
from app.schemas.inquiry import InquiryCreateRequest, InquiryCreateResponse

router = APIRouter()


@router.post(
    "",
    response_model=InquiryCreateResponse,
    status_code=status.HTTP_201_CREATED,
    responses={422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
def create_inquiry(
    data: InquiryCreateRequest,
    request: Request,
    user: OptionalUser,
    db: Db,
) -> InquiryCreateResponse:
    """문의 등록 — 로그인은 선택 (로그인 상태면 user_id 연결).

    TODO(P1-12):
    - ip = request.client.host if request.client else None
      (배포 시 프록시 뒤라면 X-Forwarded-For 를 읽어야 함 — 그때 정하기)
    - inquiry = inquiry_service.create_inquiry(db, data, user, ip)
    - return InquiryCreateResponse(inquiry_id=inquiry.inquiry_id, created_at=inquiry.created_at)
    - 화면: 201 → 폼 초기화 + 안내, 429 → 'Too many messages...' 표시
    """
    raise NotImplementedError
