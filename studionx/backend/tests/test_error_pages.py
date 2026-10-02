"""없는 주소 처리 (core/site_files.py): 페이지는 errors/404.html, API는 JSON 404."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_missing_page_shows_404_page():
    for path in ("/no-such-page", "/a/b/c", "/no-such.html"):
        res = client.get(path)
        assert res.status_code == 404
        assert res.headers["content-type"].startswith("text/html")
        assert "Lost the signal" in res.text


def test_missing_api_returns_json_404():
    res = client.get("/api/v1/no-such-endpoint")
    assert res.status_code == 404
    assert res.headers["content-type"].startswith("application/json")


def test_existing_files_still_served():
    assert client.get("/home.html").status_code == 200
    assert client.get("/errors/500.html").status_code == 200
    assert client.get("/api/v1/health").json() == {"status": "ok"}
