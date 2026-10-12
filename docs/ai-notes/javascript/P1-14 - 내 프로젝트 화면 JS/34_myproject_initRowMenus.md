# JS 34 — `initRowMenus()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/myproject.js` |
| 작업 | P1-14 내 프로젝트 화면: 줄의 ··· 메뉴 (PRD 01 FR-124, FR-125) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [33 `initSearch()`](33_myproject_initSearch.md) · [35 `canOpenStudio()`](35_studio_canOpenStudio.md) |

## 1. 하는 일
목록 줄 오른쪽의 `···` 메뉴에서 누른 **Edit details나 Delete가 어느 프로젝트에 대한 것인지** 기억하고, 모달 칸을 채우고, 메뉴를 닫습니다. 모달을 여는 일은 HTML 버튼의 `command="show-modal"` 속성이 이미 합니다.

| 사용자가 한 일 | 결과 |
|---|---|
| `···` → Edit details | `selected`가 그 프로젝트가 되고, Edit 모달의 제목 칸과 설명 칸에 지금 값이 들어가며, 지난 오류 문구가 지워지고, 메뉴가 닫힙니다 |
| 설명이 없는 줄의 Edit details | 설명 칸은 **빈 칸**입니다 (화면 글자 `No description`이 들어가지 않습니다) |
| `···` → Delete | `selected`가 그 프로젝트가 되고, 메뉴가 닫힙니다 (확인창은 41번 `initDeleteProject`가 띄웁니다) |
| 메뉴를 연 채로 다른 줄의 `···` | 앞의 메뉴는 닫히고, 새 메뉴만 열립니다 |
| 메뉴 바깥을 누름 | 열린 메뉴가 닫힙니다 |
| 메뉴 안에서 Esc | 메뉴가 닫히고, 포커스는 `···` 버튼으로 돌아갑니다 |

**31번 `buildRow`에 두 줄 추가:** 줄에 `data-title`과 `data-description`을 넣습니다. 화면의 제목 글자에는 `Not opened`가, 설명 글자에는 `No description`이 섞여 있어서, 그대로 읽으면 수정 칸에 잘못된 값이 들어가기 때문입니다.

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 페이지 시작 (`myproject.js` 맨 아래, 이미 있음) | `initRowMenus();`로 한 번만 부릅니다 |
| `selected`를 읽는 곳 | 36번 `initEditProjectForm`(저장할 프로젝트 번호), 37번 `initDeleteProject`(지울 번호, 확인창 제목) |

**이벤트 위임(event delegation)**은 줄마다 버튼에 이벤트 처리를 거는 대신 **목록(`ul`) 하나에만** 걸고, 눌린 곳에서 `closest('[data-action]')`으로 버튼을 찾는 방법입니다. 검색이나 페이지 넘김으로 줄이 다시 그려져도 `ul`은 그대로이므로 다시 걸 필요가 없습니다.

## 3. 코드
**import** (`myproject.js` 맨 위: 30번과 같고, 이번에 추가한 것은 없습니다)
```js
import { initAuthState } from '../core/auth-ui.js';
import { requireLogin, logout, loginUrl } from '../core/auth.js';
import { api } from '../core/api.js';
import { initModalFallback } from '../core/modal.js';
import { canOpenStudio, showDesktopOnly, initDesktopOnlyLinks, openStudio } from '../core/studio.js';
import { includePartials } from '../core/include.js';
import { initFormAlerts } from '../core/dialog.js';
```
이 함수는 import를 쓰지 않습니다.

**상수** (이번에 추가)
```js
/** ··· 메뉴에서 고른 프로젝트 — Edit details · Delete 가 어느 프로젝트인지 (34 가 채움, 36 · 37 이 읽음) */
export const selected = { id: null, title: '', description: '' };
```

**함수**
```js
export function initRowMenus() {
  const list = document.getElementById('project-list');
  if (!list) return;

  // ··· 메뉴 안 버튼 — 목록에 하나만 걸어 둠 (줄을 다시 그려도 동작)
  list.addEventListener('click', function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const row = button.closest('li[data-project-id]');
    selected.id = Number(row.dataset.projectId);
    selected.title = row.dataset.title;
    selected.description = row.dataset.description;

    if (button.dataset.action === 'edit') {
      const title = document.getElementById('edit-title');
      const description = document.getElementById('edit-description');
      const error = document.getElementById('edit-project-error');
      if (title) title.value = selected.title;
      if (description) description.value = selected.description;
      if (error) { error.hidden = true; error.textContent = ''; }   // 지난번 실패 문구 지우기
    }
    const menu = button.closest('details');
    if (menu) menu.open = false;
  });

  // 메뉴 바깥을 누르면 열린 메뉴 닫기 (다른 줄의 ··· 를 눌러도 앞 메뉴는 닫힘)
  document.addEventListener('click', function (event) {
    const menus = document.querySelectorAll('.pj-menu[open]');
    for (let i = 0; i < menus.length; i++) {
      if (!menus[i].contains(event.target)) menus[i].open = false;
    }
  });

  // Esc → 열린 메뉴 닫고, 메뉴 안에 있던 포커스는 ··· 버튼으로 돌려줌
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    const menus = document.querySelectorAll('.pj-menu[open]');
    for (let i = 0; i < menus.length; i++) {
      const hadFocus = menus[i].contains(document.activeElement);
      menus[i].open = false;
      if (hadFocus) menus[i].querySelector('summary').focus();
    }
  });
}
```

**31번 `buildRow`에 추가한 줄**
```js
  row.dataset.title = item.title;                                        // 34 가 수정 칸을 채울 때 씀
  row.dataset.description = item.description ? item.description : '';
```

