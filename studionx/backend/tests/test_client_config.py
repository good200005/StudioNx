"""GET /api/v1/client-config (S1-13) — 화면이 시작할 때 읽는 공개 설정.

브라우저용 Sentry DSN, 환경, 버전만 담고, 로그인 없이 읽힌다.
서버용 DSN 이나 비밀 값은 나가면 안 된다.
"""

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app

URL = "/api/v1/client-config"


def test_route_registered():
    assert set(app.openapi()["paths"][URL]) == {"get"}


def test_default_is_empty_dsn():
    """DSN 을 정하지 않으면 비어 있다 → 화면은 오류를 보내지 않는다 (conftest 가 비움)."""
    res = TestClient(app).get(URL)

    assert res.status_code == 200
    data = res.json()
    assert set(data) == {"sentry_dsn", "environment", "release"}
    assert data["sentry_dsn"] == ""
    assert data["release"] == "studionx@0.1.0"
    assert data["environment"] in {"dev", "prod"}


def test_returns_browser_dsn_without_login(monkeypatch):
    settings = Settings(
        sentry_browser_dsn="https://abc123@o1.ingest.sentry.io/42",
        sentry_dsn="https://server-secret@o1.ingest.sentry.io/7",
        app_env="prod",
    )
    monkeypatch.setattr("app.api.v1.router.get_settings", lambda: settings)

    res = TestClient(app).get(URL)  # Authorization 헤더 없음

    assert res.status_code == 200
    assert res.json() == {
        "sentry_dsn": "https://abc123@o1.ingest.sentry.io/42",
        "environment": "prod",
        "release": "studionx@0.1.0",
    }


def test_server_dsn_never_leaks(monkeypatch):
    """서버용 DSN 은 응답 어디에도 없어야 한다."""
    settings = Settings(
        sentry_browser_dsn="",
        sentry_dsn="https://server-secret@o1.ingest.sentry.io/7",
    )
    monkeypatch.setattr("app.api.v1.router.get_settings", lambda: settings)

    res = TestClient(app).get(URL)

    assert "server-secret" not in res.text
    assert res.json()["sentry_dsn"] == ""
