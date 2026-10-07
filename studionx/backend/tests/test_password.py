"""비밀번호 규칙 · 해시 (core/security.py, P1-04 · PRD 01 FR-102)."""

import string

import bcrypt
import pytest

from app.core.security import check_password_rules, hash_password, verify_password


@pytest.mark.parametrize(
    "password",
    ["Abcdef1!", "Abcdefghijklmnopq1!z", "aB3$" * 2, "Pass_word9"],
    ids=["8자", "20자", "반복", "밑줄 기호"],
)
def test_valid(password):
    assert check_password_rules(password) == []


@pytest.mark.parametrize(
    ("password", "failed"),
    [
        ("Ab1!xyz", ["length"]),  # 7자
        ("Abcdefghijklmnopq1!zz", ["length"]),  # 21자
        ("abcdef1!", ["upper"]),
        ("ABCDEF1!", ["lower"]),
        ("Abcdefg!", ["number"]),
        ("Abcdefg1", ["special"]),
        ("Abcdef1!한", ["allowed"]),
        ("Abc def1!", ["allowed"]),  # 공백
        ("abcdefgh", ["upper", "number", "special"]),
        ("", ["length", "upper", "lower", "number", "special", "allowed"]),
    ],
    ids=[
        "7자",
        "21자",
        "대문자 없음",
        "소문자 없음",
        "숫자 없음",
        "기호 없음",
        "한글",
        "공백",
        "여러 개",
        "빈 글자",
    ],
)
def test_failed_rules(password, failed):
    assert check_password_rules(password) == failed


def test_every_keyboard_symbol_counts_as_special():
    for ch in string.punctuation:
        assert check_password_rules(f"Abcdef1{ch}") == [], ch


def test_special_set_matches_join_js():
    # join.js 의 /[!-/:-@[-`{-~]/ = ASCII 33~126 에서 영문 · 숫자를 뺀 것
    keyboard = {chr(c) for c in range(33, 127)} - set(string.ascii_letters + string.digits)
    assert keyboard == set(string.punctuation)


# ── hash_password (P1-04) ──


def test_hash_format():
    hashed = hash_password("Abcdef1!")
    assert isinstance(hashed, str)
    assert hashed.startswith("$2b$12$")  # bcrypt · 비용 12
    assert len(hashed) == 60  # users.password_hash VARCHAR(255) 에 충분


def test_hash_differs_every_time():
    assert hash_password("Abcdef1!") != hash_password("Abcdef1!")  # 소금(salt)이 매번 다름


def test_hash_matches_original_only():
    hashed = hash_password("Abcdef1!").encode()
    assert bcrypt.checkpw(b"Abcdef1!", hashed)
    assert not bcrypt.checkpw(b"Abcdef1?", hashed)


def test_hash_hides_password():
    assert "Abcdef1!" not in hash_password("Abcdef1!")


def test_hash_longest_allowed_password():
    longest = "Abcdefghijklmnopq1!z"  # 20자 (규칙 최대)
    assert bcrypt.checkpw(longest.encode(), hash_password(longest).encode())


# ── verify_password (P1-04 에서 hash_password 와 함께) ──


@pytest.fixture(scope="module")
def stored():
    return hash_password("Abcdef1!")


def test_verify_correct(stored):
    assert verify_password("Abcdef1!", stored) is True


@pytest.mark.parametrize(
    "wrong",
    ["Abcdef1?", "abcdef1!", "Abcdef1! ", "", "Abcdef1!Abcdef1!"],
    ids=["한 글자 다름", "대소문자", "뒤 공백", "빈 글자", "두 번 반복"],
)
def test_verify_wrong(stored, wrong):
    assert verify_password(wrong, stored) is False


def test_verify_too_long_is_false_not_error(stored):
    # 로그인 입력은 100자까지 받는다. bcrypt 는 72바이트가 넘으면 ValueError → False 로
    assert verify_password("A" * 100, stored) is False
    assert verify_password("한" * 30, stored) is False  # 90바이트


@pytest.mark.parametrize("broken", ["", "x", "not-a-bcrypt-hash", "$2b$12$짧음"])
def test_verify_broken_hash_is_false(broken):
    assert verify_password("Abcdef1!", broken) is False
