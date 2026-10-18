# JavaScript 252 — 악기 칸과 이펙트 칸 HTML (`instrumentsHtml` · `effectsHtml` · `sorted` · `artHtml` · `primaryItems`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 칸 안에 들어갈 카드 묶음과 ＋ 버튼 글을 만듭니다 (FR-245 · FR-263) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 251 펼침 칸 안 네 칸 그리기 · 253 Nyxi 카드 한 장 |

## 1. 하는 일
`instrumentsHtml` 은 악기 카드를 `slot_index` 차례로 늘어놓고 끝에 `＋ Add instrument` 를 붙입니다. MIDI 트랙에서 같은 노트를 여러 악기가 함께 연주할 수 있게 하려는 것입니다(FR-245). `effectsHtml` 은 카드 사이에 `→` 를 넣어 소리 흐름을 보여 주고 끝에 `＋` 를 붙입니다(FR-263). `sorted` 는 두 목록을 칸 번호 차례로 정리하고, `artHtml` 은 카드 아트를, `primaryItems` 는 카드에 올릴 핵심 노브를 고릅니다.

```
악기 칸 : [카드][카드] ＋ Add instrument
이펙트 칸: [카드] → [카드] → ＋
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `renderCells` (251) | 악기 칸과 이펙트 칸의 속을 채울 때 씁니다 |
| `cardHtml` (253) | `artHtml` 과 `primaryItems` 를 씁니다 |

## 3. 코드
```js
/** 악기 칸 — Nyxi 카드 여러 장 + ＋ (한 트랙에서 같은 노트를 여러 악기가 함께 연주, FR-245) */
function instrumentsHtml(track) {
  const list = sorted((devices[track.track_id] || { instruments: [] }).instruments);
  const cards = list.map(function (d) { return cardHtml('INSTRUMENT', track, d); }).join('');
  return '<div class="sq-istack sq-istack--cards">' + cards
    + '<div class="sq-dev-empty">' + (list.length ? '' : 'No instrument — the note clips play nothing.')
    + '<button type="button" class="is-dev-add" data-kind="INSTRUMENT">＋ Add instrument</button></div></div>';
}

/** 이펙트 칸 — 카드 → 카드, 마지막에 ＋ (FR-263) */
function effectsHtml(track) {
  const list = sorted((devices[track.track_id] || { effects: [] }).effects);
  const parts = [];
  list.forEach(function (d, i) {
    if (i) parts.push('<li class="sq-flow" aria-hidden="true">→</li>');
    parts.push(cardHtml('EFFECT', track, d));
  });
  parts.push('<li><button type="button" class="sq-fx-add is-dev-add" data-kind="EFFECT" aria-label="Add effect after the last one">＋</button></li>');
  return '<ol class="sq-chain">' + parts.join('') + '</ol>'
    + '<p class="sq-cell__hint">Parallel branches and the PATCHER board come later (FR-265)</p>';
}

/** slot_index 순서로 */
function sorted(list) {
  return list.slice().sort(function (a, b) { return a.slot_index - b.slot_index; });
}

/** 카드 아트 — card_asset 이 있으면 그림, 없으면 이름 두 글자 (시드 7종은 모두 NULL → 글자) */
function artHtml(plugin) {
  if (plugin && plugin.card_asset) return '<img src="' + esc(plugin.card_asset) + '" alt="">';
  const name = plugin ? plugin.name : 'PL';
  return esc(name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'PL');
}

/** 카드에 올릴 핵심 파라미터 — primary=true 노브를 먼저, 2~4개 (없으면 앞의 노브 2개) */
function primaryItems(plugin) {
  const schema = (plugin && plugin.param_schema) || [];
  const knobs = schema.filter(function (it) { return it.type === 'knob'; });
  const prim = knobs.filter(function (it) { return it.primary === true; });
  const pick = prim.length ? prim : knobs;
  return pick.slice(0, 4);
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `sorted(...)` | 칸 번호(slot_index) 차례로 정리합니다 |
| `list.map(function (d) { return cardHtml(...); }).join('')` | 카드 글을 하나로 이어 붙입니다 |
| `(list.length ? '' : 'No instrument ...')` | 악기가 없을 때만 안내 글을 넣습니다 |
| `if (i) parts.push(...)` | 첫 카드 앞에는 화살표를 넣지 않습니다 |
| `data-kind="INSTRUMENT"` | ＋ 버튼이 무엇을 붙일지 적어 둡니다 |
| `list.slice().sort(...)` | 원본 목록 차례는 그대로 두고 사본만 정리합니다 |
| `name.replace(/[^A-Za-z0-9]/g, '')` | 글자가 아닌 것을 지워 아트 글자를 만듭니다 |
| `pick.slice(0, 4)` | 핵심 노브는 최대 네 개입니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 악기는 나란한 카드 묶음 | 여러 악기가 같은 노트를 함께 연주하므로 차례가 곧 겹 차례입니다 |
| 이펙트는 사슬 모양 | 소리가 카드를 차례로 지나므로 `→` 로 흐름을 보여 줍니다 |
| 끝에 ＋ 를 둠 | 새 카드가 늘 마지막 칸에 붙기 때문입니다 (FR-263) |
| 아트가 없으면 두 글자 | 시드 플러그인 7종은 그림 파일이 없어 빈 자리를 글자로 채웁니다 |
| `primary` 를 먼저 봄 | 카드는 핵심 노브만 보여 주고, 나머지는 상세 모달에서 다룹니다 |

## 5. 시험
시험 프로젝트에서 Bass Synth 칸에 악기 카드 1장과 `＋ Add instrument`, 이펙트 카드 2장이 `Compressor → EQ3` 차례로 화살표와 함께 나오는 것을 확인했습니다. EQ3 카드의 핵심 노브는 Low · Mid · High 3개였고, 플러그인 표의 `primary` 표시와 일치했습니다.
