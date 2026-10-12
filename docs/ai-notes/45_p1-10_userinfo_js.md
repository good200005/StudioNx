# AI 구현 설명 45 — P1-10 회원 정보 화면 JS (내 정보 · 사진 · 닉네임 · 비밀번호 · 탈퇴 · 로그아웃)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-08 |
| 작업 | P1-10 userInfo.html JS: PRD 01 FR-105 ~ FR-108 |
| 브랜치 | `feature/phase1/p1-10-userinfo-page` |
| 바꾼 파일 | `pages/userinfo.js`, 새 `core/password.js`, `core/auth-ui.js` (로그아웃), `pages/join.js` (import 한 줄), `userInfo.html`, `css/pages/userinfo.css`, 주석: `mypage.js`, `myproject.js`, 백엔드 `schemas/user.py` |
| 진행 방식 | **함수 하나씩** 구현 → 사용자 검토 → 다음. 실제 코드는 전통 문법 |
| 함수별 설명 | `docs/ai-notes/javascript/P1-10 - 회원 정보 화면 JS/22 ~ 27` (md, PDF), 합본 [`P1-10_userinfo_js.pdf`](<javascript/P1-10 - 회원 정보 화면 JS/P1-10_userinfo_js.pdf>) |
| 실제 사이트 시험 | [46_p1-10_site_test.md](46_p1-10_site_test.md): 사람처럼 클릭, 타이핑, 파일 고르기, 11개 통과 |
| 이전 문서 | [44_p1-09_site_test.md](44_p1-09_site_test.md) |

## 1. 한 일
P1-08, P1-09 서버 API 를 **userInfo.html 화면**에 연결했습니다. 이제 회원 정보 화면의 모든 버튼이 동작합니다.

| 화면 구역 | 이제 되는 것 | 서버 |
|---|---|---|
| 열 때 | 로그인 확인 → 내 정보로 칸 채움, 실패하면 오류 화면 | `GET /users/me` |
| Photo | 사진 올리기, 지우기 (종류, 2MB 먼저 검사) | `POST, DELETE /users/me/profile-image` |
| Account | 닉네임 중복 확인 (0.5초), 저장, Saved | `GET /auth/check-nickname`, `PATCH /users/me` |
| Password | 조건 ✓, 확인 칸, 변경, Password changed. | `PUT /users/me/password` |
| Delete account | 빨간 확인창(비밀번호) → 탈퇴 → 홈 | `DELETE /users/me` |
| 왼쪽 메뉴 Log out | 로그아웃 → 홈 | `POST /auth/logout` |

## 2. 함수 6개 (JS 번호는 FIX-01 의 21 다음)
| # | 파일 | 함수 | 하는 일 | 설명 |
|---|---|---|---|---|
| 22 | `userinfo.js` | `loadMe()`, `renderAvatar()` | 내 정보 채우기, 동그라미(사진 / 첫 글자), 오류 화면 | [22](<javascript/P1-10 - 회원 정보 화면 JS/22_userinfo_loadMe.md>) |
| 23 | `userinfo.js` | `initPhotoUpload()` | 사진 올리기, 지우기, Uploading…, 잠금 | [23](<javascript/P1-10 - 회원 정보 화면 JS/23_userinfo_initPhotoUpload.md>) |
| 24 | `userinfo.js` | `initProfileForm()` | 닉네임 확인, 저장 (대소문자만 바꾸기 허용) | [24](<javascript/P1-10 - 회원 정보 화면 JS/24_userinfo_initProfileForm.md>) |
| 25 | `userinfo.js`, `core/password.js` | `initPasswordForm()` | 비밀번호 변경: 가입과 같은 규칙 (규칙 파일 분리) | [25](<javascript/P1-10 - 회원 정보 화면 JS/25_userinfo_initPasswordForm.md>) |
| 26 | `userinfo.js` | `initWithdraw()` | Delete account → `promptDialog` + `check` → 탈퇴 | [26](<javascript/P1-10 - 회원 정보 화면 JS/26_userinfo_initWithdraw.md>) |
| 27 | `core/auth-ui.js` | `initLogoutButton()` | 세 화면 공통 Log out | [27](<javascript/P1-10 - 회원 정보 화면 JS/27_auth-ui_initLogoutButton.md>) |

