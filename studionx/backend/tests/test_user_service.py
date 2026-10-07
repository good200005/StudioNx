"""회원 정보 서비스 (services/user_service.py, P1-08)."""

import asyncio
import io
import re
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import UploadFile
from pydantic import ValidationError
from sqlalchemy import select
from starlette.datastructures import Headers

from app.core.errors import AppError, ErrorCode
from app.core.security import hash_password, verify_password
from app.models import Project, User
from app.models.user import UserRole, UserStatus
from app.schemas.auth import AvailabilityResponse
from app.schemas.user import MeResponse, MeUpdateRequest
from app.services import auth_service, user_service
from app.services.user_service import (
    PROFILE_IMAGE_URL,
    profile_image_url,
    to_me_response,
    update_me,
)

NAME = "3f9c2b7e0d1a4c5b8e6f7a9b0c1d2e3f"  # 올릴 때 만드는 무작위 32자 (uuid4().hex)


@pytest.mark.parametrize(
    ("path", "url"),
    [
        (None, None),
        ("", None),
        (f"profiles/{NAME}.jpg", f"/api/v1/profile-images/{NAME}.jpg"),
        (f"profiles/{NAME}.webp", f"/api/v1/profile-images/{NAME}.webp"),
    ],
    ids=["사진 없음", "빈 글자", "jpg", "webp"],
)
def test_profile_image_url(path, url):
    assert profile_image_url(User(user_id=85, profile_image_path=path)) == url


def test_profile_image_url_has_no_user_id():
    """주소에 회원 번호가 들어가지 않음 (탈퇴 추적 방지 ③)."""
    user = User(user_id=85, profile_image_path="profiles/aaaabbbbccccddddeeeeffff00001111.png")
    url = profile_image_url(user)
    assert url.startswith(PROFILE_IMAGE_URL)
    assert "85" not in url
    assert "/users/" not in url


def add_user(db, email, nickname, **fields):
    values = {
        "email": email,
        "password_hash": "$2b$12$secret-hash-must-not-leak",
        "nickname": nickname,
        "privacy_agreed_at": datetime.now(UTC).replace(tzinfo=None),
        "privacy_version": "2026-10-05",
    }
    values.update(fields)
    user = User(**values)
    db.add(user)
    db.flush()
    return user


def test_to_me_response_fields(db):
    user = add_user(db, "me.response@example.com", "me_response")
    me = to_me_response(user)

    assert isinstance(me, MeResponse)
    assert me.user_id == user.user_id
    assert me.email == "me.response@example.com"
    assert me.nickname == "me_response"
    assert me.role == "USER"
    assert me.profile_image_url is None
    assert me.created_at == user.created_at
    assert me.last_login_at is None


def test_to_me_response_only_listed_fields(db):
    """응답 칸은 정한 7개뿐 — 비밀번호 해시 · 상태 · 동의 정보 등은 나가지 않음."""
    user = add_user(db, "me.fields@example.com", "me_fields")
    body = to_me_response(user).model_dump_json()

    assert set(to_me_response(user).model_dump()) == {
        "user_id", "email", "nickname", "role", "profile_image_url", "created_at", "last_login_at",
    }
    assert "secret-hash" not in body
    assert "password" not in body


def test_to_me_response_photo_admin_last_login(db):
    login = datetime(2026, 10, 7, 9, 30, 0)
    user = add_user(
        db, "me.admin@example.com", "me_admin",
        role=UserRole.ADMIN, last_login_at=login,
        profile_image_path=f"profiles/{NAME}.png",
    )
    me = to_me_response(user)

    assert me.role == "ADMIN"
    assert me.last_login_at == login
    assert me.profile_image_url == f"/api/v1/profile-images/{NAME}.png"


# ── 37 update_me ──────────────────────────────────────────────


def nickname_in_db(db, user_id):
    return db.scalar(select(User.nickname).where(User.user_id == user_id))


@pytest.mark.parametrize(
    ("raw", "saved"),
    [("  ab  ", "ab"), ("x" * 20, "x" * 20)],
    ids=["앞뒤 공백 제거", "20자"],
)
def test_me_update_request_nickname_ok(raw, saved):
    assert MeUpdateRequest(nickname=raw).nickname == saved


