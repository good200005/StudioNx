# JS 31 — `renderProjects()` (+ `buildRow`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/myproject.js` · (CSS) `static/css/pages/myproject.css` |
| 작업 | P1-14 내 프로젝트 화면 — 목록 그리기 · PRD 01 FR-123 · FR-125 · FR-130 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [30 `loadProjects()`](30_myproject_loadProjects.md) · [32 `renderPager()`](32_myproject_renderPager.md) |

## 1. 하는 일
`loadProjects`(30)가 받은 목록을 **화면의 줄로 그린다**. HTML 의 예시 줄 7개를 지우고, `<template id="project-row-template">` 을 프로젝트 수만큼 복사해 채운다.

| 칸 | 넣는 것 | 예 |
|---|---|---|
| 제목 | 제목 + 안 열었으면 `Not opened` 표 | `Lo-fi Sketch [Not opened]` |
| 설명 | 설명, 없으면 `No description` | |
| BPM · Sig · Key | `Number(bpm)` · `7/8` · 키 없으면 `—` | `'128.50'` → `128.5`, `'120.00'` → `120` |
| Members | 점 최대 3개 + OWNER 가 아니면 역할 | 5명 EDITOR → ●●● `Editor` |
| Edited | `formatRelativeTime(updated_at)` (29) + 휴대폰용 `data-meta` | `12 minutes ago`, meta `128 BPM · A minor · ` |
| ··· 메뉴 | OWNER 가 아니면 Delete 잠금 + `Owner only`, VIEWER 는 Edit 도 잠금 | |
| 링크 | 제목 · Open → `studioNx.html?projectId=번호` | |

| 목록 | 화면 |
|---|---|
| 1개 이상 | 개수 `2 projects` (1개면 `1 project`) · 제목 줄 · 목록 |
| 0개 · 검색어 없음 | `No projects yet. Create your first project` |
| 0개 · 검색어 있음 | `No projects match your search.` |

개수는 **이 페이지의 줄 수가 아니라 전체**(`total`) — 23개 중 1쪽이면 `23 projects`.

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 페이지 시작 · 검색 · 페이지 넘김 · 새 프로젝트 · 삭제 뒤 (32 · 33 · 35 · 37 · 38) | 항상 `loadProjects` 다음에 — `const data = await loadProjects(…); if (data) renderProjects(data);` |

**`<template>`**: 화면에 보이지 않는 HTML 틀. `template.content` 안의 요소를 `cloneNode(true)` 로 복사하면 같은 모양의 새 줄이 생긴다. 줄 모양은 HTML 이 정하고 JS 는 값만 채운다 (나중에 React 로 옮길 때도 틀을 그대로 컴포넌트로).

## 3. 코드
**import** (`myproject.js` 맨 위 — 30 과 같음, 이번에 추가한 것 없음)
```js
import { initAuthState } from '../core/auth-ui.js';
import { requireLogin, logout, loginUrl } from '../core/auth.js';
import { api } from '../core/api.js';
import { initModalFallback } from '../core/modal.js';
import { canOpenStudio, showDesktopOnly, initDesktopOnlyLinks, openStudio } from '../core/studio.js';
import { includePartials } from '../core/include.js';
import { initFormAlerts } from '../core/dialog.js';
```
이 함수는 import 를 쓰지 않는다 — 같은 파일의 `current`(30) · `formatRelativeTime`(29) 만 쓴다.

