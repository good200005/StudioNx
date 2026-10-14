"""비밀번호 재설정 서비스 (P1-28, PRD 01 FR-118~119).

함수 하나씩 만들어 가는 중: create_reset_token → request_password_reset → reset_password → …
"""

import logging
import threading
import time
from collections import deque
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.core.security import (
    check_password_rules,
    generate_reset_token,
    hash_password,
    hash_reset_token,
)
from app.models import PasswordResetToken, User
from app.models.user import UserStatus

# uvicorn 이 보여 주는 로그 이름을 씀 (앱 자체 이름은 uvicorn 기본 설정에서 INFO 가 출력되지 않음)
logger = logging.getLogger("uvicorn.error")

# 요청 횟수 제한 (FR-118) — 10분 안에 같은 이메일은 3번, 같은 IP 는 10번까지
# 이메일 기준은 한 사람에게 메일이 쏟아지는 것을 막고, IP 기준은 같은 망의 여러 사람을 감안
RESET_LIMIT_SECONDS = 10 * 60
RESET_LIMIT_EMAIL = 3
RESET_LIMIT_IP = 10

# 최근 요청 시각 — 키: "ip:1.2.3.4" / "email:a@b.com", 값: time.monotonic() 시각들
# 서버 메모리에 두므로 재시작하면 비워지고, 서버가 여러 대면 따로 셈 (문의와 같은 방식)
_recent_requests: dict[str, deque[float]] = {}
_lock = threading.Lock()
_clock = time.monotonic  # 시험에서 바꿔 끼움


def create_reset_token(db: Session, user: User) -> str:
    """회원의 재설정 토큰을 새로 만들어 저장하고 **원문**을 돌려준다 (P1-28).

    1. 이 회원이 이전에 받아 아직 쓰지 않은 토큰은 모두 사용 처리(`used_at`) — 다시 요청하면
       이전 메일의 링크는 못 쓰게 되어, 살아 있는 링크가 항상 하나뿐이다
    2. `generate_reset_token()` 으로 (원문, 해시)를 만들고 **해시만** 저장
       (만료 = 지금 + `password_reset_minutes`분, 기본 30분)
    3. commit 하고 원문을 돌려준다. 원문은 호출한 쪽이 메일 링크에만 쓰고 어디에도 저장하지 않는다

    상태(ACTIVE)와 요청 횟수는 여기서 검사하지 않는다: 부르는 쪽(요청 서비스)이 먼저 거른다.
    시각은 DB 와 같게 UTC 로 시간대 정보를 뗀 값(naive)이다.
    """
    now = datetime.now(UTC).replace(tzinfo=None)
    expires_at = now + timedelta(minutes=get_settings().password_reset_minutes)

    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.user_id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    token, token_hash = generate_reset_token()
    db.add(PasswordResetToken(user_id=user.user_id, token_hash=token_hash, expires_at=expires_at))
    db.commit()
    return token


def check_reset_rate_limit(ip: str | None, email: str) -> None:
    """재설정 요청 횟수를 검사하고 이번 요청을 센다. 넘었으면 429 (P1-28, FR-118).

    - 열쇠: 이메일(소문자, 공백 제거) 하나 + IP 가 있으면 IP 하나. 한도는 이메일 3번, IP 10번 (10분)
    - **가입 여부와 관계없이 모든 요청을 센다.** 없는 이메일만 제한에 안 걸리거나 먼저 걸리면
      응답 차이로 가입 여부를 알아낼 수 있기 때문이다 (FR-118: 항상 같은 응답)
    - 문의의 check/record 두 함수와 달리 한 함수로 합쳤다.
      문의는 저장에 실패한 시도를 세지 않았지만, 여기서는 가입 여부를 숨겨야 해서 항상 센다
    - 한도를 넘은 요청은 세지 않는다 (계속 눌러도 제한 시간이 늘어나지 않음)
    - 429 의 `details.retry_after` = 몇 초 뒤에 다시 할 수 있는지 (가장 오래된 기록이 만료될 때까지)
    - 10분이 지난 기록은 버리고, 비면 열쇠째 지운다 (메모리가 계속 늘지 않게)
    """
    now = _clock()
    keys = [(f"email:{email.strip().lower()}", RESET_LIMIT_EMAIL)]
    if ip:
        keys.append((f"ip:{ip}", RESET_LIMIT_IP))

    with _lock:
        retry_after = 0
        for key, limit in keys:
            q = _recent_requests.get(key)
            if q is None:
                continue
            while q and now - q[0] > RESET_LIMIT_SECONDS:
                q.popleft()
            if not q:
                del _recent_requests[key]
                continue
            if len(q) >= limit:
                retry_after = max(retry_after, int(RESET_LIMIT_SECONDS - (now - q[0])) + 1)
        if retry_after:
            raise AppError(
                ErrorCode.TOO_MANY_REQUESTS,
                429,
                "Too many requests. Please try again later.",
                details={"retry_after": retry_after},
            )
        for key, _ in keys:
            _recent_requests.setdefault(key, deque()).append(now)


