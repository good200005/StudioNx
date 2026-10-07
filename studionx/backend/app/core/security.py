# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-03 백엔드 공통 — 모델 컬럼·오류 처리기·토큰 검사·get_current_user
#   브랜치  : feature/phase1/p1-03-backend-core
#   순서    : 1단계 — 가장 먼저 (나머지 API가 모두 이 작업을 씀)
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
"""비밀번호 해시 · JWT — 뼈대: 구현은 직접.

get_current_user(P1-03)가 decode_access_token 을 쓰고,
나머지는 회원가입(P1-04)·로그인(P1-05)에서 채운다.
설정값: core/config.py  jwt_secret, jwt_access_minutes(30), jwt_refresh_days(3)
"""

import re
import string

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode

JWT_ALGORITHM = "HS256"

# 비밀번호 조건 (PRD 01 FR-102) — 화면(join.js PASSWORD_RULES)과 같은 규칙
PASSWORD_MIN, PASSWORD_MAX = 8, 20


def check_password_rules(plain: str) -> list[str]:
    """맞지 않는 조건 이름 목록을 돌려준다 (빈 목록이면 통과). 회원가입·비밀번호 변경에서 사용.

    TODO(P1-04):
    - "length":  PASSWORD_MIN <= len(plain) <= PASSWORD_MAX
    - "upper":   대문자 [A-Z] 1개 이상
    - "lower":   소문자 [a-z] 1개 이상
    - "number":  숫자 [0-9] 1개 이상
    - "special": 키보드 기호 1개 이상 (string.punctuation 중 하나)
    - "allowed": 영문·숫자·키보드 기호만 (re.fullmatch(r"[!-~]+", plain)) — 한글·공백 등은 실패
    - 실패하면 라우터에서
      AppError(ErrorCode.VALIDATION_ERROR, 422, "Check the password requirements.",
               details={"password": 실패 목록})
    """
    failed: list[str] = []
    if not PASSWORD_MIN <= len(plain) <= PASSWORD_MAX:
        failed.append("length")
    if not re.search(r"[A-Z]", plain):
        failed.append("upper")
    if not re.search(r"[a-z]", plain):
        failed.append("lower")
    if not re.search(r"[0-9]", plain):
        failed.append("number")
    if not any(ch in string.punctuation for ch in plain):
        failed.append("special")
    if not re.fullmatch(r"[!-~]+", plain):
        failed.append("allowed")
    return failed


def hash_password(plain: str) -> str:
    """bcrypt 해시 (FR-102).

    TODO(P1-04): bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()
    """
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    """비밀번호가 저장된 해시와 맞는지 (로그인 P1-05 · 비밀번호 변경 P1-09).

    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    - bcrypt 는 72바이트가 넘는 비밀번호나 망가진 해시에 ValueError 를 던짐 → 틀린 것으로 봄
      (로그인 입력은 100자까지 받으므로, 그대로 두면 500 이 남)
    """
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("ascii"))
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    """Access Token 발급 (30분).

    TODO(P1-05): payload = {"sub": str(user_id), "type": "access", "exp": 지금 + 30분}
                 jwt.encode(payload, jwt_secret, algorithm="HS256")
    """
    raise NotImplementedError


def create_refresh_token(user_id: int) -> str:
    """Refresh Token 발급 (HttpOnly 쿠키에 담음, 자동 로그인 3일 — FR-109).

    TODO(P1-05): "type": "refresh", "exp": 지금 + jwt_refresh_days
    - 자동 로그인을 체크하지 않아도 토큰 자체의 만료는 3일 그대로
      (체크 안 하면 쿠키가 세션 쿠키라 브라우저를 닫으면 사라짐 — api/v1/auth.py set_refresh_cookie)
    """
    raise NotImplementedError


def decode_refresh_token(token: str) -> int:
    """Refresh Token 을 검사하고 user_id 를 돌려준다 (P1-05 /auth/refresh).

    TODO(P1-05): decode_access_token 과 같고, "type" == "refresh" 인지 확인
    - 실패하면 raise AppError(ErrorCode.UNAUTHORIZED, 401, "Please sign in again.")
    - 두 함수의 공통 부분은 _decode(token, expected_type) 같은 내부 함수로 묶어도 됨
    """
    raise NotImplementedError


def decode_access_token(token: str) -> int:
    """Access Token 을 검사하고 user_id 를 돌려준다.

    (구현: AI — 2026-10-06, 함수 하나씩 검토)
    - 서명 오류 · 만료 · 형식 오류 · "type" != "access" 이면
      raise AppError(ErrorCode.UNAUTHORIZED, 401, "Please sign in again.")
    """
    return _decode_token(token, "access")


def _decode_token(token: str, expected_type: str) -> int:
    """decode_access_token · decode_refresh_token(P1-05) 공통 — 검사 후 user_id.

    (구현: AI — 2026-10-06, 함수 하나씩 검토)
    - algorithms 를 HS256 하나로 고정 — 토큰이 스스로 정한 방식("none" 등)을 믿지 않음
    - exp · sub · type 이 없으면 실패 (require)
    - 어떤 이유로 실패해도 같은 401 · 같은 문구 (왜 틀렸는지 알려 주지 않음)
    """
    invalid = AppError(ErrorCode.UNAUTHORIZED, 401, "Please sign in again.")
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub", "type"]},
        )
    except jwt.PyJWTError:
        raise invalid from None
    if payload["type"] != expected_type:
        raise invalid
    try:
        return int(payload["sub"])
    except (TypeError, ValueError):
        raise invalid from None
