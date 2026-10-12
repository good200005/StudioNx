# AI 구현 설명 23 — Development 공지 API · 관리자 화면 템플릿

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-03 |
| 작업 | P1-21 공지 API(`GET /dev-notes`) + SQLAdmin 관리자 화면(`/admin`, ADMIN만 사용) (**템플릿**), 이전 문서: [22_dashboard_api_template.md](22_dashboard_api_template.md) |
| 브랜치 | `feature/phase1/p1-21-dev-notes-admin` (P1-16 브랜치에서 갈라졌으므로 **앞의 PR을 먼저 병합**해야 합니다) |
| 원칙 | 백엔드는 **템플릿만** 만들었습니다 (라우터, 스키마, 함수 이름과 TODO). 실제 구현은 사용자가 합니다 |

---

## 1. 무엇을 만들었나
| 파일 | 상태 | 내용 |
|---|---|---|
| `app/api/v1/dev_notes.py` | 템플릿 (새 파일) | `GET /dev-notes?limit=4`, `GET /dev-notes/{note_id}`이며, 로그인 없이 읽을 수 있습니다 |
| `app/schemas/dev_note.py` | 완성 (새 파일) | `DevNoteItem`, `DevNoteDetail`, `DevNoteListResponse` |
| `app/services/dev_note_service.py` | 템플릿 (새 파일) | `list_published`, `get_published` |
| `app/models/dev_note.py` | 뼈대 (새 파일) | `DevNote`의 기본 키와 `author_id`만 있고, 나머지 컬럼은 TODO입니다 |
| `app/admin.py` | 템플릿 (새 파일) | `AdminAuth`(로그인, 로그아웃, 확인), `DevNoteAdmin`, `InquiryAdmin`, `UserAdmin`, `setup_admin`이 있습니다 |
| `app/main.py` | 수정 | `setup_admin(app)`을 부릅니다. 프론트 마운트(`/`)보다 먼저 부릅니다 |
| `requirements.txt` | 수정 | `sqladmin>=0.20`을 추가하고, `sqlalchemy`를 `sqlalchemy[asyncio]`로 바꿨습니다 (§2.3) |
| `tests/test_models.py`, `tests/test_dev_note_routes.py` | 수정과 새 파일 | 테이블 이름과 기본 키, 주소의 연결을 확인합니다 |

## 2. 왜 이렇게 했나
### 2.1 읽기는 API, 쓰기는 관리자 화면
| 하는 일 | 어디서 | 누가 |
|---|---|---|
| 공지 최신 4개, 상세 보기 | `GET /dev-notes` (메인 페이지 `home.js`) | 누구나 |
| 공지 작성, 수정, 공개 | `/admin` → Dev notes | ADMIN |
| 문의 확인·답변 | `/admin` → Inquiries | ADMIN |
| 회원 정지 | `/admin` → Users (`status`) | ADMIN |

작성 화면을 직접 만들지 않고 SQLAdmin을 쓰면, 모델만 등록해도 목록, 검색, 수정 폼이 생깁니다 (FR-115).

### 2.2 관리자 로그인
SQLAdmin은 API의 JWT를 쓰지 않고 자체 세션 쿠키로 로그인합니다. `AdminAuth.login`에서 P1-05의 `authenticate`로 이메일과 비밀번호를 확인하고, `role`이 `ADMIN`인지 한 번 더 봅니다.

> ADMIN 계정은 일반 가입 후 DB에서 `UPDATE users SET role = 'ADMIN' WHERE email = '…';`로 만듭니다.

### 2.3 의존성 추가
| 패키지 | 이유 |
|---|---|
| `sqladmin` | 관리자 화면에 씁니다 (설치를 확인했습니다: 0.32.0) |
| `sqlalchemy[asyncio]` (= `greenlet`) | `sqladmin`을 불러올 때 SQLAlchemy 비동기 모듈을 함께 불러오는데, `greenlet`이 없으면 서버가 시작되지 않습니다 |

> 다른 컴퓨터에서는 `..\.venv\Scripts\python -m pip install -r requirements.txt`를 다시 실행합니다.

### 2.4 `setup_admin` 위치
`main.py`는 마지막에 프론트 정적 파일을 `/`에 붙입니다. `/admin`을 그 뒤에 붙이면 정적 파일 쪽이 먼저 주소를 받아서 404가 됩니다. 그래서 API 라우터 바로 다음, 프론트 마운트 전에 호출합니다. 지금 `setup_admin`은 비어 있어 서버 동작은 그대로입니다.

## 3. 검증 결과 (2026-10-03)
| 확인 | 결과 |
|---|---|
| `pytest` | 14개가 통과했습니다 (모델 테스트에 `DevNote`를 추가했습니다) |
| `ruff check` | 통과했습니다 |
| 실제 DB 조회 | `select(DevNote)`에서 오류가 없습니다 (행은 없습니다) |
| 서버 시작 | `TestClient`로 `/api/v1/health`가 200입니다 (`sqladmin` 불러오기 포함) |
| OpenAPI | `/dev-notes`와 `/dev-notes/{note_id}`가 표시됩니다 |

## 4. 남은 일 (사용자)
| 순서 | 할 일 | 파일 |
|---|---|---|
| 1 | `DevNote` 나머지 컬럼 | `app/models/dev_note.py` |
| 2 | 서비스 2개, 라우터 2개 | `dev_note_service.py`, `dev_notes.py` |
| 3 | `AdminAuth` 3개 함수, `setup_admin`, 관리 화면 3개 설정 | `app/admin.py` |
| 4 | 화면 연결 `loadDevNotes` | `static/js/pages/home.js` |
| 5 | 운영에서 `/admin` 주소를 바꿀지, IP를 제한할지 결정 | — |

## 5. 자주 받을 질문 대비
- **Q. 공지 본문(Markdown)을 화면에 그냥 넣어도 되나요?** 안 됩니다. 관리자만 쓰더라도 HTML로 바꿀 때는 escape(또는 안전한 Markdown 변환기)를 거쳐야 스크립트가 끼어들지 않습니다.
- **Q. 초안은 어떻게 숨기나요?** `is_published = False`인 공지는 목록·상세 모두 404로 처리합니다. 주소를 알아도 보이지 않습니다.
- **Q. SQLAdmin 화면에서 비밀번호 해시가 보이지 않나요?** `UserAdmin`에서 `password_hash`를 목록과 폼 모두에서 빼도록 TODO에 적었습니다.
