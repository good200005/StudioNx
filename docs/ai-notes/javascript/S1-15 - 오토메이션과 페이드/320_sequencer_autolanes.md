# JavaScript 320 — 오토메이션 레인 화면과 저장 (`pages/sequencer-autolanes.js`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-autolanes.js` |
| 작업 | S1-15 오토메이션과 페이드: 트랙마다 오토메이션 대상을 고르고, 곡선을 서버 단위로 바꿔 저장 |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 319 값 계산, 다음 321 클립 페이드 편집 |

## 1. 하는 일

오토메이션 모드(`Automation A`)를 켜면 모든 트랙 줄에 "대상 선택기"와 "곡선 클립"이 나타납니다. 점을 찍고 끄는 일은 기존 `sequencer-automation.js`가 맡고, 이 파일은 그 앞뒤를 맡습니다.

| 맡은 일 | 설명 |
|---|---|
| 대상 목록 | 트랙 볼륨, 팬, 그 트랙 악기와 이펙트의 숫자 노브를 나열합니다. |
| 단위 변환 | 화면은 0~1 비율로 그리고, 서버에는 실제 단위(dB, -1~1, 노브 값)로 보냅니다. |
| 저장 | 점이 바뀌면 400ms 뒤 한 번 `PUT /tracks/{id}/automation`으로 보냅니다. |
| 삭제 | 선택기 옆 `×` 버튼이 그 대상의 레인을 지웁니다. |
| 재생용 상태 | `getLanes()`로 읽은 레인을 재생이 씁니다 (319). |

```text
오토메이션 모드 켜기
  buildLanes()
    트랙마다: fillPicker (선택기) → showLane (곡선 클립)
       targetsFor(track)       고를 수 있는 대상 목록
       findLane                이미 저장된 레인이 있으면 그 점을 씀
       toView                  서버 단위 → 0~1 비율, 양끝(0마디, 끝 마디)에 기준점 추가
점을 찍거나 끌면
  sequencer-automation.js 가 변화를 알림 → onAutomationChange(change)
    fromView                   0~1 비율 → 서버 단위, 반올림
    상태(lanes) 갱신 + 400ms 뒤 put()
```

## 2. 언제 쓰나

| 쓰는 곳 | 하는 일 |
|---|---|
| 프로젝트 불러오기 | `/full`의 `automation`을 `setLanes`로 넣습니다. |
| 오토메이션 모드 켜기 | `buildLanes`로 선택기와 곡선을 만듭니다. |
| 점 변화 | `onAutomationChange`가 저장을 예약합니다. |
| 재생 | `getLanes`로 레인을 읽습니다. |

## 3. 코드

### 3.1 대상 키

대상 하나를 문자열 키로 나타냅니다.

| 키 | 뜻 |
|---|---|
| `VOLUME`, `PAN` | 트랙 볼륨, 팬 |
| `I:<악기 번호>:<칸>` | 악기 노브 (`track_instrument_id`) |
| `D:<이펙트 번호>:<칸>` | 이펙트 노브 (`track_plugin_id`) |

```javascript
function targetOfLane(l) {
  if (l.target_type === 'INSTRUMENT_PARAM') return 'I:' + l.track_instrument_id + ':' + l.param_index;
  if (l.target_type === 'DEVICE_PARAM') return 'D:' + l.track_plugin_id + ':' + l.param_index;
  return l.target_type;
}

function parseKey(key) {
  if (key === 'VOLUME' || key === 'PAN') return { type: key, pluginId: null, index: null };
  const p = key.split(':');
  return { type: p[0] === 'I' ? 'INSTRUMENT_PARAM' : 'DEVICE_PARAM', pluginId: Number(p[1]), index: Number(p[2]) };
}
```

악기 번호와 이펙트 번호는 서로 다른 테이블의 번호이므로 키 앞의 `I`, `D`로 구분합니다 (같은 숫자가 겹칠 수 있습니다).

### 3.2 대상 목록 `targetsFor(track)`

```javascript
const RANGES = { VOLUME: [-60, 6], PAN: [-1, 1] };

export function targetsFor(track) {
  const out = [
    { key: 'VOLUME', label: 'Mixer › Volume', lo: RANGES.VOLUME[0], hi: RANGES.VOLUME[1], now: Number(track.volume_db) || 0 },
    { key: 'PAN', label: 'Mixer › Pan', lo: RANGES.PAN[0], hi: RANGES.PAN[1], now: Number(track.pan) || 0 },
  ];
  function add(prefix, items) {
    items.forEach(function (it) {
      (it.schema || []).forEach(function (def, idx) {
        if (typeof def.min !== 'number' || typeof def.max !== 'number' || def.max <= def.min) return;
        const params = it.params || {};
        const now = typeof params[def.key] === 'number' ? params[def.key] : def.default;
        out.push({
          key: prefix + ':' + it.id + ':' + idx,
          label: (it.plugin_code || 'plugin') + ' › ' + (def.label || def.key),
          lo: def.min, hi: def.max, now: typeof now === 'number' ? now : def.min,
        });
      });
    });
  }
  add('I', playbackInstruments(track.track_id));
  add('D', playbackEffects(track.track_id));
  return out;
}
```

