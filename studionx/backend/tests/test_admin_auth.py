"""관리자 화면 로그인 (app/admin.py AdminAuth, P1-21) — 실제 MySQL, 시험마다 되돌림.

함수를 하나 구현할 때마다 시험을 더한다. login 은 DB 세션을 직접 여므로(SessionLocal),
시험에서는 같은 시험용 세션(db)을 쓰게 바꾼다.
"""

import asyncio
from datetime import UTC, datetime

import pytest

import app.admin as admin_module
from app.admin import AdminAuth
from app.core.security import hash_password
from app.models import User
from app.models.user import UserRole, UserStatus

PASSWORD = "Studio1!x"


class FakeRequest:
    """SQLAdmin 이 넘기는 요청 흉내 — 폼 값과 세션 딕셔너리만 있으면 됨."""

    def __init__(self, username="", password=""):
        self._form = {"username": username, "password": password}
        self.session = {}

    async def form(self):
        return self._form


@pytest.fixture
def auth(db, monkeypatch):
    monkeypatch.setattr(admin_module, "SessionLocal", lambda: db)
    monkeypatch.setattr(db, "close", lambda: None)  # login 이 닫아도 시험용 세션은 유지
    return AdminAuth(secret_key="test-secret")


def add_user(db, name, role=UserRole.USER, status=UserStatus.ACTIVE):
    user = User(
        email=f"{name}@example.com",
        password_hash=hash_password(PASSWORD),
        nickname=f"{name}_adm",
        role=role,
        status=status,
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-08",
    )
    db.add(user)
    db.flush()
    return user


def run_login(auth, username, password):
    request = FakeRequest(username, password)
    ok = asyncio.run(auth.login(request))
    return ok, request.session


# ── login ──
def test_login_admin_succeeds_and_saves_only_user_id(auth, db):
    admin = add_user(db, "adm_ok", role=UserRole.ADMIN)
    ok, session = run_login(auth, "adm_ok@example.com", PASSWORD)
    assert ok is True
    assert session == {"admin_user_id": admin.user_id}


def test_login_email_is_case_insensitive_like_normal_login(auth, db):
    add_user(db, "adm_case", role=UserRole.ADMIN)
    ok, _ = run_login(auth, "  ADM_Case@Example.com ", PASSWORD)
    assert ok is True


def test_login_normal_user_is_rejected_even_with_right_password(auth, db):
    add_user(db, "adm_user", role=UserRole.USER)
    ok, session = run_login(auth, "adm_user@example.com", PASSWORD)
    assert ok is False and session == {}


def test_login_wrong_password_unknown_email_and_empty_form(auth, db):
    add_user(db, "adm_pw", role=UserRole.ADMIN)
    assert run_login(auth, "adm_pw@example.com", "Wrong1!pass")[0] is False
    assert run_login(auth, "nobody@example.com", PASSWORD)[0] is False
    ok, session = run_login(auth, "", "")
    assert ok is False and session == {}


@pytest.mark.parametrize("status", [UserStatus.SUSPENDED, UserStatus.DELETED])
def test_login_suspended_or_withdrawn_admin_is_rejected(auth, db, status):
    add_user(db, f"adm_{status.value.lower()}", role=UserRole.ADMIN, status=status)
    ok, session = run_login(auth, f"adm_{status.value.lower()}@example.com", PASSWORD)
    assert ok is False and session == {}


def test_login_opens_and_closes_its_own_db_session(db, monkeypatch):
    calls = []

    class Spy:
        def __getattr__(self, name):
            return getattr(db, name)

        def close(self):
            calls.append("closed")

    monkeypatch.setattr(admin_module, "SessionLocal", lambda: Spy())
    add_user(db, "adm_spy", role=UserRole.ADMIN)
    asyncio.run(AdminAuth(secret_key="x").login(FakeRequest("adm_spy@example.com", PASSWORD)))
    assert calls == ["closed"]


# ── logout ──
def test_logout_clears_session_and_is_safe_when_empty(auth):
    request = FakeRequest()
    request.session.update({"admin_user_id": 5, "other": "x"})
    assert asyncio.run(auth.logout(request)) is True
    assert request.session == {}
    assert asyncio.run(auth.logout(request)) is True  # 이미 비어 있어도 오류 없음


# ── authenticate ──
def run_authenticate(auth, session):
    request = FakeRequest()
    request.session.update(session)
    return asyncio.run(auth.authenticate(request)), request.session


def test_authenticate_without_session_is_false(auth):
    ok, session = run_authenticate(auth, {})
    assert ok is False and session == {}


def test_authenticate_active_admin_is_true_and_session_kept(auth, db):
    admin = add_user(db, "adm_auth_ok", role=UserRole.ADMIN)
    ok, session = run_authenticate(auth, {"admin_user_id": admin.user_id})
    assert ok is True and session == {"admin_user_id": admin.user_id}


def test_authenticate_rechecks_db_every_time(auth, db):
    admin = add_user(db, "adm_auth_re", role=UserRole.ADMIN)
    assert run_authenticate(auth, {"admin_user_id": admin.user_id})[0] is True
    admin.role = UserRole.USER  # 로그인한 뒤에 권한을 회수함
    db.flush()
    ok, session = run_authenticate(auth, {"admin_user_id": admin.user_id})
    assert ok is False and session == {}  # 남은 세션도 비움


@pytest.mark.parametrize("status", [UserStatus.SUSPENDED, UserStatus.DELETED])
def test_authenticate_suspended_or_withdrawn_after_login_is_false(auth, db, status):
    admin = add_user(db, f"adm_auth_{status.value.lower()}", role=UserRole.ADMIN)
    assert run_authenticate(auth, {"admin_user_id": admin.user_id})[0] is True
    admin.status = status
    db.flush()
    ok, session = run_authenticate(auth, {"admin_user_id": admin.user_id})
    assert ok is False and session == {}


def test_authenticate_unknown_user_id_is_false(auth):
    ok, session = run_authenticate(auth, {"admin_user_id": 999999999})
    assert ok is False and session == {}


def test_authenticate_normal_user_id_in_session_is_false(auth, db):
    user = add_user(db, "adm_auth_user", role=UserRole.USER)
    ok, _ = run_authenticate(auth, {"admin_user_id": user.user_id})
    assert ok is False
