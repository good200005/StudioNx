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
"""인증 API 요청·응답 스키마 (PRD 01 §7). 회원가입·중복 확인 = P1-04, 로그인 = P1-05."""

from datetime import datetime

from pydantic import BaseModel, Field

# 닉네임 길이 (PRD 01 FR-101) — 화면(join.html, userInfo.html)과 같은 규칙
NICKNAME_MIN, NICKNAME_MAX = 2, 20

# 지금 시행 중인 개인정보 처리방침 버전
# (privacy.html Version 줄, join.js PRIVACY_VERSION 과 같아야 함)
PRIVACY_VERSION = "2026-10-05"


class SignupRequest(BaseModel):
    """POST /auth/signup  — join.js 가 보내는 JSON { email, nickname, password }

    - 길이 같은 단순 형식은 여기(Field)에서 검사
      → 틀리면 422 VALIDATION_ERROR (core/errors.py 처리기)
    - 비밀번호 조건(FR-102)은 security.check_password_rules 로 서비스에서 검사
      (조건별 실패 목록을 details 에 담아 돌려주기 위해)
    - 비밀번호 확인 칸은 화면에서만 비교하므로 서버로 보내지 않음
    """

    email: str = Field(max_length=255)
    nickname: str = Field(min_length=NICKNAME_MIN, max_length=NICKNAME_MAX)
    password: str = Field(min_length=1, max_length=100)  # 정확한 8~20자 검사는 check_password_rules
    privacy_agreed: bool  # 만 16세 이상 + 처리방침 동의 체크 (2026-10-05, 처리방침 D3·D4)
    privacy_version: str = Field(max_length=20)  # 화면이 본 처리방침 버전

    # TODO(P1-04): 이메일 형식 검사
    #   - 방법 1: pydantic EmailStr (requirements.txt 에 email-validator 추가 필요)
    #   - 방법 2: @field_validator("email") 에서 간단한 정규식 (예: r"[^@\s]+@[^@\s]+\.[^@\s]+")
    # TODO(P1-04): 앞뒤 공백 제거 · 이메일 소문자 통일 (@field_validator 또는 서비스에서)
    #   - 같은 주소를 대소문자만 바꿔 두 번 가입하는 것을 막기 위함


class SignupResponse(BaseModel):
    """가입 성공 (201). 비밀번호·해시는 절대 넣지 않음 (PRD 01 §5)."""

    user_id: int
    email: str
    nickname: str


class AvailabilityResponse(BaseModel):
    """GET /auth/check-email, /auth/check-nickname

    {"available": true}                                → 화면: '✓ Available'
    {"available": false, "reason": "TAKEN"}            → 'This email is already in use.' 등
    {"available": false, "reason": "REJOIN_TOO_SOON",
     "available_at": "2026-10-06T09:00:00Z"}           → 'You can sign up again after Oct 6.'
    """

    available: bool
    reason: str | None = None  # 'TAKEN' | 'REJOIN_TOO_SOON' (available=false 일 때만)
    available_at: datetime | None = None  # REJOIN_TOO_SOON 일 때 다시 쓸 수 있는 시각 (UTC)


class LoginRequest(BaseModel):
    """POST /auth/login  — 로그인 모달(auth-ui.js)이 보내는 JSON { email, password, remember }

    remember: [자동 로그인] 체크 여부 (FR-109) → 리프레시 쿠키 유지 기간이 달라짐
    """

    email: str = Field(max_length=255)
    password: str = Field(min_length=1, max_length=100)
    remember: bool = False


class TokenResponse(BaseModel):
    """로그인·재발급 성공 (200). Refresh Token 은 본문이 아니라 HttpOnly 쿠키로만 보냄.

    {"access_token": "eyJ...", "token_type": "bearer", "expires_in": 1800}
    """

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # 초 단위 (jwt_access_minutes * 60) — 화면에서 미리 재발급할 때 참고
