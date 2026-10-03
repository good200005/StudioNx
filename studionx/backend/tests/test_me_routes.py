"""P1-16 대시보드 라우터가 /api/v1/me 에 연결됐는지 확인 (DB 연결 없이)."""

from app.main import app


def test_dashboard_route_registered():
    paths = app.openapi()["paths"]

    assert "get" in paths["/api/v1/me/dashboard"]
