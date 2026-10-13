# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-21 Development 공지 API·SQLAdmin 관리자 화면
#   브랜치  : feature/phase1/p1-21-dev-notes-admin
#   순서    : 5단계 — P1-05·P1-12 병합 후
#
# 시작 전 : git switch feature/phase1/p1-21-dev-notes-admin
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""Development 공지 응답 스키마 (PRD 01 FR-114). home.js loadDevNotes 가 씀."""

from datetime import datetime

from pydantic import BaseModel

DEV_NOTES_LIMIT_MAX = 50


class DevNoteItem(BaseModel):
    """목록 한 줄 — 메인 페이지 카드 (날짜·제목·요약)"""

    note_id: int
    title: str
    summary: str
    published_at: datetime


class DevNoteDetail(DevNoteItem):
    """상세 — View More 모달에서 본문까지"""

    content: str  # Markdown 원문. 화면에서 HTML 로 바꿀 때는 반드시 안전 처리(escape) 후 표시


class DevNoteListResponse(BaseModel):
    items: list[DevNoteItem]
