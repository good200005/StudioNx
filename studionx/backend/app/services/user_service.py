"""회원 정보 서비스 — 템플릿: 구현은 직접. P1-08 조회·수정·사진, P1-09 비밀번호·탈퇴."""

from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.user import MeResponse, MeUpdateRequest

# 프로필 사진 제한 (FR-106) — 화면(userinfo.js PHOTO_TYPES · PHOTO_MAX_BYTES)과 같은 기준
PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
PHOTO_MAX_BYTES = 2 * 1024 * 1024


def profile_image_url(user: User) -> str | None:
    """화면이 <img src> 로 쓸 주소. 사진이 없으면 None.

    TODO(P1-08):
    - user.profile_image_path 가 없으면 None
    - 있으면 f"/api/v1/users/{user.user_id}/profile-image?v={updated_at 초}"
      (?v= 를 붙이면 사진을 바꿨을 때 브라우저가 캐시 대신 새 사진을 받음)
    """
    raise NotImplementedError


def to_me_response(user: User) -> MeResponse:
    """User → MeResponse. 비밀번호 해시는 넣지 않음.

    TODO(P1-08): MeResponse(user_id=..., email=..., ..., profile_image_url=profile_image_url(user))
    """
    raise NotImplementedError


def update_me(db: Session, user: User, data: MeUpdateRequest) -> User:
    """닉네임 변경 (FR-106).

    TODO(P1-08):
    - changes = data.model_dump(exclude_unset=True)
    - 닉네임이 있고 지금 닉네임과 다르면 auth_service.check_nickname 으로 확인 (P1-04)
      → available=False 이면 reason 에 따라 NICKNAME_TAKEN / REJOIN_TOO_SOON 409
        (예: raise AppError(ErrorCode.NICKNAME_TAKEN, 409, "This nickname is already in use."))
    - user.nickname = ... → db.commit() → db.refresh(user)
    - 동시에 같은 닉네임으로 바꾸는 경우: IntegrityError → rollback → 409 (P1-04 signup 과 같음)
    """
    raise NotImplementedError


async def save_profile_image(db: Session, user: User, file: UploadFile) -> User:
    """프로필 사진 저장 (FR-106, jpg/png/webp, 2MB).

    TODO(P1-08):
    1. file.content_type 이 PHOTO_TYPES 에 없으면
       raise AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, 415, "Use a JPG, PNG or WebP image.")
    2. data = await file.read(PHOTO_MAX_BYTES + 1)
       len(data) > PHOTO_MAX_BYTES 이면
       raise AppError(ErrorCode.FILE_TOO_LARGE, 413, "Images must be 2 MB or smaller.")
    3. (권장) 내용도 확인 — content_type 은 브라우저가 보낸 값이라 믿을 수 없음
       파일 앞 몇 바이트로 확인: JPG FF D8 FF / PNG 89 50 4E 47 / WebP 'RIFF' + 8~12바이트 'WEBP'
    4. 상대 경로 = f"profiles/{user.user_id}/{uuid4().hex}{확장자}"
       (DB.md §1.5 — DB에는 상대 경로만)
       실제 위치 = settings.storage_dir / 상대 경로 → 폴더 만들고(mkdir parents=True) 쓰기
    5. 예전 사진 파일이 있으면 지움 → user.profile_image_path = 상대 경로 → commit
    6. (선택) storage_used_bytes 증감 (FR-131) — 프로필 사진을 용량에 넣을지 정하기
    """
    raise NotImplementedError


def delete_profile_image(db: Session, user: User) -> User:
    """사진 지우기 (userInfo.html Remove 버튼).

    TODO(P1-08): 파일 삭제(없어도 오류 없이, missing_ok=True) → profile_image_path = None → commit
    """
    raise NotImplementedError


def profile_image_file(db: Session, user_id: int) -> Path:
    """사진 파일 경로 (GET /users/{user_id}/profile-image).

    TODO(P1-08):
    - user = db.get(User, user_id) — 사진이 없거나 탈퇴 계정이면
      raise AppError(ErrorCode.NOT_FOUND, 404, "Image not found.")
    - path = settings.storage_dir / user.profile_image_path
    - path 가 storage_dir 안인지 확인: path.resolve().is_relative_to(storage_dir.resolve())
    - return path
    """
    raise NotImplementedError
