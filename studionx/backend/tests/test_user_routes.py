"""P1-08·09 회원 정보 라우터 — 연결 확인(DB 없이) + 실제 앱 · MySQL 로 요청 (P1-08)."""

import re
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.main import app
from app.models import User
from app.models.user import UserStatus
from app.services import user_service


def test_profile_routes_registered():
    paths = app.openapi()["paths"]

    assert {"get", "patch"} <= paths["/api/v1/users/me"].keys()
    assert {"post", "delete"} <= paths["/api/v1/users/me/profile-image"].keys()
    assert "get" in paths["/api/v1/profile-images/{name}"]
    # 회원 번호로 사진을 여는 주소는 없음 (2026-10-07, 탈퇴 추적 방지 ③)
    assert "/api/v1/users/{user_id}/profile-image" not in paths


def test_password_withdraw_routes_registered():
    paths = app.openapi()["paths"]

    assert "put" in paths["/api/v1/users/me/password"]
    assert "delete" in paths["/api/v1/users/me"]


# ── 실제 앱 + 실제 MySQL (시험 뒤 rollback) ─────────────────────


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db  # 앱이 시험용 세션을 쓰게 함
    yield TestClient(app)
    app.dependency_overrides.clear()


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


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


# ── 41 GET · PATCH /users/me ──


def test_read_me(client, db):
    user = add_user(db, "route.me@example.com", "route_me")
    res = client.get("/api/v1/users/me", headers=auth(user))

    assert res.status_code == 200
    data = res.json()
    assert set(data) == {
        "user_id", "email", "nickname", "role", "profile_image_url", "created_at", "last_login_at",
    }
    assert data["user_id"] == user.user_id
    assert data["email"] == "route.me@example.com"
    assert data["nickname"] == "route_me"
    assert data["profile_image_url"] is None
    assert "secret-hash" not in res.text


