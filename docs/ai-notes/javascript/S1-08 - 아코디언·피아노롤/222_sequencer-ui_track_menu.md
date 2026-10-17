# JavaScript 222 — 트랙 오른쪽 클릭 메뉴와 단축키 (`groupTracks` · `ungroupSelection` · `deleteTracks` · `openTrackMenu` · `initTrackMenu`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-08 아코디언·피아노롤: 사용자 요구 3번 (트랙 선택 + 그룹 메뉴, FR-207) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 221 트랙 선택·그룹 · 223 펼침 상태 기억 |

## 1. 하는 일
트랙 머리를 오른쪽 클릭하면 작은 메뉴(그룹으로 묶기 · 그룹 풀기 · 트랙 지우기)가 뜹니다. 같은 일을 `Ctrl+G`·`Ctrl+Shift+G`·`Delete` 키로도 할 수 있습니다. 실제 동작은 편곡 함수(221)를 부르고, 결과를 토스트로 알립니다.

| 함수 | 하는 일 |
|---|---|
| `groupTracks()` | 선택 트랙을 그룹으로 묶고 토스트 |
| `ungroupSelection()` | 선택 그룹을 풀고 토스트 |
| `deleteTracks()` | 선택 트랙을 지우고 토스트 |
| `openTrackMenu(x, y)` | 마우스 자리에 메뉴를 띄우고 항목 처리를 연결 |
| `initTrackMenu()` | 트랙 오른쪽 클릭과 단축키를 배선 |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 트랙 머리에서 오른쪽 클릭 | `openTrackMenu` 로 메뉴를 띄웁니다 |
| `Ctrl+G` · `Ctrl+Shift+G` | `groupTracks` · `ungroupSelection` |
| Delete 툴바/단축키 | `deleteTracks` |

## 3. 코드
```js
function groupTracks() {
  const n = selectedTracks().length;
  const g = groupSelectedTracks();
  if (!g) return;
  showToast(n ? `Grouped ${n} track${n === 1 ? '' : 's'}` : 'New group track added');
}

function openTrackMenu(x, y) {
  document.querySelector('.sq-trackmenu')?.remove();
  const n = selectedTracks().length;
  const hasGroup = selectedTracks().some((t) => t.classList.contains('sq-track--group'));
  const ul = document.createElement('ul');
  ul.className = 'sq-dropdown is-popup sq-trackmenu';
  ul.setAttribute('role', 'menu');
  ul.innerHTML = `
    <li><button type="button" role="menuitem" data-act="group"${n ? '' : ' disabled'}>Group selected tracks <kbd>Ctrl+G</kbd></button></li>
    <li><button type="button" role="menuitem" data-act="ungroup"${hasGroup ? '' : ' disabled'}>Ungroup <kbd></kbd></button></li>
    <li role="separator"><hr></li>
    <li><button type="button" role="menuitem" data-act="delete">Delete track <kbd>Del</kbd></button></li>`;
  ul.style.position = 'fixed';
  ul.style.left = `${Math.min(x, window.innerWidth - 230)}px`;
  ul.style.top = `${Math.min(y, window.innerHeight - 150)}px`;
  document.body.append(ul);
  const off = (e) => { if (!ul.contains(e.target)) close(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    ul.remove();
    document.removeEventListener('pointerdown', off);
    document.removeEventListener('keydown', esc);
  }
  ul.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    close();
    if (act === 'group') groupTracks();
    else if (act === 'ungroup') ungroupSelection();
    else if (act === 'delete') deleteTracks();
  });
  setTimeout(() => { document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc); });
}

function initTrackMenu() {
  const lanes = document.getElementById('lanes');
  if (!lanes) return;
  // 트랙 머리에서 오른쪽 클릭 = 그 트랙 선택 후 메뉴
  lanes.addEventListener('contextmenu', (e) => {
    const head = e.target.closest('.sq-track__head');
    const track = head?.closest('.sq-track');
    if (!track || e.target.closest('button')) return;
    e.preventDefault();
    if (!track.classList.contains('is-selected')) selectTrack(track);
    openTrackMenu(e.clientX, e.clientY);
  });
  // Ctrl+G = 선택 트랙 그룹화 · Ctrl+Shift+G = 그룹 풀기
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'g') return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (e.shiftKey) ungroupSelection(); else groupTracks();
  });
}
```


### 문법 풀이
| 식 | 뜻 |
|---|---|
| `document.querySelector('.sq-trackmenu')?.remove()` | 이미 떠 있던 메뉴가 있으면 지웁니다 (`?.` 는 없으면 건너뜀) |
| `ul.setAttribute('role', 'menu')` | 보조기기에 이 상자가 메뉴임을 알립니다 |
| `${n ? '' : ' disabled'}` | 선택이 없으면 "그룹으로" 항목을 비활성으로 둡니다 |
| `ul.style.left = Math.min(x, innerWidth - 230)` | 메뉴가 화면 밖으로 나가지 않게 자리를 좁힙니다 |
| `setTimeout(...)` | 메뉴를 여는 그 클릭에 곧바로 닫히지 않게 잠깐 뒤에 바깥 클릭 감지를 붙입니다 |
| `e.preventDefault()` | 오른쪽 클릭 기본 메뉴(브라우저) 가 뜨지 않게 합니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 동작은 221 을 그대로 부름 | 그룹·삭제 로직은 편곡 파일 한 곳(221)에만 둡니다. 메뉴는 그 함수를 부르기만 합니다 |
| 항목을 못 쓰는 동안 `disabled` | 선택이 없는데 "그룹으로 묶기"를 누르면 빈 그룹이 생겨 헷갈립니다 |
| 화면 밖으로 안 나가게 | 창 가장자리에서 오른쪽 클릭해도 메뉴가 잘리지 않습니다 |

## 5. 시험
헤드리스 브라우저에서 트랙 머리 오른쪽 클릭 → 메뉴 3항목이 뜨고, 그룹 항목을 누르면 그룹이 생기는 것을 확인했습니다(콘솔 오류 0건).
