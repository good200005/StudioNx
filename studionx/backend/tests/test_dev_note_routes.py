"""P1-21 공지 라우터가 /api/v1/dev-notes 에 연결됐는지 확인 (DB 연결 없이)."""

from app.main import app


def test_dev_note_routes_registered():
    paths = app.openapi()["paths"]

    assert "get" in paths["/api/v1/dev-notes"]
    assert "get" in paths["/api/v1/dev-notes/{note_id}"]
