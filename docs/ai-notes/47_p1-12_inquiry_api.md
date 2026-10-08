# AI 구현 설명 47 — P1-12 문의 API (문의 등록 · 반복 전송 제한 · 보관 정리 · 홈 문의 폼)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) · 2026-10-08 |
| 작업 | P1-12 문의 API + 로그인 시 자동 채움 + 반복 전송 제한 — PRD 01 FR-112 · FR-113 (P1-11 홈 화면의 남은 JS 포함) |
| 브랜치 | `feature/phase1/p1-12-inquiry-api` |
| 바꾼 파일 | 백엔드 `schemas/inquiry.py` · `services/inquiry_service.py` · `api/v1/inquiries.py` · `core/config.py` · `workers/retention.py` · `.env.example` / 화면 `pages/home.js` / 처리방침 `privacy.html` · `home.html` · `join.js` · `schemas/auth.py` · `docs/Privacy_Policy_Draft.md` / 시험 4개 파일 |
| 진행 방식 | **함수 하나씩** 구현 → 사용자 검토 → 다음. JS 실제 코드는 전통 문법 |
| 함수별 설명 | 백엔드 `docs/ai-notes/backend(fastAPI_Python)/P1-12 - 문의 API/50 ~ 55` · JS `docs/ai-notes/javascript/P1-12 - 문의 폼 JS/28` (md · PDF), 합본 [`P1-12_inquiry_api.pdf`](<backend(fastAPI_Python)/P1-12 - 문의 API/P1-12_inquiry_api.pdf>) |
| 실제 사이트 시험 | [48_p1-12_site_test.md](48_p1-12_site_test.md) — 홈 Contact 폼을 사람처럼, 9개 통과 |
| 이전 문서 | [46_p1-10_site_test.md](46_p1-10_site_test.md) |

## 1. 한 일
홈 화면의 **Contact 폼이 실제로 동작**한다. 누구나 문의를 보낼 수 있고, 같은 사람이 짧은 시간에 여러 번 보내지 못하며, 오래된 문의는 처리방침대로 지워진다.

| 부분 | 이제 되는 것 |
|---|---|
| 문의 등록 | `POST /api/v1/inquiries` — 비회원도 가능, 로그인한 회원이면 문의를 회원과 연결 |
| 반복 전송 제한 | 같은 IP 또는 같은 이메일로 **10분에 2번**까지, 넘으면 429 + 몇 초 뒤 가능한지 |
| 보관 정리 | `python -m app.workers.retention` — 탈퇴 계정 정리(P1-09) + **1년 지난 문의 삭제** |
| 홈 Contact 폼 | 보내기 · 결과 알림창 · 로그인 시 이메일 자동 채움 |

## 2. 사용자 결정 (2026-10-08)
| # | 정한 것 | 결정 | 템플릿 · 이전 |
|---|---|---|---|
| 1 | 반복 전송 횟수 | **10분에 2번** | 10분에 3번 |
| 2 | 저장에 실패한 시도도 세나 | **세지 않음** → 검사와 세기를 두 함수로 나눔 (51) | (정하기) |
| 3 | 보낸 사람 IP (결정 A) | 기본은 연결 IP만, `X-Forwarded-For` 무시. 배포 때 프록시를 두면 `TRUST_PROXY=true` 로 헤더의 첫 IP (53) | (정하기) |
| 4 | 답변하지 않은 문의 보관 (A) | **받은 뒤 1년**에 삭제 (답변한 문의는 답변 뒤 1년) → 처리방침 문구 추가 · **버전 `2026-10-08`** (54 · 55) | 처리방침에 "답변 후 1년" 만 |

## 3. 항목 (백엔드 6 + JS 1)
| # | 파일 | 함수 | 하는 일 | 설명 |
|---|---|---|---|---|
| 50 | `schemas/inquiry.py` | `InquiryCreateRequest` | 이메일 형식 · 제목 200 · 내용 2000 · 앞뒤 공백 제거 후 빈 값 막기 | [50](<backend(fastAPI_Python)/P1-12 - 문의 API/50_inquiry_schema_request.md>) |
| 51 | `services/inquiry_service.py` | `check_rate_limit()` · `record_inquiry_send()` | 10분에 2번 검사 / 저장 뒤 셈 (메모리 · 잠금) | [51](<backend(fastAPI_Python)/P1-12 - 문의 API/51_inquiry_service_rate_limit.md>) |
| 52 | `services/inquiry_service.py` | `create_inquiry()` | 동의 확인 → 제한 검사 → 저장 (회원 연결 · 동의 시각) → 셈 | [52](<backend(fastAPI_Python)/P1-12 - 문의 API/52_inquiry_service_create_inquiry.md>) |
| 53 | `api/v1/inquiries.py` | `POST /inquiries` · `client_ip()` | 라우터 · 보낸 사람 IP (`TRUST_PROXY`) | [53](<backend(fastAPI_Python)/P1-12 - 문의 API/53_inquiries_route_create.md>) |
| 54 | `workers/retention.py` | `purge_old_inquiries()` | 답변(없으면 받은) 뒤 1년 지난 문의 삭제 | [54](<backend(fastAPI_Python)/P1-12 - 문의 API/54_retention_purge_old_inquiries.md>) |
| 55 | `workers/retention.py` | `main()` | 정리 명령 — 두 정리 실행 · 결과 한 줄 · 오류는 Sentry | [55](<backend(fastAPI_Python)/P1-12 - 문의 API/55_retention_main.md>) |
| JS 28 | `pages/home.js` | `initContactForm()` | Contact 폼 보내기 · 알림창 · 이메일 자동 채움 | [28](<javascript/P1-12 - 문의 폼 JS/28_home_initContactForm.md>) |

