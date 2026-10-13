# JS 37 — `openStudio()` (+ `openBlankStudio`) (core/studio.js)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/studio.js` |
| 작업 | P1-14 내 프로젝트 화면: 시퀀서를 별도 창으로 열기 (PRD 01 FR-126, PRD 02 FR-258, 2026-10-05 결정) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [36 `showDesktopOnly()`](36_studio_showDesktopOnly.md) · [38 `initDesktopOnlyLinks()`](38_studio_initDesktopOnlyLinks.md) |

## 1. 하는 일
시퀀서(`studioNx.html?projectId=번호`)를 **별도의 브라우저 창**으로 엽니다. 프로젝트 목록 창을 닫아도 작업 창은 남게 하려는 결정(2026-10-05)에 따른 것입니다.

| 부른 값 | 결과 |
|---|---|
| `openStudio(5)` | 화면 크기의 창 `studio-5`에 `studioNx.html?projectId=5`를 엽니다 |
| 같은 프로젝트로 또 `openStudio(5)` | **새 창을 열지 않고**, 이미 열린 `studio-5` 창을 앞으로 가져옵니다 |
| `openStudio(7, { isNew: true })` | `…?projectId=7&new=1`이 되어 로딩 화면이 "새 프로젝트" 모드로 나옵니다 |
| `openStudio(9, { win: 빈창 })` | 미리 열어 둔 빈 창의 주소를 `…?projectId=9`로, 이름을 `studio-9`로 바꿉니다 |
| 팝업이 막힘 (`window.open`이 null) | **지금 탭**에서 시퀀서로 이동합니다 |

**함께 만든 것: `openBlankStudio()`.** 새 프로젝트(39)는 서버가 번호를 돌려줘야 주소를 알 수 있습니다. 그런데 브라우저는 **클릭한 바로 그 순간**(사용자 동작 안)에만 새 창을 허락하므로, 응답을 기다린 뒤에 열면 팝업으로 막힙니다. 그래서 클릭할 때 빈 창을 먼저 열고(`openBlankStudio`), 응답이 오면 `openStudio(id, { win })`로 주소를 넣습니다.

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 38 `initDesktopOnlyLinks` | 넓은 화면에서 Open이나 제목을 누르면 `openStudio(id)`를 부릅니다 (myProject, myPage) |
| 39 `initNewProjectForm` | Create를 누르면 `openBlankStudio()`를 부르고, 응답 뒤에 `openStudio(id, { isNew: true, win })`를 부릅니다. 실패하면 빈 창을 닫습니다 |

**팝업 차단과 사용자 동작(user activation)**: 브라우저는 클릭이나 키 입력 직후의 짧은 동안에만 `window.open`을 허락합니다. 한 번 허락받아 창을 열면 그 허락은 **이미 쓴 것**이 되므로, 같은 클릭으로 창을 또 열면 막힙니다 (시험 05에서 확인).

**창 이름**: `window.open(주소, 이름)`에서 같은 이름의 창이 이미 있으면 새로 만들지 않고 그 창을 씁니다. 프로젝트마다 `studio-번호`라는 이름을 붙여서, 같은 프로젝트가 창 두 개로 열리지 않게 합니다 (협업과 저장 충돌 방지).

## 3. 코드
**import** (`studio.js` 맨 위)
```js
export const STUDIO_MIN_WIDTH = 1280;
```
`studio.js`에는 import가 없습니다. 이 함수는 같은 파일의 `STUDIO_WINDOW_PREFIX`(`'studio-'`)를 씁니다.

**함수** (`openBlankStudio`와 창 옵션 `studioWindowFeatures` 포함)
```js
export function openStudio(projectId, options = {}) {
  let url = 'studioNx.html?projectId=' + encodeURIComponent(projectId);
  if (options.isNew) url += '&new=1';
  const name = STUDIO_WINDOW_PREFIX + projectId;

  // 미리 열어 둔 빈 창이 있으면 그 창에서 (새 프로젝트 — 응답을 기다린 뒤라 새로 열면 팝업으로 막힘)
  let win = options.win;
  if (win && !win.closed) {
    win.name = name;            // 다음에 같은 프로젝트를 누르면 이 창이 앞으로 오게
    win.location.href = url;
  } else {
    win = window.open(url, name, studioWindowFeatures());
  }

  if (!win) {
    location.href = url;        // 팝업이 막힘 → 같은 탭에서 열기
    return null;
  }
  win.focus();
  return win;
}

/**
 * 시퀀서용 빈 창을 먼저 열기 — 클릭 처리 안에서 **await 전에** 부를 것 (39 새 프로젝트)
 * 응답이 오면 openStudio(id, { win }) 로 주소를 넣고, 실패하면 win.close()
 * (구현: AI — 2026-10-08, 37 과 함께)
 * @returns {Window|null}  팝업이 막혔으면 null
 */
export function openBlankStudio() {
  return window.open('', '', studioWindowFeatures());
}

/** 창 옵션 — 'popup' 이 있어야 탭이 아니라 별도 창, 크기는 화면에 맞춤 */
function studioWindowFeatures() {
  return 'popup,width=' + screen.availWidth + ',height=' + screen.availHeight + ',left=0,top=0';
}
```

