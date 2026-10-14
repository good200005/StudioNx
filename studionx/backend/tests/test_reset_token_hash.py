"""hash_reset_token (P1-28, FR-118) — 재설정 토큰 해시."""

import hashlib
from datetime import UTC, datetime, timedelta

import pytest

from app.core.security import hash_reset_token
from app.core.security import issued_before_password_change as stale


def test_known_sha256_value():
    # "abc" 의 SHA-256 은 표준 시험값
    expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    assert hash_reset_token("abc") == expected


def test_is_64_lowercase_hex_for_char64_column():
    digest = hash_reset_token("some-token")
    assert len(digest) == 64
    assert digest == digest.lower()
    int(digest, 16)  # 16진수가 아니면 ValueError


def test_same_input_gives_same_hash():
    # 링크를 눌렀을 때 해시로 행을 찾으려면 항상 같은 값이어야 한다
    assert hash_reset_token("t") == hash_reset_token("t")


def test_different_inputs_give_different_hashes():
    assert hash_reset_token("t1") != hash_reset_token("t2")


def test_is_case_sensitive():
    assert hash_reset_token("AbC") != hash_reset_token("abc")


def test_does_not_contain_the_original_token():
    token = "very-secret-token-value"
    assert token not in hash_reset_token(token)


def test_non_ascii_is_hashed_as_utf8():
    assert hash_reset_token("비밀") == hashlib.sha256("비밀".encode()).hexdigest()


@pytest.mark.parametrize("bad", ["", None, 123, b"abc", ["a"]])
def test_rejects_empty_or_non_string(bad):
    with pytest.raises(ValueError):
        hash_reset_token(bad)


# ---------------------------------------------------------------- generate_reset_token
def test_generate_returns_token_and_its_hash():
    from app.core.security import generate_reset_token

    token, digest = generate_reset_token()
    assert digest == hash_reset_token(token)


def test_generate_token_is_long_and_url_safe():
    import re

    from app.core.security import generate_reset_token

    token, _ = generate_reset_token()
    assert len(token) == 43  # 32바이트를 URL 안전 base64 로 쓴 길이 (= 없이)
    assert re.fullmatch(r"[A-Za-z0-9_-]+", token)  # 링크에 그대로 넣어도 되는 글자만


def test_generate_gives_different_values_every_time():
    from app.core.security import generate_reset_token

    tokens = {generate_reset_token()[0] for _ in range(200)}
    digests = {hash_reset_token(t) for t in tokens}
    assert len(tokens) == 200
    assert len(digests) == 200


def test_generate_hash_fits_char64_and_does_not_contain_token():
    from app.core.security import generate_reset_token

    token, digest = generate_reset_token()
    assert len(digest) == 64
    assert token not in digest


def test_generate_uses_secrets_not_random(monkeypatch):
    import app.core.security as security

    calls = []
    monkeypatch.setattr(security.secrets, "token_urlsafe", lambda n: calls.append(n) or "x" * 43)
    token, _ = security.generate_reset_token()
    assert calls == [32]  # secrets 를 32바이트로 불렀다
    assert token == "x" * 43


# ---------------------------------------------------------------- issued_before_password_change

CHANGED = datetime(2026, 10, 14, 12, 0, 0, 500000)  # UTC, 시간대 정보 없음, 12:00:00.500
CHANGED_EPOCH = int(CHANGED.replace(tzinfo=UTC).timestamp())  # 초 미만을 버린 12:00:00


def test_never_reset_means_never_stale():
    assert stale(0, None) is False
    assert stale(1_000_000_000, None) is False
    assert stale(None, None) is False  # 재설정한 적이 없으면 iat 가 이상해도 영향 없음


def test_token_issued_before_the_reset_is_stale():
    assert stale(CHANGED_EPOCH - 1, CHANGED) is True
    assert stale(CHANGED_EPOCH - 3600, CHANGED) is True


def test_token_issued_after_the_reset_is_valid():
    assert stale(CHANGED_EPOCH + 1, CHANGED) is False
    assert stale(CHANGED_EPOCH + 86400, CHANGED) is False


def test_token_issued_in_the_same_second_is_valid():
    # 밀리초 .500 을 그대로 비교하면 같은 초(12:00:00)에 로그인한 새 토큰이 잘못 무효가 된다
    assert stale(CHANGED_EPOCH, CHANGED) is False
    assert stale(CHANGED_EPOCH, CHANGED.replace(microsecond=0)) is False
    assert stale(CHANGED_EPOCH, CHANGED.replace(microsecond=999000)) is False


def test_second_boundary_just_before_and_after():
    on_the_second = datetime(2026, 10, 14, 12, 0, 0, 0)
    epoch = int(on_the_second.replace(tzinfo=UTC).timestamp())
    assert stale(epoch - 1, on_the_second) is True
    assert stale(epoch, on_the_second) is False


def test_float_iat_is_compared_by_value():
    assert stale(CHANGED_EPOCH - 0.5, CHANGED) is True
    assert stale(CHANGED_EPOCH + 0.5, CHANGED) is False


@pytest.mark.parametrize("bad", [None, "1760443200", True, False, [], {}, b"1"])
def test_missing_or_non_numeric_iat_is_stale_once_the_password_was_reset(bad):
    assert stale(bad, CHANGED) is True


def test_uses_utc_not_local_time():
    # 시간대 정보가 없는 시각을 UTC 로 읽는다 (서버가 어느 시간대여도 같은 결과)
    assert datetime.now(UTC).tzinfo is not None
    now_naive = datetime.now(UTC).replace(tzinfo=None)
    just_before = int((datetime.now(UTC) - timedelta(seconds=5)).timestamp())
    assert stale(just_before, now_naive) is True
