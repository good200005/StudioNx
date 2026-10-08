# AI 구현 설명 51 — P1-14 내 프로젝트 화면 JS (목록 · 검색 · 만들기 · 수정 · 삭제 · 시퀀서 열기)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) · 2026-10-08 |
| 작업 | P1-14 myProject.html JS — PRD 01 FR-122 ~ 126 · FR-129 · FR-130 (P1-13 API 연결) |
| 브랜치 | `feature/phase1/p1-14-myproject-page` |
| 바꾼 파일 | 화면 JS `pages/myproject.js` · 공통 `core/studio.js` / HTML `myProject.html`(삭제 모달 지움) · CSS `pages/myproject.css`(`[hidden]` 한 줄) |
| 진행 방식 | **함수 하나씩** 구현 → 사용자 검토 → 다음. 실제 코드는 전통 문법 (`?.` · `??` 없음) |
| 함수별 설명 | `docs/ai-notes/javascript/P1-14 - 내 프로젝트 화면 JS/29 ~ 42` (md · PDF), 합본 [`P1-14_myproject_js.pdf`](<javascript/P1-14 - 내 프로젝트 화면 JS/P1-14_myproject_js.pdf>) |
| 실제 사이트 시험 | [52_p1-14_site_test.md](52_p1-14_site_test.md) — 마우스 · 키보드로 11단계 통과 |
| 이전 문서 | [50_p1-13_site_test.md](50_p1-13_site_test.md) |

## 1. 한 일
myProject.html 이 **실제 내 프로젝트로 동작**한다 (전에는 HTML 예시 7줄).

| 화면 | 이제 되는 것 |
|---|---|
| 페이지 열기 | 로그인 확인 → 주소의 검색 · 정렬 · 페이지로 첫 목록 (예시 줄 없음) |
| 목록 | 제목 · 설명 · BPM · 박자 · 키 · 멤버 · 마지막 수정(`12 minutes ago`) · `Not opened` · OWNER 아니면 삭제 잠금 |
| 검색 · 정렬 · 페이지 | 치기를 멈추고 0.3초 · 정렬 바로 · `1 … 9 10 11 … 20` · 주소에 남아 새로고침에도 유지 |
| 새 프로젝트 | 넓은 화면은 **새 창**으로 시퀀서, 좁은 화면은 "saved" 안내 |
| ··· 메뉴 | Edit details (그 줄만 갱신) · Delete (SweetAlert 확인창) |
| 제목 · Open 클릭 | 넓으면 새 창 (같은 프로젝트면 열린 창이 앞으로), 좁으면 안내 · Ctrl · 휠 클릭은 브라우저 기본 |

## 2. 사용자 결정 · 질문 (2026-10-08)
| # | 내용 | 결과 |
|---|---|---|
| 1 | `core/studio.js` 가 모두 템플릿이었음 | P1-14 에서 먼저 구현하도록 순서를 바꿈 (35 ~ 38) — myPage(P1-17)도 그대로 씀 |
| 2 | "지금 탭으로 넘어가? 새 창이야?" · "Ctrl 클릭을 해야 해?" | **그냥 클릭 = 새 창**, 팝업이 막혔을 때만 지금 탭. Ctrl · 휠은 막지 않을 뿐. 창 / 탭 설정은 Phase 2 (PRD 02 FR-2164) |
| 3 | 삭제가 서버 오류로 실패하면 오류 화면 vs 알림창 | **알림창 그대로** (버튼 · 폼 동작 오류는 화면 안 — 2026-10-06 규칙). 401 따로 처리도 하지 않기로 |

