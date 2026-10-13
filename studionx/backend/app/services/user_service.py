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
"""회원 정보 서비스 — 템플릿: 구현은 직접. P1-08 조회·수정·사진, P1-09 비밀번호·탈퇴."""

import re
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.core.security import check_password_rules, hash_password, verify_password
from app.models import User
from app.models.user import UserStatus
from app.schemas.user import MeResponse, MeUpdateRequest
from app.services.auth_service import check_nickname

# 프로필 사진 제한 (FR-106) — 화면(userinfo.js PHOTO_TYPES · PHOTO_MAX_BYTES)과 같은 기준
PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
PHOTO_MAX_BYTES = 2 * 1024 * 1024

# 사진을 두는 폴더 (settings.storage_dir 아래) · 화면이 사진을 받는 주소 앞부분
PROFILE_DIR = "profiles"
PROFILE_IMAGE_URL = "/api/v1/profile-images/"
# 주소로 받는 사진 이름 모양 — 올릴 때 만드는 uuid4().hex(소문자 16진수 32자) + 허용 확장자
PHOTO_NAME = re.compile(r"[0-9a-f]{32}\.(jpg|png|webp)")


def profile_image_url(user: User) -> str | None:
    """화면이 <img src> 로 쓸 주소. 사진이 없으면 None.

    - 저장 경로 "profiles/3f9c…a1.jpg" → 주소 "/api/v1/profile-images/3f9c…a1.jpg"
    - 주소에 회원 번호를 넣지 않음 — 번호를 바꿔 가며 다른 회원을 찾아볼 수 없게
      (2026-10-07, 탈퇴 추적 방지 ③)
    - 사진을 바꾸면 파일 이름(무작위)도 바뀌므로 브라우저가 옛 사진을 캐시에서 보여 줄 일이 없음
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    if not user.profile_image_path:
        return None
    return PROFILE_IMAGE_URL + PurePosixPath(user.profile_image_path).name


def to_me_response(user: User) -> MeResponse:
    """User → MeResponse (GET·PATCH /users/me, 사진 올리기 · 지우기 응답).

    - 비밀번호 해시는 넣지 않음
    - 칸을 하나씩 골라 넣음 — User 에 칸이 늘어도 응답에 저절로 섞이지 않게
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    return MeResponse(
        user_id=user.user_id,
        email=user.email,
        nickname=user.nickname,
        role=user.role,
        profile_image_url=profile_image_url(user),
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


def update_me(db: Session, user: User, data: MeUpdateRequest) -> User:
    """닉네임 변경 (FR-106). 바뀐(또는 그대로인) User 를 돌려준다.

    - 닉네임을 보내지 않았거나(null 포함) 지금과 똑같으면 아무것도 하지 않음
    - 대소문자 · 악센트만 바꾸는 것(Demo_User → demo_user)은 내 닉네임이라 중복 확인을 건너뜀
      (DB 비교 규칙이 둘을 같게 봄 → 확인하면 '내 닉네임' 을 찾아 "사용 중" 이 됨)
    - 그 밖에는 auth_service.check_nickname (P1-04) — 사용 중 409 NICKNAME_TAKEN,
      탈퇴 3일 안 409 REJOIN_TOO_SOON, 3일 지난 탈퇴 닉네임은 비켜 두고 사용
    - 동시에 같은 닉네임으로 바꾸면 commit 의 IntegrityError → rollback → 409 (signup 과 같음)
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    nickname = data.model_dump(exclude_unset=True).get("nickname")
    if nickname is None or nickname == user.nickname:
        return user

    mine = db.scalar(
        select(User.user_id).where(User.user_id == user.user_id, User.nickname == nickname)
    )
    if mine is None:
        result = check_nickname(db, nickname, release=True)
        if result.reason == "REJOIN_TOO_SOON":
            when = result.available_at
            raise AppError(
                ErrorCode.REJOIN_TOO_SOON,
                409,
                f"This nickname can be used again after {when:%b} {when.day}, {when.year} (UTC).",
                details={"nickname": "REJOIN_TOO_SOON", "available_at": when.isoformat()},
            )
        if not result.available:
            raise AppError(ErrorCode.NICKNAME_TAKEN, 409, "This nickname is already in use.")

    user.nickname = nickname
    try:
        db.commit()
    except IntegrityError:
        # 확인과 저장 사이에 다른 사람이 같은 닉네임으로 먼저 바꾼 경우
        db.rollback()
        raise AppError(ErrorCode.NICKNAME_TAKEN, 409, "This nickname is already in use.") from None
    db.refresh(user)
    return user


def image_extension(data: bytes) -> str | None:
    """파일 앞 몇 바이트(매직 넘버)로 실제 종류를 보고 확장자를 돌려줌. 허용 종류가 아니면 None.

    - JPG: FF D8 FF / PNG: 89 50 4E 47 0D 0A 1A 0A / WebP: 'RIFF' + (4바이트 크기) + 'WEBP'
    (구현: AI — 2026-10-07, save_profile_image 의 3번 단계)
    """
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


async def save_profile_image(db: Session, user: User, file: UploadFile) -> User:
    """프로필 사진 저장 (FR-106, jpg/png/webp, 2MB). 바뀐 User 를 돌려준다.

    1. 브라우저가 알려 준 종류(content_type)가 jpg/png/webp 가 아니면 415
    2. 2MB + 1바이트까지만 읽음 → 2MB 를 넘으면 413 (큰 파일을 끝까지 메모리에 올리지 않음)
    3. 내용(앞 바이트)도 jpg/png/webp 인지 확인 — 아니면 415. 확장자는 **내용**으로 정함
    4. storage/profiles/{무작위 32자}{확장자} 에 쓰기 (회원 번호를 넣지 않음, 2026-10-07)
    5. DB 저장(commit)에 성공한 **뒤에** 예전 사진 파일을 지움
       — 저장이 실패하면 새 파일을 지우고 예전 사진은 그대로 (사진이 사라지는 일 없음)
    6. storage_used_bytes 는 바꾸지 않음 — 프로필 사진은 용량(FR-131)에 넣지 않음
       (2026-10-07 결정: 회원당 최대 2MB 한 장, 사용량은 작업 파일만)
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    if file.content_type not in PHOTO_TYPES:
        raise AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, 415, "Use a JPG, PNG or WebP image.")
    data = await file.read(PHOTO_MAX_BYTES + 1)
    if len(data) > PHOTO_MAX_BYTES:
        raise AppError(ErrorCode.FILE_TOO_LARGE, 413, "Images must be 2 MB or smaller.")
    extension = image_extension(data)
    if extension is None:
        raise AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, 415, "Use a JPG, PNG or WebP image.")

    storage_dir = get_settings().storage_dir
    relative = f"{PROFILE_DIR}/{uuid4().hex}{extension}"
    new_file = storage_dir / relative
    new_file.parent.mkdir(parents=True, exist_ok=True)
    new_file.write_bytes(data)

    old_relative = user.profile_image_path
    user.profile_image_path = relative
    try:
        db.commit()
    except Exception:
        db.rollback()
        new_file.unlink(missing_ok=True)
        raise
    if old_relative:
        (storage_dir / old_relative).unlink(missing_ok=True)
    db.refresh(user)
    return user


