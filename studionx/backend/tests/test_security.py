"""토큰 검사 (core/security.py decode_access_token, P1-03).

토큰 발급(create_access_token)은 P1-05 라서, 시험에서는 jwt.encode 로 직접 만든다.
"""

from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.core.security import decode_access_token

SECRET = get_settings().jwt_secret


def make_token(secret=SECRET, algorithm="HS256", minutes=30, **claims):
    payload = {"sub": "7", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=minutes)}
    payload.update(claims)
    payload = {k: v for k, v in payload.items() if v is not None}  # None = 그 칸을 뺌
    return jwt.encode(payload, secret, algorithm=algorithm)


def assert_unauthorized(token):
    with pytest.raises(AppError) as info:
        decode_access_token(token)
    err = info.value
    assert (err.code, err.status_code, err.message) == (
        ErrorCode.UNAUTHORIZED,
        401,
        "Please sign in again.",
    )


def test_valid_token_returns_user_id():
    assert decode_access_token(make_token()) == 7


def test_expired_token():
    assert_unauthorized(make_token(minutes=-1))


def test_wrong_secret():
    assert_unauthorized(make_token(secret="another-secret-another-secret-123"))


def test_refresh_token_is_not_access_token():
    assert_unauthorized(make_token(type="refresh"))


def test_missing_claims():
    assert_unauthorized(make_token(sub=None))
    assert_unauthorized(make_token(type=None))
    assert_unauthorized(make_token(exp=None))


def test_sub_not_a_number():
    assert_unauthorized(make_token(sub="admin"))


def test_garbage_and_empty():
    assert_unauthorized("not-a-token")
    assert_unauthorized("")


def test_alg_none_rejected():
    # 서명 없는 토큰 — 서버가 토큰이 정한 방식을 믿으면 누구나 위조할 수 있다
    forged = jwt.encode(
        {"sub": "1", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=5)},
        key=None,
        algorithm="none",
    )
    assert_unauthorized(forged)


def test_tampered_payload():
    # 가운데(내용) 부분만 바꾸면 서명이 맞지 않는다
    head, _, sig = make_token(sub="7").split(".")
    other_body = make_token(sub="1").split(".")[1]
    assert_unauthorized(f"{head}.{other_body}.{sig}")
