# JS 36 — `showDesktopOnly()` (core/studio.js)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/studio.js` |
| 작업 | P1-14 내 프로젝트 화면: 작은 화면 안내 모달 (PRD 01 FR-129) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [35 `canOpenStudio()`](35_studio_canOpenStudio.md) · [37 `openStudio()`](37_studio_openStudio.md) |

## 1. 하는 일
화면이 좁아서 시퀀서를 열 수 없을 때(35번이 false일 때) **"컴퓨터에서 여세요" 모달**(`#desktop-only-modal`, `static/partials/desktop-only-modal.html`)을 띄웁니다. 상황에 맞는 문장 하나만 보이게 하고, 제목을 채웁니다.

| 부른 값 | 보이는 문장 |
|---|---|
| `showDesktopOnly('created', 'Summer Loop')` | **Summer Loop** is saved. 작은 화면에서 프로젝트를 **만든 직후**에 씁니다 (39) |
| `showDesktopOnly('open', 'Summer Loop')` | **Summer Loop** opens in the studio, which needs a larger screen. Open이나 제목을 **눌렀을 때** 씁니다 (38) |
| 그 밖의 값 (`'xyz'`) | `open` 문장을 보여 줍니다 |

두 경우 모두 아래에 "Sign in on a computer and it'll be waiting at the top of your dashboard."와 Got it 버튼이 나옵니다.

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 39 `initNewProjectForm` | 작은 화면에서 만들기에 성공하면 `'created'`로 부릅니다 |
| 38 `initDesktopOnlyLinks` | 작은 화면에서 Open이나 제목을 누르면 `'open'`으로 부릅니다 (myProject, myPage) |

**`<dialog>`와 `showModal()`**: HTML의 기본 모달입니다. `showModal()`로 열면 뒤의 화면이 막히고, Esc로 닫힙니다. 이미 열린 모달에 다시 `showModal()`을 부르면 오류(`InvalidStateError`)가 나므로, `modal.open`을 먼저 확인합니다.

## 3. 코드
**import** (`studio.js` 맨 위)
```js
export const STUDIO_MIN_WIDTH = 1280;
```
`studio.js`에는 import가 없습니다. 이 함수는 브라우저의 기본 기능만 씁니다.

**함수**
```js
export function showDesktopOnly(variant, title) {
  const modal = document.getElementById('desktop-only-modal');
  if (!modal) return;
  if (variant !== 'created') variant = 'open';

  // 상황에 맞는 문단만 보이기
  const leads = modal.querySelectorAll('[data-variant]');
  for (let i = 0; i < leads.length; i++) {
    leads[i].hidden = leads[i].dataset.variant !== variant;
  }
  const name = document.getElementById('desktop-only-' + variant + '-name');
  if (name) name.textContent = title;

  if (!modal.open) modal.showModal();
}
```

**최신 문법으로 쓰면** (공부용)
```js
for (const lead of modal.querySelectorAll('[data-variant]')) lead.hidden = lead.dataset.variant !== variant;
document.getElementById(`desktop-only-${variant}-name`)?.replaceChildren(title);
modal.open || modal.showModal();
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `for (const x of 목록)` | `for (let i = 0; …; i++)` | 하나씩 처리합니다 |
| `el?.replaceChildren(title)` | `if (name) name.textContent = title` | 있을 때만 글자를 넣습니다 |
| `a \|\| b()` | `if (!a) b()` | a가 참이 아니면 b를 실행합니다 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| (import 없음) | |

| 식 | 뜻 | 예 |
|---|---|---|
| `modal.querySelectorAll('[data-variant]')` | 모달 안에서 `data-variant`가 있는 문단들을 찾습니다 | created와 open 두 개 |
| `leads[i].hidden = 조건` | 조건이 true면 숨깁니다 | 고른 것과 다르면 숨깁니다 |
| `'desktop-only-' + variant + '-name'` | 고른 문장 안에 있는 제목 칸의 id입니다 | `desktop-only-created-name` |
| `name.textContent = title` | 글자로만 넣습니다 | `Night <b>Drive</b>`가 그 글자 그대로 나옵니다 |
| `modal.open` | 지금 열려 있는지 확인합니다 | |

## 4. 흐름
1. 모달이 없으면 끝냅니다.
2. 모르는 값이면 `'open'`으로 바꿉니다.
3. 고른 문장만 보이게 합니다.
4. 제목을 넣습니다.
5. 모달이 닫혀 있으면 엽니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 문장 두 개를 HTML에 두고 숨기기만 함 | 글자는 HTML(화면 담당)이 정하고 JS는 고르기만 합니다. 문구를 고칠 때 JS를 건드리지 않아도 됩니다 (템플릿) |
| `textContent` | 제목은 사용자가 입력한 글자이므로 태그로 해석되지 않게 합니다 (31번과 같습니다) |
| 모르는 값은 `'open'`으로 처리 | 부르는 쪽이 잘못된 값을 넘겨도 모달이 빈 문장으로 뜨지 않게 합니다 |
| 이미 열려 있으면 다시 열지 않음 | `showModal()`을 두 번 부르면 오류가 납니다. 문장과 제목만 바뀝니다 |
| 모달이 없으면 조용히 끝냄 | 공통 조각(`includePartials`)이 아직 끼워지지 않은 페이지에서 불려도 오류가 나지 않게 합니다 |

## 6. 시험 (실제 myProject.html, 헤드리스 Chrome, 5개)
보이는지는 계산된 CSS로 확인했습니다.

| # | 한 일 | 결과 |
|---|---|---|
| 01 | `('created', 'Summer Loop')` | 모달이 열리고, created 문장만 보이며, 제목은 `Summer Loop`입니다 |
| 02 | 닫은 뒤 `('open', 'Night <b>Drive</b>')` | open 문장만 보이고, 제목은 글자 그대로입니다 (`<b>` 요소 0개) |
| 03 | 열린 채로 `('created', 'Second')` | 오류가 나지 않고, 문장이 created로 바뀌며, 제목은 `Second`입니다 |
| 04 | `('xyz', 'Fallback')` | open 문장이 나오고, 제목은 `Fallback`입니다 |
| 05 | Got it을 누름 | 모달이 닫힙니다 |

### 캡처: 만든 직후의 안내 (`created`)
![created](../../images/javascript_p1-14/36_01_created.png)
