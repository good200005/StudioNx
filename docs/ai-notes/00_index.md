# AI 구현 설명 색인 — Phase 1 (P1-01 ~ P1-28), Phase 2 (S1-05 ~)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-13 (P1-19), 2026-10-14 (S1-05, S1-06 갱신), 2026-10-15 (P1-28 갱신, S1-06·S1-05 시험 문서 추가, S1-07 백엔드 개요 추가), 2026-10-17 (S1-07 화면 JS 함수 문서 193~210과 개요 76, S1-08 아코디언·피아노롤 함수 문서 211~225와 개요 77 추가), 2026-10-18 (S1-09 악기·이펙트 백엔드 함수 문서 226~242와 개요 78, 같은 날 S1-09 화면(프런트) 함수 문서 243~263과 개요 79 추가), 2026-10-19 (S1-10 프로젝트 전체 저장·불러오기 백엔드 함수 문서 264~268과 프런트 JS 함수 문서 269~273, 개요 80 추가) |
| 목적 | AI가 구현한 부분을 **작업(P1-NN)별로** 찾아 읽을 수 있게 한 장으로 정리합니다. 프로젝트에 관한 질문이 나왔을 때 어느 문서를 열지 바로 알 수 있도록 하기 위한 문서입니다 |
| 기준 | 계획서 `docs/Implementation_Plan.md` §2.1, 완료 기준 `docs/PRD/01_*.md` §10 |

## 1. 문서를 읽는 법
| 종류 | 위치 | 내용 |
|---|---|---|
| **개요 문서** | `docs/ai-notes/NN_*.md` (01 ~ 74번) | 작업 하나의 목적, 결정, 바뀐 파일, 시험 결과를 한 문서로 설명합니다. 화면 작업은 디자인 선택까지 적습니다 |
| **함수 문서** | `docs/ai-notes/javascript/P1-NN - …/`(Phase 2는 `S1-NN - …/`), `docs/ai-notes/backend(fastAPI_Python)/P1-NN - …/` | 함수 하나가 문서 하나입니다. 하는 일, 코드, 문법 풀이, 흐름, 왜 이렇게 했는지, 시험을 순서대로 적습니다 |
| **시험 문서** | 개요 문서 중 `…_site_test.md` | 실제 서버와 브라우저로 사람처럼 클릭해서 확인한 결과와 화면 캡처입니다 |
| **합본 PDF** | 함수 문서 폴더 안의 `P1-NN_*.pdf`(Phase 2는 `S1-NN_*.pdf`) | 그 작업의 함수 문서를 한 파일로 묶은 것입니다 |
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
| [64](64_p1-24_ui_fixes_privacy_i18n.md) | P1-24 홈 화면 수정과 개인정보 처리방침 한국어, 일본어판 |
| [65](65_p1-24_site_test.md) | P1-24 실제 화면 시험 (세 칸 폭, 공지 없음 화면, 처리방침 세 판과 언어 전환) |
| [66](66_p1-25_privacy_links.md) | P1-25 처리방침 링크의 언어 연결, 일본 감독기관 안내, 목차 표시 오류 수정 |
| P1-20 | 첫 접속 로딩, 로고, 별 커서 | [25](25_intro_logo.md), [26](26_star_cursor.md) | — | — |
| P1-21 | Development 공지 API와 관리자 화면(/admin) | [23](23_dev_notes_admin_template.md), [59](59_p1-21_dev_notes_admin.md) | [백엔드 82~92](<backend(fastAPI_Python)/P1-21 - 공지 API와 관리자 화면/>) | [60](60_p1-21_site_test.md) |
| P1-22 | 오류 페이지 7종과 서버 연결 (화면은 HTML, API는 JSON) | [11](11_error_pages.md), [12](12_http_status_poster.md), [57](57_p1-22_error_pages.md) | [백엔드 78~81](<backend(fastAPI_Python)/P1-22 - 오류 페이지 연결/>) | [58](58_p1-22_site_test.md) |
| P1-23 | 화면 마무리: 오류 페이지 버튼, 홈의 공지 카드와 모달, 로딩, 세로 앵커, 모바일 메뉴, 개인정보 목차 | [62](62_p1-23_ui_polish.md) | [JS 96~101](<javascript/P1-23 - 화면 마무리/>) | [63](63_p1-23_site_test.md) |
| P1-24 | 홈 화면 수정(Service, Feature 세 칸 폭, Development 공지 없음 화면)과 개인정보 처리방침 한국어, 일본어판 | [64](64_p1-24_ui_fixes_privacy_i18n.md) | [JS 102](<javascript/P1-24 - 화면 수정과 처리방침 번역/>) | [65](65_p1-24_site_test.md) |
| P1-25 | 처리방침 링크의 언어 연결, 일본 감독기관 안내, 목차 표시 오류 수정 | [66](66_p1-25_privacy_links.md) | [JS 103](<javascript/P1-25 - 처리방침 링크 언어 연결/>) | 66 §4 |
| P1-26 | Nyxi 일러스트 삽입 (오류 페이지 7개, 홈 공지 없음 화면) | [69](69_p1-26_illustrations.md) | (CSS, HTML 작업) | 69 §3 |
| P1-27 | Nyxi 일러스트 저장 방지 (오른쪽 클릭, 끌기) | (개요는 함수 문서에 포함) | [JS 149](<javascript/P1-27 - 일러스트 저장 방지/>) | JS 149 §5 |
| P1-28 | 비밀번호 찾기와 이메일 안내: 재설정 토큰, 요청과 확인 API, 이전 로그인 무효화, 이메일 안내 메일, 계정 찾기 화면(모달과 `resetPassword.html`) | [70](70_p1-28_account_recovery_ui.md) | [백엔드 150~164](<backend(fastAPI_Python)/P1-28 - 비밀번호 찾기/>), [JS 165~176](<javascript/P1-28 - 비밀번호 찾기/>) | [71](71_p1-28_site_test.md) |
| (기타) | 개인정보 처리방침 페이지와 가입 동의, 개발 환경 | [27](27_privacy_policy.md), [01](01_dev_environment.md) | — | — |

