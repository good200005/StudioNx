// 시퀀서 오토메이션 레인 (S1-15 항목 c) — 트랙마다 대상(볼륨 · 팬 · 악기/이펙트 노브)을 고르고 곡선을 서버에 저장
// - 대상 선택기는 Ableton 의 Device / Parameter chooser 처럼 트랙 줄 오른쪽 위에 둡니다 (오토메이션 모드에서만 보임)
// - 곡선 편집(점 찍기 · 끌기 · ↕ 곡선)은 sequencer-automation.js 가 맡고, 여기서는 값 단위 변환과 저장만 합니다
// - 재생은 audio/automation.js 가 getLanes() 로 읽은 점에서 지금 위치의 값을 구해 소리에 덮어씁니다
// - 점 값은 0~1 로 화면에 그리고, 서버에는 실제 단위(볼륨 dB, 팬 -1~1, 노브는 그 노브의 값)로 보냅니다

import { api } from '../core/api.js';
import { playbackInstruments, playbackEffects, playbackTracks } from './sequencer-devices.js';
import { renderAutomation } from './sequencer-automation.js';

const TICKS_PER_BAR = 3840;
const MIN_BARS = 64;
const SAVE_DELAY_MS = 400;
const RANGES = { VOLUME: [-60, 6], PAN: [-1, 1] };

let lanes = [];                 // 서버 레인 (track_id, target_type, track_plugin_id, track_instrument_id, param_index, is_enabled, points[{tick,value,curve}])
const choice = {};              // 트랙 번호 → 고른 대상 키
const timers = {};              // 대상 키 → 저장 예약

/** 프로젝트 불러오기: GET /full 의 automation 을 담음 */
export function setLanes(list) {
  lanes = (list || []).map(function (l) {
    return Object.assign({}, l, { points: (l.points || []).map(function (p) {
      return { tick: Number(p.tick), value: Number(p.value), curve: Number(p.curve) || 0 };
    }) });
  });
}

/** 재생이 읽는 레인 목록 */
export function getLanes() {
  return lanes;
}

/** 대상 키: 'VOLUME' | 'PAN' | 'I:<악기층 번호>:<칸>' | 'D:<이펙트 번호>:<칸>' */
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

function findLane(trackId, key) {
  const t = parseKey(key);
  return lanes.filter(function (l) {
    return String(l.track_id) === String(trackId) && l.target_type === t.type
      && (t.type === 'INSTRUMENT_PARAM'
        ? (l.track_instrument_id == null ? null : Number(l.track_instrument_id))
        : (l.track_plugin_id == null ? null : Number(l.track_plugin_id))) === t.pluginId
      && (l.param_index == null ? null : Number(l.param_index)) === t.index;
  })[0] || null;
}

/** 트랙에서 고를 수 있는 대상 목록 [{key, label, lo, hi, now}] — 숫자 노브만 */
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

const clamp01 = function (v) { return Math.min(Math.max(v, 0), 1); };

/** 레인(서버 단위) → 화면 점 [[마디, 0~1, 곡선], …] */
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

/** 화면 점 → 서버 단위 점 */
function fromView(points, tg) {
  return points.map(function (p) {
    return {
      tick: Math.round(p[0] * TICKS_PER_BAR),
      value: Math.round((tg.lo + p[1] * (tg.hi - tg.lo)) * 10000) / 10000,
      curve: Math.round((p[2] || 0) * 100) / 100,
    };
  });
}

function barsFor(lane) {
  let bars = MIN_BARS;
  if (lane && lane.points.length) bars = Math.max(bars, Math.ceil(lane.points[lane.points.length - 1].tick / TICKS_PER_BAR) + 4);
  return bars;
}

function trackList() {
  return playbackTracks();
}

