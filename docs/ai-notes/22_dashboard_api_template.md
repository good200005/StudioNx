# AI 구현 설명 22 — 마이페이지 대시보드 API 템플릿

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-03 |
| 작업 | P1-16 `GET /me/dashboard`: 프로필, 저장 용량, AI 사용량, 이어 하기, 최근 프로젝트 5개와 최근 7일 작업 세션 (**템플릿**), 이전 문서: [21_project_api_template.md](21_project_api_template.md) |
| 브랜치 | `feature/phase1/p1-16-dashboard-api` (P1-13 브랜치에서 갈라졌으므로 **앞의 PR을 먼저 병합**해야 합니다) |
| 원칙 | 백엔드는 **템플릿만** 만들었습니다 (라우터, 스키마, 함수 이름과 TODO). 실제 구현은 사용자가 합니다 |

---

## 1. 무엇을 만들었나
| 파일 | 상태 | 내용 |
|---|---|---|
| `app/api/v1/me.py` | 템플릿 (새 파일) | `GET /me/dashboard` |
| `app/api/v1/router.py` | 수정 | `/me`를 연결했습니다 |
| `app/schemas/dashboard.py` | 완성 (새 파일) | `DashboardResponse`와 하위 모양 9개가 있습니다 |
| `app/services/dashboard_service.py` | 템플릿 (새 파일) | `get_dashboard`, `get_storage`, `get_ai_usage`, `get_recent_projects`, `get_ready_projects`와 기준값이 있습니다 |
| `app/models/project_session.py` | 뼈대 (새 파일) | `ProjectSession`의 기본 키와 FK만 있고, 나머지 컬럼은 TODO입니다 (P1-03 모델과 같은 방식) |
| `app/models/__init__.py` | 수정 | `ProjectSession`을 등록했습니다 |
| `tests/test_models.py`, `tests/test_me_routes.py` | 수정과 새 파일 | 테이블 이름과 기본 키, 주소의 연결을 확인합니다 |

## 2. 왜 이렇게 했나
### 2.1 응답 모양
`mypage.js`의 `loadDashboard` 주석에 적어 둔 응답 예시를 그대로 스키마로 옮겼습니다.

| 칸 | 내용 | Phase 1 값 |
|---|---|---|
| `user` | 닉네임, 이메일, 가입일, 사진 주소 | 실제 값 |
| `storage` | 한도, 사용량, 종류별 사용량 | 한도와 사용량은 `users`의 값이고, 종류별은 0입니다 (파일 테이블은 Phase 2부터) |
| `ai` | 오늘의 분석과 질문 `{used, limit}` | `used = 0`이고, `limit`은 기준값입니다 (분석 5, 질문 30) |
| `ready_projects` | 내 세션이 0개인 프로젝트이며, 최근 생성순입니다 | 실제 값 |
| `recent_projects` | 최근에 수정한 5개와 각 프로젝트의 최근 7일 **내** 세션 | 실제 값입니다 (세션 기록은 Phase 2부터라서 빈 목록입니다) |

### 2.2 요일 나누기는 화면에서
서버는 세션 시각을 UTC 그대로 보내고, 요일과 자정의 구분은 브라우저 시간대로 화면이 합니다 (DB.md §3.1 `project_sessions` 메모). 서버가 사용자 시간대를 알 필요가 없습니다.

### 2.3 쿼리 수 줄이기
최근 프로젝트 5개의 세션을 프로젝트마다 따로 조회하면 쿼리가 6번 나갑니다. TODO에는 `project_id IN (...)`으로 한 번에 받아서 묶도록 적었습니다.

## 3. 검증 결과 (2026-10-03)
| 확인 | 결과 |
|---|---|
| `pytest` | 13개가 통과했습니다 (모델 테스트에 `ProjectSession`을 추가했습니다) |
| `ruff check` | 통과했습니다 |
| 실제 DB 조회 | `select(ProjectSession)`에서 오류가 없습니다 (행은 없습니다) |
| OpenAPI | `GET /api/v1/me/dashboard`가 표시됩니다 |

## 4. 남은 일 (사용자)
| 순서 | 할 일 | 파일 |
|---|---|---|
| 1 | `ProjectSession` 나머지 컬럼 | `app/models/project_session.py` |
| 2 | 서비스 함수 5개 | `app/services/dashboard_service.py` |
| 3 | 라우터 본문 | `app/api/v1/me.py` |
| 4 | 프로젝트 목록의 `opened`(P1-13의 `to_item`)도 이 모델로 계산합니다 | `app/services/project_service.py` |
| 5 | 화면 연결 | `static/js/pages/mypage.js` |
| 6 | AI 한도를 `core/config.py` 설정으로 옮길지, "오늘"을 UTC로 셀지 결정 | — |

## 5. 자주 받을 질문 대비
- **Q. Phase 1에서 값이 0인 칸을 왜 미리 두나요?** 화면(M-2 믹서 콘솔형)이 이미 그 칸을 그립니다. 응답 모양을 지금 정해 두면 Phase 2와 5에서 서버 계산만 바꾸면 되고, 화면은 고치지 않아도 됩니다.
- **Q. 대시보드를 여러 API로 나누지 않은 이유는 무엇인가요?** 마이페이지는 한 번 열 때 모든 칸이 필요합니다. 요청 1번으로 받으면 화면이 한꺼번에 채워지고 깜빡임이 적습니다.
- **Q. 이어 하기는 왜 "내" 세션을 기준으로 하나요?** 협업 프로젝트에서 다른 멤버가 열었더라도 내가 아직 열지 않았다면 "Ready to start"로 보여야 하기 때문입니다 (FR-130).
