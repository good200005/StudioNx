# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-04 회원가입 — signup·이메일/닉네임 중복 확인·탈퇴 3일 규칙
#   브랜치  : feature/phase1/p1-04-signup-api
#   순서    : 2단계 — P1-03 병합 후
#
# P1-05 로그인·토큰 재발급·로그아웃
#   브랜치  : feature/phase1/p1-05-login-jwt
#   순서    : 2단계 — P1-03·P1-04 병합 후
#
# 시작 전 : git switch <위 작업 중 지금 할 작업의 브랜치>
#           (이 파일은 작업이 여럿 — 위 순서대로 한 작업씩, 각자 자기 브랜치에서)
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""회원가입 · 중복 확인 (P1-04) · 로그인 (P1-05) 서비스 — 템플릿: 구현은 직접.

라우터(api/v1/auth.py)는 요청을 받아 여기 함수를 부르기만 하고,
DB 조회·규칙 검사·저장은 이 파일에서 한다.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.core.security import check_password_rules, hash_password
from app.models import User
from app.models.user import UserStatus
from app.schemas.auth import PRIVACY_VERSION, AvailabilityResponse, SignupRequest

# 탈퇴 후 같은 이메일·닉네임으로 다시 가입할 수 있기까지 기다리는 기간 (FR-108, 2026-10-03 결정)
REJOIN_WAIT_DAYS = 3


def normalize_email(email: str) -> str:
    """비교·저장용 이메일 (앞뒤 공백 제거 + 소문자).

    TODO(P1-04): return email.strip().lower()
    - 중복 확인과 가입 모두 이 함수를 거쳐야 같은 기준으로 비교됨
    """
    return email.strip().lower()


def release_withdrawn(db: Session, user: User) -> None:
    """탈퇴 후 3일이 지난 계정의 이메일·닉네임을 비워 새 가입에 쓸 수 있게 한다 (FR-108).

    email·nickname 은 UNIQUE 라서, 탈퇴한 행이 그대로 쥐고 있으면 같은 값으로 가입할 수 없음.
    그래서 다시 쓰려는 사람이 나타났을 때(가입·중복 확인) 예전 행의 값을 바꿔 둔다.

    TODO(P1-04):
    - user.email    = f"deleted+{user.user_id}@withdrawn.invalid"   (.invalid = 실제로 없는 도메인)
    - user.nickname = f"deleted_{user.user_id}"                     (50자 이내)
    - db.flush()  — 같은 트랜잭션 안에서 새 행을 넣기 전에 UNIQUE 충돌을 먼저 없앰
    - 행 자체·deleted_at·남겨 둔 프로젝트(owner_id)는 그대로

    (구현: AI — 2026-10-07) 닉네임은 템플릿의 deleted_{id} 대신 deleted_user_{id 10자리} (23자).
    가입 닉네임은 최대 20자라, 21자 이상인 이 이름과 절대 겹치지 않음
    (deleted_85 는 회원이 직접 가입할 수 있는 이름이라 UNIQUE 충돌 → 500 이 날 수 있었음).
    """
    user.email = f"deleted+{user.user_id}@withdrawn.invalid"
    user.nickname = f"deleted_user_{user.user_id:010d}"
    db.flush()


def check_email(db: Session, email: str, release: bool = False) -> AvailabilityResponse:
    """이메일을 쓸 수 있는가 (FR-101 + FR-108 재가입 규칙). 중복 확인 API·가입에서 함께 사용.

    TODO(P1-04):
    - user = 이메일(normalize_email)이 같은 행
    - 없으면                                   → available=True
    - status 가 'ACTIVE' 또는 'SUSPENDED'      → available=False, reason='TAKEN'
    - status 가 'DELETED' 이고
        deleted_at + REJOIN_WAIT_DAYS 일 > 지금  → available=False, reason='REJOIN_TOO_SOON',
                                                   available_at=deleted_at + 3일
        그 외(3일 지남)                          → release_withdrawn(db, user) 후 available=True
          (중복 확인 API 에서는 바꾸지 않고 available=True 만 돌려줘도 됨 — 실제 해제는 가입 때)

    (구현: AI — 2026-10-07) release=True 일 때만 비켜 둠 (가입 signup 이 True 로 부름).
    중복 확인 API(GET)는 확인만 하고 DB 를 바꾸지 않음.
    """
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    return availability_of(db, user, release)


