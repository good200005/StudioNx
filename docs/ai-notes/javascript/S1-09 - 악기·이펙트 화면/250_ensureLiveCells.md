# JavaScript 250 — 펼친 트랙의 칸 채우기 (`ensureLiveCells` · `accOf` · `cellOf` · `setCellBody`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 펼친 트랙의 네 칸을 실제 값으로 채웁니다 (FR-241) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 249 트랙 값 저장 · 251 펼침 칸 안 네 칸 그리기 |

## 1. 하는 일
트랙을 펼치면 예시 칸이 나오는데, 실제 모드에서는 그 칸에 `.is-live` 를 붙이고 **서버 값으로 다시 채워야** 합니다. `ensureLiveCells` 가 그 일을 맡습니다. 값이 아직 없으면 먼저 읽고, 읽은 뒤 칸을 다시 그립니다. `accOf` 는 트랙 줄에 붙은 펼침 칸을 찾고, `cellOf` 는 칸 안에서 이름표로 네 칸 중 하나를 찾고, `setCellBody` 는 칸 머리 글(h3)은 그대로 두고 안쪽만 새로 그립니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `initDevices` (243) | 이미 펼쳐 둔 트랙(`is-open`)마다 부릅니다 |
| `sequencer-arrange.js` | V 버튼으로 트랙을 펼친 뒤 부릅니다 |
| `refreshCells` (251) · `saveDeviceModal` (261) | 칸을 찾을 때 `accOf` 를 씁니다 |

## 3. 코드
```js
export function ensureLiveCells(track) {
  const acc = accOf(track);
  if (!acc) return null;
  acc.classList.add('is-live');
  if (!devices[track.track_id]) {
    renderCells(acc, track);
    // 값이 없으면 먼저 읽고, 읽은 뒤 이 칸만 다시 그립니다 (줄 아래 글 · 믹서 줄까지)
    loadDevices(track).then(function () {
      refreshCells(track);
    }).catch(warn);
    return acc;
  }
  renderCells(acc, track);
  return acc;
}

/** 트랙의 펼침 칸(.sq-acc) 찾기 */
function accOf(track) {
  const row = rowOf(track);
  if (!row) return null;
  const btn = row.querySelector('.sq-expand');
  const id = btn && btn.getAttribute('aria-controls');
  if (id) {
    const acc = document.getElementById(id);
    if (acc) return acc;
  }
  const sib = row.nextElementSibling;
  return sib && sib.classList.contains('sq-acc') ? sib : null;
}

/** 칸 머리(h3)는 그대로 두고 안쪽만 새 HTML 로 바꾸기 */
function setCellBody(cell, html) {
  if (!cell) return;
  const h3 = cell.querySelector(':scope > h3');
  Array.prototype.forEach.call(cell.children, function (child) {
    if (child !== h3) child.remove();
  });
  const box = document.createElement('div');
  box.className = 'sq-cell__body';
  box.innerHTML = html;
  cell.append(box);
}

/** 칸 찾기 — aria-label 이름 여러 개 중 먼저 있는 것 */
function cellOf(acc, names) {
  for (let i = 0; i < names.length; i += 1) {
    const cell = acc.querySelector('[aria-label="' + names[i] + '"]');
    if (cell) return cell;
  }
  return null;
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `acc.classList.add('is-live')` | 실제 모드 표시입니다. 예시 배선과 겹치지 않게 합니다 |
| `if (!devices[track.track_id])` | 아직 안 읽은 트랙인지 봅니다 |
| `loadDevices(track).then(...)` | 읽은 뒤 `refreshCells` 로 다시 그립니다 |
| `btn.getAttribute('aria-controls')` | V 버튼이 가리키는 칸 번호를 꺼냅니다 |
| `row.nextElementSibling` | 바로 다음 형제가 펼침 칸입니다 |
| `':scope > h3'` | 칸의 바로 아래 h3 만 고릅니다 |
| `if (child !== h3) child.remove()` | 머리 글은 남기고 나머지를 걷어냅니다 |
| `names` 배열 | 이름표가 'Instruments' 와 'Instrument' 두 가지라 차례로 봅니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 먼저 그리고 나중에 다시 그림 | 빈 칸이라도 먼저 띄워야 눌러도 반응이 없는 듯한 느낌을 주지 않습니다 |
| 머리 글을 남김 | 제목과 배지(예: `MIDI`, `same notes → layers`)는 값과 상관없습니다 |
| `aria-controls` 를 먼저 봄 | HTML 에 적힌 짝이 가장 믿을 만합니다. 없으면 이웃으로 찾습니다 |
| `is-live` 표시 | 한 화면에 예시 칸과 실제 칸이 섞이므로 이 표시로 갈라 씁니다 |

## 5. 시험
`?projectId=14431` 로 열어 Bass Synth 를 펼쳤을 때 칸에 `.is-live` 가 붙고, 악기 카드 1장과 이펙트 카드 2장(Compressor · EQ3)이 그려지며, 그 전에 `Loading…` 이 잠깐 보이는 것을 확인했습니다. 값이 이미 읽힌 뒤 두 번째로 펼치면 곧바로 카드가 그려졌습니다.
