# AI 구현 설명 43 — P1-09 비밀번호 변경 · 회원 탈퇴 · 3일 뒤 정리

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-07 |
| 작업 | P1-09: PRD 01 FR-107, FR-108, 개인정보 처리방침 §4 |
| 브랜치 | `feature/phase1/p1-09-password-withdraw` |
| 바꾼 파일 | `services/user_service.py`, `api/v1/users.py`, `workers/retention.py` / 화면 메모 `pages/userinfo.js`(주석) |
| 진행 방식 | **함수 하나씩** 구현 → 사용자 검토 → 다음 |
| 함수별 설명 | `docs/ai-notes/backend(fastAPI_Python)/P1-09 - 비밀번호 변경·탈퇴/44 ~ 49` (md, PDF), 합본 [`P1-09_password_withdraw.pdf`](<backend(fastAPI_Python)/P1-09 - 비밀번호 변경·탈퇴/P1-09_password_withdraw.pdf>) |
| 실제 사이트 시험 | [44_p1-09_site_test.md](44_p1-09_site_test.md): 5개 모두 통과 |
| 이전 문서 | [42_p1-08_site_test.md](42_p1-08_site_test.md) |

## 1. 한 일
| 무엇 | 하는 일 |
|---|---|
| `PUT /api/v1/users/me/password` | 지금 비밀번호 확인 → 새 비밀번호 규칙 → 지금과 다르면 저장 (204) |
| `DELETE /api/v1/users/me` | 비밀번호 확인 → 탈퇴(소프트 삭제), 사진 삭제 → 자동 로그인 쿠키 삭제 (204) |
| `retention.purge_withdrawn_accounts` | 하루 한 번: 탈퇴 3일 지난 계정의 개인 정보 비움 |

## 2. 사용자 결정 (2026-10-07)
| 결정 | 내용 |
|---|---|
| 새 비밀번호 = 지금 비밀번호 | **막음**: 422 "Use a different password." (같은 회원 안의 비교. 다른 회원과의 겹침 검사는 하지 않음, 예전 비밀번호 이력은 범위 밖) |
| 탈퇴 창 | 비밀번호만 (체크박스 없음): FIX-01 `promptDialog` (P1-10 에서 연결) |

## 3. 항목 6개
| # | 파일 | 항목 | 하는 일 | 설명 |
|---|---|---|---|---|
| 44 | `user_service.py` | `check_current_password()` | 재확인: 틀리면 **400** `WRONG_PASSWORD` (401 이면 화면이 로그아웃시킴) | [44](<backend(fastAPI_Python)/P1-09 - 비밀번호 변경·탈퇴/44_user_service_check_current_password.md>) |
| 45 | `user_service.py` | `change_password()` | 44 → 규칙 422 → 같음 422 → 저장 | [45](<backend(fastAPI_Python)/P1-09 - 비밀번호 변경·탈퇴/45_user_service_change_password.md>) |
| 46 | `user_service.py` | `withdraw()` | 44 → `DELETED`, 시각 → 39 로 사진 삭제 + 한 번에 저장 | [46](<backend(fastAPI_Python)/P1-09 - 비밀번호 변경·탈퇴/46_user_service_withdraw.md>) |
| 47 | `users.py` | `PUT /users/me/password` | 45 연결, 204 | [47](<backend(fastAPI_Python)/P1-09 - 비밀번호 변경·탈퇴/47_users_route_change_password.md>) |
| 48 | `users.py` | `DELETE /users/me` | 46 → 쿠키 삭제, 204 | [48](<backend(fastAPI_Python)/P1-09 - 비밀번호 변경·탈퇴/48_users_route_withdraw.md>) |
| 49 | `retention.py` | `purge_withdrawn_accounts()` | 3일 지난 탈퇴 계정: 이메일, 닉네임 비킴, 해시 `!`, 로그인 기록, 사진 비움 | [49](<backend(fastAPI_Python)/P1-09 - 비밀번호 변경·탈퇴/49_retention_purge_withdrawn_accounts.md>) |

## 4. 탈퇴 회원의 시간표
| 시점 | 상태 | 하는 곳 |
|---|---|---|
| 탈퇴 | `DELETED`, 사진 삭제, 이 브라우저 쿠키 삭제 | 46, 48 |
| 바로 | 로그인, 남은 토큰, 다른 기기의 쿠키 재발급 모두 401 | 29, 06, 30 (P1-03, 05) |
| ~ 3일 | 같은 이메일, 닉네임 가입 409 `REJOIN_TOO_SOON` | 19, 20 (P1-04) |
| 3일 뒤 | 개인 정보 비움: 회원 번호만 남은 행, 프로젝트는 그대로 ('Deleted user') | 49 |

## 5. 템플릿과 달라진 점
| 항목 | 템플릿 | 구현 | 이유 |
|---|---|---|---|
| 새 비밀번호 = 지금 | (선택) | 막음 | 사용자 결정 |
| 정리 대상 | 이메일이 아직 `deleted+` 가 아닌 행 | 남은 개인 정보가 **하나라도** 있는 행 | 가입 때 이메일, 닉네임만 비켜 둔 행의 해시, 로그인 기록이 영영 남는 빈틈 |
| 정리할 때 사진 | 지움 | DB 저장 **뒤** 지움 | 38, 39 와 같은 순서 |
| 화면 메모 `api.delete('/users/me', { password })` | 템플릿 주석, FIX-01 21 | `{ body: { password } }` | `api.delete` 의 두 번째 인자는 옵션: 그대로면 본문 없이 422 |

## 6. 시험
| 파일 | 대상 | 시험 수 |
|---|---|---|
| `tests/test_user_service.py` | 44 ~ 46 (실제 MySQL + 임시 폴더) | 18 추가 (모두 74) |
| `tests/test_user_routes.py` | 47, 48 (실제 앱 + MySQL) | 12 추가 (모두 38) |
| `tests/test_retention.py` (새 파일) | 49 | 8 |

전체 시험 352개 통과, `ruff` 검사 통과. 실제 사이트 시험 5개 통과 (44). 시험 뒤 DB 에는 데모 계정과 사용자 계정만, `storage/` 는 비어 있음.

## 7. 다음 작업이 쓰는 곳, 남은 것
| 작업 | 쓰는 것 |
|---|---|
| P1-10 회원 정보 화면 JS | 47, 48, 오류 코드(`WRONG_PASSWORD`, `details.new_password`), 탈퇴는 FIX-01 `promptDialog` + `check` |
| P1-12 문의 API | `retention.py` 의 `purge_old_inquiries` 와 **`main()`** (하루 한 번 실행 진입점: 49 도 여기서 불림) |
| 배포 | `main()` 을 하루 한 번 돌릴 예약 작업 (Windows 작업 스케줄러 / cron) |

| 알아 둘 점 | 내용 |
|---|---|
| 비밀번호를 바꿔도 다른 기기 | 남은 자동 로그인 쿠키(최대 3일)는 그대로: 리프레시 토큰을 DB 에 두지 않는 설계의 한계 (45 §5). 탈퇴는 30 이 막아서 해당 없음 |
| 재확인 횟수 제한 | 없음: 로그인 반복 제한과 함께 나중에 (44 §5) |
