# JS 40 — `initEditProjectForm()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/myproject.js` |
| 작업 | P1-14 내 프로젝트 화면 — 제목 · 설명 수정 · PRD 01 FR-124 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [39 `initNewProjectForm()`](39_myproject_initNewProjectForm.md) · [41 `initDeleteProject()`](41_myproject_initDeleteProject.md) |

## 1. 하는 일
Edit details 모달의 **Save** 를 누르면 `PATCH /projects/{id}`(P1-13 60)로 제목 · 설명을 저장하고, 성공하면 **그 줄만** 새 값으로 다시 그린다.

| 상황 | 결과 |
|---|---|
| 제목 `'  Beta v2 '` · 설명 `new` | 모달 닫힘 · 그 줄이 `Beta v2 · new` 로 (자리 그대로) · 다른 줄은 그대로 |
| 설명을 비우거나 공백만 | 설명 지움 → 줄에 `No description` · 서버 값 `null` |
| 제목 공백 | 보내지 않고 `Enter a title.` |
| 그사이 다른 창에서 지워진 프로젝트 | `Project not found.` + 목록을 다시 받아 그 줄이 사라짐 |
| VIEWER (31 에서 Edit 이 잠겨 있지만 혹시 보내면) | 서버 문구 `You don't have permission.` |
| 서버 오류 | 모달 안에 문구 · 입력값 그대로 · 버튼 풀림 |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 페이지 시작 (`myproject.js` 맨 아래, 이미 있음) | `initEditProjectForm();` |
| 함께 쓰는 것 | 34 `initRowMenus` 가 `selected` 와 칸 값을 채우고 모달을 엶 → 이 함수는 저장만 |

## 3. 코드
**import** (`myproject.js` 맨 위 — 39 와 같음, 이번에 추가한 것 없음)
```js
import { initAuthState } from '../core/auth-ui.js';
import { requireLogin, logout, loginUrl } from '../core/auth.js';
import { api } from '../core/api.js';
import { initModalFallback } from '../core/modal.js';
import { canOpenStudio, showDesktopOnly, initDesktopOnlyLinks, openStudio, openBlankStudio } from '../core/studio.js';
import { includePartials } from '../core/include.js';
import { initFormAlerts } from '../core/dialog.js';
```
이 함수는 `api`(P1-02) 와 같은 파일의 `selected`(34) · `current`(30) · `buildRow`(31) · `refreshList`(33) 를 쓴다.

**함수**
```js
export function initEditProjectForm() {
  const form = document.getElementById('edit-project-form');
  if (!form) return;
  const modal = document.getElementById('edit-project-modal');
  const error = document.getElementById('edit-project-error');
  const submit = form.querySelector('[type="submit"]');
  const showError = function (message) {
    error.textContent = message;
    error.hidden = false;
  };

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (selected.id === null) return;
    const title = document.getElementById('edit-title').value.trim();
    const description = document.getElementById('edit-description').value.trim();
    error.hidden = true;
    if (!title) {
      showError('Enter a title.');
      return;
    }

    submit.disabled = true;
    let item;
    try {
      item = await api.patch('/projects/' + selected.id, {
        title: title,
        description: description ? description : null,   // 비우면 설명 지우기
      });
    } catch (err) {
      showError(err.message);
      if (err.status === 404) refreshList({ query: current.query, sort: current.sort, page: current.page });
      return;
    } finally {
      submit.disabled = false;
    }

    if (modal && modal.open) modal.close();
    selected.title = item.title;
    selected.description = item.description ? item.description : '';
    const row = document.querySelector('#project-list > li[data-project-id="' + item.project_id + '"]');
    const template = document.getElementById('project-row-template');
    if (row && template) row.replaceWith(buildRow(template, item));
  });
}
```