@pytest.mark.parametrize("raw", ["  a  ", "x" * 21, ""], ids=["공백 빼면 1자", "21자", "빈 글자"])
def test_me_update_request_nickname_bad(raw):
    with pytest.raises(ValidationError):
        MeUpdateRequest(nickname=raw)


@pytest.mark.parametrize(
    "data",
    [MeUpdateRequest(), MeUpdateRequest(nickname=None), MeUpdateRequest(nickname="keep_me")],
    ids=["칸 없음", "null", "지금과 같음"],
)
def test_update_me_no_change(db, data):
    user = add_user(db, "keep@example.com", "keep_me")
    assert update_me(db, user, data) is user
    assert nickname_in_db(db, user.user_id) == "keep_me"


def test_update_me_new_nickname(db):
    user = add_user(db, "rename@example.com", "old_name")
    updated = update_me(db, user, MeUpdateRequest(nickname="  New_Name  "))

    assert updated.nickname == "New_Name"
    assert nickname_in_db(db, user.user_id) == "New_Name"


def test_update_me_case_only_change(db):
    """대소문자만 바꾸기 — DB 는 같은 닉네임으로 보지만 내 것이므로 허용."""
    user = add_user(db, "case@example.com", "Demo_Case")
    update_me(db, user, MeUpdateRequest(nickname="demo_case"))
    assert nickname_in_db(db, user.user_id) == "demo_case"


def test_update_me_taken(db):
    add_user(db, "owner@example.com", "Taken_Name")
    user = add_user(db, "me.taken@example.com", "my_name")

    with pytest.raises(AppError) as err:
        update_me(db, user, MeUpdateRequest(nickname="taken_name"))  # 대소문자만 다른 남의 것
    assert err.value.code == ErrorCode.NICKNAME_TAKEN
    assert err.value.status_code == 409
    assert err.value.message == "This nickname is already in use."
    assert nickname_in_db(db, user.user_id) == "my_name"


def test_update_me_withdrawn_within_3_days(db):
    gone_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=1)
    add_user(db, "gone.1d@example.com", "gone_nick", status=UserStatus.DELETED, deleted_at=gone_at)
    user = add_user(db, "me.rejoin@example.com", "my_name2")

    with pytest.raises(AppError) as err:
        update_me(db, user, MeUpdateRequest(nickname="gone_nick"))
    assert err.value.code == ErrorCode.REJOIN_TOO_SOON
    assert err.value.status_code == 409
    assert err.value.message.startswith("This nickname can be used again after ")
    assert err.value.message.endswith("(UTC).")
    assert err.value.details["nickname"] == "REJOIN_TOO_SOON"
    assert nickname_in_db(db, user.user_id) == "my_name2"


def test_update_me_withdrawn_after_3_days(db):
    gone_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=4)
    old = add_user(
        db, "gone.4d@example.com", "free_again", status=UserStatus.DELETED, deleted_at=gone_at
    )
    user = add_user(db, "me.free@example.com", "my_name3")

    update_me(db, user, MeUpdateRequest(nickname="free_again"))
    assert nickname_in_db(db, user.user_id) == "free_again"
    assert nickname_in_db(db, old.user_id) == f"deleted_user_{old.user_id:010d}"  # 비켜 둠


def test_update_me_race_integrity_error(db, monkeypatch):
    """확인은 통과했는데 그사이 남이 먼저 가져간 경우 → commit 오류 → 409, 내 닉네임 그대로."""
    add_user(db, "racer@example.com", "race_name")
    user = add_user(db, "me.race@example.com", "my_name4")
    db.commit()
    monkeypatch.setattr(
        user_service, "check_nickname", lambda *a, **k: AvailabilityResponse(available=True)
    )

    with pytest.raises(AppError) as err:
        update_me(db, user, MeUpdateRequest(nickname="race_name"))
    assert err.value.code == ErrorCode.NICKNAME_TAKEN
    assert nickname_in_db(db, user.user_id) == "my_name4"


# ── 38 save_profile_image (+ image_extension) ─────────────────

JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 100
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
WEBP = b"RIFF" + b"\x24\x00\x00\x00" + b"WEBPVP8 " + b"\x00" * 100


