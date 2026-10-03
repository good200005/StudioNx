"""마이페이지 대시보드 응답 스키마 (PRD 01 FR-121·128·130·133·136).

칸 이름은 static/js/pages/mypage.js loadDashboard 주석의 응답 예시와 같음
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class DashboardUser(BaseModel):
    nickname: str
    email: str
    created_at: datetime
    profile_image_url: str | None


class StorageByKind(BaseModel):
    """종류별 사용량 (바이트). Phase 1 에는 파일이 없으므로 모두 0"""

    samples: int = 0
    exports: int = 0
    stems: int = 0
    snapshots: int = 0


class DashboardStorage(BaseModel):
    quota_bytes: int
    used_bytes: int
    by_kind: StorageByKind


class UsageCount(BaseModel):
    used: int
    limit: int


class DashboardAi(BaseModel):
    """오늘 기준 AI 사용량 (FR-136). Phase 5 전에는 used=0, limit=설정값"""

    analyses: UsageCount
    questions: UsageCount


class SessionItem(BaseModel):
    started_at: datetime
    last_seen_at: datetime
    active_seconds: int


class RecentProject(BaseModel):
    """최근 수정 프로젝트 + 최근 7일 내 세션 (FR-121·128)"""

    project_id: int
    title: str
    bpm: Decimal
    music_key: str | None
    updated_at: datetime
    sessions: list[SessionItem]


class ReadyProject(BaseModel):
    """아직 시퀀서에서 안 연 프로젝트 (내 세션 0개, FR-130)"""

    project_id: int
    title: str
    bpm: Decimal
    time_sig_num: int
    time_sig_den: int
    created_at: datetime


class DashboardResponse(BaseModel):
    """GET /me/dashboard"""

    user: DashboardUser
    storage: DashboardStorage
    ai: DashboardAi
    ready_projects: list[ReadyProject]
    recent_projects: list[RecentProject]
