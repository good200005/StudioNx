# JS 41 — `initDeleteProject()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/myproject.js`, `studionx/frontend/myProject.html` |
| 작업 | P1-14 내 프로젝트 화면: 프로젝트 삭제 (PRD 01 FR-125, FIX-01 확인창, 2026-10-07 결정) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [40 `initEditProjectForm()`](40_myproject_initEditProjectForm.md) · [42 `loadInitialList()`](42_myproject_loadInitialList.md) |

## 1. 하는 일
`···` → **Delete**를 누르면 확인창(`confirmDialog`, FIX-01 20)을 띄우고, **Delete project**를 고르면 `DELETE /projects/{id}`(P1-13 61, 소프트 삭제)를 보낸 뒤 목록을 다시 받습니다.

| 상황 | 결과 |
|---|---|
| Delete → 확인창 | 제목 `Delete project?`, 문장 `“P03” will be removed from your projects. Collaborators will lose access too.`, 빨간 `Delete project` 버튼이 나옵니다 (처음 커서는 Cancel에 있습니다) |
| Cancel, Esc, 바깥 클릭 | 아무 일도 일어나지 않습니다 |
| Delete project | 삭제한 뒤 같은 검색, 정렬, 페이지로 다시 받습니다 (`12 projects` → `11 projects`) |
| 2쪽의 마지막 한 줄을 지움 | 빈 2쪽을 그리지 않고 **1쪽으로** 갑니다 |
| OWNER가 아님 | Delete 버튼이 잠겨 있으므로(31) 확인창도 뜨지 않습니다 |
| 서버 오류 | 알림창 `Couldn’t delete`와 서버 문구를 보여 주고, 버튼을 다시 켭니다 |
| 그사이 다른 곳에서 지워짐 (404) | 알림창 `Project not found.`를 보여 주고 목록을 다시 받습니다 |

**HTML도 바꿨습니다 (2026-10-07 결정대로):** `#delete-project-modal` `<dialog>`를 지우고, 목록 줄과 틀(`<template>`)의 Delete 버튼 7곳에서 `command="show-modal" commandfor="delete-project-modal"`을 뺐습니다. **34번 `initRowMenus`에서도** 삭제 모달의 제목을 채우던 세 줄을 지웠습니다 (모달이 없어졌기 때문입니다).

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 페이지 시작 (`myproject.js` 맨 아래, 이미 있음) | `initDeleteProject();`로 목록에 한 번 겁니다 |

**확인창(`confirmDialog`)**은 브라우저 기본 `confirm()` 대신 쓰는 SweetAlert2 창입니다 (FIX-01 20). `await confirmDialog({...})`는 확인이면 `true`, 취소나 Esc나 바깥 클릭이면 `false`를 돌려줍니다. `danger: true`이면 확인 버튼이 빨강이고 처음 커서가 **Cancel**에 있으므로, Enter를 바로 눌러도 지워지지 않습니다.

## 3. 코드
**import** (`myproject.js` 맨 위)
```js
import { initAuthState } from '../core/auth-ui.js';
import { requireLogin, logout, loginUrl } from '../core/auth.js';
import { api } from '../core/api.js';
import { initModalFallback } from '../core/modal.js';
import { canOpenStudio, showDesktopOnly, initDesktopOnlyLinks, openStudio, openBlankStudio } from '../core/studio.js';
import { includePartials } from '../core/include.js';
import { initFormAlerts, confirmDialog, showAlert } from '../core/dialog.js';
```
**`confirmDialog`와 `showAlert`를 이번에 추가했습니다.** 이 함수는 `api`, `confirmDialog`, `showAlert`와 같은 파일의 `current`, `loadProjects`, `renderProjects`, `renderPager`, `refreshList`를 씁니다.

**함수**
```js
export function initDeleteProject() {
  const list = document.getElementById('project-list');
  if (!list) return;

  list.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-action="delete"]');
    if (!button || button.disabled) return;
    const row = button.closest('li[data-project-id]');
    const id = row.dataset.projectId;
    const title = row.dataset.title;

    const ok = await confirmDialog({
      title: 'Delete project?',
      text: '“' + title + '” will be removed from your projects. Collaborators will lose access too.',
      confirmText: 'Delete project',
      danger: true,
    });
    if (!ok) return;

    button.disabled = true;   // 두 번 누름 방지 (성공하면 줄이 다시 그려짐)
    try {
      await api.delete('/projects/' + id);
    } catch (err) {
      button.disabled = false;
      await showAlert('Couldn’t delete', err.message, { tone: 'error' });
      if (err.status === 404) refreshList({ query: current.query, sort: current.sort, page: current.page });
      return;
    }

    // 같은 조건으로 다시 받기 — 마지막 줄을 지워 그 페이지가 비면 (빈 화면을 그리지 않고) 한 페이지 앞으로
    const page = current.page;
    const data = await loadProjects({ query: current.query, sort: current.sort, page: page });
    if (!data) return;
    if (data.items.length === 0 && page > 1) {
      refreshList({ query: current.query, sort: current.sort, page: page - 1 });
      return;
    }
    renderProjects(data);
    renderPager(data.total, data.page, data.size);
  });
}
```

