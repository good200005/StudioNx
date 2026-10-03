# AI 구현 설명 25 — 로고(S2) 확정과 첫 접속 로딩

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-03 |
| 작업 | P1-20 첫 접속 로딩(로딩 C "Crescent") + 로고 S2 확정 → 헤더 로고·파비콘 교체. 이전 문서: [24_ui_review.md](24_ui_review.md) |
| 브랜치 | `feature/phase1/p1-20-intro-loader` |
| 원칙 | HTML·CSS는 AI 작성. "첫 접속만 보이기" JS는 템플릿(`home.js initIntro`)만 |

---

## 1. 실행 결과
![로딩 C — 실제 home.html, 0~1960ms](images/25_intro_logo/02_intro_storyboard.png)

![헤더 로고 (S2)](images/25_intro_logo/03_header_logo.png)

> **실제 동작 영상** (실제 `home.html`을 새로 열며 실시간 녹화, 60fps): [데스크톱 1440×900](images/25_intro_logo/04_intro_desktop.mp4) · [모바일 390×844](images/25_intro_logo/05_intro_mobile.mp4) — PDF에서는 재생되지 않으므로 파일을 직접 여세요. 시간을 멈춰 찍은 GIF: `images/25_intro_logo/01_intro.gif` · 고르는 과정의 목업: `docs/page_mockups/loader/`, `docs/page_mockups/logo/`

## 2. 무엇을 만들었나
| 파일 | 상태 | 내용 |
|---|---|---|
| `static/assets/logo/mark.svg` | 새 파일 | 로고 마크 원본 (밝은 보라 한 색) |
| `static/assets/logo/favicon.svg` | 새 파일 | 파비콘. 밝은 탭은 진한 보라, 어두운 탭은 밝은 보라 (SVG 안의 `prefers-color-scheme`) |
| `static/partials/header.html` | 수정 | 임시 초승달 → S2 마크 (`currentColor`라 테마 색을 따름) |
| 모든 페이지 12개 (`*.html`, `errors/*.html`) | 수정 | 파비콘을 `static/assets/logo/favicon.svg`로 |
| `home.html` | 수정 | 로딩 오버레이 `.intro` (body 맨 앞), `intro.css` 연결 |
| `static/css/pages/intro.css` | 새 파일 | 로딩 애니메이션 전부 + 첫 화면 등장을 800ms 미루기 |
| `static/js/pages/home.js` | 템플릿 추가 | `initIntro()` — 첫 접속만 보이기 (TODO) |

## 3. 왜 이렇게 했나
### 3.1 로고 S2 — 마스크 대신 경로 하나
목업에서는 SVG 마스크로 그렸지만, 실제 파일은 **경로(path) 하나 + `fill-rule="evenodd"`**로 바꿨습니다.

| 부분 | 만드는 법 |
|---|---|
| 초승달 | 바깥 원 (48,50) r42와 비켜난 원 (67,44) r28의 **교점 두 개**를 계산 → 바깥 호(큰 호)로 내려가고 안쪽 호로 돌아오는 닫힌 경로 |
| 반짝임 | 중심 (64,17), 반지름 19의 4갈래 별 (변은 2차 곡선) |
| 겹친 곳 비우기 | 두 경로를 한 `d`에 넣고 `evenodd` → 겹친 곳은 "두 번 감싸짐"이라 칠하지 않음 (XOR) |
| 보이는 영역 | `viewBox="-1 -5 98 98"` — 반짝임 끝(위쪽 y=-2)까지 잘리지 않게 |

마스크는 `id`가 필요해 한 페이지에 여러 번 넣으면 충돌하고, 파비콘처럼 작은 곳에서 무겁습니다. 경로 하나면 `currentColor`로 색만 바꿔 어디든 그대로 씁니다.

> 로딩처럼 두 색(초승달 보라 + 반짝임 흰색)이 필요할 때는 같은 경로를 두 번 그리고 각각 `clipPath`(초승달 / 별)로 잘라 냅니다 (`#intro-moon`, `#intro-star`).

