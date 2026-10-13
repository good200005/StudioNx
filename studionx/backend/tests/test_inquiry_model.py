"""inquiries 모델 컬럼 (models/inquiry.py, P1-03) — 실제 MySQL 의 inquiries 테이블과 비교.

DB 세션(db)과 비교 도구(assert_matches_db)는 conftest.py 에 있다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Inquiry, User
from app.models.inquiry import InquiryStatus


def now():
    return datetime.now(UTC).replace(tzinfo=None)


def new_inquiry(**fields):
    values = {
        "email": "guest@example.com",
        "title": "Hello",
        "content": "Question",
        "privacy_agreed_at": now(),
    }
    values.update(fields)
    return Inquiry(**values)


def test_columns_match_db(assert_matches_db):
    assert_matches_db(Inquiry)  # 칸 이름 · 순서 · NULL 허용 · user_id → users FK


def test_guest_inquiry_fills_db_defaults(db):
    inquiry = new_inquiry()
    db.add(inquiry)
    db.flush()
    db.refresh(inquiry)
    assert inquiry.inquiry_id > 0
    assert inquiry.user_id is None
    assert inquiry.status is InquiryStatus.RECEIVED
    assert isinstance(inquiry.created_at, datetime)
    assert inquiry.answer is None and inquiry.answered_at is None


def test_member_inquiry_links_user(db):
    user = User(
        email="asker@example.com",
        password_hash="x",
        nickname="asker_test",
        privacy_agreed_at=now(),
        privacy_version="2026-10-05",
    )
    db.add(user)
    db.flush()
    inquiry = new_inquiry(user_id=user.user_id)
    db.add(inquiry)
    db.flush()
    assert inquiry.user_id == user.user_id


def test_unknown_user_is_rejected(db):
    db.add(new_inquiry(user_id=999_999_999))
    with pytest.raises(IntegrityError):  # FK — 없는 회원 번호는 DB 가 거절
        db.flush()


def test_long_content_is_stored(db):
    inquiry = new_inquiry(content="가" * 2000)  # 폼 최대 2,000자 (TEXT 칸)
    db.add(inquiry)
    db.flush()
    db.refresh(inquiry)
    assert len(inquiry.content) == 2000
