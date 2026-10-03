# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-13 프로젝트 CRUD·권한 검사
#   브랜치  : feature/phase1/p1-13-project-api
#   순서    : 3단계 — P1-03~05 병합 후
#
# 시작 전 : git switch feature/phase1/p1-13-project-api
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""프로젝트 서비스 — 템플릿: 구현은 직접 (P1-13).

권한 규칙 (PRD 01 §5): 모든 프로젝트 API는 요청자가 project_members 에 있는지 먼저 확인
    조회        멤버면 누구나
    수정        OWNER · EDITOR
    삭제        OWNER 만
"""

from sqlalchemy.orm import Session

from app.models import Project, ProjectMember, User
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectItem,
    ProjectListResponse,
    ProjectSort,
    ProjectUpdateRequest,
)

MASTER_TRACK_NAME = "Master"


def get_membership(db: Session, project_id: int, user: User) -> tuple[Project, ProjectMember]:
    """프로젝트와 내 멤버 행을 함께 돌려준다. 없으면 404.

    TODO(P1-13):
    - project = db.get(Project, project_id) — 없거나 deleted_at 이 있으면
      raise AppError(ErrorCode.NOT_FOUND, 404, "Project not found.")
    - member = db.get(ProjectMember, (project_id, user.user_id))
    - member 가 없으면 403 대신 **404** 권장 (남의 프로젝트가 있는지조차 알려주지 않음)
    - return project, member
    """
    raise NotImplementedError


def require_role(member: ProjectMember, *roles: str) -> None:
    """멤버 역할 검사. 예: require_role(member, "OWNER")

    TODO(P1-13): member.role 이 roles 에 없으면
                 raise AppError(ErrorCode.FORBIDDEN, 403, "You don't have permission.")
    """
    raise NotImplementedError


def to_item(db: Session, project: Project, member: ProjectMember) -> ProjectItem:
    """Project → ProjectItem (my_role, member_count, opened 계산 포함).

    TODO(P1-13):
    - my_role = member.role
    - member_count = project_members 행 수
    - opened = 내 project_sessions 행이 있는지 (모델 ProjectSession — P1-16 에서 추가,
      그 전에는 False 로 두어도 됨)
    - 목록에서 줄마다 쿼리를 날리면 느려짐 → list_projects 에서는 한 번에 모아 계산하는 것을 권장
    """
    raise NotImplementedError


def list_projects(
    db: Session,
    user: User,
    query: str,
    sort: ProjectSort,
    page: int,
    size: int,
) -> ProjectListResponse:
    """내 프로젝트 목록 (FR-123) — 내가 멤버인 것 전부 (OWNER 가 아니어도).

    TODO(P1-13):
    - 기본 조건: ProjectMember.user_id == user.user_id 로 JOIN, Project.deleted_at IS NULL
    - query 가 있으면 Project.title.ilike(f"%{query}%")  (%·_ 문자는 escape 처리 권장)
    - 정렬: UPDATED → updated_at DESC / TITLE → title ASC / CREATED → created_at DESC
      (같은 값일 때 순서가 흔들리지 않게 project_id DESC 를 뒤에 하나 더)
    - total = 같은 조건의 count, items = offset((page-1)*size).limit(size)
    - return ProjectListResponse(items=[...], total=total, page=page, size=size)
    """
    raise NotImplementedError


def create_project(db: Session, user: User, data: ProjectCreateRequest) -> Project:
    """프로젝트 생성 (FR-122) — 아래 3개를 **한 트랜잭션**으로.

    TODO(P1-13):
    1. project = Project(owner_id=user.user_id, title=data.title.strip(), ...)
    2. db.add(project) → db.flush()          # commit 전에 project_id 를 받기 위해
    3. db.add(ProjectMember(project_id=..., user_id=user.user_id, role="OWNER"))
    4. db.add(Track(project_id=..., name=MASTER_TRACK_NAME, track_type="MASTER", order_index=0))
    5. db.commit() — 중간에 오류가 나면 db.rollback() 해서 셋 다 저장되지 않게
       (try/except 로 감싸거나 `with db.begin():` 사용)
    6. db.refresh(project) → return
    """
    raise NotImplementedError


def update_project(
    db: Session,
    project: Project,
    member: ProjectMember,
    data: ProjectUpdateRequest,
) -> Project:
    """제목·설명 수정 (FR-124) — OWNER · EDITOR.

    TODO(P1-13):
    - require_role(member, "OWNER", "EDITOR")
    - changes = data.model_dump(exclude_unset=True) → 있는 칸만 setattr
    - title 을 null 로 보내면 422 (제목은 비울 수 없음)
    - commit → refresh → return  (updated_at 은 DB 가 자동 갱신)
    """
    raise NotImplementedError


def delete_project(db: Session, project: Project, member: ProjectMember) -> None:
    """프로젝트 삭제 — 소프트 삭제 (FR-125), OWNER 만.

    TODO(P1-13):
    - require_role(member, "OWNER")
    - project.deleted_at = 지금(UTC) → commit
    - 트랙·클립 등은 그대로 둠 (복구 가능). 실제 파일 정리는 나중 정리 작업에서 (FR-137)
    """
    raise NotImplementedError
