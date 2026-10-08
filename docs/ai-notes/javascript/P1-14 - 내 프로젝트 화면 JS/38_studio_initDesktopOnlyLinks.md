# JS 38 — `initDesktopOnlyLinks()` (core/studio.js)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/studio.js` |
| 작업 | P1-14 내 프로젝트 화면 — 시퀀서 링크 클릭 처리 · PRD 01 FR-126 · FR-129 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [37 `openStudio()`](37_studio_openStudio.md) · [39 `initNewProjectForm()`](39_myproject_initNewProjectForm.md) |

## 1. 하는 일
목록의 **제목 · Open** 처럼 `studioNx.html` 로 가는 링크를 누르면, 지금 탭에서 넘어가는 대신 화면 폭에 따라 처리한다.

| 사용자 동작 | 결과 |
|---|---|
| 넓은 화면(1280 이상)에서 **그냥 클릭** | 시퀀서가 **새 브라우저 창**으로 (37) — 같은 프로젝트면 열린 창이 앞으로 |
| 좁은 화면에서 그냥 클릭 | "Open on a computer" 안내 모달 (36) — 제목은 `Not opened` 표 없이 |
| Ctrl · ⌘ · Shift · Alt + 클릭, 휠 클릭 | **브라우저 기본 그대로** (새 탭 · 새 창 · 내려받기) |
| 시퀀서가 아닌 링크 | 그대로 |

**사용자 질문 (2026-10-08): "Ctrl 클릭을 해야 해?"** — 아니다. **그냥 클릭 한 번이 새 창**이다. Ctrl+클릭 등은 "새 탭으로 열기" 에 익숙한 사람의 습관을 **막지 않는다**는 뜻이다. 창 / 탭을 사용자가 고르는 설정은 Phase 2 환경 설정(PRD 02 FR-2164)에 있다.

## 2. 언제 쓰나
| 호출하는 곳 | 범위 |
|---|---|
| `myproject.js` 맨 아래 (이미 있음) | `initDesktopOnlyLinks(document.getElementById('project-list'))` — 목록 |
| `mypage.js` (P1-17, 이미 있음) | `initDesktopOnlyLinks(document.getElementById('recent-list'))` — 최근 프로젝트 |

**링크 `href` 는 그대로 둔다** — JS 가 꺼져 있거나 오류가 나도 링크는 지금 탭에서 열린다 (점진적 향상).

## 3. 코드
**import** (`studio.js` 맨 위)
```js
export const STUDIO_MIN_WIDTH = 1280;
```
`studio.js` 는 import 가 없다. 이 함수는 같은 파일의 `canOpenStudio`(35) · `showDesktopOnly`(36) · `openStudio`(37) 를 쓴다.

**함수** (제목 찾기는 `studioLinkTitle` 로 나눔)
```js
export function initDesktopOnlyLinks(root = document) {
  if (!root) return;
  root.addEventListener('click', function (event) {
    // 새 탭 · 새 창 · 내려받기 같은 브라우저 기본 동작은 막지 않음
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="studioNx.html"]');
    if (!link) return;

    event.preventDefault();
    if (!canOpenStudio()) {
      showDesktopOnly('open', studioLinkTitle(link));
      return;
    }
    const params = new URLSearchParams(link.getAttribute('href').split('?')[1]);
    openStudio(params.get('projectId'));
  });
}

/** 링크가 속한 프로젝트의 제목 — 줄의 data-title, 없으면 <b> 안 첫 글자 마디 */
function studioLinkTitle(link) {
  const row = link.closest('[data-title]');
  if (row) return row.dataset.title;
  const holder = link.querySelector('b') ? link : link.closest('li, section, article, div');
  const bold = holder ? holder.querySelector('b') : null;
  return bold && bold.firstChild ? bold.firstChild.textContent.trim() : 'This project';
}
```

