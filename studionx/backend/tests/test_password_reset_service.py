"""비밀번호 재설정 서비스 (services/password_reset_service.py, P1-28)."""

import logging
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.core.security import hash_password, hash_reset_token, verify_password
from app.models import PasswordResetToken, User
from app.models.user import UserStatus
from app.services import password_reset_service as svc
from app.services.password_reset_service import create_reset_token


def add_user(db, email="reset@example.com", nickname="reset01"):
    user = User(
        email=email,
        password_hash=hash_password("Abcdef1!"),
        nickname=nickname,
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-08",
    )
    db.add(user)
    db.commit()
    return user


def rows(db, user):
    return list(
        db.scalars(
            select(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.user_id)
            .order_by(PasswordResetToken.token_id)
        )
    )


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


def test_returns_token_and_stores_only_its_hash(db):
    user = add_user(db)
    token = create_reset_token(db, user)
    (row,) = rows(db, user)
    assert row.token_hash == hash_reset_token(token)
    assert token not in row.token_hash  # 원문은 저장하지 않음
    assert len(token) == 43


def test_expires_in_configured_minutes(db):
    user = add_user(db)
    before = utcnow()
    create_reset_token(db, user)
    (row,) = rows(db, user)
    minutes = get_settings().password_reset_minutes
    assert minutes == 30
    # DATETIME(3)은 밀리초로 반올림해 저장하므로 1초 여유를 둔다
    slack = timedelta(seconds=1)
    assert before + timedelta(minutes=minutes) - slack <= row.expires_at
    assert row.expires_at <= utcnow() + timedelta(minutes=minutes) + slack


def test_new_token_is_unused(db):
    user = add_user(db)
    create_reset_token(db, user)
    (row,) = rows(db, user)
    assert row.used_at is None


def test_second_request_invalidates_the_first(db):
    user = add_user(db)
    first = create_reset_token(db, user)
    second = create_reset_token(db, user)
    old, new = rows(db, user)
    assert old.token_hash == hash_reset_token(first)
    assert old.used_at is not None  # 이전 링크는 못 씀
    assert new.token_hash == hash_reset_token(second)
    assert new.used_at is None  # 살아 있는 것은 하나뿐
    assert first != second


def test_does_not_touch_other_users_tokens(db):
    a = add_user(db, "a@example.com", "usera01")
    b = add_user(db, "b@example.com", "userb01")
    create_reset_token(db, a)
    create_reset_token(db, b)
    create_reset_token(db, a)  # a 가 다시 요청해도 b 의 토큰은 그대로
    (b_row,) = rows(db, b)
    assert b_row.used_at is None


def test_already_used_token_keeps_its_original_used_at(db):
    user = add_user(db)
    create_reset_token(db, user)
    (row,) = rows(db, user)
    stamp = utcnow() - timedelta(hours=1)
    row.used_at = stamp
    db.commit()
    create_reset_token(db, user)
    assert rows(db, user)[0].used_at == stamp  # 이미 쓴 것의 시각은 덮어쓰지 않음


def test_many_requests_leave_exactly_one_live_token(db):
    user = add_user(db)
    for _ in range(5):
        create_reset_token(db, user)
    live = [r for r in rows(db, user) if r.used_at is None]
    assert len(rows(db, user)) == 5
    assert len(live) == 1


# ---------------------------------------------------------------- check_reset_rate_limit
@pytest.fixture
def clock(monkeypatch):
    """시험용 시계: now[0] 을 직접 움직인다. 기록은 시험마다 비운다."""
    svc._recent_requests.clear()
    now = [1000.0]
    monkeypatch.setattr(svc, "_clock", lambda: now[0])
    yield now
    svc._recent_requests.clear()


def attempt(email="a@example.com", ip="1.1.1.1"):
    svc.check_reset_rate_limit(ip, email)


def blocked(email="a@example.com", ip="1.1.1.1"):
    with pytest.raises(AppError) as err:
        attempt(email, ip)
    return err.value


def test_same_email_allows_three_then_blocks_fourth(clock):
    for _ in range(3):
        attempt()
    err = blocked()
    assert err.status_code == 429
    assert err.code == ErrorCode.TOO_MANY_REQUESTS


def test_email_is_case_and_space_insensitive(clock):
    attempt(" A@Example.com ")
    attempt("a@example.com")
    attempt("A@EXAMPLE.COM")
    blocked("a@example.com")