@pytest.mark.parametrize(
    ("data", "ext"),
    [
        (JPG, ".jpg"),
        (PNG, ".png"),
        (WEBP, ".webp"),
        (b"GIF89a" + b"\x00" * 20, None),
        (b"<html><script>alert(1)</script>", None),
        (b"RIFF\x00\x00\x00\x00WAVEfmt ", None),
        (b"", None),
    ],
    ids=["jpg", "png", "webp", "gif", "html", "RIFF 지만 wav", "빈 파일"],
)
def test_image_extension(data, ext):
    assert user_service.image_extension(data) == ext


@pytest.fixture
def storage(tmp_path, monkeypatch):
    """사진을 시험용 임시 폴더에 저장 (진짜 storage/ 를 건드리지 않음)."""
    monkeypatch.setattr(user_service, "get_settings", lambda: SimpleNamespace(storage_dir=tmp_path))
    return tmp_path


def upload(data, content_type="image/jpeg", filename="me.jpg"):
    return UploadFile(
        file=io.BytesIO(data), filename=filename, headers=Headers({"content-type": content_type})
    )


def save(db, user, file):
    return asyncio.run(user_service.save_profile_image(db, user, file))


def files_in(storage):
    folder = storage / "profiles"
    return sorted(p.name for p in folder.iterdir()) if folder.exists() else []


def test_save_profile_image_jpg(db, storage):
    user = add_user(db, "photo@example.com", "photo_user")
    saved = save(db, user, upload(JPG))

    path = saved.profile_image_path
    assert re.fullmatch(r"profiles/[0-9a-f]{32}\.jpg", path)
    assert (storage / path).read_bytes() == JPG
    assert files_in(storage) == [path.split("/")[1]]
    assert to_me_response(saved).profile_image_url == "/api/v1/profile-images/" + path.split("/")[1]
    assert db.scalar(select(User.profile_image_path).where(User.user_id == user.user_id)) == path
    assert db.scalar(select(User.storage_used_bytes).where(User.user_id == user.user_id)) == 0


def test_save_profile_image_extension_from_content(db, storage):
    """브라우저는 png 라고 했지만 내용은 jpg → 내용대로 .jpg."""
    user = add_user(db, "photo.ext@example.com", "photo_ext")
    assert save(db, user, upload(JPG, "image/png", "fake.png")).profile_image_path.endswith(".jpg")


@pytest.mark.parametrize(
    ("data", "content_type", "status"),
    [
        (b"GIF89a" + b"\x00" * 20, "image/gif", 415),
        (b"<html>not an image</html>", "image/png", 415),
        (b"", "image/jpeg", 415),
        (JPG + b"\x00" * (2 * 1024 * 1024), "image/jpeg", 413),
    ],
    ids=["gif 종류", "png 라면서 html", "빈 파일", "2MB 초과"],
)
def test_save_profile_image_rejected(db, storage, data, content_type, status):
    user = add_user(db, "photo.bad@example.com", "photo_bad")
    with pytest.raises(AppError) as err:
        save(db, user, upload(data, content_type))

    assert err.value.status_code == status
    expected = ErrorCode.FILE_TOO_LARGE if status == 413 else ErrorCode.UNSUPPORTED_FILE_TYPE
    assert err.value.code == expected
    assert files_in(storage) == []
    assert user.profile_image_path is None


def test_save_profile_image_exactly_2mb(db, storage):
    user = add_user(db, "photo.2mb@example.com", "photo_2mb")
    data = PNG + b"\x00" * (2 * 1024 * 1024 - len(PNG))
    assert save(db, user, upload(data, "image/png")).profile_image_path.endswith(".png")


def test_save_profile_image_replaces_old_file(db, storage):
    user = add_user(db, "photo.swap@example.com", "photo_swap")
    first = save(db, user, upload(JPG)).profile_image_path
    second = save(db, user, upload(WEBP, "image/webp")).profile_image_path

    assert second != first and second.endswith(".webp")
    assert not (storage / first).exists()
    assert files_in(storage) == [second.split("/")[1]]


