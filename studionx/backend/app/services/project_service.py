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

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models import Project, ProjectMember, ProjectSession, Track, User
from app.models.project import MemberRole
from app.models.track import TrackType
from app.schemas.full_project import FullProjectSettingsUpdateRequest
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

    삭제된(deleted_at) 프로젝트 · 내가 멤버가 아닌 프로젝트도 똑같이 404 —
    남의 프로젝트가 있는지조차 알려 주지 않는다 (2026-10-08 사용자 결정 A).
    """
    project = db.get(Project, project_id)
    member = None
    if project is not None and project.deleted_at is None:
        member = db.get(ProjectMember, (project_id, user.user_id))
    if member is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Project not found.")
    return project, member


def require_role(member: ProjectMember, *roles: str) -> None:
    """멤버 역할 검사. 예: require_role(member, "OWNER", "EDITOR")

    멤버이지만 역할이 모자라면 403 (프로젝트가 있다는 것은 이미 아는 사람이므로).
    """
    if member.role not in roles:
        raise AppError(ErrorCode.FORBIDDEN, 403, "You don't have permission.")


def to_item(
    db: Session,
    project: Project,
    member: ProjectMember,
    member_count: int | None = None,
    opened: bool | None = None,
) -> ProjectItem:
    """Project → ProjectItem (my_role, member_count, opened 포함).

    member_count · opened 를 넘기지 않으면 여기서 DB 에 물어본다 (상세 · 만들기 · 수정 응답).
    목록은 list_projects 가 한 번에 모아 계산한 값을 넘긴다 (줄마다 쿼리하지 않게).
    """
    if member_count is None:
        member_count = db.scalar(
            select(func.count())
            .select_from(ProjectMember)
            .where(ProjectMember.project_id == project.project_id)
        )
    if opened is None:
        session_id = db.scalar(
            select(ProjectSession.session_id)
            .where(
                ProjectSession.project_id == project.project_id,
                ProjectSession.user_id == member.user_id,
            )
            .limit(1)
        )
        opened = session_id is not None
    return ProjectItem(
        project_id=project.project_id,
        title=project.title,
        description=project.description,
        bpm=project.bpm,
        time_sig_num=project.time_sig_num,
        time_sig_den=project.time_sig_den,
        music_key=project.music_key,
        created_at=project.created_at,
        updated_at=project.updated_at,
        my_role=member.role,
        member_count=member_count,
        opened=opened,
    )


def _escape_like(text: str) -> str:
    """LIKE 검색어의 특수 문자(역슬래시 · % · _)를 글자 그대로 찾도록 앞에 역슬래시를 붙인다."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


SORT_ORDER = {
    ProjectSort.UPDATED: Project.updated_at.desc(),
    ProjectSort.TITLE: Project.title.asc(),
    ProjectSort.CREATED: Project.created_at.desc(),
}


