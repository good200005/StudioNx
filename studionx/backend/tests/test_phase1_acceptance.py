"""P1-18 Phase 1 완료 기준 시험 (PRD 01 §10) — 실제 앱과 실제 MySQL, 시험마다 되돌림.

작업마다 만든 시험이 이미 많아서, 여기서는 **완료 기준이 한 흐름으로 이어지는지**와
**기존 시험에 빠져 있던 곳**을 묶음 단위로 채운다. 묶음마다 문서 61번의 대응표에 짝이 있다.

  묶음 A  가입 → 로그인 → 마이페이지, 비밀번호 평문 저장 금지, 중복 가입
  묶음 B  다른 회원의 프로젝트 차단 (이 파일 아래쪽에 이어서 추가)
  묶음 C  탈퇴한 계정 (이 파일 아래쪽에 이어서 추가)
"""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select

from app.core.security import verify_password
from app.db.session import get_db
from app.main import app
from app.models import ProjectMember, User
from app.schemas.auth import PRIVACY_VERSION

API = "/api/v1"
PASSWORD = "Abcdef1!"


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db  # 앱이 시험용 세션을 쓰게 함
    yield TestClient(app)
    app.dependency_overrides.clear()


def signup_body(name, **fields):
    values = {
        "email": f"{name}@example.com",
        "nickname": f"{name}_nick",
        "password": PASSWORD,
        "privacy_agreed": True,
        "privacy_version": PRIVACY_VERSION,
    }
    values.update(fields)
    return values


def sign_up(client, name, **fields):
    return client.post(f"{API}/auth/signup", json=signup_body(name, **fields))


def log_in(client, name, password=PASSWORD, remember=False):
    body = {"email": f"{name}@example.com", "password": password, "remember": remember}
    return client.post(f"{API}/auth/login", json=body)


def bearer(res):
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


# ══════════════════════════════════════════════════════════════
# 묶음 A  가입 → 로그인 → 마이페이지
# ══════════════════════════════════════════════════════════════


def test_a1_signup_login_my_page_one_flow(client, db):
    """완료 기준 1: 회원가입 → 로그인 → 마이페이지 진입이 정상 동작한다."""
    res = sign_up(client, "acc_flow")
    assert res.status_code == 201
    user_id = res.json()["user_id"]

    login = log_in(client, "acc_flow")
    assert login.status_code == 200
    headers = bearer(login)

    me = client.get(f"{API}/users/me", headers=headers)
    assert me.status_code == 200 and me.json()["email"] == "acc_flow@example.com"

    dash = client.get(f"{API}/me/dashboard", headers=headers)  # 마이페이지가 부르는 API
    assert dash.status_code == 200
    body = dash.json()
    assert body["user"]["nickname"] == "acc_flow_nick"
    assert body["recent_projects"] == [] and body["ready_projects"] == []
    assert body["storage"]["used_bytes"] == 0

    created = client.post(f"{API}/projects", json={"title": "My First"}, headers=headers)
    assert created.status_code == 201
    dash = client.get(f"{API}/me/dashboard", headers=headers).json()
    assert [p["title"] for p in dash["recent_projects"]] == ["My First"]
    assert [p["title"] for p in dash["ready_projects"]] == ["My First"]

    # 로그인 때 받은 쿠키로 새 Access Token 을 받을 수 있음 (브라우저를 다시 열었을 때)
    again = client.post(f"{API}/auth/refresh")
    assert again.status_code == 200
    assert client.get(f"{API}/users/me", headers=bearer(again)).json()["user_id"] == user_id


def test_a2_dashboard_and_me_need_login(client):
    """로그인하지 않으면 마이페이지의 API 가 열리지 않는다 (화면은 로그인 모달로 보냄)."""
    for path in ("/users/me", "/me/dashboard", "/projects"):
        res = client.get(f"{API}{path}")
        assert res.status_code == 401, path
        assert res.json()["error"]["code"] == "UNAUTHORIZED"


