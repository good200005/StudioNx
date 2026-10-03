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
"""Development 공지 서비스 — 템플릿: 구현은 직접 (P1-21). 읽기 전용 (작성은 /admin)."""

from sqlalchemy.orm import Session

from app.models import DevNote


def list_published(db: Session, limit: int) -> list[DevNote]:
    """공개된 공지 최신순 (FR-114).

    TODO(P1-21):
    - 조건: is_published = True, deleted_at IS NULL, published_at <= 지금
      (published_at 을 미래로 두면 그 시각까지 숨김 = 예약 공개)
    - 정렬: published_at DESC, note_id DESC
    - limit 개 — 인덱스 IDX(is_published, published_at) 를 그대로 탐
    """
    raise NotImplementedError


def get_published(db: Session, note_id: int) -> DevNote:
    """공개된 공지 하나. 없거나 비공개·삭제면 404.

    TODO(P1-21): raise AppError(ErrorCode.NOT_FOUND, 404, "Note not found.")
    - 초안(is_published=False)은 주소를 알아도 보이지 않아야 함
    """
    raise NotImplementedError
