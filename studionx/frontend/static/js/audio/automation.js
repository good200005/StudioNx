// 오토메이션 값 계산 (S1-15) — 레인의 점(tick, value, curve)에서 지금 tick 의 값을 구해 트랙 · 이펙트 · 악기에 덮어씀.
// 곡선 모양은 화면(sequencer-automation.js)의 valueAt 과 같은 지수 곡선(K=6, curve -1~1)입니다.

const K = 6;

/** 두 점 사이 x(0~1) 위치의 모양 — 화면(sequencer-automation.js)의 shape 와 같은 식: a = -curve × K × (올라가면 1, 내려가면 -1) */
export function curveShape(x, curve, rising) {
  const a = -(Number(curve) || 0) * K * (rising ? 1 : -1);
  if (Math.abs(a) < 1e-6) return x;
  return (Math.exp(a * x) - 1) / (Math.exp(a) - 1);
}

/** 점 목록(tick 순)에서 tick 위치의 값. 첫 점 앞은 첫 값, 마지막 점 뒤는 마지막 값을 유지함 */
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

function activeLanes(lanes, trackId, type) {
  return (lanes || []).filter(function (l) {
    return l.is_enabled !== false && String(l.track_id) === String(trackId) && l.target_type === type;
  });
}

/** 트랙 목록에 볼륨 · 팬 오토메이션을 덮어쓴 새 목록 (원본은 바꾸지 않음) */
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

/** 이펙트 · 악기 항목({id, schema, params})에 노브 오토메이션을 덮어쓴 새 목록 */
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
