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
"""/api/v1/projects 라우터 (PRD 01 §7, FR-122~126) — 템플릿: 구현은 직접 (P1-13).

화면 쪽: static/js/pages/myproject.js (P1-14)
권한 검사는 services/project_service.py get_membership · require_role
"""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, Db
from app.schemas.common import ErrorResponse
from app.schemas.full_project import (
    FullProjectInfo,
    FullProjectResponse,
    FullProjectSettingsUpdateRequest,
)
from app.schemas.project import (
    PROJECT_PAGE_SIZE_MAX,
    ProjectCreateRequest,
    ProjectItem,
    ProjectListResponse,
    ProjectSort,
    ProjectUpdateRequest,
)
from app.schemas.tempo import TempoChangesResponse, TempoChangesSaveRequest
from app.services import full_project_service, project_service, tempo_service

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

    (구현: AI — 2026-10-08) 검색어는 앞뒤 공백을 지워서 넘김 (공백만이면 전체 목록)
    """
    return project_service.list_projects(db, user, query.strip(), sort, page, size)


@router.post("", response_model=ProjectItem, status_code=status.HTTP_201_CREATED)
def create_project(data: ProjectCreateRequest, user: CurrentUser, db: Db) -> ProjectItem:
    """프로젝트 생성 + OWNER 멤버 + MASTER 트랙 (FR-122).

    응답은 목록 한 줄과 같은 모양 (my_role='OWNER', member_count=1, opened=False)
    화면: 201 → 넓은 화면이면 studioNx.html?projectId= 로 이동 (FR-126·129)
    """
    project = project_service.create_project(db, user, data)
    # 방금 만든 프로젝트라 멤버는 나 하나 · 연 적 없음 → DB 에 다시 묻지 않음
    return project_service.to_item(db, project, project.members[0], member_count=1, opened=False)


@router.get("/{project_id}", response_model=ProjectItem, responses=NOT_FOUND)
def read_project(project_id: int, user: CurrentUser, db: Db) -> ProjectItem:
    """프로젝트 기본 정보 — 멤버만 (시퀀서가 열 때 제목 표시 등).

    남의 프로젝트 · 없는 번호 · 삭제된 프로젝트는 모두 404 (57)
    """
    project, member = project_service.get_membership(db, project_id, user)
    return project_service.to_item(db, project, member)


@router.get("/{project_id}/full", response_model=FullProjectResponse, responses=NOT_FOUND)
def read_full_project(project_id: int, user: CurrentUser, db: Db) -> FullProjectResponse:
    """프로젝트 전체 — 트랙·악기·이펙트·연결선·패턴·노트를 한 번에 (FR-254).

    시퀀서가 화면을 열 때 부르는 요청이다. 멤버만 (VIEWER 포함), 없거나 남의 것은 404.
    tempo_changes 는 저장된 템포 변경점이고, markers · meter_changes 는 그 모델이 아직 없어
    빈 목록으로 나간다.
    """
    return full_project_service.get_full_project(db, user, project_id)


@router.get(
    "/{project_id}/tempo-changes",
    response_model=TempoChangesResponse,
    responses=NOT_FOUND,
)
def read_tempo_changes(project_id: int, user: CurrentUser, db: Db) -> TempoChangesResponse:
    """프로젝트의 템포 변경점 목록 (FR-202a) — 멤버면 누구나, tick 오름차순."""
    return tempo_service.list_tempo_changes(db, user, project_id)


@router.put(
    "/{project_id}/tempo-changes",
    response_model=TempoChangesResponse,
    responses={**NOT_FOUND, **FORBIDDEN},
)
def replace_tempo_changes(
    project_id: int,
    data: TempoChangesSaveRequest,
    user: CurrentUser,
    db: Db,
) -> TempoChangesResponse:
    """템포 변경점을 보낸 목록으로 통째 교체 (FR-202a) — OWNER·EDITOR 만 (VIEWER 는 403).

    템포 줄(Tempo lane)이 바뀔 때마다 점 전체를 보낸다. 빈 목록이면 모두 지워 평평한 템포로 돌아감.
    """
    return tempo_service.replace_tempo_changes(db, user, project_id, data)


@router.patch(
    "/{project_id}/settings",
    response_model=FullProjectInfo,
    responses={**NOT_FOUND, **FORBIDDEN},
)
def update_project_settings(
    project_id: int,
    data: FullProjectSettingsUpdateRequest,
    user: CurrentUser,
    db: Db,
) -> FullProjectInfo:
    """곡 전체 설정(BPM·박자·Key·스케일·샘플레이트·마스터) 저장 (FR-253) — OWNER·EDITOR.

    시퀀서의 Ctrl+S 수동 저장과 자동 저장이 바뀐 칸만 보내는 곳이다.
    """
    project, member = project_service.get_membership(db, project_id, user)
    project = project_service.update_settings(db, project, member, data)
    return full_project_service.project_info(db, project, member)


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

    """
    project, member = project_service.get_membership(db, project_id, user)
    project = project_service.update_project(db, project, member, data)
    return project_service.to_item(db, project, member)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **FORBIDDEN},
)
def delete_project(project_id: int, user: CurrentUser, db: Db) -> None:
    """프로젝트 삭제 (FR-125) — OWNER 만, 소프트 삭제.

    화면: OWNER 가 아니면 버튼이 이미 막혀 있지만, 서버도 반드시 403 으로 막음
    """
    project, member = project_service.get_membership(db, project_id, user)
    project_service.delete_project(db, project, member)
