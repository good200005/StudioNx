# AI 구현 설명 색인 — Phase 1 (P1-01 ~ P1-23)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-13 (P1-19) |
| 목적 | AI가 구현한 부분을 **작업(P1-NN)별로** 찾아 읽을 수 있게 한 장으로 정리합니다. 프로젝트에 관한 질문이 나왔을 때 어느 문서를 열지 바로 알 수 있도록 하기 위한 문서입니다 |
| 기준 | 계획서 `docs/Implementation_Plan.md` §2.1, 완료 기준 `docs/PRD/01_*.md` §10 |

## 1. 문서를 읽는 법
| 종류 | 위치 | 내용 |
|---|---|---|
| **개요 문서** | `docs/ai-notes/NN_*.md` (01 ~ 63번) | 작업 하나의 목적, 결정, 바뀐 파일, 시험 결과를 한 문서로 설명합니다. 화면 작업은 디자인 선택까지 적습니다 |
| **함수 문서** | `docs/ai-notes/javascript/P1-NN - …/`, `docs/ai-notes/backend(fastAPI_Python)/P1-NN - …/` | 함수 하나가 문서 하나입니다. 하는 일, 코드, 문법 풀이, 흐름, 왜 이렇게 했는지, 시험을 순서대로 적습니다 |
| **시험 문서** | 개요 문서 중 `…_site_test.md` | 실제 서버와 브라우저로 사람처럼 클릭해서 확인한 결과와 화면 캡처입니다 |
| **합본 PDF** | 함수 문서 폴더 안의 `P1-NN_*.pdf` | 그 작업의 함수 문서를 한 파일로 묶은 것입니다 |
| **PDF** | 모든 `.md` 옆의 같은 이름 `.pdf` | 문서 하나를 PDF로 만든 것입니다 |

**번호에 관해**: 개요 문서의 번호는 전체에서 하나의 순서입니다. 함수 문서의 번호는 앞쪽(1 ~ 62번)에서 JS 폴더와 백엔드 폴더가 **같은 번호를 따로** 썼고(예: JS 01 ~ 08, 백엔드 01 ~ 13), 63번부터는 두 폴더가 하나의 순서를 이어 씁니다. 그래서 함수 문서는 번호가 아니라 **폴더와 번호**로 부릅니다 (예: "백엔드 P1-16의 66번").

