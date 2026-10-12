# AI 구현 설명 53 — P1-16 마이페이지 대시보드 API (`GET /me/dashboard`)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-12 |
| 작업 | P1-16 `GET /api/v1/me/dashboard`: PRD 01 FR-121, 128, 130, 131, 136 (마이페이지 한 화면에 필요한 값을 요청 한 번으로) |
| 브랜치 | `feature/phase1/p1-16-dashboard-api` |
| 바꾼 파일 | `app/models/project_session.py`, `app/services/dashboard_service.py`, `app/api/v1/me.py` / 시험 `tests/test_project_session_model.py`, `test_dashboard_service.py`, `test_me_routes.py` |
| 진행 방식 | **함수 하나씩** 구현하고 사용자가 검토한 뒤 다음 함수로 넘어갔습니다 |
| 함수별 설명 | `docs/ai-notes/backend(fastAPI_Python)/P1-16 - 대시보드 API/63 ~ 69` (md, PDF) |
| 실제 서버 시험 | [54_p1-16_site_test.md](54_p1-16_site_test.md): 회원가입부터 정리까지 모두 통과 |
| 이전 문서 | [52_p1-14_site_test.md](52_p1-14_site_test.md) |

## 1. 한 일
마이페이지(myPage.html)가 필요로 하는 값을 모두 돌려주는 API가 **실제로 동작**합니다. 전에는 응답 모양(스키마)과 함수 이름만 있었습니다.

| 응답 칸 | 내용 | Phase 1 값 |
|---|---|---|
| `user` | 닉네임, 이메일, 가입일, 사진 주소 | 실제 값 |
| `storage` | 한도, 사용량, 종류별 사용량 | 한도와 사용량은 `users`의 값, 종류별은 0 |
| `ai` | 오늘의 분석과 질문 `{used, limit}` | `used = 0`, 한도는 5와 30 |
| `ready_projects` | 내가 한 번도 열지 않은 프로젝트(최근 생성 3개) | 실제 값 |
| `recent_projects` | 최근 수정 5개와 각 프로젝트의 최근 7일 내 세션 | 실제 값 (세션은 Phase 2부터 쌓입니다) |

## 2. 사용자 결정 (2026-10-12)
| # | 내용 | 결과 |
|---|---|---|
| 1 | AI 사용량의 "오늘"을 어느 시각 기준으로 셀지 | **UTC 0시 기준**(A안). 서버가 사용자 시간대를 알 필요가 없습니다 |
| 2 | 사진은 저장 용량에 넣을지 | **넣지 않음**. 사진을 올려도 `used_bytes`는 그대로입니다 (64) |

## 3. 항목 (백엔드 7)
| # | 파일 | 함수 | 하는 일 | 설명 |
|---|---|---|---|---|
| 63 | `models/project_session.py` | `ProjectSession` 나머지 컬럼 | `started_at`, `last_seen_at`, `active_seconds` | [63](<backend(fastAPI_Python)/P1-16 - 대시보드 API/63_model_project_session.md>) |
| 64 | `dashboard_service.py` | `get_storage()` | 한도, 사용량 (종류별은 0) | [64](<backend(fastAPI_Python)/P1-16 - 대시보드 API/64_dashboard_get_storage.md>) |
| 65 | 〃 | `get_ai_usage()` | 오늘 사용량 0, 한도 5, 30 | [65](<backend(fastAPI_Python)/P1-16 - 대시보드 API/65_dashboard_get_ai_usage.md>) |
| 66 | 〃 | `get_recent_projects()` | 최근 수정 5개와 내 7일 세션(IN 쿼리 한 번) | [66](<backend(fastAPI_Python)/P1-16 - 대시보드 API/66_dashboard_get_recent_projects.md>) |
| 67 | 〃 | `get_ready_projects()` | 내 세션이 0개인 프로젝트(`NOT EXISTS`) | [67](<backend(fastAPI_Python)/P1-16 - 대시보드 API/67_dashboard_get_ready_projects.md>) |
| 68 | 〃 | `get_dashboard()` | 위 조각을 한 응답으로 묶기 | [68](<backend(fastAPI_Python)/P1-16 - 대시보드 API/68_dashboard_get_dashboard.md>) |
| 69 | `api/v1/me.py` | `read_dashboard()` | `GET /me/dashboard` 라우터 | [69](<backend(fastAPI_Python)/P1-16 - 대시보드 API/69_me_route_dashboard.md>) |

## 4. 템플릿에서 달라진 점
| 항목 | 템플릿 | 구현 | 이유 |
|---|---|---|---|
| 세션 시각 칸 | 컬럼 목록만 TODO | `DATETIME(3)`, 기본값 `CURRENT_TIMESTAMP(3)` | DB.md와 SQL 파일에 맞춤 (63) |
| 최근 프로젝트의 세션 | 프로젝트마다 조회 | `project_id IN (...)` 한 번 | 쿼리 6번이 2번으로 줄어듭니다 (66) |
| 이어 하기 | "세션이 0개" | 쿼리 안의 `NOT EXISTS` | 파이썬이 세션을 모두 가져와 거를 필요가 없습니다 (67) |
| 프로필 사진 주소 | — | P1-08의 `profile_image_url` 재사용 | 사진 주소 규칙을 한 곳에서만 관리합니다 (68) |

## 5. 시험
| 방법 | 대상 | 결과 |
|---|---|---|
| 서비스 시험 (실제 MySQL) | 63 ~ 68 | `test_project_session_model.py` 4개, `test_dashboard_service.py` 21개: 모두 통과 |
| 요청 시험 (실제 앱, 실제 MySQL) | 69 | `test_me_routes.py` 5개: 모두 통과 |
| 실제 서버 시험 ([54](54_p1-16_site_test.md)) | 가입 → 로그인 → 대시보드 → 프로젝트 → 삭제 → 세션 | **모두 통과** |
| 백엔드 pytest 전체 | | **521개 통과**, `ruff` 통과 |

## 6. 다음 작업, 남은 것
| 작업 | 내용 |
|---|---|
| **P1-17 마이페이지 JS** | `feature/phase1/p1-17-mypage-js`: `mypage.js`의 `loadDashboard`가 이 API를 부릅니다. 'Ready to start' 배너의 제목에 `data-title`을 넣어야 안내 모달 제목이 맞습니다 (38 참고) |
| Phase 2 | 시퀀서가 1분마다 보내는 작업 세션 신호(FR-257)를 받아 `project_sessions`를 채우는 API |
| 나중에 | AI 한도를 `core/config.py` 설정으로 옮기기, 종류별 저장 용량 계산 (파일 테이블이 생긴 뒤) |
