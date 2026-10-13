"""project_members 모델 컬럼 (models/project.py ProjectMember, P1-03) — 실제 MySQL 과 비교.

DB 세션(db)과 비교 도구(assert_matches_db)는 conftest.py 에 있다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import Project, ProjectMember, User
from app.models.project import MemberRole


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


@pytest.fixture
def project(db):
    owner = add_user(db, "pm_owner")
    project = Project(owner_id=owner.user_id, title="Band Song")
    db.add(project)
    db.flush()
    return project


def count_members(db, project_id):
    stmt = (
        select(func.count())
        .select_from(ProjectMember)
        .where(ProjectMember.project_id == project_id)
    )
    return db.scalar(stmt)


def test_columns_match_db(assert_matches_db):
    assert_matches_db(ProjectMember)  # 칸 · NULL 허용 · FK 2개 (project_id 는 ON DELETE CASCADE)


def test_primary_key_is_project_and_user():
    assert [c.name for c in ProjectMember.__table__.primary_key.columns] == [
        "project_id",
        "user_id",
    ]


def test_owner_member_and_defaults(db, project):
    owner = ProjectMember(
        project_id=project.project_id, user_id=project.owner_id, role=MemberRole.OWNER
    )
    guest = add_user(db, "pm_editor")
    editor = ProjectMember(project_id=project.project_id, user_id=guest.user_id)  # role 없음
    db.add_all([owner, editor])
    db.flush()
    db.refresh(owner)
    db.refresh(editor)
    assert owner.role is MemberRole.OWNER
    assert editor.role is MemberRole.EDITOR  # DB 기본값
    assert isinstance(editor.joined_at, datetime)
    assert editor.last_read_message_id is None


def test_same_user_twice_is_rejected(db, project):
    db.add(ProjectMember(project_id=project.project_id, user_id=project.owner_id))
    db.flush()
    db.expunge_all()  # 파이썬 쪽 중복 확인을 피하고 DB 가 막는지 본다
    db.add(ProjectMember(project_id=project.project_id, user_id=project.owner_id))
    with pytest.raises(IntegrityError):
        db.flush()


def test_deleting_project_deletes_members(db, project):
    db.add(
        ProjectMember(
            project_id=project.project_id, user_id=project.owner_id, role=MemberRole.OWNER
        )
    )
    db.flush()
    assert count_members(db, project.project_id) == 1
    db.delete(project)
    db.flush()  # DELETE FROM projects … → DB 가 멤버 행도 지움 (ON DELETE CASCADE)
    assert count_members(db, project.project_id) == 0
