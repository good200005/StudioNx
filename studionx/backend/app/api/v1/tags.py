# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] S1-07 샘플 라이브러리 — 태그 API
#
# S1-07 샘플 라이브러리 (FR-224·225)
#   브랜치  : feature/phase1/s1-07-sample-library
#   순서    : 샘플 관리(189~191) 뒤 태그 목록
#
# 시작 전 : git switch feature/phase1/s1-07-sample-library
# 끝나면  : PR → develop (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""/api/v1/tags 라우터 (PRD 02 §7, FR-224·225).

- `GET /tags` 태그 목록 — 분류 · 이름 순 (라이브러리 패널 필터용)

태그는 기본 제공이라 읽기만 있다. 만들기·고치기·지우기는 화면 기획이 정해지면 추가한다.

화면 쪽: 라이브러리 패널 태그 필터 (드롭다운·칩)
서비스: services/tag_service.py list_tags(192)
"""

from fastapi import APIRouter

from app.api.deps import CurrentUser, Db
from app.schemas.tag import TagListResponse
from app.services import tag_service

router = APIRouter()


@router.get("", response_model=TagListResponse)
def list_tags(user: CurrentUser, db: Db) -> TagListResponse:
    """태그 목록 (FR-224) — 분류(GENRE · INSTRUMENT · MOOD · ETC) · 이름 순.

    - 화면: 라이브러리 패널을 열 때 불러 태그 필터를 채운다
    - 각 항목에 category 가 있어 화면이 분류별로 나눠 그린다 (따로 묶어 주지 않음)
    - 태그 붙이기·떼기(190)는 여기서 받은 tag_id 를 그대로 보낸다
    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)
    """
    return tag_service.list_tags(db)