def delete_profile_image(db: Session, user: User) -> User:
    """사진 지우기 (userInfo.html Remove 버튼) → 화면은 닉네임 첫 글자로 돌아감.

    - 바뀐 User 를 돌려준다
    - 38 과 같은 순서: DB 저장(commit)에 성공한 **뒤에** 파일 삭제
      — commit 이 실패하면 파일이 남아 사진이 깨지지 않음
    - 사진이 없거나 파일이 이미 없어도 오류 없음 (Remove 를 두 번 눌러도 됨)
    - P1-09 탈퇴(withdraw)는 상태를 바꾼 뒤 마지막에 이 함수를 부르면 이 commit 으로 함께 저장됨
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    old_relative = user.profile_image_path
    user.profile_image_path = None
    db.commit()
    if old_relative:
        (get_settings().storage_dir / old_relative).unlink(missing_ok=True)
    db.refresh(user)
    return user


def profile_image_file(db: Session, name: str) -> Path:
    """사진 파일 경로 (GET /profile-images/{name} — 2026-10-07 회원 번호 대신 무작위 파일 이름).

    - name 이 '32자 hex + .jpg/.png/.webp' 모양이 아니면 DB 를 보지 않고 404
    - 그 이름을 쓰는 회원이 없거나 탈퇴(DELETED)했으면 404 — 탈퇴 3일 안에도 사진은 보이지 않음
    - 파일이 storage 폴더 밖을 가리키거나 디스크에 없으면 404
    - 모든 404 는 같은 문구 — 어느 경우인지 알려 주지 않음
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    not_found = AppError(ErrorCode.NOT_FOUND, 404, "Image not found.")
    if not PHOTO_NAME.fullmatch(name):
        raise not_found
    user = db.scalar(select(User).where(User.profile_image_path == f"{PROFILE_DIR}/{name}"))
    if user is None or user.status == UserStatus.DELETED:
        raise not_found
    storage_dir = get_settings().storage_dir.resolve()
    path = (storage_dir / user.profile_image_path).resolve()
    if not path.is_relative_to(storage_dir) or not path.is_file():
        raise not_found
    return path


