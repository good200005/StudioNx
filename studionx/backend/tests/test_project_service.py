"""프로젝트 서비스 (services/project_service.py, P1-13)."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError

from app.core.errors import AppError, ErrorCode
from app.models import Project, ProjectMember, ProjectSession, Track, User
from app.models.project import MemberRole
from app.schemas.project import ProjectCreateRequest, ProjectSort, ProjectUpdateRequest
from app.services import project_service
from app.services.project_service import (
    create_project,
    delete_project,
    get_membership,
    list_projects,
    require_role,
    to_item,
    update_project,
)


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_ps",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-08",
    )
    db.add(user)
    db.flush()
    return user


def add_project(db, owner, role=MemberRole.OWNER):
    project = Project(owner_id=owner.user_id, title="Band Song")
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.project_id, user_id=owner.user_id, role=role))
    db.flush()
    return project


def assert_404(db, project_id, user):
    with pytest.raises(AppError) as err:
        get_membership(db, project_id, user)
    assert err.value.status_code == 404
    assert err.value.code == ErrorCode.NOT_FOUND
    assert err.value.message == "Project not found."


# ── 57 get_membership ──

def test_get_membership_returns_project_and_member(db):
    owner = add_user(db, "gm_owner")
    project = add_project(db, owner)
    got_project, member = get_membership(db, project.project_id, owner)
    assert got_project is project
    assert (member.project_id, member.user_id) == (project.project_id, owner.user_id)
    assert member.role == MemberRole.OWNER


def test_get_membership_editor_member(db):
    owner = add_user(db, "gm_owner2")
    editor = add_user(db, "gm_editor")
    project = add_project(db, owner)
    db.add(ProjectMember(project_id=project.project_id, user_id=editor.user_id, role="EDITOR"))
    db.flush()
    _, member = get_membership(db, project.project_id, editor)
    assert member.role == MemberRole.EDITOR


def test_get_membership_no_such_project(db):
    assert_404(db, 999_999_999, add_user(db, "gm_nobody"))


def test_get_membership_others_project_is_404_not_403(db):
    project = add_project(db, add_user(db, "gm_owner3"))
    assert_404(db, project.project_id, add_user(db, "gm_stranger"))


def test_get_membership_deleted_project(db):
    owner = add_user(db, "gm_owner4")
    project = add_project(db, owner)
    project.deleted_at = datetime.now(UTC).replace(tzinfo=None)
    db.flush()
    assert_404(db, project.project_id, owner)  # 주인이어도 404


# ── 57 require_role ──

@pytest.mark.parametrize(
    ("role", "allowed"),
    [
        ("OWNER", ("OWNER",)),
        ("OWNER", ("OWNER", "EDITOR")),
        ("EDITOR", ("OWNER", "EDITOR")),
        ("VIEWER", ("OWNER", "EDITOR", "VIEWER")),
    ],
)
def test_require_role_passes(role, allowed):
    assert require_role(ProjectMember(role=MemberRole(role)), *allowed) is None


@pytest.mark.parametrize(
    ("role", "allowed"),
    [
        ("EDITOR", ("OWNER",)),
        ("VIEWER", ("OWNER",)),
        ("VIEWER", ("OWNER", "EDITOR")),
    ],
)
def test_require_role_forbidden(role, allowed):
    with pytest.raises(AppError) as err:
        require_role(ProjectMember(role=MemberRole(role)), *allowed)
    assert err.value.status_code == 403
    assert err.value.code == ErrorCode.FORBIDDEN
    assert err.value.message == "You don't have permission."


# ── 58 to_item · list_projects ──

def at(day):
    return datetime(2026, 10, day, 12, 0, 0)


def add_titled(db, owner, title, created, updated):
    project = Project(
        owner_id=owner.user_id, title=title, created_at=at(created), updated_at=at(updated)
    )
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.project_id, user_id=owner.user_id, role="OWNER"))
    db.flush()
    return project


def titles(result):
    return [item.title for item in result.items]


def test_to_item_counts_members_and_opened(db):
    owner = add_user(db, "ti_owner")
    other = add_user(db, "ti_other")
    project = add_project(db, owner)
    db.add(ProjectMember(project_id=project.project_id, user_id=other.user_id, role="VIEWER"))
    db.flush()
    _, member = get_membership(db, project.project_id, owner)
    item = to_item(db, project, member)
    assert (item.my_role, item.member_count, item.opened) == ("OWNER", 2, False)

    db.add(ProjectSession(project_id=project.project_id, user_id=other.user_id))
    db.flush()
    assert to_item(db, project, member).opened is False  # 다른 사람이 연 것은 세지 않음
    db.add(ProjectSession(project_id=project.project_id, user_id=owner.user_id))
    db.flush()
    assert to_item(db, project, member).opened is True


def test_to_item_uses_given_values(db):
    owner = add_user(db, "ti_given")
    project = add_project(db, owner)
    _, member = get_membership(db, project.project_id, owner)
    item = to_item(db, project, member, member_count=7, opened=True)
    assert (item.member_count, item.opened) == (7, True)
    assert item.title == "Band Song" and item.bpm == 120 and item.time_sig_den == 4


@pytest.fixture
def three(db):
    owner = add_user(db, "lp_owner")
    add_titled(db, owner, "Beta", created=1, updated=5)
    add_titled(db, owner, "alpha", created=2, updated=3)
    add_titled(db, owner, "Gamma", created=3, updated=4)
    return owner


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        (ProjectSort.UPDATED, ["Beta", "Gamma", "alpha"]),
        (ProjectSort.TITLE, ["alpha", "Beta", "Gamma"]),
        (ProjectSort.CREATED, ["Gamma", "alpha", "Beta"]),
    ],
)
def test_list_sort(db, three, sort, expected):
    result = list_projects(db, three, "", sort, 1, 10)
    assert titles(result) == expected
    assert (result.total, result.page, result.size) == (3, 1, 10)


def test_list_same_value_newest_first(db):
    owner = add_user(db, "lp_tie")
    first = add_titled(db, owner, "Same", created=1, updated=1)
    second = add_titled(db, owner, "Same", created=1, updated=1)
    result = list_projects(db, owner, "", ProjectSort.UPDATED, 1, 10)
    assert [i.project_id for i in result.items] == [second.project_id, first.project_id]


def test_list_paging(db, three):
    page1 = list_projects(db, three, "", ProjectSort.TITLE, 1, 2)
    page2 = list_projects(db, three, "", ProjectSort.TITLE, 2, 2)
    page3 = list_projects(db, three, "", ProjectSort.TITLE, 3, 2)
    assert (titles(page1), titles(page2), titles(page3)) == (["alpha", "Beta"], ["Gamma"], [])
    assert page1.total == page2.total == page3.total == 3


def test_list_search_ignores_case(db, three):
    result = list_projects(db, three, "ALP", ProjectSort.TITLE, 1, 10)
    assert titles(result) == ["alpha"] and result.total == 1


@pytest.mark.parametrize(("query", "expected"), [("%", ["100% Mix"]), ("_", ["my_song"])])
def test_list_search_special_chars_literal(db, query, expected):
    owner = add_user(db, "lp_like")
    add_titled(db, owner, "100% Mix", created=1, updated=1)
    add_titled(db, owner, "my_song", created=1, updated=2)
    add_titled(db, owner, "Plain", created=1, updated=3)
    assert titles(list_projects(db, owner, query, ProjectSort.TITLE, 1, 10)) == expected


def test_list_only_mine_and_not_deleted(db):
    me = add_user(db, "lp_me")
    other = add_user(db, "lp_other")
    add_titled(db, me, "Mine", created=1, updated=1)
    deleted = add_titled(db, me, "Deleted", created=1, updated=2)
    deleted.deleted_at = at(6)
    add_titled(db, other, "Theirs", created=1, updated=3)
    shared = add_titled(db, other, "Shared", created=1, updated=4)
    db.add(ProjectMember(project_id=shared.project_id, user_id=me.user_id, role="EDITOR"))
    db.flush()
    result = list_projects(db, me, "", ProjectSort.UPDATED, 1, 10)
    assert titles(result) == ["Shared", "Mine"] and result.total == 2
    shared_item = result.items[0]
    assert (shared_item.my_role, shared_item.member_count) == ("EDITOR", 2)


def test_list_opened_only_by_me(db):
    me = add_user(db, "lp_open")
    opened = add_titled(db, me, "Opened", created=1, updated=2)
    add_titled(db, me, "New", created=1, updated=1)
    db.add(ProjectSession(project_id=opened.project_id, user_id=me.user_id))
    db.flush()
    result = list_projects(db, me, "", ProjectSort.UPDATED, 1, 10)
    assert [(i.title, i.opened) for i in result.items] == [("Opened", True), ("New", False)]


def test_list_empty(db):
    result = list_projects(db, add_user(db, "lp_empty"), "", ProjectSort.UPDATED, 1, 10)
    assert (result.items, result.total) == ([], 0)


# ── 59 create_project ──

def count_owned(db, user):
    return db.scalar(
        select(func.count()).select_from(Project).where(Project.owner_id == user.user_id)
    )


def test_create_project_saves_three_rows(db):
    user = add_user(db, "cp_user")
    data = ProjectCreateRequest(
        title="  New Song ", description="demo", bpm="128.5", time_sig_num=7, time_sig_den=8
    )
    project = create_project(db, user, data)
    assert project.project_id is not None
    assert (project.owner_id, project.title, project.description) == (
        user.user_id, "New Song", "demo"
    )
    assert (project.bpm, project.time_sig_num, project.time_sig_den) == (Decimal("128.50"), 7, 8)
    assert project.created_at is not None and project.updated_at is not None
    assert project.deleted_at is None and project.revision == 0  # DB 기본값

    member = db.get(ProjectMember, (project.project_id, user.user_id))
    assert member.role == MemberRole.OWNER
    tracks = db.scalars(select(Track).where(Track.project_id == project.project_id)).all()
    assert [(t.name, t.track_type, t.order_index) for t in tracks] == [("Master", "MASTER", 0)]


def test_create_project_defaults(db):
    user = add_user(db, "cp_default")
    project = create_project(db, user, ProjectCreateRequest(title="Song"))
    assert (project.description, project.bpm) == (None, Decimal("120.00"))
    assert (project.time_sig_num, project.time_sig_den) == (4, 4)


def test_create_project_shows_in_list_and_item(db):
    user = add_user(db, "cp_list")
    project = create_project(db, user, ProjectCreateRequest(title="Listed"))
    result = list_projects(db, user, "", ProjectSort.UPDATED, 1, 10)
    assert [(i.title, i.my_role, i.member_count, i.opened) for i in result.items] == [
        ("Listed", "OWNER", 1, False)
    ]
    _, member = get_membership(db, project.project_id, user)
    assert to_item(db, project, member).member_count == 1


def test_create_project_rolls_back_all_on_failure(db, monkeypatch):
    user = add_user(db, "cp_fail")
    db.commit()  # 회원은 먼저 확정 — rollback 이 프로젝트 쪽만 되돌리는지 보려고
    # 트랙 이름을 101자로 → 마지막 INSERT(트랙)에서 DB 오류 (프로젝트 · 멤버는 이미 보낸 뒤)
    monkeypatch.setattr(project_service, "MASTER_TRACK_NAME", "x" * 101)
    with pytest.raises(DBAPIError):
        create_project(db, user, ProjectCreateRequest(title="Broken"))
    assert count_owned(db, user) == 0
    members = db.scalar(
        select(func.count()).select_from(ProjectMember).where(ProjectMember.user_id == user.user_id)
    )
    assert members == 0
    assert db.get(User, user.user_id) is not None  # 앞서 확정한 회원은 그대로


# ── 60 update_project ──

@pytest.fixture
def editable(db):
    """설명이 있고 수정 시각이 오래된(10월 1일) 프로젝트 + 주인."""
    owner = add_user(db, "up_owner")
    project = Project(
        owner_id=owner.user_id, title="Old Title", description="old desc",
        created_at=at(1), updated_at=at(1),
    )
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.project_id, user_id=owner.user_id, role="OWNER"))
    db.flush()
    return owner, project


def update(db, user, project, **body):
    _, member = get_membership(db, project.project_id, user)
    return update_project(db, project, member, ProjectUpdateRequest(**body))


def test_update_title_only_keeps_description(db, editable):
    owner, project = editable
    updated = update(db, owner, project, title="  New Title ")
    assert (updated.title, updated.description) == ("New Title", "old desc")
    assert updated.updated_at > at(1)  # DB 가 갱신


def test_update_description_only_keeps_title(db, editable):
    owner, project = editable
    updated = update(db, owner, project, description="new desc")
    assert (updated.title, updated.description) == ("Old Title", "new desc")


@pytest.mark.parametrize("value", [None, "", "   "])
def test_update_clears_description(db, editable, value):
    owner, project = editable
    assert update(db, owner, project, description=value).description is None


def test_update_empty_body_changes_nothing(db, editable):
    owner, project = editable
    updated = update(db, owner, project)
    assert (updated.title, updated.description, updated.updated_at) == (
        "Old Title", "old desc", at(1)
    )


def test_update_other_fields_not_touched(db, editable):
    owner, project = editable
    updated = update(db, owner, project, title="T", bpm=200)  # bpm 은 수정 스키마에 없는 칸
    assert (updated.title, updated.bpm) == ("T", Decimal("120.00"))


def test_update_by_editor(db, editable):
    _, project = editable
    editor = add_user(db, "up_editor")
    db.add(ProjectMember(project_id=project.project_id, user_id=editor.user_id, role="EDITOR"))
    db.flush()
    assert update(db, editor, project, title="By Editor").title == "By Editor"


def test_update_by_viewer_forbidden(db, editable):
    _, project = editable
    viewer = add_user(db, "up_viewer")
    db.add(ProjectMember(project_id=project.project_id, user_id=viewer.user_id, role="VIEWER"))
    db.flush()
    with pytest.raises(AppError) as err:
        update(db, viewer, project, title="Nope")
    assert err.value.status_code == 403
    db.refresh(project)
    assert project.title == "Old Title"


# ── 61 delete_project ──

def add_member(db, project, name, role):
    user = add_user(db, name)
    db.add(ProjectMember(project_id=project.project_id, user_id=user.user_id, role=role))
    db.flush()
    return user


def test_delete_soft_by_owner(db):
    owner = add_user(db, "dp_owner")
    project = create_project(db, owner, ProjectCreateRequest(title="To Delete"))
    _, member = get_membership(db, project.project_id, owner)
    before = datetime.now(UTC).replace(tzinfo=None, microsecond=0)

    assert delete_project(db, project, member) is None

    db.expire_all()
    row = db.get(Project, project.project_id)
    assert row is not None and row.deleted_at >= before  # 행은 남고 시각만 채움
    assert db.get(ProjectMember, (project.project_id, owner.user_id)) is not None
    tracks = db.scalar(
        select(func.count()).select_from(Track).where(Track.project_id == project.project_id)
    )
    assert tracks == 1  # MASTER 트랙도 그대로 (복구 가능)


def test_delete_hides_from_list_and_membership(db):
    owner = add_user(db, "dp_hide")
    keep = create_project(db, owner, ProjectCreateRequest(title="Keep"))
    gone = create_project(db, owner, ProjectCreateRequest(title="Gone"))
    _, member = get_membership(db, gone.project_id, owner)
    delete_project(db, gone, member)

    result = list_projects(db, owner, "", ProjectSort.UPDATED, 1, 10)
    assert titles(result) == ["Keep"] and result.total == 1
    assert_404(db, gone.project_id, owner)  # 다시 지우거나 열려고 하면 404
    assert get_membership(db, keep.project_id, owner)[0] is keep


@pytest.mark.parametrize("role", ["EDITOR", "VIEWER"])
def test_delete_by_non_owner_forbidden(db, role):
    project = add_project(db, add_user(db, f"dp_o_{role.lower()}"))
    user = add_member(db, project, f"dp_{role.lower()}", role)
    _, member = get_membership(db, project.project_id, user)
    with pytest.raises(AppError) as err:
        delete_project(db, project, member)
    assert err.value.status_code == 403
    assert err.value.code == ErrorCode.FORBIDDEN
    db.expire_all()
    assert db.get(Project, project.project_id).deleted_at is None
