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

from sqlalchemy.orm import Session

from app.models import User
from app.schemas.dashboard import (
    DashboardAi,
    DashboardResponse,
    DashboardStorage,
    ReadyProject,
    RecentProject,
)

RECENT_PROJECT_COUNT = 5  # 최근 프로젝트 개수 (FR-121)
RECENT_DAYS = 7  # 작업 시간을 보여 줄 기간 (FR-128)
READY_PROJECT_COUNT = 3  # 배너용 — 화면은 가장 최근 1개를 보여 줌

# AI 일일 한도 (PRD 05 FR-551) — 지금은 고정값, 나중에 core/config.py 설정으로 옮기기
AI_DAILY_ANALYSES = 5
AI_DAILY_QUESTIONS = 30


def get_storage(user: User) -> DashboardStorage:
    """저장 용량 (FR-131·133).

    TODO(P1-16):
    - quota_bytes = user.storage_quota_bytes, used_bytes = user.storage_used_bytes
    - by_kind = StorageByKind()  — Phase 1 에는 파일 테이블이 없어 0
      (Phase 2 이후: samples·exports·stems·snapshots 테이블의 file_size 합계)
    """
    raise NotImplementedError


def get_ai_usage(db: Session, user: User) -> DashboardAi:
    """오늘 AI 사용량 (FR-136, PRD 05 FR-553).

    TODO(P1-16):
    - Phase 1: used=0, limit=AI_DAILY_* 로 돌려줌 (ai_analyses, assistant_messages 모델이 아직 없음)
    - Phase 5: 오늘 0시(UTC 또는 사용자 시간대 — 정하기) 이후 행 수를 셈
    """
    raise NotImplementedError


def get_recent_projects(db: Session, user: User) -> list[RecentProject]:
    """최근 수정 프로젝트 5개 + 각 프로젝트의 최근 7일 **내** 세션 (FR-121·128).

    TODO(P1-16):
    1. 내가 멤버인 프로젝트 (deleted_at IS NULL) 를 updated_at DESC 로 RECENT_PROJECT_COUNT 개
    2. 그 프로젝트들의 ProjectSession 중
       user_id == user.user_id 이고 started_at >= 지금 - RECENT_DAYS 일 인 행을 한 번에 조회
       (project_id IN (...) — 프로젝트마다 따로 조회하지 않기)
    3. project_id 별로 묶어 RecentProject(sessions=[...]) 로
    - 요일 나누기는 화면이 브라우저 시간대로 함 → 서버는 UTC 시각 그대로 보냄 (DB.md §3.1 메모)
    """
    raise NotImplementedError


def get_ready_projects(db: Session, user: User) -> list[ReadyProject]:
    """아직 안 연 프로젝트 — 내 세션이 0개 (FR-130), 최근 생성순.

    TODO(P1-16):
    - 내가 멤버인 프로젝트 중
      NOT EXISTS (select 1 from project_sessions where project_id = p.project_id
                  and user_id = 나) 인 것
    - created_at DESC, READY_PROJECT_COUNT 개
    """
    raise NotImplementedError


def get_dashboard(db: Session, user: User) -> DashboardResponse:
    """GET /me/dashboard — 위 함수들을 모아 한 번에 돌려줌.

    TODO(P1-16):
    - user 칸: user_service.profile_image_url (P1-08) 재사용
    - return DashboardResponse(user=..., storage=get_storage(user), ai=get_ai_usage(db, user),
                               ready_projects=..., recent_projects=...)
    """
    raise NotImplementedError
