"""태그 API 스키마 (PRD 02 §7, FR-224·225) — 라이브러리 패널 필터와 이름을 맞춤.

목록은 태그를 분류(GENRE · INSTRUMENT · MOOD · ETC)별로 묶어 보여 주므로, 각 항목에
`category` 가 함께 온다. 화면이 그 값으로 나눠 그린다.
"""

from pydantic import BaseModel


class TagItem(BaseModel):
    """태그 한 개 — 목록에서 샘플마다 붙어 오는 태그와, 태그 목록(GET /tags) 공통.

    `category` 는 GENRE · INSTRUMENT · MOOD · ETC (TagCategory). 화면은 분류로 나눠 보여 준다.
    """

    tag_id: int
    name: str
    category: str


class TagListResponse(BaseModel):
    """GET /tags — { items: [...] } (분류 · 이름 순).

    분류별로 묶지 않고 평평한 목록으로 준다. 각 항목의 `category` 로 화면이 나눠 그리므로
    서버가 묶는 모양을 정하지 않아도 되고, 태그가 늘어도 응답 모양이 바뀌지 않는다.
    """

    items: list[TagItem]
