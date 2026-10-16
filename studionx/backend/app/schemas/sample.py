"""샘플 API 요청·응답 스키마 (PRD 02 §4.2, FR-221~227) — 라이브러리 패널과 이름을 맞춤.

업로드 응답(SampleResponse)과 목록(SampleListResponse)이 같은 한 줄 모양을 쓰고,
이름 변경 요청(SampleUpdateRequest)과 태그 설정 요청(SampleTagsRequest)이 여기에 더해진다.
태그 한 줄 모양(TagItem)은 태그 목록(GET /tags)과 함께 쓰므로 schemas/tag.py 에서 가져온다.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.schemas.tag import TagItem  # 태그 한 줄 모양은 샘플 응답과 태그 목록이 함께 쓴다

SAMPLE_PAGE_SIZE_MAX = 50  # 한 번에 받을 수 있는 최대 개수 (화면은 10)
SAMPLE_NAME_MAX = 200  # samples.name 칸 길이(DB VARCHAR(200))와 같음

# 태그 번호 — 1 이상 (tags.tag_id 는 1부터 시작하는 자동 번호)
TagId = Annotated[int, Field(ge=1)]

# 이름 — 앞뒤 공백을 먼저 지우고 길이를 잼 → 공백만 친 이름은 422 (ProjectTitle 과 같은 방법)
SampleName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=SAMPLE_NAME_MAX)
]


class SampleResponse(BaseModel):
    """올린 샘플 한 건 — 업로드 응답이며, 목록(FR-224)의 한 줄로도 쓴다.

    파일 자체의 주소(file_url)·파형 주소는 넣지 않는다. 그 라우터(GET /samples/{id}/file,
    /waveform)를 만든 뒤에 칸을 더한다.
    `tags` 는 붙어 있는 태그이며, 아직 태그가 없으면 빈 목록이다.
    """

    sample_id: int
    name: str
    original_filename: str
    file_size: int
    mime_type: str
    duration_ms: int | None
    sample_rate: int | None
    channels: int | None
    bpm: Decimal | None
    music_key: str | None
    source: str
    created_at: datetime
    tags: list[TagItem] = []


class SampleListResponse(BaseModel):
    """GET /samples — { items, total, page, size } (프로젝트 목록과 같은 모양)."""

    items: list[SampleResponse]
    total: int
    page: int
    size: int


class SampleUpdateRequest(BaseModel):
    """PATCH /samples/{id} (FR-225) — 지금은 이름만. 보내지 않은 칸은 바꾸지 않음.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    이름에 null 을 보내면 422 입니다(이름은 비울 수 없음). 공백만 친 이름도 422 입니다
    (앞뒤 공백을 지운 뒤 min_length=1 검사). ProjectUpdateRequest 와 같은 방식입니다.
    """

    name: SampleName | None = None

    @field_validator("name")
    @classmethod
    def _name_not_null(cls, value: str | None) -> str:
        # 보내지 않으면 이 검사는 돌지 않음 (기본값은 검사하지 않음) → null 을 직접 보낸 경우만
        if value is None:
            raise ValueError("name cannot be empty")
        return value


class SampleTagsRequest(BaseModel):
    """PUT /samples/{id}/tags (FR-225) — 태그 번호 목록으로 통째 교체.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    보낸 목록이 그 샘플에 붙는 태그의 전부가 됩니다. 지금 붙어 있던 것은 떼고 새로 붙입니다.
    빈 목록(`[]`)은 태그를 모두 떼는 뜻입니다. 없는 태그 번호가 하나라도 있으면 422입니다.
    """

    tag_ids: list[TagId] = []
