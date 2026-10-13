# AI 구현 설명 40 — FIX-01 SweetAlert 알림 · 확인 · 입력창

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-07 |
| 작업 | FIX-01 (YouTrack StudioNx-72, 상위 S1-03): 사용자 요청 `frontend-reference/images/main page reference/sweetalert수정.pdf` |
| 브랜치 | `fix/sweetalert-dialogs` → `feature/phase1-account` |
| 바꾼 파일 | 새 `static/js/core/dialog.js`, `static/css/dialog.css`, `static/vendor/sweetalert2/` (v11.26.25, MIT) / `pages/home.js`, `join.js`, `myproject.js`, `userinfo.js`(주석) / 계정 페이지 5개 `<link>` |
| 진행 방식 | 목업 → 사용자 결정 → **함수 하나씩** 구현, 검토. 실제 코드는 전통 문법 |
| 함수별 설명 | `docs/ai-notes/javascript/fix - SweetAlert 알림창/18 ~ 21` (md, PDF), 합본 [`FIX-01_sweetalert_dialogs.pdf`](<javascript/fix - SweetAlert 알림창/FIX-01_sweetalert_dialogs.pdf>) |
| 목업 | `docs/page_mockups/sweetalert/` 14장 |
| 이전 문서 | [39_p1-07_site_test.md](39_p1-07_site_test.md) |

## 1. 요청과 결정
| 사용자 요청 (슬라이드) | 한 것 |
|---|---|
| Email 을 비우거나 형식이 틀리면 뜨는 **브라우저 기본 말풍선** → SweetAlert | 19 `initFormAlerts`: 로그인 모달, 문의, 새 프로젝트, 정보 수정 폼 (지금 바로 동작) |
| 형식: Main Message(메인 폰트), Main Message, 확인 | 제목 Unbounded("Make your noise", "Sign In" 글꼴), 설명, 버튼 |
| 색감, 글꼴은 home.html 분위기 | 먹색 면, 종이색 글자, 모서리 0, 위쪽 2px 선(보라 / 오류, 위험 빨강), 버튼은 사이트 `.btn` |
| Prompt, Confirm 창도 같은 형식 | 20 `confirmDialog`, 21 `promptDialog` |

| 목업을 본 뒤 사용자 결정 (2026-10-07) | 반영 |
|---|---|
| 5 ~ 9 (삭제 확인, 탈퇴, 작은 화면 안내)도 SweetAlert 로 | 20, 21, 18(`note`) |
| 9(작은 화면 안내)는 **모바일에서 나오는 것**이니 모바일을 감안해 설계 | 600px 이하에서 **아래에서 올라오는 시트**: 폭 가득, 48px 버튼, 주 버튼 위, 아이폰 홈 표시줄 여백. 다른 창도 휴대폰에서는 같은 모양 |
| 이름 변경창은 만들지 않음 | Edit details 모달 그대로 |
| 탈퇴창은 제안대로 | 비밀번호만 (체크박스 없음) |

## 2. 함수 4개
| # | 함수 | 하는 일 | 쓰는 곳 | 설명 |
|---|---|---|---|---|
| 18 | `showAlert(title, text, { tone, note, confirmText })` | 알림창 (버튼 하나) | 19, 작은 화면 안내 | [18](<javascript/fix - SweetAlert 알림창/18_dialog_showAlert.md>) |
| 19 | `initFormAlerts(root)` | 폼 기본 말풍선 막고 → 첫 틀린 칸의 이유를 18 로 → 그 칸에 커서 | home, join, myProject | [19](<javascript/fix - SweetAlert 알림창/19_dialog_initFormAlerts.md>) |
| 20 | `confirmDialog({ title, text, confirmText, danger })` → `true/false` | 확인창. danger 면 처음 커서가 취소 | 프로젝트 삭제 (P1-14) | [20](<javascript/fix - SweetAlert 알림창/20_dialog_confirmDialog.md>) |
| 21 | `promptDialog({ …, inputType, check })` → 값 / `null` | 입력창. `check` 로 창 안에서 서버 확인 | 회원 탈퇴 (P1-10) | [21](<javascript/fix - SweetAlert 알림창/21_dialog_promptDialog.md>) |

## 3. 공통 설계
| 선택 | 이유 |
|---|---|
| 열린 `<dialog>` 모달 **안에** 띄움 | `showModal()` 모달은 맨 위층이라 body 에 띄우면 뒤에 깔리고 누를 수 없습니다 (로그인 모달). Esc 는 창만 닫고 모달은 남는 것을 진짜 키로 확인 |
| 설명, 작은 글씨는 **글자 그대로** | 서버 문구 등을 넣어도 HTML 로 해석되지 않음 (`<img onerror>` 시험) |
| 라이브러리를 저장소에 (CDN 아님) | 버전 고정, 오프라인. 지역, 도메인별로 다르게 동작하는 코드가 없는지 확인 |
| 기존 토큰, `.btn` 재사용 | 새 색 없음, 라이트 모드 자동 |
| SweetAlert 기본 아이콘, 튀는 효과 끔 | 슬라이드 형식대로. 데스크톱은 살짝 올라오고, 휴대폰은 아래에서 올라옴 (동작 줄이기 설정이면 없음) |

## 4. 지금 적용된 곳, 나중에 연결할 곳
| 화면 | 지금 | 나중 |
|---|---|---|
| 로그인 모달 (home, join), 문의 폼, 새 프로젝트, 정보 수정 | ✅ 기본 말풍선 대신 알림창 | |
| 프로젝트 삭제 확인 | 기존 HTML 모달 (JS 없이 `command` 로 열림) | P1-14: 모달을 지우고 `confirmDialog` (`myproject.js` 주석) |
| 회원 탈퇴 | 기존 HTML 모달 | P1-10: 모달을 지우고 `promptDialog` + `check` (`userinfo.js` 주석) |
| 작은 화면 안내 | 기존 HTML 모달 | `studio.js` `showDesktopOnly` 구현 때: `showAlert(…, { note, confirmText: 'Got it' })` |
| 시퀀서의 창 2개 | 그대로 | 시퀀서 자체 테마 (대상 아님) |

## 5. 시험 (실제 페이지, 헤드리스 Chrome, 진짜 Esc / Enter 키 포함)
| 함수 | 시험 | 찾아 고친 것 |
|---|---|---|
| 18 | 14 | — |
| 19 | 18 (home 12, join 3, myProject 3) | 알림을 닫은 뒤 커서가 보내기 버튼으로 돌아감 → 알림 **전에** 칸으로 옮김 / 동의 이름표의 줄바꿈 |
| 20 | 14 | 휴대폰 시트가 화면 가운데에 뜸 → 아래 줄로 (`dialog.css`) |
| 21 | 18 | 비밀번호 앞뒤 공백이 지워짐 → `inputAutoTrim: false` / 서버 확인 중 취소 가능 → 잠금 |

**합계 64개 통과.** P1-07 시험(12, 13, 14, 16, 17)도 다시 돌려 모두 통과. 시험에서 만든 계정은 지움.

## 6. 함께 한 것
- `tools/youtrack/yt.py` 에 `create` 명령 추가, 계획에 없는 수정 작업은 `FIX-NN` 번호 (`docs/youtrack/README.md`).
