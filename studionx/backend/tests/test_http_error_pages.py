"""http_error_handler 의 화면/API 분기 (core/errors.py, P1-22): 화면은 HTML, API는 JSON."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import register_exception_handlers

app = FastAPI()
register_exception_handlers(app)


@app.get("/page-only")
def page_only():
    return {"ok": True}


@app.get("/forbidden-page")
def forbidden_page():
    raise StarletteHTTPException(403)


@app.get("/api/v1/forbidden")
def forbidden_api():
    raise StarletteHTTPException(403)


@app.get("/bad-gateway-page")
def bad_gateway_page():
    raise StarletteHTTPException(502)


client = TestClient(app)


def test_page_request_gets_html_with_same_status():
    res = client.get("/forbidden-page")
    assert res.status_code == 403
    assert res.headers["content-type"].startswith("text/html")
    assert "403" in res.text


def test_api_request_still_gets_json():
    res = client.get("/api/v1/forbidden")
    assert res.status_code == 403
    assert res.headers["content-type"].startswith("application/json")
    assert res.json()["error"]["code"] == "FORBIDDEN"


def test_page_405_uses_400_page_and_keeps_allow_header():
    res = client.post("/page-only")  # GET 만 있는 주소에 POST
    assert res.status_code == 405
    assert res.headers["content-type"].startswith("text/html")
    assert res.headers["allow"] == "GET"


def test_page_5xx_uses_500_page_with_original_status():
    res = client.get("/bad-gateway-page")
    assert res.status_code == 502
    assert res.headers["content-type"].startswith("text/html")


def test_page_html_does_not_leak_exception_detail():
    res = client.get("/forbidden-page")
    assert "Traceback" not in res.text and "HTTPException" not in res.text


def test_real_app_post_to_static_page_is_405_html():
    from app.main import app as real_app

    real = TestClient(real_app)
    res = real.post("/home.html")  # 정적 파일에는 GET 만
    assert res.status_code == 405
    assert res.headers["content-type"].startswith("text/html")


def test_real_app_missing_api_is_json_and_missing_page_is_html():
    from app.main import app as real_app

    real = TestClient(real_app)
    api = real.get("/api/v1/no-such-endpoint")
    assert api.status_code == 404 and api.json()["error"]["code"] == "NOT_FOUND"
    page = real.get("/no-such-page")
    assert page.status_code == 404 and page.headers["content-type"].startswith("text/html")


# ── 81 예상 못 한 오류 (500) 의 화면/API 분기 ──
@app.get("/bug-page")
def bug_page():
    raise RuntimeError("SELECT * FROM users WHERE password_hash='$2b$12$secret'")


def test_unexpected_error_on_page_gets_500_html_without_detail():
    safe = TestClient(app, raise_server_exceptions=False)
    res = safe.get("/bug-page")
    assert res.status_code == 500
    assert res.headers["content-type"].startswith("text/html")
    assert "500" in res.text
    assert "password_hash" not in res.text and "RuntimeError" not in res.text


def test_unexpected_error_on_page_is_still_raised_for_logs():
    with pytest.raises(RuntimeError):
        client.get("/bug-page")