### 3.2 로딩 시간표 (CSS만)
| 시간 (ms) | 동작 |
|---|---|
| 0 → 400 | 초승달 윤곽선이 그려짐 (`stroke-dashoffset`, `pathLength="100"`) |
| 300 → 600 | "Studio Nx" 글자가 왼쪽부터 펼쳐짐 (`clip-path`) |
| 380 → 560 | 초승달이 채워짐 |
| 480 → 640 | 반짝임이 회전하며 튀어나옴 — 뿔과 겹친 곳은 비어 있음 |
| 380 → 780 | 레벨 미터 16칸이 25ms 간격으로 켜짐 (끝 3칸 노랑·빨강 = 0 dB) |
| 800 → 1020 | 살짝 커지며 사라짐, 끝나면 `visibility: hidden` (클릭을 막지 않음) |
| 800 → | 첫 화면 등장 애니메이션 시작 (원래 지연값 + 800ms) |

JS 없이 CSS만으로 재생·사라짐까지 되므로, JS가 늦거나 실패해도 로딩이 화면을 막고 남는 일이 없습니다.

### 3.3 보이지 않는 경우
| 경우 | 처리 |
|---|---|
| 움직임 줄이기 설정 (`prefers-reduced-motion: reduce`) | 로딩을 아예 그리지 않음 (첫 화면 등장도 home.css 규칙대로 없음) |
| 같은 탭에서 두 번째 방문 | `<html data-intro="seen">`이면 숨기고 첫 화면은 원래 시간대로 — 이 값을 넣는 일은 `home.js initIntro` (직접 구현) |
| 화면 읽기 프로그램 | `aria-hidden="true"` — 장식이라 읽지 않음 |

## 4. 검증 결과 (2026-10-03)
| 확인 | 결과 |
|---|---|
| 실제 `home.html`에서 40ms마다 캡처 | 목업과 같은 순서로 재생, 800ms에 첫 화면으로 이어짐 |
| **실시간 녹화** (페이지를 새로 열며 CDP screencast, 약 70fps) | 데스크톱·모바일 모두 로딩이 재생된 뒤 첫 화면 등장 — MP4 2개 (`04`, `05`). 녹화·변환 스크립트: `docs/page_mockups/loader/_source/record.mjs`, `encode.py` |
| 끝난 뒤 | `.intro`는 `visibility: hidden`, 화면 가운데 클릭은 첫 화면 요소가 받음 |
| `data-intro="seen"` | 로딩 `display: none`, 띠 등장 지연 `0s` (원래대로) |
| 움직임 줄이기 | 로딩 `display: none` |
| 콘솔 오류 | 없음 |
| 경로 확인 | 경로 하나로 그린 S2가 목업(마스크)과 같은 모양, 16·32px에서도 반짝임이 보임 |

## 5. 남은 일 (사용자)
| 할 일 | 파일 |
|---|---|
| `initIntro` — sessionStorage로 첫 접속만 보이기. 깜빡임 없이 하려면 `<head>` 인라인 스크립트로 | `static/js/pages/home.js` |
| (선택) 로고 사용 규칙 — 최소 크기, 주변 여백, 색 조합 | — |

## 6. 자주 받을 질문 대비
- **Q. evenodd가 왜 겹친 곳을 비우나?** 어떤 점에서 바깥으로 선을 그었을 때 경로를 몇 번 넘는지 셉니다. 홀수면 칠하고 짝수면 비웁니다. 초승달과 별이 겹친 곳은 두 경로를 모두 넘으므로 짝수 → 빈칸입니다.
- **Q. 첫 화면 애니메이션 시간을 왜 CSS에서 다시 적었나?** 로딩이 있을 때만 800ms 미뤄야 합니다. `:root:not([data-intro="seen"])` 조건으로 묶어 두면, 두 번째 방문(`seen`)에는 자동으로 원래 시간이 됩니다.
- **Q. 로딩 때문에 첫 화면이 늦게 뜨지 않나?** 로딩은 이미 그려진 페이지 위에 덮는 장식이라 페이지 불러오기를 늦추지 않습니다. 사용자가 보는 시간만 약 0.8초 늘어나고, 그것도 첫 접속 한 번뿐입니다.
