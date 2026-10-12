"""관리자 화면의 문의 설정 (app/admin.py InquiryAdmin, P1-21).

설정 값과 저장 규칙은 SQLAdmin 을 띄우지 않고 확인한다. 실제 화면 흐름은 setup_admin 까지
구현한 뒤 서버를 띄워 확인한다 (사이트 시험).
"""

import asyncio
from datetime import UTC, datetime

import pytest

from app.admin import InquiryAdmin
from app.models import Inquiry
from app.models.inquiry import InquiryStatus


@pytest.fixture
def view():
    return InquiryAdmin()


def change(view, data, current_answer=None):
    data = dict(data)
    model = Inquiry(answer=current_answer)
    asyncio.run(view.on_model_change(data, model, False, None))
    return data


# ── 화면 설정 ──
def test_cannot_create_or_delete(view):
    assert view.can_create is False and view.can_delete is False


def test_list_columns_sort_and_search(view):
    assert [c.key for c in view.column_list] == [
        "inquiry_id",
        "email",
        "title",
        "status",
        "created_at",
    ]
    assert view.column_default_sort == [("inquiry_id", True)]
    assert [c.key for c in view.column_searchable_list] == ["email", "title"]


def test_form_has_only_answer_and_status(view):
    assert [c.key for c in view.form_columns] == ["answer", "status"]


# ── on_model_change ──
def test_new_answer_sets_answered_time_and_status(view):
    before = datetime.now(UTC).replace(tzinfo=None)
    data = change(view, {"answer": "Thanks!", "status": InquiryStatus.RECEIVED})
    assert isinstance(data["answered_at"], datetime) and data["answered_at"].tzinfo is None
    assert (data["answered_at"] - before).total_seconds() < 5
    assert data["status"] == InquiryStatus.ANSWERED


def test_status_given_as_plain_text_is_also_handled(view):
    data = change(view, {"answer": "Thanks!", "status": "RECEIVED"})
    assert data["status"] == InquiryStatus.ANSWERED


def test_changed_answer_refreshes_time_but_keeps_closed_status(view):
    data = change(view, {"answer": "New text", "status": InquiryStatus.CLOSED}, "Old text")
    assert data["answered_at"] is not None
    assert data["status"] == InquiryStatus.CLOSED  # 관리자가 정한 상태는 존중


def test_same_answer_does_not_touch_answered_time(view):
    data = change(view, {"answer": "Same", "status": InquiryStatus.ANSWERED}, "Same")
    assert "answered_at" not in data and data["status"] == InquiryStatus.ANSWERED


def test_same_answer_with_extra_spaces_is_still_same(view):
    data = change(view, {"answer": " Same \n", "status": InquiryStatus.ANSWERED}, "Same")
    assert "answered_at" not in data


@pytest.mark.parametrize("empty", ["", "   ", None])
def test_clearing_answer_clears_answered_time(view, empty):
    data = change(view, {"answer": empty, "status": InquiryStatus.RECEIVED}, "Old")
    assert data["answered_at"] is None
    assert data["status"] == InquiryStatus.RECEIVED  # 상태는 건드리지 않음


def test_status_only_change_keeps_everything_else(view):
    data = change(view, {"answer": "Same", "status": InquiryStatus.CLOSED}, "Same")
    assert data == {"answer": "Same", "status": InquiryStatus.CLOSED}
