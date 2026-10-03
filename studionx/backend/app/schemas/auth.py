"""인증 API 요청·응답 스키마 (PRD 01 §7). 회원가입·중복 확인 = P1-04, 로그인 = P1-05."""

from pydantic import BaseModel, Field

# 닉네임 길이 (PRD 01 FR-101) — 화면(join.html, userInfo.html)과 같은 규칙
NICKNAME_MIN, NICKNAME_MAX = 2, 20


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

    {"available": true}  → 화면: '✓ Available'
    {"available": false} → 화면: 'This email is already in use.' 등
    """

    available: bool
