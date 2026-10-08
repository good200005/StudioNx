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
from app.core.config import get_settings
from app.schemas.common import ErrorResponse
from app.schemas.inquiry import InquiryCreateRequest, InquiryCreateResponse
from app.services import inquiry_service

router = APIRouter()


def client_ip(request: Request) -> str | None:
    """보낸 사람의 IP (반복 전송 제한 51 이 씀).

    - 기본: 연결된 상대의 IP (request.client.host)
    - 설정 TRUST_PROXY=true 일 때만 X-Forwarded-For 의 첫 IP — 프록시(Nginx 등) 뒤에서는
      연결 상대가 늘 프록시라서. 프록시 없이 켜면 누구나 헤더를 꾸밀 수 있어 기본은 꺼짐
      (2026-10-08 사용자 결정 A)
    (구현: AI — 2026-10-08, 함수 하나씩 검토)
    """
    if get_settings().trust_proxy:
        first = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else None


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

    - 형식은 50 스키마(422), 동의 · 반복 전송 · 저장은 52 create_inquiry (422 · 429)
    - 응답은 번호와 접수 시각만 (화면은 '보냈습니다' 안내만)
    - 화면: 201 → 폼 초기화 + 안내, 429 → 'Too many messages...' 표시
    (구현: AI — 2026-10-08, 함수 하나씩 검토)
    """
    inquiry = inquiry_service.create_inquiry(db, data, user, client_ip(request))
    return InquiryCreateResponse(inquiry_id=inquiry.inquiry_id, created_at=inquiry.created_at)
