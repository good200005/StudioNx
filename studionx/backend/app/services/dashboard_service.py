# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-16 마이페이지 대시보드
#   브랜치  : feature/phase1/p1-16-dashboard-api
#   순서    : 4단계 — P1-08·P1-13 병합 후
#
# 시작 전 : git switch feature/phase1/p1-16-dashboard-api
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""마이페이지 대시보드 서비스 — 템플릿: 구현은 직접 (P1-16)."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project, ProjectMember, ProjectSession, User
from app.schemas.dashboard import (
    DashboardAi,
    DashboardResponse,
    DashboardStorage,
    DashboardUser,
    ReadyProject,
    RecentProject,
    SessionItem,
    StorageByKind,
    UsageCount,
)
from app.services.user_service import profile_image_url

RECENT_PROJECT_COUNT = 5  # 최근 프로젝트 개수 (FR-121)
RECENT_DAYS = 7  # 작업 시간을 보여 줄 기간 (FR-128)
READY_PROJECT_COUNT = 3  # 배너용 — 화면은 가장 최근 1개를 보여 줌

# AI 일일 한도 (PRD 05 FR-551) — 지금은 고정값, 나중에 core/config.py 설정으로 옮기기
AI_DAILY_ANALYSES = 5
AI_DAILY_QUESTIONS = 30


def get_storage(user: User) -> DashboardStorage:
    """저장 용량 (FR-131·133).

    한도 · 사용량은 users 행 그대로 (사용량은 파일을 올리고 지울 때 갱신 — Phase 2).
    종류별 사용량은 Phase 1 에 파일 표가 없어 모두 0
    (Phase 2 이후: samples · exports · stems · snapshots 표의 file_size 합계).
    프로필 사진은 사용량에 넣지 않음 (2026-10-07 결정).
    (구현: AI — 2026-10-12, 함수 하나씩 검토)
    """
    return DashboardStorage(
        quota_bytes=user.storage_quota_bytes,
        used_bytes=user.storage_used_bytes,
        by_kind=StorageByKind(),
    )


def get_ai_usage(db: Session, user: User) -> DashboardAi:
    """오늘 AI 사용량 (FR-136, PRD 05 FR-553).

    Phase 1: AI 기능(ai_analyses · assistant_messages 표)이 없어 used=0, limit=AI_DAILY_*.
    "오늘" = **UTC 0시**부터 (한국 오전 9시에 초기화) — 2026-10-12 사용자 결정 A.
    Phase 5 에서 그 시각 이후 행 수를 셀 때 db 를 씀 (그래서 지금도 매개변수로 받아 둠).
    (구현: AI — 2026-10-12, 함수 하나씩 검토)
    """
    return DashboardAi(
        analyses=UsageCount(used=0, limit=AI_DAILY_ANALYSES),
        questions=UsageCount(used=0, limit=AI_DAILY_QUESTIONS),
    )


def get_recent_projects(db: Session, user: User) -> list[RecentProject]:
    """최근 수정 프로젝트 5개 + 각 프로젝트의 최근 7일 **내** 세션 (FR-121·128).

    - 내가 멤버인 프로젝트(삭제 안 됨)를 updated_at DESC (같으면 project_id DESC — 58 과 같은 규칙)
    - 세션은 그 프로젝트들 것을 **쿼리 한 번**으로 (project_id IN (...)) — 내 것 · 7일 안
    - 요일 나누기는 화면이 브라우저 시간대로 함 → 서버는 UTC 시각 그대로 (DB.md §3.1)
    (구현: AI — 2026-10-12, 함수 하나씩 검토)
    """
    projects = db.scalars(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.project_id)
        .where(ProjectMember.user_id == user.user_id, Project.deleted_at.is_(None))
        .order_by(Project.updated_at.desc(), Project.project_id.desc())
        .limit(RECENT_PROJECT_COUNT)
    ).all()
    if not projects:
        return []

    since = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=RECENT_DAYS)
    rows = db.scalars(
        select(ProjectSession)
        .where(
            ProjectSession.project_id.in_([p.project_id for p in projects]),
            ProjectSession.user_id == user.user_id,
            ProjectSession.started_at >= since,
        )
        .order_by(ProjectSession.started_at)
    ).all()
    sessions = {p.project_id: [] for p in projects}
    for row in rows:
        sessions[row.project_id].append(
            SessionItem(
                started_at=row.started_at,
                last_seen_at=row.last_seen_at,
                active_seconds=row.active_seconds,
            )
        )

    return [
        RecentProject(
            project_id=p.project_id,
            title=p.title,
            bpm=p.bpm,
            music_key=p.music_key,
            updated_at=p.updated_at,
            sessions=sessions[p.project_id],
        )
        for p in projects
    ]


def get_ready_projects(db: Session, user: User) -> list[ReadyProject]:
    """아직 안 연 프로젝트 — 내 세션이 0개 (FR-130), 최근 생성순 3개.

    - 내가 멤버 · 삭제 안 됨 · NOT EXISTS (내 project_sessions 행) — 쿼리 한 번
    - 다른 멤버가 열었어도 **나는** 안 열었으면 포함 (58 의 opened 와 같은 기준)
    - 같은 생성 시각이면 project_id 큰 것 먼저
    (구현: AI — 2026-10-12, 함수 하나씩 검토)
    """
    opened = (
        select(ProjectSession.session_id)
        .where(
            ProjectSession.project_id == Project.project_id,
            ProjectSession.user_id == user.user_id,
        )
        .exists()
    )
    projects = db.scalars(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.project_id)
        .where(ProjectMember.user_id == user.user_id, Project.deleted_at.is_(None), ~opened)
        .order_by(Project.created_at.desc(), Project.project_id.desc())
        .limit(READY_PROJECT_COUNT)
    ).all()
    return [
        ReadyProject(
            project_id=p.project_id,
            title=p.title,
            bpm=p.bpm,
            time_sig_num=p.time_sig_num,
            time_sig_den=p.time_sig_den,
            created_at=p.created_at,
        )
        for p in projects
    ]


def get_dashboard(db: Session, user: User) -> DashboardResponse:
    """GET /me/dashboard 응답을 만든다 — 위 함수들이 만든 조각을 한 응답으로 묶는다.

    - 프로필: 닉네임 · 이메일 · 가입일 + 사진 주소 (user_service.profile_image_url, P1-08)
    - 저장 공간 · AI 사용량 · 이어 하기(ready) · 최근 프로젝트는 각각의 get_* 함수가 계산
    - 비밀번호 해시 등 나머지 User 칸은 응답에 넣지 않음 — 칸을 하나씩 골라 넣음
    (구현: AI — 2026-10-12, 함수 하나씩 검토)
    """
    return DashboardResponse(
        user=DashboardUser(
            nickname=user.nickname,
            email=user.email,
            created_at=user.created_at,
            profile_image_url=profile_image_url(user),
        ),
        storage=get_storage(user),
        ai=get_ai_usage(db, user),
        ready_projects=get_ready_projects(db, user),
        recent_projects=get_recent_projects(db, user),
    )
