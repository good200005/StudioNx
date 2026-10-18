# JavaScript 259 — 플러그인 고르기 창 (`openPluginPicker` · `renderPickerList` · `paramSummary`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 붙일 플러그인을 고르는 창을 엽니다 (FR-244) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 258 칸 안 조작 연결 · 260 붙이기 · 고치기 · 떼기 · 순서 |

## 1. 하는 일
카드 끝의 `＋` 를 누르면 `openPluginPicker` 가 열립니다. 악기를 붙이는 중이면 악기만, 이펙트를 붙이는 중이면 이펙트만 보여 줍니다. `renderPickerList` 는 목록을 그리고 검색어로 이름과 코드를 걸러 줍니다. `paramSummary` 는 플러그인마다 `"3 knobs · 3 on the card"` 처럼 노브 수를 알려 줍니다. 고른 플러그인은 넘겨받은 `onPick` 함수로 전달됩니다.

```
＋ → openPluginPicker(kind, onPick)
       ├─ renderPickerList('')        처음 목록
       ├─ 검색어 입력 → renderPickerList(검색어)
       └─ 목록에서 고름 → onPick(plugin) → addDevice (260)
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `wireCells` (263) | `＋` 클릭에서 `openPluginPicker` 를 부릅니다 |
| `wireDialogs` (263) | 검색어 입력과 목록 클릭을 배선합니다 |

## 3. 코드
```js
export function openPluginPicker(kind, onPick) {
  if (!active || !plugins.length) {
    showToast('Open a project with ?projectId=… to add plugins — this is the example screen');
    return;
  }
  picker = { kind: kind, onPick: onPick };
  const dlg = document.getElementById('plugin-picker');
  const title = document.getElementById('plugin-picker-title');
  const note = document.getElementById('picker-note');
  const search = document.getElementById('picker-search');
  if (title) title.textContent = kind === 'INSTRUMENT' ? 'Choose an instrument' : 'Choose an effect';
  if (note) note.textContent = plugins.length + ' plugins in the Plugins table (FR-244)';
  if (search) search.value = '';
  renderPickerList('');
  if (dlg && dlg.showModal) dlg.showModal();
  if (search) search.focus();
}

/** 고르기 창 목록 그리기 (검색어로 거르기) */
export function renderPickerList(query) {
  const list = document.getElementById('picker-list');
  if (!list || !picker) return;
  const want = picker.kind === 'INSTRUMENT' ? 'INSTRUMENT' : 'EFFECT';
  const q = String(query || '').trim().toLowerCase();
  const found = plugins.filter(function (p) {
    if (p.plugin_type !== want) return false;
    if (!q) return true;
    return p.name.toLowerCase().indexOf(q) >= 0 || String(p.code).toLowerCase().indexOf(q) >= 0;
  });
  if (!found.length) {
    list.innerHTML = '<li class="sq-picker__empty">No plugin matches. Plugins are added to the Plugins table by the admin screen.</li>';
    return;
  }
  list.innerHTML = found.map(function (p) {
    return '<li><button type="button" class="sq-plug" data-plugin-id="' + p.plugin_id + '">'
      + '<span class="sq-plug__art" aria-hidden="true">' + artHtml(p) + '</span>'
      + '<span><span class="sq-plug__name">' + esc(p.name) + '</span><br>'
      + '<span class="sq-plug__sub">' + esc(p.code) + ' · ' + esc(p.engine) + ' · v' + esc(p.version) + ' · '
      + paramSummary(p) + '</span></span>'
      + '<span class="sq-plug__badge">' + esc(p.plugin_type) + '</span></button></li>';
  }).join('');
}

/** 플러그인 파라미터 요약 — "47 parameters · 18 on the card" 처럼 */
function paramSummary(plugin) {
  const schema = plugin.param_schema || [];
  const knobs = schema.filter(function (it) { return it.type === 'knob'; }).length;
  return knobs + ' knobs · ' + primaryItems(plugin).length + ' on the card';
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `!active \|\| !plugins.length` | 데모 모드이거나 표가 비었으면 안내만 띄웁니다 |
| `picker = { kind, onPick }` | 무엇을 고르는 중인지 담아 둡니다 |
| `dlg.showModal()` | 브라우저 기본 대화 상자로 엽니다 |
| `search.focus()` | 열자마자 검색창에 커서를 둡니다 |
| `p.name.toLowerCase().indexOf(q) >= 0` | 이름이나 코드 안에 검색어가 있는지 봅니다 |
| `p.plugin_type !== want` | 붙이는 종류와 다른 플러그인은 걸러 냅니다 |
| `data-plugin-id` | 고른 플러그인을 찾을 번호입니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 종류로 거르기 | 악기 자리에 이펙트를 붙이면 서버가 거절합니다 |
| 검색어로 이름과 코드 | 코드로도 찾으면 플러그인이 많아져도 빠릅니다 |
| `onPick` 을 넘김 | 같은 창을 악기와 이펙트 양쪽에서 씁니다 |
| 표가 비면 안내 | 관리 화면에서 늘릴 수 있다는 것을 알려 줍니다 |

## 5. 시험
Bass Synth 의 `＋ Add instrument` 를 눌렀을 때 창 제목이 `Choose an instrument` 이고 악기 2종만 나오는 것을 확인했습니다. 이펙트 `＋` 로 열면 `Choose an effect` 와 5종이 나왔습니다. `com` 을 입력하면 `Compressor` 한 줄만 남았습니다.