## 2. 작업별 문서 (P1-NN)
| 작업 | 한 일 | 개요 문서 | 함수 문서 | 시험 문서 |
|---|---|---|---|---|
| P1-01 | 공통 CSS, 공통 폼 스타일 | [02](02_home_first_page.md), [06](06_common_forms.md) | — | — |
| P1-02 | 프론트 공통 JS (API 호출, 로그인 확인) | [09](09_frontend_api_core.md), [32](32_p1-02_frontend_api_core.md) | [JS 01~08](<javascript/P1-02 - 프론트 공통 JS/>) | [34](34_p1-02_03_site_test.md) |
| P1-03 | 백엔드 공통 (오류 응답, 토큰 검사, 로그인한 회원) | [08](08_backend_core.md), [33](33_p1-03_backend_core.md) | [백엔드 01~13](<backend(fastAPI_Python)/P1-03 - 백엔드 공통/>) | [34](34_p1-02_03_site_test.md) |
| P1-04 | 회원가입 API (비밀번호 규칙, 중복 확인, 탈퇴 후 3일 규칙) | [16](16_signup_api_template.md), [35](35_p1-04_signup_api.md) | [백엔드 14~25](<backend(fastAPI_Python)/P1-04 - 회원가입 API/>) | [37](37_p1-04_05_site_test.md) |
| P1-05 | 로그인 API (토큰, 리프레시 쿠키, 재발급, 로그아웃) | [17](17_login_jwt_template.md), [36](36_p1-05_login_api.md) | [백엔드 26~34](<backend(fastAPI_Python)/P1-05 - 로그인 API/>) | [37](37_p1-04_05_site_test.md) |
| P1-06 | 회원가입 화면, 로그인 모달, 공통 머리글과 바닥글 | [07](07_auth_pages.md), [10](10_common_partials.md) | — | — |
| P1-07 | 가입, 로그인 JS (폼 검증, 중복 확인, 로그인) | [38](38_p1-07_auth_js.md) | [JS 09~17](<javascript/P1-07 - 가입·로그인 JS/>) | [39](39_p1-07_site_test.md) |
| FIX-01 | SweetAlert 알림, 확인, 입력창 | [40](40_fix_sweetalert_dialogs.md) | [JS 18~21](<javascript/fix - SweetAlert 알림창/>) | — |
| P1-08 | 회원 정보 API (내 정보, 닉네임, 프로필 사진) | [18](18_user_profile_api_template.md), [41](41_p1-08_user_profile_api.md) | [백엔드 35~43](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/>) | [42](42_p1-08_site_test.md) |
| P1-09 | 비밀번호 변경, 회원 탈퇴, 3일 뒤 정리 | [19](19_password_withdraw_template.md), [43](43_p1-09_password_withdraw.md) | [백엔드 44~49](<backend(fastAPI_Python)/P1-09 - 비밀번호 변경·탈퇴/>) | [44](44_p1-09_site_test.md) |
| P1-10 | 회원 정보 화면 (화면과 JS) | [15](15_userinfo.md), [45](45_p1-10_userinfo_js.md) | [JS 22~27](<javascript/P1-10 - 회원 정보 화면 JS/>) | [46](46_p1-10_site_test.md) |
| P1-11 | 홈(home.html) 화면, 섹션, 모바일 보정 | [02](02_home_first_page.md), [03](03_home_revision_service.md), [04](04_home_sections.md), [05](05_home_feature.md), [28](28_home_mobile_hero.md), [24](24_ui_review.md) | — | — |
| P1-12 | 문의 API (등록, 반복 전송 제한, 보관 기간)와 홈 문의 폼 JS | [20](20_inquiry_api_template.md), [47](47_p1-12_inquiry_api.md) | [백엔드 50~55, JS 28](<backend(fastAPI_Python)/P1-12 - 문의 API/>) | [48](48_p1-12_site_test.md) |
| P1-13 | 프로젝트 API (만들기, 목록, 상세, 수정, 삭제) | [21](21_project_api_template.md), [49](49_p1-13_project_api.md) | [백엔드 56~62](<backend(fastAPI_Python)/P1-13 - 프로젝트 API/>) | [50](50_p1-13_site_test.md) |
| P1-14 | 내 프로젝트 화면 (화면과 JS) | [14](14_myproject.md), [51](51_p1-14_myproject_js.md) | [JS 29~42](<javascript/P1-14 - 내 프로젝트 화면 JS/>) | [52](52_p1-14_site_test.md) |
| P1-15 | 시퀀서 화면 틀 (JS는 Phase 2) | [29](29_sequencer_screen.md), [30](30_sequencer_arrange_drag.md), [31](31_sequencer_buttons.md) | — | — |
| P1-16 | 마이페이지 대시보드 API | [22](22_dashboard_api_template.md), [53](53_p1-16_dashboard_api.md) | [백엔드 63~69](<backend(fastAPI_Python)/P1-16 - 대시보드 API/>) | [54](54_p1-16_site_test.md) |
| P1-17 | 마이페이지 화면과 JS | [13](13_mypage.md), [55](55_p1-17_mypage_js.md) | [JS 70~77](<javascript/P1-17 - 마이페이지 JS/>) | [56](56_p1-17_site_test.md) |
| P1-18 | Phase 1 완료 기준 시험 (PRD 01 §10) | [61](61_p1-18_acceptance_tests.md) | [백엔드 93~95](<backend(fastAPI_Python)/P1-18 - 완료 기준 시험/>) | — |
| [62](62_p1-23_ui_polish.md) | P1-23 화면 마무리 (오류 페이지 버튼, 홈 공지·로딩·앵커·메뉴, 개인정보 목차) |
| [63](63_p1-23_site_test.md) | P1-23 실제 화면 시험 (홈, 처리방침, 오류 페이지를 사람처럼 클릭해서) |
| P1-20 | 첫 접속 로딩, 로고, 별 커서 | [25](25_intro_logo.md), [26](26_star_cursor.md) | — | — |
| P1-21 | Development 공지 API와 관리자 화면(/admin) | [23](23_dev_notes_admin_template.md), [59](59_p1-21_dev_notes_admin.md) | [백엔드 82~92](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/>) | [60](60_p1-21_site_test.md) |
| P1-22 | 오류 페이지 7종과 서버 연결 (화면은 HTML, API는 JSON) | [11](11_error_pages.md), [12](12_http_status_poster.md), [57](57_p1-22_error_pages.md) | [백엔드 78~81](<backend(fastAPI_Python)/P1-22 - 오류 페이지 연결/>) | [58](58_p1-22_site_test.md) |
| P1-23 | 화면 마무리: 오류 페이지 버튼, 홈의 공지 카드와 모달, 로딩, 세로 앵커, 모바일 메뉴, 개인정보 목차 | [62](62_p1-23_ui_polish.md) | [JS 96~101](<javascript/P1-23 - 화면 마무리/>) | [63](63_p1-23_site_test.md) |
| (기타) | 개인정보 처리방침 페이지와 가입 동의, 개발 환경 | [27](27_privacy_policy.md), [01](01_dev_environment.md) | — | — |

