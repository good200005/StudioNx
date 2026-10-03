# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-03 백엔드 공통 — 모델 컬럼·오류 처리기·토큰 검사·get_current_user
#   브랜치  : feature/phase1/p1-03-backend-core
#   순서    : 1단계 — 가장 먼저 (나머지 API가 모두 이 작업을 씀)
#
# 시작 전 : git switch feature/phase1/p1-03-backend-core
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""라우터 공통 의존성 — 뼈대: 구현은 직접 (P1-03).

로그인이 필요한 API:
    @router.get("/users/me")
    def read_me(user: CurrentUser): ...            # CurrentUser = 아래 Annotated 별칭
"""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User

# Authorization: Bearer <access token> 헤더를 읽음. auto_error=False → 없으면 None (직접 401 처리)
bearer_scheme = HTTPBearer(auto_error=False)
Bearer = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]
Db = Annotated[Session, Depends(get_db)]


def get_current_user(
    credentials: Bearer,
    db: Db,
) -> User:
    """요청한 사용자를 돌려준다. 로그인이 안 됐으면 401.

    TODO:
    1. credentials 가 없으면 raise AppError(ErrorCode.UNAUTHORIZED, 401, "Please sign in.")
    2. user_id = decode_access_token(credentials.credentials)   (core/security.py)
    3. user = db.get(User, user_id)
    4. user 가 없거나 status != 'ACTIVE' 이면
       raise AppError(ErrorCode.UNAUTHORIZED, 401, ...)  — 탈퇴 계정 차단 (FR-108)
    5. return user
    - 프론트(P1-02)는 401 + code=UNAUTHORIZED 를 받으면 /auth/refresh 로 재발급 후 한 번 다시 요청
    """
    raise NotImplementedError


def get_current_user_optional(
    credentials: Bearer,
    db: Db,
) -> User | None:
    """로그인은 선택인 API용 (예: 문의 등록 — 로그인 상태면 user_id 연결, FR-112).

    TODO: credentials 가 없으면 None, 있으면 get_current_user 와 같은 검사 (실패하면 None)
    """
    raise NotImplementedError


# 라우터에서 짧게 쓰기 위한 별칭
CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_current_user_optional)]
