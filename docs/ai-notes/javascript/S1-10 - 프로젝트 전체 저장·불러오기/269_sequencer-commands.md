# JavaScript 269 — 명령 레지스트리 · 커맨드 팔레트 (`sequencer-commands.js`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-commands.js` |
| 작업 | S1-10 프로젝트 전체 저장·불러오기: 메뉴·단축키·팔레트 공용 명령 레지스트리 (PRD 02 FR-2169) |
| 작성 | Claude (AI), 2026-10-19, 사용자 검토 |
| 이전 · 다음 | 268 프로젝트 라우터(전체 조회 · 곡 설정) · 270 되돌리기 · 다시 하기 |

## 1. 하는 일
"무엇을 누르든 같은 명령 번호로 한 곳에서 처리한다"는 규칙을 만듭니다.

```text
registerCommand(id, fn) / registerCommands({ id: fn })
                ↓
        registry  { id → { run, label, keys, group } }
                ↑
  메뉴(data-command) · 단축키 · 커맨드 팔레트(Ctrl+P) · Nyxi 액션
                ↓
           runCommand(id)
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `sequencer-ui.js` | 메뉴 항목 누르면 `runCommand(cmd)` 로 넘겨 줍니다 |
| `sequencer-history.js` | `edit.undo` · `edit.redo` 를 여기에 등록합니다 |
| `sequencer-save.js` | `project.save` 를 여기에 등록합니다 |
| Ctrl+P | 팔레트가 뜨고, 이름으로 검색한 뒤 Enter 로 실행합니다 |

## 3. 코드
```javascript
const registry = {};
let cursor = 0; let rows = []; let palette = null; let toast = function () {};

export function registerCommand(id, run, meta) {
  if (!id || typeof run !== 'function') return false;
  const info = meta || {};
  registry[id] = {
    run: run,
    label: info.label || labelFromDom(id) || id,
    keys: info.keys || keysFromDom(id),
    group: info.group || 'command',
  };
  return true;
}

export function registerCommands(map, meta) {
  Object.keys(map || {}).forEach(function (id) { registerCommand(id, map[id], meta); });
}

export function runCommand(id) {
  const info = registry[id];
  if (!info) return false;
  info.run();
  return true;
}

export function initPalette(options) {
  if (options && typeof options.toast === 'function') toast = options.toast;
  registerCommand('view.palette', function () { openPalette(); }, {
    label: 'Command palette', keys: 'Ctrl+P', group: 'view',
  });
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    if (e.key.toLowerCase() !== 'p') return;
    if (isTyping(e.target) || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    openPalette();
  });
}

function filterPalette(query) {
  const q = String(query || '').trim().toLowerCase();
  rows = listCommands().filter(function (c) {
    if (!q) return true;
    return c.label.toLowerCase().indexOf(q) >= 0 || c.id.toLowerCase().indexOf(q) >= 0;
  });
  cursor = 0;
  if (!rows.length) {
    paletteList.innerHTML = '<li class="sq-palette__empty">No command matches.</li>';
    return;
  }
  paletteList.innerHTML = rows.map(function (c, i) {
    return '<li role="option" data-at="' + i + '" aria-selected="' + (i === cursor) + '">'
      + '<span>' + escapeHtml(c.label) + '</span>'
      + (c.keys ? '<kbd>' + escapeHtml(c.keys) + '</kbd>' : '')
      + '</li>';
  }).join('');
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `Object.keys(map \|\| {}).forEach` | 등록할 명령 여러 개가 들어 있는 사전을 돌면서 하나씩 등록합니다. `map` 이 없으면 빈 사전으로 봅니다 |
| `registry[id] = { run, label, keys, group }` | 한 명령이 무엇을 하는지, 어떤 단축키로 부르는지, 어떤 그룹인지 여기에 담습니다 |
| `if (!info) return false` | 아직 등록되지 않은 명령을 부르면 false 를 돌려줍니다 (부르는 쪽이 알림을 띄울 수 있습니다) |
| `e.preventDefault(); openPalette();` | Ctrl+P 를 잡고 열지 않아도 되게 한 뒤 팔레트를 띄웁니다 |
| `isTyping(e.target)` | 입력창에 커서가 있으면 단축키로 인식하지 않습니다 |
| `escapeHtml(c.label)` | 팔레트 글자를 넣기 전에 위험한 글자를 바꿔 둡니다 |
| `li.dataset.at` + `rows[i]` | 목록 줄 번호로 실제 명령을 찾아 실행합니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 메뉴·단축키·팔레트가 같은 레지스트리를 씀 | 명령을 한 번만 등록하면 세 군데 모두에서 동작합니다 (FR-2169) |
| `runCommand` 가 false 를 돌려줌 | 아직 구현 안 된 명령이면 조용히 넘어가지 않고, 알림을 띄울 수 있습니다 |
| 팔레트가 등록된 것만 보여줌 | 아직 구현 안 된 명령을 목록에 띄우지 않습니다 |
| `group` 칸 | 메뉴에서 카테고리별로 묶을 때 사용합니다. 팔레트에서는 label 순으로 정렬합니다 |

## 5. 시험
`docs/handoff/s1-10_tests/ui.mjs` 에서 팔레트를 Ctrl+P 로 열고, 'Save' 로 검색한 뒤 Enter 로 저장하는 흐름, `runCommand('project.save')` 로 바로 부르는 흐름을 확인합니다. `initPalette` 가 한 번만 실행되고 `registerCommand('view.palette')` 가 겹치지 않는지도 봅니다.
