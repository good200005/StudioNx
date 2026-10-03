"""회원가입 · 중복 확인 서비스 — 템플릿: 구현은 직접 (P1-04).

라우터(api/v1/auth.py)는 요청을 받아 여기 함수를 부르기만 하고,
DB 조회·규칙 검사·저장은 이 파일에서 한다.
"""

from sqlalchemy.orm import Session

from app.models import User
from app.schemas.auth import SignupRequest


def normalize_email(email: str) -> str:
    """비교·저장용 이메일 (앞뒤 공백 제거 + 소문자).

    TODO(P1-04): return email.strip().lower()
    - 중복 확인과 가입 모두 이 함수를 거쳐야 같은 기준으로 비교됨
    """
    raise NotImplementedError


def is_email_taken(db: Session, email: str) -> bool:
    """이미 쓰고 있는 이메일인가 (FR-101).

    TODO(P1-04):
    - stmt = select(User.user_id).where(User.email == normalize_email(email))
    - return db.scalar(stmt) is not None
    - 탈퇴(status='DELETED') 계정의 이메일도 UNIQUE 라서 "사용 중"으로 봄
      (다시 쓸 수 있게 할지는 FR-108 탈퇴 처리에서 정함 — 예: 탈퇴 시 email 을 바꿔 두기)
    """
    raise NotImplementedError


def is_nickname_taken(db: Session, nickname: str) -> bool:
    """이미 쓰고 있는 닉네임인가 (FR-101). 회원 정보 수정(P1-08)에서도 같이 사용.

    TODO(P1-04): is_email_taken 과 같은 방식 (nickname.strip() 으로 비교)
    """
    raise NotImplementedError


def signup(db: Session, data: SignupRequest) -> User:
    """회원가입 (FR-101~102). 성공하면 저장된 User 를 돌려준다.

    TODO(P1-04) 순서:
    1. failed = check_password_rules(data.password)        (core/security.py)
       failed 가 있으면
       raise AppError(ErrorCode.VALIDATION_ERROR, 422, "Check the password requirements.",
                      details={"password": failed})
    2. is_email_taken
         → raise AppError(ErrorCode.EMAIL_TAKEN, 409, "This email is already in use.")
       is_nickname_taken
         → raise AppError(ErrorCode.NICKNAME_TAKEN, 409, "This nickname is already in use.")
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
