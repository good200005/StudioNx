# JS 35 — `canOpenStudio()` (core/studio.js)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/studio.js` |
| 작업 | P1-14 내 프로젝트 화면: 시퀀서를 열 수 있는 화면인지 판단 (PRD 01 FR-129, PRD 00 반응형 기준) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [34 `initRowMenus()`](34_myproject_initRowMenus.md) · [36 `showDesktopOnly()`](36_studio_showDesktopOnly.md) |

## 1. 하는 일
지금 브라우저의 화면 폭이 **1280px 이상**이면 `true`를, 아니면 `false`를 돌려줍니다. 시퀀서(`studioNx.html`)는 넓은 화면에서만 열기로 했기 때문입니다 (PRD 00, 01 FR-129).

| 화면 폭 | 결과 | 예 |
|---|---|---|
| 1920, 1440, 1280 | `true` | 노트북, 데스크톱 |
| 1279, 1024 | `false` | 작은 노트북 창, 태블릿 가로 |
| 390 | `false` | 휴대폰 |

**순서를 바꾼 이유:** 새 프로젝트 기능(원래 35번)은 이 파일의 `canOpenStudio`, `openStudio`, `showDesktopOnly`를 쓰는데, `core/studio.js`의 네 함수가 모두 아직 템플릿 상태였습니다. 이 파일을 처음 쓰는 페이지가 myProject이므로 여기서 먼저 하나씩 구현합니다. 순서는 **35 `canOpenStudio` → 36 `showDesktopOnly` → 37 `openStudio` → 38 `initDesktopOnlyLinks` → 39 `initNewProjectForm` → 40 수정 → 41 삭제 → 42 페이지 시작**입니다. (myPage의 `initDesktopOnlyLinks`도 P1-17 때 그대로 씁니다.)

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 39 `initNewProjectForm` | 프로젝트를 만든 뒤, 넓은 화면이면 시퀀서 창을 열고, 좁은 화면이면 "컴퓨터에서 여세요" 안내를 띄웁니다 |
| 38 `initDesktopOnlyLinks` | 목록의 Open이나 제목을 누를 때 씁니다 (myProject, myPage) |

**`matchMedia`**는 CSS의 `@media (min-width: 1280px)` 조건을 JS에서 그대로 검사하는 브라우저 기능입니다. `window.innerWidth >= 1280`과 거의 같지만, 세로 스크롤바 폭 처리까지 **CSS와 똑같이** 판단합니다. 그래서 화면 모양(CSS)과 JS의 판단이 1px 차이로 어긋나지 않습니다.

## 3. 코드
**import** (`studio.js` 맨 위)
```js
export const STUDIO_MIN_WIDTH = 1280;
```
`studio.js`는 다른 파일을 import하지 않습니다. 이 함수는 같은 파일의 상수 `STUDIO_MIN_WIDTH`를 씁니다.

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
| `` `(min-width: ${STUDIO_MIN_WIDTH}px)` `` | `'(min-width: ' + STUDIO_MIN_WIDTH + 'px)'` | 문자열 안에 값을 넣습니다 |
| `const f = () => 값` | `function f() { return 값; }` | 한 줄 함수입니다 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| (import 없음) | `window.matchMedia`는 브라우저에 원래 있습니다 |

| 식 | 뜻 | 예 |
|---|---|---|
| `window.matchMedia('(min-width: 1280px)')` | 그 조건의 검사기를 만듭니다 | |
| `.matches` | 지금 조건에 맞는지(true / false)입니다. **부를 때마다 새로** 검사합니다 | 창을 줄인 뒤 부르면 false입니다 |

## 4. 흐름
1. `'(min-width: 1280px)'` 조건을 만듭니다.
2. 지금 조건에 맞는지를 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `matchMedia`를 씀 (템플릿) | CSS 반응형 기준과 같은 방식이라서, 스크롤바와 확대 처리가 CSS와 같습니다 |
| 부를 때마다 검사 (값을 저장해 두지 않음) | 사용자가 창 크기를 바꿀 수 있습니다. 버튼을 누른 그 순간의 폭이 기준이 되어야 합니다 |
| CSS 픽셀 기준 | 고해상도 화면(DPR 2, 3)도 CSS 폭으로 판단합니다. 1280 CSS px이면 실제 픽셀이 2560이어도 같은 레이아웃입니다. 브라우저를 확대(Ctrl +)하면 CSS 폭이 줄어서 false가 될 수 있는데, 그만큼 화면이 실제로 좁아진 것이므로 그대로 따릅니다 |
| 1280은 상수 `STUDIO_MIN_WIDTH`로 둠 | 다른 곳(안내 문구, 시험)에서도 같은 숫자를 씁니다 |

## 6. 시험 (실제 myProject.html, 헤드리스 Chrome, 7개)
한 페이지를 열어 둔 채 **화면 폭만 바꿔 가며** 불렀습니다 (새로 열지 않았으므로, 부를 때마다 다시 검사한다는 것을 확인했습니다).

| 화면 폭 (DPR) | 결과 |
|---|---|
| 1920 (1) | `true` |
| 1280 (1) | `true`: 경계값을 포함합니다 |
| 1279 (1) | `false` |
| 1024 (1) | `false` |
| 390 (3, 휴대폰) | `false` |
| 1280 (2, 고해상도) | `true` |
| 1440 (1) | `true`: 다시 넓히면 다시 true가 됩니다 |

돌려준 값은 모두 `boolean`이었습니다.
