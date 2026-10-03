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

from pydantic import BaseModel, Field

INQUIRY_CONTENT_MAX = 2000  # 화면 textarea maxlength 와 같음


class InquiryCreateRequest(BaseModel):
    """POST /inquiries  — JSON { email, title, content, privacy_agreed }

    privacy_agreed 가 true 가 아니면 저장하지 않음 (서비스에서 422)
    """

    email: str = Field(max_length=255)
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=INQUIRY_CONTENT_MAX)
    privacy_agreed: bool

    # TODO(P1-12): 이메일 형식 검사 — P1-04 SignupRequest 와 같은 방법을 재사용


class InquiryCreateResponse(BaseModel):
    """문의 접수 (201). 화면은 '보냈습니다' 안내만 하므로 번호·시각만 돌려줌."""

    inquiry_id: int
    created_at: datetime
