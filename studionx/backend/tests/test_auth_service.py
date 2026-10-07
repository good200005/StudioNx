"""회원가입 서비스 (services/auth_service.py, P1-04)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError, ErrorCode
from app.core.security import verify_password
from app.models import Project, User
from app.models.user import UserRole, UserStatus
from app.schemas.auth import NICKNAME_MAX, PRIVACY_VERSION, AvailabilityResponse, SignupRequest
from app.services import auth_service
from app.services.auth_service import (
    check_email,
    check_nickname,
    normalize_email,
    release_withdrawn,
    signup,
)


@pytest.mark.parametrize(
    ("raw", "normalized"),
    [
        ("user@example.com", "user@example.com"),
        ("User@Example.COM", "user@example.com"),
        ("  user@example.com  ", "user@example.com"),
        ("\tUSER@EXAMPLE.COM\n", "user@example.com"),
        ("first.last+tag@Mail.Example.com", "first.last+tag@mail.example.com"),
    ],
    ids=["그대로", "대문자", "앞뒤 공백", "탭 · 줄바꿈", "점 · 플러스 유지"],
)
def test_normalize_email(raw, normalized):
    assert normalize_email(raw) == normalized


def test_same_person_typed_differently_becomes_equal():
    assert normalize_email(" Kim@Naver.com") == normalize_email("kim@naver.com ")


def test_inner_spaces_are_kept():
    # 가운데 공백은 지우지 않는다 — 형식 검사(EmailStr)가 422 로 막을 일
    assert normalize_email(" a b@x.com ") == "a b@x.com"


# ── release_withdrawn (실제 MySQL · 넣은 행은 rollback) ──


def add_user(db, email, nickname, **fields):
    user = User(
        email=email,
        password_hash="x",
        nickname=nickname,
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-05",
        **fields,
    )
    db.add(user)
    db.flush()
    return user


def withdrawn_user(db, days_ago=4):
    when = (datetime.now(UTC) - timedelta(days=days_ago)).replace(tzinfo=None)
    return add_user(db, "gone@example.com", "gone_nick", status=UserStatus.DELETED, deleted_at=when)


def test_release_frees_email_and_nickname(db):
    old = withdrawn_user(db)
    release_withdrawn(db, old)
    assert old.email == f"deleted+{old.user_id}@withdrawn.invalid"
    assert old.nickname == f"deleted_user_{old.user_id:010d}"
    new = add_user(db, "gone@example.com", "gone_nick")  # 같은 이메일 · 닉네임으로 새 가입
    assert new.user_id != old.user_id


def test_without_release_same_email_is_rejected(db):
    withdrawn_user(db)
    with pytest.raises(IntegrityError):  # UNIQUE — 그래서 release_withdrawn 이 필요
        add_user(db, "gone@example.com", "other_nick")


def test_release_keeps_row_and_projects(db):
    old = withdrawn_user(db)
    db.refresh(old)  # DB 에 저장된 값(밀리초까지)으로 비교
    deleted_at = old.deleted_at
    project = Project(owner_id=old.user_id, title="Left behind")
    db.add(project)
    db.flush()
    release_withdrawn(db, old)
    db.refresh(old)
    assert old.status is UserStatus.DELETED
    assert old.deleted_at == deleted_at
    assert db.get(Project, project.project_id).owner_id == old.user_id


def test_released_nickname_cannot_clash_with_real_nickname(db):
    old = withdrawn_user(db)
    release_withdrawn(db, old)
    assert len(old.nickname) > NICKNAME_MAX  # 가입 닉네임은 최대 20자
    assert len(old.nickname) <= 50  # users.nickname VARCHAR(50)
    add_user(db, f"deleted_{old.user_id}@example.com", f"deleted_{old.user_id}")  # 충돌 없음


# ── check_email (실제 MySQL · rollback) ──


def deleted_days_ago(days, hours=0):
    return (datetime.now(UTC) - timedelta(days=days, hours=hours)).replace(tzinfo=None)


def test_email_new_is_available(db):
    assert check_email(db, "nobody@example.com").available is True


@pytest.mark.parametrize("status", [UserStatus.ACTIVE, UserStatus.SUSPENDED])
def test_email_in_use_is_taken(db, status):
    add_user(db, "taken@example.com", "taken_nick", status=status)
    result = check_email(db, "taken@example.com")
    assert (result.available, result.reason) == (False, "TAKEN")


def test_email_compared_after_normalize(db):
    add_user(db, "taken@example.com", "taken_nick")
    assert check_email(db, "  Taken@Example.COM ").reason == "TAKEN"


def test_email_withdrawn_within_3_days(db):
    gone = add_user(
        db,
        "gone@example.com",
        "gone_nick",
        status=UserStatus.DELETED,
        deleted_at=deleted_days_ago(2),
    )
    result = check_email(db, "gone@example.com")
    assert (result.available, result.reason) == (False, "REJOIN_TOO_SOON")
    assert result.available_at.tzinfo is UTC
    assert result.available_at.replace(tzinfo=None) == gone.deleted_at + timedelta(days=3)


def test_email_withdrawn_over_3_days_check_only(db):
    gone = add_user(
        db,
        "gone@example.com",
        "gone_nick",
        status=UserStatus.DELETED,
        deleted_at=deleted_days_ago(3, hours=1),
    )
    assert check_email(db, "gone@example.com").available is True
    assert gone.email == "gone@example.com"  # 확인만 — 바꾸지 않음


def test_email_withdrawn_over_3_days_release(db):
    gone = add_user(
        db,
        "gone@example.com",
        "gone_nick",
        status=UserStatus.DELETED,
        deleted_at=deleted_days_ago(4),
    )
    assert check_email(db, "gone@example.com", release=True).available is True
    assert gone.email.startswith("deleted+")  # 가입(signup)이 부를 때는 비켜 둠
    add_user(db, "gone@example.com", "new_nick")  # 바로 같은 이메일로 넣을 수 있음


def test_email_response_shape_for_api():
    # 화면(join.js)이 받는 모양 — None 칸도 함께 나감
    assert AvailabilityResponse(available=True).model_dump() == {
        "available": True,
        "reason": None,
        "available_at": None,
    }


# ── check_nickname (실제 MySQL · rollback) ──


def test_nickname_new_is_available(db):
    assert check_nickname(db, "fresh_nick").available is True


def test_nickname_taken(db):
    add_user(db, "a@example.com", "beatmaker")
    assert check_nickname(db, "beatmaker").reason == "TAKEN"


@pytest.mark.parametrize("asked", ["  beatmaker ", "BeatMaker", "BEATMAKER"])
def test_nickname_compared_like_db(db, asked):
    # 앞뒤 공백은 지우고, 대소문자는 DB 정렬 규칙이 구분하지 않음 → 사칭 방지
    add_user(db, "a@example.com", "beatmaker")
    assert check_nickname(db, asked).reason == "TAKEN"


def test_nickname_db_unique_agrees(db):
    # 확인 결과와 DB UNIQUE 가 같은 규칙인지: 대소문자만 다른 닉네임은 DB 도 거절
    add_user(db, "a@example.com", "beatmaker")
    with pytest.raises(IntegrityError):
        add_user(db, "b@example.com", "BeatMaker")


def test_nickname_withdrawn_within_3_days(db):
    add_user(
        db,
        "gone@example.com",
        "gone_nick",
        status=UserStatus.DELETED,
        deleted_at=deleted_days_ago(1),
    )
    assert check_nickname(db, "gone_nick").reason == "REJOIN_TOO_SOON"


def test_nickname_withdrawn_over_3_days_release(db):
    gone = add_user(
        db,
        "gone@example.com",
        "gone_nick",
        status=UserStatus.DELETED,
        deleted_at=deleted_days_ago(5),
    )
    assert check_nickname(db, "gone_nick").available is True
    assert gone.nickname == "gone_nick"  # 확인만
    assert check_nickname(db, "gone_nick", release=True).available is True
    assert gone.nickname.startswith("deleted_user_")
    add_user(db, "new@example.com", "gone_nick")


# ── signup (실제 MySQL · commit 은 저장점까지만 → 시험 뒤 rollback) ──


def signup_data(**fields):
    values = {
        "email": "  New.User@Example.COM ",
        "nickname": " newbie ",
        "password": "Abcdef1!",
        "privacy_agreed": True,
        "privacy_version": PRIVACY_VERSION,
    }
    values.update(fields)
    return SignupRequest(**values)


def raises_app_error(func, *args):
    with pytest.raises(AppError) as info:
        func(*args)
    return info.value


def test_signup_success(db):
    user = signup(db, signup_data())
    assert user.user_id > 0
    assert user.email == "new.user@example.com"  # 17 로 맞춤
    assert user.nickname == "newbie"  # 앞뒤 공백만 지움
    assert user.password_hash != "Abcdef1!" and verify_password("Abcdef1!", user.password_hash)
    assert (user.role, user.status) == (UserRole.USER, UserStatus.ACTIVE)  # DB 기본값
    assert user.privacy_version == PRIVACY_VERSION and user.privacy_agreed_at is not None
    assert db.scalar(select(User).where(User.email == "new.user@example.com")) is user


def test_signup_password_rules(db):
    err = raises_app_error(signup, db, signup_data(password="abcdefgh"))
    assert (err.code, err.status_code) == (ErrorCode.VALIDATION_ERROR, 422)
    assert err.details == {"password": ["upper", "number", "special"]}


def test_signup_privacy_not_agreed(db):
    err = raises_app_error(signup, db, signup_data(privacy_agreed=False))
    assert (err.status_code, err.details) == (422, {"privacy_agreed": "required"})


def test_signup_old_privacy_version(db):
    err = raises_app_error(signup, db, signup_data(privacy_version="2025-01-01"))
    assert (err.status_code, err.message) == (422, "Please reload the page.")


def test_signup_email_taken(db):
    add_user(db, "new.user@example.com", "someone")
    err = raises_app_error(signup, db, signup_data())
    assert (err.code, err.status_code, err.message) == (
        ErrorCode.EMAIL_TAKEN,
        409,
        "This email is already in use.",
    )


def test_signup_nickname_taken_case_insensitive(db):
    add_user(db, "other@example.com", "Newbie")
    err = raises_app_error(signup, db, signup_data())
    assert (err.code, err.status_code) == (ErrorCode.NICKNAME_TAKEN, 409)


def test_signup_rejoin_too_soon(db):
    gone = add_user(
        db,
        "new.user@example.com",
        "old_nick",
        status=UserStatus.DELETED,
        deleted_at=deleted_days_ago(1),
    )
    err = raises_app_error(signup, db, signup_data())
    assert (err.code, err.status_code) == (ErrorCode.REJOIN_TOO_SOON, 409)
    when = gone.deleted_at + timedelta(days=3)
    assert f"{when:%b} {when.day}, {when.year} (UTC)" in err.message
    assert err.details["email"] == "REJOIN_TOO_SOON"
    assert err.details["available_at"].startswith(when.strftime("%Y-%m-%dT%H:%M"))


def test_signup_rejoin_after_3_days(db):
    gone = add_user(
        db,
        "new.user@example.com",
        "newbie",
        status=UserStatus.DELETED,
        deleted_at=deleted_days_ago(4),
    )
    user = signup(db, signup_data())  # 같은 이메일 · 같은 닉네임
    assert user.user_id != gone.user_id
    db.refresh(gone)
    assert gone.email.startswith("deleted+") and gone.nickname.startswith("deleted_user_")


@pytest.mark.parametrize(
    ("field", "code"), [("email", ErrorCode.EMAIL_TAKEN), ("nickname", ErrorCode.NICKNAME_TAKEN)]
)
def test_signup_race_conflict_is_409(db, monkeypatch, field, code):
    # 두 사람이 동시에 가입 → 둘 다 검사를 통과했다고 가정하고, 저장(commit) 때 DB 가 막는 경우
    if field == "email":
        add_user(db, "new.user@example.com", "first_one")
    else:
        add_user(db, "first@example.com", "newbie")
    always_ok = lambda *args, **kwargs: AvailabilityResponse(available=True)  # noqa: E731
    monkeypatch.setattr(auth_service, "check_email", always_ok)
    monkeypatch.setattr(auth_service, "check_nickname", always_ok)
    err = raises_app_error(signup, db, signup_data())
    assert (err.code, err.status_code) == (code, 409)