범위(`min`, `max`)가 숫자인 노브만 고를 수 있습니다. 목록 선택 같은 숫자가 아닌 노브는 곡선으로 움직일 수 없기 때문입니다.

### 3.3 단위 변환

```javascript
function toView(lane, tg, bars, nowValue) {
  const span = tg.hi - tg.lo;
  const pts = lane ? lane.points.slice() : [{ tick: 0, value: nowValue, curve: 0 }];
  const view = pts.map(function (p) {
    return [p.tick / TICKS_PER_BAR, clamp01((p.value - tg.lo) / span), p.curve || 0];
  });
  if (view[0][0] > 0) view.unshift([0, view[0][1], 0]);
  if (view[view.length - 1][0] < bars) view.push([bars, view[view.length - 1][1], 0]);
  return view;
}

function fromView(points, tg) {
  return points.map(function (p) {
    return {
      tick: Math.round(p[0] * TICKS_PER_BAR),
      value: Math.round((tg.lo + p[1] * (tg.hi - tg.lo)) * 10000) / 10000,
      curve: Math.round((p[2] || 0) * 100) / 100,
    };
  });
}
```

레인이 없으면 "지금 값 하나"로 평평한 선을 그립니다. 양끝에 기준점을 더하는 이유는 곡선이 화면 전체를 덮어야 점을 어디에나 찍을 수 있기 때문입니다. 반올림 자릿수는 서버 스키마(`value` 소수 넷째, `curve` 소수 둘째)와 같습니다.

### 3.4 저장과 삭제

```javascript
function put(trackId, key, points) {
  const t = parseKey(key);
  return api.put('/tracks/' + encodeURIComponent(trackId) + '/automation', {
    target_type: t.type,
    track_plugin_id: t.type === 'DEVICE_PARAM' ? t.pluginId : null,
    track_instrument_id: t.type === 'INSTRUMENT_PARAM' ? t.pluginId : null,
    param_index: t.index,
    is_enabled: true,
    points: points,
  });
}

function clearLane(trackId, key) {
  lanes = lanes.filter(function (l) { return !(String(l.track_id) === String(trackId) && targetOfLane(l) === key); });
  clearTimeout(timers[trackId + '|' + key]);
  put(trackId, key, []).catch(function (err) { if (window.console) console.warn('[automation] delete failed', err); });
}

export function onAutomationChange(change) {
  if (!change || change.type !== 'automation' || !change.clip || !change.clip.dataset.real) return;
  const trackId = change.clip.dataset.trackId;
  const key = change.clip.dataset.target;
  const track = currentTrack(trackId);
  if (!track) return;
  const tg = targetsFor(track).filter(function (t) { return t.key === key; })[0];
  if (!tg) return;
  const points = fromView(change.points, tg);
  const t = parseKey(key);
  const lane = findLane(trackId, key);
  if (lane) {
    lane.points = points;
  } else {
    lanes.push({ track_id: Number(trackId), target_type: t.type,
      track_plugin_id: t.type === 'DEVICE_PARAM' ? t.pluginId : null,
      track_instrument_id: t.type === 'INSTRUMENT_PARAM' ? t.pluginId : null,
      param_index: t.index, is_enabled: true, points: points });
  }
  const id = trackId + '|' + key;
  clearTimeout(timers[id]);
  timers[id] = setTimeout(function () {
    put(trackId, key, points).catch(function (err) { if (window.console) console.warn('[automation] save failed', err); });
  }, SAVE_DELAY_MS);
}
```

| 규칙 | 이유 |
|---|---|
| 로컬 `lanes`를 먼저 갱신하고 저장은 400ms 뒤 | 점을 끄는 동안 이벤트가 수십 번 와도 서버 요청은 한 번이며, 재생은 바로 새 곡선을 씁니다. |
| 저장 키는 `트랙|대상` | 서로 다른 대상의 저장 예약이 서로를 취소하지 않습니다. |
| `clip.dataset.real`이 있는 클립만 처리 | 예시 화면의 가짜 곡선은 저장하지 않습니다. |
| 저장 실패는 경고만 남김 | 편집 흐름을 막지 않습니다. 다음 변경에서 다시 저장됩니다. |

### 3.5 최신 문법으로 쓰면

```javascript
// 전통 문법 (실제 코드)
return { tick: Number(p.tick), value: Number(p.value), curve: Number(p.curve) || 0 };
// 최신 문법
return { tick: Number(p.tick), value: Number(p.value), curve: Number(p.curve ?? 0) };

// 전통 문법 (실제 코드)
const own = lanes.filter(function (l) { return String(l.track_id) === String(track.track_id); })[0];
// 최신 문법
const own = lanes.find((l) => String(l.track_id) === String(track.track_id));

// 전통 문법 (실제 코드)
if (window.console) console.warn('[automation] save failed', err);
// 최신 문법
window.console?.warn('[automation] save failed', err);
```