def test_a3_password_is_never_stored_in_plain_text(client, db):
    """완료 기준 3: DB에 비밀번호가 평문으로 저장되지 않는다."""
    res = sign_up(client, "acc_plain")
    user = db.get(User, res.json()["user_id"])

    assert user.password_hash != PASSWORD
    assert user.password_hash.startswith("$2") and len(user.password_hash) == 60  # bcrypt 모양
    assert verify_password(PASSWORD, user.password_hash)
    assert not verify_password("Abcdef1?", user.password_hash)

    # 어느 칸에도 평문이 들어 있지 않음
    for column in inspect(User).columns:
        value = getattr(user, column.key)
        assert PASSWORD not in str(value), column.key

    # 같은 비밀번호로 가입해도 해시는 다름 (소금)
    other = db.get(User, sign_up(client, "acc_plain2").json()["user_id"])
    assert other.password_hash != user.password_hash

    # 응답 어디에도 비밀번호나 해시가 없음
    assert PASSWORD not in res.text and "password" not in res.text
    login = log_in(client, "acc_plain")
    assert PASSWORD not in login.text and user.password_hash not in login.text


def test_a4_duplicate_email_and_nickname_cannot_sign_up(client, db):
    """완료 기준 2: 중복 이메일/닉네임으로는 가입할 수 없다 (실제 요청으로)."""
    assert sign_up(client, "acc_dup").status_code == 201

    same_email = sign_up(client, "acc_dup", nickname="another_nick")
    assert same_email.status_code == 409 and same_email.json()["error"]["code"] == "EMAIL_TAKEN"

    case_email = sign_up(client, "x", email="ACC_DUP@Example.COM", nickname="third_nick")
    assert case_email.status_code == 409 and case_email.json()["error"]["code"] == "EMAIL_TAKEN"

    same_nick = sign_up(client, "acc_dup_two", nickname="acc_dup_nick")
    assert same_nick.status_code == 409 and same_nick.json()["error"]["code"] == "NICKNAME_TAKEN"

    case_nick = sign_up(client, "acc_dup_three", nickname="ACC_DUP_NICK")
    assert case_nick.status_code == 409 and case_nick.json()["error"]["code"] == "NICKNAME_TAKEN"

    count = db.scalar(select(func.count()).select_from(User).where(User.email.like("acc_dup%")))
    assert count == 1  # 거절된 가입은 행을 남기지 않음


def test_a5_signup_creates_no_project_member_rows(client, db):
    """가입만으로는 프로젝트나 멤버 행이 생기지 않는다 (프로젝트는 만들 때 생김)."""
    user_id = sign_up(client, "acc_empty").json()["user_id"]
    rows = db.scalar(
        select(func.count()).select_from(ProjectMember).where(ProjectMember.user_id == user_id)
    )
    assert rows == 0


def test_a6_login_keeps_signup_account_and_updates_last_login(client, db):
    user_id = sign_up(client, "acc_last").json()["user_id"]
    assert db.get(User, user_id).last_login_at is None
    before = datetime.now(UTC).replace(tzinfo=None)
    assert log_in(client, "acc_last").status_code == 200
    db.expire_all()
    last = db.get(User, user_id).last_login_at
    assert last is not None and abs((last - before).total_seconds()) < 60  # UTC 로 기록됨


# ══════════════════════════════════════════════════════════════
# 묶음 B  다른 회원의 프로젝트 차단 (완료 기준 10)
#   소유자와 관계없는 회원이 같은 서버에 로그인해 있는 상황을 실제 요청으로 만든다.
# ══════════════════════════════════════════════════════════════

PROJECTS = f"{API}/projects"


def member_headers(client, name):
    """가입 → 로그인해서 Authorization 헤더를 돌려준다."""
    assert sign_up(client, name).status_code == 201
    return bearer(log_in(client, name))


@pytest.fixture
def two_users(client):
    """소유자(owner)와 관계없는 회원(stranger), 그리고 소유자의 프로젝트."""
    owner = member_headers(client, "acc_owner")
    stranger = member_headers(client, "acc_stranger")
    created = client.post(
        PROJECTS, json={"title": "Secret Song", "description": "private"}, headers=owner
    )
    assert created.status_code == 201
    return owner, stranger, created.json()["project_id"]


def assert_project_not_found(res):
    assert res.status_code == 404
    error = res.json()["error"]
    assert (error["code"], error["message"]) == ("NOT_FOUND", "Project not found.")
    assert "Secret Song" not in res.text and "private" not in res.text  # 내용이 새지 않음


