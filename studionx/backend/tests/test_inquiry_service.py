"""문의 서비스 (services/inquiry_service.py, P1-12)."""

import threading
from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select

from app.core.errors import AppError, ErrorCode
from app.models import Inquiry, User
from app.models.inquiry import InquiryStatus
from app.schemas.inquiry import InquiryCreateRequest
from app.services import inquiry_service
from app.services.inquiry_service import (
    INQUIRY_LIMIT_COUNT,
    INQUIRY_LIMIT_SECONDS,
    check_rate_limit,
    create_inquiry,
    record_inquiry_send,
)


@pytest.fixture
def clock(monkeypatch):
    """시각을 손으로 움직이는 시계 + 기록 비우기 (시험끼리 섞이지 않게)."""
    now = {"t": 1000.0}
    monkeypatch.setattr(inquiry_service, "_clock", lambda: now["t"])
    inquiry_service._recent_sends.clear()
    yield now
    inquiry_service._recent_sends.clear()


def send(ip, email):
    """화면이 문의를 보낸 것처럼: 검사 → (저장 성공) → 세기."""
    check_rate_limit(ip, email)
    record_inquiry_send(ip, email)


def assert_429(ip, email):
    with pytest.raises(AppError) as err:
        check_rate_limit(ip, email)
    assert err.value.status_code == 429
    assert err.value.code == ErrorCode.TOO_MANY_REQUESTS
    assert err.value.message == "Too many messages. Please try again later."
    return err.value.details["retry_after"]


def test_limit_is_two_in_ten_minutes():
    assert (INQUIRY_LIMIT_COUNT, INQUIRY_LIMIT_SECONDS) == (2, 600)  # 2026-10-08 사용자 결정


def test_third_send_blocked(clock):
    send("1.1.1.1", "a@example.com")
    send("1.1.1.1", "a@example.com")
    assert assert_429("1.1.1.1", "a@example.com") == INQUIRY_LIMIT_SECONDS + 1


def test_same_email_other_ip_blocked(clock):
    send("1.1.1.1", "a@example.com")
    send("2.2.2.2", "A@Example.com ")  # 대소문자 · 공백이 달라도 같은 이메일
    assert_429("3.3.3.3", "a@example.com")


def test_same_ip_other_email_blocked(clock):
    send("1.1.1.1", "a@example.com")
    send("1.1.1.1", "b@example.com")
    assert_429("1.1.1.1", "c@example.com")


def test_other_ip_and_email_ok(clock):
    send("1.1.1.1", "a@example.com")
    send("1.1.1.1", "a@example.com")
    check_rate_limit("9.9.9.9", "z@example.com")  # 남은 막히지 않음


def test_no_ip_counts_email_only(clock):
    send(None, "a@example.com")
    send(None, "a@example.com")
    assert_429(None, "a@example.com")
    assert "ip:None" not in inquiry_service._recent_sends


def test_check_only_does_not_count(clock):
    """검사만 하고 저장에 실패한 시도는 세지 않음 (2026-10-08 사용자 결정)."""
    for _ in range(5):
        check_rate_limit("1.1.1.1", "a@example.com")  # 저장 실패 — record 를 부르지 않음
    send("1.1.1.1", "a@example.com")
    send("1.1.1.1", "a@example.com")  # 진짜 저장 2번까지는 됨
    assert_429("1.1.1.1", "a@example.com")


def test_blocked_attempt_not_counted(clock):
    """막힌 요청도 세지 않음 → 10분이 지나면 다시 됨."""
    send("1.1.1.1", "a@example.com")
    send("1.1.1.1", "a@example.com")
    assert_429("1.1.1.1", "a@example.com")
    clock["t"] += INQUIRY_LIMIT_SECONDS + 1
    send("1.1.1.1", "a@example.com")


def test_retry_after_counts_down(clock):
    send("1.1.1.1", "a@example.com")
    clock["t"] += 100
    send("1.1.1.1", "a@example.com")
    clock["t"] += 50
    assert assert_429("1.1.1.1", "a@example.com") == INQUIRY_LIMIT_SECONDS - 150 + 1  # 첫 기록 기준


