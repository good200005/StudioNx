# JavaScript 247 — MASTER 줄 맞추기와 트랙 줄 만들기 (`syncMasterRow` · `buildTrackRow`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 트랙 한 줄의 겉모양(색 · 배지 · M · S · ⏻)을 만듭니다 (FR-251 · FR-252) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 246 트랙 줄 그리기 · 248 줄 아래 글 만들기 |

## 1. 하는 일
`buildTrackRow` 는 트랙 한 줄(`li.sq-track`)을 studioNx.html 의 예시 줄과 같은 모양으로 만듭니다. 이름, 종류 배지(AUDIO · MIDI · RET · GROUP), 색, 펼침 V 버튼, M · S · ● 버튼, 겹 수가 담깁니다. `syncMasterRow` 는 화면에 이미 있는 예시 MASTER 줄에 실제 MASTER 트랙의 번호와 상태를 옮겨 붙입니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `renderTracks` (246) | 목록의 트랙마다 `buildTrackRow`, MASTER 에 `syncMasterRow` 를 씁니다 |
| `sequencer.js` · arrange | 트랙을 새로 만들 때 같은 모양이 필요합니다 |

## 3. 코드
```js
export function buildTrackRow(track, i, master) {
  const li = document.createElement('li');
  li.className = 'sq-track';
  if (master || track.track_type === 'MASTER') li.classList.add('sq-track--master');
  if (track.track_type === 'RETURN') li.classList.add('sq-track--return');
  if (track.track_type === 'GROUP') li.classList.add('sq-track--group');
  li.dataset.trackId = String(track.track_id);
  li.dataset.color = track.track_type === 'AUDIO' ? 'audio' : String((i % 5) + 1);
  if (track.is_enabled === false) li.classList.add('is-off');
  if (track.is_muted) li.classList.add('is-muted');
  const num = master ? '' : (track.order_index + 1) + '. ';
  let badge = '';
  if (master) badge = '<span class="sq-badge">MAIN</span>';
  else if (track.track_type === 'RETURN') badge = '<span class="sq-badge is-group">RET</span>';
  else if (track.track_type === 'GROUP') badge = '<span class="sq-badge is-group">GROUP</span>';
  // ...(MIDI · AUDIO 배지)...
  const info = trackInfo(track);
  li.innerHTML = '...'
    + '<span class="sq-track__name"><b>' + esc(num + track.name) + ' ' + badge + '</b><small>' + esc(info.sub) + '</small></span>'
    + '<span class="sq-msr"><button type="button" class="is-mute" aria-pressed="' + String(!!track.is_muted) + '" aria-label="Mute">M</button>'
    + (master ? '' : '<button type="button" class="is-solo" aria-pressed="' + String(!!track.is_solo) + '" aria-label="Solo">S</button>')
    + (master || track.track_type === 'RETURN' ? '' : '<button type="button" class="is-arm" aria-pressed="false" aria-label="Record arm">●</button>')
    + '</span>\n            </div>\n            <div class="sq-track__lane"><span class="sq-track__note">' + esc(info.note) + '</span></div>';
  return li;
}

function syncMasterRow(track, row) {
  row.dataset.trackId = String(track.track_id);
  const small = row.querySelector('.sq-track__name small');
  if (small) small.textContent = 'Main output';
  const power = row.querySelector('.sq-power');
  if (power) power.setAttribute('aria-pressed', String(track.is_enabled !== false));
  const mute = row.querySelector('.is-mute');
  if (mute) mute.setAttribute('aria-pressed', String(!!track.is_muted));
  row.classList.toggle('is-muted', !!track.is_muted);
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `li.dataset.color` | CSS 가 색을 고르는 데 쓰는 `data-color` 가 됩니다 |
| `i % 5` | 트랙 차례를 1~5 색으로 돌립니다 |
| `master ? '' : ...` | MASTER 에는 솔로와 녹음 버튼을 만들지 않습니다 |
| `aria-pressed` | 버튼이 눌린 상태인지 화면 낭독기에 알립니다 |
| `esc(...)` | 이름에 `<` 같은 글자가 있어도 그대로 글자로 보이게 합니다 |
| `Row.classList.toggle('is-muted', 조건)` | 조건이 참이면 붙이고 거짓이면 뗍니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 예시 줄과 같은 클래스 | CSS 와 arrange 배선을 그대로 다시 씁니다 |
| 종류별 배지 | 한눈에 AUDIO · MIDI · 리턴 · 그룹을 구분합니다 |
| MASTER 에 번호 없음 | MASTER 는 차례 번호를 매기지 않습니다 |
| `aria-pressed` 로 상태 | 저장 값과 화면을 늘 맞춰 두면 눌림 표시가 어긋나지 않습니다 |

## 5. 시험
색 규칙 시험에서 AUDIO 트랙 1개와 나머지 1~5 색 4개가 나오는 것을 확인했고, MASTER 줄 이름이 MASTER 이고 숨겨지지 않은 것을 확인했습니다.