def test_read_me_without_token(client):
    res = client.get("/api/v1/users/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


def test_update_me_nickname(client, db):
    user = add_user(db, "route.rename@example.com", "route_old")
    res = client.patch("/api/v1/users/me", headers=auth(user), json={"nickname": "  Route_New  "})

    assert res.status_code == 200
    assert res.json()["nickname"] == "Route_New"
    assert db.scalar(select(User.nickname).where(User.user_id == user.user_id)) == "Route_New"


def test_update_me_empty_body(client, db):
    user = add_user(db, "route.empty@example.com", "route_empty")
    res = client.patch("/api/v1/users/me", headers=auth(user), json={})
    assert res.status_code == 200
    assert res.json()["nickname"] == "route_empty"


def test_update_me_email_ignored(client, db):
    """이메일은 바꿀 수 없음 (FR-106) — 보내도 무시."""
    user = add_user(db, "route.mail@example.com", "route_mail")
    res = client.patch("/api/v1/users/me", headers=auth(user), json={"email": "new@example.com"})
    assert res.status_code == 200
    assert res.json()["email"] == "route.mail@example.com"


@pytest.mark.parametrize("nickname", ["  a  ", "x" * 21], ids=["공백 빼면 1자", "21자"])
def test_update_me_422(client, db, nickname):
    user = add_user(db, "route.short@example.com", "route_short")
    res = client.patch("/api/v1/users/me", headers=auth(user), json={"nickname": nickname})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "nickname" in res.json()["error"]["details"]


def test_update_me_409_taken(client, db):
    add_user(db, "route.owner@example.com", "Route_Taken")
    user = add_user(db, "route.want@example.com", "route_want")
    res = client.patch("/api/v1/users/me", headers=auth(user), json={"nickname": "route_taken"})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "NICKNAME_TAKEN"


def test_update_me_without_token(client):
    res = client.patch("/api/v1/users/me", json={"nickname": "nobody"})
    assert res.status_code == 401


# ── 42 POST · DELETE /users/me/profile-image ──

JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 100


@pytest.fixture
def storage(tmp_path, monkeypatch):
    """사진을 시험용 임시 폴더에 저장 (진짜 storage/ 를 건드리지 않음)."""
    monkeypatch.setattr(user_service, "get_settings", lambda: SimpleNamespace(storage_dir=tmp_path))
    return tmp_path


def post_photo(client, user, data=JPG, content_type="image/jpeg"):
    files = {"file": ("me.jpg", data, content_type)}
    return client.post("/api/v1/users/me/profile-image", headers=auth(user), files=files)


def test_upload_profile_image(client, db, storage):
    user = add_user(db, "route.photo@example.com", "route_photo")
    res = post_photo(client, user)

    assert res.status_code == 200
    url = res.json()["profile_image_url"]
    assert re.fullmatch(r"/api/v1/profile-images/[0-9a-f]{32}\.jpg", url)
    assert (storage / "profiles" / url.rsplit("/", 1)[1]).read_bytes() == JPG


@pytest.mark.parametrize(
    ("data", "content_type", "status", "code"),
    [
        (b"GIF89a" + b"\x00" * 20, "image/gif", 415, "UNSUPPORTED_FILE_TYPE"),
        (JPG + b"\x00" * (2 * 1024 * 1024), "image/jpeg", 413, "FILE_TOO_LARGE"),
    ],
    ids=["gif", "2MB 초과"],
)
def test_upload_profile_image_rejected(client, db, storage, data, content_type, status, code):
    user = add_user(db, "route.badphoto@example.com", "route_badphoto")
    res = post_photo(client, user, data, content_type)
    assert res.status_code == status
    assert res.json()["error"]["code"] == code


def test_upload_profile_image_no_file_field(client, db, storage):
    user = add_user(db, "route.nofile@example.com", "route_nofile")
    res = client.post(
        "/api/v1/users/me/profile-image", headers=auth(user), files={"photo": ("a.jpg", JPG)}
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_upload_profile_image_without_token(client, storage):
    files = {"file": ("a.jpg", JPG, "image/jpeg")}
    res = client.post("/api/v1/users/me/profile-image", files=files)
    assert res.status_code == 401
    assert not (storage / "profiles").exists()


def test_delete_profile_image_route(client, db, storage):
    user = add_user(db, "route.rmphoto@example.com", "route_rmphoto")
    name = post_photo(client, user).json()["profile_image_url"].rsplit("/", 1)[1]

    res = client.delete("/api/v1/users/me/profile-image", headers=auth(user))
    assert res.status_code == 200
    assert res.json()["profile_image_url"] is None
    assert not (storage / "profiles" / name).exists()

    again = client.delete("/api/v1/users/me/profile-image", headers=auth(user))  # 사진 없어도 200
    assert again.status_code == 200


def test_delete_profile_image_without_token(client):
    assert client.delete("/api/v1/users/me/profile-image").status_code == 401


# ── 43 GET /profile-images/{name} ──

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
WEBP = b"RIFF" + b"\x24\x00\x00\x00" + b"WEBPVP8 " + b"\x00" * 100


@pytest.mark.parametrize(
    ("data", "content_type", "media"),
    [(JPG, "image/jpeg", "image/jpeg"), (PNG, "image/png", "image/png"),
     (WEBP, "image/webp", "image/webp")],
    ids=["jpg", "png", "webp"],
)
def test_read_profile_image(client, db, storage, data, content_type, media):
    """올린 사진을 응답의 주소로 로그인 없이 열 수 있음."""
    user = add_user(db, "route.view@example.com", "route_view")
    url = post_photo(client, user, data, content_type).json()["profile_image_url"]

    res = client.get(url)  # 토큰 없음 (<img src> 처럼)
    assert res.status_code == 200
    assert res.content == data
    assert res.headers["content-type"] == media
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["cache-control"] == "public, max-age=86400"


@pytest.mark.parametrize(
    "name",
    ["0123456789abcdef0123456789abcdef.jpg", "..%2F..%2F.env", "NOT-A-PHOTO.jpg"],
    ids=["없는 이름", "상위 폴더", "모양 아님"],
)
def test_read_profile_image_404(client, storage, name):
    res = client.get(f"/api/v1/profile-images/{name}")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"
    # %2F 는 / 로 풀려 사진 주소와 맞지 않음 → 앱 공통 404 ("Not found.") — 이 함수까지 오지도 않음
    if "%2F" not in name:
        assert res.json()["error"]["message"] == "Image not found."


def test_read_profile_image_after_delete_or_withdraw(client, db, storage):
    me = add_user(db, "route.del@example.com", "route_del")
    url = post_photo(client, me).json()["profile_image_url"]
    client.delete("/api/v1/users/me/profile-image", headers=auth(me))
    assert client.get(url).status_code == 404  # 지운 사진

    gone = add_user(db, "route.gone@example.com", "route_gone")
    url = post_photo(client, gone).json()["profile_image_url"]
    gone.status = UserStatus.DELETED
    db.flush()
    assert client.get(url).status_code == 404  # 탈퇴한 회원


def test_read_profile_image_old_user_id_url_gone(client, db):
    """템플릿의 회원 번호 주소는 열리지 않음."""
    user = add_user(db, "route.old@example.com", "route_old_url")
    assert client.get(f"/api/v1/users/{user.user_id}/profile-image").status_code in (404, 405)


# ── 47 PUT /users/me/password (P1-09) ──


def put_password(client, user, current, new):
    body = {"current_password": current, "new_password": new}
    return client.put("/api/v1/users/me/password", headers=auth(user), json=body)


def pw_user(db, email, nickname):
    return add_user(db, email, nickname, password_hash=hash_password("Abcdef1!"))


def test_change_password_204(client, db):
    user = pw_user(db, "route.pw@example.com", "route_pw")
    res = put_password(client, user, "Abcdef1!", "Newpass9#")

    assert res.status_code == 204
    assert res.content == b""
    login = client.post(
        "/api/v1/auth/login", json={"email": "route.pw@example.com", "password": "Newpass9#"}
    )
    assert login.status_code == 200  # 새 비밀번호로 로그인
    old = client.post(
        "/api/v1/auth/login", json={"email": "route.pw@example.com", "password": "Abcdef1!"}
    )
    assert old.status_code == 401  # 옛 비밀번호는 안 됨


def test_change_password_wrong_current_400(client, db):
    """400 (401 아님) — 화면이 로그아웃되지 않게."""
    user = pw_user(db, "route.pwbad@example.com", "route_pwbad")
    res = put_password(client, user, "Abcdef1?", "Newpass9#")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "WRONG_PASSWORD"
    assert res.json()["error"]["message"] == "Password is incorrect."


@pytest.mark.parametrize(
    ("new", "message", "details"),
    [
        ("abcdefgh", "Check the password requirements.", ["upper", "number", "special"]),
        ("Abcdef1!", "Use a different password.", "same_as_current"),
    ],
    ids=["규칙", "지금과 같음"],
)
def test_change_password_422(client, db, new, message, details):
    user = pw_user(db, "route.pw422@example.com", "route_pw422")
    res = put_password(client, user, "Abcdef1!", new)
    assert res.status_code == 422
    assert res.json()["error"]["message"] == message
    assert res.json()["error"]["details"] == {"new_password": details}


def test_change_password_schema_422(client, db):
    user = pw_user(db, "route.pwempty@example.com", "route_pwempty")
    res = put_password(client, user, "", "Newpass9#")
    assert res.status_code == 422
    assert "current_password" in res.json()["error"]["details"]


def test_change_password_without_token(client):
    body = {"current_password": "Abcdef1!", "new_password": "Newpass9#"}
    assert client.put("/api/v1/users/me/password", json=body).status_code == 401


# ── 48 DELETE /users/me (P1-09) ──


def login(client, email, password="Abcdef1!"):
    body = {"email": email, "password": password, "remember": True}
    res = client.post("/api/v1/auth/login", json=body)
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def delete_me(client, headers, body):
    return client.request("DELETE", "/api/v1/users/me", headers=headers, json=body)


def test_withdraw_204(client, db, storage):
    user = pw_user(db, "route.bye@example.com", "route_bye")
    headers = login(client, "route.bye@example.com")  # 리프레시 쿠키도 받음
    name = post_photo(client, user).json()["profile_image_url"].rsplit("/", 1)[1]
    assert client.post("/api/v1/auth/refresh").status_code == 200  # 탈퇴 전에는 재발급 됨

    res = delete_me(client, headers, {"password": "Abcdef1!"})
    assert res.status_code == 204
    assert res.content == b""
    cookie = res.headers["set-cookie"]
    assert cookie.startswith("snx_refresh=")
    assert "Max-Age=0" in cookie and "Path=/api/v1/auth" in cookie

    assert client.get("/api/v1/users/me", headers=headers).status_code == 401  # 남은 Access Token
    assert client.post("/api/v1/auth/refresh").status_code == 401  # 쿠키 지워짐
    body = {"email": "route.bye@example.com", "password": "Abcdef1!"}
    again = client.post("/api/v1/auth/login", json=body)
    assert again.status_code == 401
    assert client.get(f"/api/v1/profile-images/{name}").status_code == 404
    assert db.scalar(select(User.status).where(User.user_id == user.user_id)) == UserStatus.DELETED


def test_withdraw_wrong_password_400(client, db):
    pw_user(db, "route.stay@example.com", "route_stay")
    headers = login(client, "route.stay@example.com")

    res = delete_me(client, headers, {"password": "Abcdef1?"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "WRONG_PASSWORD"
    assert "set-cookie" not in res.headers  # 쿠키는 그대로
    assert client.get("/api/v1/users/me", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/refresh").status_code == 200


@pytest.mark.parametrize(
    "body", [None, {}, {"password": ""}], ids=["본문 없음", "칸 없음", "빈 글자"]
)
def test_withdraw_422(client, db, body):
    user = pw_user(db, "route.empty.bye@example.com", "route_emptybye")
    res = delete_me(client, auth(user), body)
    assert res.status_code == 422
    assert db.scalar(select(User.status).where(User.user_id == user.user_id)) == UserStatus.ACTIVE


def test_withdraw_without_token(client):
    assert delete_me(client, {}, {"password": "Abcdef1!"}).status_code == 401