def test_save_profile_image_old_file_missing(db, storage):
    """DB 에는 있는데 파일이 이미 없는 옛 사진 → 오류 없이 새 사진 저장."""
    user = add_user(
        db, "photo.gone@example.com", "photo_gone", profile_image_path=f"profiles/{NAME}.jpg"
    )
    assert save(db, user, upload(PNG, "image/png")).profile_image_path.endswith(".png")


def test_save_profile_image_commit_fails(db, storage, monkeypatch):
    """DB 저장이 실패하면 새 파일을 지우고 예전 사진은 그대로."""
    user = add_user(db, "photo.fail@example.com", "photo_fail")
    old = save(db, user, upload(JPG)).profile_image_path

    def broken_commit():
        raise RuntimeError("db down")

    monkeypatch.setattr(db, "commit", broken_commit)
    with pytest.raises(RuntimeError):
        save(db, user, upload(PNG, "image/png"))

    assert files_in(storage) == [old.split("/")[1]]
    assert (storage / old).read_bytes() == JPG


# ── 39 delete_profile_image ───────────────────────────────────


def test_delete_profile_image(db, storage):
    user = add_user(db, "photo.del@example.com", "photo_del")
    path = save(db, user, upload(JPG)).profile_image_path

    result = user_service.delete_profile_image(db, user)
    assert result is user
    assert user.profile_image_path is None
    assert to_me_response(user).profile_image_url is None
    assert db.scalar(select(User.profile_image_path).where(User.user_id == user.user_id)) is None
    assert not (storage / path).exists()
    assert files_in(storage) == []


def test_delete_profile_image_twice_or_no_photo(db, storage):
    """사진이 없거나 두 번 눌러도 오류 없음."""
    user = add_user(db, "photo.none@example.com", "photo_none")
    user_service.delete_profile_image(db, user)
    user_service.delete_profile_image(db, user)
    assert user.profile_image_path is None


def test_delete_profile_image_file_already_gone(db, storage):
    user = add_user(
        db, "photo.lost@example.com", "photo_lost", profile_image_path=f"profiles/{NAME}.png"
    )
    user_service.delete_profile_image(db, user)
    assert user.profile_image_path is None


def test_delete_profile_image_keeps_other_files(db, storage):
    """다른 회원의 사진은 지우지 않음."""
    me = add_user(db, "photo.me@example.com", "photo_me")
    other = add_user(db, "photo.other@example.com", "photo_other")
    save(db, me, upload(JPG))
    other_path = save(db, other, upload(PNG, "image/png")).profile_image_path

    user_service.delete_profile_image(db, me)
    assert files_in(storage) == [other_path.split("/")[1]]


def test_delete_profile_image_commit_fails(db, storage, monkeypatch):
    """DB 저장이 실패하면 파일을 지우지 않음."""
    user = add_user(db, "photo.keep@example.com", "photo_keep")
    path = save(db, user, upload(JPG)).profile_image_path

    def broken_commit():
        raise RuntimeError("db down")

    monkeypatch.setattr(db, "commit", broken_commit)
    with pytest.raises(RuntimeError):
        user_service.delete_profile_image(db, user)
    assert (storage / path).read_bytes() == JPG


# ── 40 profile_image_file ─────────────────────────────────────


def photo_name(user):
    return user.profile_image_path.split("/")[1]


def assert_not_found(db, name):
    with pytest.raises(AppError) as err:
        user_service.profile_image_file(db, name)
    assert err.value.status_code == 404
    assert err.value.code == ErrorCode.NOT_FOUND
    assert err.value.message == "Image not found."


def test_profile_image_file(db, storage):
    user = add_user(db, "file.ok@example.com", "file_ok")
    save(db, user, upload(PNG, "image/png"))

    path = user_service.profile_image_file(db, photo_name(user))
    assert path == (storage / user.profile_image_path).resolve()
    assert path.read_bytes() == PNG


@pytest.mark.parametrize(
    "name",
    [
        "../../.env",
        "..%2F..%2F.env",
        f"{NAME.upper()}.jpg",
        f"{NAME}.gif",
        f"{NAME}.jpg.exe",
        f"{NAME[:31]}.jpg",
        "",
    ],
    ids=["상위 폴더", "인코딩된 상위 폴더", "대문자", "gif", "확장자 덧붙임", "31자", "빈 글자"],
)
def test_profile_image_file_bad_name(db, storage, name):
    assert_not_found(db, name)