/** 트랙 한 줄의 오토메이션 클립을 다시 만듦 */
function showLane(row, track) {
  const old = row.querySelector('.sq-auto');
  if (old) old.remove();
  const lane = row.querySelector('.sq-track__lane');
  if (!lane) return;
  const list = targetsFor(track);
  let key = choice[track.track_id];
  if (!key || !list.some(function (t) { return t.key === key; })) {
    const own = lanes.filter(function (l) { return String(l.track_id) === String(track.track_id); })[0];
    key = own && list.some(function (t) { return t.key === targetOfLane(own); }) ? targetOfLane(own) : 'VOLUME';
    choice[track.track_id] = key;
  }
  const tg = list.filter(function (t) { return t.key === key; })[0];
  const existing = findLane(track.track_id, key);
  const bars = barsFor(existing);
  const clip = document.createElement('div');
  clip.className = 'sq-auto';
  clip.setAttribute('role', 'group');
  clip.setAttribute('aria-label', 'Automation ' + tg.label);
  clip.style.setProperty('--s', '0');
  clip.style.setProperty('--l', String(bars));
  clip.dataset.real = '1';
  clip.dataset.trackId = String(track.track_id);
  clip.dataset.target = key;
  clip.dataset.points = JSON.stringify(toView(existing, tg, bars, tg.now));
  clip.innerHTML = '<b>⤴ ' + tg.label.replace(/</g, '&lt;') + '</b>';
  lane.append(clip);
  renderAutomation(clip);
}

function fillPicker(row, track) {
  const lane = row.querySelector('.sq-track__lane');
  if (!lane) return;
  let box = lane.querySelector('.sq-auto-pick');
  if (!box) {
    box = document.createElement('span');
    box.className = 'sq-auto-pick';
    box.innerHTML = '<select aria-label="Automation target"></select>'
      + '<button type="button" class="sq-auto-clear" title="Delete this automation">×</button>';
    ['pointerdown', 'mousedown', 'click', 'dblclick'].forEach(function (ev) {
      box.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    box.querySelector('select').addEventListener('change', function (e) {
      choice[track.track_id] = e.target.value;
      showLane(row, currentTrack(track.track_id) || track);
    });
    box.querySelector('.sq-auto-clear').addEventListener('click', function () {
      clearLane(track.track_id, choice[track.track_id]);
      showLane(row, currentTrack(track.track_id) || track);
    });
    lane.append(box);
  }
  const sel = box.querySelector('select');
  const list = targetsFor(track);
  sel.innerHTML = list.map(function (t) {
    const has = findLane(track.track_id, t.key) ? ' ●' : '';
    return '<option value="' + t.key + '">' + t.label.replace(/</g, '&lt;') + has + '</option>';
  }).join('');
}

function currentTrack(trackId) {
  return trackList().filter(function (t) { return String(t.track_id) === String(trackId); })[0] || null;
}

/** 오토메이션 모드를 켤 때: 모든 트랙 줄에 선택기와 곡선을 만듦 (예시 화면의 가짜 곡선은 지움) */
export function buildLanes() {
  document.querySelectorAll('.sq-auto:not([data-real])').forEach(function (el) { el.remove(); });
  trackList().forEach(function (track) {
    if (track.track_type === 'MASTER') return;
    const row = document.querySelector('.sq-track[data-track-id="' + track.track_id + '"]');
    if (!row) return;
    fillPicker(row, track);
    const sel = row.querySelector('.sq-auto-pick select');
    showLane(row, track);
    if (sel) sel.value = choice[track.track_id];
  });
}

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

/** sequencer-automation.js 의 점 변화 → 상태에 반영하고 저장을 예약 (끌고 있는 동안 여러 번 와도 한 번만 보냄) */
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
    lanes.push({
      track_id: Number(trackId), target_type: t.type,
      track_plugin_id: t.type === 'DEVICE_PARAM' ? t.pluginId : null,
      track_instrument_id: t.type === 'INSTRUMENT_PARAM' ? t.pluginId : null,
      param_index: t.index, is_enabled: true, points: points,
    });
  }
  const id = trackId + '|' + key;
  clearTimeout(timers[id]);
  timers[id] = setTimeout(function () {
    put(trackId, key, points).catch(function (err) { if (window.console) console.warn('[automation] save failed', err); });
  }, SAVE_DELAY_MS);
}