def test_same_ip_allows_ten_across_different_emails_then_blocks(clock):
    for i in range(10):
        attempt(f"user{i}@example.com", "9.9.9.9")
    blocked("another@example.com", "9.9.9.9")


def test_different_email_and_ip_are_not_affected(clock):
    for _ in range(3):
        attempt("a@example.com", "1.1.1.1")
    attempt("b@example.com", "2.2.2.2")  # 다른 이메일, 다른 IP 는 그대로 통과


def test_blocked_request_is_not_counted_and_retry_after_is_reported(clock):
    for _ in range(3):
        attempt()
    clock[0] += 100
    first = blocked().details["retry_after"]
    clock[0] += 100
    second = blocked().details["retry_after"]
    assert first == 10 * 60 - 100 + 1
    assert second == 10 * 60 - 200 + 1  # 막힌 요청이 시간을 늘리지 않고 줄어든다


def test_allowed_again_after_ten_minutes(clock):
    for _ in range(3):
        attempt()
    clock[0] += 10 * 60 + 1
    attempt()  # 기록이 만료되어 통과


def test_counts_every_request_regardless_of_whether_the_account_exists(clock, db):
    # 없는 이메일도 가입된 이메일처럼 3번째까지 통과하고 4번째에 막힌다 (가입 여부가 드러나지 않음)
    add_user(db, "real@example.com", "real0001")
    for email in ("real@example.com", "ghost@example.com"):
        for _ in range(3):
            attempt(email, f"10.0.0.{len(email)}")
        blocked(email, f"10.0.0.{len(email)}")


def test_works_without_ip_and_uses_only_email_limit(clock):
    for _ in range(3):
        attempt(ip=None)
    blocked(ip=None)
    assert all(k.startswith("email:") for k in svc._recent_requests)


def test_empty_records_are_removed_so_memory_does_not_grow(clock):
    attempt("a@example.com", "1.1.1.1")
    clock[0] += 10 * 60 + 1
    attempt("b@example.com", "2.2.2.2")  # 이때 만료된 a 의 기록을 정리한다
    attempt("a@example.com", "1.1.1.1")
    assert len(svc._recent_requests["email:a@example.com"]) == 1


# ---------------------------------------------------------------- request_password_reset
def logged(caplog):
    return "\n".join(r.getMessage() for r in caplog.records)


@pytest.fixture
def reset_env(clock, monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger="uvicorn.error")
    settings = get_settings()
    monkeypatch.setattr(settings, "mail_backend", "log")
    monkeypatch.setattr(settings, "app_base_url", "http://localhost:8000/")
    return caplog


def test_active_user_gets_a_link_in_the_log_and_a_stored_hash(db, reset_env):
    user = add_user(db, "real@example.com", "real0001")
    assert svc.request_password_reset(db, "real@example.com", "1.1.1.1") is None
    text = logged(reset_env)
    token = text.split("#token=")[1].strip()
    assert "http://localhost:8000/resetPassword.html#token=" in text  # 끝의 / 가 겹치지 않음
    (row,) = rows(db, user)
    assert row.token_hash == hash_reset_token(token)
    assert row.used_at is None


def test_link_puts_token_after_hash_not_in_query(db, reset_env):
    add_user(db, "real@example.com", "real0001")
    svc.request_password_reset(db, "real@example.com", None)
    assert "?token=" not in logged(reset_env)
    assert "resetPassword.html#token=" in logged(reset_env)


def test_email_is_masked_in_the_log(db, reset_env):
    add_user(db, "real@example.com", "real0001")
    svc.request_password_reset(db, "real@example.com", None)
    text = logged(reset_env)
    assert "r***@example.com" in text
    assert "real@example.com" not in text


def test_email_lookup_ignores_case_and_spaces(db, reset_env):
    user = add_user(db, "real@example.com", "real0001")
    svc.request_password_reset(db, "  REAL@Example.COM ", None)
    assert len(rows(db, user)) == 1


def test_unknown_email_does_nothing_and_returns_the_same(db, reset_env):
    assert svc.request_password_reset(db, "ghost@example.com", "1.1.1.1") is None
    assert db.scalar(select(PasswordResetToken)) is None
    assert "resetPassword" not in logged(reset_env)


