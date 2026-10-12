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

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import ROOT_DIR, get_settings
from app.schemas.common import ErrorBody, ErrorResponse


class ErrorCode(StrEnum):
    """프론트(JS)가 분기에 쓰는 오류 코드. 새 오류가 생기면 여기에 추가."""

    VALIDATION_ERROR = "VALIDATION_ERROR"  # 422 입력값 형식 오류
    BAD_REQUEST = "BAD_REQUEST"  # 400 그 밖의 잘못된 요청 (FastAPI 기본 오류, 03)
    METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED"  # 405 주소는 있는데 방식(GET/POST…)이 다름 (03)
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


def error_json(
    status_code: int,
    code: str,
    message: str,
    details: dict | None = None,
) -> JSONResponse:
    """오류 응답 하나를 만든다 — 모든 처리기가 이 함수로 같은 모양을 만든다.

    (구현: AI — 2026-10-06, 함수 하나씩 검토)
    """
    body = ErrorResponse(error=ErrorBody(code=code, message=message, details=details))
    return JSONResponse(status_code=status_code, content=body.model_dump())


def is_api_request(request: Request) -> bool:
    """API 요청인지 (True → JSON 으로 응답, False → 화면(페이지) 요청이라 오류 페이지 HTML 로 응답).

    (구현: AI — 2026-10-13, P1-22, 함수 하나씩 검토)
    - 주소가 API 앞부분(settings.api_prefix, 보통 "/api/v1")이거나 그 아래("/api/v1/…")이면 API
    - "/api/v1x" 처럼 글자만 비슷한 주소는 API 가 아님 (경계 확인)
    - 주소 끝의 "/" 나 쿼리(?a=1)는 상관없음
    """
    prefix = get_settings().api_prefix
    path = request.url.path
    return path == prefix or path.startswith(prefix + "/")


def error_page(status_code: int) -> FileResponse:
    """화면(페이지) 요청의 오류 → 오류 페이지 HTML 을 같은 상태 코드로 돌려준다.

    (구현: AI — 2026-10-13, P1-22, 함수 하나씩 검토)
    - 400·403·404·429·500·503·504 는 같은 번호의 페이지 (ERROR_PAGES)
    - 페이지가 없는 번호(405 등)는 4xx → 400 페이지, 5xx → 500 페이지를 쓰되
      상태 코드는 원래 번호 그대로 (브라우저·검색 로봇이 진짜 오류를 알 수 있게)
    """
    if status_code in ERROR_PAGES:
        page = ERROR_PAGES[status_code]
    elif status_code >= 500:
        page = ERROR_PAGES[500]
    else:
        page = ERROR_PAGES[400]
    return FileResponse(ROOT_DIR / "frontend" / page, status_code=status_code)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """AppError(서비스·라우터가 일부러 던진 오류) → 정해 둔 상태 코드와 문구 그대로.

    (구현: AI — 2026-10-06, 함수 하나씩 검토)
    """
    return error_json(exc.status_code, exc.code, exc.message, exc.details)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """입력값 형식 오류(FastAPI 가 요청을 스키마와 비교해 낸 오류) → 422, 칸별 문구.

    (구현: AI — 2026-10-06, 함수 하나씩 검토)
    - details = {칸 이름: 문구} — 칸 이름은 loc 의 마지막 값 (예: ("body", "email") → "email")
    - 한 칸에 오류가 여러 개면 첫 번째만 (화면은 칸 아래에 한 줄만 보여 줌)
    - 사용자가 보낸 값(input)은 응답에 넣지 않음 — 비밀번호가 되돌아가지 않게
    """
    details: dict[str, str] = {}
    for err in exc.errors():
        loc = err.get("loc") or ()
        field = str(loc[-1]) if loc else "body"
        details.setdefault(field, err.get("msg", "Invalid value."))
    return error_json(422, ErrorCode.VALIDATION_ERROR, "Check the highlighted fields.", details)