def test_profile_image_file_unknown_name(db, storage):
    assert_not_found(db, f"{NAME}.jpg")


def test_profile_image_file_withdrawn(db, storage):
    """탈퇴하면 (3일 안이어도) 사진은 보이지 않음."""
    user = add_user(db, "file.gone@example.com", "file_gone")
    save(db, user, upload(JPG))
    user.status = UserStatus.DELETED
    db.flush()
    assert_not_found(db, photo_name(user))


def test_profile_image_file_suspended_still_shown(db, storage):
    user = add_user(db, "file.susp@example.com", "file_susp")
    save(db, user, upload(JPG))
    user.status = UserStatus.SUSPENDED
    db.flush()
    assert user_service.profile_image_file(db, photo_name(user)).is_file()


def test_profile_image_file_missing_on_disk(db, storage):
    user = add_user(
        db, "file.lost@example.com", "file_lost", profile_image_path=f"profiles/{NAME}.webp"
    )
    assert_not_found(db, photo_name(user))


# ── 44 check_current_password (P1-09) ─────────────────────────


def test_check_current_password_ok():
    user = User(password_hash=hash_password("Abcdef1!"))
    assert user_service.check_current_password(user, "Abcdef1!") is None


@pytest.mark.parametrize(
    "password",
    ["Abcdef1?", "abcdef1!", " Abcdef1!", "", "A" * 100],
    ids=["한 글자 다름", "대소문자", "앞 공백", "빈 글자", "100자(72바이트 넘음)"],
)
def test_check_current_password_wrong(password):
    user = User(password_hash=hash_password("Abcdef1!"))
    with pytest.raises(AppError) as err:
        user_service.check_current_password(user, password)
    assert err.value.code == ErrorCode.WRONG_PASSWORD
    assert err.value.status_code == 400
    assert err.value.message == "Password is incorrect."


def test_check_current_password_wiped_hash():
    """보관 기간 정리 뒤의 '!' 해시는 어떤 비밀번호로도 통과하지 않음."""
    with pytest.raises(AppError):
        user_service.check_current_password(User(password_hash="!"), "!")


# ── 45 change_password ────────────────────────────────────────


def hash_in_db(db, user_id):
    return db.scalar(select(User.password_hash).where(User.user_id == user_id))


def test_change_password(db):
    user = add_user(
        db, "pw.change@example.com", "pw_change", password_hash=hash_password("Abcdef1!")
    )
    old_hash = user.password_hash

    assert user_service.change_password(db, user, "Abcdef1!", "Newpass9#") is None
    saved = hash_in_db(db, user.user_id)
    assert saved != old_hash
    assert verify_password("Newpass9#", saved)
    assert not verify_password("Abcdef1!", saved)


def test_change_password_wrong_current(db):
    user = add_user(db, "pw.wrong@example.com", "pw_wrong", password_hash=hash_password("Abcdef1!"))
    old_hash = user.password_hash
    with pytest.raises(AppError) as err:
        user_service.change_password(db, user, "Abcdef1?", "Newpass9#")
    assert err.value.code == ErrorCode.WRONG_PASSWORD
    assert hash_in_db(db, user.user_id) == old_hash


@pytest.mark.parametrize(
    ("new", "failed"),
    [
        ("abcdefgh", ["upper", "number", "special"]),
        ("Ab1!", ["length"]),
        ("Abcdef1! 한글", ["allowed"]),
    ],
    ids=["약함", "짧음", "한글 · 공백"],
)
def test_change_password_rules(db, new, failed):
    user = add_user(db, "pw.rules@example.com", "pw_rules", password_hash=hash_password("Abcdef1!"))
    with pytest.raises(AppError) as err:
        user_service.change_password(db, user, "Abcdef1!", new)
    assert err.value.status_code == 422
    assert err.value.code == ErrorCode.VALIDATION_ERROR
    assert err.value.message == "Check the password requirements."
    assert err.value.details == {"new_password": failed}


