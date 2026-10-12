"""setup_admin (app/admin.py, P1-21) — 작은 앱에 붙여 보고, 실제 앱의 /admin 도 요청해 본다.

로그인한 뒤의 화면 흐름(공지 작성 · 공개 · 삭제)은 서버를 띄워 확인한다 (사이트 시험).
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqladmin import Admin

import app.admin as admin_module
from app.admin import AdminAuth, setup_admin
from app.core.config import Settings
from app.main import app as real_app


def use_path(monkeypatch, path):
    monkeypatch.setattr(admin_module, "get_settings", lambda: Settings(admin_path=path))


def mounted_paths(app):
    return {getattr(r, "path", None) for r in app.routes}


# ── 작은 앱에 붙이기 ──
def test_registers_three_views_and_auth(monkeypatch):
    use_path(monkeypatch, "/admin")
    small = FastAPI()
    admin = setup_admin(small)
    assert isinstance(admin, Admin)
    assert isinstance(admin.authentication_backend, AdminAuth)
    assert {v.identity for v in admin.views} == {"dev-note", "inquiry", "user"}
    assert "/admin" in mounted_paths(small)


def test_path_comes_from_setting(monkeypatch):
    use_path(monkeypatch, "/ops-7f3a9c1e/")
    small = FastAPI()
    setup_admin(small)
    assert "/ops-7f3a9c1e" in mounted_paths(small)  # 끝의 "/" 는 정리됨
    assert "/admin" not in mounted_paths(small)
    client = TestClient(small)
    assert client.get("/admin/login").status_code == 404  # 기본 주소로는 열리지 않음
    assert client.get("/ops-7f3a9c1e/login").status_code == 200


@pytest.mark.parametrize("bad", ["admin", "/", "", "/api/v1", "/api/v1/admin"])
def test_unusable_paths_are_rejected_at_startup(monkeypatch, bad):
    use_path(monkeypatch, bad)
    with pytest.raises(ValueError, match="ADMIN_PATH"):
        setup_admin(FastAPI())


# ── 실제 앱 (main.py 가 이미 setup_admin 을 부름) ──
@pytest.fixture
def client():
    return TestClient(real_app, follow_redirects=False)


def test_real_app_admin_requires_login(client):
    for path in ("/admin/", "/admin/dev-note/list", "/admin/inquiry/list", "/admin/user/list"):
        res = client.get(path)
        assert res.status_code in (302, 303, 307), path
        assert res.headers["location"].endswith("/admin/login")


def test_real_app_login_page_is_shown(client):
    res = client.get("/admin/login")
    assert res.status_code == 200
    assert "Studio Nx Admin" in res.text


def test_real_app_wrong_login_is_rejected(client):
    res = client.post("/admin/login", data={"username": "nobody@example.com", "password": "x"})
    assert res.status_code == 400
    assert "admin_user_id" not in res.headers.get("set-cookie", "")


def test_real_app_other_areas_unaffected(client):
    assert client.get("/api/v1/health").json() == {"status": "ok"}
    assert client.get("/home.html").status_code == 200
    page = client.get("/no-such-page")
    assert page.status_code == 404 and page.headers["content-type"].startswith("text/html")
