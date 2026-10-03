"""문의 서비스 — 템플릿: 구현은 직접 (P1-12)."""

from sqlalchemy.orm import Session

from app.models import Inquiry, User
from app.schemas.inquiry import InquiryCreateRequest

# 반복 전송 제한 (FR-113, 권장) — 같은 IP 또는 같은 이메일 기준
INQUIRY_LIMIT_COUNT = 3  # 이 횟수까지
INQUIRY_LIMIT_SECONDS = 10 * 60  # 이 시간(초) 안에


def check_rate_limit(db: Session, ip: str | None, email: str) -> None:
    """짧은 시간 안에 반복 전송했으면 429 (FR-113).

    TODO(P1-12) — 둘 중 하나로 구현:
    - 방법 1 (DB, 간단): 같은 email 로 INQUIRY_LIMIT_SECONDS 안에 들어온 inquiries 행 수를 셈
        select(func.count()).where(Inquiry.email == email, Inquiry.created_at >= 지금 - 10분)
      → IP 는 테이블에 컬럼이 없으므로 이메일 기준만 가능
    - 방법 2 (메모리): dict[key, deque[시각]] 에 IP·이메일별 최근 전송 시각을 보관
      → 서버를 재시작하면 초기화, 서버가 여러 대면 따로 셈 (개발 단계에서는 충분)
    - 넘으면 raise AppError(ErrorCode.TOO_MANY_REQUESTS, 429,
                            "Too many messages. Please try again later.")
    - 응답 헤더 Retry-After(초)를 주고 싶으면 AppError.details 에 넣거나 라우터에서 처리
    """
    raise NotImplementedError


def create_inquiry(
    db: Session,
    data: InquiryCreateRequest,
    user: User | None,
    ip: str | None,
) -> Inquiry:
    """문의 저장 (FR-112).

    TODO(P1-12):
    1. data.privacy_agreed 가 False 이면
       raise AppError(ErrorCode.VALIDATION_ERROR, 422, "Please agree to the privacy policy.",
                      details={"privacy_agreed": "required"})
    2. check_rate_limit(db, ip, data.email)
    3. inquiry = Inquiry(
           user_id=user.user_id if user else None,   # 로그인 상태면 연결 (FR-112)
           email=..., title=data.title.strip(), content=data.content.strip(),
           privacy_agreed_at=지금(UTC),               # 동의 시각 기록 — 동의 없이는 저장 불가
       )
    4. db.add → commit → refresh → return
    - (선택) 관리자에게 알림 메일 — Phase 1 범위 밖
    """
    raise NotImplementedError
