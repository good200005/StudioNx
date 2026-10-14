# JS 140 — Snap 메뉴 배선 (분할 목록 만들기·클릭 연결)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js`, `studionx/frontend/studioNx.html` |
| 작업 | S1-06 타임라인: 스물여섯 번째 함수 (FR-206 스냅 메뉴 배선) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 트랙 추가·삭제 UI(FR-207)와 클립 배치 배선을 이어서 진행합니다 |

## 1. 하는 일
Snap 메뉴에 **분할 목록(1/1~1/32 · 셋잇단)** 을 만들고, 클릭을 `setSnapDivision`·`setSnapMode`에 잇습니다. 버튼 글자와 체크 표시도 지금 방식에 맞춰 다시 씁니다.

- `snapOptions()` 목록을 메뉴에 그립니다(12줄: 1/1, 1/1T, …, 1/32T).
- 분할을 누르면 `setSnapDivision`, Line·Off를 누르면 `setSnapMode`를 부릅니다.
- 버튼: `Snap: Line ▾` · `Snap: Off ▾` · `Snap: 1/16T ▾` 처럼 바뀝니다.
- 여러 번 초기화해도 목록이 두 번 만들어지지 않습니다(이미 있으면 건너뜀).

```
Snap ▾ 클릭
   ├ Line        → setSnapMode('line')      → 버튼 'Snap: Line ▾'
   ├ Off         → setSnapMode('off')       → 버튼 'Snap: Off ▾'
   └ 1/16T       → setSnapDivision('1/16', true) → 버튼 'Snap: 1/16T ▾'
```

## 2. 코드
`sequencer-arrange.js`
```js
function buildSnapDivisions(menu) {
  if (menu.querySelector('[data-division]')) return;
  const note = menu.querySelector('#snap-note');
  const frag = document.createDocumentFragment();
  for (const opt of snapOptions()) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitemradio');
    b.setAttribute('aria-checked', 'false');
    b.dataset.division = opt.division;
    b.dataset.triplet = String(opt.triplet);
    b.textContent = opt.label;
    li.appendChild(b);
    frag.appendChild(li);
  }
  if (note) menu.insertBefore(frag, note);
  else menu.appendChild(frag);
}

function updateSnapButton() {
  const btn = document.getElementById('snap');
  if (!btn) return;
  if (snapMode === 'off') btn.textContent = 'Snap: Off ▾';
  else if (snapMode === 'division') btn.textContent = `Snap: ${snapDivision}${snapTriplet ? 'T' : ''} ▾`;
  else btn.textContent = 'Snap: Line ▾';
}

function refreshSnapMenu() {
  const menu = document.getElementById('menu-snap');
  if (!menu) return;
  menu.querySelectorAll('[data-snap]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.snap === snapMode)));
  menu.querySelectorAll('[data-division]').forEach((b) => {
    const on = snapMode === 'division' && b.dataset.division === snapDivision && (b.dataset.triplet === 'true') === snapTriplet;
    b.setAttribute('aria-checked', String(on));
  });
}
```
클릭 연결 (initSnapMenu 안)
```js
menu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-snap],[data-division]');
  if (!item) return;
  if (item.dataset.division) setSnapDivision(item.dataset.division, item.dataset.triplet === 'true');
  else setSnapMode(item.dataset.snap);
  close();
});
```
`setSnapMode`·`setSnapDivision` 은 상태를 바꾼 뒤 `updateSnapButton()`·`refreshSnapMenu()`·`notifyGridSettings()` 를 부릅니다.

`studioNx.html` (메뉴 골격에 구분 줄과 자리표 추가)
```html
<li class="sq-dropdown__note" role="separator">Division</li>
<li class="sq-dropdown__note" id="snap-note">Hold Alt while dragging to ignore the grid</li>
```
**최신 문법으로 쓰면** (공부용)
```js
const frag = snapOptions().map((opt) => {
  const b = document.createElement('button');
  Object.assign(b.dataset, { division: opt.division, triplet: String(opt.triplet) });
  b.textContent = opt.label;
  return b;
});
menu.append(...frag);
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `map` · `append(...)` | `for` + `frag.appendChild` | 같은 결과입니다. `<li>`로 감싸는 단계가 보이도록 반복으로 씁니다 |
| `Object.assign(b.dataset, …)` | `b.dataset.division = …` | 같은 뜻입니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 목록을 `snapOptions()`로 그림 | 분할·이름·셋잇단을 한 곳(136)에서 정의했습니다. 화면에 손으로 12줄을 적으면 어긋납니다 |
| 두 번 만들지 않음 | 창 크기 변화 등으로 다시 초기화해도 메뉴가 겹쳐 늘지 않습니다 |
| 클릭 한 곳에서 판단 | Line·Off와 분할을 한 핸들러에서 나눠 처리합니다. 항목마다 따로 붙이지 않습니다 |
| 버튼·체크를 다시 씀 | 지금 고른 값이 어디서 바뀌든 화면이 맞춰집니다. 한 곳(`updateSnapButton`·`refreshSnapMenu`)에서만 그립니다 |
| HTML은 골격만 | 구분 줄과 자리표(`#snap-note`)만 두고 항목은 JS가 채웁니다. 값을 바꿔도 HTML을 안 고칩니다 |

## 4. 시험
**(1) Node 단위 시험(11개 통과)** — `document`를 가짜로 채워 상태·전환을 확인했습니다(Line/Off/division, Alt 우선, Line 복귀).

**(2) 브라우저 확인(Chrome headless + CDP, 실제 `studioNx.html`)**
| 확인 | 결과 |
|---|---|
| 분할 줄 수 = 12 (여러 번 초기화해도 24 안 됨) | ✔ |
| 라벨 순서 1/1, 1/1T, …, 1/32T | ✔ |
| 버튼 글자: 열기 전 `Snap: Line ▾` → 1/16T 클릭 `Snap: 1/16T ▾` → Line 클릭 `Snap: Line ▾` | ✔ |
| 1/16T 클릭 뒤 방식 `'division'` · 스냅 한 칸 1/48 | ✔ |
| 체크 표시 한 줄만, Line으로 복귀 시 Line 체크 | ✔ |

검토용 화면: `docs/ai-notes/images/javascript_s1-06/s1-06_snap-menu.png` (1/8T를 고른 채 메뉴를 연 모습).