@pytest.mark.parametrize("status", [UserStatus.DELETED, UserStatus.SUSPENDED])
def test_deleted_or_suspended_user_gets_nothing_but_same_result(db, reset_env, status):
    user = add_user(db, "gone@example.com", "gone0001")
    user.status = status
    db.commit()
    assert svc.request_password_reset(db, "gone@example.com", None) is None
    assert rows(db, user) == []
    assert "resetPassword" not in logged(reset_env)


def test_rate_limit_applies_even_to_unknown_emails(db, reset_env):
    for _ in range(3):
        svc.request_password_reset(db, "ghost@example.com", "1.1.1.1")
    with pytest.raises(AppError) as err:
        svc.request_password_reset(db, "ghost@example.com", "1.1.1.1")
    assert err.value.status_code == 429


def test_second_request_replaces_the_first_link(db, reset_env):
    user = add_user(db, "real@example.com", "real0001")
    svc.request_password_reset(db, "real@example.com", None)
    svc.request_password_reset(db, "real@example.com", None)
    old, new = rows(db, user)
    assert old.used_at is not None
    assert new.used_at is None


def test_without_log_mail_backend_no_token_and_no_link(db, reset_env, monkeypatch):
    monkeypatch.setattr(get_settings(), "mail_backend", "smtp")
    user = add_user(db, "real@example.com", "real0001")
    assert svc.request_password_reset(db, "real@example.com", None) is None
    assert rows(db, user) == []  # 보낼 수 없으면 토큰도 만들지 않음
    assert "resetPassword" not in logged(reset_env)
    assert "not configured" in logged(reset_env)


@pytest.mark.parametrize(
    ("email", "masked"),
    [("real@example.com", "r***@example.com"), ("a@b.co", "a***@b.co"), ("nodomain", "***")],
)
def test_mask_email(email, masked):
    assert svc.mask_email(email) == masked


# ---------------------------------------------------------------- reset_password
NEW_PW = "Newpass1!"


def issue(db, email="real@example.com", nickname="real0001"):
    """회원을 만들고 재설정 토큰 원문을 받는다."""
    user = add_user(db, email, nickname)
    return user, create_reset_token(db, user)


def fail_code(db, token, password=NEW_PW):
    with pytest.raises(AppError) as err:
        svc.reset_password(db, token, password)
    return err.value


def test_valid_token_changes_the_password_and_records_the_time(db):
    user, token = issue(db)
    before = utcnow()
    assert svc.reset_password(db, token, NEW_PW) is None
    db.refresh(user)
    assert verify_password(NEW_PW, user.password_hash)
    assert not verify_password("Abcdef1!", user.password_hash)  # 예전 비밀번호는 못 씀
    assert user.password_changed_at is not None
    slack = timedelta(seconds=1)
    assert before - slack <= user.password_changed_at <= utcnow() + slack


def test_token_is_single_use(db):
    user, token = issue(db)
    svc.reset_password(db, token, NEW_PW)
    err = fail_code(db, token, "Another1!")
    assert (err.status_code, err.code) == (400, ErrorCode.INVALID_RESET_LINK)
    db.refresh(user)
    assert verify_password(NEW_PW, user.password_hash)  # 두 번째는 반영되지 않음


def test_unknown_expired_used_and_blank_tokens_give_the_same_error(db):
    user, token = issue(db)
    # 만료
    row = rows(db, user)[0]
    row.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    expired = fail_code(db, token)
    # 이미 씀
    user2, token2 = issue(db, "two@example.com", "two00001")
    svc.reset_password(db, token2, NEW_PW)
    used = fail_code(db, token2)
    # 없음, 빈 값
    unknown = fail_code(db, "x" * 43)
    blank = fail_code(db, "")
    messages = {e.message for e in (expired, used, unknown, blank)}
    codes = {(e.status_code, e.code) for e in (expired, used, unknown, blank)}
    assert codes == {(400, ErrorCode.INVALID_RESET_LINK)}
    assert len(messages) == 1  # 이유가 문구로 드러나지 않음


def test_weak_password_is_422_and_keeps_the_token_usable(db):
    user, token = issue(db)
    err = fail_code(db, token, "short")
    assert err.status_code == 422
    assert "new_password" in err.details
    assert rows(db, user)[0].used_at is None  # 토큰은 그대로
    db.refresh(user)
    assert verify_password("Abcdef1!", user.password_hash)  # 비밀번호도 그대로
    assert user.password_changed_at is None
    svc.reset_password(db, token, NEW_PW)  # 고쳐서 다시 보내면 됨
    db.refresh(user)
    assert verify_password(NEW_PW, user.password_hash)


