# JavaScript 245 — 트랙과 장치 읽기, 미리 읽기 (`loadTracks` · `loadDevices` · `preloadDevices` · `syncTrackSubs`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 트랙 목록과 트랙별 악기·이펙트를 서버에서 읽습니다 (FR-245 · FR-251) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 244 주소의 프로젝트 번호와 플러그인 표 · 246 트랙 줄 그리기 |

## 1. 하는 일
`loadTracks` 는 `GET /projects/{id}/tracks` 로 트랙 목록을 읽습니다. `loadDevices` 는 트랙 하나의 `GET /tracks/{id}/instruments` 와 `GET /tracks/{id}/plugins` 를 함께 읽어 `devices[track_id]` 에 담습니다. `preloadDevices` 는 **모든 트랙**의 장치를 네 개씩 나눠 미리 읽습니다. 그래야 줄 아래 작은 글과 아래 믹서 줄에 악기 이름이 펼치기 전에도 보입니다. `syncTrackSubs` 는 미리 읽기가 끝난 뒤 그 이름들을 다시 씁니다.

```
loadTracks()                 프로젝트 트랙 목록
loadDevices(track)           트랙 하나의 악기 + 이펙트
preloadDevices(tracks)       모든 트랙을 네 개씩 나눠 미리 읽기
      └─ syncTrackSubs()     줄 아래 글 · 믹서 줄 이름 다시 쓰기
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `initDevices` (243) | 트랙 목록과 미리 읽기에 씁니다 |
| `ensureLiveCells` (250) | 값이 아직 없으면 `loadDevices` 로 읽습니다 |
| `addDevice` · `removeDevice` · `moveEffect` (260) | 값을 고친 뒤 `refreshCells` 로 다시 그립니다 |
| `toggleBypass` · `toggleSolo` (261) | 켜고 끈 뒤 카드만 다시 그립니다 |

## 3. 코드
```js
export async function loadTracks() {
  const res = await api.get('/projects/' + encodeURIComponent(projectId) + '/tracks');
  tracks = (res && res.items) || [];
  return tracks;
}

export async function loadDevices(track) {
  const id = track.track_id;
  const both = await Promise.all([
    api.get('/tracks/' + id + '/instruments'),
    api.get('/tracks/' + id + '/plugins'),
  ]);
  devices[id] = { instruments: both[0] || [], effects: both[1] || [] };
  return devices[id];
}

export function preloadDevices(list) {
  const queue = (list || []).slice();
  function worker() {
    const track = queue.shift();
    if (!track) return Promise.resolve();
    if (devices[track.track_id]) return worker();
    return loadDevices(track).catch(function () { return null; }).then(worker);
  }
  const width = Math.min(4, Math.max(1, queue.length));
  const workers = [];
  for (let i = 0; i < width; i += 1) workers.push(worker());
  return Promise.all(workers).then(function () { return undefined; });
}

function syncTrackSubs() {
  tracks.forEach(function (track) {
    const row = rowOf(track);
    if (!row) return;
    const small = row.querySelector('.sq-track__name small');
    if (small) small.textContent = trackInfo(track).sub;
  });
  renderMixerStrips();
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `encodeURIComponent(projectId)` | 주소에 넣을 수 없는 글자를 안전하게 바꿉니다 |
| `Promise.all([...])` | 두 요청을 함께 보내고 둘 다 끝날 때까지 기다립니다 |
| `both[0]` · `both[1]` | 악기 목록과 이펙트 목록입니다 (각각 배열) |
| `queue.shift()` | 줄 맨 앞 하나를 꺼냅니다 |
| `worker()` 안에서 `worker()` | 앞 트랙을 마치면 다음 트랙을 이어서 읽습니다 |
| `Math.min(4, ...)` | 한 번에 최대 네 줄기만 돌립니다 |
| `Promise.resolve()` | 더 읽을 트랙이 없으면 끝난 것으로 칩니다 |
| `.catch(function () { return null; })` | 한 트랙이 실패해도 나머지는 계속 읽습니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 트랙별로 따로 읽음 | 서버에 트랙 장치를 한꺼번에 주는 길이 없습니다 |
| 네 줄기로 나눔 | 트랙이 많아도 요청이 한꺼번에 몰리지 않습니다 |
| 이미 읽은 트랙은 건너뜀 | 펼쳐서 이미 읽은 트랙을 다시 읽지 않습니다 |
| 실패를 삼킴 | 한 트랙의 오류로 줄 전체가 멈추면 안 됩니다 |
| 미리 읽기 뒤 이름 다시 쓰기 | 그리는 시점에는 값이 없어 "No instrument" 로 남기 때문입니다 |

## 5. 시험
시험 프로젝트(트랙 6개)에서 줄 아래 글이 처음부터 `🎹 Subtractive Synth` 로 보이는 것을 확인했습니다. 미리 읽기를 넣기 전에는 펼치기 전까지 `🎹 No instrument` 로 남았습니다.
