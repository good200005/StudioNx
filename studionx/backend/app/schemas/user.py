"""회원 정보 API 요청·응답 스키마 (PRD 01 §7). P1-08 조회·수정·사진, P1-09 비밀번호·탈퇴."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.auth import NICKNAME_MAX, NICKNAME_MIN


class MeResponse(BaseModel):
    """GET /users/me — userinfo.js loadMe, mypage.js 가 씀.

    profile_image_url: 사진이 없으면 null (화면은 닉네임 첫 글자를 보여 줌)
    """

    user_id: int
    email: str
    nickname: str
    role: str
    profile_image_url: str | None
    created_at: datetime
    last_login_at: datetime | None


class MeUpdateRequest(BaseModel):
    """PATCH /users/me — 지금은 닉네임만 바꿀 수 있음. 이메일은 변경 불가 (FR-106).

    보내지 않은 칸은 바꾸지 않음 (model_dump(exclude_unset=True) 로 확인)
    """

    nickname: str | None = Field(default=None, min_length=NICKNAME_MIN, max_length=NICKNAME_MAX)


class PasswordChangeRequest(BaseModel):
    """PUT /users/me/password (FR-107) — userinfo.js initPasswordForm

    새 비밀번호 조건은 security.check_password_rules 로 서비스에서 검사 (가입과 같은 규칙)
    """

    current_password: str = Field(min_length=1, max_length=100)
    new_password: str = Field(min_length=1, max_length=100)


class WithdrawRequest(BaseModel):
    """DELETE /users/me (FR-108) — 본문에 비밀번호 재확인. userinfo.js initWithdrawForm"""

    password: str = Field(min_length=1, max_length=100)
