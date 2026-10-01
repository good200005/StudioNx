"""Sentry 초기화. SENTRY_DSN 이 없으면 아무것도 하지 않는다."""

import sentry_sdk

from app.core.config import Settings

# 이벤트에 실리면 안 되는 키 (PRD 00 §7: 민감정보 제거)
_SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
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
        send_default_pii=False,
        before_send=_scrub,
    )
