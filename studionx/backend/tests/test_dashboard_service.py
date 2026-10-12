"""마이페이지 대시보드 서비스 (services/dashboard_service.py, P1-16)."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import event

from app.models import Project, ProjectMember, ProjectSession, User
from app.services.dashboard_service import (
    AI_DAILY_ANALYSES,
    AI_DAILY_QUESTIONS,
    get_ai_usage,
    get_dashboard,
    get_ready_projects,
    get_recent_projects,
    get_storage,
)


def add_user(db, name, **fields):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_ds",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-08",
        **fields,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


# ── 64 get_storage ──

def test_storage_defaults_from_db(db):
    storage = get_storage(add_user(db, "st_default"))
    assert (storage.quota_bytes, storage.used_bytes) == (5 * 1024**3, 0)  # 5GB (FR-131)
    assert storage.by_kind.model_dump() == {"samples": 0, "exports": 0, "stems": 0, "snapshots": 0}


def test_storage_uses_user_values(db):
    user = add_user(
        db, "st_custom", storage_quota_bytes=10 * 1024**3, storage_used_bytes=1234567890
    )
    storage = get_storage(user)
    assert (storage.quota_bytes, storage.used_bytes) == (10 * 1024**3, 1234567890)


def test_storage_profile_photo_not_counted(db):
    photo = "profiles/aaaabbbbccccddddeeeeffff00001111.png"
    user = add_user(db, "st_photo", profile_image_path=photo)
    assert get_storage(user).used_bytes == 0  # 2026-10-07 결정 — 사진은 사용량 밖


def test_storage_json_shape(db):
    data = get_storage(add_user(db, "st_json")).model_dump(mode="json")
    assert set(data) == {"quota_bytes", "used_bytes", "by_kind"}
    assert isinstance(data["quota_bytes"], int)


# ── 65 get_ai_usage ──

def test_ai_limits_are_prd_values():
    assert (AI_DAILY_ANALYSES, AI_DAILY_QUESTIONS) == (5, 30)  # PRD 05 FR-551


def test_ai_usage_phase1_zero(db):
    ai = get_ai_usage(db, add_user(db, "ai_zero"))
    assert ai.model_dump() == {
        "analyses": {"used": 0, "limit": 5},
        "questions": {"used": 0, "limit": 30},
    }


def test_ai_usage_reads_nothing(db):
    # Phase 1 에는 셀 표가 없음 — DB 에 묻지 않아야 함 (None 을 넘겨도 동작)
    assert get_ai_usage(None, add_user(db, "ai_nodb")).analyses.used == 0


# ── 66 get_recent_projects ──

def utc_now():
    return datetime.now(UTC).replace(tzinfo=None)


def add_project(db, owner, title, updated_days_ago, **fields):
    when = utc_now() - timedelta(days=updated_days_ago)
    project = Project(
        owner_id=owner.user_id, title=title, created_at=when, updated_at=when, **fields
    )
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.project_id, user_id=owner.user_id, role="OWNER"))
    db.flush()
    return project


def add_session(db, project, user, days_ago, active=600):
    start = utc_now() - timedelta(days=days_ago)
    db.add(ProjectSession(
        project_id=project.project_id, user_id=user.user_id,
        started_at=start, last_seen_at=start + timedelta(minutes=30), active_seconds=active,
    ))
    db.flush()


def test_recent_empty(db):
    assert get_recent_projects(db, add_user(db, "rp_empty")) == []


def test_recent_top5_newest_first_only_mine_not_deleted(db):
    me = add_user(db, "rp_me")
    other = add_user(db, "rp_other")
    for i in range(7):
        add_project(db, me, f"Mine {i}", updated_days_ago=i)
    gone = add_project(db, me, "Deleted", updated_days_ago=0)
    gone.deleted_at = utc_now()
    add_project(db, other, "Theirs", updated_days_ago=0)
    shared = add_project(db, other, "Shared", updated_days_ago=0.5)
    db.add(ProjectMember(project_id=shared.project_id, user_id=me.user_id, role="EDITOR"))
    db.flush()
    titles = [p.title for p in get_recent_projects(db, me)]
    assert titles == ["Mine 0", "Shared", "Mine 1", "Mine 2", "Mine 3"]


def test_recent_fields(db):
    me = add_user(db, "rp_fields")
    add_project(db, me, "Keyed", updated_days_ago=0, bpm=Decimal("128.50"), music_key="A minor")
    item = get_recent_projects(db, me)[0]
    assert (item.title, item.bpm, item.music_key, item.sessions) == (
        "Keyed", Decimal("128.50"), "A minor", []
    )


def test_recent_sessions_mine_within_7_days_oldest_first(db):
    me = add_user(db, "rp_sess")
    other = add_user(db, "rp_sess_o")
    a = add_project(db, me, "A", updated_days_ago=0)
    b = add_project(db, me, "B", updated_days_ago=1)
    db.add(ProjectMember(project_id=a.project_id, user_id=other.user_id, role="EDITOR"))
    add_session(db, a, me, days_ago=1, active=100)
    add_session(db, a, me, days_ago=3, active=300)
    add_session(db, a, me, days_ago=8, active=800)      # 7일 밖
    add_session(db, a, other, days_ago=1, active=999)   # 다른 사람
    add_session(db, b, me, days_ago=6.9, active=690)
    got = {p.title: [s.active_seconds for s in p.sessions] for p in get_recent_projects(db, me)}
    assert got == {"A": [300, 100], "B": [690]}


def test_recent_sessions_one_query(db):
    me = add_user(db, "rp_q")
    for i in range(5):
        p = add_project(db, me, f"Q{i}", updated_days_ago=i)
        add_session(db, p, me, days_ago=1)
    statements = []
    engine = db.get_bind().engine
    def count(conn, cursor, statement, *args):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)
    event.listen(engine, "before_cursor_execute", count)
    try:
        result = get_recent_projects(db, me)
    finally:
        event.remove(engine, "before_cursor_execute", count)
    assert len(result) == 5 and all(len(p.sessions) == 1 for p in result)
    assert len(statements) == 2  # 프로젝트 1번 + 세션 1번 (프로젝트마다 묻지 않음)


# ── 67 get_ready_projects ──

def test_ready_empty(db):
    assert get_ready_projects(db, add_user(db, "ry_empty")) == []


def test_ready_only_unopened_by_me_newest_first_max3(db):
    me = add_user(db, "ry_me")
    other = add_user(db, "ry_other")
    opened = add_project(db, me, "Opened", updated_days_ago=0)
    add_session(db, opened, me, days_ago=30)            # 오래전이라도 한 번 열었으면 빠짐
    for i in range(4):
        add_project(db, me, f"New {i}", updated_days_ago=i)
    gone = add_project(db, me, "Deleted", updated_days_ago=0)
    gone.deleted_at = utc_now()
    shared = add_project(db, other, "Shared", updated_days_ago=0.5)
    db.add(ProjectMember(project_id=shared.project_id, user_id=me.user_id, role="EDITOR"))
    add_session(db, shared, other, days_ago=1)          # 남이 열었어도 나는 안 엶 → 포함
    add_project(db, other, "Theirs", updated_days_ago=0)
    db.flush()
    assert [p.title for p in get_ready_projects(db, me)] == ["New 0", "Shared", "New 1"]


def test_ready_fields(db):
    me = add_user(db, "ry_fields")
    add_project(db, me, "Seven", updated_days_ago=0, bpm=Decimal("96.00"),
                time_sig_num=7, time_sig_den=8)
    item = get_ready_projects(db, me)[0]
    assert (item.title, item.bpm, item.time_sig_num, item.time_sig_den) == (
        "Seven", Decimal("96.00"), 7, 8
    )
    assert item.created_at is not None


def test_ready_one_query(db):
    me = add_user(db, "ry_q")
    for i in range(3):
        add_project(db, me, f"R{i}", updated_days_ago=i)
    statements = []
    engine = db.get_bind().engine
    def count(conn, cursor, statement, *args):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)
    event.listen(engine, "before_cursor_execute", count)
    try:
        assert len(get_ready_projects(db, me)) == 3
    finally:
        event.remove(engine, "before_cursor_execute", count)
    assert len(statements) == 1 and "EXISTS" in statements[0].upper()


# ── 68 get_dashboard ──

def test_dashboard_user_block(db):
    photo = "profiles/aaaabbbbccccddddeeeeffff00001111.png"
    me = add_user(db, "db_user", profile_image_path=photo)
    data = get_dashboard(db, me).model_dump(mode="json")
    assert data["user"]["nickname"] == "db_user_ds"
    assert data["user"]["email"] == "db_user@example.com"
    assert data["user"]["created_at"] is not None
    assert data["user"]["profile_image_url"] == (
        "/api/v1/profile-images/aaaabbbbccccddddeeeeffff00001111.png"
    )


def test_dashboard_no_photo_is_none(db):
    assert get_dashboard(db, add_user(db, "db_nophoto")).user.profile_image_url is None


def test_dashboard_top_level_keys_and_no_secrets(db):
    data = get_dashboard(db, add_user(db, "db_keys")).model_dump(mode="json")
    assert set(data) == {"user", "storage", "ai", "ready_projects", "recent_projects"}
    assert set(data["user"]) == {"nickname", "email", "created_at", "profile_image_url"}
    assert "password_hash" not in str(data)


def test_dashboard_combines_pieces(db):
    me = add_user(db, "db_all", storage_used_bytes=42)
    add_project(db, me, "Old", updated_days_ago=2)
    add_project(db, me, "New", updated_days_ago=0)
    dash = get_dashboard(db, me)
    assert dash.storage.used_bytes == 42
    assert (dash.ai.analyses.limit, dash.ai.questions.limit) == (
        AI_DAILY_ANALYSES, AI_DAILY_QUESTIONS
    )
    assert [p.title for p in dash.recent_projects] == ["New", "Old"]
    assert sorted(p.title for p in dash.ready_projects) == ["New", "Old"]


def test_dashboard_empty_account(db):
    dash = get_dashboard(db, add_user(db, "db_empty"))
    assert dash.recent_projects == [] and dash.ready_projects == []
