"""P1-12 문의 라우터 — 연결 확인(DB 없이) + 실제 앱 · MySQL 로 요청."""

from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.v1 import inquiries
from app.core.errors import AppError, ErrorCode
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Inquiry, User
from app.services import inquiry_service


def test_inquiry_route_registered():
    paths = app.openapi()["paths"]

    assert "post" in paths["/api/v1/inquiries"]


# ── 53 POST /inquiries (실제 앱 + 실제 MySQL · 시험 뒤 rollback) ──


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    inquiry_service._recent_sends.clear()  # 반복 전송 기록이 시험끼리 섞이지 않게
    yield TestClient(app)
    app.dependency_overrides.clear()
    inquiry_service._recent_sends.clear()


def body(**fields):
    values = {
        "email": "route.ask@example.com", "title": "Hi", "content": "Question",
        "privacy_agreed": True,
    }
    values.update(fields)
    return values


def post(client, headers=None, **fields):
    return client.post("/api/v1/inquiries", json=body(**fields), headers=headers or {})


def test_create_201(client, db):
    res = post(client, title="  Bug  ")
    assert res.status_code == 201
    data = res.json()
    assert set(data) == {"inquiry_id", "created_at"}
    row = db.get(Inquiry, data["inquiry_id"])
    assert (row.email, row.title, row.user_id) == ("route.ask@example.com", "Bug", None)


def test_create_logged_in_links_user(client, db):
    user = User(
        email="route.member@example.com", password_hash="x", nickname="route_member",
        privacy_agreed_at=datetime(2026, 10, 1), privacy_version="2026-10-05",
    )
    db.add(user)
    db.flush()
    token = create_access_token(user.user_id)
    res = post(client, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    assert db.get(Inquiry, res.json()["inquiry_id"]).user_id == user.user_id


def test_create_bad_token_still_ok(client):
    """로그인은 선택 — 토큰이 틀려도 비회원 문의로 받음 (P1-03 06 OptionalUser)."""
    assert post(client, headers={"Authorization": "Bearer nonsense"}).status_code == 201


def test_privacy_not_agreed_422(client):
    res = post(client, privacy_agreed=False)
    assert res.status_code == 422
    assert res.json()["error"]["details"] == {"privacy_agreed": "required"}


@pytest.mark.parametrize("field, value", [("email", "abc"), ("title", "   "), ("content", "")])
def test_schema_422(client, field, value):
    res = post(client, **{field: value})
    assert res.status_code == 422
    assert field in res.json()["error"]["details"]


def test_third_within_10_minutes_429(client):
    assert post(client).status_code == 201
    assert post(client).status_code == 201
    res = post(client)
    assert res.status_code == 429
    error = res.json()["error"]
    assert error["code"] == "TOO_MANY_REQUESTS"
    assert error["message"] == "Too many messages. Please try again later."
    assert 0 < error["details"]["retry_after"] <= 601


def test_spoofed_forwarded_for_ignored_by_default(client):
    """기본(TRUST_PROXY 꺼짐): X-Forwarded-For 를 꾸며도 같은 IP 로 셈 → 이메일을 바꿔도 막힘."""
    for i in range(2):
        res = post(client, {"X-Forwarded-For": f"10.0.0.{i}"}, email=f"spoof{i}@example.com")
        assert res.status_code == 201
    res = post(client, {"X-Forwarded-For": "10.0.0.9"}, email="spoof9@example.com")
    assert res.status_code == 429


def test_forwarded_for_used_when_trusted(client, monkeypatch):
    """TRUST_PROXY=true (프록시 뒤): 헤더의 첫 IP 가 보낸 사람 → 사람마다 따로 셈."""
    monkeypatch.setattr(inquiries, "get_settings", lambda: SimpleNamespace(trust_proxy=True))
    for i in range(3):
        headers = {"X-Forwarded-For": f"203.0.113.{i}, 10.0.0.1"}
        assert post(client, headers, email=f"user{i}@example.com").status_code == 201
    assert "ip:203.0.113.0" in inquiry_service._recent_sends
    assert "ip:testclient" not in inquiry_service._recent_sends


@pytest.mark.parametrize(
    ("trust", "header", "expected"),
    [
        (False, "1.2.3.4", "testclient"),
        (True, "1.2.3.4, 10.0.0.1", "1.2.3.4"),
        (True, "  5.6.7.8  ", "5.6.7.8"),
        (True, "", "testclient"),
        (True, None, "testclient"),
    ],
    ids=["꺼짐", "켜짐 · 첫 IP", "켜짐 · 공백", "켜짐 · 빈 헤더", "켜짐 · 헤더 없음"],
)
def test_client_ip(monkeypatch, trust, header, expected):
    monkeypatch.setattr(inquiries, "get_settings", lambda: SimpleNamespace(trust_proxy=trust))
    seen = {}

    def fake_create(db, data, user, ip):
        seen["ip"] = ip
        raise AppError(ErrorCode.TOO_MANY_REQUESTS, 429, "stop")

    monkeypatch.setattr(inquiry_service, "create_inquiry", fake_create)
    headers = {"X-Forwarded-For": header} if header is not None else {}
    TestClient(app).post("/api/v1/inquiries", json=body(), headers=headers)
    assert seen["ip"] == expected