## 3. 항목 (JS 14)
| # | 파일 | 함수 | 하는 일 | 설명 |
|---|---|---|---|---|
| 29 | `myproject.js` | `formatRelativeTime()` | 서버 UTC → `12 minutes ago` · `Yesterday` · `Sep 30` | [29](<javascript/P1-14 - 내 프로젝트 화면 JS/29_myproject_formatRelativeTime.md>) |
| 30 | 〃 | `loadProjects()` | 값 정리 → 목록 요청 → `current` · 주소 / 오류 화면 · 옛 응답 버리기 | [30](<javascript/P1-14 - 내 프로젝트 화면 JS/30_myproject_loadProjects.md>) |
| 31 | 〃 | `renderProjects()` (+ `buildRow`) | 틀 복사로 줄 그리기 · 빈 안내 2가지 | [31](<javascript/P1-14 - 내 프로젝트 화면 JS/31_myproject_renderProjects.md>) |
| 32 | 〃 | `renderPager()` | Prev · 번호 · Next · 줄임 | [32](<javascript/P1-14 - 내 프로젝트 화면 JS/32_myproject_renderPager.md>) |
| 33 | 〃 | `initSearch()` (+ `refreshList`) | 0.3초 디바운스 · 정렬 · Enter | [33](<javascript/P1-14 - 내 프로젝트 화면 JS/33_myproject_initSearch.md>) |
| 34 | 〃 | `initRowMenus()` | ··· 메뉴 · `selected` · 바깥 클릭 · Esc | [34](<javascript/P1-14 - 내 프로젝트 화면 JS/34_myproject_initRowMenus.md>) |
| 35 | `core/studio.js` | `canOpenStudio()` | 1280px 이상인지 | [35](<javascript/P1-14 - 내 프로젝트 화면 JS/35_studio_canOpenStudio.md>) |
| 36 | 〃 | `showDesktopOnly()` | 작은 화면 안내 모달 | [36](<javascript/P1-14 - 내 프로젝트 화면 JS/36_studio_showDesktopOnly.md>) |
| 37 | 〃 | `openStudio()` (+ `openBlankStudio`) | 시퀀서를 별도 창으로 · 막히면 같은 탭 | [37](<javascript/P1-14 - 내 프로젝트 화면 JS/37_studio_openStudio.md>) |
| 38 | 〃 | `initDesktopOnlyLinks()` | 링크 클릭 → 새 창 / 안내 | [38](<javascript/P1-14 - 내 프로젝트 화면 JS/38_studio_initDesktopOnlyLinks.md>) |
| 39 | `myproject.js` | `initNewProjectForm()` | 만들기 · 빈 창 먼저 | [39](<javascript/P1-14 - 내 프로젝트 화면 JS/39_myproject_initNewProjectForm.md>) |
| 40 | 〃 | `initEditProjectForm()` | 제목 · 설명 저장 → 그 줄만 | [40](<javascript/P1-14 - 내 프로젝트 화면 JS/40_myproject_initEditProjectForm.md>) |
| 41 | 〃 | `initDeleteProject()` | `confirmDialog` → 삭제 → 빈 쪽이면 앞으로 | [41](<javascript/P1-14 - 내 프로젝트 화면 JS/41_myproject_initDeleteProject.md>) |
| 42 | 〃 | `loadInitialList()` + 시작 코드 | 로그인 확인 · 주소로 첫 목록 · 로그아웃 버튼 import | [42](<javascript/P1-14 - 내 프로젝트 화면 JS/42_myproject_loadInitialList.md>) |

## 4. 템플릿에서 달라진 점
| 항목 | 템플릿 | 구현 | 이유 |
|---|---|---|---|
| 목록 오류 | 500 이상만 → 500 | `loadMe` 와 같은 규칙 (401 로그인 · 503/504 · 네트워크 503 · 그 밖 4xx 400) | 같은 종류의 페이지 데이터 API (30) |
| 빠른 검색 | — | 요청 번호로 **옛 응답 버리기** | 늦게 온 응답이 새 결과를 덮어씀 — 가드를 빼면 실제로 덮이는 것을 확인 (33) |
| 빈 페이지 | — | 페이지 줄 · 목록 `[hidden]` CSS 규칙 추가 | `display: grid` 가 `hidden` 을 이김 (31) |
| 페이지 줄임 | `1 2 3 …` | `…` 가 한 쪽만 가리면 번호로 | `1 … 3` 보다 `1 2 3` (32) |
| VIEWER | 삭제만 잠금 | 수정도 잠금 | 서버가 403 으로 막음 (31) |
| 새 프로젝트 창 | 빈 창 `window.open('', name)` | 이름 없이 열고 응답 뒤 `studio-번호` 로 이름 붙임 | 열 때는 번호를 모름 (37) |
| 수정 뒤 | 그 줄만 갱신 | 그 줄만 · **자리 그대로** | 고친 줄이 눈앞에서 사라지지 않게 (40) |
| 삭제 확인 | HTML 모달 | `confirmDialog` · 모달 · `command` 속성 지움 | 2026-10-07 결정 (41) |
| 로그아웃 | 페이지 안 빈 함수 | `core/auth-ui.js` 공용 함수 import | P1-10 에서 만든 것 (42) |

## 5. 시험
| 방법 | 대상 | 결과 |
|---|---|---|
| 페이지 안 함수 시험 (실제 서버 · 헤드리스 Chrome) | 29 ~ 42 | 함수마다 5 ~ 20개 · 바뀐 함수는 앞 시험 다시 — 모두 통과 (각 문서 §6) |
| 사람처럼 클릭 · 타이핑 (52) | 로그인 → 빈 목록 → 만들기 → 검색 → 정렬 → 페이지 → 수정 → 삭제 → 좁은 화면 → Open → 로그아웃 | **11단계 통과** |
| 백엔드 pytest | (바뀐 것 없음) | 492개 통과 |

## 6. 다음 작업 · 남은 것
| 작업 | 내용 |
|---|---|
| **P1-16 대시보드 API** | `feature/phase1/p1-16-dashboard-api` — 마이페이지 데이터 (최근 프로젝트 · 작업 시간 · Ready to start) |
| P1-17 마이페이지 JS | `initDesktopOnlyLinks` 는 이미 동작 — 'Ready to start' 배너에 `data-title` 을 넣으면 안내 모달 제목이 맞음 (38 참고) |
| 나중에 | `ERROR_PAGES` 가 userinfo.js · myproject.js 두 곳 → 세 번째(myPage)에서 `core/` 로 옮기기 (30) · `core/modal.js initModalFallback` 은 아직 템플릿 (34) |
