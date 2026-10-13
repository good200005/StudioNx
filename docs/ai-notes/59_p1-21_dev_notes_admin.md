# AI 구현 설명 59 — P1-21 Development 공지 API와 관리자 화면 (`/admin`)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-13 |
| 작업 | P1-21 공지 API(`GET /dev-notes`)와 SQLAdmin 관리자 화면: PRD 01 FR-114, FR-115 |
| 브랜치 | `feature/phase1/p1-21-dev-notes-admin` |
| 바꾼 파일 | `app/models/dev_note.py`, `app/services/dev_note_service.py`, `app/api/v1/dev_notes.py`, `app/admin.py`, `app/core/config.py`, `requirements.txt`, `studionx/.env.example` / 시험 `test_dev_note_model.py`, `test_dev_note_service.py`, `test_dev_note_routes.py`, `test_admin_auth.py`, `test_admin_dev_note.py`, `test_admin_inquiry.py`, `test_admin_user.py`, `test_setup_admin.py` |
| 진행 방식 | **함수 하나씩** 구현하고 사용자가 검토한 뒤 다음 함수로 넘어갔습니다 |
| 함수별 설명 | `docs/ai-notes/backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/82 ~ 92` (md, PDF), 합본 `P1-21_dev_notes_admin.pdf` |
| 실제 서버 시험 | [60_p1-21_site_test.md](60_p1-21_site_test.md): 마우스와 키보드로 29단계 모두 통과 |
| 이전 문서 | [58_p1-22_site_test.md](58_p1-22_site_test.md) |

## 1. 한 일
메인 페이지의 Development 공지를 **관리자가 쓰고**, **누구나 읽을 수 있게** 했습니다.

| 영역 | 내용 |
|---|---|
| 읽기 (공개 API) | `GET /api/v1/dev-notes`(최신 4개, 본문 없음), `GET /api/v1/dev-notes/{id}`(본문 포함). 로그인 없이 읽습니다 |
| 쓰기 (관리자 화면) | `/admin`에서 공지 작성, 수정, 공개, 삭제. ADMIN 계정만 들어옵니다 |
| 부가 화면 | 문의 답변(`InquiryAdmin`), 회원 보기와 정지(`UserAdmin`) |

![관리자 화면의 공지 목록: 예약 공개, 바로 공개, 초안에서 공개로 바꾼 공지](images/backend_p1-21/60_notes.png)

## 2. 항목 (백엔드 11)
| # | 파일 | 함수 | 하는 일 | 설명 |
|---|---|---|---|---|
| 82 | `models/dev_note.py` | `DevNote` 나머지 컬럼 | 제목, 요약, 본문, 공개 여부, 공개 시각, 시각 3개 | [82](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/82_model_dev_note.md>) |
| 83 | `services/dev_note_service.py` | `list_published()` | 공개되고 시각이 지난 공지를 최신순으로 | [83](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/83_dev_note_list_published.md>) |
| 84 | 〃 | `get_published()` | 공지 하나, 보이면 안 되는 것은 404 | [84](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/84_dev_note_get_published.md>) |
| 85 | `api/v1/dev_notes.py` | 라우터 2개 | `GET /dev-notes`, `GET /dev-notes/{id}` | [85](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/85_dev_notes_routes.md>) |
| 86 | `admin.py` | `AdminAuth.login()` | ADMIN만 로그인, 세션에 번호만 저장 | [86](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/86_admin_auth_login.md>) |
| 87 | 〃 | `AdminAuth.logout()`, `authenticate()` | 세션 비우기, 매 요청 DB 확인 | [87](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/87_admin_auth_logout_authenticate.md>) |
| 88 | 〃 | `DevNoteAdmin` | 목록, 폼, 작성자와 공개 시각 자동, 본문 여러 줄 | [88](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/88_admin_dev_note_admin.md>) |
| 89 | 〃 | `DevNoteAdmin.delete_model()` | 소프트 삭제 | [89](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/89_admin_dev_note_soft_delete.md>) |
| 90 | 〃 | `InquiryAdmin` | 답변과 상태만, 답변 시각 자동, 만들기와 삭제 없음 | [90](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/90_admin_inquiry_admin.md>) |
| 91 | 〃 | `UserAdmin` | 역할과 상태만, `password_hash` 숨김, 자기 자신 보호 | [91](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/91_admin_user_admin.md>) |
| 92 | 〃 | `setup_admin()` | `/admin`에 연결, 주소는 `ADMIN_PATH` 설정 | [92](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/92_admin_setup_admin.md>) |

