# JS 35 — `canOpenStudio()` (core/studio.js)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/studio.js` |
| 작업 | P1-14 내 프로젝트 화면 — 시퀀서를 열 수 있는 화면인지 · PRD 01 FR-129 · PRD 00 반응형 기준 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [34 `initRowMenus()`](34_myproject_initRowMenus.md) · [36 `showDesktopOnly()`](36_studio_showDesktopOnly.md) |

## 1. 하는 일
지금 브라우저 화면 폭이 **1280px 이상**이면 `true`, 아니면 `false`. 시퀀서(`studioNx.html`)는 넓은 화면에서만 열기로 했기 때문 (PRD 00 · 01 FR-129).

| 화면 폭 | 결과 | 예 |
|---|---|---|
| 1920 · 1440 · 1280 | `true` | 노트북 · 데스크톱 |
| 1279 · 1024 | `false` | 작은 노트북 창 · 태블릿 가로 |
| 390 | `false` | 휴대폰 |

**순서를 바꾼 이유:** 새 프로젝트(원래 35)는 이 파일의 `canOpenStudio` · `openStudio` · `showDesktopOnly` 를 쓰는데, `core/studio.js` 네 함수가 모두 아직 템플릿이었다. 이 파일을 처음 쓰는 페이지가 myProject 이므로 여기서 먼저 하나씩 구현한다: **35 `canOpenStudio` → 36 `showDesktopOnly` → 37 `openStudio` → 38 `initDesktopOnlyLinks` → 39 `initNewProjectForm` → 40 수정 → 41 삭제 → 42 페이지 시작.** (myPage 의 `initDesktopOnlyLinks` 도 P1-17 때 그대로 씀)

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 39 `initNewProjectForm` | 만든 뒤 — 넓으면 시퀀서 창, 좁으면 "컴퓨터에서 여세요" 안내 |
| 38 `initDesktopOnlyLinks` | 목록의 Open · 제목을 누를 때 (myProject · myPage) |

**`matchMedia`**: CSS 의 `@media (min-width: 1280px)` 조건을 JS 에서 그대로 검사하는 브라우저 기능. `window.innerWidth >= 1280` 과 거의 같지만, 세로 스크롤바 폭 처리까지 **CSS 와 똑같이** 판단한다 — 화면 모양(CSS)과 JS 판단이 1px 차이로 어긋나지 않는다.

## 3. 코드
**import** (`studio.js` 맨 위)
```js
export const STUDIO_MIN_WIDTH = 1280;
```
`studio.js` 는 다른 파일을 import 하지 않는다. 이 함수는 같은 파일의 상수 `STUDIO_MIN_WIDTH` 를 쓴다.

**함수**
```js
export function canOpenStudio() {
  return window.matchMedia('(min-width: ' + STUDIO_MIN_WIDTH + 'px)').matches;
}
```

**최신 문법으로 쓰면** (공부용)
```js
export const canOpenStudio = () => matchMedia(`(min-width: ${STUDIO_MIN_WIDTH}px)`).matches;
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `` `(min-width: ${STUDIO_MIN_WIDTH}px)` `` | `'(min-width: ' + STUDIO_MIN_WIDTH + 'px)'` | 글자 안에 값 넣기 |
| `const f = () => 값` | `function f() { return 값; }` | 한 줄 함수 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| (import 없음) | `window.matchMedia` 는 브라우저에 원래 있음 |

| 식 | 뜻 | 예 |
|---|---|---|
| `window.matchMedia('(min-width: 1280px)')` | 그 조건의 검사기 | |
| `.matches` | 지금 맞는지 (true / false) — **부를 때마다 새로** 검사 | 창을 줄인 뒤 부르면 false |

## 4. 흐름
1. `'(min-width: 1280px)'` 조건을 만들어 → 2. 지금 맞는지 돌려준다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `matchMedia` (템플릿) | CSS 반응형 기준과 같은 방식 — 스크롤바 · 확대 처리가 CSS 와 같음 |
| 부를 때마다 검사 (값을 저장해 두지 않음) | 사용자가 창 크기를 바꿀 수 있음. 버튼을 누른 그 순간의 폭이 기준 |
| CSS 픽셀 기준 | 고해상도 화면(DPR 2 · 3)도 CSS 폭으로 판단 — 1280 CSS px 이면 실제 픽셀이 2560 이어도 같은 레이아웃. 브라우저 확대(Ctrl +)를 하면 CSS 폭이 줄어 false 가 될 수 있는데, 그만큼 화면이 실제로 좁아진 것이므로 그대로 따름 |
| 1280 은 상수 `STUDIO_MIN_WIDTH` | 다른 곳(안내 문구 · 시험)에서도 같은 숫자를 씀 |

## 6. 시험 (실제 myProject.html · 헤드리스 Chrome · 7개)
한 페이지를 열어 둔 채 **화면 폭만 바꿔 가며** 불렀다 (새로 열지 않음 → 부를 때마다 다시 검사함을 확인).

| 화면 폭 (DPR) | 결과 |
|---|---|
| 1920 (1) | `true` |
| 1280 (1) | `true` — 경계 포함 |
| 1279 (1) | `false` |
| 1024 (1) | `false` |
| 390 (3, 휴대폰) | `false` |
| 1280 (2, 고해상도) | `true` |
| 1440 (1) | `true` — 다시 넓히면 다시 true |

돌려준 값은 모두 `boolean`.
