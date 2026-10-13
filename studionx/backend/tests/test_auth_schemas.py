"""가입 입력 스키마 (schemas/auth.py SignupRequest · Nickname, P1-04)."""

import pytest
from pydantic import ValidationError

from app.schemas.auth import PRIVACY_VERSION, SignupRequest


def make(**fields):
    values = {
        "email": "kim@naver.com",
        "nickname": "beatmaker",
        "password": "Abcdef1!",
        "privacy_agreed": True,
        "privacy_version": PRIVACY_VERSION,
    }
    values.update(fields)
    return SignupRequest(**values)


def error_fields(**fields):
    with pytest.raises(ValidationError) as info:
        make(**fields)
    return [err["loc"][-1] for err in info.value.errors()]


@pytest.mark.parametrize(
    ("raw", "stored"),
    [
        ("beatmaker", "beatmaker"),
        ("  beatmaker  ", "beatmaker"),
        ("  ab  ", "ab"),
        ("x" * 20, "x" * 20),
    ],
    ids=["그대로", "앞뒤 공백", "공백 빼고 2자", "20자"],
)
def test_nickname_stripped_then_measured(raw, stored):
    assert make(nickname=raw).nickname == stored


@pytest.mark.parametrize(
    "bad",
    ["a", "  a  ", "     ", "x" * 21, "  " + "x" * 21],
    ids=["1자", "공백 빼면 1자", "공백만", "21자", "공백 빼도 21자"],
)
def test_nickname_bad_length(bad):
    assert error_fields(nickname=bad) == ["nickname"]


def test_email_spaces_removed():
    assert make(email="  kim@naver.com  ").email == "kim@naver.com"


@pytest.mark.parametrize(
    "bad",
    ["abc", "a b@x.com", "kim@naver", "deleted+85@withdrawn.invalid", ""],
    ids=["골뱅이 없음", "가운데 공백", "도메인 점 없음", ".invalid", "빈 글자"],
)
def test_email_bad_format(bad):
    assert error_fields(email=bad) == ["email"]


def test_email_too_long():
    # 이메일 규격 상한 254자 — email-validator 가 막음 (DB 칸은 255자)
    ok = "a" * 64 + "@" + ("b" * 61 + ".") * 3 + "com"  # 254자
    assert len(make(email=ok).email) == 254
    assert error_fields(email="a" * 300 + "@x.com") == ["email"]
