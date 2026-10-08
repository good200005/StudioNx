"""P1-13 56 — 프로젝트 요청 스키마 (DB 없이)."""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.project import ProjectCreateRequest, ProjectUpdateRequest


def test_create_defaults():
    data = ProjectCreateRequest(title="My Song")
    assert (data.title, data.description, data.bpm) == ("My Song", None, Decimal("120"))
    assert (data.time_sig_num, data.time_sig_den) == (4, 4)


def test_create_strips_title_and_description():
    data = ProjectCreateRequest(title="  My Song  ", description="  lofi  ")
    assert (data.title, data.description) == ("My Song", "lofi")


@pytest.mark.parametrize("title", ["", "   ", "\t\n", "a" * 101])
def test_create_bad_title(title):
    with pytest.raises(ValidationError):
        ProjectCreateRequest(title=title)


def test_create_title_100_ok_after_strip():
    assert len(ProjectCreateRequest(title=" " + "a" * 100 + " ").title) == 100


@pytest.mark.parametrize("description", ["", "   "])
def test_create_empty_description_is_none(description):
    assert ProjectCreateRequest(title="t", description=description).description is None


def test_create_description_too_long():
    with pytest.raises(ValidationError):
        ProjectCreateRequest(title="t", description="a" * 501)


@pytest.mark.parametrize("den", [1, 2, 4, 8, 16, 32])
def test_create_den_ok(den):
    assert ProjectCreateRequest(title="t", time_sig_num=7, time_sig_den=den).time_sig_den == den


@pytest.mark.parametrize("den", [0, 3, 5, 12, 64, -4])
def test_create_den_bad(den):
    with pytest.raises(ValidationError):
        ProjectCreateRequest(title="t", time_sig_den=den)


@pytest.mark.parametrize("bpm", ["19.99", "999.01", "120.123"])
def test_create_bpm_bad(bpm):
    with pytest.raises(ValidationError):
        ProjectCreateRequest(title="t", bpm=bpm)


@pytest.mark.parametrize("num", [0, 33])
def test_create_num_bad(num):
    with pytest.raises(ValidationError):
        ProjectCreateRequest(title="t", time_sig_num=num)


def test_update_nothing_sent():
    data = ProjectUpdateRequest()
    assert data.model_dump(exclude_unset=True) == {}


def test_update_title_null_is_422():
    with pytest.raises(ValidationError):
        ProjectUpdateRequest(title=None)


@pytest.mark.parametrize("title", ["", "   ", "a" * 101])
def test_update_bad_title(title):
    with pytest.raises(ValidationError):
        ProjectUpdateRequest(title=title)


def test_update_strips_and_clears_description():
    data = ProjectUpdateRequest(title="  New  ", description="   ")
    assert data.model_dump(exclude_unset=True) == {"title": "New", "description": None}
    cleared = ProjectUpdateRequest(description=None).model_dump(exclude_unset=True)
    assert cleared == {"description": None}
