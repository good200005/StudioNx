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

import threading
import time
from collections import deque
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models import Inquiry, User
from app.schemas.inquiry import InquiryCreateRequest

# 반복 전송 제한 (FR-113, 권장) — 같은 IP 또는 같은 이메일 기준
INQUIRY_LIMIT_COUNT = 2  # 이 횟수까지 (2026-10-08 사용자 결정: 10분에 2번 — 템플릿은 3)
INQUIRY_LIMIT_SECONDS = 10 * 60  # 이 시간(초) 안에

# 최근 전송 시각 — 키: "ip:1.2.3.4" / "email:a@b.com", 값: time.monotonic() 시각들
# 서버 메모리에 두므로 재시작하면 비워지고, 서버가 여러 대면 따로 셈 (2026-10-03 결정: 메모리 방식)
_recent_sends: dict[str, deque[float]] = {}
_lock = threading.Lock()  # FastAPI 동기 함수는 여러 스레드에서 돎 → 기록을 함께 고치지 않게
_clock = time.monotonic  # 시스템 시계를 바꿔도 영향 없는 시각 (시험에서 바꿔 끼움)


def _keys(ip: str | None, email: str) -> list[str]:
    """제한을 셀 열쇠 — 이메일(소문자) 하나 + IP 가 있으면 IP 하나."""
    keys = [f"email:{email.strip().lower()}"]
    if ip:
        keys.append(f"ip:{ip}")
    return keys


def check_rate_limit(ip: str | None, email: str) -> None:
    """짧은 시간 안에 반복 전송했으면 429 (FR-113) — 메모리 방식. **검사만** 하고 세지는 않음.

    - 같은 이메일 또는 같은 IP 로 10분 안에 2번 저장됐으면 3번째는 429
      "Too many messages. Please try again later." + details.retry_after (몇 초 뒤 가능한지)
    - 10분이 지난 기록은 버리고, 비면 열쇠째 지움 (메모리가 계속 늘지 않게)
    - 세는 일은 record_inquiry_send — 저장(commit)에 **성공한 뒤에만** 부름
      (2026-10-08 사용자 결정: 저장에 실패한 시도는 세지 않음
       → 템플릿의 "검사하며 세기" 를 둘로 나눔)
    (구현: AI — 2026-10-08, 함수 하나씩 검토)
    """
    now = _clock()
    with _lock:
        for key in _keys(ip, email):
            q = _recent_sends.get(key)
            if q is None:
                continue
            while q and now - q[0] > INQUIRY_LIMIT_SECONDS:
                q.popleft()
            if not q:
                del _recent_sends[key]
                continue
            if len(q) >= INQUIRY_LIMIT_COUNT:
                raise AppError(
                    ErrorCode.TOO_MANY_REQUESTS,
                    429,
                    "Too many messages. Please try again later.",
                    details={"retry_after": int(INQUIRY_LIMIT_SECONDS - (now - q[0])) + 1},
                )


def record_inquiry_send(ip: str | None, email: str) -> None:
    """저장에 성공한 문의 하나를 센다 (check_rate_limit 과 짝).

    - 52 create_inquiry 가 commit 뒤에 부름
    (구현: AI — 2026-10-08, 함수 하나씩 검토)
    """
    now = _clock()
    with _lock:
        for key in _keys(ip, email):
            _recent_sends.setdefault(key, deque()).append(now)


def create_inquiry(
    db: Session,
    data: InquiryCreateRequest,
    user: User | None,
    ip: str | None,
) -> Inquiry:
    """문의 저장 (FR-112). 저장된 Inquiry 를 돌려준다.

    1. 처리방침 동의가 없으면 422 "Please agree to the privacy policy." (details.privacy_agreed)
    2. 반복 전송 검사 (51) — 10분에 2번을 넘으면 429, 저장하지 않음
    3. 저장 — 로그인 상태면 user_id 를 연결(FR-112), 동의 시각을 지금(UTC)으로 기록
       이메일 · 제목 · 내용은 50 스키마가 이미 앞뒤 공백을 지운 값 (템플릿의 .strip() 은 필요 없음)
       상태는 DB 기본값 RECEIVED
    4. 저장(commit)에 **성공한 뒤에** 반복 전송 1번으로 셈 (51 — 2026-10-08 사용자 결정)
    - 관리자 알림 메일은 Phase 1 범위 밖 — 답변은 관리자 화면(P1-21)에서
    (구현: AI — 2026-10-08, 함수 하나씩 검토)
    """
    if not data.privacy_agreed:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            422,
            "Please agree to the privacy policy.",
            details={"privacy_agreed": "required"},
        )
    check_rate_limit(ip, data.email)

    inquiry = Inquiry(
        user_id=user.user_id if user else None,
        email=data.email,
        title=data.title,
        content=data.content,
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)
    record_inquiry_send(ip, data.email)
    return inquiry
