"""관리자 화면의 회원 설정 (app/admin.py UserAdmin, P1-21).

설정 값과 저장 규칙은 SQLAdmin 을 띄우지 않고 확인한다. 실제 화면 흐름은 setup_admin 까지
구현한 뒤 서버를 띄워 확인한다 (사이트 시험).
"""

import asyncio

import pytest

from app.admin import UserAdmin
from app.models import User
from app.models.user import UserRole, UserStatus


class FakeRequest:
    def __init__(self, admin_user_id=None):
        self.session = {} if admin_user_id is None else {"admin_user_id": admin_user_id}


@pytest.fixture
def view():
    return UserAdmin()


def change(view, data, user_id=10, role=UserRole.USER, status=UserStatus.ACTIVE, admin_id=1):
    model = User(user_id=user_id, role=role, status=status)
    asyncio.run(view.on_model_change(dict(data), model, False, FakeRequest(admin_id)))


# ── 화면 설정 ──
def test_cannot_create_or_delete(view):
    assert view.can_create is False and view.can_delete is False


def test_password_hash_is_not_shown_anywhere(view):
    assert "password_hash" not in view.get_list_columns()
    assert "password_hash" not in view.get_details_columns()
    assert "password_hash" not in view.get_form_columns()
    assert "password_hash" not in view.get_export_columns()


def test_details_still_show_other_columns(view):
    details = view.get_details_columns()
    for name in ("email", "nickname", "role", "status", "last_login_at"):
        assert name in details


def test_list_columns_sort_and_search(view):
    assert view.get_list_columns() == [
        "user_id",
        "email",
        "nickname",
        "role",
        "status",
        "last_login_at",
        "created_at",
    ]
    assert view.column_default_sort == [("user_id", True)]
    assert [c.key for c in view.column_searchable_list] == ["email", "nickname"]


def test_form_has_only_role_and_status(view):
    assert view.get_form_columns() == ["role", "status"]


# ── on_model_change ──
def test_suspending_another_user_is_allowed(view):
    change(view, {"role": UserRole.USER, "status": UserStatus.SUSPENDED})


def test_promoting_another_user_to_admin_is_allowed(view):
    change(view, {"role": UserRole.ADMIN, "status": UserStatus.ACTIVE})


def test_values_given_as_plain_text_are_handled(view):
    change(view, {"role": "ADMIN", "status": "SUSPENDED"})


def test_setting_deleted_status_is_rejected(view):
    with pytest.raises(ValueError, match="withdrawal"):
        change(view, {"role": UserRole.USER, "status": UserStatus.DELETED})
    with pytest.raises(ValueError, match="withdrawal"):
        change(view, {"role": "USER", "status": "DELETED"})


def test_already_deleted_user_saved_unchanged_is_not_blocked(view):
    change(view, {"role": UserRole.USER, "status": UserStatus.DELETED}, status=UserStatus.DELETED)


@pytest.mark.parametrize(
    "data",
    [
        {"role": UserRole.USER, "status": UserStatus.ACTIVE},  # 자기 자신을 관리자에서 내림
        {"role": UserRole.ADMIN, "status": UserStatus.SUSPENDED},  # 자기 자신을 정지
    ],
)
def test_admin_cannot_demote_or_suspend_self(view, data):
    with pytest.raises(ValueError, match="your own account"):
        change(view, data, user_id=1, role=UserRole.ADMIN, admin_id=1)


def test_admin_saving_self_unchanged_is_allowed(view):
    change(view, {"role": UserRole.ADMIN, "status": UserStatus.ACTIVE}, user_id=1, admin_id=1)


def test_missing_form_values_fall_back_to_current(view):
    # 폼에 role 이 없으면 지금 값을 씀 → 자기 자신이 이미 ADMIN/ACTIVE 이면 통과
    change(view, {}, user_id=1, role=UserRole.ADMIN, admin_id=1)
