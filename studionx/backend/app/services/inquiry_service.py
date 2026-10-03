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
"""문의 서비스 — 템플릿: 구현은 직접 (P1-12)."""

from collections import deque

from sqlalchemy.orm import Session

from app.models import Inquiry, User
from app.schemas.inquiry import InquiryCreateRequest

# 반복 전송 제한 (FR-113, 권장) — 같은 IP 또는 같은 이메일 기준
INQUIRY_LIMIT_COUNT = 3  # 이 횟수까지
INQUIRY_LIMIT_SECONDS = 10 * 60  # 이 시간(초) 안에

# 최근 전송 시각 — 키: "ip:1.2.3.4" / "email:a@b.com", 값: time.monotonic() 시각들
# 서버 메모리에 두므로 재시작하면 비워지고, 서버가 여러 대면 따로 셈 (2026-10-03 결정: 메모리 방식)
_recent_sends: dict[str, deque[float]] = {}


def check_rate_limit(ip: str | None, email: str) -> None:
    """짧은 시간 안에 반복 전송했으면 429 (FR-113) — 메모리 방식.

    TODO(P1-12):
    - now = time.monotonic()  (시스템 시계를 바꿔도 영향 없는 시각)
    - keys = [f"email:{email.strip().lower()}"] + ([f"ip:{ip}"] if ip else [])
    - 키마다 q = _recent_sends.setdefault(key, deque())
        · 앞에서부터 now - q[0] > INQUIRY_LIMIT_SECONDS 인 시각을 popleft (오래된 기록 버리기)
        · len(q) >= INQUIRY_LIMIT_COUNT 이면
          raise AppError(ErrorCode.TOO_MANY_REQUESTS, 429,
                         "Too many messages. Please try again later.",
                         details={"retry_after": int(INQUIRY_LIMIT_SECONDS - (now - q[0]))})
    - 모든 키를 통과한 뒤에만 각 q 에 now 를 append (막힌 요청은 세지 않음)
    - (권장) 빈 deque 는 dict 에서 지워 메모리가 계속 늘지 않게
    - 동시에 들어오는 요청: FastAPI 동기 함수는 스레드에서 돌므로 threading.Lock 으로 감싸기 권장
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
    2. check_rate_limit(ip, data.email)  — 저장 실패와 상관없이 시도 횟수를 셀지 정하기
    3. inquiry = Inquiry(
           user_id=user.user_id if user else None,   # 로그인 상태면 연결 (FR-112)
           email=..., title=data.title.strip(), content=data.content.strip(),
           privacy_agreed_at=지금(UTC),               # 동의 시각 기록 — 동의 없이는 저장 불가
       )
    4. db.add → commit → refresh → return
    - (선택) 관리자에게 알림 메일 — Phase 1 범위 밖
    """
    raise NotImplementedError
