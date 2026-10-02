"""여러 API가 같이 쓰는 응답 스키마."""

from typing import Any

from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str  # 프론트가 분기에 쓰는 고정 문자열 (예: "EMAIL_TAKEN") — app/core/errors.py ErrorCode
    message: str  # 사람에게 보여줄 문장 (영어 — 화면이 영어)
    details: dict[str, Any] | None = None  # 입력값 오류일 때 칸별 문구 등 (선택)


class ErrorResponse(BaseModel):
    """모든 오류 응답의 모양.

    {"error": {"code": "EMAIL_TAKEN", "message": "This email is already in use.", "details": null}}
    """

    error: ErrorBody
