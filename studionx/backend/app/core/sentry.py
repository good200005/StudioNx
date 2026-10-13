"""Sentry 초기화. SENTRY_DSN 이 없으면 아무것도 하지 않는다."""

import sentry_sdk

from app.core.config import Settings

# 이벤트에 실리면 안 되는 키 (PRD 00 §7: 민감정보 제거)
# send_default_pii=True 라 요청 헤더·쿠키·IP 가 함께 가므로, 토큰이 든 쿠키도 반드시 거름
_SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "current_password",
    "new_password",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "cookie",
    "set-cookie",
    "snx_refresh",  # 리프레시 토큰 쿠키 (api/v1/auth.py REFRESH_COOKIE)
}


def _scrub(event, _hint):
    request = event.get("request") or {}
    for section in ("data", "headers", "cookies"):
        values = request.get(section)
        if isinstance(values, dict):
            for key in list(values):
                if key.lower() in _SENSITIVE_KEYS:
                    values[key] = "[Filtered]"
    return event


def init_sentry(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        # 요청 헤더·사용자 IP 등을 함께 보냄 (문제 재현용). 민감한 값은 before_send 에서 지움
        # https://docs.sentry.io/platforms/python/data-management/data-collected/
        send_default_pii=True,
        before_send=_scrub,
    )
