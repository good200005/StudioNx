"""/api/v1/projects 라우터 (PRD 01 §7, FR-122~126) — 템플릿: 구현은 직접 (P1-13).

화면 쪽: static/js/pages/myproject.js (P1-14)
권한 검사는 services/project_service.py get_membership · require_role
"""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, Db
from app.schemas.common import ErrorResponse
from app.schemas.project import (
    PROJECT_PAGE_SIZE_MAX,
    ProjectCreateRequest,
    ProjectItem,
    ProjectListResponse,
    ProjectSort,
    ProjectUpdateRequest,
)

router = APIRouter()

NOT_FOUND = {404: {"model": ErrorResponse}}
FORBIDDEN = {403: {"model": ErrorResponse}}


@router.get("", response_model=ProjectListResponse)
def list_projects(
    user: CurrentUser,
    db: Db,
    query: Annotated[str, Query(max_length=100)] = "",
    sort: ProjectSort = ProjectSort.UPDATED,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=PROJECT_PAGE_SIZE_MAX)] = 10,
) -> ProjectListResponse:
    """내 프로젝트 목록 — 검색·정렬·페이지 (FR-123).

    TODO(P1-13): return project_service.list_projects(db, user, query.strip(), sort, page, size)
    """
    raise NotImplementedError


@router.post("", response_model=ProjectItem, status_code=status.HTTP_201_CREATED)
def create_project(data: ProjectCreateRequest, user: CurrentUser, db: Db) -> ProjectItem:
    """프로젝트 생성 + OWNER 멤버 + MASTER 트랙 (FR-122).

    TODO(P1-13):
    - project = project_service.create_project(db, user, data)
    - 응답은 목록 한 줄과 같은 모양 (my_role='OWNER', member_count=1, opened=False)
    - 화면: 201 → 넓은 화면이면 studioNx.html?projectId= 로 이동 (FR-126·129)
    """
    raise NotImplementedError


@router.get("/{project_id}", response_model=ProjectItem, responses=NOT_FOUND)
def read_project(project_id: int, user: CurrentUser, db: Db) -> ProjectItem:
    """프로젝트 기본 정보 — 멤버만 (시퀀서가 열 때 제목 표시 등).

    TODO(P1-13):
    - project, member = project_service.get_membership(db, project_id, user)
    - return project_service.to_item(db, project, member)
    """
    raise NotImplementedError


@router.patch(
    "/{project_id}",
    response_model=ProjectItem,
    responses={**NOT_FOUND, **FORBIDDEN},
)
def update_project(
    project_id: int,
    data: ProjectUpdateRequest,
    user: CurrentUser,
    db: Db,
) -> ProjectItem:
    """제목·설명 수정 (FR-124) — OWNER · EDITOR.

    TODO(P1-13): get_membership → update_project → to_item
    """
    raise NotImplementedError


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **FORBIDDEN},
)
def delete_project(project_id: int, user: CurrentUser, db: Db) -> None:
    """프로젝트 삭제 (FR-125) — OWNER 만, 소프트 삭제.

    TODO(P1-13): get_membership → delete_project
    - 화면: OWNER 가 아니면 버튼이 이미 막혀 있지만, 서버도 반드시 403 으로 막음
    """
    raise NotImplementedError
