# Studio Nx — Claude 작업 지침

웹 기반 DAW 시퀀서. 항상 **한국어**로 답한다.

## 세션 시작 시 (특히 다른 컴퓨터)
1. **최신 작업 브랜치로 맞춘다.** 사용자가 "pull/받아와/최신으로" 등을 요청하면 `main`이 아니라 **커밋 시각이 가장 최근인 원격 브랜치**를 기준으로 받는다.
   ```bash
   git fetch --all --prune
   git for-each-ref --sort=-committerdate refs/remotes/origin --format="%(committerdate:iso) %(refname:short) %(subject)" --count=5
   ```
   맨 위 브랜치(`origin/HEAD` 제외)로 `git switch <브랜치>` 후 `git pull`. 바꾸기 전에 `git status`로 커밋 안 된 변경이 있으면 사용자에게 먼저 묻는다. 어떤 브랜치로 바꿨는지와 최신 커밋을 사용자에게 알린다. 백엔드 의존성 파일이 바뀌었으면 `.venv`에 다시 설치한다.
2. 작업 전에 **`docs/context_*.md` 중 날짜가 가장 최신인 파일을 먼저 읽는다** (1번으로 최신 브랜치에 맞춘 뒤, 현재: `docs/context_2026-10-02.md`). 지금까지의 결정·진행 상황·남은 일·사용자 주의 사항(PowerShell 사용 등)이 정리되어 있다. Claude Code 메모리는 컴퓨터마다 따로라서 이 파일이 맥락을 이어 준다.

## 프로젝트 원칙 (반드시 지킬 것)
@StudioNx_CLAUDE.md

요약: HTML/CSS는 AI가 작성(먼저 `studionx/frontend-reference/` 확인) · JS/백엔드는 **템플릿만**(요청 시에만 구현) · C++(`studionx/native/`)은 손대지 않음 · AI가 구현한 코드는 `docs/ai-notes/`에 설명 문서 필수.

## 구조
| 경로 | 내용 |
|---|---|
| `docs/` | 기획·설계 문서 (PRD, DB.md, ERD, 구현 계획, 매뉴얼) + PDF |
| `docs/_build/` | PDF·ERD 빌드 스크립트 (`build.js`, `erd.js`) |
| `studionx/backend/` | FastAPI (Python 3.13, `.venv`는 `studionx/.venv`) |
| `studionx/frontend/` | Vanilla HTML/CSS/JS — FastAPI가 정적 서빙 |
| `studionx/frontend-reference/` | HTML/CSS 레퍼런스 (웹 비공개) |
| `studionx/characters/nyxi/` | Nyxi 원본 자료: `reference/`, `base/`(Base 이미지) — 웹 비공개. 화면용 에셋은 `frontend/static/characters/nyxi/` |
| `studionx/db/` | Phase별 SQL (00~06, 99) + `docs/` 가이드 |

## 기준 문서
- 기능 요구사항: `docs/PRD/` · 구현 순서: `docs/Implementation_Plan.md`
- DB: `docs/DB.md`가 원본 → 바꾸면 `studionx/db/0X_*.sql`, `docs/_build/erd.js`(→ ERD.png), `docs/ERD.md`, `studionx/db/docs/` 가이드도 함께 갱신
- 캐릭터·AI 도우미 이름은 **Nyxi**. 캐릭터 외형·에셋은 외부 AI 플랫폼에서 제작하므로 만들지 않는다.

## 명령 (Windows)
| 목적 | 명령 |
|---|---|
| 서버 실행 | `cd studionx/backend` → `..\.venv\Scripts\python -m uvicorn app.main:app --reload` |
| 테스트 / 린트 | `..\.venv\Scripts\python -m pytest` / `..\.venv\Scripts\python -m ruff check .` |
| DB 연결 확인 | http://localhost:8000/api/v1/health/db → `{"db":"ok"}` |
| PDF 하나만 빌드 | `node docs/_build/build.js pdf <이름 일부>` (바꾼 문서만) |
| ERD 다시 그리기 | `node docs/_build/build.js erd` |

## 문서 작성
문서(md·PDF·docx)를 만들거나 고칠 때는 **먼저 `docs/AI_Doc_Template_Guide.md`를 읽고** 그 템플릿·빌드·검증 절차를 따른다.

## Git
- 브랜치·커밋 규칙: `docs/Git_Manual.md`
- 기능 작업은 작업 단위 브랜치 `feature/phaseN/pN-NN-*`(목록: `docs/Implementation_Plan.md` §2.1) → `feature/phaseN-*` → `develop`. 문서는 `docs/planning`. `main`에 직접 커밋하지 않는다.
- 커밋 메시지: `타입(범위): 내용` (feat, fix, docs, db, style, refactor, test, chore, wip)
- 커밋·푸시는 사용자가 요청할 때만.