def list_projects(
    db: Session,
    user: User,
    query: str,
    sort: ProjectSort,
    page: int,
    size: int,
) -> ProjectListResponse:
    """내 프로젝트 목록 (FR-123) — 내가 멤버인 것 전부 (OWNER 가 아니어도), 삭제된 것은 뺌.

    query: 제목에 이 글자가 들어간 것만 (대소문자 무시, 빈 문자열이면 전부)
    정렬이 같은 값이면 project_id 큰 것(나중에 만든 것)이 먼저 — 페이지를 넘겨도 순서가 그대로
    """
    conditions = [ProjectMember.user_id == user.user_id, Project.deleted_at.is_(None)]
    if query:
        conditions.append(Project.title.ilike(f"%{_escape_like(query)}%", escape="\\"))

    total = db.scalar(
        select(func.count())
        .select_from(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.project_id)
        .where(*conditions)
    )
    rows = db.execute(
        select(Project, ProjectMember)
        .join(ProjectMember, ProjectMember.project_id == Project.project_id)
        .where(*conditions)
        .order_by(SORT_ORDER[sort], Project.project_id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()

    # 이 페이지 프로젝트들의 멤버 수 · 내가 연 적 있는지를 쿼리 두 번으로 모아 계산
    ids = [project.project_id for project, _ in rows]
    counts = {}
    opened_ids = set()
    if ids:
        counts = dict(
            db.execute(
                select(ProjectMember.project_id, func.count())
                .where(ProjectMember.project_id.in_(ids))
                .group_by(ProjectMember.project_id)
            ).all()
        )
        opened_ids = set(
            db.scalars(
                select(ProjectSession.project_id).where(
                    ProjectSession.project_id.in_(ids), ProjectSession.user_id == user.user_id
                )
            )
        )

    items = [
        to_item(db, project, member, counts[project.project_id], project.project_id in opened_ids)
        for project, member in rows
    ]
    return ProjectListResponse(items=items, total=total, page=page, size=size)


def create_project(db: Session, user: User, data: ProjectCreateRequest) -> Project:
    """프로젝트 생성 (FR-122) — 프로젝트 · OWNER 멤버 · MASTER 트랙을 **한 트랜잭션**으로.

    셋 중 하나라도 저장에 실패하면 rollback → 아무것도 남지 않는다.
    (제목 · 설명은 스키마(56)가 이미 공백을 지우고 검사함)
    """
    project = Project(
        owner_id=user.user_id,
        title=data.title,
        description=data.description,
        bpm=data.bpm,
        time_sig_num=data.time_sig_num,
        time_sig_den=data.time_sig_den,
    )
    try:
        db.add(project)
        db.flush()  # commit 전에 project_id 를 받기 위해 (INSERT 만 먼저 보냄)
        db.add(
            ProjectMember(
                project_id=project.project_id, user_id=user.user_id, role=MemberRole.OWNER
            )
        )
        # MASTER 는 화면에서 늘 맨 아래 고정이라 순서 번호는 쓰지 않음 (2026-10-06)
        db.add(
            Track(
                project_id=project.project_id,
                name=MASTER_TRACK_NAME,
                track_type=TrackType.MASTER,
                order_index=0,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(project)  # DB 가 채운 created_at · updated_at · bpm 등 다시 읽기
    return project


def update_project(
    db: Session,
    project: Project,
    member: ProjectMember,
    data: ProjectUpdateRequest,
) -> Project:
    """제목·설명 수정 (FR-124) — OWNER · EDITOR 만 (VIEWER 는 403).

    보낸 칸만 바꾼다. 제목 null · 빈 제목은 스키마(56)가 이미 422 로 막음.
    updated_at 은 값이 실제로 바뀌면 DB 가 자동으로 갱신 (ON UPDATE).
    """
    require_role(member, MemberRole.OWNER, MemberRole.EDITOR)
    changes = data.model_dump(exclude_unset=True)
    for name, value in changes.items():
        setattr(project, name, value)
    db.commit()
    db.refresh(project)  # 새 updated_at 읽기
    return project


def update_settings(
    db: Session,
    project: Project,
    member: ProjectMember,
    data: FullProjectSettingsUpdateRequest,
) -> Project:
    """곡 전체 설정(BPM·박자·Key·스케일·샘플레이트·마스터 설정) 수정 (FR-253) — OWNER·EDITOR 만.

    보낸 칸만 바꾸고 보내지 않은 칸은 그대로 둔다 (exclude_unset). 화면(시퀀서)은
    Ctrl+S 수동 저장과 자동 저장 때 바뀐 칸만 보낸다. updated_at 은 DB 가 자동으로 갱신한다.
    """
    require_role(member, MemberRole.OWNER, MemberRole.EDITOR)
    for name, value in data.model_dump(exclude_unset=True).items():
        setattr(project, name, value)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project: Project, member: ProjectMember) -> None:
    """프로젝트 삭제 — 소프트 삭제 (FR-125), OWNER 만 (EDITOR · VIEWER 는 403).

    행은 지우지 않고 deleted_at 만 채운다 → 목록(58) · get_membership(57) 에서 바로 사라짐.
    트랙 · 멤버 등은 그대로 둠 (복구 가능). 실제 파일 정리는 나중 정리 작업에서 (FR-137)
    """
    require_role(member, MemberRole.OWNER)
    project.deleted_at = datetime.now(UTC).replace(tzinfo=None)  # DB 는 UTC 를 시간대 없이 저장
    db.commit()
