"""문의 요청 스키마 (schemas/inquiry.py, P1-12)."""

import pytest
from pydantic import ValidationError

from app.schemas.inquiry import INQUIRY_CONTENT_MAX, INQUIRY_TITLE_MAX, InquiryCreateRequest


def body(**fields):
    values = {
        "email": "you@example.com", "title": "Hello", "content": "Hi there", "privacy_agreed": True,
    }
    values.update(fields)
    return values


def errors_of(**fields):
    with pytest.raises(ValidationError) as err:
        InquiryCreateRequest(**body(**fields))
    return {e["loc"][0] for e in err.value.errors()}


def test_valid():
    data = InquiryCreateRequest(**body())
    assert (data.email, data.title, data.content, data.privacy_agreed) == (
        "you@example.com", "Hello", "Hi there", True,
    )


def test_strip_title_and_content_keep_inner_newlines():
    data = InquiryCreateRequest(**body(title="  Bug report  ", content="\n  line 1\nline 2  \n"))
    assert data.title == "Bug report"
    assert data.content == "line 1\nline 2"


def test_email_trimmed():
    assert InquiryCreateRequest(**body(email="  you@example.com ")).email == "you@example.com"


@pytest.mark.parametrize(
    "email", ["abc", "kim@naver", "a@b@c.com", ""], ids=["@ 없음", "점 없음", "@ 둘", "빈 글자"]
)
def test_bad_email(email):
    assert errors_of(email=email) == {"email"}


@pytest.mark.parametrize("field", ["title", "content"])
@pytest.mark.parametrize("value", ["", "   ", "\n\t"], ids=["빈 글자", "공백만", "줄바꿈 · 탭만"])
def test_blank_title_or_content(field, value):
    assert errors_of(**{field: value}) == {field}


def test_length_limits():
    InquiryCreateRequest(**body(title="x" * INQUIRY_TITLE_MAX, content="y" * INQUIRY_CONTENT_MAX))
    assert errors_of(title="x" * (INQUIRY_TITLE_MAX + 1)) == {"title"}
    assert errors_of(content="y" * (INQUIRY_CONTENT_MAX + 1)) == {"content"}


def test_length_counted_after_strip():
    """앞뒤 공백은 길이에 넣지 않음 — 2000자 + 공백도 통과."""
    InquiryCreateRequest(**body(content="  " + "y" * INQUIRY_CONTENT_MAX + "  "))


def test_privacy_agreed_required():
    values = body()
    del values["privacy_agreed"]
    with pytest.raises(ValidationError):
        InquiryCreateRequest(**values)