def test_invalid_link_is_reported_before_password_rules(db):
    # 링크가 틀리면 비밀번호가 약해도 링크 오류가 먼저 (링크 문제를 가리지 않음)
    err = fail_code(db, "x" * 43, "short")
    assert err.code == ErrorCode.INVALID_RESET_LINK


@pytest.mark.parametrize("status", [UserStatus.DELETED, UserStatus.SUSPENDED])
def test_inactive_user_cannot_reset(db, status):
    user, token = issue(db)
    user.status = status
    db.commit()
    err = fail_code(db, token)
    assert err.code == ErrorCode.INVALID_RESET_LINK
    db.refresh(user)
    assert verify_password("Abcdef1!", user.password_hash)


def test_other_live_tokens_of_the_user_are_invalidated(db):
    user, token = issue(db)
    extra = PasswordResetToken(
        user_id=user.user_id, token_hash=hash_reset_token("another-live-token"),
        expires_at=utcnow() + timedelta(minutes=10),
    )
    db.add(extra)
    db.commit()
    svc.reset_password(db, token, NEW_PW)
    assert all(r.used_at is not None for r in rows(db, user))
    err = fail_code(db, "another-live-token")
    assert err.code == ErrorCode.INVALID_RESET_LINK


def test_does_not_touch_other_users(db):
    a, token_a = issue(db, "a@example.com", "usera001")
    b, token_b = issue(db, "b@example.com", "userb001")
    svc.reset_password(db, token_a, NEW_PW)
    db.refresh(b)
    assert verify_password("Abcdef1!", b.password_hash)
    assert rows(db, b)[0].used_at is None
    svc.reset_password(db, token_b, "Bnewpass1!")  # b 의 링크는 아직 쓸 수 있음


def test_losing_the_race_for_the_token_gives_invalid_link(db, monkeypatch):
    """조회 뒤 다른 요청이 먼저 토큰을 쓴 경우: 사용 처리가 0행이면 같은 오류, 비밀번호는 그대로."""
    user, token = issue(db)
    real_execute = db.execute

    def lose_race(statement, *args, **kwargs):
        # 첫 UPDATE(토큰 사용 처리) 직전에 다른 요청이 먼저 써 버렸다고 흉내
        if getattr(statement, "is_update", False) and not getattr(lose_race, "done", False):
            lose_race.done = True
            real_execute(
                update(PasswordResetToken)
                .where(PasswordResetToken.user_id == user.user_id)
                .values(used_at=utcnow())
            )
        return real_execute(statement, *args, **kwargs)

    monkeypatch.setattr(db, "execute", lose_race)
    err = fail_code(db, token)
    assert err.code == ErrorCode.INVALID_RESET_LINK
    monkeypatch.undo()
    db.refresh(user)
    assert verify_password("Abcdef1!", user.password_hash)


# ------------------------------------------------ 실제 앱: 재설정 뒤 이전 로그인 무효
def test_real_app_old_login_is_rejected_after_reset_and_new_login_works(db):
    """실제 라우터와 실제 MySQL: 재설정 전 토큰은 401, 재설정 뒤 발급은 200."""
    import jwt
    from fastapi.testclient import TestClient

    from app.core.security import create_access_token
    from app.db.session import get_db
    from app.main import app

    user, link_token = issue(db, "flow@example.com", "flow0001")
    secret = get_settings().jwt_secret

    def bearer_for(iat):
        payload = {
            "sub": str(user.user_id),
            "type": "access",
            "iat": iat,
            "exp": datetime.now(UTC) + timedelta(minutes=30),
        }
        return {"Authorization": "Bearer " + jwt.encode(payload, secret, algorithm="HS256")}

    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        now = int(datetime.now(UTC).timestamp())
        old = bearer_for(now - 3600)  # 한 시간 전에 로그인한 기기 (도난 토큰일 수도)
        assert client.get("/api/v1/me/dashboard", headers=old).status_code == 200  # 재설정 전: 유효

        svc.reset_password(db, link_token, NEW_PW)

        assert client.get("/api/v1/me/dashboard", headers=old).status_code == 401  # 재설정 뒤: 무효
        new_headers = {"Authorization": "Bearer " + create_access_token(user.user_id)}
        assert client.get("/api/v1/me/dashboard", headers=new_headers).status_code == 200
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------- POST /auth/password-reset/request
@pytest.fixture
def api(db, clock, monkeypatch, caplog):
    """실제 앱과 실제 MySQL. 메일은 로그로(개발용), 시간은 시험용 시계로."""
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.main import app

    caplog.set_level(logging.INFO, logger="uvicorn.error")
    monkeypatch.setattr(get_settings(), "mail_backend", "log")
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