def availability_of(db: Session, user: User | None, release: bool) -> AvailabilityResponse:
    """이메일 · 닉네임을 쥔 행(user)을 보고 새로 쓸 수 있는지 판단 (check_email · check_nickname)"""
    if user is None:
        return AvailabilityResponse(available=True)
    if user.status != UserStatus.DELETED:
        return AvailabilityResponse(available=False, reason="TAKEN")
    if user.deleted_at is not None:
        available_at = user.deleted_at + timedelta(days=REJOIN_WAIT_DAYS)
        now = datetime.now(UTC).replace(tzinfo=None)  # DB 의 시각은 UTC · 시간대 정보 없음
        if now < available_at:
            return AvailabilityResponse(
                available=False,
                reason="REJOIN_TOO_SOON",
                available_at=available_at.replace(tzinfo=UTC),
            )
    if release:
        release_withdrawn(db, user)
    return AvailabilityResponse(available=True)


def check_nickname(db: Session, nickname: str, release: bool = False) -> AvailabilityResponse:
    """닉네임을 쓸 수 있는가. 회원 정보 수정(P1-08)에서도 같이 사용.

    TODO(P1-04): check_email 과 같은 규칙 (nickname.strip() 으로 비교)
    - 탈퇴 후 3일 안이면 reason='REJOIN_TOO_SOON' — 탈퇴한 사람인 척 바로 같은 이름을 쓰는 것을 막음

    (구현: AI — 2026-10-07) 비교는 DB 가 함 — users.nickname 정렬 규칙(utf8mb4_0900_ai_ci)이
    대소문자 · 악센트를 구분하지 않아 Beat = beat. UNIQUE 도 같은 규칙이라 확인과 가입 결과가 같음.
    """
    user = db.scalar(select(User).where(User.nickname == nickname.strip()))
    return availability_of(db, user, release)