# FastAPI·Starlette 가 직접 내는 오류(HTTPException)의 상태 → (code, 문구)  (03)
HTTP_ERRORS: dict[int, tuple[ErrorCode, str]] = {
    400: (ErrorCode.BAD_REQUEST, "Bad request."),
    401: (ErrorCode.UNAUTHORIZED, "Please sign in."),
    403: (ErrorCode.FORBIDDEN, "You do not have permission."),
    404: (ErrorCode.NOT_FOUND, "Not found."),
    405: (ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed."),
    413: (ErrorCode.FILE_TOO_LARGE, "The file is too large."),
    415: (ErrorCode.UNSUPPORTED_FILE_TYPE, "Unsupported file type."),
    429: (ErrorCode.TOO_MANY_REQUESTS, "Too many requests. Please try again later."),
}


async def http_error_handler(request: Request, exc: StarletteHTTPException) -> Response:
    """FastAPI·Starlette 기본 오류(없는 API 주소 404, 방식이 다름 405 …) → 같은 오류 모양.

    (구현: AI — 2026-10-06, 함수 하나씩 검토)
    - 표(HTTP_ERRORS)에 없는 상태: 500 이상은 INTERNAL_ERROR, 그 밖은 BAD_REQUEST
    - 문구는 표의 고정 문장 — exc.detail(라이브러리가 만든 문장)은 그대로 내보내지 않음
    - exc.headers 는 유지 (405 의 Allow 등 — 표준이 요구하는 헤더)
    - (2026-10-13, P1-22) 화면(페이지) 요청이면 JSON 대신 오류 페이지 HTML (error_page),
      API 요청이면 JSON
    """
    if exc.status_code in HTTP_ERRORS:
        code, message = HTTP_ERRORS[exc.status_code]
    elif exc.status_code >= 500:
        code, message = ErrorCode.INTERNAL_ERROR, "Something went wrong. Please try again."
    else:
        code, message = ErrorCode.BAD_REQUEST, "Bad request."
    if is_api_request(request):
        response = error_json(exc.status_code, code, message)
    else:
        response = error_page(exc.status_code)
    if exc.headers:
        response.headers.update(exc.headers)
    return response


async def unexpected_error_handler(request: Request, exc: Exception) -> Response:
    """예상 못 한 오류(버그 · DB 끊김 등) → 500, 일반 문장만.

    (구현: AI — 2026-10-06, 함수 하나씩 검토)
    - 오류 내용(exc)은 응답에 넣지 않음 — SQL · 파일 경로 · 비밀값이 섞일 수 있음
    - 기록은 따로 하지 않음: Starlette 가 이 응답을 보낸 뒤 오류를 다시 던지므로
      uvicorn 로그와 Sentry 가 원래 오류를 그대로 기록함
    - (2026-10-13, P1-22) 화면(페이지) 요청이면 errors/500.html, API 요청이면 JSON
    """
    if is_api_request(request):
        return error_json(500, ErrorCode.INTERNAL_ERROR, "Something went wrong. Please try again.")
    return error_page(500)


def register_exception_handlers(app: FastAPI) -> None:
    """main.py 에서 한 번 호출. 아래 오류들을 모두 ErrorResponse 모양으로 바꾼다.

    - AppError                → status_code 그대로 ✅ app_error_handler (2026-10-06)

    - RequestValidationError  → 422 VALIDATION_ERROR ✅ validation_error_handler (2026-10-06)

    - StarletteHTTPException  → 404·405 등 같은 모양 ✅ http_error_handler (2026-10-06)

    - Exception (그 외)       → 500 INTERNAL_ERROR ✅ unexpected_error_handler (2026-10-06)
    - 응답 본문에 비밀번호·토큰이 섞이지 않게 — 네 처리기 모두 입력값·오류 내용을 넣지 않음

    TODO(P1-22) 오류 페이지 — API 요청과 페이지 요청을 나눠서 응답:
    - request.url.path 가 settings.api_prefix("/api/v1")로 시작 → 지금처럼 JSON (ErrorResponse)
    - 그 외(페이지 요청) → 오류 페이지 HTML 을 같은 상태 코드로
        FileResponse(ROOT_DIR / "frontend" / ERROR_PAGES[status], status_code=status)
    - 없는 주소 404: ✅ 구현됨 (core/site_files.py SiteFiles) — 없는 페이지는 errors/404.html,
      없는 API 주소는 예외를 넘겨 JSON 404. 위 StarletteHTTPException 처리기를 만들 때
      API 404 도 ErrorResponse 모양({"error": {"code": "NOT_FOUND", ...}})으로 바꾸면 됨
    - 503(점검)은 점검 모드 설정값을 두고 미들웨어에서 errors/503.html 로 응답 (선택)
    """
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(Exception, unexpected_error_handler)
