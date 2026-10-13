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

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models import DevNote


def published_filters(now: datetime) -> list:
    """메인 페이지에 보여도 되는 공지의 조건 (목록과 상세가 같은 기준을 씀).

    (구현: AI — 2026-10-13, P1-21)
    - is_published = True (초안 제외), deleted_at IS NULL (삭제 제외)
    - published_at <= now (예약 공개: 미래이면 그때까지 숨김)
      published_at 이 비어 있으면 비교가 성립하지 않아 보이지 않음 (관리자 화면이 공개할 때 채움)
    """
    return [
        DevNote.is_published.is_(True),
        DevNote.deleted_at.is_(None),
        DevNote.published_at <= now,
    ]


def list_published(db: Session, limit: int) -> list[DevNote]:
    """공개된 공지 최신순 (FR-114).

    (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
    - 조건: published_filters() — 공개, 삭제 안 됨, 공개 시각이 지남
    - 정렬: published_at DESC, note_id DESC (같은 시각이면 나중에 만든 것 먼저)
    - limit 개 — 인덱스 IDX(is_published, published_at) 를 그대로 탐
    - 지금 시각은 UTC 를 시간대 없이 (DB 에 저장된 값과 같은 기준)
    """
    now = datetime.now(UTC).replace(tzinfo=None)
    return list(
        db.scalars(
            select(DevNote)
            .where(*published_filters(now))
            .order_by(DevNote.published_at.desc(), DevNote.note_id.desc())
            .limit(limit)
        ).all()
    )


def get_published(db: Session, note_id: int) -> DevNote:
    """공개된 공지 하나. 없거나 비공개·삭제·예약 중이면 404.

    (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
    - 조건은 목록과 같은 published_filters() — 목록에 안 보이는 공지는 주소를 알아도 안 보임
    - 없는 번호와 보이면 안 되는 공지를 같은 404 로 답함 (초안이 있다는 사실도 알려 주지 않음)
    """
    now = datetime.now(UTC).replace(tzinfo=None)
    note = db.scalar(select(DevNote).where(DevNote.note_id == note_id, *published_filters(now)))
    if note is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Note not found.")
    return note
