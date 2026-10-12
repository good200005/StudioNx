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
"""/api/v1/dev-notes 라우터 (PRD 01 §7, FR-114) — 템플릿: 구현은 직접 (P1-21).

로그인 없이 읽기만. 작성·수정·공개는 관리자 화면 /admin (app/admin.py)
화면 쪽: static/js/pages/home.js loadDevNotes
"""

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import Db
from app.schemas.common import ErrorResponse
from app.schemas.dev_note import (
    DEV_NOTES_LIMIT_MAX,
    DevNoteDetail,
    DevNoteItem,
    DevNoteListResponse,
)
from app.services import dev_note_service

router = APIRouter()


@router.get("", response_model=DevNoteListResponse)
def list_dev_notes(
    db: Db,
    limit: Annotated[int, Query(ge=1, le=DEV_NOTES_LIMIT_MAX)] = 4,
) -> DevNoteListResponse:
    """공개된 공지 목록 — 메인 페이지는 limit=4 (FR-114).

    (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
    - 로그인 없이 읽기만 (CurrentUser 를 받지 않음)
    - limit 은 1 ~ 50 (밖이면 422), 목록 응답에는 본문(content)을 넣지 않음 (DevNoteItem)
    """
    notes = dev_note_service.list_published(db, limit)
    return DevNoteListResponse(
        items=[DevNoteItem.model_validate(n, from_attributes=True) for n in notes]
    )


@router.get("/{note_id}", response_model=DevNoteDetail, responses={404: {"model": ErrorResponse}})
def read_dev_note(note_id: int, db: Db) -> DevNoteDetail:
    """공지 상세 (View More 모달).

    (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
    - 공개된 공지만, 초안·삭제·예약 중·없는 번호는 404 (서비스가 판단)
    - 로그인 없이 읽기만
    """
    return DevNoteDetail.model_validate(
        dev_note_service.get_published(db, note_id), from_attributes=True
    )