**함수** (줄 하나 만들기는 `buildRow` 로 나눔 — 파일 밖에서는 안 씀)
```js
export function renderProjects(data) {
  const list = document.getElementById('project-list');
  const template = document.getElementById('project-row-template');
  const count = document.getElementById('project-count');
  const label = document.querySelector('.pj-list .pj-row--label');
  const empty = document.getElementById('project-empty');
  const noResult = document.getElementById('project-no-result');
  if (!list || !template) return;

  // 1. 개수 · 빈 목록 안내
  if (count) count.textContent = data.total === 1 ? '1 project' : data.total + ' projects';
  const isEmpty = data.items.length === 0;
  list.hidden = isEmpty;
  if (label) label.hidden = isEmpty;
  if (empty) empty.hidden = !(isEmpty && !current.query);
  if (noResult) noResult.hidden = !(isEmpty && current.query);

  // 2. 줄 그리기 — 예시 줄을 지우고 틀을 복사해 채움
  list.textContent = '';
  for (let i = 0; i < data.items.length; i++) {
    list.appendChild(buildRow(template, data.items[i]));
  }
}

/** 프로젝트 하나 → 목록 한 줄 <li> (renderProjects 가 씀) */
function buildRow(template, item) {
  const row = template.content.firstElementChild.cloneNode(true);
  const field = function (name) { return row.querySelector('[data-field="' + name + '"]'); };
  const href = 'studioNx.html?projectId=' + item.project_id;
  const bpm = String(Number(item.bpm));             // '128.50' → '128.5', '120.00' → '120'
  const key = item.music_key ? item.music_key : '—';
  const isOwner = item.my_role === 'OWNER';

  row.dataset.projectId = item.project_id;
  row.dataset.title = item.title;                                        // 34 가 수정 칸을 채울 때 씀
  row.dataset.description = item.description ? item.description : '';
  row.querySelector('.pj-row__head').href = href;
  row.querySelector('.pj-row__act a').href = href;

  // 제목 · 설명 · Not opened
  const title = row.querySelector('.pj-row__head b');
  title.textContent = item.title;
  if (!item.opened) {
    const badge = document.createElement('span');
    badge.className = 'pj-badge';
    badge.textContent = 'Not opened';
    title.appendChild(document.createTextNode(' '));
    title.appendChild(badge);
  }
  row.querySelector('.pj-row__head > span').textContent = item.description ? item.description : 'No description';

  // BPM · 박자 · 키 · 언제 (모바일 한 줄 정보는 data-meta)
  field('bpm').textContent = bpm;
  field('sig').textContent = item.time_sig_num + '/' + item.time_sig_den;
  field('key').textContent = key;
  const when = field('when');
  when.textContent = formatRelativeTime(item.updated_at);
  when.dataset.meta = bpm + ' BPM · ' + (item.music_key ? item.music_key + ' · ' : '');

  // 참여자 점 (최대 3개) + 내 역할 (OWNER 가 아니면)
  const members = field('members');
  for (let i = 0; i < Math.min(item.member_count, 3); i++) {
    members.appendChild(document.createElement('i'));
  }
  let membersLabel = item.member_count === 1 ? '1 member' : item.member_count + ' members';
  if (!isOwner) {
    const roleName = item.my_role.charAt(0) + item.my_role.slice(1).toLowerCase();   // 'EDITOR' → 'Editor'
    const role = document.createElement('span');
    role.className = 'pj-role';
    role.textContent = roleName;
    members.appendChild(role);
    membersLabel += ', your role: ' + roleName.toLowerCase();
  }
  members.setAttribute('aria-label', membersLabel);

  // ··· 메뉴 — 삭제는 OWNER 만, 수정은 OWNER · EDITOR 만
  row.querySelector('.pj-more').setAttribute('aria-label', 'More actions for ' + item.title);
  if (!isOwner) {
    const deleteButton = row.querySelector('[data-action="delete"]');
    deleteButton.disabled = true;
    deleteButton.title = 'Only the owner can delete';
    const small = document.createElement('small');
    small.textContent = 'Owner only';
    deleteButton.appendChild(document.createTextNode(' '));
    deleteButton.appendChild(small);
  }
  if (item.my_role === 'VIEWER') {
    const editButton = row.querySelector('[data-action="edit"]');
    editButton.disabled = true;
    editButton.title = 'Viewers can’t edit';
  }
  return row;
}
```

**CSS** (`myproject.css`, 이번에 추가)
```css
/* JS 가 hidden 으로 숨기는 것 (목록 0개 · 페이지 1개) — display: grid · flex 가 hidden 을 이기지 않게 (P1-14) */
.pj-list [hidden], .pj-pager[hidden] { display: none; }
```

