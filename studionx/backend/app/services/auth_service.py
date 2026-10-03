"""회원가입 · 중복 확인 서비스 — 템플릿: 구현은 직접 (P1-04).

라우터(api/v1/auth.py)는 요청을 받아 여기 함수를 부르기만 하고,
DB 조회·규칙 검사·저장은 이 파일에서 한다.
"""

from sqlalchemy.orm import Session

from app.models import User
from app.schemas.auth import AvailabilityResponse, SignupRequest

# 탈퇴 후 같은 이메일·닉네임으로 다시 가입할 수 있기까지 기다리는 기간 (FR-108, 2026-10-03 결정)
REJOIN_WAIT_DAYS = 3


def normalize_email(email: str) -> str:
    """비교·저장용 이메일 (앞뒤 공백 제거 + 소문자).

    TODO(P1-04): return email.strip().lower()
    - 중복 확인과 가입 모두 이 함수를 거쳐야 같은 기준으로 비교됨
    """
    raise NotImplementedError


def release_withdrawn(db: Session, user: User) -> None:
    """탈퇴 후 3일이 지난 계정의 이메일·닉네임을 비워 새 가입에 쓸 수 있게 한다 (FR-108).

    email·nickname 은 UNIQUE 라서, 탈퇴한 행이 그대로 쥐고 있으면 같은 값으로 가입할 수 없음.
    그래서 다시 쓰려는 사람이 나타났을 때(가입·중복 확인) 예전 행의 값을 바꿔 둔다.

    TODO(P1-04):
    - user.email    = f"deleted+{user.user_id}@withdrawn.invalid"   (.invalid = 실제로 없는 도메인)
    - user.nickname = f"deleted_{user.user_id}"                     (50자 이내)
    - db.flush()  — 같은 트랜잭션 안에서 새 행을 넣기 전에 UNIQUE 충돌을 먼저 없앰
    - 행 자체·deleted_at·남겨 둔 프로젝트(owner_id)는 그대로
    """
    raise NotImplementedError


def check_email(db: Session, email: str) -> AvailabilityResponse:
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
    """
    raise NotImplementedError


def check_nickname(db: Session, nickname: str) -> AvailabilityResponse:
    """닉네임을 쓸 수 있는가. 회원 정보 수정(P1-08)에서도 같이 사용.

    TODO(P1-04): check_email 과 같은 규칙 (nickname.strip() 으로 비교)
    - 탈퇴 후 3일 안이면 reason='REJOIN_TOO_SOON' — 탈퇴한 사람인 척 바로 같은 이름을 쓰는 것을 막음
    """
    raise NotImplementedError


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
    3. user = User(email=normalize_email(data.email), nickname=data.nickname.strip(),
                   password_hash=hash_password(data.password))
       - role·status·용량 등은 DB 기본값('USER', 'ACTIVE', 5GB)을 그대로 씀
    4. db.add(user) → db.commit() → db.refresh(user)  (user_id·created_at 채우기)
    5. 동시에 같은 이메일로 가입하면 2번을 둘 다 통과할 수 있음
       → db.commit() 에서 sqlalchemy.exc.IntegrityError 를 잡아 db.rollback() 후 409
         (어느 칸인지는 오류 메시지의 uq_users_email / uq_users_nickname 으로 구분)
    6. return user
    """
    raise NotImplementedError
