"""P1-08·09 회원 정보 라우터가 /api/v1/users 에 연결됐는지 확인 (DB 연결 없이)."""

from app.main import app


def test_profile_routes_registered():
    paths = app.openapi()["paths"]

    assert {"get", "patch"} <= paths["/api/v1/users/me"].keys()
    assert {"post", "delete"} <= paths["/api/v1/users/me/profile-image"].keys()
    assert "get" in paths["/api/v1/users/{user_id}/profile-image"]
