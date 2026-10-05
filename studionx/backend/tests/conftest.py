"""테스트 공통 설정.

테스트 중에는 Sentry 를 끔 — .env 에 SENTRY_DSN 이 있어도 테스트가 일부러 낸 오류·요청이
실제 Sentry 프로젝트로 가지 않게 한다. (환경 변수가 .env 보다 우선, app 을 불러오기 전에 설정)
"""

import os

os.environ["SENTRY_DSN"] = ""
