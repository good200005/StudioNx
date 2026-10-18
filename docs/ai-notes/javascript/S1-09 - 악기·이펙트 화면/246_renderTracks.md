# JavaScript 246 — 트랙 줄 그리기 (`renderTracks`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 서버 트랙으로 #tracks 를 다시 그립니다 (FR-251 · FR-252) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 245 트랙과 장치 읽기 · 247 MASTER 줄 맞추기와 트랙 줄 만들기 |

## 1. 하는 일
`#tracks` 안의 예시 줄과 예시 칸을 걷어내고 서버 트랙으로 다시 채웁니다. `order_index` 차례대로 늘어놓고, MASTER 는 목록에서 빼서 화면 아래에 이미 있는 예시 MASTER 줄을 값만 맞춰 씁니다(FR-252). 펼침 칸을 복제할 본보기 `#acc-2` 는 지우지 않고 감춰 둡니다. 마지막으로 아래 칸 믹서 줄을 다시 그립니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `initDevices` (243) | 트랙을 읽은 뒤 한 번 부릅니다 |
| 트랙을 더하거나 지운 뒤 | arrange 쪽이 목록을 바꾸면 다시 불러야 합니다 |

## 3. 코드
```js
export function renderTracks() {
  const list = document.getElementById('tracks');
  if (!list) return;
  const tpl = document.getElementById('acc-2');

  // 예시 화면의 줄과 칸을 걷어내고, 칸을 복제할 본보기(#acc-2)만 남깁니다
  Array.prototype.forEach.call(list.querySelectorAll(':scope > .sq-track, :scope > .sq-acc'), function (row) {
    if (row === tpl) return;
    row.remove();
  });
  if (tpl) {
    tpl.hidden = true;
    tpl.classList.remove('is-open');
  }

  const ordered = tracks.slice().sort(function (a, b) { return a.order_index - b.order_index; });
  const master = ordered.filter(function (t) { return t.track_type === 'MASTER'; })[0] || null;
  const rest = ordered.filter(function (t) { return t.track_type !== 'MASTER'; });

  let last = null;
  rest.forEach(function (track) {
    const row = buildTrackRow(track, track.order_index);
    if (last) last.insertAdjacentElement('afterend', row);
    else if (tpl) list.insertBefore(row, tpl);
    else list.append(row);
    last = row;
  });

  // MASTER 는 #tracks 밖에 있는 예시 줄을 그대로 씁니다 (늘 맨 아래, FR-252)
  const demoMaster = document.querySelector('.sq-track--master');
  if (demoMaster && master) syncMasterRow(master, demoMaster);

  // 예시 리턴 줄(#tracks 밖)만 감춥니다 — 실제 RETURN 트랙 줄은 그대로 둡니다
  Array.prototype.forEach.call(document.querySelectorAll('.sq-track--return'), function (row) {
    if (list.contains(row)) return;
    row.hidden = true;
  });

  renderMixerStrips();
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `':scope > .sq-track, :scope > .sq-acc'` | #tracks 의 바로 아래 자식만 고릅니다(칸 안쪽은 건드리지 않음) |
| `if (row === tpl) return;` | 복제 본보기 `#acc-2` 는 남깁니다 |
| `.sort(function (a, b) { return a.order_index - b.order_index; })` | 순서 번호가 작은 트랙이 위로 옵니다 |
| `.filter(...)[0] \|\| null` | MASTER 는 하나뿐이라 첫 줄만 씁니다 |
| `last.insertAdjacentElement('afterend', row)` | 앞에 놓은 줄 바로 뒤에 이어 붙입니다 |
| `list.insertBefore(row, tpl)` | 본보기 앞에 끼워 넣습니다 |
| `list.contains(row)` | 그 줄이 #tracks 안에 있는지 봅니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 본보기 칸을 남김 | 실제 트랙마다 칸을 복제해 쓰므로 원본이 필요합니다 |
| MASTER 는 예시 줄 재사용 | 화면 맨 아래 고정 자리와 모양이 이미 잡혀 있습니다 (FR-252) |
| 바깥 예시 리턴 줄만 감춤 | 실제 RETURN 트랙은 목록 안에 세워야 하기 때문입니다 |
| 정렬을 새 배열로 | 원본 `tracks` 차례는 그대로 두어 다른 곳에서도 씁니다 |

## 5. 시험
시험 프로젝트로 열었을 때 `#tracks > .sq-track` 이 5줄(리턴 포함), MASTER 예시 줄이 보이고, 예시 `#acc-1` 이 사라지며 본보기 `#acc-2` 가 감춰진 상태로 남는 것을 확인했습니다.