**최신 문법으로 쓰면** (공부용 — 바뀌는 부분만)
```js
list.replaceChildren(...data.items.map((item) => buildRow(template, item)));
const field = (name) => row.querySelector(`[data-field="${name}"]`);
members.append(...Array.from({ length: Math.min(item.member_count, 3) }, () => document.createElement('i')));
title.append(' ', badge);
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `list.replaceChildren(...줄들)` | `list.textContent = ''` + `for` 로 `appendChild` | 안을 비우고 새로 채우기 |
| `(name) => …` (화살표 함수) | `function (name) { return …; }` | 짧은 함수 |
| `Array.from({ length: n }, () => …)` | `for (let i = 0; i < n; i++)` | n 번 만들기 |
| `el.append(' ', badge)` | `appendChild(createTextNode(' '))` + `appendChild(badge)` | 글자와 요소를 한 번에 붙이기 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| (이 함수는 import 없음) | 같은 파일의 `current` · `formatRelativeTime` 을 그대로 부름 |

| 식 | 뜻 | 예 |
|---|---|---|
| `template.content.firstElementChild.cloneNode(true)` | 틀 안 첫 요소(`<li>`)를 **안쪽까지 통째로** 복사 | `true` 가 없으면 `<li>` 껍데기만 |
| `el.textContent = 값` | 글자로만 넣음 — `<img …>` 도 태그가 아니라 글자로 보임 | 제목 `<img src=x onerror=…>` → 그 글자 그대로 |
| `list.textContent = ''` | 안쪽을 모두 지움 (HTML 예시 줄 포함) | |
| `row.dataset.projectId = 5` | `data-project-id="5"` 속성 (34 · 36 · 37 이 읽음) | |
| `String(Number('128.50'))` | 글자 → 숫자 → 글자, 끝의 0 이 빠짐 | `'128.5'`, `'120'` |
| `item.my_role.charAt(0) + item.my_role.slice(1).toLowerCase()` | 첫 글자만 대문자 | `'EDITOR'` → `'Editor'` |
| `'.pj-row__head > span'` | `<a>` **바로 아래**의 span (제목 안 `Not opened` span 은 아님) | 설명 칸 |
| `!(isEmpty && !current.query)` | "비었고 검색어도 없음" 이 **아니면** 숨김 | |

## 4. 흐름
1. 개수 글자 · 빈 목록 안내 (검색어 유무로 둘 중 하나) · 목록과 제목 줄 보이기/숨기기.
2. 목록 비우기 → 프로젝트마다 `buildRow`: 틀 복사 → 번호 · 링크 → 제목(+ Not opened) · 설명 → BPM · 박자 · 키 · 언제 → 멤버 점 · 역할 → ··· 메뉴 잠금.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 모든 글자를 `textContent` 로 | 제목 · 설명은 사용자가 친 글자. `innerHTML` 이면 `<img onerror=…>` 같은 제목이 **실행됨** (XSS). 시험에서 그대로 글자로 보이고 이미지가 0개임을 확인 |
| 줄 만들기를 `buildRow` 로 나눔 | 칸이 많아 한 함수에 다 넣으면 길어짐. 36(수정 뒤 그 줄만 다시 그리기)에서도 씀 |
| `Number(bpm)` | 서버가 소수를 글자 `'128.50'` 으로 보냄 (P1-13 확인). 화면 예시처럼 `128` · `128.5` 로 |
| 개수는 `total` | 페이지당 10개라 `items.length` 는 최대 10 — 전체 개수가 사용자가 알고 싶은 것 |
| 빈 안내 두 가지 | 처음 사용자에게는 "만들기" 버튼, 검색 결과가 없을 때는 "검색어를 바꾸라" — 템플릿대로 |
| VIEWER 는 Edit 도 잠금 | 템플릿에는 Delete 만 있었지만, 서버가 VIEWER 수정을 403 으로 막음(P1-13 60) → 누르고 실패하는 것보다 미리 잠금. Phase 1 은 OWNER 만 생기므로 지금은 보이지 않음 |
| 멤버 점 최대 3개 | 화면 예시 · 템플릿. 정확한 수는 `aria-label`(`5 members, your role: viewer`)로 화면 낭독기에 |
| `data-title` · `data-description` (34 에서 추가) | 34 가 수정 칸을 채울 때 화면 글자(`Not opened` · `No description` 이 섞임) 대신 읽음 |
| CSS `[hidden]` 규칙 추가 | `.pj-row` 가 `display: grid` 라 `hidden` 속성을 이겨 제목 줄이 숨지 않았다 — 규칙이 없는 `.pj-row` 는 hidden 이어도 `grid` 로 계산됨을 시험으로 확인. 32 페이지 넘김(`.pj-pager` 는 flex)도 같은 문제라 함께 |

## 6. 시험 (실제 myProject.html · 실제 서버 · 헤드리스 Chrome)
시험 계정으로 프로젝트 2개를 만들고 실제 목록을 그렸고, 역할 · 멤버 · 키 · XSS 는 가짜 응답으로 그렸다. 보이는지는 **계산된 CSS**(`getComputedStyle(…).display`)로 확인했다. 끝난 뒤 계정 · 프로젝트를 지웠다.

| # | 상황 | 결과 |
|---|---|---|
| 01 | 실제 서버 2개 | `2 projects` · 최근 것 먼저 · `Lo-fi Sketch` bpm `128.5` · `7/8` · 키 `—` · `Not opened` / `First Idea` 설명 `No description` · bpm `120` · `Just now` · 링크 `studioNx.html?projectId=…` |
| 02 | 가짜 3개 (total 23) | `23 projects` / OWNER: 역할 없음 · Delete 열림 · `12 minutes ago` · meta `128 BPM · A minor · ` / EDITOR 3명: 점 3 · `Editor` · Delete 잠금 `Owner only` · Edit 열림 · `Sep 21` / VIEWER 5명: 점 3 · `5 members, your role: viewer` · Edit · Delete 잠금 |
| 02 | 제목 `<img src=x onerror=alert(1)>` · 설명 `<b>bold?</b>` | 글자 그대로, 목록 안 이미지 0개 |
| 03 | 0개 · 검색어 없음 | `0 projects` · `No projects yet` 보임 · 목록 · 제목 줄 숨김 |
| 04 | 0개 · 검색어 `zzz` (실제) | `No projects match your search.` 보임 |
| 05 | 다시 1개 | `1 project` · 목록 · 제목 줄 다시 보임 |

### 캡처
![역할 · 멤버](../../images/javascript_p1-14/31_02_roles.png)

![0개](../../images/javascript_p1-14/31_03_empty.png)
