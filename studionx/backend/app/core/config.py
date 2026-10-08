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
    jwt_refresh_days: int = 3          # 자동 로그인 체크 시 리프레시 쿠키 유지 기간 (PRD 01 FR-109)

    # 프록시(Nginx 등) 뒤에서 돌 때만 true — X-Forwarded-For 의 첫 IP 를 보낸 사람으로 봄
    # 프록시 없이 true 면 누구나 헤더를 꾸며 IP 제한을 피할 수 있음 (2026-10-08 결정: 기본 꺼짐)
    trust_proxy: bool = False

    # 파일 저장 위치 (DB에는 이 경로 기준 상대 경로만 저장)
    storage_dir: Path = ROOT_DIR / "storage"

    # Sentry — 비어 있으면 비활성화
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