**최신 문법으로 쓰면** (공부용이며, 바뀌는 부분만 적었습니다)
```js
for (const menu of document.querySelectorAll('.pj-menu[open]')) {
  if (!menu.contains(event.target)) menu.open = false;
}
row.dataset.description = item.description ?? '';
error?.setAttribute('hidden', '');
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `for (const x of 목록)` | `for (let i = 0; i < 목록.length; i++)` | 하나씩 돌면서 처리합니다 |
| `a ?? ''` | `a ? a : ''` | 없으면 빈 문자열을 씁니다 |
| `error?.…` | `if (error) …` | 있을 때만 처리합니다 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| (이 함수는 import 없음) | |

| 식 | 뜻 | 예 |
|---|---|---|
| `event.target.closest('[data-action]')` | 누른 곳에서 위로 올라가며 `data-action`이 있는 요소를 찾습니다 | 버튼 안의 글자를 눌러도 버튼을 찾습니다 |
| `row.dataset.projectId` | `data-project-id` 속성 값(문자열)이며, `Number(…)`로 숫자로 바꿉니다 | `'1801'` → 1801 |
| `details.open = false` | `<details>` 메뉴를 닫습니다 (`open` 속성 제거) | |
| `document.querySelectorAll('.pj-menu[open]')` | 열려 있는 메뉴들만 고릅니다 | |
| `menus[i].contains(event.target)` | 누른 곳이 그 메뉴 안인지 확인합니다 | 바깥이면 닫습니다 |
| `document.activeElement` | 지금 포커스가 있는 요소입니다 | Esc를 누르기 전의 `Edit details` 버튼 |

## 4. 흐름
1. **목록을 클릭하면:** 버튼을 찾고, 그 줄의 번호, 제목, 설명을 `selected`에 넣습니다. Edit이면 수정 칸을 채우고 오류를 지우며, Delete면 삭제 모달의 제목을 정합니다. 그리고 메뉴를 닫습니다.
2. **문서를 클릭하면:** 열린 메뉴 중에서 누른 곳을 품지 않은 메뉴를 닫습니다.
3. **Esc를 누르면:** 열린 메뉴를 닫고, 포커스가 메뉴 안에 있었다면 `···`로 옮깁니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 목록 하나에만 이벤트를 검 (위임) | 줄은 검색하거나 페이지를 넘길 때마다 다시 그려집니다. 줄마다 걸면 다시 그릴 때마다 다시 걸어야 합니다 (템플릿) |
| `data-title`과 `data-description`에서 읽음 | 화면 글자에서 읽으면 `Neon Rain Not opened`나 `No description`이 수정 칸에 들어갑니다 |
| `selected`를 밖으로 내보냄 | 저장(36)과 삭제(37)는 다른 함수이므로, 어느 프로젝트인지 넘겨받을 곳이 필요합니다 |
| 지난 오류 문구를 지움 | 앞의 프로젝트를 저장하다 실패한 문구가 다른 프로젝트의 모달에 남지 않게 합니다 |
| 바깥 클릭과 Esc로 닫음 | `<details>`는 다시 눌러야만 닫힙니다. 일반 메뉴처럼 동작하게 했습니다 (템플릿) |
| Esc 뒤에 포커스를 `···`로 옮김 | 키보드 사용자가 메뉴 안의 버튼에 있다가 메뉴가 닫히면 포커스가 사라지기 때문입니다 |
| (41에서 바꿈) Delete 모달 제목 채우기를 지움 | 41번이 HTML 삭제 모달을 `confirmDialog`로 바꾸면서 모달이 없어졌습니다. 처음에는 여기서 `#delete-project-name`을 채웠습니다 |

**참고:** 모달은 버튼의 `command` 속성으로 열립니다 (최신 Chrome과 Edge가 지원합니다). 지원하지 않는 브라우저를 위한 `initModalFallback`(`core/modal.js`)은 아직 템플릿 상태이며, 이 작업의 범위 밖입니다.

## 6. 시험 (실제 myProject.html, 실제 서버, 7개)
프로젝트 `Plain`과 `Neon "Rain" <x>`(설명 `old desc`)를 만들고, 페이지 안에서 버튼을 눌렀습니다.

| # | 한 일 | 결과 |
|---|---|---|
| 01 | 첫 줄의 `···` → Edit details | 메뉴가 열렸다가 닫히고, Edit 모달이 열리며, 제목은 `Neon "Rain" <x>`, 설명은 `old desc`이고, `selected.id`가 맞습니다 |
| 02 | (오류 문구를 띄워 둔 채로) 설명이 없는 줄의 Edit | 설명 칸은 빈 칸이고, 오류는 숨겨지며 글자도 지워집니다 |
| 03 | 첫 줄의 Delete | (41 이후 다시 시험) 확인창 `Delete project?`가 뜨고, 제목 글자는 그대로이며, `selected`가 맞고, 메뉴가 닫힙니다 |
| 04 | 첫 메뉴를 연 채로 둘째 줄의 `···` | 첫째는 닫히고 둘째가 열립니다 |
| 05 | 페이지 제목을 누름 | 둘 다 닫힙니다 |
| 06 | 메뉴 안의 `Edit details`에 포커스를 두고 Esc | 메뉴가 닫히고, 포커스가 `···`로 갑니다 |
| 07 | 이름순으로 다시 그린 뒤 Edit | 그대로 동작합니다 |

### 캡처: Edit 모달에 채워진 값
![Edit](../../images/javascript_p1-14/34_01_edit.png)
