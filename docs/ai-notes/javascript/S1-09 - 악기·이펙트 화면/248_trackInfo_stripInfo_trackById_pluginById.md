# JavaScript 248 — 줄 아래 글 만들기 (`trackInfo` · `stripInfo` · `trackById` · `pluginById`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 트랙 줄과 믹서 줄에 쓸 이름 글을 만듭니다 (FR-251 · FR-252) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 247 MASTER 줄 맞추기와 트랙 줄 만들기 · 249 트랙 값 저장 |

## 1. 하는 일
트랙 줄 아래에는 그 트랙이 무엇을 연주하는지 짧은 글이 붙습니다. `trackInfo` 는 그 글(`sub`)과 이펙트 개수(`fx`)를 만들고, `stripInfo` 는 아래 칸 믹서 줄에 쓸 제목(`2. Bass Synth`)과 같은 글을 만듭니다. 둘 다 트랙 종류에 따라 다르게 씁니다. 악기가 여럿이면 뒤에 `+1` 처럼 남은 수를 덧붙입니다. `trackById` 와 `pluginById` 는 번호로 트랙과 플러그인을 찾는 작은 도우미입니다.

| 트랙 종류 | 줄 아래 글 (`trackInfo.sub`) | 믹서 줄 글 (`stripInfo.sub`) |
|---|---|---|
| MIDI (악기 있음) | `🎹 Subtractive Synth` | `Subtractive Synth` |
| MIDI (악기 없음) | `🎹 No instrument` | `No instrument` |
| AUDIO | `🎵 Audio track` | `Audio` |
| RETURN | `Return — receives sends` | `Return` |
| GROUP | `Group track` | `No instrument` |
| MASTER | `Main output` | `Main output` |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `buildTrackRow` (247) | 줄을 만들 때 `trackInfo` 를 씁니다 |
| `buildStrip` (254) | 아래 칸 믹서 줄에 `stripInfo` 를 씁니다 |
| `syncTrackSubs` (245) · `refreshCells` (251) | 값이 바뀐 뒤 이 글만 다시 씁니다 |
| `wireCells` (262) · `deviceOfCard` (258) | 눌린 카드가 어느 트랙 것인지 `trackById` 로 찾습니다 |

## 3. 코드
```js
/** 트랙 줄 아래 작은 글 — 악기 이름 (+ 겹 수) 또는 트랙 종류 */
function trackInfo(track) {
  const d = devices[track.track_id] || { instruments: [], effects: [] };
  const first = d.instruments[0];
  const p = first ? pluginById(first.plugin_id) : null;
  let sub;
  if (track.track_type === 'MASTER') sub = 'Main output';
  else if (track.track_type === 'RETURN') sub = 'Return — receives sends';
  else if (track.track_type === 'GROUP') sub = 'Group track';
  else if (track.track_type === 'AUDIO') sub = '🎵 Audio track';
  else sub = p ? '🎹 ' + p.name : '🎹 No instrument';
  if (d.instruments.length > 1) sub += ' +' + (d.instruments.length - 1);
  return { sub: sub, fx: d.effects.length };
}

/** 트랙 줄 · 아래 칸 믹서 줄에서 쓸 이름 정보 */
function stripInfo(track) {
  const d = devices[track.track_id] || { instruments: [], effects: [] };
  const first = d.instruments[0];
  const p = first ? pluginById(first.plugin_id) : null;
  const title = track.track_type === 'MASTER' ? 'MASTER' : (track.order_index + 1) + '. ' + track.name;
  let sub;
  if (track.track_type === 'MASTER') sub = 'Main output';
  else if (p) sub = p.name;
  else if (track.track_type === 'AUDIO') sub = 'Audio';
  else if (track.track_type === 'RETURN') sub = 'Return';
  else sub = 'No instrument';
  if (d.instruments.length > 1) sub += ' +' + (d.instruments.length - 1);
  return { title: title, sub: sub, fx: d.effects.length };
}

/** track_id 로 트랙 찾기 */
function trackById(id) {
  for (let i = 0; i < tracks.length; i += 1) {
    if (String(tracks[i].track_id) === String(id)) return tracks[i];
  }
  return null;
}

/** id 로 플러그인 찾기 */
function pluginById(id) {
  for (let i = 0; i < plugins.length; i += 1) {
    if (plugins[i].plugin_id === Number(id)) return plugins[i];
  }
  return null;
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `devices[track.track_id] \|\| { instruments: [], effects: [] }` | 아직 안 읽은 트랙도 빈 값으로 안전하게 다룹니다 |
| `if / else if` 사슬 | 트랙 종류가 여럿이라 하나만 골라 씁니다 |
| `p ? '🎹 ' + p.name : '🎹 No instrument'` | 악기 표에 있으면 이름, 없으면 안내 글입니다 |
| `sub += ' +' + (d.instruments.length - 1)` | 겹 악기가 남아 있으면 `+1` 처럼 붙입니다 |
| `String(...) === String(...)` | 서버가 숫자와 글자를 섞어 주므로 글자로 맞춰 봅니다 |
| `plugin_id === Number(id)` | 플러그인 번호는 숫자라 숫자로 바꿔 봅니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 두 함수를 나눔 | 줄 아래 글과 믹서 줄 글의 문구가 조금씩 다릅니다 |
| 종류별 문구 | 악기 없는 AUDIO 트랙에 "No instrument" 를 쓰면 오해를 줍니다 |
| `devices` 를 먼저 봄 | 악기 이름을 서버에 또 묻지 않고 담아 둔 값으로 씁니다 |
| 도우미를 따로 둠 | 같은 찾기를 여러 곳에서 써서 한 곳만 고치면 되게 합니다 |

## 5. 시험
시험 프로젝트에서 Bass Synth 줄 아래가 `🎹 Subtractive Synth`(겹 1개라 `+` 없음), Vocal 줄이 `🎵 Audio track`, Drums 줄이 `Group track`, Reverb Bus 줄이 `Return — receives sends` 로 보이는 것을 확인했습니다. 아래 칸 믹서 줄 제목은 `1. Master` 를 뺀 `2. Bass Synth` 형식이었습니다.
