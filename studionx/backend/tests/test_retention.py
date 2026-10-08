"""보관 기간 정리 (workers/retention.py) — P1-09 purge_withdrawn_accounts."""

from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.core.errors import AppError
from app.core.security import hash_password
from app.models import Inquiry, Project, User
from app.models.user import UserStatus
from app.services import auth_service
from app.workers import retention
from app.workers.retention import WIPED_PASSWORD_HASH, purge_withdrawn_accounts

NOW = datetime(2026, 10, 7, 12, 0, 0)  # 정리를 돌리는 시각 (UTC)
NAME = "3f9c2b7e0d1a4c5b8e6f7a9b0c1d2e3f"


@pytest.fixture
def storage(tmp_path, monkeypatch):
    """사진을 시험용 임시 폴더에서 (진짜 storage/ 를 건드리지 않음)."""
    monkeypatch.setattr(retention, "get_settings", lambda: SimpleNamespace(storage_dir=tmp_path))
    (tmp_path / "profiles").mkdir()
    return tmp_path


def add_user(db, email, nickname, **fields):
    values = {
        "email": email,
        "password_hash": hash_password("Abcdef1!"),
        "nickname": nickname,
        "privacy_agreed_at": NOW - timedelta(days=30),
        "privacy_version": "2026-10-05",
    }
    values.update(fields)
    user = User(**values)
    db.add(user)
    db.flush()
    return user


def withdrawn(db, email, nickname, days_ago, **fields):
    return add_user(
        db, email, nickname,
        status=UserStatus.DELETED, deleted_at=NOW - timedelta(days=days_ago),
        last_login_at=NOW - timedelta(days=days_ago + 1), **fields,
    )


def row(db, user_id):
    return db.execute(
        select(
            User.email, User.nickname, User.password_hash, User.last_login_at,
            User.profile_image_path, User.status, User.deleted_at,
        ).where(User.user_id == user_id)
    ).one()


def test_purge_after_3_days(db, storage):
    photo = f"profiles/{NAME}.jpg"
    (storage / photo).write_bytes(b"\xff\xd8\xff")
    user = withdrawn(db, "old.gone@example.com", "old_gone", 4, profile_image_path=photo)
    project = Project(owner_id=user.user_id, title="Left behind")
    db.add(project)
    db.flush()
    deleted_at = user.deleted_at

    assert purge_withdrawn_accounts(db, NOW) == 1
    r = row(db, user.user_id)
    assert r.email == f"deleted+{user.user_id}@withdrawn.invalid"
    assert r.nickname == f"deleted_user_{user.user_id:010d}"
    assert r.password_hash == WIPED_PASSWORD_HASH
    assert r.last_login_at is None
    assert r.profile_image_path is None
    assert not (storage / photo).exists()
    assert r.status == UserStatus.DELETED and r.deleted_at == deleted_at  # 행 · 탈퇴 시각은 남김
    assert db.get(Project, project.project_id).owner_id == user.user_id  # 프로젝트도 남김


def test_purge_skips_recent_and_active(db, storage):
    recent = withdrawn(db, "recent.gone@example.com", "recent_gone", 2)
    active = add_user(db, "still.here@example.com", "still_here", last_login_at=NOW)

    assert purge_withdrawn_accounts(db, NOW) == 0
    assert row(db, recent.user_id).email == "recent.gone@example.com"  # 3일 안 — 재가입 막는 데 씀
    assert row(db, active.user_id).password_hash != WIPED_PASSWORD_HASH


def test_purge_boundary_exactly_3_days(db, storage):
    user = withdrawn(db, "edge.gone@example.com", "edge_gone", 3)
    assert purge_withdrawn_accounts(db, NOW) == 1
    assert row(db, user.user_id).password_hash == WIPED_PASSWORD_HASH


def test_purge_twice_counts_once(db, storage):
    withdrawn(db, "twice.gone@example.com", "twice_gone", 5)
    assert purge_withdrawn_accounts(db, NOW) == 1
    assert purge_withdrawn_accounts(db, NOW) == 0  # 이미 다 비운 행은 건너뜀


def test_purge_row_already_released_by_signup(db, storage):
    """누가 그 이메일로 가입해 이메일 · 닉네임만 비켜 둔 행 — 남은 비밀번호 해시 등도 비움."""
    user = withdrawn(db, "taken.gone@example.com", "taken_gone", 4)
    auth_service.release_withdrawn(db, user)

    assert purge_withdrawn_accounts(db, NOW) == 1
    r = row(db, user.user_id)
    assert r.password_hash == WIPED_PASSWORD_HASH and r.last_login_at is None


def test_purge_photo_file_already_gone(db, storage):
    user = withdrawn(db, "nofile.gone@example.com", "nofile_gone", 4,
                     profile_image_path=f"profiles/{NAME}.png")
    assert purge_withdrawn_accounts(db, NOW) == 1
    assert row(db, user.user_id).profile_image_path is None


