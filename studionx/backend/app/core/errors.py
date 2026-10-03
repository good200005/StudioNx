# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-03 백엔드 공통 — 모델 컬럼·오류 처리기·토큰 검사·get_current_user
#   브랜치  : feature/phase1/p1-03-backend-core
#   순서    : 1단계 — 가장 먼저 (나머지 API가 모두 이 작업을 씀)
#
# P1-22 오류 페이지 백엔드 연결 (페이지 요청은 HTML, API는 JSON)
#   브랜치  : feature/phase1/p1-22-error-pages
#   순서    : 5단계 — P1-03 병합 후
#
# 시작 전 : git switch <위 작업 중 지금 할 작업의 브랜치>
#           (이 파일은 작업이 여럿 — 위 순서대로 한 작업씩, 각자 자기 브랜치에서)
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""오류 응답 형식 통일 — 뼈대: 구현은 직접 (P1-03).

모든 오류는 schemas/common.py 의 ErrorResponse 모양으로 돌려준다:
    {"error": {"code": "...", "message": "...", "details": {...} | null}}

서비스 코드에서는 raise AppError(ErrorCode.EMAIL_TAKEN, 409, "This email is already in use.")
"""

from enum import StrEnum

from fastapi import FastAPI


class ErrorCode(StrEnum):
    """프론트(JS)가 분기에 쓰는 오류 코드. 새 오류가 생기면 여기에 추가."""

    VALIDATION_ERROR = "VALIDATION_ERROR"  # 422 입력값 형식 오류
    UNAUTHORIZED = "UNAUTHORIZED"  # 401 토큰 없음·만료 → 프론트가 재발급 시도 (P1-02)
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"  # 401 이메일 또는 비밀번호 틀림 (FR-103 통일 문구)
    WRONG_PASSWORD = "WRONG_PASSWORD"  # 400 로그인한 상태에서 재확인 비밀번호 틀림 (P1-09)
    FORBIDDEN = "FORBIDDEN"  # 403 권한 없음 (다른 사람 프로젝트 등)
    NOT_FOUND = "NOT_FOUND"  # 404
    EMAIL_TAKEN = "EMAIL_TAKEN"  # 409 (P1-04)
    NICKNAME_TAKEN = "NICKNAME_TAKEN"  # 409 (P1-04)
    REJOIN_TOO_SOON = "REJOIN_TOO_SOON"  # 409 탈퇴 후 3일이 지나지 않은 이메일 (FR-108)
    ACCOUNT_DISABLED = "ACCOUNT_DISABLED"  # 403 탈퇴·정지 계정 (FR-108)
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS"  # 429 문의 반복 전송 (FR-113)
    FILE_TOO_LARGE = "FILE_TOO_LARGE"  # 413 프로필 사진 2MB 초과 (P1-08)
    UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE"  # 415 jpg/png/webp 가 아님 (P1-08)
    INTERNAL_ERROR = "INTERNAL_ERROR"  # 500 (자세한 내용은 Sentry로만)


# 페이지 요청 오류 → 보여 줄 HTML (studionx/frontend 기준, P1-22)
ERROR_PAGES: dict[int, str] = {
    400: "errors/400.html",
    403: "errors/403.html",
    404: "errors/404.html",
    429: "errors/429.html",
    500: "errors/500.html",
    503: "errors/503.html",
    504: "errors/504.html",
}


class AppError(Exception):
    """서비스·라우터에서 던지는 예상된 오류."""

    def __init__(
        self,
        code: ErrorCode,
        status_code: int,
        message: str,
        details: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.message = message
        self.details = details


def register_exception_handlers(app: FastAPI) -> None:
    """main.py 에서 한 번 호출. 아래 오류들을 모두 ErrorResponse 모양으로 바꾼다.

    TODO:
    - AppError                → status_code 그대로, {"error": {code, message, details}}
    - RequestValidationError  → 422, code=VALIDATION_ERROR, details={칸 이름: 문구}
                                (exc.errors() 의 loc 마지막 값을 칸 이름으로)
    - StarletteHTTPException  → 404 등 FastAPI 기본 오류도 같은 모양으로 (code는 상태별로 매핑)
    - Exception (그 외)       → 500, code=INTERNAL_ERROR, message는 일반 문장만
                                (오류 내용은 응답에 넣지 않음 — Sentry가 기록)
    - 응답 본문에 비밀번호·토큰이 섞이지 않게 주의 (PRD 01 §5)

    TODO(P1-22) 오류 페이지 — API 요청과 페이지 요청을 나눠서 응답:
    - request.url.path 가 settings.api_prefix("/api/v1")로 시작 → 지금처럼 JSON (ErrorResponse)
    - 그 외(페이지 요청) → 오류 페이지 HTML 을 같은 상태 코드로
        FileResponse(ROOT_DIR / "frontend" / ERROR_PAGES[status], status_code=status)
    - 없는 주소 404: ✅ 구현됨 (core/site_files.py SiteFiles) — 없는 페이지는 errors/404.html,
      없는 API 주소는 예외를 넘겨 JSON 404. 위 StarletteHTTPException 처리기를 만들 때
      API 404 도 ErrorResponse 모양({"error": {"code": "NOT_FOUND", ...}})으로 바꾸면 됨
    - 503(점검)은 점검 모드 설정값을 두고 미들웨어에서 errors/503.html 로 응답 (선택)
    """
    # TODO: @app.exception_handler(AppError) ... 등록