def test_b1_stranger_cannot_read_update_or_delete(client, two_users):
    owner, stranger, pid = two_users
    url = f"{PROJECTS}/{pid}"

    assert_project_not_found(client.get(url, headers=stranger))
    assert_project_not_found(client.patch(url, json={"title": "Hacked"}, headers=stranger))
    assert_project_not_found(client.delete(url, headers=stranger))

    # 소유자의 프로젝트는 그대로
    mine = client.get(url, headers=owner)
    assert mine.status_code == 200
    assert (mine.json()["title"], mine.json()["description"]) == ("Secret Song", "private")
    assert client.get(PROJECTS, headers=owner).json()["total"] == 1


def test_b2_foreign_project_looks_exactly_like_a_missing_one(client, two_users):
    """남의 프로젝트와 없는 번호의 응답이 같아서, 번호로 존재 여부를 알아낼 수 없다."""
    _, stranger, pid = two_users
    for send in (
        lambda u: client.get(u, headers=stranger),
        lambda u: client.patch(u, json={"title": "x"}, headers=stranger),
        lambda u: client.delete(u, headers=stranger),
    ):
        foreign = send(f"{PROJECTS}/{pid}")
        missing = send(f"{PROJECTS}/999999999")
        assert (foreign.status_code, foreign.json()) == (missing.status_code, missing.json())


def test_b3_invalid_body_does_not_reveal_existence_either(client, two_users):
    _, stranger, pid = two_users
    foreign = client.patch(f"{PROJECTS}/{pid}", json={"title": None}, headers=stranger)
    missing = client.patch(f"{PROJECTS}/999999999", json={"title": None}, headers=stranger)
    assert foreign.status_code == missing.status_code == 422


def test_b4_stranger_list_search_and_dashboard_show_nothing(client, two_users):
    owner, stranger, _ = two_users
    listed = client.get(PROJECTS, headers=stranger).json()
    assert listed["total"] == 0 and listed["items"] == []

    found = client.get(PROJECTS, params={"q": "Secret"}, headers=stranger).json()
    assert found["total"] == 0  # 제목을 정확히 알아도 검색에 나오지 않음

    dash = client.get(f"{API}/me/dashboard", headers=stranger).json()
    assert dash["recent_projects"] == [] and dash["ready_projects"] == []

    # 소유자에게는 그대로 보임
    assert client.get(PROJECTS, params={"q": "Secret"}, headers=owner).json()["total"] == 1


def test_b5_own_projects_stay_separate_per_user(client, two_users):
    owner, stranger, pid = two_users
    other = client.post(PROJECTS, json={"title": "Stranger Song"}, headers=stranger).json()
    assert other["project_id"] != pid

    assert [p["title"] for p in client.get(PROJECTS, headers=owner).json()["items"]] == [
        "Secret Song"
    ]
    assert [p["title"] for p in client.get(PROJECTS, headers=stranger).json()["items"]] == [
        "Stranger Song"
    ]
    # 서로의 프로젝트는 번호를 알아도 열리지 않음
    assert client.get(f"{PROJECTS}/{other['project_id']}", headers=owner).status_code == 404
    assert client.get(f"{PROJECTS}/{pid}", headers=stranger).status_code == 404


def test_b6_no_or_bad_token_gets_401_not_404(client, two_users):
    owner, _, pid = two_users
    url = f"{PROJECTS}/{pid}"
    refresh_like = {"Authorization": "Bearer not.a.token"}
    for headers in ({}, refresh_like):
        assert client.get(url, headers=headers).status_code == 401
        assert client.patch(url, json={"title": "x"}, headers=headers).status_code == 401
        assert client.delete(url, headers=headers).status_code == 401
        assert client.get(PROJECTS, headers=headers).status_code == 401
    assert client.get(url, headers=owner).status_code == 200  # 소유자는 그대로


