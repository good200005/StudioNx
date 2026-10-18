# JavaScript 261 — 상세 설정 모달 (`openDeviceModal` · `renderModalTabs` · `paramGroups` · `renderModalParams` · `paramCellHtml` · `bindModalParam` · `setDraft` · `markDirty` · `saveDeviceModal` · `updateSideButtons` · `closeDeviceModal`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 카드를 눌러 연 상세 설정 창을 다룹니다 (FR-2181 · FR-2187 · FR-246) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 260 붙이기 · 고치기 · 떼기 · 순서 · 262 프리셋과 켜고 끄기 |

## 1. 하는 일
카드 몸통을 누르면 상세 설정 창이 열립니다. 창에는 그룹 탭, 그 그룹의 모든 파라미터(노브 · 셀렉트 · 토글), 프리셋 고르기, A/B 비교, 초기화 버튼이 있습니다. 값은 여기서는 **초안**(`modal.draft`)에만 담고, Save 를 눌러야 서버에 저장합니다. 저장할 때 그 전 값을 B 쪽에 담아 두어 A/B 비교로 되돌릴 수 있게 합니다. `markDirty` 는 `Unsaved changes` 표시를 맡습니다.

```
openDeviceModal        base(지금 값) · draft(고칠 값) · alt(이전 값)
   ├─ renderModalTabs(paramGroups(plugin))
   ├─ renderModalParams()      paramCellHtml + bindModalParam
   ├─ loadPresets → fillPresetSelect
   └─ Save → saveDeviceModal → updateDevice(PATCH) → refreshCells
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `wireCells` (263) | 카드 클릭에서 `openDeviceModal` 을 부릅니다 |
| `wireDialogs` (263) | 탭 · A/B · Save · 초기화 버튼을 배선합니다 |
| `removeDevice` (260) | 뗀 장치의 창이 열려 있으면 닫습니다 |

## 3. 코드
```js
export function openDeviceModal(track, kind, device) {
  const plugin = pluginById(device.plugin_id);
  if (!plugin) return;
  const base = withDefaults(plugin, device.params);
  modal = {
    track: track,
    kind: kind,
    device: device,
    plugin: plugin,
    base: base,
    alt: device.__alt || null,
    draft: withDefaults(plugin, device.params),
    sideB: false,
    dirty: false,
  };
  const groups = paramGroups(plugin);
  modal.group = groups[0];
  setText('device-art', artHtml(plugin).replace(/<[^>]*>/g, ''));
  setText('device-title', plugin.name);
  setText('device-sub', (kind === 'INSTRUMENT' ? 'Instrument' : 'Effect') + ' · slot ' + device.slot_index + ' · ' + plugin.engine);
  renderModalTabs(groups);
  renderModalParams();
  loadPresets(plugin).then(fillPresetSelect).catch(warn);
  markDirty(false);
  const dlg = document.getElementById('device-modal');
  if (dlg && dlg.showModal) dlg.showModal();
  updateSideButtons();
}

/** param_schema 의 group 을 처음 나온 차례대로 (없으면 General) */
function paramGroups(plugin) {
  const out = [];
  ((plugin && plugin.param_schema) || []).forEach(function (item) {
    const g = item.group || 'General';
    if (out.indexOf(g) < 0) out.push(g);
  });
  return out.length ? out : ['General'];
}

/** 모달의 파라미터 칸 그리기 (FR-2187) — 노브 · 셀렉트 · 토글을 param_schema 대로 자동 생성. */
export function renderModalParams() {
  const box = document.getElementById('device-params');
  if (!box || !modal) return;
  const schema = (modal.plugin.param_schema || []).filter(function (item) {
    return (item.group || 'General') === modal.group;
  });
  box.innerHTML = schema.map(function (item) { return paramCellHtml(item); }).join('')
    || '<p class="sq-cell__hint">This plugin has no parameters.</p>';
  schema.forEach(function (item) {
    const cell = box.querySelector('[data-param-cell="' + item.key + '"]');
    if (cell) bindModalParam(cell, item);
  });
}