def mask_email(email: str) -> str:
    """로그에 남길 이메일 — 앞 글자 하나만 보이고 나머지는 가림 (`go***@naver.com`)."""
    local, _, domain = email.strip().partition("@")
    return (local[:1] + "***@" + domain) if domain else "***"


def request_password_reset(db: Session, email: str, ip: str | None) -> None:
    """비밀번호 재설정을 요청한다 (P1-28, FR-118). **가입 여부와 관계없이 항상 같은 결과**(None).

    1. `check_reset_rate_limit()`: 한도를 넘으면 429 (가입 여부와 무관하게 센다)
    2. 이메일(소문자, 공백 제거)로 회원을 찾는다. 없거나 `ACTIVE` 가 아니면(탈퇴, 정지)
       아무것도 하지 않고 끝낸다. 호출한 쪽은 항상 "가입된 주소라면 메일을 보냈다"고만 답한다
    3. `ACTIVE` 이면 `create_reset_token()` 으로 토큰을 만들고 링크를 메일(서버 로그)로 보낸다
       - 링크: `{app_base_url}/resetPassword.html#token=<원문>`
         토큰을 `?` 뒤가 아니라 `#` 뒤에 둔다: `#` 뒤의 값은 브라우저가 서버로 보내지 않아서
         접속 기록과 Referer 로 새지 않는다
       - 개인정보: 로그에는 이메일을 가려(`r***@…`) 남기고, 링크는 개발용(`mail_backend=log`)일
         때만 출력한다. 그 밖의 설정이면 토큰도 링크도 만들지 않고 "메일 설정 없음"만 기록한다
    """
    check_reset_rate_limit(ip, email)

    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None or user.status != UserStatus.ACTIVE:
        return

    settings = get_settings()
    if settings.mail_backend != "log":
        logger.warning("password reset requested but mail is not configured (MAIL_BACKEND)")
        return

    token = create_reset_token(db, user)
    link = f"{settings.app_base_url.rstrip('/')}/resetPassword.html#token={token}"
    logger.info("[DEV MAIL] password reset link for %s: %s", mask_email(user.email), link)


def _invalid_link() -> AppError:
    """재설정 링크를 쓸 수 없을 때의 오류. 이유(틀림, 만료, 이미 씀)는 알려 주지 않는다."""
    return AppError(ErrorCode.INVALID_RESET_LINK, 400, "This link is invalid or has expired.")


def reset_password(db: Session, token: str, new_password: str) -> None:
    """링크의 토큰과 새 비밀번호로 비밀번호를 바꾼다 (P1-28, FR-118).

    1. 토큰의 해시로 행을 찾는다. 없거나, 이미 썼거나, 만료됐거나, 회원이 `ACTIVE` 가 아니면
       모두 **같은** 400 INVALID_RESET_LINK (이유를 알려 주면 추측을 돕는다)
    2. 새 비밀번호 규칙(FR-102)을 검사한다. 틀리면 422 + details.new_password.
       **이때 토큰은 쓰지 않은 채로 둔다**: 화면에서 비밀번호만 고쳐 다시 보낼 수 있게
    3. 한 번만 쓰도록 `UPDATE … WHERE used_at IS NULL` 로 사용 처리하고, 바뀐 행이 1이 아니면
       (동시에 눌러 다른 쪽이 먼저 썼다) 같은 오류. 조회와 사용 처리 사이에 끼어드는 요청을 막는다
    4. 새 해시 저장 + `password_changed_at` 기록 + 이 회원의 남은 토큰도 모두 사용 처리, commit
       (`password_changed_at` 으로 이전 로그인을 무효로 만드는 일은 토큰 검사 쪽 몫)
    - 현재 비밀번호와 같은 값으로 재설정하는 것은 막지 않는다 (잊어서 오는 흐름이라 의미가 없다)
    """
    try:
        token_hash = hash_reset_token(token)
    except ValueError:
        raise _invalid_link() from None

    now = datetime.now(UTC).replace(tzinfo=None)
    row = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise _invalid_link()
    user = db.get(User, row.user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise _invalid_link()

    failed = check_password_rules(new_password)
    if failed:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            422,
            "Check the password requirements.",
            details={"new_password": failed},
        )

    claimed = db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.token_id == row.token_id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    if claimed.rowcount != 1:
        db.rollback()
        raise _invalid_link()

    user.password_hash = hash_password(new_password)
    user.password_changed_at = now
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.user_id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    db.commit()
