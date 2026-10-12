"""error_page (core/errors.py, P1-22): 상태 코드에 맞는 오류 페이지 HTML."""

import pytest

from app.core.errors import ERROR_PAGES, error_page


@pytest.mark.parametrize("status", sorted(ERROR_PAGES))
def test_each_listed_status_gets_its_own_page(status):
    res = error_page(status)
    assert res.status_code == status
    assert str(res.path).replace("\\", "/").endswith(ERROR_PAGES[status])
    assert res.media_type == "text/html"


@pytest.mark.parametrize("status", [401, 405, 409, 413, 415, 422])
def test_unlisted_4xx_uses_400_page_but_keeps_status(status):
    res = error_page(status)
    assert res.status_code == status
    assert str(res.path).replace("\\", "/").endswith("errors/400.html")


@pytest.mark.parametrize("status", [501, 502, 507])
def test_unlisted_5xx_uses_500_page_but_keeps_status(status):
    res = error_page(status)
    assert res.status_code == status
    assert str(res.path).replace("\\", "/").endswith("errors/500.html")


def test_pages_exist_and_show_their_number():
    for status in ERROR_PAGES:
        with open(error_page(status).path, encoding="utf-8") as f:
            assert str(status) in f.read()