/** 파라미터 한 칸 — 노브 / 셀렉트 / 토글 */
function paramCellHtml(item) {
  const v = modal.draft[item.key];
  let control;
  if (item.type === 'select') {
    const opts = (item.options || []).map(function (o) {
      return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(v) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
    control = '<select data-modal-param="' + esc(item.key) + '" aria-label="' + esc(item.name) + '">' + opts + '</select>';
  } else if (item.type === 'toggle') {
    control = '<span class="sq-switch" role="switch" tabindex="0" data-modal-param="' + esc(item.key) + '" aria-label="' + esc(item.name) + '" aria-pressed="' + String(!!v) + '"></span>';
  } else {
    control = '<span class="sq-knob" role="slider" tabindex="0" data-modal-param="' + esc(item.key) + '" aria-label="' + esc(item.name) + '"'
      + ' aria-valuemin="' + numOr(item.min, 0) + '" aria-valuemax="' + numOr(item.max, 1) + '" aria-valuenow="' + numOr(v, 0) + '">'
      + '<i style="--a:' + knobAngle(item, v) + 'deg"></i>'
      + '<span class="sq-knob__val">' + esc(fmtValue(item, v)) + '</span></span>';
  }
  return '<div class="sq-param" data-param-cell="' + esc(item.key) + '">' + control
    + '<span class="sq-param__name" title="' + esc(item.key) + '">' + esc(item.name) + '</span></div>';
}

/** 모달 저장 (FR-2187) — 초안을 params 로 PATCH. A/B 비교를 위해 저장 전 값을 B 쪽에 담아 둠 */
export async function saveDeviceModal() {
  if (!modal) return;
  const saved = await updateDevice(modal.track, modal.kind, modal.device, { params: modal.draft });
  if (!saved) return;
  modal.device.__alt = modal.base;
  modal.alt = modal.base;
  modal.base = withDefaults(modal.plugin, modal.device.params);
  modal.draft = Object.assign({}, modal.base);
  markDirty(false);
  refreshCells(modal.track);
  updateSideButtons();
  showToast(modal.plugin.name + ' saved');
}

/** A / B / 초기화 버튼 (FR-246) */
export function updateSideButtons() {
  const ab = document.getElementById('device-ab');
  if (!ab || !modal) return;
  Array.prototype.forEach.call(ab.querySelectorAll('[data-ab]'), function (b) {
    const side = b.dataset.ab;
    const on = side === 'A' ? !modal.sideB : modal.sideB;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `device.__alt \|\| null` | 지난 저장 때 담아 둔 이전 값입니다 |
| `groups[0]` | 처음 탭을 열어 둡니다 |
| `out.indexOf(g) < 0` | 처음 나온 그룹만 담아 차례를 지킵니다 |
| `(item.group \|\| 'General')` | 그룹이 없는 파라미터는 General 로 묶습니다 |
| `' selected'` | 지금 값과 같은 옵션을 골라 둡니다 |
| `item.type === 'select' \| 'toggle' \| 그 밖` | 세 가지 모양을 만듭니다 |
| `modal.base = withDefaults(...)` | 저장 뒤 기준값을 새 값으로 옮깁니다 |
| `side === 'A' ? !modal.sideB : modal.sideB` | A 와 B 중 켜진 쪽을 표시합니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 초안에만 담기 | 끄는 동안 서버에 요청이 쏟아지지 않고, 되돌리기도 쉽습니다 |
| 그룹 탭 | Compressor 는 Main 과 Sidechain 처럼 파라미터가 많습니다 |
| 저장 전 값을 B 에 담기 | A/B 비교가 저장 한 번으로 자연스럽게 동작합니다 (FR-246) |
| 스키마로 자동 생성 | 플러그인이 늘어도 화면 코드를 고치지 않아도 됩니다 (FR-2187) |
| 노브는 기존 조작 재사용 | 카드와 모달의 손맛이 같아집니다 |

## 5. 시험
Compressor 카드를 눌러 창 제목 `Compressor`, 탭 `Main`, 파라미터 6칸이 나오는 것을 확인했습니다. 노브를 돌려 `Unsaved changes` 가 뜨고 Save 를 누르면 `Saved` 로 바뀌는 것, 저장 뒤 B 를 누르면 이전 값으로, A 를 누르면 새 값으로 돌아오는 것을 확인했습니다.
