# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-12 문의 등록·반복 전송 제한(메모리)
#   브랜치  : feature/phase1/p1-12-inquiry-api
#   순서    : 3단계 — P1-03~05 병합 후
#
# 시작 전 : git switch feature/phase1/p1-12-inquiry-api
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""문의 API 요청·응답 스키마 (PRD 01 FR-112). home.js initContactForm 이 보냄."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints

INQUIRY_TITLE_MAX = 200  # 화면 input maxlength 와 같음
INQUIRY_CONTENT_MAX = 2000  # 화면 textarea maxlength 와 같음

# 제목 · 내용 — 앞뒤 공백을 먼저 지우고 길이를 잼 → 공백만 친 칸은 422
# (닉네임 Nickname 과 같은 방법)
# 내용 가운데의 줄바꿈은 그대로 둠
InquiryTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=INQUIRY_TITLE_MAX)
]
InquiryContent = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=INQUIRY_CONTENT_MAX)
]


class InquiryCreateRequest(BaseModel):
    """POST /inquiries  — JSON { email, title, content, privacy_agreed }

    privacy_agreed 가 true 가 아니면 저장하지 않음 (서비스에서 422)
    (구현: AI — 2026-10-08, 함수 하나씩 검토) 이메일 = EmailStr (가입 SignupRequest 와 같음),
    제목 · 내용 = 앞뒤 공백을 지운 뒤 길이 검사
    — 틀리면 422 VALIDATION_ERROR (core/errors.py 처리기)
    """

    email: EmailStr = Field(max_length=255)  # 형식 검사 · 앞뒤 공백 제거 (email-validator)
    title: InquiryTitle
    content: InquiryContent
    privacy_agreed: bool


class InquiryCreateResponse(BaseModel):
    """문의 접수 (201). 화면은 '보냈습니다' 안내만 하므로 번호·시각만 돌려줌."""

    inquiry_id: int
    created_at: datetime