def test_window_slides(clock):
    """첫 기록이 10분을 넘으면 한 자리가 비어 다시 1번 가능."""
    send("1.1.1.1", "a@example.com")
    clock["t"] += 300
    send("1.1.1.1", "a@example.com")
    clock["t"] += 301  # 첫 기록은 601초 전, 둘째는 301초 전
    send("1.1.1.1", "a@example.com")
    assert_429("1.1.1.1", "a@example.com")


def test_old_records_removed(clock):
    send("1.1.1.1", "a@example.com")
    clock["t"] += INQUIRY_LIMIT_SECONDS + 1
    check_rate_limit("1.1.1.1", "a@example.com")
    assert inquiry_service._recent_sends == {}  # 메모리가 계속 늘지 않음


def test_threads_record_safely(clock):
    """여러 스레드가 동시에 세도 하나도 잃지 않음."""
    record = record_inquiry_send
    threads = [threading.Thread(target=record, args=(None, f"t{i}@x.com")) for i in range(50)]
    same = ("5.5.5.5", "same@example.com")
    threads += [threading.Thread(target=record, args=same) for _ in range(50)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(inquiry_service._recent_sends["ip:5.5.5.5"]) == 50
    assert len(inquiry_service._recent_sends["email:same@example.com"]) == 50


# ── 52 create_inquiry ─────────────────────────────────────────


def req(**fields):
    values = {
        "email": "ask@example.com", "title": "Hello", "content": "Line 1\nLine 2",
        "privacy_agreed": True,
    }
    values.update(fields)
    return InquiryCreateRequest(**values)


def count_asked(db):
    where = Inquiry.email == "ask@example.com"
    return db.scalar(select(func.count()).select_from(Inquiry).where(where))


def test_create_inquiry_guest(db, clock):
    before = datetime.now(UTC).replace(tzinfo=None, microsecond=0)
    inquiry = create_inquiry(db, req(), None, "1.1.1.1")

    row = db.get(Inquiry, inquiry.inquiry_id)
    assert row.user_id is None
    assert (row.email, row.title, row.content) == ("ask@example.com", "Hello", "Line 1\nLine 2")
    assert row.status == InquiryStatus.RECEIVED
    assert before <= row.privacy_agreed_at
    assert row.created_at is not None and row.answer is None
    assert len(inquiry_service._recent_sends["ip:1.1.1.1"]) == 1  # 저장 뒤 셈


def test_create_inquiry_logged_in_links_user(db, clock):
    user = User(
        email="member@example.com", password_hash="x", nickname="member_q",
        privacy_agreed_at=datetime(2026, 10, 1), privacy_version="2026-10-05",
    )
    db.add(user)
    db.flush()
    inquiry = create_inquiry(db, req(email="other@example.com"), user, None)
    assert inquiry.user_id == user.user_id
    assert inquiry.email == "other@example.com"  # 폼에 적은 답장 주소 그대로


def test_create_inquiry_privacy_not_agreed(db, clock):
    with pytest.raises(AppError) as err:
        create_inquiry(db, req(privacy_agreed=False), None, "1.1.1.1")
    assert err.value.status_code == 422
    assert err.value.message == "Please agree to the privacy policy."
    assert err.value.details == {"privacy_agreed": "required"}
    assert count_asked(db) == 0
    assert inquiry_service._recent_sends == {}


def test_create_inquiry_third_blocked_not_saved(db, clock):
    create_inquiry(db, req(), None, "1.1.1.1")
    create_inquiry(db, req(), None, "1.1.1.1")
    with pytest.raises(AppError) as err:
        create_inquiry(db, req(), None, "1.1.1.1")
    assert err.value.status_code == 429
    assert count_asked(db) == 2


def test_create_inquiry_failed_save_not_counted(db, clock, monkeypatch):
    """저장(commit)이 실패하면 세지 않음 — 2026-10-08 사용자 결정."""
    def broken_commit():
        raise RuntimeError("db down")

    monkeypatch.setattr(db, "commit", broken_commit)
    for _ in range(3):
        with pytest.raises(RuntimeError):
            create_inquiry(db, req(), None, "1.1.1.1")
    assert inquiry_service._recent_sends == {}
