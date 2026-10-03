"""P1-04 인증 라우터가 /api/v1/auth 에 연결됐는지 확인 (구현 전에도 통과, DB 연결 없이)."""

from app.main import app


def test_signup_routes_registered():
    paths = app.openapi()["paths"]

    assert "post" in paths["/api/v1/auth/signup"]
    assert "get" in paths["/api/v1/auth/check-email"]
    assert "get" in paths["/api/v1/auth/check-nickname"]
