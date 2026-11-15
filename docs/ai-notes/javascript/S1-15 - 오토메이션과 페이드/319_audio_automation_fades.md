# JavaScript 319 — 오토메이션 값과 페이드 배율 계산 (`audio/automation.js`, `audio/fades.js`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/audio/automation.js`, `studionx/frontend/static/js/audio/fades.js` |
| 작업 | S1-15 오토메이션과 페이드: 점 목록에서 지금 위치의 값을 구하고, 클립 페이드의 배율을 계산하는 순수 함수 |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 백엔드 318, 다음 320 오토메이션 레인 화면 |

## 1. 하는 일

두 파일은 화면이나 오디오 장치를 건드리지 않고 숫자만 계산합니다. 입력이 같으면 결과가 같으므로 재생과 내보내기가 같은 함수를 공유할 수 있습니다.

| 함수 | 하는 일 |
|---|---|
| `curveShape(x, curve, rising)` | 두 점 사이 위치 x(0~1)에서의 곡선 모양(0~1)을 구합니다. |
| `valueAtTick(points, tick)` | 점 목록에서 tick 위치의 값을 보간합니다. |
| `overlayTracks(tracks, lanes, tick)` | 트랙 목록에 볼륨과 팬 오토메이션 값을 덮어쓴 새 목록을 돌려줍니다. |
| `overlayItems(items, lanes, trackId, type, tick)` | 이펙트나 악기 항목에 노브 오토메이션 값을 덮어쓴 새 목록을 돌려줍니다. |
| `fadeLengths(clip)` | 클립 길이 안에 들어가도록 다듬은 페이드 길이 두 개를 돌려줍니다. |
| `fadeGainAt(clip, rel)` | 클립 시작에서 `rel` tick 떨어진 곳의 페이드 배율(0~1)을 구합니다. |
| `fadePoints(clip, fromTick, toTick)` | 재생 구간의 배율 변화를 `[tick, 배율]` 목록으로 나열합니다. |

곡선은 지수 모양이고 `curve`가 0이면 직선입니다. 식은 다음과 같습니다.

```text
a = -curve × 6 × (값이 올라가는 구간이면 1, 내려가면 -1)
모양(x) = x                          (|a| 가 거의 0 일 때)
        = (e^(a·x) − 1) / (e^a − 1)  (그 외)
```

화면에서 곡선을 그리는 `sequencer-automation.js`와 페이드 편집 `sequencer-fades.js`도 같은 식(K=6)을 써서, 그린 모양과 들리는 소리가 일치합니다.

## 2. 언제 쓰나

| 쓰는 곳 | 하는 일 |
|---|---|
| `PlaybackSession` (재생 중 매 tick) | `overlayTracks`와 `overlayItems`로 지금 값을 구해 믹서와 이펙트에 반영합니다. |
| 오디오 클립 예약 (`playback.js`) | `fadePoints`로 클립 음량 곡선을 예약합니다. |
| 322 연결 문서 | 위 호출 지점을 정리합니다. |

## 3. 코드

### 3.1 `audio/automation.js`

```javascript
const K = 6;

export function curveShape(x, curve, rising) {
  const a = -(Number(curve) || 0) * K * (rising ? 1 : -1);
  if (Math.abs(a) < 1e-6) return x;
  return (Math.exp(a * x) - 1) / (Math.exp(a) - 1);
}

export function valueAtTick(points, tick) {
  if (!points || !points.length) return null;
  if (tick <= points[0].tick) return Number(points[0].value);
  const last = points[points.length - 1];
  if (tick >= last.tick) return Number(last.value);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (tick >= a.tick && tick < b.tick) {
      const x = (tick - a.tick) / (b.tick - a.tick);
      const s = curveShape(x, a.curve, Number(b.value) > Number(a.value));
      return Number(a.value) + (Number(b.value) - Number(a.value)) * s;
    }
  }
  return Number(last.value);
}
```

첫 점 앞에서는 첫 값을, 마지막 점 뒤에서는 마지막 값을 유지합니다. 구간의 휘어짐은 시작 점(`a`)의 `curve`를 따릅니다.

