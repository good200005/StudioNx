# JavaScript 251 — 펼침 칸 안 네 칸 그리기 (`renderCells` · `refreshCells`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: Instrument · Effects · Connect · Mixer 네 칸을 값으로 채웁니다 (FR-241 · FR-252) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 250 펼친 트랙의 칸 채우기 · 252 악기 칸과 이펙트 칸 HTML |

## 1. 하는 일
`renderCells` 는 칸 하나(`.sq-acc`) 안의 네 칸을 모두 다시 그립니다. 악기 칸은 트랙 종류에 따라 MIDI 면 Nyxi 카드 목록, AUDIO 나 그룹이면 안내 글을 넣습니다. 이펙트 칸은 카드 사슬을, 믹서 칸은 페이더와 팬을 넣습니다. Connect 칸은 다음 작업(S1-10) 예고 글만 넣습니다. 마지막에 칸 안 조작을 연결하고(`wireControls`) 미터를 돌립니다. `refreshCells` 는 값이 바뀐 뒤 그 트랙의 칸만, 그리고 줄 아래 글과 믹서 줄을 다시 그립니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `ensureLiveCells` (250) | 칸을 처음 채울 때 부릅니다 |
| `preloadDevices` 뒤 | `refreshCells` 로 줄 아래 글까지 갱신합니다(`syncTrackSubs`) |
| `addDevice` · `removeDevice` · `moveEffect` (260) | 붙이거나 뗀 뒤 다시 그립니다 |
| `saveDeviceModal` (261) · `applyPreset` (261) | 저장한 값으로 다시 그립니다 |

## 3. 코드
```js
export function renderCells(acc, track) {
  const loading = !devices[track.track_id];
  const kind = track.track_type;
  const midi = kind === 'MIDI';
  const inst = cellOf(acc, ['Instruments', 'Instrument']);
  if (inst) {
    const h3 = inst.querySelector(':scope > h3');
    if (h3) {
      h3.innerHTML = midi
        ? 'INSTRUMENTS <span class="sq-badge">MIDI</span><span class="sq-cell__note">same notes → layers</span>'
        : 'INSTRUMENTS <span class="sq-badge">' + esc(kind) + '</span>';
    }
    if (loading) setCellBody(inst, '<p class="sq-cell__hint">Loading…</p>');
    else if (midi) setCellBody(inst, instrumentsHtml(track));
    else setCellBody(inst, '<p class="sq-cell__hint">' + (kind === 'AUDIO'
      ? 'Drop a clip on this track to load a sample — sample settings come with S1-10'
      : 'This track has no instrument — effects and mixer still work') + '</p>');
  }
  const fx = cellOf(acc, ['Effects']);
  if (fx) {
    const h3 = fx.querySelector(':scope > h3');
    if (h3) h3.innerHTML = 'EFFECTS <span>signal → · drag ⠿ to reorder</span>';
    setCellBody(fx, loading ? '<p class="sq-cell__hint">Loading…</p>' : effectsHtml(track));
  }
  const mix = cellOf(acc, ['Mixer']);
  if (mix) setCellBody(mix, mixerHtml(track));
  const conn = cellOf(acc, ['Connect to another']);
  if (conn) {
    const h3 = conn.querySelector(':scope > h3');
    if (h3) h3.textContent = 'CONNECT TO ANOTHER';
    setCellBody(conn, '<p class="sq-cell__hint">Linking this track to another one is saved in the next work unit (S1-10, FR-247)</p>');
  }
  wireControls(acc, track);
  startMeters();
}

/** 고친 뒤 그 트랙의 칸만 다시 그리기 (구조가 바뀔 때 — 붙이기 · 떼기 · 순서 · 프리셋) */
function refreshCells(track) {
  const acc = accOf(track);
  if (acc && acc.classList.contains('is-live')) renderCells(acc, track);
  const row = rowOf(track);
  if (row) {
    const small = row.querySelector('.sq-track__name small');
    if (small) small.textContent = trackInfo(track).sub;
  }
  renderMixerStrips();
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `const loading = !devices[track.track_id]` | 값이 없으면 `Loading…` 을 씁니다 |
| `midi ? ... : ...` | MIDI 트랙만 악기 카드를 그립니다 |
| `esc(kind)` | 트랙 종류 글자를 안전하게 배지에 넣습니다 |
| `cellOf(acc, ['Instruments', 'Instrument'])` | 이름이 두 가지라 두 후보를 넘깁니다 |
| `setCellBody(fx, loading ? ... : effectsHtml(track))` | 읽는 중이면 안내 글, 끝났으면 카드 사슬 |
| `acc.classList.contains('is-live')` | 실제 칸일 때만 다시 그립니다 |
| `renderMixerStrips()` | 아래 칸 믹서 줄도 함께 갱신합니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 트랙 종류로 가름 | AUDIO 트랙에 악기 카드 자리를 만들면 빈 칸처럼 보입니다 |
| Connect 칸을 예고로 | 링크 저장은 다음 작업이라 빈 칸 대신 설명을 둡니다 (FR-247) |
| `refreshCells` 를 나눔 | 구조가 바뀔 때만 전체를 다시 그리고, 노브 값만 바뀔 때는 그리지 않습니다 |
| 줄 아래 글도 함께 | 악기를 붙이거나 떼면 이름 글이 바뀌어야 합니다 |

## 5. 시험
시험 프로젝트에서 MIDI 트랙(Bass Synth)을 펼치면 악기 칸에 `INSTRUMENTS MIDI same notes → layers` 머리와 카드 1장, 이펙트 칸에 `EFFECTS signal → · drag ⠿ to reorder` 머리와 카드 2장이 나오는 것을 확인했습니다. 이펙트를 뗀 뒤 카드가 1장으로 줄고 줄 아래 글과 믹서 줄 FX 수가 함께 바뀌는 것도 확인했습니다.
