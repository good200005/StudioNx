"""태그 서비스 — S1-07 샘플 라이브러리 (FR-224·225).

태그는 앱이 미리 넣어 둔 기본 제공(is_system) 목록이라 만들기·고치기 없이 읽기만 한다.
라이브러리 패널의 태그 필터가 이 목록을 쓰고, 태그 붙이기(190)는 번호(tag_id)로 한다.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Tag
from app.schemas.tag import TagItem, TagListResponse


def list_tags(db: Session) -> TagListResponse:
    """태그 목록 (FR-224) — 분류 · 이름 순.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    tags.category 는 MySQL ENUM 이라 분류 순서가 정의된 차례(GENRE · INSTRUMENT · MOOD · ETC)로
    정렬된다. 같은 분류 안에서는 이름순이다. 화면은 category 로 나눠 그린다.
    """
    rows = db.scalars(select(Tag).order_by(Tag.category, Tag.name)).all()
    return TagListResponse(
        items=[
            TagItem(tag_id=tag.tag_id, name=tag.name, category=tag.category)
            for tag in rows
        ]
    )
