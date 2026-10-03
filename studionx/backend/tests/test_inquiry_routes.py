"""P1-12 문의 라우터가 /api/v1/inquiries 에 연결됐는지 확인 (DB 연결 없이)."""

from app.main import app


def test_inquiry_route_registered():
    paths = app.openapi()["paths"]

    assert "post" in paths["/api/v1/inquiries"]