P1-19는 이 색인과 `develop`으로의 PR입니다. P1-15의 시퀀서 JS는 Phase 2에서 만듭니다.

## 3. 자주 받을 질문과 볼 문서
| 질문 | 볼 문서 |
|---|---|
| 비밀번호는 어떻게 저장하고 어떤 규칙인가요? | P1-04의 개요 35번, 함수 문서(비밀번호 규칙, 해시) |
| 로그인은 어떤 방식인가요? 자동 로그인은요? | P1-05의 개요 36번 (Access Token 30분, 리프레시 쿠키 3일, HttpOnly) |
| 탈퇴하면 데이터는 어떻게 되나요? 같은 이메일로 다시 가입할 수 있나요? | P1-09의 개요 43번, P1-18 묶음 C (3일 규칙, 소프트 삭제, 정리 작업) |
| 다른 사람의 프로젝트를 볼 수 있나요? | P1-13의 개요 49번, P1-18 묶음 B (404로 존재 여부도 숨김) |
| 오류가 나면 화면에는 무엇이 보이나요? | P1-22의 개요 57번, 화면 디자인은 11번 (화면은 오류 페이지 HTML, API는 JSON) |
| 관리자는 어떻게 공지를 쓰나요? 관리자 주소는요? | P1-21의 개요 59번 (/admin, 배포 때 ADMIN_PATH 설정) |
| 마이페이지의 숫자는 어디서 오나요? | P1-16의 개요 53번(API), P1-17의 개요 55번(화면 JS) |
| 시간이 왜 9시간 어긋났었나요? | P1-17의 개요 55번 §4와 함수 문서 JS 75번 §6 (DB 연결 시간대를 UTC로 고정) |
| 프론트 JS에서 최신 문법을 왜 안 썼나요? | 프로젝트 원칙(StudioNx_CLAUDE.md). 함수 문서마다 "최신 문법으로 쓰면" 블록이 있습니다 |
| Phase 1의 완료 기준은 어디까지 시험으로 지켜지나요? | P1-18의 개요 61번 (완료 기준 12개와 시험의 대응표) |

