"""환경 변수 기반 설정. 값은 studionx/.env 에서 읽는다 (.env.example 참고)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# studionx/ (프로젝트 루트)
ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "dev"  # dev | prod
    app_name: str = "Studio Nx"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:8000", "http://127.0.0.1:8000"]

    # MySQL — database: studionx
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_name: str = "studionx"
    db_user: str = "studionx_app"
    db_password: str = ""

    # 인증
    jwt_secret: str = "change-me"
    jwt_access_minutes: int = 30
    jwt_refresh_days: int = 3  # 자동 로그인 체크 시 리프레시 쿠키 유지 기간 (PRD 01 FR-109)
    password_reset_minutes: int = 30  # 비밀번호 재설정 링크 유효 시간 (PRD 01 FR-118)

    # 메일 (P1-28) — 지금은 보내지 않고 서버 로그에 링크를 출력하는 개발용 방식뿐
    # MAIL_BACKEND=log(기본): 개발 전용. 로그에 재설정 링크(비밀번호를 바꿀 수 있는 값)가 남아서
    #   배포에서는 쓰지 않음
    # 그 밖의 값(예: smtp, 아직 없음): 링크를 만들지 않고 "메일 발송이 설정되지 않음"만 기록
    mail_backend: str = "log"
    app_base_url: str = "http://localhost:8000"  # 메일 링크의 주소 (배포 때 실제 주소로)

    # 프록시(Nginx 등) 뒤에서 돌 때만 true — X-Forwarded-For 의 첫 IP 를 보낸 사람으로 봄
    # 프록시 없이 true 면 누구나 헤더를 꾸며 IP 제한을 피할 수 있음 (2026-10-08 결정: 기본 꺼짐)
    trust_proxy: bool = False

    # 관리자 화면(SQLAdmin) 주소. 개발은 /admin 그대로,
    # 배포 때 추측하기 어려운 값으로 바꿈 (2026-10-13 결정)
    # 예: ADMIN_PATH=/ops-7f3a9c1e
    # 반드시 "/"로 시작하고, API 주소(/api/v1…)나 "/" 단독은 쓰지 않음
    admin_path: str = "/admin"

    # 파일 저장 위치 (DB에는 이 경로 기준 상대 경로만 저장)
    storage_dir: Path = ROOT_DIR / "storage"

    # 샘플 업로드 (S1-07) — 파일 하나 최대 크기 (FR-222, 기본 100MB)
    # 지원 형식(WAV·MP3·FLAC·OGG·AIFF)은 services/sample_audio_service.py 의 상수다
    sample_max_bytes: int = 100 * 1024 * 1024

    # Sentry — 비어 있으면 비활성화
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1
    # 브라우저(화면)에서 난 JS 오류를 받는 Sentry 프로젝트의 DSN (S1-13)
    # 서버용과 따로 두면 Python 오류와 JS 오류가 섞이지 않는다
    # 공개되어도 되는 값이며 GET /client-config 로 화면에 내려간다. 비우면 화면은 보내지 않음
    sentry_browser_dsn: str = ""

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
