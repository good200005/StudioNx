"""P1-04·05 인증 라우터가 /api/v1/auth 에 연결됐는지 확인 (구현 전에도 통과, DB 연결 없이)."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app
from app.models import User
from app.models.user import UserStatus
from app.schemas.auth import PRIVACY_VERSION


def test_signup_routes_registered():
    paths = app.openapi()["paths"]

    assert "post" in paths["/api/v1/auth/signup"]
    assert "get" in paths["/api/v1/auth/check-email"]
    assert "get" in paths["/api/v1/auth/check-nickname"]


def test_login_routes_registered():
    paths = app.openapi()["paths"]

    assert "post" in paths["/api/v1/auth/login"]
    assert "post" in paths["/api/v1/auth/refresh"]
    assert "post" in paths["/api/v1/auth/logout"]


# ── POST /api/v1/auth/signup (실제 앱 + 실제 MySQL · 시험 뒤 rollback) ──


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db  # 앱이 시험용 세션을 쓰게 함
    yield TestClient(app)
    app.dependency_overrides.clear()


def body(**fields):
    values = {
        "email": "Route.User@Example.com",
        "nickname": "route_user",
        "password": "Abcdef1!",
        "privacy_agreed": True,
        "privacy_version": PRIVACY_VERSION,
    }
    values.update(fields)
    return values


def test_signup_201(client, db):
    res = client.post("/api/v1/auth/signup", json=body())
    assert res.status_code == 201
    data = res.json()
    assert set(data) == {"user_id", "email", "nickname"}  # 비밀번호 · 해시는 나가지 않음
    assert data["email"] == "route.user@example.com"
    assert data["nickname"] == "route_user"
    assert db.get(User, data["user_id"]) is not None


def test_signup_409_email_taken(client):
    assert client.post("/api/v1/auth/signup", json=body()).status_code == 201
    res = client.post("/api/v1/auth/signup", json=body(nickname="other_one"))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "EMAIL_TAKEN"


def test_signup_422_password_rules(client):
    res = client.post("/api/v1/auth/signup", json=body(password="abcdefgh"))
    assert res.status_code == 422
    assert res.json()["error"]["details"] == {"password": ["upper", "number", "special"]}


def test_signup_422_missing_field(client):
    data = body()
    del data["privacy_agreed"]
    res = client.post("/api/v1/auth/signup", json=data)
    assert res.status_code == 422  # 스키마 검사 → 02 처리기
    assert res.json()["error"]["details"] == {"privacy_agreed": "Field required"}


# ── GET /api/v1/auth/check-email ──


def test_check_email_available(client):
    res = client.get("/api/v1/auth/check-email", params={"email": "free@example.com"})
    assert res.status_code == 200
    assert res.json() == {"available": True, "reason": None, "available_at": None}


def test_check_email_taken_any_case(client):
    client.post("/api/v1/auth/signup", json=body())
    res = client.get("/api/v1/auth/check-email", params={"email": "ROUTE.user@example.COM"})
    assert res.json()["reason"] == "TAKEN"


def test_check_email_rejoin_too_soon_has_utc_time(client, db):
    when = (datetime.now(UTC) - timedelta(days=1)).replace(tzinfo=None)
    db.add(
        User(
            email="gone@example.com",
            password_hash="x",
            nickname="gone_nick",
            privacy_agreed_at=when,
            privacy_version=PRIVACY_VERSION,
            status=UserStatus.DELETED,
            deleted_at=when,
        )
    )
    db.flush()
    data = client.get("/api/v1/auth/check-email", params={"email": "gone@example.com"}).json()
    assert data["reason"] == "REJOIN_TOO_SOON"
    assert data["available_at"].endswith("Z")  # UTC — 화면이 사용자 시간대로 바꿔 보여 줌


@pytest.mark.parametrize(
    "bad",
    ["abc", "a b@x.com", "kim@naver", "deleted+85@withdrawn.invalid", ""],
    ids=["골뱅이 없음", "가운데 공백", "도메인 점 없음", ".invalid", "빈 글자"],
)
def test_check_email_bad_format_422(client, bad):
    res = client.get("/api/v1/auth/check-email", params={"email": bad})
    assert res.status_code == 422  # 2026-10-07 결정 — available=false 가 아님
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "email" in res.json()["error"]["details"]


def test_check_email_missing_param_422(client):
    assert client.get("/api/v1/auth/check-email").status_code == 422


def test_check_email_does_not_change_db(client, db):
    when = (datetime.now(UTC) - timedelta(days=5)).replace(tzinfo=None)
    gone = User(
        email="gone@example.com",
        password_hash="x",
        nickname="gone_nick",
        privacy_agreed_at=when,
        privacy_version=PRIVACY_VERSION,
        status=UserStatus.DELETED,
        deleted_at=when,
    )
    db.add(gone)
    db.flush()
    assert client.get("/api/v1/auth/check-email", params={"email": "gone@example.com"}).json()[
        "available"
    ]
    db.refresh(gone)
    assert gone.email == "gone@example.com"  # GET 은 확인만


# ── GET /api/v1/auth/check-nickname ──


def test_check_nickname_available(client):
    res = client.get("/api/v1/auth/check-nickname", params={"nickname": "fresh_nick"})
    assert res.status_code == 200
    assert res.json()["available"] is True


@pytest.mark.parametrize("asked", ["route_user", "ROUTE_USER", "  route_user  "])
def test_check_nickname_taken(client, asked):
    client.post("/api/v1/auth/signup", json=body())  # 닉네임 route_user
    res = client.get("/api/v1/auth/check-nickname", params={"nickname": asked})
    assert (res.status_code, res.json()["reason"]) == (200, "TAKEN")


@pytest.mark.parametrize("bad", ["a", "x" * 21, ""], ids=["1자", "21자", "빈 글자"])
def test_check_nickname_bad_length_422(client, bad):
    res = client.get("/api/v1/auth/check-nickname", params={"nickname": bad})
    assert res.status_code == 422
    assert "nickname" in res.json()["error"]["details"]


def test_check_nickname_missing_param_422(client):
    assert client.get("/api/v1/auth/check-nickname").status_code == 422


# ── 25: 닉네임은 공백을 지운 뒤 길이를 잼 (가입 · 확인 모두) ──


def test_check_nickname_spaces_then_1_char_is_422(client):
    res = client.get("/api/v1/auth/check-nickname", params={"nickname": "  a  "})
    assert res.status_code == 422


def test_signup_nickname_spaces_then_1_char_is_422(client):
    res = client.post("/api/v1/auth/signup", json=body(nickname="  a  "))
    assert res.status_code == 422
    assert "nickname" in res.json()["error"]["details"]


def test_signup_bad_email_is_422(client):
    res = client.post("/api/v1/auth/signup", json=body(email="kim@naver"))
    assert res.status_code == 422
    assert "email" in res.json()["error"]["details"]