```javascript
function activeLanes(lanes, trackId, type) {
  return (lanes || []).filter(function (l) {
    return l.is_enabled !== false && String(l.track_id) === String(trackId) && l.target_type === type;
  });
}

export function overlayTracks(tracks, lanes, tick) {
  if (!lanes || !lanes.length) return tracks;
  return tracks.map(function (t) {
    const v = activeLanes(lanes, t.track_id, 'VOLUME')[0];
    const p = activeLanes(lanes, t.track_id, 'PAN')[0];
    if (!v && !p) return t;
    const out = Object.assign({}, t);
    if (v) out.volume_db = valueAtTick(v.points, tick);
    if (p) out.pan = valueAtTick(p.points, tick);
    return out;
  });
}

export function overlayItems(items, lanes, trackId, type, tick) {
  const mine = activeLanes(lanes, trackId, type);
  if (!mine.length) return items;
  return items.map(function (it) {
    const lane = mine.filter(function (l) {
      const owner = type === 'INSTRUMENT_PARAM' ? l.track_instrument_id : l.track_plugin_id;
      return String(owner) === String(it.id);
    });
    if (!lane.length) return it;
    const params = Object.assign({}, it.params);
    lane.forEach(function (l) {
      const def = (it.schema || [])[l.param_index];
      if (def) params[def.key] = valueAtTick(l.points, tick);
    });
    return Object.assign({}, it, { params: params });
  });
}
```

`overlay*`는 원본을 바꾸지 않고 복사본을 돌려줍니다. 원본이 "사용자가 정한 값"으로 남아야 재생이 멈췄을 때 그 값으로 되돌아갈 수 있습니다. `overlayItems`는 악기 레인은 `track_instrument_id`로, 이펙트 레인은 `track_plugin_id`로 항목을 찾습니다. 악기 번호를 이펙트 번호와 비교하면 악기 레인이 영원히 적용되지 않으므로, 종류에 따라 비교 칸을 달리합니다.

### 3.2 `audio/fades.js`

```javascript
import { curveShape } from './automation.js';

const STEPS = 24;

export function fadeLengths(clip) {
  const len = Math.max(0, Number(clip.length_tick) || 0);
  const fin = Math.min(Math.max(0, Number(clip.fade_in_tick) || 0), len);
  const fout = Math.min(Math.max(0, Number(clip.fade_out_tick) || 0), len - fin);
  return [fin, fout];
}

export function fadeGainAt(clip, rel) {
  const len = Number(clip.length_tick) || 0;
  const l = fadeLengths(clip);
  let g = 1;
  if (l[0] > 0 && rel < l[0]) g *= curveShape(Math.max(0, rel) / l[0], clip.fade_in_curve, true);
  if (l[1] > 0 && rel > len - l[1]) g *= curveShape(Math.max(0, len - rel) / l[1], clip.fade_out_curve, true);
  return g;
}

export function fadePoints(clip, fromTick, toTick) {
  const l = fadeLengths(clip);
  if (!l[0] && !l[1]) return [];
  const start = Number(clip.start_tick) || 0;
  const len = Number(clip.length_tick) || 0;
  const ticks = [fromTick];
  function span(a, b) {
    for (let i = 1; i <= STEPS; i++) {
      const t = a + (b - a) * i / STEPS;
      if (t > fromTick && t < toTick) ticks.push(t);
    }
  }
  if (l[0]) span(start, start + l[0]);
  if (l[1]) span(start + len - l[1], start + len);
  ticks.push(toTick);
  ticks.sort(function (a, b) { return a - b; });
  return ticks.map(function (t) { return [t, fadeGainAt(clip, t - start)]; });
}
```

| 규칙 | 이유 |
|---|---|
| 시작 페이드와 끝 페이드의 합이 클립 길이를 넘지 않음 | 두 페이드가 겹치면 음량이 0으로 눌려 소리가 사라집니다. 끝 페이드를 줄입니다. |
| 페이드 하나를 24구간으로 나눔 | 구간마다 직선으로 이으면 귀로 계단이 들리지 않습니다. |
| 페이드 끝 배율은 "올라가는 모양"을 뒤집어 사용 | 나가는 페이드는 `len - rel`을 넣어 같은 식을 재사용합니다. |
| 페이드가 없으면 빈 배열 | 호출하는 쪽이 일반 클립과 같은 경로로 처리합니다. |

### 3.3 최신 문법으로 쓰면

실제 코드는 전통 문법입니다. 학습용으로 최신 문법 버전을 함께 남깁니다.

```javascript
// 전통 문법 (실제 코드)
const fin = Math.min(Math.max(0, Number(clip.fade_in_tick) || 0), len);
// 최신 문법
const fin = Math.min(Math.max(0, Number(clip.fade_in_tick ?? 0)), len);

// 전통 문법 (실제 코드)
if (!points || !points.length) return null;
// 최신 문법
if (!points?.length) return null;

// 전통 문법 (실제 코드)
const def = (it.schema || [])[l.param_index];
// 최신 문법
const def = it.schema?.[l.param_index];
```

| 전통 | 최신 | 뜻 |
|---|---|---|
| `a \|\| b` | `a ?? b` | 앞이 `null`, `undefined`이면 뒤를 씁니다. `\|\|`는 `0`이나 빈 문자열도 거릅니다. |
| `a && a.b` | `a?.b` | 앞이 없으면 `undefined`로 멈춥니다. |
