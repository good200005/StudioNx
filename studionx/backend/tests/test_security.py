"""토큰 검사 (core/security.py decode_access_token, P1-03).

토큰 발급(create_access_token)은 P1-05 라서, 시험에서는 jwt.encode 로 직접 만든다.
"""

from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
)

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


# ── create_access_token (P1-05) ──


def read(token):
    """서명까지 확인하고 내용을 꺼냄 (시험용)."""
    return jwt.decode(token, SECRET, algorithms=["HS256"])


def test_access_token_round_trip():
    assert decode_access_token(create_access_token(7)) == 7  # 05 가 그대로 읽음


def test_access_token_contents():
    payload = read(create_access_token(7))
    assert payload["sub"] == "7"  # 글자 (JWT 규격)
    assert payload["type"] == "access"
    assert payload["exp"] - payload["iat"] == 30 * 60  # 30분


def test_access_token_header_is_hs256():
    assert jwt.get_unverified_header(create_access_token(7))["alg"] == "HS256"


def test_access_token_expires_close_to_now_plus_30_min():
    before = datetime.now(UTC).timestamp()
    payload = read(create_access_token(7))
    assert before - 1 <= payload["iat"] <= before + 2
    assert payload["exp"] == payload["iat"] + 1800


def test_access_tokens_differ_per_user():
    assert create_access_token(7) != create_access_token(8)


# ── create_refresh_token (P1-05) ──


def test_refresh_token_contents():
    payload = read(create_refresh_token(7))
    assert (payload["sub"], payload["type"]) == ("7", "refresh")
    assert payload["exp"] - payload["iat"] == 3 * 24 * 60 * 60  # 3일


def test_refresh_token_cannot_be_used_as_access():
    # 05 decode_access_token 이 type 을 검사 → 3일짜리 토큰을 API 요청에 쓸 수 없음
    assert_unauthorized(create_refresh_token(7))


def test_access_and_refresh_differ():
    assert create_access_token(7) != create_refresh_token(7)


# ── decode_refresh_token (P1-05) ──


def assert_refresh_unauthorized(token):
    with pytest.raises(AppError) as info:
        decode_refresh_token(token)
    assert (info.value.code, info.value.status_code, info.value.message) == (
        ErrorCode.UNAUTHORIZED,
        401,
        "Please sign in again.",
    )


def test_refresh_round_trip():
    assert decode_refresh_token(create_refresh_token(7)) == 7


def test_access_token_cannot_be_used_as_refresh():
    assert_refresh_unauthorized(create_access_token(7))  # 30분짜리로 재발급 못 받음


@pytest.mark.parametrize(
    "token",
    [
        make_token(type="refresh", minutes=-1),  # 만료
        make_token(type="refresh", secret="another-secret-another-secret-123"),  # 다른 비밀값
        make_token(type="refresh", sub="admin"),
        make_token(type="refresh", exp=None),
        "not-a-token",
        "",
    ],
    ids=["만료", "다른 비밀값", "sub 숫자 아님", "exp 없음", "엉터리", "빈 글자"],
)
def test_refresh_bad_tokens(token):
    assert_refresh_unauthorized(token)