URL = "/api/v1/auth/password-reset/request"
SAME_BODY = {"message": "If an account exists for that email, we've sent a message."}


def test_route_is_registered_as_post_202():
    from app.main import app

    operation = app.openapi()["paths"][URL]["post"]
    assert "202" in operation["responses"]
    assert "429" in operation["responses"]


def test_existing_account_gets_202_and_the_fixed_body_and_a_stored_token(api, db):
    user = add_user(db, "real@example.com", "real0001")
    res = api.post(URL, json={"email": "real@example.com"})
    assert (res.status_code, res.json()) == (202, SAME_BODY)
    assert len(rows(db, user)) == 1


def test_unknown_account_gets_exactly_the_same_response(api, db):
    add_user(db, "real@example.com", "real0001")
    real = api.post(URL, json={"email": "real@example.com"})
    ghost = api.post(URL, json={"email": "ghost@example.com"})
    assert (ghost.status_code, ghost.json()) == (real.status_code, real.json()) == (202, SAME_BODY)
    # 응답 헤더도 가입 여부에 따라 달라지지 않음 (길이, 쿠키)
    assert ghost.headers["content-length"] == real.headers["content-length"]
    assert "set-cookie" not in real.headers and "set-cookie" not in ghost.headers


@pytest.mark.parametrize("status", [UserStatus.DELETED, UserStatus.SUSPENDED])
def test_deleted_or_suspended_account_gets_the_same_response(api, db, status):
    user = add_user(db, "gone@example.com", "gone0001")
    user.status = status
    db.commit()
    res = api.post(URL, json={"email": "gone@example.com"})
    assert (res.status_code, res.json()) == (202, SAME_BODY)
    assert rows(db, user) == []


def test_email_is_normalized_before_lookup(api, db):
    user = add_user(db, "real@example.com", "real0001")
    res = api.post(URL, json={"email": "  REAL@Example.COM "})
    assert res.status_code == 202
    assert len(rows(db, user)) == 1


@pytest.mark.parametrize("bad", ["", "not-an-email", "a@", "@b.com", "a b@c.com"])
def test_bad_email_format_is_422(api, bad):
    res = api.post(URL, json={"email": bad})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_missing_or_extra_body_is_422(api):
    assert api.post(URL, json={}).status_code == 422
    assert api.post(URL).status_code == 422


def test_too_many_requests_is_429_for_known_and_unknown_emails_alike(api, db):
    add_user(db, "real@example.com", "real0001")
    for email in ("real@example.com", "ghost@example.com"):
        for _ in range(3):
            assert api.post(URL, json={"email": email}).status_code == 202
        res = api.post(URL, json={"email": email})
        assert res.status_code == 429  # 가입 여부와 관계없이 4번째에 막힘
        assert res.json()["error"]["code"] == "TOO_MANY_REQUESTS"
        assert res.json()["error"]["details"]["retry_after"] > 0


def test_no_login_is_required(api, db):
    add_user(db, "real@example.com", "real0001")
    assert api.post(URL, json={"email": "real@example.com"}).status_code == 202  # 토큰 없이 호출됨


def test_response_never_contains_the_token_or_the_email(api, db, caplog):
    add_user(db, "real@example.com", "real0001")
    res = api.post(URL, json={"email": "real@example.com"})
    token = logged(caplog).split("#token=")[1].strip()
    assert token not in res.text
    assert "real@example.com" not in res.text


def test_ip_limit_applies_through_the_route_across_different_emails(api):
    for i in range(10):
        assert api.post(URL, json={"email": f"user{i}@example.com"}).status_code == 202
    res = api.post(URL, json={"email": "another@example.com"})
    assert res.status_code == 429  # 이메일은 처음 보는 주소여도 같은 IP 에서 11번째라 막힘