def test_b7_refresh_token_cannot_open_projects(client, two_users):
    """리프레시 쿠키 값을 Access Token 처럼 써도 프로젝트 API 는 열리지 않는다."""
    _, _, pid = two_users
    token = client.cookies.get("snx_refresh")
    assert token  # 로그인한 마지막 회원의 쿠키
    res = client.get(f"{PROJECTS}/{pid}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_b8_membership_decides_access_and_removing_it_closes_it(client, db, two_users):
    owner, stranger, pid = two_users
    stranger_id = client.get(f"{API}/users/me", headers=stranger).json()["user_id"]
    url = f"{PROJECTS}/{pid}"

    db.add(ProjectMember(project_id=pid, user_id=stranger_id, role="VIEWER"))
    db.flush()
    seen = client.get(url, headers=stranger)
    assert seen.status_code == 200 and seen.json()["my_role"] == "VIEWER"
    assert client.get(PROJECTS, headers=stranger).json()["total"] == 1
    assert client.patch(url, json={"title": "x"}, headers=stranger).status_code == 403  # 보기만

    db.query(ProjectMember).filter_by(project_id=pid, user_id=stranger_id).delete()
    db.flush()
    assert_project_not_found(client.get(url, headers=stranger))  # 멤버가 아니면 다시 안 보임
    assert client.get(PROJECTS, headers=stranger).json()["total"] == 0


def test_b9_deleted_project_is_gone_for_everyone(client, two_users):
    owner, stranger, pid = two_users
    url = f"{PROJECTS}/{pid}"
    assert client.delete(url, headers=owner).status_code == 204
    assert client.get(url, headers=owner).status_code == 404
    assert client.get(url, headers=stranger).status_code == 404
    assert client.get(f"{API}/me/dashboard", headers=owner).json()["recent_projects"] == []


# ══════════════════════════════════════════════════════════════
# 묶음 C  탈퇴한 계정 (완료 기준 7)
#   탈퇴 → 모든 문이 닫힘 → 3일 안에는 같은 이메일, 닉네임으로 가입 불가 → 3일 뒤에는 가능
# ══════════════════════════════════════════════════════════════


def withdraw(client, headers, password=PASSWORD):
    return client.request("DELETE", f"{API}/users/me", headers=headers, json={"password": password})


def set_deleted_ago(db, user_id, **ago):
    """탈퇴한 시각을 과거로 돌린다 (3일 규칙 시험용)."""
    user = db.get(User, user_id)
    user.deleted_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(**ago)
    db.flush()
    db.expire_all()


@pytest.fixture
def withdrawn(client, db):
    """가입 → 로그인 → 프로젝트 하나 → 탈퇴한 회원. (user_id, 탈퇴 전 헤더, project_id)"""
    headers = member_headers(client, "acc_gone")
    user_id = client.get(f"{API}/users/me", headers=headers).json()["user_id"]
    pid = client.post(PROJECTS, json={"title": "Left Behind"}, headers=headers).json()["project_id"]
    res = withdraw(client, headers)
    assert res.status_code == 204
    return user_id, headers, pid


def test_c1_withdrawn_account_is_locked_out_everywhere(client, withdrawn):
    user_id, old_headers, pid = withdrawn

    # 탈퇴 전에 받아 둔 Access Token 은 남아 있어도 어느 문도 열지 못함
    for method, path in (
        ("GET", "/users/me"),
        ("GET", "/me/dashboard"),
        ("GET", "/projects"),
        ("GET", f"/projects/{pid}"),
    ):
        res = client.request(method, f"{API}{path}", headers=old_headers)
        assert res.status_code == 401, path
    assert (
        client.post(f"{API}/projects", json={"title": "x"}, headers=old_headers).status_code == 401
    )
    assert (
        client.patch(
            f"{API}/users/me", json={"nickname": "newnick"}, headers=old_headers
        ).status_code
        == 401
    )
    assert client.post(f"{API}/auth/refresh").status_code == 401  # 쿠키도 지워짐


def test_c2_login_after_withdrawal_looks_like_wrong_password(client, withdrawn):
    """탈퇴한 계정이었다는 사실도 알려 주지 않는다 (없는 이메일, 틀린 비밀번호와 같은 응답)."""
    gone = log_in(client, "acc_gone")
    unknown = log_in(client, "acc_never_existed")
    assert gone.status_code == unknown.status_code == 401
    assert gone.json() == unknown.json()
    assert gone.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert "snx_refresh" not in gone.headers.get("set-cookie", "")


def test_c3_withdraw_needs_right_password_and_changes_nothing_otherwise(client, db):
    headers = member_headers(client, "acc_stay")
    wrong = withdraw(client, headers, "Wrong1!pass")
    assert wrong.status_code == 400 and wrong.json()["error"]["code"] == "WRONG_PASSWORD"
    assert client.get(f"{API}/users/me", headers=headers).status_code == 200  # 그대로 로그인 상태
    assert log_in(client, "acc_stay").status_code == 200


def test_c4_email_and_nickname_are_kept_right_after_withdrawal(client, db, withdrawn):
    user_id, _, _ = withdrawn
    user = db.get(User, user_id)
    assert user.status.value == "DELETED" and user.deleted_at is not None
    assert (user.email, user.nickname) == ("acc_gone@example.com", "acc_gone_nick")  # 바꾸지 않음


def test_c5_cannot_rejoin_within_3_days(client, db, withdrawn):
    check = client.get(f"{API}/auth/check-email", params={"email": "acc_gone@example.com"}).json()
    assert check["available"] is False and check["reason"] == "REJOIN_TOO_SOON"
    assert check["available_at"]  # 언제부터 가능한지 알려 줌

    again = sign_up(client, "acc_gone", nickname="fresh_nick")
    assert again.status_code == 409 and again.json()["error"]["code"] == "REJOIN_TOO_SOON"
    assert again.json()["error"]["details"]["available_at"]

    same_nick = sign_up(client, "someone_else", nickname="acc_gone_nick")
    assert same_nick.status_code == 409
    assert same_nick.json()["error"]["code"] == "REJOIN_TOO_SOON"


def test_c6_3_day_boundary_is_exact(client, db, withdrawn):
    user_id, _, _ = withdrawn
    set_deleted_ago(db, user_id, days=2, hours=23, minutes=59)  # 1분 모자람
    assert sign_up(client, "acc_gone", nickname="fresh_a").status_code == 409
    set_deleted_ago(db, user_id, days=3, minutes=1)  # 1분 지남
    assert sign_up(client, "acc_gone", nickname="fresh_b").status_code == 201


def test_c7_after_3_days_same_email_and_nickname_can_sign_up_again(client, db, withdrawn):
    old_id, _, pid = withdrawn
    set_deleted_ago(db, old_id, days=4)

    check = client.get(f"{API}/auth/check-email", params={"email": "acc_gone@example.com"}).json()
    assert check["available"] is True
    assert db.get(User, old_id).email == "acc_gone@example.com"  # 확인만 하고 DB 는 안 바꿈

    again = sign_up(client, "acc_gone", password="Newpass1!x")
    assert again.status_code == 201
    new_id = again.json()["user_id"]
    assert new_id != old_id  # 새 계정

    db.expire_all()
    old = db.get(User, old_id)
    assert old.status.value == "DELETED"  # 예전 행은 남음
    assert old.email == f"deleted+{old_id}@withdrawn.invalid"  # 이름을 비워 줌
    assert old.nickname.startswith("deleted_user_")

    # 새 계정은 예전 계정의 것을 물려받지 않음
    new_headers = bearer(log_in(client, "acc_gone", password="Newpass1!x"))
    assert client.get(PROJECTS, headers=new_headers).json()["total"] == 0
    assert client.get(f"{PROJECTS}/{pid}", headers=new_headers).status_code == 404
    # 예전 비밀번호로는 새 계정에 들어갈 수 없음
    assert log_in(client, "acc_gone").status_code == 401


def test_c8_projects_of_a_withdrawn_owner_stay_for_other_members(client, db, withdrawn):
    """내가 OWNER 인 프로젝트는 그대로 남는다 (2026-10-03 결정): 다른 멤버는 계속 쓸 수 있음."""
    owner_id, _, pid = withdrawn
    helper = member_headers(client, "acc_helper")
    helper_id = client.get(f"{API}/users/me", headers=helper).json()["user_id"]
    db.add(ProjectMember(project_id=pid, user_id=helper_id, role="EDITOR"))
    db.flush()

    seen = client.get(f"{PROJECTS}/{pid}", headers=helper)
    assert seen.status_code == 200 and seen.json()["title"] == "Left Behind"
    assert (
        client.patch(f"{PROJECTS}/{pid}", json={"title": "Carried On"}, headers=helper).status_code
        == 200
    )
    assert [p["title"] for p in client.get(PROJECTS, headers=helper).json()["items"]] == [
        "Carried On"
    ]
    assert "acc_gone" not in seen.text  # 탈퇴한 소유자의 이메일, 닉네임이 보이지 않음
