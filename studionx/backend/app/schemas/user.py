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
"""회원 정보 API 요청·응답 스키마 (PRD 01 §7). P1-08 조회·수정·사진, P1-09 비밀번호·탈퇴."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.auth import Nickname


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
    (구현: AI — 2026-10-07) 닉네임은 가입과 같은 Nickname 타입 — 앞뒤 공백을 지운 뒤 2~20자
    """

    nickname: Nickname | None = None


class PasswordChangeRequest(BaseModel):
    """PUT /users/me/password (FR-107) — userinfo.js initPasswordForm

    새 비밀번호 조건은 security.check_password_rules 로 서비스에서 검사 (가입과 같은 규칙)
    """

    current_password: str = Field(min_length=1, max_length=100)
    new_password: str = Field(min_length=1, max_length=100)


class WithdrawRequest(BaseModel):
    """DELETE /users/me (FR-108) — 본문에 비밀번호 재확인. userinfo.js initWithdrawForm"""

    password: str = Field(min_length=1, max_length=100)