## 3. 템플릿, 화면에서 달라진 점
| 항목 | 템플릿 | 구현 | 이유 |
|---|---|---|---|
| 오류 화면 | 404, 403, 500 이상 | 400, 403, 404, 429, 503, 504 는 같은 번호, 0 → 503 | 이미 있는 오류 화면을 맞게 쓰려고 (22) |
| 서버 날짜 | — | 끝에 `Z` 를 붙여 UTC 로 읽음 | 한국 컴퓨터에서 날짜가 하루 어긋나는 것을 막음 (22) |
| 사진 문구 색 | `#photo-msg` 만 | 감싸는 `<div id="photo-field">` + CSS 3줄 | 폼 칸 밖이라 빨강, 초록이 닿지 않았음 (23) |
| 닉네임 | 확인 → 저장 | + 0.5초 자동 확인, 대소문자만 바꾸기는 묻지 않음 | 가입과 같게, 서버 확인 API 가 내 닉네임을 "사용 중" 으로 답함 (24) |
| Saved, Password changed. | "짧은 표시" | 버튼 옆 `role="status"` 자리 (HTML, CSS) | 화면 읽기 프로그램에도 알림 (24, 25) |
| 비밀번호 규칙 | `join.js` 안 | `core/password.js` (템플릿 권장) | 다른 페이지가 `join.js` 를 import 하면 그 페이지 코드까지 실행됨 (25) |
| 탈퇴 | HTML 모달, 체크박스 | **모달 삭제**, `promptDialog` (비밀번호만) | 사용자 결정 (FIX-01, 2026-10-07) (26) |
| 탈퇴 뒤 이동 | `location.href` | `location.replace` | 뒤로 가기로 탈퇴한 계정 화면에 돌아오지 않게 (26) |
| 로그아웃 | 페이지마다 같은 함수 | `core/auth-ui.js` 하나 | 세 화면이 똑같음: myPage, myProject 는 그 작업(P1-17, P1-14) 때 import (27) |

## 4. 시험
| 방법 | 대상 | 결과 |
|---|---|---|
| 실제 페이지 안에서 함수 시험 (실제 서버, MySQL) | 22 ~ 27 | 17, 9 · 15, 12, 10, 5 = **68개 통과** |
| 사람처럼 클릭, 타이핑, 파일 고르기 (46) | 로그인 → 사진 → 닉네임 → 비밀번호 → 로그아웃 → 다시 로그인 → 탈퇴 | **11개 통과** |
| 고친 파일을 쓰는 앞 시험 다시 | P1-07 09, 10, 12, 13, 16, 17 | 모두 통과 |

시험 도구에 더한 것: "열기 전에 로그인(SETUP)", "옮겨 간 뒤 확인(AFTER)", 진짜 Esc, Enter 키. 시험이 만든 계정, 사진 파일은 모두 지웠습니다 (DB 에는 데모 계정과 사용자 계정만, `storage/` 는 비어 있음).

**시험에서 찾은 시험 쪽 문제 3개:** 방문 기록 수를 고정값으로 확인(26), 로그아웃이 너무 빨라 결과를 못 받음(27), 사이트의 부드러운 스크롤 때문에 클릭이 빗나감(46): 모두 시험 코드를 고쳤고 사이트 코드는 문제없었습니다.

## 5. 다음 작업이 쓰는 곳, 남은 것
| 작업 | 쓰는 것 |
|---|---|
| P1-14 내 프로젝트 화면 JS | `initLogoutButton` import, 삭제 확인은 FIX-01 `confirmDialog`, 22 의 오류 화면 방식(`loadProjects` 는 500 이상만: 10-06 결정) |
| P1-17 마이페이지 JS | `initLogoutButton` import, `renderAvatar` 와 같은 모양의 프로필 동그라미, 22 의 오류 화면 방식 |
| 나중에 정리할 수 있는 것 | 비밀번호 칸 검사 동작이 가입(16)과 회원 정보(25)에 비슷하게 두 번 있음: 규칙만 공용 |
