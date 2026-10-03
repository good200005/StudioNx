"""/api/v1/dev-notes 라우터 (PRD 01 §7, FR-114) — 템플릿: 구현은 직접 (P1-21).

로그인 없이 읽기만. 작성·수정·공개는 관리자 화면 /admin (app/admin.py)
화면 쪽: static/js/pages/home.js loadDevNotes
"""

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import Db
from app.schemas.common import ErrorResponse
from app.schemas.dev_note import DEV_NOTES_LIMIT_MAX, DevNoteDetail, DevNoteListResponse

router = APIRouter()


@router.get("", response_model=DevNoteListResponse)
def list_dev_notes(
    db: Db,
    limit: Annotated[int, Query(ge=1, le=DEV_NOTES_LIMIT_MAX)] = 4,
) -> DevNoteListResponse:
    """공개된 공지 목록 — 메인 페이지는 limit=4 (FR-114).

    TODO(P1-21):
    - notes = dev_note_service.list_published(db, limit)
    - return DevNoteListResponse(items=[DevNoteItem.model_validate(n, from_attributes=True) ...])
    """
    raise NotImplementedError


@router.get("/{note_id}", response_model=DevNoteDetail, responses={404: {"model": ErrorResponse}})
def read_dev_note(note_id: int, db: Db) -> DevNoteDetail:
    """공지 상세 (View More 모달).

    TODO(P1-21): return DevNoteDetail.model_validate(
                     dev_note_service.get_published(db, note_id), from_attributes=True)
    """
    raise NotImplementedError