## 4. 템플릿에서 달라진 점
| 항목 | 템플릿 | 구현 | 이유 |
|---|---|---|---|
| 제목 · 내용 검사 | `min_length=1` | 앞뒤 공백을 지운 뒤 검사 | 공백 한 칸짜리 문의가 저장되지 않게 (50) |
| 반복 전송 제한 | `check_rate_limit` 하나 (검사 + 셈) · 3번 | 검사 / 셈 두 함수 · 2번 | 사용자 결정 1 · 2 (51) |
| 보낸 사람 IP | — | `client_ip()` + 설정 `trust_proxy` | 헤더를 꾸며 제한을 피하지 못하게 (사용자 결정 3, 53) |
| `create_inquiry` 의 `.strip()` | 있음 | 없음 | 스키마가 이미 지운 값을 넘김 (52) |
| 문의 삭제 기준 | 답변 후 1년 | 답변 시각, 없으면 받은 시각 (`COALESCE`) | 사용자 결정 4 (54) |
| 폼 결과 표시 | "안내 문구" | 알림창 (FIX-01 `showAlert`) | 폼에 결과 문구 자리가 없음 · 모든 알림을 같은 모양으로 (28) |
| 폼 요청 | — | 토큰을 붙여 보냄 | 회원 문의를 회원과 연결 (FR-112) — 처음엔 토큰 없이 보내 연결이 빠졌던 것을 시험에서 찾아 고침 (28) |

## 5. 시험
| 방법 | 대상 | 결과 |
|---|---|---|
| pytest (실제 MySQL · 실제 앱) | 50 · 51 · 52 · 53 · 54 · 55 | 새 파일 `test_inquiry_schemas.py` 16 · `test_inquiry_service.py` 17 · `test_inquiry_routes.py` 16 · `test_retention.py` +5 → **전체 405개 통과**, `ruff` 통과 |
| 정리 명령을 손으로 | 55 | `withdrawn accounts: 0, inquiries: 0`, 종료 코드 0 |
| 실제 페이지 안에서 함수 시험 (실제 서버) | JS 28 | 비회원 7 · 회원 2 + DB 의 회원 연결 확인 — 모두 통과 |
| 사람처럼 클릭 · 타이핑 (48) | 빈 칸 → 동의 안 함 → 보냄 → 3번째 → 회원 자동 채움 → 회원 보냄 | **9개 통과** |
| 고친 파일을 쓰는 앞 시험 다시 | P1-07 13 · 14, FIX-01 18 · 19 | 모두 통과 |

**시험에서 찾아 고친 것 (JS 28):** ① 알림창이 닫힐 때까지 Send 버튼이 잠겨 있음 → 알림창을 기다리지 않게. ② 로그인한 회원의 문의가 회원과 연결되지 않음 → 토큰을 붙여 보내게.

반복 전송 기록은 서버 메모리에 있으므로, 화면 시험마다 시험 서버를 다시 켜 기록을 비웠다. 시험이 만든 문의 · 계정은 모두 지웠다 (DB 의 문의 0개, 계정은 데모 · 사용자 계정만).

## 6. 다음 작업 · 남은 것
| 작업 | 내용 |
|---|---|
| **P1-13 프로젝트 API** | `feature/phase1/p1-13-project-api` — 프로젝트 CRUD: 만들 때 OWNER 멤버 + MASTER 트랙을 한 트랜잭션으로, 검색 · 페이지, 권한 검사, 소프트 삭제 (FR-122~126, 백엔드 함수 하나씩) |
| P1-14 내 프로젝트 화면 JS | P1-13 API 연결 · `initLogoutButton` import · 삭제 확인은 FIX-01 `confirmDialog` |
| 배포 때 | 정리 명령을 하루 한 번 예약 (작업 스케줄러 · cron) · 프록시를 두면 `TRUST_PROXY=true` |
| P1-11 남은 템플릿 | `home.js` 의 `initSideNavActiveState` · `initMobileMenuClose` (선택 — 지금은 CSS 로 동작), `loadDevNotes` 는 P1-21, `initIntro` 는 P1-20 |