**최신 문법으로 쓰면** (공부용 — 바뀌는 부분만)
```js
item = await api.patch(`/projects/${selected.id}`, { title, description: description || null });
selected.description = item.description ?? '';
document.querySelector(`#project-list > li[data-project-id="${item.project_id}"]`)?.replaceWith(buildRow(template, item));
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| 템플릿 문자열 | `'/projects/' + selected.id` | 글자 잇기 |
| `a ?? ''` | `a ? a : ''` | 없으면 빈 글자 |
| `el?.replaceWith(…)` | `if (row && template) row.replaceWith(…)` | 있을 때만 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| (새 import 없음) | `api.patch(주소, 본문)` — PATCH 요청, 토큰 자동 (P1-02) |

| 식 | 뜻 | 예 |
|---|---|---|
| `description ? description : null` | 빈 글자면 null — 서버가 설명을 지움 (P1-13 56 에서 `""` 도 None 이지만 뜻을 분명히) | |
| `'li[data-project-id="' + id + '"]'` | 그 번호의 줄 찾기 | |
| `row.replaceWith(새 요소)` | 그 자리에 새 줄을 끼우고 옛 줄은 뺌 | 순서 · 다른 줄은 그대로 |
| `err.status === 404` | 프로젝트가 없음 (지워졌거나 권한 잃음, P1-13 57) | |

## 4. 흐름
1. 기본 보내기 막기 → 고른 프로젝트가 없으면 끝 → 제목 공백이면 문구.
2. 버튼 잠금 → `PATCH /projects/{id}` `{ title, description }`.
3. 실패: 문구 · 404 면 목록 다시 받기 · 버튼 풀기.
4. 성공: 모달 닫기 → `selected` 를 새 값으로 → 그 줄을 `buildRow` 로 다시 만들어 바꿔 끼움.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 그 줄만 다시 그림 | 템플릿 · 목록 전체를 다시 받지 않아도 응답(`ProjectItem`)에 줄에 필요한 값이 모두 있음 (P1-13 62) |
| 자리를 옮기지 않음 | 최근 수정순이면 원래 맨 위로 가야 하지만, 고친 줄이 눈앞에서 사라지면 사용자가 결과를 확인하기 어려움 → 다음 새로고침 · 검색 때 올라감 |
| `buildRow` 를 다시 씀 | `Not opened` · 역할 · 잠금 등 줄 규칙이 31 과 똑같이 적용됨 (`data-title` 도 새 값 → 다음 Edit 에 새 값이 채워짐, 시험 02) |
| 공백 제목은 보내지 않음 | 39 와 같은 이유 |
| 404 면 목록 다시 받기 | 지워진 프로젝트 줄이 남아 있으면 또 누르게 됨 |
| 설명은 비우면 `null` | 수정 칸을 비우는 것 = 설명 지우기 (P1-13 60 의 표와 같음) |

## 6. 시험 (실제 myProject.html · 실제 서버 · 5개)
프로젝트 `Alpha`(설명 `a desc`) · `Beta` 를 만들고, ··· → Edit details 로 모달을 연 뒤 저장했다.

| # | 한 일 | 결과 |
|---|---|---|
| 01 | Beta → `'  Beta v2 '` · `new` | 모달 닫힘 · 줄 `Beta v2 · new` (첫 줄 그대로) · `Alpha` 줄 그대로 · 서버 `Beta v2` · `new` · PATCH 1번 |
| 02 | 다시 Edit → 설명 공백 | 모달에 새 값(`Beta v2` · `new`)이 채워져 있음 · 저장 뒤 `No description` · 서버 `null` |
| 03 | Alpha 제목 공백 | `Enter a title.` · PATCH 0번 · 모달 그대로 |
| 04 | Edit 을 연 뒤 다른 곳에서 Alpha 를 지우고 저장 | `Project not found.` · 목록을 다시 받아 Alpha 줄 사라짐 |
| 05 | 서버 500 (가짜) | 문구 · 모달 그대로 · 버튼 풀림 |

### 캡처 — 저장 뒤 (`Beta v2 · new`)
![saved](../../images/javascript_p1-14/40_01_saved.png)