# ── P1-09 비밀번호 변경 · 회원 탈퇴 ──────────────────────────────


def check_current_password(user: User, password: str) -> None:
    """로그인한 사용자의 비밀번호 재확인 (비밀번호 변경·탈퇴 공통).

    - 틀리면 400 WRONG_PASSWORD "Password is incorrect."
    - 401 을 쓰지 않는 이유: 화면(api.js)은 401 을 받으면 토큰 재발급 → 그래도 401 이면
      로그인 화면으로 보냄. 비밀번호를 잘못 친 것뿐인데 로그아웃되면 안 됨
    - 72바이트 넘는 입력 · 망가진 해시("!")는 verify_password 가 False (P1-04 14)
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    if not verify_password(password, user.password_hash):
        raise AppError(ErrorCode.WRONG_PASSWORD, 400, "Password is incorrect.")


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    """비밀번호 변경 (FR-107).

    1. 지금 비밀번호 확인 (44) — 틀리면 400 WRONG_PASSWORD
    2. 새 비밀번호 규칙 (P1-04 14) — 틀리면 422, details={"new_password": [실패한 조건]}
    3. 새 비밀번호가 지금 비밀번호와 같으면 422 "Use a different password."
       (2026-10-07 결정: 막음. 다른 회원과 겹치는지는 검사하지 않음, 예전 비밀번호 이력도 범위 밖)
    4. 새 해시로 저장 (commit)
    - 다른 기기 로그아웃은 하지 않음 — 리프레시 토큰을 DB 에 두지 않아 지금은 불가
      (ai-notes 17 §2.4)
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    check_current_password(user, current_password)
    failed = check_password_rules(new_password)
    if failed:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            422,
            "Check the password requirements.",
            details={"new_password": failed},
        )
    if verify_password(new_password, user.password_hash):
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            422,
            "Use a different password.",
            details={"new_password": "same_as_current"},
        )
    user.password_hash = hash_password(new_password)
    db.commit()


def withdraw(db: Session, user: User, password: str) -> None:
    """회원 탈퇴 — 소프트 삭제 (FR-108).

    1. 비밀번호 재확인 (44) — 틀리면 400, 아무것도 바뀌지 않음
    2. status = DELETED, deleted_at = 지금(UTC) — 행은 남김
    3. 프로필 사진 지우기 (39) — 그 안의 commit 이 2번까지 **한 번에** 저장, 파일은 저장 뒤 삭제
    - 이후 로그인 차단: authenticate(29) · get_current_user(06) · get_active_user(30) 가
      status != ACTIVE 를 막으므로 여기서 따로 할 일 없음
    - 이메일 · 닉네임은 바꾸지 않음 (2026-10-03 결정) — 3일 안 재가입을 막는 데 그대로 씀,
      3일이 지나면 누가 그 값을 쓸 때 release_withdrawn(P1-04) 또는 보관 기간 정리(49)가 비움
    - 내가 OWNER 인 프로젝트는 그대로 남김 (2026-10-03 결정) — projects 는 건드리지 않음
      추적 방지 (2026-10-07): 다른 사람에게 보이는 곳(멤버 목록 · 채팅 · 댓글, Phase 6)은
      DELETED 회원을 'Deleted user' 로만 보내고 user_id 도 넣지 않음
    - 리프레시 쿠키 삭제는 라우터(48)가 함 (응답에 붙는 일이라서)
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    check_current_password(user, password)
    user.status = UserStatus.DELETED
    user.deleted_at = datetime.now(UTC).replace(tzinfo=None)
    delete_profile_image(db, user)
