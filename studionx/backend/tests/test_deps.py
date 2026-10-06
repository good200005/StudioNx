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
    client, db = make_client(SimpleNamespace(user_id=7, status="ACTIVE"))
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
    client, _ = make_client(SimpleNamespace(user_id=7, status=status))
    assert_401(client.get("/whoami", headers=bearer(make_token("7"))), "Please sign in again.")


# ── get_current_user_optional: 로그인은 선택 (실패해도 401 이 아니라 손님) ──


def test_optional_active_user(make_client):
    client, _ = make_client(SimpleNamespace(user_id=7, status="ACTIVE"))
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
        ((SimpleNamespace(user_id=7, status="DELETED"),), bearer(make_token("7"))),
        ((), {"Authorization": "Basic dXNlcjpwYXNz"}),
    ],
    ids=["bad-token", "no-user", "deleted", "basic"],
)
def test_optional_failure_is_guest(make_client, users, headers):
    client, _ = make_client(*users)
    res = client.get("/maybe", headers=headers)
    assert (res.status_code, res.json()) == (200, {"user_id": None})
