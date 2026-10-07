# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-08 회원 정보 조회·수정·프로필 사진
#   브랜치  : feature/phase1/p1-08-user-profile-api
#   순서    : 3단계 — P1-03~05 병합 후
#
# P1-09 비밀번호 변경·회원 탈퇴
#   브랜치  : feature/phase1/p1-09-password-withdraw
#   순서    : 3단계 — P1-08 병합 후
#
# 시작 전 : git switch <위 작업 중 지금 할 작업의 브랜치>
#           (이 파일은 작업이 여럿 — 위 순서대로 한 작업씩, 각자 자기 브랜치에서)
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""/api/v1/users 라우터 (PRD 01 §7) — 템플릿: 구현은 직접.

P1-08: GET·PATCH /users/me, POST·DELETE /users/me/profile-image, GET /profile-images/{name}
      (사진 파일 주소는 회원 번호 대신 무작위 파일 이름 — 2026-10-07, 탈퇴 추적 방지 ③)
P1-09: PUT /users/me/password, DELETE /users/me (이 파일에 이어서 추가)

화면 쪽: static/js/pages/userinfo.js (P1-10), mypage.js
"""

from fastapi import APIRouter, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, Db
from app.schemas.common import ErrorResponse
from app.schemas.user import (
    MeResponse,
    MeUpdateRequest,
    PasswordChangeRequest,
    WithdrawRequest,
)
from app.services import user_service

router = APIRouter()


@router.get("/me", response_model=MeResponse, responses={401: {"model": ErrorResponse}})
def read_me(user: CurrentUser) -> MeResponse:
    """내 정보 (FR-106) — 토큰의 회원(06 CurrentUser)을 36 으로 응답.

    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    return user_service.to_me_response(user)


@router.patch(
    "/me",
    response_model=MeResponse,
    responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def update_me(data: MeUpdateRequest, user: CurrentUser, db: Db) -> MeResponse:
    """닉네임 변경 (FR-106) — 37 로 바꾸고 바뀐 정보를 36 으로 응답.

    - 형식(2~20자)은 MeUpdateRequest 가 422 로, 중복 · 탈퇴 3일은 37 이 409 로 막음
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    return user_service.to_me_response(user_service.update_me(db, user, data))


@router.post(
    "/me/profile-image",
    response_model=MeResponse,
    responses={413: {"model": ErrorResponse}, 415: {"model": ErrorResponse}},
)
async def upload_profile_image(file: UploadFile, user: CurrentUser, db: Db) -> MeResponse:
    """프로필 사진 올리기 (FR-106) — multipart/form-data, 칸 이름 file.

    - 38 로 검사 · 저장 → 새 사진 주소가 담긴 내 정보를 36 으로 응답
    - file 칸이 없으면 422 (FastAPI), 종류 415 · 크기 413 은 38
    - 화면: formData.append('file', 파일) 로 보냄 (FormData 면 api.js 가 Content-Type 을 비워 둠)
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    user = await user_service.save_profile_image(db, user, file)
    return user_service.to_me_response(user)


@router.delete("/me/profile-image", response_model=MeResponse)
def delete_profile_image(user: CurrentUser, db: Db) -> MeResponse:
    """프로필 사진 지우기 → 화면은 닉네임 첫 글자로 돌아감.

    - 39 로 지우고 내 정보(사진 주소 null)를 36 으로 응답. 사진이 없어도 200
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    return user_service.to_me_response(user_service.delete_profile_image(db, user))


# 사진 파일 — /api/v1/profile-images/{name} (회원 번호가 아니라 무작위 파일 이름, 2026-10-07)
# /users 아래가 아니라서 라우터를 따로 둠 → router.py 에서 prefix="/profile-images" 로 붙임
images_router = APIRouter()

# 확장자 → 응답 종류 (PHOTO_TYPES 를 뒤집음: ".jpg" → "image/jpeg")
PHOTO_MEDIA_TYPES = {ext: media for media, ext in user_service.PHOTO_TYPES.items()}


@images_router.get(
    "/{name}",
    response_class=FileResponse,
    responses={404: {"model": ErrorResponse}},
)
def read_profile_image(name: str, db: Db) -> FileResponse:
    """프로필 사진 파일 (<img src> 용 — 로그인 없이 읽음. 협업 화면에서 다른 멤버 사진도 씀).

    - <img> 요청에는 Authorization 헤더를 붙일 수 없으므로 로그인 확인을 하지 않음
      → 대신 주소가 무작위 32자라 이름을 모르면 볼 수 없음 (35)
    - 40 이 찾은 파일을 보냄. 이름 모양 · 탈퇴 · 파일 없음은 모두 404
    - Content-Type 은 확장자로 정함 (38 이 내용대로 확장자를 붙였음)
    - X-Content-Type-Options: nosniff — 브라우저가 내용을 보고 종류를 바꿔 추측하지 않게 (38 §5)
    - Cache-Control 1일 — 사진을 바꾸면 이름이 바뀌어 새로 받음.
      지운 사진도 하루 뒤엔 캐시에서 사라짐
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    path = user_service.profile_image_file(db, name)
    return FileResponse(
        path,
        media_type=PHOTO_MEDIA_TYPES[path.suffix],
        headers={"Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff"},
    )


# ── P1-09 비밀번호 변경 · 회원 탈퇴 ──────────────────────────────


@router.put(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={400: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def change_password(data: PasswordChangeRequest, user: CurrentUser, db: Db) -> None:
    """비밀번호 변경 (FR-107).

    TODO(P1-09): user_service.change_password(db, user, data.current_password, data.new_password)
    - 화면: 400 WRONG_PASSWORD → 'Current password is incorrect.' (#pw-current-field)
    """
    raise NotImplementedError


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={400: {"model": ErrorResponse}},
)
def withdraw(data: WithdrawRequest, response: Response, user: CurrentUser, db: Db) -> None:
    """회원 탈퇴 (FR-108) — 본문 {"password": "..."}.

    TODO(P1-09):
    - user_service.withdraw(db, user, data.password)
    - 리프레시 쿠키도 지움: auth.clear_refresh_cookie(response)  (api/v1/auth.py, P1-05)
    - 화면: 성공하면 clearAccessToken() → home.html
    """
    raise NotImplementedError
