"""프론트엔드 정적 파일 + 없는 주소용 404 페이지 (구현: AI — 사용자 요청, P1-22).

Starlette StaticFiles(html=True)는 루트의 404.html 만 자동으로 찾는다.
오류 페이지는 frontend/errors/ 에 모았으므로, 파일이 없을 때 직접 errors/404.html 을 돌려준다.
- 페이지 요청  → errors/404.html, 상태 404
- API 요청(/api/...) → 예외를 그대로 넘김 → FastAPI 가 JSON 404 로 응답 (오류 형식은 core/errors.py)
"""

from pathlib import Path

from starlette.exceptions import HTTPException
from starlette.responses import FileResponse, Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from app.core.errors import ERROR_PAGES


class SiteFiles(StaticFiles):
    def __init__(self, *, directory: Path, api_prefix: str) -> None:
        super().__init__(directory=directory, html=True)
        self.frontend_dir = Path(directory)
        self.api_prefix = api_prefix

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            is_api = scope["path"].startswith(self.api_prefix)
            if exc.status_code == 404 and not is_api:
                return FileResponse(self.frontend_dir / ERROR_PAGES[404], status_code=404)
            raise
