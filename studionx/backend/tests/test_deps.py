"""로그인한 사용자 찾기 (api/deps.py get_current_user · get_current_user_optional, P1-03).

users 모델의 컬럼(status 등)은 P1-03 뒤 순서에서 채우므로, 여기서는 DB 대신
가짜 세션(FakeDb)을 넣어 함수의 판단만 시험한다.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import CurrentUser, OptionalUser
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.db.session import get_db
from app.models import User


def make_token(sub="7"):
    payload = {"sub": sub, "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=30)}
    return jwt.encode(payload, get_settings().jwt_secret, algorithm="HS256")


class FakeDb:
    """db.get(User, id) 만 흉내 낸다. 받은 인자를 calls 에 남긴다."""

    def __init__(self, users):
        self.users = {u.user_id: u for u in users}
        self.calls = []

    def get(self, model, key):
        self.calls.append((model, key))
        return self.users.get(key)


@pytest.fixture
def make_client():
    def _make(*users):
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/whoami")
        def whoami(user: CurrentUser):
            return {"user_id": user.user_id}

        @app.get("/maybe")
        def maybe(user: OptionalUser):
            return {"user_id": user.user_id if user else None}

        db = FakeDb(users)
        app.dependency_overrides[get_db] = lambda: db
        return TestClient(app), db

    return _make


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def assert_401(res, message):
    assert res.status_code == 401
    assert res.json() == {"error": {"code": "UNAUTHORIZED", "message": message, "details": None}}


def test_active_user(make_client):
    client, db = make_client(SimpleNamespace(user_id=7, status="ACTIVE", password_changed_at=None))
    res = client.get("/whoami", headers=bearer(make_token("7")))
    assert res.status_code == 200
    assert res.json() == {"user_id": 7}
    assert db.calls == [(User, 7)]


def test_no_header(make_client):
    client, db = make_client()
    assert_401(client.get("/whoami"), "Please sign in.")
    assert db.calls == []


def test_not_bearer_scheme(make_client):
    client, _ = make_client()
    res = client.get("/whoami", headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert_401(res, "Please sign in.")


def test_bad_token(make_client):
    client, db = make_client()
    assert_401(client.get("/whoami", headers=bearer("not-a-token")), "Please sign in again.")
    assert db.calls == []


def test_user_not_found(make_client):
    client, _ = make_client()
    assert_401(client.get("/whoami", headers=bearer(make_token("99"))), "Please sign in again.")


@pytest.mark.parametrize("status", ["SUSPENDED", "DELETED"])
def test_inactive_user(make_client, status):
    client, _ = make_client(SimpleNamespace(user_id=7, status=status, password_changed_at=None))
    assert_401(client.get("/whoami", headers=bearer(make_token("7"))), "Please sign in again.")


# ── get_current_user_optional: 로그인은 선택 (실패해도 401 이 아니라 손님) ──


def test_optional_active_user(make_client):
    client, _ = make_client(SimpleNamespace(user_id=7, status="ACTIVE", password_changed_at=None))
    res = client.get("/maybe", headers=bearer(make_token("7")))
    assert res.status_code == 200
    assert res.json() == {"user_id": 7}


def test_optional_no_header_is_guest(make_client):
    client, db = make_client()
    res = client.get("/maybe")
    assert (res.status_code, res.json()) == (200, {"user_id": None})
    assert db.calls == []


@pytest.mark.parametrize(
    ("users", "headers"),
    [
        ((), bearer("not-a-token")),
        ((), bearer(make_token("99"))),
        (
            (SimpleNamespace(user_id=7, status="DELETED", password_changed_at=None),),
            bearer(make_token("7")),
        ),
        ((), {"Authorization": "Basic dXNlcjpwYXNz"}),
    ],
    ids=["bad-token", "no-user", "deleted", "basic"],
)
def test_optional_failure_is_guest(make_client, users, headers):
    client, _ = make_client(*users)
    res = client.get("/maybe", headers=headers)
    assert (res.status_code, res.json()) == (200, {"user_id": None})


# ── 비밀번호 재설정 이전에 발급된 로그인은 무효 (P1-28, FR-118) ──
def token_with_iat(iat):
    payload = {"sub": "7", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=30)}
    if iat is not None:
        payload["iat"] = iat
    return jwt.encode(payload, get_settings().jwt_secret, algorithm="HS256")


def reset_at(seconds_ago):
    """`seconds_ago` 초 전에 재설정한 계정 (DB 처럼 UTC, 시간대 정보 없음, 밀리초 포함)."""
    ago = timedelta(seconds=seconds_ago, milliseconds=300)
    changed = datetime.now(UTC).replace(tzinfo=None) - ago
    return SimpleNamespace(user_id=7, status="ACTIVE", password_changed_at=changed)


def now_epoch():
    return int(datetime.now(UTC).timestamp())


def test_token_issued_before_the_reset_is_rejected_with_the_same_401(make_client):
    client, _ = make_client(reset_at(60))
    old = token_with_iat(now_epoch() - 3600)
    assert_401(client.get("/whoami", headers=bearer(old)), "Please sign in again.")


def test_token_issued_after_the_reset_is_accepted(make_client):
    client, _ = make_client(reset_at(60))
    new = token_with_iat(now_epoch() - 10)
    res = client.get("/whoami", headers=bearer(new))
    assert (res.status_code, res.json()) == (200, {"user_id": 7})


def test_token_issued_in_the_same_second_as_the_reset_is_accepted(make_client):
    user = reset_at(0)
    client, _ = make_client(user)
    same_second = int(user.password_changed_at.replace(tzinfo=UTC).timestamp())
    res = client.get("/whoami", headers=bearer(token_with_iat(same_second)))
    assert res.status_code == 200  # 재설정 직후 같은 초에 새로 로그인한 사람이 쫓겨나지 않음


def test_token_without_iat_is_rejected_once_the_password_was_reset(make_client):
    client, _ = make_client(reset_at(60))
    assert_401(client.get("/whoami", headers=bearer(token_with_iat(None))), "Please sign in again.")


def test_never_reset_accounts_keep_working_even_without_iat(make_client):
    client, _ = make_client(SimpleNamespace(user_id=7, status="ACTIVE", password_changed_at=None))
    res = client.get("/whoami", headers=bearer(token_with_iat(None)))
    assert res.status_code == 200  # 재설정한 적 없는 계정의 기존 로그인은 그대로


def test_optional_user_treats_a_stale_token_as_a_guest(make_client):
    client, _ = make_client(reset_at(60))
    res = client.get("/maybe", headers=bearer(token_with_iat(now_epoch() - 3600)))
    assert (res.status_code, res.json()) == (200, {"user_id": None})
