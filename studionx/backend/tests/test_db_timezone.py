"""DB 연결 시간대 = UTC (app/db/session.py) — DEFAULT CURRENT_TIMESTAMP 도 UTC 로 저장됨."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.models import User


def test_connection_time_zone_is_utc(db):
    assert db.execute(text("SELECT @@session.time_zone")).scalar() == "+00:00"


def test_now_equals_utc_timestamp(db):
    now, utc = db.execute(text("SELECT NOW(), UTC_TIMESTAMP()")).one()
    assert abs(now - utc) < timedelta(seconds=2)


def test_default_created_at_is_utc(db):
    user = User(
        email="tz_default@example.com",
        password_hash="x",
        nickname="tz_default",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-08",
    )
    db.add(user)
    db.flush()
    db.refresh(user)

    now_utc = datetime.now(UTC).replace(tzinfo=None)
    assert abs(now_utc - user.created_at) < timedelta(minutes=1)  # 한국 시각이면 9시간 어긋남
