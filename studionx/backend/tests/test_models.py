"""ORM 모델 뼈대가 SQL 테이블 이름·기본 키와 맞는지 확인 (DB 연결 없이)."""

from app.models import DevNote, Inquiry, Project, ProjectMember, ProjectSession, Track, User


def test_table_names():
    assert User.__tablename__ == "users"
    assert Inquiry.__tablename__ == "inquiries"
    assert Project.__tablename__ == "projects"
    assert ProjectMember.__tablename__ == "project_members"
    assert Track.__tablename__ == "tracks"
    assert ProjectSession.__tablename__ == "project_sessions"
    assert DevNote.__tablename__ == "dev_notes"


def test_primary_keys():
    def pk(model):
        return [c.name for c in model.__table__.primary_key.columns]

    assert pk(User) == ["user_id"]
    assert pk(Inquiry) == ["inquiry_id"]
    assert pk(Project) == ["project_id"]
    assert pk(ProjectMember) == ["project_id", "user_id"]
    assert pk(Track) == ["track_id"]
    assert pk(ProjectSession) == ["session_id"]
    assert pk(DevNote) == ["note_id"]