**최신 문법으로 쓰면** (공부용이며, 바뀌는 부분만 적었습니다)
```js
const { projectId: id, title } = row.dataset;
text: `“${title}” will be removed from your projects. Collaborators will lose access too.`,
const { query, sort, page } = current;
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `const { projectId: id, title } = row.dataset` | `const id = row.dataset.projectId` 등 두 줄 | 칸을 꺼내면서 이름을 바꿉니다 |
| 템플릿 문자열 | `'“' + title + '” will …'` | 문자열을 잇습니다 |
| `const { query, sort, page } = current` | `current.query` 등을 그대로 씀 | 칸을 꺼냅니다 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `import { …, confirmDialog, showAlert } from '../core/dialog.js'` | 확인창(true/false)과 알림창입니다 (FIX-01 20, 18) |

| 식 | 뜻 | 예 |
|---|---|---|
| `event.target.closest('[data-action="delete"]')` | 누른 곳에서 Delete 버튼을 찾습니다 (목록 하나에 위임, 34번과 같습니다) | |
| `button.disabled` | 잠긴 버튼입니다. 브라우저는 잠긴 버튼의 클릭을 보내지 않지만 한 번 더 확인합니다 | EDITOR |
| `const ok = await confirmDialog({…})` | 사용자가 고를 때까지 기다립니다 | true / false |
| `api.delete('/projects/' + id)` | DELETE 요청입니다. 성공하면 204(본문 없음, `null`)입니다 | |
| `data.items.length === 0 && page > 1` | 지운 뒤 그 쪽이 비었고, 1쪽이 아닌 경우입니다 | 2쪽의 마지막 한 줄 |

## 4. 흐름
1. Delete 버튼이 아니거나 잠겨 있으면 끝냅니다. 맞으면 그 줄의 번호와 제목을 읽습니다.
2. 확인창을 띄우고, 취소하면 끝냅니다.
3. 버튼을 잠그고 `DELETE`를 보냅니다.
4. 실패하면 버튼을 풀고 알림창을 띄우며, 404이면 목록을 다시 받습니다.
5. 성공하면 같은 조건으로 목록을 받습니다. 그 쪽이 비었고 1쪽이 아니면 앞 쪽으로 가고, 아니면 그대로 그립니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| HTML 모달 대신 `confirmDialog` | 2026-10-07 결정(FIX-01)입니다. 모든 확인창을 같은 모양으로 맞추고, 휴대폰에서는 아래쪽 시트로 보여 줍니다 |
| 번호와 제목을 **누른 줄**에서 바로 읽음 | 34번의 `selected`는 다른 이벤트 처리가 먼저 불려야 채워집니다. 이벤트 처리 순서에 기대지 않으려는 것입니다 |
| 처음 커서는 Cancel에 둠 (`danger`) | 되돌리기 어려운 일이므로, Enter 한 번에 지워지지 않게 합니다 |
| 실패는 알림창으로 보여 줌 | 모달이 없어졌으므로 문구 칸(`#delete-project-error`)도 없습니다 |
| 빈 쪽을 **그리지 않고** 앞 쪽으로 감 | 처음에는 `refreshList`로 빈 2쪽을 그린 뒤 1쪽으로 갔는데, 그사이 "No projects yet"이 잠깐 보였습니다. 받은 결과를 먼저 보고 결정하도록 고쳤습니다 (시험 03에서 빈 안내가 한 번도 보이지 않았음을 확인했습니다) |
| 404이면 목록을 다시 받음 | 지워진 줄이 남지 않게 합니다 (40번과 같습니다) |
| 누른 뒤에는 버튼을 잠금 | 확인한 뒤 응답이 오기 전에 두 번 눌리는 것을 막습니다 (템플릿) |

## 6. 시험 (실제 myProject.html, 실제 서버, 7개 + 34번 다시)
프로젝트 12개(`P01`~`P12`)를 이름순으로 그리고 `···` → Delete를 눌렀습니다.

| # | 한 일 | 결과 |
|---|---|---|
| 01 | P03에서 Delete | 확인창의 제목, 문장, 버튼 글자가 맞습니다 |
| 01b | Cancel | DELETE는 0번이고, 12개가 그대로이며, 창이 닫힙니다 |
| 02 | 다시 Delete → Delete project | DELETE가 1번 가고, `11 projects`가 되며, P03이 사라지고 P11이 올라옵니다. 서버에서 검색해도 0개입니다 |
| 03 | 2쪽(P12 한 줄)에서 P12 삭제 | 1쪽 10개가 나오고, 주소는 `?sort=title`이며, 페이지 줄은 숨겨집니다. **빈 안내는 한 번도 보이지 않았습니다** |
| 04 | EDITOR 줄(가짜)의 Delete | 확인창이 뜨지 않고, DELETE는 0번입니다 |
| 05 | 서버 500 (가짜) | 알림창 `Couldn’t delete`와 `Something went wrong. Please try again.`이 나오고, 버튼이 다시 켜지며, 목록은 그대로입니다 |
| 06 | 확인창을 띄운 채 다른 곳에서 P02를 지운 뒤 Delete project | 알림창 `Project not found.`가 나오고, 목록을 다시 받아서 P02가 사라집니다 |

**34번 다시:** 삭제 모달이 없어졌으므로 34번의 시험 03을 "Delete를 누르면 확인창이 뜨고 `selected`가 그 프로젝트"로 바꿔서 7개를 다시 돌렸습니다. 모두 통과했습니다 (제목 `Neon "Rain" <x>`도 확인창에 글자 그대로 나왔습니다).

### 캡처
확인창:

![confirm](../../images/javascript_p1-14/41_01_confirm.png)

서버 오류:

![error](../../images/javascript_p1-14/41_05_error.png)