**최신 문법으로 쓰면** (공부용이며, 바뀌는 부분만 적었습니다)
```js
export function openStudio(projectId, { isNew = false, win = null } = {}) {
  const url = `studioNx.html?projectId=${encodeURIComponent(projectId)}${isNew ? '&new=1' : ''}`;
  …
  win?.focus();
}
const studioWindowFeatures = () => `popup,width=${screen.availWidth},height=${screen.availHeight},left=0,top=0`;
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `{ isNew = false, win = null } = {}` (구조 분해 매개변수) | `options = {}` + `options.isNew`, `options.win` | 객체에서 칸을 꺼냅니다 |
| 템플릿 문자열 | `'…' + 값 + '…'` | 문자열을 잇습니다 |
| `win?.focus()` | `if (win) win.focus()` | 있을 때만 실행합니다 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| (import 없음) | `window.open`과 `screen`은 브라우저에 원래 있습니다 |

| 식 | 뜻 | 예 |
|---|---|---|
| `encodeURIComponent(projectId)` | 주소에 넣어도 안전한 글자로 바꿉니다 | 숫자는 그대로입니다 |
| `window.open(url, name, features)` | 새 창(또는 같은 이름의 창)을 열고 그 창 객체를 돌려줍니다. 막히면 `null`입니다 | |
| `'popup,width=…,height=…,left=0,top=0'` | `popup`이 있으면 탭이 아니라 **별도의 창**으로 엽니다 | |
| `screen.availWidth`, `availHeight` | 작업 표시줄을 뺀 화면 크기입니다 | 1920 × 1040 |
| `win.closed` | 사용자가 그 창을 닫았는지 확인합니다 | |
| `win.name = name` | 빈 창에 나중에 이름을 붙입니다 (같은 사이트의 창이라서 가능합니다) | `''` → `'studio-9'` |
| `win.location.href = url` | 그 창의 주소를 바꿉니다 | |
| `location.href = url` | **지금 탭**의 주소를 바꿉니다 | 팝업이 막혔을 때 |

## 4. 흐름
1. 주소(`studioNx.html?projectId=…`, 새 프로젝트면 `&new=1`을 더함)와 창 이름(`studio-…`)을 만듭니다.
2. 미리 열어 둔 빈 창이 있고 아직 열려 있으면 그 창에 이름과 주소를 넣습니다. 없으면 `window.open`으로 엽니다.
3. 창을 열지 못했으면(막힘) 지금 탭에서 열고 `null`을 돌려줍니다. 열었으면 그 창을 앞으로 가져오고 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 별도 창 (`popup`) | 목록 창을 닫아도 작업 창이 남게 합니다 (2026-10-05 결정, PRD 02 FR-258). 새 탭이면 같은 창에 속하므로 함께 닫힙니다 |
| 창 이름 `studio-번호` | 같은 프로젝트를 다시 누르면 창이 하나 더 생기지 않고, 그 창이 앞으로 옵니다 (시험 02) |
| 빈 창을 먼저 엶 (`openBlankStudio`) | 새 프로젝트는 응답을 기다려야 번호를 알 수 있습니다. 기다린 뒤에 열면 팝업이 차단됩니다 (템플릿 설명 그대로) |
| 빈 창에 나중에 이름을 붙임 | 열 때는 번호를 몰라서 이름이 없습니다. 주소를 넣을 때 `studio-번호`로 붙여서, 다음 클릭에서 같은 창을 찾을 수 있게 합니다 |
| 사용자가 빈 창을 닫았으면 새로 시도 | 닫힌 창에는 주소를 넣을 수 없습니다. 다만 클릭 허락은 빈 창이 이미 썼으므로 보통 막히고, 그러면 아래 줄의 같은 탭 열기로 이어집니다 (시험 05) |
| 막히면 같은 탭에서 엶 | 팝업을 막아 둔 사용자도 시퀀서에는 들어갈 수 있게 합니다 (템플릿) |
| 창 크기 = 화면 크기 | 시퀀서는 넓을수록 좋고, 1280 이상의 화면에서만 열립니다 (35) |

## 6. 시험 (실제 myProject.html, 헤드리스 Chrome, 6개)
CDP로 "사용자가 누른 것"처럼 실행했고(`userGesture`), 열린 창은 Chrome의 창 목록으로도 확인했습니다.

| # | 한 일 | 결과 |
|---|---|---|
| 01 | `openStudio(5)` | `window.open('studioNx.html?projectId=5', 'studio-5', 'popup,width=800,height=600,left=0,top=0')`(시험 화면 800×600)으로 창이 열리고, 이름은 `studio-5`이며, 창 목록에 추가됩니다 |
| 02 | 다시 `openStudio(5)` | **같은 창 객체**를 돌려주고, 창 수는 그대로입니다 |
| 03 | `openStudio(7, { isNew: true })` | `?projectId=7&new=1`, `studio-7` |
| 04 | `openBlankStudio()` → 0.5초 기다림(응답 흉내) → `openStudio(9, { isNew: true, win })` | 빈 창(`about:blank`, 이름 없음)이 **같은 창 그대로** `?projectId=9&new=1`, `studio-9`가 됩니다 |
| 05 | 빈 창을 열고 바로 닫은 뒤 `openStudio(11, { win })` | 클릭 허락을 빈 창이 이미 썼으므로 새 창은 막히고, **지금 탭**이 `studioNx.html?projectId=11`로 이동합니다 (막힘 대비가 동작했습니다) |
| 06 | `window.open`이 null을 돌려주게 하고 `openStudio(3)` | `null`을 돌려주고, 지금 탭이 `studioNx.html?projectId=3`으로 이동합니다 |

처음에는 05에서 "새 창이 열린다"고 예상했지만, 실제로는 허락이 이미 쓰여서 막히고 같은 탭으로 열렸습니다. 코드는 그대로 두고(막히면 같은 탭에서 여는 것이 의도한 대비입니다), 설명을 실제 동작에 맞췄습니다.
