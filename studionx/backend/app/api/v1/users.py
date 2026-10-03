"""/api/v1/users 라우터 (PRD 01 §7) — 템플릿: 구현은 직접.

P1-08: GET·PATCH /users/me, POST·DELETE /users/me/profile-image, GET /users/{user_id}/profile-image
P1-09: PUT /users/me/password, DELETE /users/me (이 파일에 이어서 추가)

화면 쪽: static/js/pages/userinfo.js (P1-10), mypage.js
"""

from fastapi import APIRouter, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, Db
from app.schemas.common import ErrorResponse
from app.schemas.user import MeResponse, MeUpdateRequest

router = APIRouter()


@router.get("/me", response_model=MeResponse, responses={401: {"model": ErrorResponse}})
def read_me(user: CurrentUser) -> MeResponse:
    """내 정보 (FR-106).

    TODO(P1-08): return user_service.to_me_response(user)
    """
    raise NotImplementedError


@router.patch(
    "/me",
    response_model=MeResponse,
    responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def update_me(data: MeUpdateRequest, user: CurrentUser, db: Db) -> MeResponse:
    """닉네임 변경 (FR-106).

    TODO(P1-08): user = user_service.update_me(db, user, data) → to_me_response(user)
    """
    raise NotImplementedError


@router.post(
    "/me/profile-image",
    response_model=MeResponse,
    responses={413: {"model": ErrorResponse}, 415: {"model": ErrorResponse}},
)
async def upload_profile_image(file: UploadFile, user: CurrentUser, db: Db) -> MeResponse:
    """프로필 사진 올리기 (FR-106) — multipart/form-data, 칸 이름 file.

    TODO(P1-08): user = await user_service.save_profile_image(db, user, file) → to_me_response
    - 화면: formData.append('file', 파일) 로 보냄 (FormData 면 api.js 가 Content-Type 을 비워 둠)
    """
    raise NotImplementedError


@router.delete("/me/profile-image", response_model=MeResponse)
def delete_profile_image(user: CurrentUser, db: Db) -> MeResponse:
    """프로필 사진 지우기 → 화면은 닉네임 첫 글자로 돌아감.

    TODO(P1-08): user = user_service.delete_profile_image(db, user) → to_me_response(user)
    """
    raise NotImplementedError


@router.get(
    "/{user_id}/profile-image",
    response_class=FileResponse,
    responses={404: {"model": ErrorResponse}},
)
def read_profile_image(user_id: int, db: Db) -> FileResponse:
    """프로필 사진 파일 (<img src> 용 — 로그인 없이 읽음. 협업 화면에서 다른 멤버 사진도 씀).

    TODO(P1-08): return FileResponse(user_service.profile_image_file(db, user_id))
    - <img> 요청에는 Authorization 헤더를 붙일 수 없으므로 로그인 확인을 하지 않음
    - (선택) headers={"Cache-Control": "public, max-age=86400"} — 주소에 ?v= 가 붙어 있어 안전
    """
    raise NotImplementedError