def test_purge_now_with_timezone(db, storage):
    """시간대가 있는 now 도 UTC 로 바꿔 비교 — 한국 시각 21:00 = UTC 12:00."""
    user = withdrawn(db, "kst.gone@example.com", "kst_gone", 3)
    kst_now = datetime(2026, 10, 7, 21, 0, 0, tzinfo=timezone(timedelta(hours=9)))
    assert purge_withdrawn_accounts(db, kst_now) == 1
    assert row(db, user.user_id).password_hash == WIPED_PASSWORD_HASH


def test_after_purge_login_fails_and_email_free(db, storage):
    withdrawn(db, "free.again@example.com", "free_again2", 4)
    purge_withdrawn_accounts(db, datetime.now(UTC) + timedelta(days=10))

    with pytest.raises(AppError) as err:
        auth_service.authenticate(db, "free.again@example.com", "Abcdef1!")
    assert err.value.status_code == 401
    assert auth_service.check_email(db, "free.again@example.com").available is True
    assert auth_service.check_nickname(db, "free_again2").available is True


# ── 54 purge_old_inquiries (P1-12) ────────────────────────────


def add_inquiry(db, title, received_days_ago, answered_days_ago=None):
    inquiry = Inquiry(
        email="old.ask@example.com", title=title, content="…",
        privacy_agreed_at=NOW - timedelta(days=received_days_ago),
        created_at=NOW - timedelta(days=received_days_ago),
        answered_at=None if answered_days_ago is None else NOW - timedelta(days=answered_days_ago),
    )
    db.add(inquiry)
    db.flush()
    return inquiry.inquiry_id


def titles_left(db):
    return set(db.scalars(select(Inquiry.title).where(Inquiry.email == "old.ask@example.com")))


def test_purge_old_inquiries(db):
    add_inquiry(db, "answered 400d", 420, 400)       # 답변 1년 넘음 → 지움
    add_inquiry(db, "answered 300d", 500, 300)       # 받은 지는 오래됐지만 답변 1년 안 → 남김
    add_inquiry(db, "unanswered 400d", 400)          # 답변 없이 1년 넘음 → 지움 (사용자 결정)
    add_inquiry(db, "unanswered 100d", 100)          # 남김
    add_inquiry(db, "answered edge", 380, 365)       # 정확히 1년 → 지움

    assert retention.purge_old_inquiries(db, NOW) == 3
    assert titles_left(db) == {"answered 300d", "unanswered 100d"}


def test_purge_old_inquiries_twice(db):
    add_inquiry(db, "old", 400)
    assert retention.purge_old_inquiries(db, NOW) == 1
    assert retention.purge_old_inquiries(db, NOW) == 0


def test_purge_old_inquiries_timezone(db):
    """한국 시각 21:00 = UTC 12:00 — 정확히 1년 된 문의가 지워짐."""
    add_inquiry(db, "kst edge", 365)
    kst_now = datetime(2026, 10, 7, 21, 0, 0, tzinfo=timezone(timedelta(hours=9)))
    assert retention.purge_old_inquiries(db, kst_now) == 1


# ── 55 main (P1-12) ───────────────────────────────────────────


class _Session:
    """main 이 `with SessionLocal() as db` 로 쓰는 세션 자리에 시험용 db 를 넣음 (닫지 않음)."""

    def __init__(self, db):
        self.db = db

    def __enter__(self):
        return self.db

    def __exit__(self, *exc):
        return False


def test_main_runs_both_and_prints(db, storage, monkeypatch, capsys):
    calls = []
    monkeypatch.setattr(retention, "init_sentry", lambda settings: calls.append("sentry"))
    monkeypatch.setattr(retention, "SessionLocal", lambda: _Session(db))
    withdrawn(db, "main.gone@example.com", "main_gone", 10)
    add_inquiry(db, "main old", 400)

    retention.main()
    assert calls == ["sentry"]  # Sentry 를 먼저 켬
    out = capsys.readouterr().out.strip()
    assert out.startswith("withdrawn accounts: ") and ", inquiries: " in out
    accounts, inquiries = (int(part.split(": ")[1]) for part in out.split(", "))
    assert accounts >= 1 and inquiries >= 1
    assert titles_left(db) == set()


def test_main_error_propagates(db, monkeypatch):
    """정리 중 오류는 삼키지 않음 → Sentry 보고 · 명령 실패."""
    monkeypatch.setattr(retention, "init_sentry", lambda settings: None)
    monkeypatch.setattr(retention, "SessionLocal", lambda: _Session(db))

    def broken(db, now):
        raise RuntimeError("db down")

    monkeypatch.setattr(retention, "purge_withdrawn_accounts", broken)
    with pytest.raises(RuntimeError):
        retention.main()
