"""tags · sample_tags 모델 컬럼 (models/tag.py, S1-07) — 실제 MySQL 과 비교.

DB 세션(db)과 비교 도구(assert_matches_db)는 conftest.py 에 있다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import Sample, SampleTag, Tag, TagCategory, User


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_test",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-05",
    )
    db.add(user)
    db.flush()
    return user


def make_sample(owner_id):
    return Sample(
        owner_id=owner_id,
        name="Kick 01",
        original_filename="kick01.wav",
        file_path="samples/1/abc.wav",
        mime_type="audio/wav",
        file_size=12345,
    )


def count_sample_tags(db, sample_id):
    stmt = select(func.count()).select_from(SampleTag).where(SampleTag.sample_id == sample_id)
    return db.scalar(stmt)


def test_tag_columns_match_db(assert_matches_db):
    assert_matches_db(Tag)  # 칸 이름 · 순서 · NULL 허용


def test_sample_tag_columns_match_db(assert_matches_db):
    assert_matches_db(SampleTag)  # 칸 · FK 2개 (모두 ON DELETE CASCADE)


def test_tag_defaults(db):
    tag = Tag(name="Techno")
    db.add(tag)
    db.flush()
    db.refresh(tag)
    assert tag.category is TagCategory.ETC  # DB 기본값
    assert tag.is_system is True  # DB 기본값
    assert isinstance(tag.created_at, datetime)


def test_same_name_same_category_rejected(db):
    db.add(Tag(name="Kick", category=TagCategory.INSTRUMENT))
    db.flush()
    db.add(Tag(name="Kick", category=TagCategory.INSTRUMENT))
    with pytest.raises(IntegrityError):  # UNIQUE(category, name)
        db.flush()


def test_same_name_other_category_ok(db):
    db.add(Tag(name="Deep", category=TagCategory.MOOD))
    db.add(Tag(name="Deep", category=TagCategory.GENRE))
    db.flush()
    stmt = select(func.count()).select_from(Tag).where(Tag.name == "Deep")
    assert db.scalar(stmt) == 2


def test_primary_key_is_sample_and_tag():
    assert [c.name for c in SampleTag.__table__.primary_key.columns] == ["sample_id", "tag_id"]


def test_link_and_cascade_from_sample(db):
    owner = add_user(db, "tag_owner")
    sample = make_sample(owner.user_id)
    tag = Tag(name="Piano", category=TagCategory.INSTRUMENT)
    db.add_all([sample, tag])
    db.flush()
    db.add(SampleTag(sample_id=sample.sample_id, tag_id=tag.tag_id))
    db.flush()
    assert count_sample_tags(db, sample.sample_id) == 1

    db.delete(sample)
    db.flush()  # samples 를 지우면 sample_tags 도 함께 (ON DELETE CASCADE)
    assert count_sample_tags(db, sample.sample_id) == 0


def test_tagging_same_pair_twice_is_rejected(db):
    owner = add_user(db, "tag_dup")
    sample = make_sample(owner.user_id)
    tag = Tag(name="Bass", category=TagCategory.INSTRUMENT)
    db.add_all([sample, tag])
    db.flush()
    db.add(SampleTag(sample_id=sample.sample_id, tag_id=tag.tag_id))
    db.flush()
    db.expunge_all()  # 파이썬 쪽 중복 확인을 피하고 DB 가 막는지 본다
    db.add(SampleTag(sample_id=sample.sample_id, tag_id=tag.tag_id))
    with pytest.raises(IntegrityError):  # 복합 기본 키
        db.flush()