# ---------------------------------------------------------------- POST /auth/password-reset/confirm
CONFIRM = "/api/v1/auth/password-reset/confirm"
LOGIN = "/api/v1/auth/login"


def confirm(api, token, password=NEW_PW):
    return api.post(CONFIRM, json={"token": token, "new_password": password})


def test_confirm_route_is_registered_as_post_204():
    from app.main import app

    operation = app.openapi()["paths"][CONFIRM]["post"]
    assert "204" in operation["responses"]
    assert "400" in operation["responses"]
    assert "422" in operation["responses"]


def test_confirm_changes_the_password_and_returns_204_without_a_body(api, db):
    user, token = issue(db)
    res = confirm(api, token)
    assert res.status_code == 204
    assert res.content == b""
    db.refresh(user)
    assert verify_password(NEW_PW, user.password_hash)


def test_confirm_does_not_log_the_user_in(api, db):
    _, token = issue(db)
    res = confirm(api, token)
    assert "set-cookie" not in res.headers  # 리프레시 쿠키를 주지 않음
    assert "access_token" not in res.text
    assert api.get("/api/v1/users/me").status_code == 401  # 토큰 없이는 로그인 상태가 아님


def test_after_confirm_the_new_password_logs_in_and_the_old_one_does_not(api, db):
    user, token = issue(db, "flow@example.com", "flow0001")
    confirm(api, token)
    new = api.post(LOGIN, json={"email": "flow@example.com", "password": NEW_PW})
    assert new.status_code == 200
    old = api.post(LOGIN, json={"email": "flow@example.com", "password": "Abcdef1!"})
    assert old.status_code == 401
    assert user.password_changed_at is not None


def test_confirm_with_a_wrong_token_is_400_with_the_fixed_message(api, db):
    issue(db)
    res = confirm(api, "x" * 43)
    assert res.status_code == 400
    assert res.json() == {
        "error": {
            "code": "INVALID_RESET_LINK",
            "message": "This link is invalid or has expired.",
            "details": None,
        }
    }


def test_confirm_token_is_single_use_through_the_route(api, db):
    _, token = issue(db)
    assert confirm(api, token).status_code == 204
    assert confirm(api, token, "Another1!").status_code == 400


def test_confirm_with_an_expired_token_gives_the_same_400(api, db):
    user, token = issue(db)
    rows(db, user)[0].expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    wrong = confirm(api, "x" * 43).json()
    expired = confirm(api, token).json()
    assert expired == wrong


def test_confirm_weak_password_is_422_and_the_link_still_works(api, db):
    _, token = issue(db)
    res = confirm(api, token, "short")
    assert res.status_code == 422
    assert "new_password" in res.json()["error"]["details"]
    assert confirm(api, token).status_code == 204  # 고쳐서 다시 보내면 됨


@pytest.mark.parametrize(
    "payload",
    [{}, {"token": "abc"}, {"new_password": NEW_PW}, {"token": "", "new_password": NEW_PW},
     {"token": "abc", "new_password": ""}, {"token": "x" * 201, "new_password": NEW_PW}],
)
def test_confirm_bad_bodies_are_422(api, payload):
    res = api.post(CONFIRM, json=payload)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_confirm_whole_flow_rejects_the_old_login_afterwards(api, db, caplog):
    """요청 API 가 로그에 남긴 링크의 토큰으로 재설정하면 이전 로그인이 무효 (전체 흐름)."""
    import jwt

    user = add_user(db, "full@example.com", "full0001")
    now = int(datetime.now(UTC).timestamp())
    old_payload = {
        "sub": str(user.user_id),
        "type": "access",
        "iat": now - 3600,
        "exp": datetime.now(UTC) + timedelta(minutes=30),
    }
    secret = get_settings().jwt_secret
    old = {"Authorization": "Bearer " + jwt.encode(old_payload, secret, "HS256")}
    assert api.get("/api/v1/me/dashboard", headers=old).status_code == 200

    assert api.post(URL, json={"email": "full@example.com"}).status_code == 202
    token = logged(caplog).split("#token=")[1].strip()  # 메일(로그)의 링크에서 토큰을 꺼냄
    assert confirm(api, token).status_code == 204

    assert api.get("/api/v1/me/dashboard", headers=old).status_code == 401