def signup(db: Session, data: SignupRequest) -> User:
    """회원가입 (FR-101~102). 성공하면 저장된 User 를 돌려준다.

    TODO(P1-04) 순서:
    1. failed = check_password_rules(data.password)        (core/security.py)
       failed 가 있으면
       raise AppError(ErrorCode.VALIDATION_ERROR, 422, "Check the password requirements.",
                      details={"password": failed})
    2. check_email 결과가 available=False 이면
         reason 'TAKEN'
           → AppError(ErrorCode.EMAIL_TAKEN, 409, "This email is already in use.")
         reason 'REJOIN_TOO_SOON' → AppError(ErrorCode.REJOIN_TOO_SOON, 409,
                                    "You can sign up with this email again after <날짜>.",
                                    details={"available_at": ...})
       check_nickname 도 같은 방식 (NICKNAME_TAKEN / REJOIN_TOO_SOON)
       - 3일이 지난 탈퇴 행은 check_* 안에서 release_withdrawn 으로 이미 비워짐
    2-1. 처리방침 동의 (2026-10-05, docs/Privacy_Policy_Draft.md D3·D4)
       - data.privacy_agreed 가 False 이면
         AppError(ErrorCode.VALIDATION_ERROR, 422, "Please agree to the Privacy Policy.",
                  details={"privacy_agreed": "required"})
       - data.privacy_version != PRIVACY_VERSION (schemas/auth.py) 이면
         422 "Please reload the page."
         (예전 처리방침 화면에서 보낸 가입 → 새 판을 보고 다시 동의하게)
    3. user = User(email=normalize_email(data.email), nickname=data.nickname.strip(),
                   password_hash=hash_password(data.password),
                   privacy_agreed_at=지금(UTC), privacy_version=PRIVACY_VERSION)
       - role·status·용량 등은 DB 기본값('USER', 'ACTIVE', 5GB)을 그대로 씀
    4. db.add(user) → db.commit() → db.refresh(user)  (user_id·created_at 채우기)
    5. 동시에 같은 이메일로 가입하면 2번을 둘 다 통과할 수 있음
       → db.commit() 에서 sqlalchemy.exc.IntegrityError 를 잡아 db.rollback() 후 409
         (어느 칸인지는 오류 메시지의 uq_users_email / uq_users_nickname 으로 구분)
    6. return user

    (구현: AI — 2026-10-07)
    - 검사 순서: 비밀번호 → 처리방침 → 이메일 → 닉네임 (DB 를 보지 않는 검사를 먼저)
    - 중간에 AppError 로 끝나면 commit 하지 않음 → 요청이 끝날 때 세션이 닫히며 비켜 둔 것도 취소
    """
    failed = check_password_rules(data.password)
    if failed:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            422,
            "Check the password requirements.",
            details={"password": failed},
        )
    if not data.privacy_agreed:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            422,
            "Please agree to the Privacy Policy.",
            details={"privacy_agreed": "required"},
        )
    if data.privacy_version != PRIVACY_VERSION:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            422,
            "Please reload the page.",
            details={"privacy_version": "outdated"},
        )

    email = normalize_email(data.email)
    nickname = data.nickname.strip()
    email_result = check_email(db, email, release=True)
    if not email_result.available:
        raise unavailable_error("email", email_result)
    nickname_result = check_nickname(db, nickname, release=True)
    if not nickname_result.available:
        raise unavailable_error("nickname", nickname_result)

    user = User(
        email=email,
        nickname=nickname,
        password_hash=hash_password(data.password),
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version=PRIVACY_VERSION,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        # 동시에 같은 값으로 가입한 사람이 먼저 저장된 경우 (위 검사는 둘 다 통과)
        db.rollback()
        if "uq_users_nickname" in str(exc.orig):
            field = "nickname"
        else:
            field = "email"
        raise unavailable_error(
            field, AvailabilityResponse(available=False, reason="TAKEN")
        ) from None
    db.refresh(user)
    return user


def unavailable_error(field: str, result: AvailabilityResponse) -> AppError:
    """check_email · check_nickname 의 '쓸 수 없음' 결과 → 가입 응답 409 오류."""
    if result.reason == "REJOIN_TOO_SOON":
        when = result.available_at
        day = f"{when:%b} {when.day}, {when.year}"  # 예: Oct 9, 2026
        return AppError(
            ErrorCode.REJOIN_TOO_SOON,
            409,
            f"You can sign up with this {field} again after {day} (UTC).",
            details={field: "REJOIN_TOO_SOON", "available_at": when.isoformat()},
        )
    if field == "email":
        return AppError(ErrorCode.EMAIL_TAKEN, 409, "This email is already in use.")
    return AppError(ErrorCode.NICKNAME_TAKEN, 409, "This nickname is already in use.")


def authenticate(db: Session, email: str, password: str) -> User:
    """로그인 확인 (FR-103). 맞으면 User, 틀리면 401.

    TODO(P1-05):
    1. user = 이메일(normalize_email)로 조회
    2. user 가 없거나 verify_password(password, user.password_hash) 가 False 이면
       raise AppError(ErrorCode.INVALID_CREDENTIALS, 401, "Email or password is incorrect.")
       - 어느 쪽이 틀렸는지 알려주지 않음 (FR-103 통일 문구)
       - (권장) user 가 없을 때도 가짜 해시로 verify_password 를 한 번 돌려 응답 시간 차이를 줄임
    3. user.status 확인 (FR-108)
       - 'DELETED'   → 위와 같은 INVALID_CREDENTIALS (탈퇴한 계정이 있었는지도 알려주지 않음)
       - 'SUSPENDED' → raise AppError(ErrorCode.ACCOUNT_DISABLED, 403, "This account is disabled.")
    4. user.last_login_at = 지금 (UTC) → db.commit()
    5. return user
    """
    raise NotImplementedError


def get_active_user(db: Session, user_id: int) -> User:
    """재발급(/auth/refresh)용: 토큰의 user_id 가 아직 로그인할 수 있는 계정인지.

    TODO(P1-05):
    - user = db.get(User, user_id)
    - 없거나 status != 'ACTIVE' 이면
      raise AppError(ErrorCode.UNAUTHORIZED, 401, "Please sign in again.")
      (탈퇴 직후 남아 있던 리프레시 쿠키로 다시 들어오는 것을 막음)
    - get_current_user(api/deps.py)와 검사가 같으므로 한쪽에서 이 함수를 불러 써도 됨
    """
    raise NotImplementedError
