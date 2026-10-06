"""users 모델 컬럼 (models/user.py, P1-03) — 실제 MySQL 의 users 테이블과 비교.

DB 세션(db)과 비교 도구(assert_matches_db)는 conftest.py 에 있다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import get_current_user
from app.core.errors import AppError
from app.models import User
from app.models.user import UserRole, UserStatus
from tests.test_deps import make_token  # 토큰 발급(create_access_token)은 P1-05


def new_user(**fields):
    values = {
        "email": "model-test@example.com",
        "password_hash": "x",
        "nickname": "model_test",
        "privacy_agreed_at": datetime.now(UTC).replace(tzinfo=None),
        "privacy_version": "2026-10-05",
    }
    values.update(fields)
    return User(**values)


def test_columns_match_db(assert_matches_db):
    assert_matches_db(User)  # 칸 이름 · 순서 · NULL 허용 (conftest.py)


def test_unique_columns():
    unique = {c.name for c in User.__table__.columns if c.unique}
    assert unique == {"email", "nickname"}


def test_insert_fills_db_defaults(db):
    user = new_user()
    db.add(user)
    db.flush()
    db.refresh(user)
    assert user.user_id > 0
    assert user.role is UserRole.USER
    assert user.status is UserStatus.ACTIVE
    assert user.storage_quota_bytes == 5 * 1024**3
    assert user.storage_used_bytes == 0
    assert isinstance(user.created_at, datetime)
    assert user.last_login_at is None and user.deleted_at is None


def test_get_current_user_with_real_db(db):
    active = new_user()
    gone = new_user(email="gone@example.com", nickname="gone_test", status=UserStatus.DELETED)
    db.add_all([active, gone])
    db.flush()

    def bearer(user):
        return HTTPAuthorizationCredentials(
            scheme="Bearer", credentials=make_token(str(user.user_id))
        )

    assert get_current_user(bearer(active), db) is active
    with pytest.raises(AppError):
        get_current_user(bearer(gone), db)
