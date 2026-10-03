# AI 구현 설명 14 — 나의 프로젝트 (P-2 콘솔 목록형)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-03 |
| 작업 | P1-14 나의 프로젝트 (`myProject.html`) + 작은 화면 안내·이어 하기 배너 (FR-129·130). 이전 문서: [13_mypage.md](13_mypage.md) |
| 브랜치 | `feature/phase1/p1-14-myproject-page` |
| 기준 시안 | `docs/page_mockups/myproject/03·04`(P-2, 사용자 선택), `05·06`(모달). 비교안 P-1 카드형 `01·02` |
| 원칙 | HTML/CSS 작성, JS는 템플릿만 (목록·검색·모달 연결), 프로젝트 API(P1-13)는 사용자 |

---

## 1. 실행 결과
### 1.1 목록
| 데스크톱 (다크) | 모바일 |
|---|---|
| ![desktop](images/14_myproject/01_desktop_dark.png) | ![mobile](images/14_myproject/02_mobile_dark.png) |

| 라이트 테마 | ··· 메뉴 (EDITOR 프로젝트 — 삭제 비활성) |
|---|---|
| ![light](images/14_myproject/03_desktop_light.png) | ![menu](images/14_myproject/04_row_menu.png) |

> 맨 위 **Summer Loop**는 아직 시퀀서에서 한 번도 열지 않은 프로젝트의 예시라 `Not opened` 표시가 붙습니다 (FR-130).

### 1.2 모달
| 새 프로젝트 | 삭제 확인 | 수정 (모바일) |
|---|---|---|
| ![new](images/14_myproject/05_new_project_modal.png) | ![delete](images/14_myproject/06_delete_modal.png) | ![edit](images/14_myproject/07_edit_modal_mobile.png) |

### 1.3 작은 화면 안내 · 이어 하기 배너 (FR-129·130)
| 모바일에서 Open을 누름 | 모바일에서 만든 직후 | PC 대시보드의 Ready to start 배너 |
|---|---|---|
| ![open](images/14_myproject/08_mobile_open_notice.png) | ![created](images/14_myproject/09_mobile_created_notice.png) | ![banner](images/14_myproject/10_mypage_ready_banner.png) |

> 개발 서버에서 `<html data-auth="in">`을 붙여 찍었습니다. 목록 6개는 HTML에 넣어 둔 **예시**이고, 모달은 `showModal()`로 열어 찍었습니다.

## 2. 무엇을 만들었나
| 파일 | 내용 | 비고 |
|---|---|---|
| `frontend/myProject.html` | 검색·정렬·개수·New project, 목록(예시 6줄), 페이지 넘김, 한 줄 틀(`<template>`), 모달 3개 | |
| `static/css/pages/myproject.css` | 목록 열, ··· 메뉴, 모달 안 배치, 모바일 한 줄 정보 | |
| `static/js/pages/myproject.js` | 템플릿: `loadProjects`, `renderProjects`, `renderPager`, `initSearch`, `initNewProjectForm`, `initRowMenus`, `initEditProjectForm`, `initDeleteProject`, `formatRelativeTime` | 공통 조각 끼우기만 동작 |
| `static/css/account.css` (**새 파일**) | 마이페이지 3종 공통 틀: 왼쪽 메뉴·로그아웃, 카드, 준비 중 칸, 사진 동그라미, 순서 색 5가지 | `pages/mypage.css`에서 떼어 냄 |
| `static/css/base.css` | `.btn--danger`(빨간 면), `.btn--danger-ghost`(빨간 윤곽) 추가 | 삭제·탈퇴에 공통 |
| `myPage.html` | `account.css` 링크, **Ready to start 배너**, 안내 모달 조각 | 배너는 폭 1280px 이상에서만 |
| `static/partials/desktop-only-modal.html` (**새 파일**) | 작은 화면 안내 모달 — myProject·myPage가 함께 씀 | 문구 2종 (`created` / `open`) |
| `static/js/core/studio.js` (**새 파일**) | 템플릿: `STUDIO_MIN_WIDTH`(1280), `canOpenStudio`, `showDesktopOnly`, `initDesktopOnlyLinks` | |
| `static/js/pages/mypage.js` | 템플릿 `renderReadyBanner` 추가, 응답 예시에 `ready_projects` | |
| `base.css` 확인창 문구 | `.modal__lead`·`.modal__note`·`.modal__actions` — 삭제·탈퇴·안내 모달이 같은 모양 | 페이지별 클래스를 하나로 |

### 2.1 화면 구성
```
┌ 검색 ──────────┐ ┌ 정렬 ─────┐            6 projects [New project]
├──────────────────────────────────────────────────────────────────┤
│ PROJECT            BPM  SIG  KEY      MEMBERS     EDITED   [Open]··· │
│▌Midnight Drive     128  4/4  A minor  ●           12 min    [Open]··· │
│▌Collab — Nyxi      140  7/8  D minor  ●●● EDITOR  3 days    [Open]··· │
└──────────────────────────────────────────────────────────────────┘
                         Prev  1  2  Next
모바일: ▌제목 / 설명 / "128 BPM · A minor · 12 minutes ago"  ···  (이름을 누르면 열림)
```

