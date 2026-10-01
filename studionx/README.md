# Studio Nx

웹 기반 DAW 시퀀서. 기획·설계 문서는 상위 폴더의 [`docs/`](../docs/) 참고 (PRD, DB.md, ERD, 구현 계획).

## 기술 스택
| 영역 | 기술 |
|---|---|
| Frontend | HTML5 + CSS + JavaScript (Vanilla, 빌드 도구 없음) — FastAPI가 정적 파일로 서빙 |
| Backend | Python 3.13 + FastAPI, SQLAlchemy 2 + PyMySQL |
| Database | MySQL 8.0 — database `studionx` |
| 오류 추적 | Sentry (백엔드 `sentry-sdk`, 프론트 CDN 번들) |
| C++ | `native/` — JUCE → WebAssembly (사용자 직접 구현) |

## 폴더 구조
```
studionx/
├─ backend/
│  ├─ app/
│  │  ├─ main.py          FastAPI 진입점 (API + 프론트 정적 파일)
│  │  ├─ core/            설정(config.py), Sentry(sentry.py)
│  │  ├─ db/              SQLAlchemy 엔진·세션(session.py)
│  │  ├─ api/v1/          라우터 (router.py 에 기능별 라우터 등록)
│  │  ├─ models/          ORM 모델 (DB.md 테이블)
│  │  ├─ schemas/         Pydantic 요청/응답 스키마
│  │  ├─ services/        비즈니스 로직
│  │  └─ workers/         백그라운드 작업 (출력 인코딩·악기 분리·AI 분석)
│  ├─ tests/
│  ├─ requirements.txt / requirements-dev.txt / pyproject.toml
├─ frontend/
│  ├─ *.html              home, login, join, myPage, userInfo, myProject, studioNx (예정)
│  └─ static/ css · js · assets · characters(Nyxi 외부 에셋) · wasm(예정)
├─ frontend-reference/    HTML/CSS 레퍼런스 (images/, code/) — 웹에 서빙되지 않음, AI가 작성 전 확인
├─ db/                    DB 생성(00)·Phase별 테이블(01~06)·초기화(99) SQL
│  └─ docs/               DB 스크립트 가이드 (md + docx), _build/ = md→docx 변환
├─ native/                C++ DSP (사용자 영역)
├─ storage/               업로드·출력 파일 (git 제외)
├─ tests/audio/           오디오 회귀 테스트 (골든 파일)
└─ .env.example
```

## 처음 설정 (Windows)
```bash
# 1) 가상환경 + 의존성 (이미 생성되어 있다면 생략)
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements-dev.txt

# 2) 환경 변수
copy .env.example .env          # 그리고 DB_PASSWORD, JWT_SECRET 수정

# 3) DB 생성 — db/00_create_database.sql 의 <APP_PASSWORD> 를 .env 의 DB_PASSWORD 와 같게 바꾼 뒤
mysql -u root -p < db\00_create_database.sql
```

## 실행
```bash
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --reload
```
| 주소 | 내용 |
|---|---|
| http://localhost:8000/api/v1/health | 서버 동작 확인 |
| http://localhost:8000/api/v1/health/db | MySQL 연결 확인 |
| http://localhost:8000/docs | API 문서 (Swagger) |
| http://localhost:8000/ | 프론트엔드 (frontend/) |

## 테스트 · 린트
```bash
cd backend
..\.venv\Scripts\python -m pytest
..\.venv\Scripts\python -m ruff check .
```