P1-19는 이 색인과 `develop`으로의 PR입니다. P1-15의 시퀀서 JS는 Phase 2에서 만듭니다.

### 2.1 Phase 2 작업 (S1-NN)
| 작업 | 한 일 | 개요 문서 | 함수 문서 | 시험 문서 |
|---|---|---|---|---|
| S1-05 | 오디오 엔진 기초 (AudioContext, 트랜스포트, 스케줄러, 메트로놈, 루프) | [67](67_s1-05_audio_engine.md) | [JS 104~114](<javascript/S1-05 - 오디오 엔진 기초/>) | [73](73_s1-05_site_test.md) |
| S1-06 | 타임라인 (그리드 스냅, 트랙, 클립 편집, 줌, 파형) | [68](68_s1-06_timeline.md) | [JS 115~148](<javascript/S1-06 - 타임라인/>) | [72](72_s1-06_site_test.md) |
| S1-07 | 샘플 라이브러리 (업로드, 파형, 태그, 저장 용량) — 백엔드·화면 JS 완료 | [74](74_s1-07_sample_library.md), [75](75_s1-07_sample_library_ui.md), [76](76_s1-07_sample_library_ui_js.md) | [백엔드 177~192](<backend(fastAPI_Python)/S1-07 - 샘플 라이브러리/>), [JS 193~210](<javascript/S1-07 - 샘플 라이브러리 UI/>) | JS 201~210 §4 (헤드리스 확인) |
| S1-08 | 트랙 아코디언·피아노롤 (노트→패턴 저장, 트랙 선택·그룹, 펼침 기억, MIDI 클립 미리보기) | [77](77_s1-08_accordion_pianoroll.md) | [백엔드 211~218](<backend(fastAPI_Python)/S1-08 - 아코디언·피아노롤/>), [JS 219~225](<javascript/S1-08 - 아코디언·피아노롤/>) | 헤드리스 (요구 1~5, FR-261) |
| S1-09 | 기본 악기·이펙트 (트랙 CRUD, 악기·이펙트 붙이기와 순서, 갈래 연결선, 플러그인 7종 시드) + 화면 (트랙 줄·펼침 칸·Nyxi 카드·상세 설정 창) | [78](78_s1-09_instruments_effects.md), [79](79_s1-09_ui.md) | [백엔드 226~242](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/>), [JS 243~263](<javascript/S1-09 - 악기·이펙트 화면/>) | `pytest` 1026, 라이브 UI 시험 40건 |
| S1-10 | 프로젝트 전체 저장·불러오기 (전체 조회, 곡 설정 저장, 자동 저장, Undo/Redo, 메뉴·단축키·팔레트 공용 명령) — 백엔드·프런트 진행 중 | [개요 80](80_s1-10_full_save.pdf) | [백엔드 264~268](<backend(fastAPI_Python)/S1-10 - 프로젝트 전체 저장·불러오기/>), [프런트 269~273](<javascript/S1-10 - 프로젝트 전체 저장·불러오기/>) | `pytest` 19 (S1-10 시험 2파일) |

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
| 소리, 재생, 메트로놈은 어떻게 동작하나요? | S1-05의 개요 67번, 함수 문서 JS 104~114 (시간 변환, 스케줄 계산, 트랜스포트, 메트로놈, 엔진) |
| 클립을 옮기고 자르는 규칙은 어떻게 되나요? | S1-06의 개요 68번, 함수 문서 JS 115~148 (스냅, 이동·길이·트리밍, 분할·복제, 줌, 파형) |
| 샘플을 올리면 어떻게 저장되고, 파형·태그·용량은 어떻게 처리되나요? | S1-07의 개요 74번, 함수 문서 백엔드 177~192 (형식·크기·용량 검사, 파형 JSON, 태그 교체, 소프트 삭제) |
| 화면에서 샘플을 올리고, 거르고, 이름·태그를 고치고, 지우는 일은 어떻게 되나요? | S1-07의 개요 76번, 함수 문서 JS 193~210 (업로드 진행률, 파형 그리기, 검색·칩 필터, 태그 순환, 인라인 편집, 삭제, 저장 용량) |
| 피아노롤 노트는 어디에 저장되나요? | S1-08의 개요 77번, 함수 문서 백엔드 211~218 ([노트] 탭 편집을 패턴으로 통째 저장) |
| 트랙을 묶거나 펼친 상태는 어떻게 기억하나요? | S1-08의 개요 77번, 함수 문서 JS 221·223 (트랙 번호로 그룹과 펼침 저장) |
| 악기와 이펙트는 어떻게 트랙에 붙이나요? | S1-09의 개요 78번, 함수 문서 백엔드 234·235·239·240 (악기 칸과 이펙트 칸) |
| 이펙트 순서를 바꿀 때 같은 칸에 넣으면 어떻게 되나요? | S1-09의 개요 78번, 함수 문서 백엔드 234 (`_require_free_slot` 이 400 으로 알려 줍니다) |
| 플러그인 노브 화면은 무엇을 보고 그리나요? | S1-09의 개요 78·79번, 함수 문서 백엔드 229·242 와 JS 257·261 (`param_schema` 시드 일곱 종을 257 조작과 261 모달이 그대로 씁니다) |
| 시퀀서 화면에서 악기와 이펙트를 어떻게 붙이고 고치나요? | S1-09의 개요 79번, 함수 문서 JS 243·250·253·260·261 (트랙을 펼쳐 칸을 채우고, Nyxi 카드로 붙이고, 노브로 고치고, 모달로 자세히 다룹니다) |
| 펼친 칸에 값이 왜 두 번 그려지나요? | S1-09의 개요 79번, 함수 문서 JS 250·251 (처음에는 `Loading…` 을 그리고, 값을 읽은 뒤 `refreshCells` 로 다시 그립니다) |
| 시퀀서를 열 때 서버에 몇 번 묻나요? | S1-10의 함수 문서 백엔드 266 (`GET /projects/{id}/full` 한 번으로 트랙·악기·이펙트·연결선·패턴·노트를 조회 여섯 번에 담아 보냅니다) |
| BPM과 Key는 어디에 저장하나요? | S1-10의 함수 문서 백엔드 264·267 (새 표를 만들지 않고 `projects` 의 곡 설정 칸을 `PATCH /projects/{id}/settings` 로 저장합니다) |
| `clips`·`markers` 칸이 왜 늘 비어 있나요? | S1-10의 함수 문서 백엔드 264·266 (해당 표와 모델이 아직 없어 응답 스키마가 빈 목록으로 채웁니다. 뒤 작업이 이 칸만 채웁니다) |

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
| [62](62_p1-23_ui_polish.md) | P1-23 화면 마무리 (오류 페이지 버튼, 홈 공지·모달·로딩·세로 앵커·모바일 메뉴, 개인정보 목차) |
| [63](63_p1-23_site_test.md) | P1-23 실제 화면 시험 (홈, 처리방침, 오류 페이지를 사람처럼 클릭해서) |
| [64](64_p1-24_ui_fixes_privacy_i18n.md) | P1-24 홈 화면 수정과 개인정보 처리방침 한국어, 일본어판 |
| [65](65_p1-24_site_test.md) | P1-24 실제 화면 시험 (세 칸 폭, 공지 없음 화면, 처리방침 세 판과 언어 전환) |
| [66](66_p1-25_privacy_links.md) | P1-25 처리방침 링크의 언어 연결, 일본 감독기관 안내, 목차 표시 오류 수정 |
| [67](67_s1-05_audio_engine.md) | S1-05 오디오 엔진 기초 (AudioContext, 트랜스포트, 스케줄러, 메트로놈, 루프) |
| [68](68_s1-06_timeline.md) | S1-06 타임라인 (그리드 스냅, 트랙, 클립 편집, 줌, 파형) |
| [69](69_p1-26_illustrations.md) | P1-26 Nyxi 일러스트 삽입 (오류 페이지, 홈 공지 없음 화면) |
| [70](70_p1-28_account_recovery_ui.md) | P1-28 계정 찾기 화면 (복구 모달, `resetPassword.html`) |
| [71](71_p1-28_site_test.md) | P1-28 실제 화면 시험 (실제 재설정 링크로 새 비밀번호 정하기) |
| [72](72_s1-06_site_test.md) | S1-06 실제 화면 시험 (타임라인을 사람처럼 클릭하고 끌어서) |
| [73](73_s1-05_site_test.md) | S1-05 실제 화면 시험 (데모 페이지와 오프라인 렌더로 소리 확인) |
| [74](74_s1-07_sample_library.md) | S1-07 샘플 라이브러리 (업로드, 파형 데이터, 태그, 저장 용량) |
| [75](75_s1-07_sample_library_ui.md) | S1-07 샘플 라이브러리 UI (HTML/CSS, 목업 19~25) |
| [76](76_s1-07_sample_library_ui_js.md) | S1-07 샘플 라이브러리 화면 JS (목록·파형·검색·태그·업로드·편집·삭제·저장 용량) |
| [77](77_s1-08_accordion_pianoroll.md) | S1-08 트랙 아코디언·피아노롤 (노트→패턴 저장, 트랙 선택·그룹, 펼침 기억, MIDI 클립 미리보기) |
| [78](78_s1-09_instruments_effects.md) | S1-09 기본 악기·이펙트 백엔드 (트랙 CRUD, 악기·이펙트와 체인 순서, 갈래 연결선, 플러그인 7종 시드) |
| [79](79_s1-09_ui.md) | S1-09 악기·이펙트 화면 (트랙 줄 다시 그리기, 펼침 칸 네 칸, Nyxi 카드, 고르기 창, 상세 설정 창·A/B) |

## 5. 그 밖의 기준 문서
| 문서 | 내용 |
|---|---|
| `docs/PRD/` | 기능 요구사항 (Phase별) |
| `docs/DB.md`, `docs/ERD.md` | DB 설계 원본과 ERD |
| `docs/Implementation_Plan.md` | 구현 순서와 작업 목록 (§2.1) |
| `docs/Git_Manual.md` | 브랜치와 커밋 규칙 |
| `docs/context_*.md` | 날짜별 진행 상황과 결정 (가장 최신 날짜가 현재) |
| `docs/AI_Doc_Template_Guide.md` | 문서 작성 템플릿과 빌드 절차 |
