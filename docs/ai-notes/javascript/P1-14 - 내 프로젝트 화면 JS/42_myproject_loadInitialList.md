# JS 42 — `loadInitialList()` · 페이지 시작

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/myproject.js` |
| 작업 | P1-14 내 프로젝트 화면 — 페이지를 열 때 (로그인 확인 · 첫 목록 · 로그아웃 버튼) · PRD 01 FR-123 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [41 `initDeleteProject()`](41_myproject_initDeleteProject.md) · (P1-14 끝 — 개요 [51](<../../51_p1-14_myproject_js.md>)) |

## 1. 하는 일
myProject.html 을 **열었을 때** 할 일을 마무리한다. 이 함수가 생기기 전에는 HTML 의 예시 줄 7개가 그대로 보였고, 로그인하지 않아도 페이지가 열렸다.

| 주소로 열기 | 결과 |
|---|---|
| 로그인 안 한 채 `myProject.html` | `home.html#login?next=%2FmyProject.html` — 로그인하면 돌아옴 |
| `myProject.html` | 최근 수정순 10개 · `12 projects` · `Prev 1* 2 Next` · 예시 줄 없음 |
| `?query=p1&sort=title` | 검색 칸 `p1` · 정렬 Name · `P10, P11, P12` |
| `?page=9` (2쪽까지) | **마지막 쪽(2)** 으로 · 주소 `?page=2` |
| `?sort=random&page=abc` | 정렬 Recently edited · 1쪽 · 주소 깨끗 (30 이 고침) |
| Log out 버튼 | 로그아웃 → `home.html` (P1-10 27 `initLogoutButton`) |

**함께 바꾼 것**
- 파일 맨 아래 시작 코드에 두 TODO 를 채움: `if (await requireLogin()) await loadInitialList();`
- 빈 `initLogoutButton` 템플릿 함수를 지우고 `core/auth-ui.js` 것을 import (P1-10 에서 세 화면 공용으로 만든 것). 쓰지 않게 된 `logout` import 도 뺌.

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| `myproject.js` 맨 아래 (페이지를 열 때 한 번) | 로그인 확인 뒤 첫 목록 |

**시작 순서** (파일 맨 아래)
```js
await includePartials();          // 헤더 · 푸터 · 안내 모달 끼우기 (아래 init 들이 그 요소를 찾음)

initAuthState();
initModalFallback();
initFormAlerts();
initSearch();                     // 33
initNewProjectForm();             // 39
initRowMenus();                   // 34
initDesktopOnlyLinks(document.getElementById('project-list'));   // 38
initEditProjectForm();            // 40
initDeleteProject();              // 41
initLogoutButton();               // core/auth-ui.js (P1-10 27) — 세 화면 공용

// 로그인 확인 → 첫 목록 (로그인 안 했으면 home.html#login?next=… 로 옮겨 감)
if (await requireLogin()) await loadInitialList();
```
버튼 · 폼의 듣기를 먼저 걸고, 서버를 기다리는 일(로그인 확인 · 목록)은 **맨 끝**에 둔다 — 기다리는 동안에도 버튼이 반응한다.

## 3. 코드
**import** (`myproject.js` 맨 위)
```js
import { initAuthState, initLogoutButton } from '../core/auth-ui.js';
import { requireLogin, loginUrl } from '../core/auth.js';
import { api } from '../core/api.js';
import { initModalFallback } from '../core/modal.js';
import { canOpenStudio, showDesktopOnly, initDesktopOnlyLinks, openStudio, openBlankStudio } from '../core/studio.js';
import { includePartials } from '../core/include.js';
import { initFormAlerts, confirmDialog, showAlert } from '../core/dialog.js';
```
**`initLogoutButton` 을 추가하고 `logout` 을 뺐다.** 이 함수는 같은 파일의 `refreshList`(33) · `current`(30) 를 쓰고, 시작 코드는 `requireLogin`(P1-02) · `initLogoutButton`(P1-10) 을 쓴다.

**함수**
```js
export async function loadInitialList() {
  const list = document.getElementById('project-list');
  const count = document.getElementById('project-count');
  const pager = document.getElementById('project-pager');
  if (list) list.textContent = '';
  if (count) count.textContent = '';
  if (pager) pager.hidden = true;

  const params = new URLSearchParams(location.search);
  const options = {
    query: params.get('query') || '',
    sort: params.get('sort') || 'updated',
    page: params.get('page') || 1,
  };
  let data = await refreshList(options);
  if (data && data.items.length === 0 && data.total > 0) {
    options.page = Math.ceil(data.total / data.size);   // 없는 쪽 → 마지막 쪽
    data = await refreshList(options);
  }
  if (!data) return null;

  const query = document.getElementById('project-query');
  const sort = document.getElementById('project-sort');
  if (query) query.value = current.query;
  if (sort) sort.value = current.sort;
  return data;
}
```