def test_change_password_same_as_current(db):
    user = add_user(db, "pw.same@example.com", "pw_same", password_hash=hash_password("Abcdef1!"))
    old_hash = user.password_hash
    with pytest.raises(AppError) as err:
        user_service.change_password(db, user, "Abcdef1!", "Abcdef1!")
    assert err.value.status_code == 422
    assert err.value.message == "Use a different password."
    assert err.value.details == {"new_password": "same_as_current"}
    assert hash_in_db(db, user.user_id) == old_hash


def test_change_password_other_user_same_password_ok(db):
    """다른 회원과 같은 비밀번호여도 됨 (비밀번호는 겹침 검사를 하지 않음)."""
    add_user(db, "pw.other@example.com", "pw_other", password_hash=hash_password("Newpass9#"))
    user = add_user(db, "pw.mine@example.com", "pw_mine", password_hash=hash_password("Abcdef1!"))
    user_service.change_password(db, user, "Abcdef1!", "Newpass9#")
    assert verify_password("Newpass9#", hash_in_db(db, user.user_id))


# ── 46 withdraw ───────────────────────────────────────────────


def test_withdraw(db, storage):
    user = add_user(db, "bye@example.com", "bye_user", password_hash=hash_password("Abcdef1!"))
    photo = save(db, user, upload(JPG)).profile_image_path
    project = Project(owner_id=user.user_id, title="Still here")
    db.add(project)
    db.flush()
    before = datetime.now(UTC).replace(tzinfo=None, microsecond=0)

    assert user_service.withdraw(db, user, "Abcdef1!") is None
    row = db.execute(
        select(User.status, User.deleted_at, User.email, User.nickname, User.profile_image_path)
        .where(User.user_id == user.user_id)
    ).one()
    assert row.status == UserStatus.DELETED
    assert before <= row.deleted_at <= datetime.now(UTC).replace(tzinfo=None) + timedelta(seconds=1)
    assert (row.email, row.nickname) == ("bye@example.com", "bye_user")  # 바꾸지 않음
    assert row.profile_image_path is None
    assert not (storage / photo).exists()
    assert db.get(Project, project.project_id).owner_id == user.user_id  # 프로젝트는 남김


def test_withdraw_wrong_password(db, storage):
    user = add_user(db, "stay@example.com", "stay_user", password_hash=hash_password("Abcdef1!"))
    photo = save(db, user, upload(JPG)).profile_image_path

    with pytest.raises(AppError) as err:
        user_service.withdraw(db, user, "Abcdef1?")
    assert err.value.code == ErrorCode.WRONG_PASSWORD
    assert db.scalar(select(User.status).where(User.user_id == user.user_id)) == UserStatus.ACTIVE
    assert (storage / photo).exists()


def test_withdraw_blocks_login_and_rejoin(db, storage):
    """탈퇴 뒤: 로그인 · 재발급이 막히고, 같은 이메일 · 닉네임은 3일 동안 다시 못 씀."""
    user = add_user(db, "gone.now@example.com", "gone_now", password_hash=hash_password("Abcdef1!"))
    user_service.withdraw(db, user, "Abcdef1!")

    with pytest.raises(AppError) as login:
        auth_service.authenticate(db, "gone.now@example.com", "Abcdef1!")
    assert login.value.status_code == 401
    with pytest.raises(AppError) as refresh:
        auth_service.get_active_user(db, user.user_id)
    assert refresh.value.status_code == 401
    assert auth_service.check_email(db, "gone.now@example.com").reason == "REJOIN_TOO_SOON"
    assert auth_service.check_nickname(db, "gone_now").reason == "REJOIN_TOO_SOON"


def test_withdraw_commit_fails(db, storage, monkeypatch):
    """저장이 실패하면 사진 파일도 남음 (39 의 순서)."""
    user = add_user(db, "bye.fail@example.com", "bye_fail", password_hash=hash_password("Abcdef1!"))
    photo = save(db, user, upload(JPG)).profile_image_path

    def broken_commit():
        raise RuntimeError("db down")

    monkeypatch.setattr(db, "commit", broken_commit)
    with pytest.raises(RuntimeError):
        user_service.withdraw(db, user, "Abcdef1!")
    assert (storage / photo).exists()