## 3. 왜 이렇게 했나
| 결정 | 이유 |
|---|---|
| P-2 목록형 | 사용자 선택. BPM·키 등을 열로 비교하기 쉽고, 마이페이지 Recent Projects(트랙 레인)와 같은 언어 |
| 줄 색 순서 5가지 | DB에 프로젝트 색이 없어서 마이페이지와 같은 규칙(`nth-child`) — 같은 순서면 두 화면 색이 맞음 |
| ··· 메뉴는 `<details>` | JS 없이 열고 닫힘(키보드도 동작). 바깥 클릭으로 닫기만 JS(TODO) |
| 메뉴 항목 2개 (Edit details · Delete) | 시안의 Rename과 Edit details가 같은 일(FR-124: 제목·설명 변경)이라 하나로 합침 |
| OWNER가 아니면 Delete 비활성 + "Owner only" | FR-125. 서버도 403으로 막지만, 누르기 전에 알려 줌 |
| 모달은 `command="show-modal"` | 다른 페이지와 같은 방식(JS 없이 열림). 어느 프로젝트인지 채우는 일만 JS |
| `<template id="project-row-template">` | JS가 줄을 만들 때 HTML 구조를 JS 문자열로 다시 쓰지 않도록 (React 컴포넌트로 옮기기도 쉬움) |
| 모바일 한 줄 정보는 `data-meta` | BPM·키를 따로 칸으로 두지 않고, 수정 시각 앞에 CSS `::before`로 붙임 → HTML 하나로 PC·모바일 |
| 새 프로젝트의 Template 비활성 | FR-127은 2단계부터. 자리만 보여 줌 |
| `account.css` 분리 | 세 페이지가 같은 메뉴·카드를 쓰므로 한 곳에서 관리. 분리 전후 `myPage.html` 캡처 픽셀 차이 0 |

### 3.1 작은 화면에서 시퀀서를 열지 않는 이유와 이어 하기 (FR-129·130)
| 결정 | 이유 |
|---|---|
| 모바일에서도 만들기는 허용 | 폼은 네 칸이라 작은 화면에서도 쉬움. 이동 중 떠오른 아이디어(제목·BPM·박자)를 미리 만들어 둘 수 있음 |
| 시퀀서 이동만 막음 (폭 1280px 미만) | PRD 00 반응형 기준: `studioNx.html`은 데스크톱 1280px 이상 우선. 작은 화면에서는 안내 모달만 |
| 기준은 화면 폭 | 기기 종류(UA)보다 단순하고, 창을 줄인 PC·태블릿 가로도 같은 규칙으로 처리 |
| 이어 하기 = 배너 (새 인증 장치 없음) | 같은 계정으로 로그인하면 프로젝트는 이미 있음 → 필요한 건 "찾아 들어가는 수고"를 줄이는 것. QR 로그인 등은 보안 설계가 필요해 Phase 1 밖 |
| "안 연 프로젝트" = 내 작업 세션 0개 | `project_sessions`가 이미 있어 **DB 변경 없이** 판단. 시퀀서에서 한 번 열면 자동으로 배너에서 빠짐 |
| 로그인 후 자동 이동은 안 함 | 다른 일로 들어온 사용자를 원치 않는 곳으로 보내지 않게. 배너는 × 로 닫을 수 있음 |
| 안내 모달은 공통 조각 | myProject 목록과 myPage 최근 프로젝트 둘 다 같은 안내가 필요 |

## 4. 검증 결과
| 확인 | 결과 |
|---|---|
| 가로 넘침 | 1440·390 모두 0px, 모바일 탭 줄도 0px |
| 다크·라이트 | 줄 색·참여자·메뉴 모두 보임 |
| 모달 3개 | PC·모바일에서 열림 확인 |
| 콘솔 오류 · 404 | 없음 |
| 디자인 검사 | 통과 (`flat-type-hierarchy` 오탐, `side-tab` 트랙 색 띠는 마이페이지와 같은 이유로 예외에 파일 추가) |
| `myPage.html` 회귀 | CSS 분리 전후 캡처 픽셀 차이 0 (배너 추가 전 기준) |
| 배너 | 1440px에서 보이고, 1180px·390px에서는 숨김 확인 |
| 안내 모달 | 390px에서 `open`·`created` 두 문구 확인 |

## 5. 남은 일 (사용자)
| 할 일 | 위치 |
|---|---|
| 프로젝트 API (생성 시 OWNER + MASTER 트랙 트랜잭션, 검색·페이지, 권한) | P1-13 |
| 목록·검색·페이지·모달 연결 (응답 예시는 `loadProjects` 주석) | `myproject.js` |
| `studioNx.html` 빈 페이지 (열기 테스트) | P1-15 |
| 작은 화면 판단·안내·배너 | `core/studio.js`, `mypage.js renderReadyBanner` |
| `/me/dashboard`에 `ready_projects`, 목록 응답에 `opened` | P1-16, P1-13 |

## 6. 자주 받을 질문 대비
| 질문 | 답 |
|---|---|
| 목록을 왜 `<table>`로 안 했나요? | 모바일에서 줄이 카드처럼 접혀야 해서 `<ul>` + CSS 그리드. 열 이름 줄은 화면 읽기 프로그램에 숨기고, 각 줄에 이름·링크가 있음 |
| 참여자 동그라미는 몇 개까지? | 최대 3개 (JS에서 자름). 사진이 생기면 `<i>` 안에 `<img>` |
| 검색은 언제 보내나요? | 입력을 멈추고 0.3초 뒤 (매 글자마다 보내지 않음). 정렬은 바꾸는 즉시 |
| 휴대폰에서 만든 걸 PC에서 어떻게 찾나요? | PC로 마이페이지에 들어가면 위쪽 **Ready to start** 배너에 나옵니다. 목록에서도 `Not opened` 표시가 붙어 있습니다 |
| 태블릿은요? | 화면 폭이 1280px 이상이면 PC와 같이 시퀀서가 열립니다 |
| 삭제하면 바로 사라지나요? | 서버는 소프트 삭제(`deleted_at`). 목록에서는 빠지고 복구 기능은 아직 없음 |
