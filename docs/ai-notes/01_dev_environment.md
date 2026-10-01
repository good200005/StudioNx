# AI 구현 설명 01 — 개발 환경 구축

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-01 |
| 대상 | `studionx/` 폴더 전체 (구현 계획 S1-01의 환경 부분) |
| 원칙 | 기획서 AI 규칙에 따라 **환경·뼈대만** 만들었고, 기능 구현(JS 로직, API 기능, C++)은 하지 않음 |

---

## 1. 무엇을 만들었나
| 파일/폴더 | 역할 | 비고 |
|---|---|---|
| `.venv/` | Python 3.13 가상환경 | PC 기본은 3.14지만, 라이브러리 호환성(바이너리 휠)이 안정적인 3.13 선택 |
| `backend/requirements.txt` | 런타임 의존성 | FastAPI, uvicorn, pydantic-settings, python-multipart, SQLAlchemy, PyMySQL, cryptography, PyJWT, bcrypt, sentry-sdk |
| `backend/requirements-dev.txt` | 개발 의존성 | pytest, httpx2(TestClient), ruff |
| `backend/pyproject.toml` | pytest·ruff 설정 | |
| `backend/app/main.py` | FastAPI 진입점 | CORS, `/api/v1` 라우터, 프론트 정적 파일 마운트, Sentry 초기화 |
| `backend/app/core/config.py` | 설정 | `.env`를 읽음. DB 접속 URL 조립 |
| `backend/app/core/sentry.py` | Sentry 초기화 | DSN 없으면 비활성. 비밀번호·토큰 키를 `[Filtered]`로 가림 |
| `backend/app/db/session.py` | DB 엔진·세션 | `Base`(ORM 부모), `get_db`(라우터 의존성) |
| `backend/app/api/v1/router.py` | 라우터 등록 위치 | 환경 점검용 `/health`, `/health/db`만 있음 |
| `backend/app/{models,schemas,services,workers}/` | 빈 패키지 | 기능 구현 시 사용자가 채움 |
| `backend/tests/test_health.py` | 환경 확인 테스트 | |
| `frontend/static/js/core/sentry-init.js` | 프론트 Sentry **템플릿** | 함수 시그니처 + TODO만 (JS 구현은 사용자) |
| `db/00_create_database.sql` | DB·계정 생성 SQL | **아직 실행하지 않음** (root 비밀번호 필요) |
| `native/README.md` | C++ 영역 안내 | 코드 없음 (사용자 영역) |
| `.env.example`, `.env` | 환경 변수 | `.env`는 git 제외 |
| `.gitignore`, `.editorconfig`, `README.md` | 프로젝트 공통 설정 | |

## 2. 왜 이렇게 했나
### 2.1 프론트엔드를 FastAPI가 서빙
- 기술 스택이 Vanilla JS(빌드 도구 없음)라서 별도 개발 서버가 필요 없습니다.
- 같은 주소(localhost:8000)에서 API와 페이지를 함께 제공하면 **CORS·쿠키 문제가 없어** 리프레시 토큰(HttpOnly 쿠키, PRD 01 FR-105)을 쓰기 쉽습니다.
- `app.mount("/", StaticFiles(...))`를 **라우터 등록 뒤**에 둔 이유: 먼저 마운트하면 `/api/...` 요청까지 정적 파일 쪽으로 가기 때문입니다.

### 2.2 SQLAlchemy 2 + PyMySQL (동기 방식)
- 비동기 드라이버(aiomysql)보다 구조가 단순하고 디버깅이 쉬워 학습·1인 개발에 적합합니다. FastAPI는 동기 함수 라우터를 스레드풀에서 실행하므로 성능 문제도 초기엔 없습니다.
- `cryptography`는 MySQL 8의 기본 인증 방식(caching_sha2_password)을 PyMySQL이 처리하는 데 필요합니다.
- `pool_pre_ping=True`: 오래 쉰 연결이 끊겨 있으면 자동으로 다시 연결합니다.

### 2.3 설정은 `.env` + pydantic-settings
- 비밀값(DB 비밀번호, JWT 키, Sentry DSN)을 코드에 넣지 않기 위함입니다. `.env.example`만 git에 올라갑니다.
- 환경 변수 이름은 대소문자 구분 없이 `DB_PASSWORD` → `db_password`로 연결됩니다.

### 2.4 Sentry
- DSN이 비어 있으면 초기화하지 않으므로 Sentry 계정 없이도 개발할 수 있습니다.
- `send_default_pii=False` + `before_send`에서 민감 키 제거 → PRD 00 §7 "민감정보는 Sentry 전송 전 제거" 반영.

### 2.5 DB 계정 권한
- 개발 단계에서는 앱 계정이 테이블을 만들 수 있도록 CREATE/ALTER/DROP까지 부여했습니다. 운영에서는 SELECT/INSERT/UPDATE/DELETE만 남기는 것이 안전합니다(DB.md §1.2 원래 의도).

## 3. 검증 결과 (2026-10-01)
| 확인 | 결과 |
|---|---|
| `pip install -r requirements-dev.txt` | 성공 (FastAPI 0.142, SQLAlchemy 2.1, sentry-sdk 2.71 등) |
| `pytest` | 1 passed, 경고 없음 |
| `ruff check` | All checks passed |
| `GET /api/v1/health` | `{"status":"ok"}` |
| `GET /docs` | 200 |
| `GET /static/js/core/sentry-init.js` | 200 (정적 파일 서빙 확인) |
| `GET /api/v1/health/db` | `OperationalError` — **정상**: DB·계정을 아직 만들지 않음 |

## 4. 남은 일 (사용자)
1. `db/00_create_database.sql`의 `<APP_PASSWORD>`를 바꾸고 `mysql -u root -p < db\00_create_database.sql` 실행
2. 같은 비밀번호를 `studionx/.env`의 `DB_PASSWORD`에, 랜덤 문자열을 `JWT_SECRET`에 입력
3. `/api/v1/health/db`가 `{"db":"ok"}`인지 확인
4. (선택) Sentry 프로젝트를 만들고 `SENTRY_DSN` 입력
5. (C++) CMake·Emscripten·JUCE 설치 — `native/README.md`

## 5. 자주 받을 질문 대비
- **Q. 왜 Django가 아니라 FastAPI?** 기획서 기술 스택. 자동 API 문서(/docs), Pydantic 검증, WebSocket(Phase 6) 지원이 장점.
- **Q. 왜 프론트 빌드 도구(Vite 등)를 안 썼나?** 기술 스택이 Vanilla JS이고, ES Module(`<script type="module">`)만으로 모듈 분리가 가능해서. AudioWorklet도 별도 파일로 그대로 로드 가능.
- **Q. 테이블은 왜 아직 없나?** 기획서 원칙상 DB는 새 database에 만들되, 테이블은 Phase 1 작업(S1-02)에서 DB.md §5 DDL로 생성 예정.
