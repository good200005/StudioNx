"""is_api_request (core/errors.py, P1-22): API 주소와 화면 주소를 가른다."""

import pytest
from starlette.requests import Request

from app.core.errors import is_api_request


def make_request(path: str, query: bytes = b"") -> Request:
    scope = {"type": "http", "method": "GET", "path": path, "query_string": query, "headers": []}
    return Request(scope)


@pytest.mark.parametrize(
    "path",
    ["/api/v1", "/api/v1/", "/api/v1/me", "/api/v1/projects/12", "/api/v1/no-such-endpoint"],
)
def test_api_paths(path):
    assert is_api_request(make_request(path)) is True


@pytest.mark.parametrize(
    "path",
    ["/", "/home.html", "/myPage.html", "/errors/500.html", "/no-such-page", "/admin", "/docs"],
)
def test_page_paths(path):
    assert is_api_request(make_request(path)) is False


@pytest.mark.parametrize("path", ["/api/v10", "/api/v1x/me", "/api", "/api/v2/me", "/x/api/v1/me"])
def test_look_alike_paths_are_not_api(path):
    assert is_api_request(make_request(path)) is False


def test_query_string_does_not_matter():
    assert is_api_request(make_request("/home.html", b"next=/api/v1/me")) is False
    assert is_api_request(make_request("/api/v1/me", b"a=1")) is True
