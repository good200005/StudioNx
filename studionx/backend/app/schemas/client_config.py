"""화면(브라우저)이 시작할 때 알아야 하는 서버 설정 — S1-13 (PRD 00 §7).

로그인 없이 읽는 값만 담는다. 브라우저용 Sentry DSN 은 화면 코드에 실려도 되는 공개 값이다
(Sentry 문서도 DSN 을 비밀로 다루지 않는다). 비밀번호, 토큰, 서버용 DSN 은 절대 넣지 않는다.
"""

from pydantic import BaseModel


class ClientConfigResponse(BaseModel):
    """GET /client-config 응답."""

    sentry_dsn: str  # 비어 있으면 화면은 오류를 보내지 않음
    environment: str  # dev | prod (Sentry 의 environment)
    release: str  # 예: studionx@0.1.0
