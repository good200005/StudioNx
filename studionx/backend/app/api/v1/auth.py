# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-04 회원가입 — signup·이메일/닉네임 중복 확인·탈퇴 3일 규칙
#   브랜치  : feature/phase1/p1-04-signup-api
#   순서    : 2단계 — P1-03 병합 후
#
# P1-05 로그인·토큰 재발급·로그아웃
#   브랜치  : feature/phase1/p1-05-login-jwt
#   순서    : 2단계 — P1-03·P1-04 병합 후
#
# 시작 전 : git switch <위 작업 중 지금 할 작업의 브랜치>
#           (이 파일은 작업이 여럿 — 위 순서대로 한 작업씩, 각자 자기 브랜치에서)
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""/api/v1/auth 라우터 (PRD 01 §7) — 템플릿: 구현은 직접.

P1-04: signup, check-email, check-nickname
P1-05: login, refresh, logout (이 파일에 이어서 추가)

화면 쪽: static/js/pages/join.js (P1-07)
"""

from typing import Annotated

from fastapi import APIRouter, Cookie, Query, Request, Response, status
from pydantic import EmailStr

from app.api.deps import Db
from app.api.v1.inquiries import client_ip
from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode, error_json
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token_with_iat,
    issued_before_password_change,
)
from app.schemas.auth import (
    PASSWORD_RESET_REQUEST_MESSAGE,
    AvailabilityResponse,
    LoginRequest,
    Nickname,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    SignupRequest,
    SignupResponse,
    TokenResponse,
)
from app.schemas.common import ErrorResponse
from app.services import auth_service, password_reset_service

router = APIRouter()

# 리프레시 쿠키 (FR-105·109) — /auth 아래 요청에만 실리도록 path 를 좁힘
REFRESH_COOKIE = "snx_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"


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
    user = auth_service.signup(db, data)
    return SignupResponse(user_id=user.user_id, email=user.email, nickname=user.nickname)


@router.get("/check-email", response_model=AvailabilityResponse)
def check_email(db: Db, email: Annotated[EmailStr, Query(max_length=255)]) -> AvailabilityResponse:
    """이메일 중복 확인 (FR-101 실시간 확인).

    TODO(P1-04): return auth_service.check_email(db, email)
    - 탈퇴 후 3일 안이면 available=false, reason='REJOIN_TOO_SOON', available_at (FR-108)
    - 형식이 틀린 이메일은 422 (2026-10-07 결정 — available=false 아님, 가입과 같은 EmailStr 규칙)
    """
    return auth_service.check_email(db, email)


@router.get("/check-nickname", response_model=AvailabilityResponse)
def check_nickname(
    db: Db,
    nickname: Annotated[Nickname, Query()],
) -> AvailabilityResponse:
    """닉네임 중복 확인 (FR-101). 회원 정보 화면(userinfo.js)도 같은 API 사용.

    TODO(P1-04): return auth_service.check_nickname(db, nickname)
    - (구현: AI — 2026-10-07) 가입과 같은 Nickname 타입 — 공백 제거 후 2~20자, 아니면 422
    """
    return auth_service.check_nickname(db, nickname)


# ── P1-05 로그인 · 재발급 · 로그아웃 ──────────────────────────────


def set_refresh_cookie(response: Response, token: str, remember: bool) -> None:
    """리프레시 토큰을 HttpOnly 쿠키로 심는다 (FR-105·109).

    TODO(P1-05):
    response.set_cookie(
        key=REFRESH_COOKIE, value=token, path=REFRESH_COOKIE_PATH,
        httponly=True,                          # JS 에서 읽을 수 없음 (XSS 대비)
        samesite="lax",                         # 다른 사이트에서 보낸 POST 에는 안 실림 (CSRF 대비)
        secure=settings.app_env == "prod",      # 배포(HTTPS)에서만 secure
        max_age=jwt_refresh_days * 86400 if remember else None,
    )
    - remember=False → max_age 없음 = 세션 쿠키 (브라우저를 닫으면 사라짐)
    - remember=True  → 3일 유지 (브라우저를 닫아도 자동 로그인)
    """
    settings = get_settings()
    if remember:
        max_age = settings.jwt_refresh_days * 24 * 60 * 60
    else:
        max_age = None
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=settings.app_env == "prod",
        max_age=max_age,
    )


def clear_refresh_cookie(response: Response) -> None:
    """TODO(P1-05): response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
    - path 가 set_cookie 와 같아야 지워짐
    - (구현: AI — 2026-10-07) httponly · samesite · secure 도 심을 때와 같게
    """
    response.delete_cookie(
        REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=get_settings().app_env == "prod",
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
def login(data: LoginRequest, response: Response, db: Db) -> TokenResponse:
    """로그인 (FR-103·105·109).

    TODO(P1-05):
    - user = auth_service.authenticate(db, data.email, data.password)
    - set_refresh_cookie(response, create_refresh_token(user.user_id), data.remember)
    - return TokenResponse(access_token=create_access_token(user.user_id),
                           expires_in=jwt_access_minutes * 60)
    - 화면: access_token 을 api.js setAccessToken 으로 메모리에만 보관
    """
    user = auth_service.authenticate(db, data.email, data.password)
    set_refresh_cookie(response, create_refresh_token(user.user_id), data.remember)
    return TokenResponse(
        access_token=create_access_token(user.user_id),
        expires_in=get_settings().jwt_access_minutes * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={401: {"model": ErrorResponse}},
)
def refresh(
    response: Response,
    db: Db,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> TokenResponse:
    """Access Token 재발급 (FR-105). 페이지를 옮길 때마다 api.js 가 먼저 부름.

    TODO(P1-05):
    1. 쿠키가 없으면 raise AppError(ErrorCode.UNAUTHORIZED, 401, "Please sign in.")
       - 비로그인 상태에서도 매 페이지 부르므로 401 은 정상 흐름 (화면은 '로그인 안 됨'으로 처리)
    2. user_id = decode_refresh_token(refresh_token)
    3. user = auth_service.get_active_user(db, user_id)
    4. 새 Access Token 을 돌려줌
       - (선택) 리프레시 토큰도 새로 발급해 쿠키를 갈아 끼우기(rotation) — 이때 remember 여부를
         알 수 없으므로 토큰 payload 에 "remember": true/false 를 함께 넣어 두면 됨
    - Cookie(alias=REFRESH_COOKIE): 쿠키 이름 snx_refresh 를 refresh_token 으로 받음
    - (구현: AI — 2026-10-07) 리프레시 토큰 교체(rotation)는 하지 않음 — 로그인 후 3일이면 끝
    - (P1-28) 비밀번호 재설정 이전에 발급된 토큰이면 401 + 쿠키 삭제 (이전 기기의 재발급을 막음)
    """
    if refresh_token is None:
        raise AppError(ErrorCode.UNAUTHORIZED, 401, "Please sign in.")
    user_id, issued_at = decode_token_with_iat(refresh_token, "refresh")
    user = auth_service.get_active_user(db, user_id)
    # 비밀번호를 재설정하기 전에 발급된 로그인은 재발급도 거부 (P1-28, FR-118)
    # AppError 를 던지면 응답 헤더(쿠키 삭제)가 버려져서 같은 모양의 401 응답을 직접 돌려준다
    if issued_before_password_change(issued_at, user.password_changed_at):
        stale = error_json(401, ErrorCode.UNAUTHORIZED, "Please sign in again.")
        clear_refresh_cookie(stale)  # 무효가 된 쿠키를 브라우저가 매번 보내지 않게 지움
        return stale
    return TokenResponse(
        access_token=create_access_token(user.user_id),
        expires_in=get_settings().jwt_access_minutes * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    """로그아웃 (FR-104).

    TODO(P1-05):
    - clear_refresh_cookie(response)
    - Access Token 은 서버에 저장하지 않으므로 화면(auth.js)이 clearAccessToken 으로 지움
    - PRD 01 §7 표에는 인증 ✔ 로 되어 있지만, Access Token 이 이미 만료된 상태에서도
      쿠키는 지워져야 하므로 로그인 확인 없이 받는 쪽을 권장 (쿠키만 지우므로 위험 없음)
    - (구현: AI — 2026-10-07) 권장대로 로그인 확인 없이 받음
    """
    clear_refresh_cookie(response)


@router.post(
    "/password-reset/request",
    response_model=PasswordResetRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
def password_reset_request(
    data: PasswordResetRequest, request: Request, db: Db
) -> PasswordResetRequestResponse:
    """비밀번호 재설정 메일 요청 (FR-118). 로그인 없이 부른다.

    - **가입 여부와 관계없이 항상 같은 202 와 같은 본문**: 응답으로 가입된 주소를 알아낼 수 없다
      (없는 주소, 탈퇴, 정지 계정도 같다. 메일은 가입된 ACTIVE 계정에만 간다)
    - 오류는 두 가지뿐이다: 이메일 형식이 틀리면 422, 요청이 잦으면 429 (가입 여부와 무관하게 센다)
    - 서비스: `password_reset_service.request_password_reset` (횟수 제한, 토큰, 메일)
    """
    password_reset_service.request_password_reset(db, data.email, client_ip(request))
    return PasswordResetRequestResponse(message=PASSWORD_RESET_REQUEST_MESSAGE)


@router.post(
    "/password-reset/confirm",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
def password_reset_confirm(data: PasswordResetConfirm, db: Db) -> None:
    """메일 링크의 토큰과 새 비밀번호로 비밀번호를 바꾼다 (FR-118). 로그인 없이 부른다.

    - 성공하면 204 (본문 없음). **자동 로그인은 하지 않는다**: 재설정한 사람이 새 비밀번호로
      직접 로그인한다 (메일 링크만 가진 사람이 곧바로 로그인되는 일을 막음, 2026-10-15 결정)
    - 링크가 틀렸거나 만료됐거나 이미 썼으면 400 INVALID_RESET_LINK (이유를 알려 주지 않는 같은
      문구), 새 비밀번호가 규칙에 맞지 않으면 422 + details.new_password (링크는 그대로 쓸 수 있음)
    - 이 API 에는 횟수 제한을 두지 않는다: 토큰이 256비트 무작위라 추측할 수 없고(요청 API 가
      막는 것은 메일 폭탄), 틀린 토큰은 DB 조회 한 번으로 끝난다
    - 서비스: `password_reset_service.reset_password`
    """
    password_reset_service.reset_password(db, data.token, data.new_password)
