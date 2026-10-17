# Studio Nx — Claude 작업 지침

웹 기반 DAW 시퀀서. 항상 **한국어**로 답한다.

## 세션 시작 시 (특히 다른 컴퓨터)
1. **최신 작업 브랜치로 맞춘다.** 사용자가 "pull/받아와/최신으로" 등을 요청하면 `main`이 아니라 **커밋 시각이 가장 최근인 작업 브랜치(`feature/*`, `fix/*`)**를 기준으로 받는다. `main`·`develop`·`docs/planning`은 PR 병합 커밋 때문에 최신처럼 보이므로 비교에서 뺀다.
   ```bash
   git fetch --all --prune
   git for-each-ref --sort=-committerdate refs/remotes/origin/feature refs/remotes/origin/fix --format="%(committerdate:iso) %(refname:short) %(subject)" --count=5
   ```
   맨 위 브랜치로 `git switch <브랜치>` 후 `git pull`. 바꾸기 전에 `git status`로 커밋 안 된 변경이 있으면 사용자에게 먼저 묻는다. 어떤 브랜치로 바꿨는지와 최신 커밋을 사용자에게 알린다.
2. **pull 하거나 브랜치를 바꾼 뒤에는 백엔드 의존성을 항상 다시 설치하고 확인한다** (바뀌었는지 따지지 말고 매번 — 이미 있으면 금방 끝남). 컴퓨터마다 `.venv`가 따로라서, 다른 컴퓨터에서 추가한 패키지(예: 2026-10-03 `sqladmin`, `greenlet`)가 빠져 있으면 서버가 시작되지 않는다.
   ```powershell
   cd studionx/backend
   ..\.venv\Scripts\python -m pip install -r requirements-dev.txt
   ..\.venv\Scripts\python -c "import app.main"      # 오류 없으면 통과
   ..\.venv\Scripts\python -m pytest -q
   ```
   `.venv`가 없으면 `docs/ai-notes/01_dev_environment.md` 절차로 만든다. 설치한 패키지가 있었으면 사용자에게 알린다. `ModuleNotFoundError`가 나면 먼저 이 단계를 다시 한다.
3. 작업 전에 **`docs/context_*.md` 중 날짜가 가장 최신인 파일을 먼저 읽는다** (1번으로 최신 브랜치에 맞춘 뒤, 현재: `docs/context_2026-10-05.md`). 지금까지의 결정·진행 상황·남은 일·사용자 주의 사항(PowerShell 사용 등)이 정리되어 있다. Claude Code 메모리는 컴퓨터마다 따로라서 이 파일이 맥락을 이어 준다.

## 프로젝트 원칙 (반드시 지킬 것)
@StudioNx_CLAUDE.md

요약: HTML/CSS는 AI가 작성(먼저 `studionx/frontend-reference/` 확인) · JS/백엔드는 **AI가 작업 단위(예: S1-07 화면)마다 함수를 전부 이어서 구현**(함수마다 멈추지 않음)하고, 함수 1개당 개별 설명 문서(md+PDF)를 남기며, 작업이 끝나면 함수 문서 **합본 PDF**와 작업 전체를 정리한 **개요 ai-note**를 함께 만들고 사용자 검토는 작업 단위가 끝난 뒤 한 번에 받는다 (2026-10-17 변경 — 이전: 함수 하나씩 멈추고 검토 후 다음 함수) · JS 실제 코드는 전통 문법(`?.` · `??` 등 금지), 최신 문법 버전은 문서에만 (2026-10-07) · C++(`studionx/native/`)은 손대지 않음 · AI가 구현한 코드는 `docs/ai-notes/`에 설명 문서 필수.

## 구조
| 경로 | 내용 |
|---|---|
| `docs/` | 기획·설계 문서 (PRD, DB.md, ERD, 구현 계획, 매뉴얼) + PDF |
| `docs/_build/` | PDF·ERD 빌드 스크립트 (`build.js`, `erd.js`) |
| `docs/page_mockups/` | 화면별 디자인 목업 (`_source/`의 HTML → PNG) |
| `docs/screenshots/` | 실제 구동 화면 스크린샷. `YYYY-MM-DD_주제/` 폴더에 넣는다 |
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

**문장 규칙 (2026-10-12, ai-note 전체를 이 규칙으로 다시 썼다):**
- ~합니다체로, 조사·어미를 살린 완성된 문장으로 쓴다. 표 칸도 가능하면 서술어로 끝낸다 ("~합니다", "~입니다").
- "·" 로 항목을 잇지 말고 쉼표와 조사를 쓴다. 산문에서 엠대시(—)는 쓰지 않고 콜론이나 접속사로 바꾼다 (H1의 "NN — 제목" 형식만 유지).
- 머리 표는 "작업 | X: Y (FR…)", "작성 | Claude (AI), 날짜, 사용자 검토" 형식으로 쓴다.
- 코드 블록·식별자·숫자·링크는 그대로 둔다.
- 질문 문장은 "Q. …하나요?" 처럼 존댓말로 쓴다.
- PDF는 고친 문서의 것만 다시 만든다 (node docs/_build/build.js pdf <이름 일부>). 사용자가 요청하지 않은 새 합본이나 전체 합본은 만들지 않는다. 다만 작업 단위가 끝날 때 그 작업의 함수 문서 합본 PDF는 만든다 (2026-10-17).

**화면 이미지 저장 위치 (2026-10-17):** AI가 화면을 확인·검토하거나 사용자에게 보여 주려고 찍는 스크린샷(헤드리스 브라우저 캡처 등)은 **`docs/screenshots/YYYY-MM-DD_주제/`에 바로 저장**한다(임시 폴더에 두었다가 나중에 옮기지 않는다). 디자인 목업은 `docs/page_mockups/<화면>/`에 둔다.

## Git
- 브랜치·커밋 규칙: `docs/Git_Manual.md`
- 기능 작업은 작업 단위 브랜치 `feature/phaseN/pN-NN-*`(목록: `docs/Implementation_Plan.md` §2.1) → `feature/phaseN-*` → `develop`. 문서는 `docs/planning`. `main`에 직접 커밋하지 않는다.
- 커밋 메시지: `타입(범위): 내용` (feat, fix, docs, db, style, refactor, test, chore, wip)
- 커밋·푸시는 사용자가 요청할 때만.

## 작업 완료 시 (반드시)
작업 단위(P1-NN 등)의 PR이 상위 브랜치에 병합되어 작업이 끝나면, 사용자가 따로 말하지 않아도 아래 두 가지를 한다.
1. **YouTrack 반영:** 해당 이슈의 State를 `Closed`(StudioNx 프로젝트의 완료 값)로 바꾸고, PR 번호와 결과를 코멘트로 남긴다. 명령: `python tools/youtrack/yt.py set-state StudioNx P1-NN Closed --comment "…"` (인증: 사용자 환경 변수 `YOUTRACK_URL`, `YOUTRACK_TOKEN`, 사용법은 `docs/youtrack/README.md` §5). 연결이 안 되면 그 사실과 설정 방법을 알린다.
2. **다음 작업 요약:** 끝난 것, `docs/Implementation_Plan.md` §2.1 기준 다음 작업(번호·브랜치·할 일), 사용자가 정해야 할 것을 짧게 정리해 알린다.
