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
