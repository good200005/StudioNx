"""오류 응답 형식 (core/errors.py, P1-03) — 처리기를 하나 구현할 때마다 시험을 더한다."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import AppError, ErrorCode, register_exception_handlers

# 시험용 작은 앱 — 실제 라우터 없이 처리기만 확인
app = FastAPI()
register_exception_handlers(app)


@app.get("/email-taken")
def email_taken():
    raise AppError(ErrorCode.EMAIL_TAKEN, 409, "This email is already in use.")


@app.get("/password-rules")
def password_rules():
    raise AppError(
        ErrorCode.VALIDATION_ERROR,
        422,
        "Check the password requirements.",
        details={"password": ["upper", "special"]},
    )


@app.get("/sign-in")
def sign_in():
    raise AppError(ErrorCode.UNAUTHORIZED, 401, "Please sign in.")


client = TestClient(app)


def test_app_error_status_and_body():
    res = client.get("/email-taken")
    assert res.status_code == 409
    assert res.headers["content-type"] == "application/json"
    assert res.json() == {
        "error": {
            "code": "EMAIL_TAKEN",
            "message": "This email is already in use.",
            "details": None,
        }
    }


def test_app_error_details_kept():
    res = client.get("/password-rules")
    assert res.status_code == 422
    assert res.json()["error"]["details"] == {"password": ["upper", "special"]}


def test_app_error_unauthorized_matches_frontend():
    # 프론트 api.js 는 401 + code "UNAUTHORIZED" 일 때만 재발급 후 다시 보낸다 (JS 02)
    res = client.get("/sign-in")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


# ── 02 입력값 형식 오류 (RequestValidationError → 422) ──
class SignupIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8)
    nickname: str


@app.post("/signup")
def signup(body: SignupIn):
    return {"ok": True}


@app.get("/search")
def search(page: int = 1):
    return {"page": page}


def test_validation_error_fields():
    res = client.post("/signup", json={"email": "not-an-email", "password": "Secret!1x"})
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "VALIDATION_ERROR"
    assert err["message"] == "Check the highlighted fields."
    assert set(err["details"]) == {"email", "nickname"}  # 틀린 칸 · 빠진 칸
    assert err["details"]["nickname"] == "Field required"


def test_validation_error_hides_input():
    # 짧은 비밀번호 — 칸 문구만 오고, 보낸 비밀번호 값은 응답 어디에도 없음
    res = client.post("/signup", json={"email": "a@b.com", "password": "Pw!1", "nickname": "n"})
    assert res.status_code == 422
    assert "password" in res.json()["error"]["details"]
    assert "Pw!1" not in res.text


def test_validation_error_query_and_empty_body():
    res = client.get("/search?page=abc")
    assert res.status_code == 422
    assert "page" in res.json()["error"]["details"]

    res = client.post("/signup")  # 본문 없음
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


# ── 03 FastAPI 기본 오류 (HTTPException → 같은 모양) ──
def test_http_error_not_found():
    res = client.get("/api/v1/no-such-api")  # API 주소여야 JSON (화면 주소는 P1-22 부터 HTML)
    assert res.status_code == 404
    assert res.json() == {"error": {"code": "NOT_FOUND", "message": "Not found.", "details": None}}


@app.get("/api/v1/get-only")
def get_only():
    return {"ok": True}


def test_http_error_method_not_allowed_keeps_allow_header():
    res = client.post("/api/v1/get-only")  # GET 만 있는 주소에 POST
    assert res.status_code == 405
    assert res.json()["error"]["code"] == "METHOD_NOT_ALLOWED"
    assert res.headers["allow"] == "GET"


@app.get("/api/v1/teapot")
def teapot():
    raise StarletteHTTPException(418, detail="internal detail text")


@app.get("/api/v1/gateway")
def gateway():
    raise StarletteHTTPException(502, detail="upstream host 10.0.0.5 down")


def test_http_error_unknown_status_and_hidden_detail():
    res = client.get("/api/v1/teapot")
    assert res.status_code == 418
    assert res.json()["error"]["code"] == "BAD_REQUEST"
    assert "internal detail text" not in res.text

    res = client.get("/api/v1/gateway")
    assert res.status_code == 502
    assert res.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "10.0.0.5" not in res.text


def test_real_app_missing_api_and_page():
    # 실제 앱: 없는 API 주소 → 같은 오류 모양, 없는 페이지 → 404 HTML 그대로 (site_files.py)
    from app.main import app as real_app

    real = TestClient(real_app)
    res = real.get("/api/v1/no-such-endpoint")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"

    res = real.get("/no-such-page")
    assert res.status_code == 404
    assert res.headers["content-type"].startswith("text/html")


# ── 04 예상 못 한 오류 (Exception → 500) ──
@app.get("/api/v1/bug")
def bug():
    raise RuntimeError("SELECT * FROM users WHERE password_hash='$2b$12$secret'")


def test_unexpected_error_hides_detail():
    # raise_server_exceptions=False: 시험 도구가 오류를 다시 던지지 않고 실제 응답을 돌려줌
    safe = TestClient(app, raise_server_exceptions=False)
    res = safe.get("/api/v1/bug")
    assert res.status_code == 500
    assert res.json() == {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "Something went wrong. Please try again.",
            "details": None,
        }
    }
    assert "password_hash" not in res.text and "RuntimeError" not in res.text


def test_unexpected_error_still_raised_for_logs():
    # 응답을 보낸 뒤에도 오류가 다시 던져짐 → 서버 로그 · Sentry 가 원래 오류를 기록
    with pytest.raises(RuntimeError):
        client.get("/api/v1/bug")