**최신 문법으로 쓰면** (공부용 — 바뀌는 부분만)
```js
if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;   // 같음
const projectId = new URL(link.href).searchParams.get('projectId');
return link.closest('[data-title]')?.dataset.title
    ?? holder?.querySelector('b')?.firstChild?.textContent.trim()
    ?? 'This project';
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `a?.b` 사슬 | `a ? a.b : null` · `if` | 있을 때만 다음으로 |
| `x ?? y` | `x ? x : y` | 없으면 다음 값 |
| `new URL(link.href).searchParams` | `new URLSearchParams(href.split('?')[1])` | 주소의 `?` 뒤 값 읽기 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| (import 없음) | |

| 식 | 뜻 | 예 |
|---|---|---|
| `event.button !== 0` | 왼쪽 버튼이 아님 (1 = 휠, 2 = 오른쪽) | 휠 클릭은 브라우저가 새 탭 |
| `event.ctrlKey` · `metaKey` · `shiftKey` · `altKey` | 누른 채 클릭한 키 (meta = Mac ⌘) | Ctrl = 새 탭, Shift = 새 창, Alt = 내려받기 |
| `event.defaultPrevented` | 앞에서 이미 다른 코드가 막았는지 | |
| `'a[href^="studioNx.html"]'` | `href` 가 `studioNx.html` 로 **시작하는** 링크 | |
| `link.getAttribute('href').split('?')[1]` | `?` 뒤 부분 | `'projectId=7'` |
| `params.get('projectId')` | 그 값 | `'7'` |
| `link.closest('[data-title]')` | 위로 올라가며 `data-title` 이 있는 요소 (myProject 줄, 31) | |
| `bold.firstChild.textContent` | `<b>` 의 첫 글자 마디만 — 뒤의 `<span>Not opened</span>` 는 빠짐 | `Night Drive` |

## 4. 흐름
1. 범위(`root`) 안 클릭 → 막힌 클릭 · 왼쪽 버튼이 아님 · 보조 키 → 그대로 둠.
2. 시퀀서 링크가 아니면 그대로 → 맞으면 기본 이동을 막음.
3. 좁은 화면 → 안내 모달(제목 찾기) / 넓은 화면 → 주소의 `projectId` 로 새 창.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 그냥 클릭 = 새 창 | 목록 창을 닫아도 작업 창이 남게 (2026-10-05 결정) |
| 보조 키 · 휠은 그대로 | 사용자가 **직접 고른** 동작(새 탭 등)을 JS 가 바꾸면 불편 — 템플릿의 Ctrl · ⌘ · 휠에 Shift · Alt 도 더함 |
| 범위(`root`) 하나에 듣기 | 목록이 다시 그려져도 동작 (34 와 같은 위임) |
| 제목은 `data-title` 먼저 | 화면 글자에는 `Not opened` 가 섞임 (31) — myPage 처럼 없으면 `<b>` 의 첫 마디 |
| 제목을 못 찾으면 `This project` | 모달이 빈 이름으로 뜨지 않게 |
| `href` 를 남겨 둠 | JS 없이도 링크가 동작 · 마우스를 올리면 주소가 보임 |

**P1-17 참고:** myPage 의 'Ready to start' 배너는 제목이 `<h2>` 라 지금 규칙으로는 `This project` 가 된다. 배너는 `recent-list` 밖이라 지금은 이 함수 범위가 아니며, P1-17 에서 배너에 `data-title` 을 넣으면 그대로 맞는다.

## 6. 시험 (실제 myProject.html · 실제 서버 · 헤드리스 Chrome · 6개)
프로젝트 `Night Drive` 를 만들어 목록을 그리고, "사용자가 누른 것" 으로 클릭했다. 클릭이 막혔는지는 문서 끝에서 `defaultPrevented` 로 기록했다.

| # | 한 일 | 결과 |
|---|---|---|
| 01 | 1280 화면 · 제목 그냥 클릭 | 막음 · **새 창** `studioNx.html?projectId=…` 생김 · 지금 탭은 myProject 그대로 |
| 02 | 같은 줄 Open 버튼 | 막음 · 창 수 그대로 (같은 창이 앞으로) |
| 03 | Ctrl · Shift · Alt · Meta · 휠 클릭 | 5번 모두 **안 막음** · 모달 안 뜸 |
| 04 | 1024 화면 · 제목 클릭 | 막음 · 안내 모달 · 제목 `Night Drive` (`Not opened` 없음) · 새 창 없음 |
| 05 | `data-title` 없는 myPage 모양 줄 | 안내 모달 제목 `Midnight Drive` |
| 06 | 목록 안 다른 링크(`userInfo.html`) | 안 막음 · 모달 안 뜸 |

### 캡처 — 좁은 화면(1024)에서 제목을 눌렀을 때
![narrow](../../images/javascript_p1-14/38_04_narrow.png)
