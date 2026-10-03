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
