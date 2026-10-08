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
"""프로젝트 API 요청·응답 스키마 (PRD 01 §7, FR-122~126). myproject.js 와 이름을 맞춤."""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

PROJECT_PAGE_SIZE_MAX = 50  # 한 번에 받을 수 있는 최대 개수 (화면은 10)
PROJECT_TITLE_MAX = 100  # 화면 #new-title · #edit-title maxlength 와 같음
PROJECT_DESCRIPTION_MAX = 500  # 화면 #new-description · #edit-description maxlength 와 같음
TIME_SIG_DENOMINATORS = (1, 2, 4, 8, 16, 32)  # 박자 아래 숫자 (음표 길이)

# 제목 — 앞뒤 공백을 먼저 지우고 길이를 잼 → 공백만 친 제목은 422 (문의 InquiryTitle 과 같은 방법)
ProjectTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=PROJECT_TITLE_MAX)
]
# 설명 — 앞뒤 공백을 지움. 비면 None 으로 (아래 _empty_to_none) → "설명 지우기" 는 빈 칸으로
ProjectDescription = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=PROJECT_DESCRIPTION_MAX)
]


class ProjectSort(StrEnum):
    """목록 정렬 — myProject.html #project-sort 의 value 와 같음"""

    UPDATED = "updated"  # 최근 수정순 (기본, FR-123)
    TITLE = "title"  # 이름순
    CREATED = "created"  # 만든 순


class ProjectCreateRequest(BaseModel):
    """POST /projects (FR-122) — 새 프로젝트 모달

    화면의 '7/8' 은 JS 가 time_sig_num=7, time_sig_den=8 로 나눠서 보냄
    (구현: AI — 2026-10-08, 함수 하나씩 검토) 제목 · 설명은 앞뒤 공백을 지운 뒤 검사,
    빈 설명은 None, 박자 아래 숫자는 1·2·4·8·16·32 만 — 틀리면 422 VALIDATION_ERROR
    """

    title: ProjectTitle
    description: ProjectDescription | None = None
    bpm: Decimal = Field(default=Decimal("120"), ge=20, le=999, decimal_places=2)
    time_sig_num: int = Field(default=4, ge=1, le=32)
    time_sig_den: int = Field(default=4)

    @field_validator("description")
    @classmethod
    def _empty_to_none(cls, value: str | None) -> str | None:
        return value or None  # 공백만 친 설명 → "" → None

    @field_validator("time_sig_den")
    @classmethod
    def _check_den(cls, value: int) -> int:
        if value not in TIME_SIG_DENOMINATORS:
            raise ValueError("must be one of 1, 2, 4, 8, 16, 32")
        return value


class ProjectUpdateRequest(BaseModel):
    """PATCH /projects/{id} (FR-124) — 제목·설명만. 보내지 않은 칸은 바꾸지 않음

    (구현: AI — 2026-10-08) 제목에 null 을 보내면 422 (제목은 비울 수 없음),
    설명은 null 이나 빈 칸이면 지움 (None)
    """

    title: ProjectTitle | None = None
    description: ProjectDescription | None = None

    @field_validator("title")
    @classmethod
    def _title_not_null(cls, value: str | None) -> str:
        # 보내지 않으면 이 검사는 돌지 않음 (기본값은 검사하지 않음) → null 을 직접 보낸 경우만
        if value is None:
            raise ValueError("title cannot be empty")
        return value

    @field_validator("description")
    @classmethod
    def _empty_to_none(cls, value: str | None) -> str | None:
        return value or None


class ProjectItem(BaseModel):
    """목록 한 줄 · 상세 응답 (myproject.js renderProjects 가 쓰는 칸)"""

    project_id: int
    title: str
    description: str | None
    bpm: Decimal
    time_sig_num: int
    time_sig_den: int
    music_key: str | None
    created_at: datetime
    updated_at: datetime
    my_role: str  # 'OWNER' | 'EDITOR' | 'VIEWER' — 요청한 사람 기준
    member_count: int
    opened: bool  # 내 작업 세션(project_sessions)이 1개 이상 (FR-130 Not opened 표시)


class ProjectListResponse(BaseModel):
    """GET /projects — { items, total, page, size }"""

    items: list[ProjectItem]
    total: int
    page: int
    size: int
