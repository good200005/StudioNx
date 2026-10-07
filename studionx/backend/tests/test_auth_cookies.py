"""리프레시 쿠키 심기 · 지우기 (api/v1/auth.py set_refresh_cookie · clear_refresh_cookie, P1-05)."""

from types import SimpleNamespace

import pytest
from fastapi import Response

from app.api.v1 import auth as auth_routes
from app.api.v1.auth import clear_refresh_cookie, set_refresh_cookie


def cookie_of(response):
    (header,) = response.headers.getlist("set-cookie")
    parts = [p.strip() for p in header.split(";")]
    name_value = parts[0]
    attrs = {}
    for part in parts[1:]:
        key, _, value = part.partition("=")
        attrs[key.lower()] = value
    return name_value, attrs


def test_remember_me_keeps_3_days():
    res = Response()
    set_refresh_cookie(res, "TOKEN", remember=True)
    name_value, attrs = cookie_of(res)
    assert name_value == "snx_refresh=TOKEN"
    assert attrs["max-age"] == str(3 * 24 * 60 * 60)
    assert attrs["path"] == "/api/v1/auth"
    assert "httponly" in attrs  # JS 에서 읽을 수 없음
    assert attrs["samesite"] == "lax"


def test_without_remember_is_session_cookie():
    res = Response()
    set_refresh_cookie(res, "TOKEN", remember=False)
    _, attrs = cookie_of(res)
    assert "max-age" not in attrs and "expires" not in attrs  # 브라우저를 닫으면 사라짐
    assert "httponly" in attrs


@pytest.mark.parametrize(("env", "secure"), [("dev", False), ("prod", True)])
def test_secure_only_in_prod(monkeypatch, env, secure):
    fake = SimpleNamespace(app_env=env, jwt_refresh_days=3)
    monkeypatch.setattr(auth_routes, "get_settings", lambda: fake)
    res = Response()
    set_refresh_cookie(res, "TOKEN", remember=True)
    _, attrs = cookie_of(res)
    assert ("secure" in attrs) is secure  # 배포(HTTPS)에서만 — 개발(http://localhost)에서는 안 붙임


def test_clear_cookie_same_name_and_path():
    res = Response()
    clear_refresh_cookie(res)
    name_value, attrs = cookie_of(res)
    assert name_value == 'snx_refresh=""'
    assert attrs["max-age"] == "0"  # 바로 만료 → 브라우저가 지움
    assert attrs["path"] == "/api/v1/auth"  # 심을 때와 같아야 지워짐