**최신 문법으로 쓰면** (공부용 — 바뀌는 부분만)
```js
const params = new URLSearchParams(location.search);
const options = {
  query: params.get('query') ?? '',
  sort: params.get('sort') ?? 'updated',
  page: params.get('page') ?? 1,
};
document.getElementById('project-query')?.setAttribute('value', current.query);
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `a ?? b` | `a \|\| b` | 없으면(null) 기본값 — 여기서는 빈 글자도 기본값으로 가므로 `\|\|` 가 오히려 맞음 |
| `el?.…` | `if (el) …` | 있을 때만 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `import { initAuthState, initLogoutButton } from '../core/auth-ui.js'` | 로그아웃 버튼 (P1-10 27) — userInfo · myPage 와 같은 함수 |
| `import { requireLogin } from '../core/auth.js'` | 로그인이면 `true`, 아니면 로그인 화면으로 보내고 `false` (P1-02) |

| 식 | 뜻 | 예 |
|---|---|---|
| `new URLSearchParams(location.search)` | 주소의 `?` 뒤를 칸별로 | `?query=p1&sort=title` |
| `params.get('query') \|\| ''` | 없으면 빈 글자 | `null` → `''` |
| `Math.ceil(data.total / data.size)` | 마지막 쪽 번호 | 12 / 10 → 2 |
| `if (await requireLogin()) await loadInitialList();` | 로그인을 확인한 **뒤에만** 목록 요청 | |
| 맨 위의 `await` (모듈 맨 바깥) | `type="module"` 스크립트는 함수 밖에서도 `await` 를 쓸 수 있음 | |

## 4. 흐름
1. 예시 줄 · 개수를 지우고 페이지 줄을 숨김 (받는 동안 가짜 목록이 보이지 않게).
2. 주소에서 검색어 · 정렬 · 페이지를 읽어 목록 받기 (`refreshList`, 30 이 틀린 값을 고침).
3. 받은 쪽이 비었는데 전체는 있으면 → 마지막 쪽을 다시 받기.
4. 검색 칸 · 정렬 칸을 실제로 쓴 값(`current`)으로 맞춤.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 주소에서 읽음 | 30 이 주소에 남긴 값 — 새로고침 · 뒤로 가기 · 복사한 주소 · 페이지 링크 새 탭(32)에서 같은 목록 |
| 칸은 `current` 로 맞춤 | 주소의 틀린 값(`sort=random`)이 아니라 실제로 쓴 값을 보여 줌 |
| 없는 쪽 → 마지막 쪽 | 지운 뒤 북마크한 `?page=9` 같은 주소로 와도 빈 화면이 아니라 마지막 목록 |
| 받기 전에 예시 줄을 지움 | HTML 예시(Summer Loop 등)가 실제 목록처럼 잠깐 보이지 않게 |
| 로그인 확인을 먼저 | 로그인 안 한 사람에게 목록 요청 → 401 → 로그인 이동이 두 번 일어나지 않게 (userInfo 와 같은 모양) |
| `initLogoutButton` 은 import | P1-10 에서 세 화면 공용으로 만들어 둔 것 — 템플릿 주석대로 이 파일의 빈 함수는 지움 |

## 6. 시험 (실제 myProject.html 을 주소로 열기 · 실제 서버 · 7개 + 앞 시험 다시)
이번에는 함수를 직접 부르지 않고 **페이지를 주소로 열기만** 했다.

| # | 한 일 | 결과 |
|---|---|---|
| 01 | 로그인 안 한 채 열기 | `home.html#login?next=%2FmyProject.html` |
| 02 | 로그인 · 프로젝트 12개 → 열기 | `P12 … P03` 10줄 · `12 projects` · `Prev 1* 2 Next` · 검색 빈 칸 · 정렬 updated · 예시 줄 없음 |
| 03 | `?query=p1&sort=title` | 검색 칸 `p1` · 정렬 title · `P10, P11, P12` · `3 projects` · 페이지 줄 숨김 |
| 04 | `?page=9` | `P02, P01` · `Prev 1 2* Next` · 주소 `?page=2` |
| 05 | `?sort=random&page=abc` | 정렬 updated · 1쪽 · 주소 `myProject.html` |
| 06 | Log out 클릭 | `home.html` |
| 07 | 로그아웃 뒤 다시 열기 | 로그인 화면으로 |

**앞 시험 다시 (페이지가 이제 스스로 목록을 받으므로):** 30(14) · 33(6) · 39(7) · 41(7) 을 다시 돌려 결과가 모두 그대로임을 확인했다.

### 캡처 — 로그인 뒤 열었을 때
![page](../../images/javascript_p1-14/42_02_page.png)
