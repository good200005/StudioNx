"""P1-13 프로젝트 라우터가 /api/v1/projects 에 연결됐는지 확인 (DB 연결 없이)."""

from app.main import app


def test_project_routes_registered():
    paths = app.openapi()["paths"]

    assert {"get", "post"} <= paths["/api/v1/projects"].keys()
    assert {"get", "patch", "delete"} <= paths["/api/v1/projects/{project_id}"].keys()