## 4. 개요 문서 전체 목록 (번호 순)
| 번호 | 제목 |
|---|---|
| [01](01_dev_environment.md) | 개발 환경 구축 |
| [02](02_home_first_page.md) | 메인 페이지(home.html) 구조 · 첫 화면 + 공통 CSS |
| [03](03_home_revision_service.md) | 메인 페이지 수정(첫 화면) · Service 섹션 |
| [04](04_home_sections.md) | 메인 페이지 나머지 섹션 프로토타입 |
| [05](05_home_feature.md) | 모바일 띠 재조정 · Feature 섹션 |
| [06](06_common_forms.md) | 공통 폼 스타일 (B-2 밑줄형) |
| [07](07_auth_pages.md) | 회원가입 페이지 · 로그인 모달 |
| [08](08_backend_core.md) | 백엔드 공통 뼈대 |
| [09](09_frontend_api_core.md) | 프론트 공통 JS 뼈대 |
| [10](10_common_partials.md) | 공통 헤더·푸터·로그인 모달 통합 (HTML 조각) |
| [11](11_error_pages.md) | 오류 페이지 (F-2 "숫자 자체가 신호") |
| [12](12_http_status_poster.md) | HTTP 상태 코드 포스터 "HTTP Status as Sound" |
| [13](13_mypage.md) | 마이페이지 대시보드 (M-2 믹서 콘솔형) |
| [14](14_myproject.md) | 나의 프로젝트 (P-2 콘솔 목록형) |
| [15](15_userinfo.md) | 회원 정보 (U-2 2열 설정형) |
| [16](16_signup_api_template.md) | 회원가입 API 템플릿 |
| [17](17_login_jwt_template.md) | 로그인 · 토큰 재발급 · 로그아웃 템플릿 |
| [18](18_user_profile_api_template.md) | 회원 정보 · 프로필 사진 API 템플릿 |
| [19](19_password_withdraw_template.md) | 비밀번호 변경 · 회원 탈퇴 API 템플릿 |
| [20](20_inquiry_api_template.md) | 문의 API 템플릿 |
| [21](21_project_api_template.md) | 프로젝트 CRUD API 템플릿 |
| [22](22_dashboard_api_template.md) | 마이페이지 대시보드 API 템플릿 |
| [23](23_dev_notes_admin_template.md) | Development 공지 API · 관리자 화면 템플릿 |
| [24](24_ui_review.md) | Phase 1 화면 점검과 수정 |
| [25](25_intro_logo.md) | 로고(S2) 확정과 첫 접속 로딩 |
| [26](26_star_cursor.md) | 별 커서 |
| [27](27_privacy_policy.md) | 개인정보 처리방침 페이지와 가입 동의 |
| [28](28_home_mobile_hero.md) | 홈 첫 화면 모바일 겹침 수정 |
| [29](29_sequencer_screen.md) | 시퀀서 화면 (studioNx.html) |
| [30](30_sequencer_arrange_drag.md) | 시퀀서 편곡 · 피아노롤 · 오토메이션 (꽉 채우기 · 드래그 · 재생선 · 확대/축소 · 선택 · 셋잇단 · 스냅 · Loop · 높이 · 곡선) |
| [31](31_sequencer_buttons.md) | 시퀀서 화면 버튼 전체 |
| [32](32_p1-02_frontend_api_core.md) | P1-02 프론트 공통 JS (API 호출 · 로그인 확인) |
| [33](33_p1-03_backend_core.md) | P1-03 백엔드 공통 (오류 응답 · 토큰 검사 · 로그인 사용자 · ORM 모델) |
| [34](34_p1-02_03_site_test.md) | P1-02 · P1-03 실제 사이트 시험 (화면 캡처) |
| [35](35_p1-04_signup_api.md) | P1-04 회원가입 API (비밀번호 · 중복 확인 · 탈퇴 후 재가입 · 가입) |
| [36](36_p1-05_login_api.md) | P1-05 로그인 API (JWT 발급 · 리프레시 쿠키 · 재발급 · 로그아웃) |
| [37](37_p1-04_05_site_test.md) | P1-04 · P1-05 실제 사이트 시험 (가입 · 로그인 · 재발급 · 로그아웃) |
| [38](38_p1-07_auth_js.md) | P1-07 가입 · 로그인 JS (폼 검증 · 중복 확인 · 로그인 모달 · 헤더 전환) |
| [39](39_p1-07_site_test.md) | P1-07 실제 사이트 시험 (사람처럼 클릭 · 타이핑: 가입 → 로그인 → 로그아웃) |
| [40](40_fix_sweetalert_dialogs.md) | FIX-01 SweetAlert 알림 · 확인 · 입력창 |
| [41](41_p1-08_user_profile_api.md) | P1-08 회원 정보 API (내 정보 · 닉네임 · 프로필 사진) |
| [42](42_p1-08_site_test.md) | P1-08 실제 사이트 시험 (내 정보 · 닉네임 · 프로필 사진) |
| [43](43_p1-09_password_withdraw.md) | P1-09 비밀번호 변경 · 회원 탈퇴 · 3일 뒤 정리 |
| [44](44_p1-09_site_test.md) | P1-09 실제 사이트 시험 (비밀번호 변경 · 탈퇴 · 3일 뒤 정리) |
| [45](45_p1-10_userinfo_js.md) | P1-10 회원 정보 화면 JS (내 정보 · 사진 · 닉네임 · 비밀번호 · 탈퇴 · 로그아웃) |
| [46](46_p1-10_site_test.md) | P1-10 실제 사이트 시험 (회원 정보 화면을 사람처럼) |
| [47](47_p1-12_inquiry_api.md) | P1-12 문의 API (문의 등록 · 반복 전송 제한 · 보관 정리 · 홈 문의 폼) |
| [48](48_p1-12_site_test.md) | P1-12 실제 사이트 시험 (홈 Contact 폼을 사람처럼) |
| [49](49_p1-13_project_api.md) | P1-13 프로젝트 API (만들기 · 목록 · 상세 · 수정 · 삭제 · 권한) |
| [50](50_p1-13_site_test.md) | P1-13 실제 사이트 시험 (프로젝트 API 5개) |
| [51](51_p1-14_myproject_js.md) | P1-14 내 프로젝트 화면 JS (목록 · 검색 · 만들기 · 수정 · 삭제 · 시퀀서 열기) |
| [52](52_p1-14_site_test.md) | P1-14 실제 사이트 시험 (내 프로젝트 화면을 사람처럼) |
| [53](53_p1-16_dashboard_api.md) | P1-16 마이페이지 대시보드 API (`GET /me/dashboard`) |
| [54](54_p1-16_site_test.md) | P1-16 실제 서버 시험 (대시보드 API를 실제 HTTP로) |
| [55](55_p1-17_mypage_js.md) | P1-17 마이페이지 JS (`mypage.js`) |
| [56](56_p1-17_site_test.md) | P1-17 실제 화면 시험 (마이페이지를 사람처럼 클릭해서) |
| [57](57_p1-22_error_pages.md) | P1-22 오류 페이지 백엔드 연결 (화면은 HTML, API는 JSON) |
| [58](58_p1-22_site_test.md) | P1-22 실제 서버 시험 (오류 페이지를 실제 HTTP와 브라우저로) |
| [59](59_p1-21_dev_notes_admin.md) | P1-21 Development 공지 API와 관리자 화면 (`/admin`) |
| [60](60_p1-21_site_test.md) | P1-21 실제 화면 시험 (관리자 화면을 사람처럼 클릭해서) |
| [61](61_p1-18_acceptance_tests.md) | P1-18 Phase 1 완료 기준 시험 (PRD 01 §10) |

## 5. 그 밖의 기준 문서
| 문서 | 내용 |
|---|---|
| `docs/PRD/` | 기능 요구사항 (Phase별) |
| `docs/DB.md`, `docs/ERD.md` | DB 설계 원본과 ERD |
| `docs/Implementation_Plan.md` | 구현 순서와 작업 목록 (§2.1) |
| `docs/Git_Manual.md` | 브랜치와 커밋 규칙 |
| `docs/context_*.md` | 날짜별 진행 상황과 결정 (가장 최신 날짜가 현재) |
| `docs/AI_Doc_Template_Guide.md` | 문서 작성 템플릿과 빌드 절차 |