## 3. 사용자 결정과 달라진 점
| 항목 | 내용 | 이유 |
|---|---|---|
| 관리자 주소 (2026-10-13) | 개발은 `/admin` 그대로, **배포 때 `.env`의 `ADMIN_PATH`로 추측하기 어려운 주소**로 바꿉니다 | 관리자 화면의 주소를 숨기기 위해서입니다. 코드 수정 없이 설정만 바꿉니다 |
| 예약 공개 | 공개 시각을 미래로 두면 그때까지 숨습니다 | 별도 스케줄러 없이 `published_at <= 지금` 조건 하나로 처리합니다 |
| 소프트 삭제 | 삭제 버튼이 `deleted_at`만 채웁니다 | `DB.md`의 규칙이며 되살릴 수 있습니다 |
| 새 패키지 | `requirements.txt`에 **`itsdangerous>=2.1`** | 관리자 세션 쿠키 서명용입니다. **다른 컴퓨터에서는 pull 뒤에 `pip install -r requirements-dev.txt`를 다시 해야 합니다** |
| 새 설정 | `ADMIN_PATH` (`.env.example`에 추가) | 위와 같습니다 |
| 본문 입력칸 | `TextAreaField`로 바꿈 | 사이트 시험에서 SQLAdmin이 `MEDIUMTEXT`를 한 줄 입력창으로 만드는 것을 발견했습니다 |
| 보안 규칙 | `authenticate`가 매 요청 DB 확인, `password_hash`를 네 곳에서 숨김, 자기 자신을 내리거나 정지하는 것과 `DELETED`로 바꾸는 것을 막음 | 정지되거나 권한이 회수된 계정이 쿠키로 계속 들어오는 일, 해시 유출, 마지막 관리자 잠금을 막습니다 |

## 4. 시험
| 방법 | 대상 | 결과 |
|---|---|---|
| 서비스와 설정 시험 (실제 MySQL) | 82 ~ 92 | 모델 4, 서비스 11, 라우터 13, 관리자 로그인 15, 공지 화면 14, 문의 12, 회원 14, `setup_admin` 11: 모두 통과 |
| 백엔드 pytest 전체 | | **661개 통과**, `ruff` 통과 |
| 실제 서버, 브라우저 ([60](60_p1-21_site_test.md)) | 로그인부터 로그아웃까지 | **29단계 모두 통과** |

## 5. 다음 작업, 남은 것
| 작업 | 내용 |
|---|---|
| **P1-18** | `feature/phase1/p1-18-tests`: 가입, 로그인, 재발급, 다른 사람 프로젝트 접근 차단, 탈퇴 계정 로그인 회귀 시험 |
| P1-19 | ai-notes 정리와 `develop`으로 PR. 그 뒤 `home.html` 등 화면을 점검하고 S1-05(오디오 엔진)로 갑니다 |
| 화면 점검 때 정할 것 | 메인 페이지의 `loadDevNotes()`(JS)가 아직 비어 있습니다. 이 API를 부르는 일입니다 |
| 배포 준비 때 정할 것 | `ADMIN_PATH` 바꾸기, `JWT_SECRET`을 `change-me`가 아닌 긴 랜덤 값으로, 앞단(Nginx 등)의 IP 제한 여부 |
| 나중에 | 문의 답변을 이메일로 보내기 (메일 발송 기능이 생긴 뒤) |
