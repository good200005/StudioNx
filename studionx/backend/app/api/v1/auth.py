"""/api/v1/auth 라우터 (PRD 01 §7) — 템플릿: 구현은 직접.

P1-04: signup, check-email, check-nickname
P1-05: login, refresh, logout (이 파일에 이어서 추가)

화면 쪽: static/js/pages/join.js (P1-07)
"""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import Db
from app.schemas.auth import (
    NICKNAME_MAX,
    AvailabilityResponse,
    SignupRequest,
    SignupResponse,
)
from app.schemas.common import ErrorResponse

router = APIRouter()


@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def signup(data: SignupRequest, db: Db) -> SignupResponse:
    """회원가입 (FR-101~102).

    TODO(P1-04):
    - user = auth_service.signup(db, data)
    - return SignupResponse(user_id=user.user_id, email=user.email, nickname=user.nickname)
    - 가입 후 자동 로그인은 하지 않음 → 화면이 home.html#login 으로 보내 로그인 모달을 엶 (join.js)
    """
    raise NotImplementedError


@router.get("/check-email", response_model=AvailabilityResponse)
def check_email(db: Db, email: Annotated[str, Query(max_length=255)]) -> AvailabilityResponse:
    """이메일 중복 확인 (FR-101 실시간 확인).

    TODO(P1-04): return AvailabilityResponse(available=not auth_service.is_email_taken(db, email))
    - 형식이 틀린 이메일은 422 로 돌려줄지, available=false 로 돌려줄지 정하기
      (화면은 형식을 먼저 검사하므로 422 권장)
    """
    raise NotImplementedError


@router.get("/check-nickname", response_model=AvailabilityResponse)
def check_nickname(
    db: Db,
    nickname: Annotated[str, Query(max_length=NICKNAME_MAX)],
) -> AvailabilityResponse:
    """닉네임 중복 확인 (FR-101). 회원 정보 화면(userinfo.js)도 같은 API 사용.

    TODO(P1-04):
    - taken = auth_service.is_nickname_taken(db, nickname)
    - return AvailabilityResponse(available=not taken)
    """
    raise NotImplementedError
