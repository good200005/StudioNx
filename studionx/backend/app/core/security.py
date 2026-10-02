"""비밀번호 해시 · JWT — 뼈대: 구현은 직접.

get_current_user(P1-03)가 decode_access_token 을 쓰고,
나머지는 회원가입(P1-04)·로그인(P1-05)에서 채운다.
설정값: core/config.py  jwt_secret, jwt_access_minutes(30), jwt_refresh_days(3)
"""


def hash_password(plain: str) -> str:
    """bcrypt 해시 (FR-102).

    TODO(P1-04): bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()
    """
    raise NotImplementedError


def verify_password(plain: str, hashed: str) -> bool:
    """TODO(P1-05): bcrypt.checkpw"""
    raise NotImplementedError


def create_access_token(user_id: int) -> str:
    """Access Token 발급 (30분).

    TODO(P1-05): payload = {"sub": str(user_id), "type": "access", "exp": 지금 + 30분}
                 jwt.encode(payload, jwt_secret, algorithm="HS256")
    """
    raise NotImplementedError


def create_refresh_token(user_id: int) -> str:
    """Refresh Token 발급 (HttpOnly 쿠키에 담음, 자동 로그인 3일 — FR-109).

    TODO(P1-05): "type": "refresh", "exp": 지금 + jwt_refresh_days
    """
    raise NotImplementedError


def decode_access_token(token: str) -> int:
    """Access Token 을 검사하고 user_id 를 돌려준다.

    TODO(P1-03):
    - jwt.decode(token, jwt_secret, algorithms=["HS256"])
    - 서명 오류·만료(ExpiredSignatureError)·"type" != "access" 이면
      raise AppError(ErrorCode.UNAUTHORIZED, 401, "Please sign in again.")
    - payload["sub"] 를 int 로 바꿔 반환
    """
    raise NotImplementedError
