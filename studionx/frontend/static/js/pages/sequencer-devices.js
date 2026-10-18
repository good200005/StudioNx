// 시퀀서 — 트랙의 악기·이펙트 칸 (S1-09 화면, FR-241~252 · FR-2181~2189)
// 설명: docs/ai-notes/javascript/S1-09 - 악기·이펙트 화면/ (함수마다 md+PDF, 마지막에 합본 PDF)
//
// 맡는 것
// - ?projectId= 로 프로젝트 트랙을 읽어 #tracks 를 다시 그리고, 펼친 트랙의 Instrument · Effects ·
//   Connect · Mixer 칸을 서버 값으로 그림 (FR-251·252)
// - Nyxi 카드: 아트 자리 · 이름 · 바이패스 · 핵심 파라미터 노브(2~4개) · 프리셋 이름 · 미니 미터 (FR-2181)
// - param_schema 로 만든 파라미터 자동 UI(노브 · 셀렉트 · 토글) — 끌기 · 휠 · 화살표 키 (FR-244·2187)
// - 플러그인 고르기 창(GET /plugins) · 붙이기(POST) · 고치기(PATCH) · 떼기(DELETE) (FR-244·245)
// - 이펙트 순서 바꾸기 — slot_index 를 빈 칸 100 으로 잠깐 비켜 두는 3단계 (UQ(track_id, slot_index)) (FR-263)
// - 상세 설정 모달: 그룹 탭 · 전체 파라미터 · 프리셋 · A/B 비교 · 초기화 (FR-2187·246)
// - 믹서 칸과 아래 칸 믹서 줄: 볼륨 · 팬 · M · S · ● 저장 (FR-252)
//
// 맡지 않는 것
// - Connect to Another 링크 저장 · 표시(track_plugin_links) → S1-10 (FR-2197)
// - 갈래(패처) 보드 → FR-265~ 뒤 작업, 클립 · 패턴 불러오기 → S1-10
// - 소리(Web Audio)와 미터의 진짜 값 → S1-11. 여기서는 재생 중일 때만 흉내 낸 미터를 흔듦
//
// 두 가지 모드 (2026-10-18 결정)
// - 실제 모드: ?projectId= 가 있고 트랙을 읽었음. 고친 값을 모두 서버에 저장. 칸에 .is-live 를 붙여
//   sequencer-ui.js 의 예시(데모) 배선과 겹치지 않게 함
// - 데모 모드: projectId 가 없거나 읽지 못했음. studioNx.html 의 예시 화면을 그대로 두고 노브 · 팬 ·
//   페이더만 화면에서 움직임(저장 없음). 카드 ＋ 를 누르면 안내 알림만 띄움

import { api, ApiError } from '../core/api.js';
import { showToast, isPlaying, restoreOpenPanels } from './sequencer-arrange.js';

/** 순서를 바꿀 때 옮기는 카드를 잠깐 비켜 두는 빈 칸 번호 (UQ(track_id, slot_index) 를 피하려고) */
const OPEN_SLOT = 100;
/** 노브 · 페이더를 위아래로 이만큼 끌면 값 범위 전체를 지나감 (픽셀) */
const DRAG_PIXELS = 150;
/** 노브가 도는 각도 — 가운데가 0, 좌우로 이만큼 (도) */
const KNOB_SWEEP = 135;

let active = false;
let projectId = null;
let plugins = [];
let tracks = [];
/** trackId -> { instruments: [], effects: [] } — 트랙을 펼칠 때 한 번 읽고, 고치면 다시 읽음 */
const devices = {};
/** pluginId -> [preset] — 프리셋 목록 (FR-246) */
const presets = {};
/** 열려 있는 상세 모달 상태 */
let modal = null;
/** 플러그인 고르기 창 상태 */
let picker = null;
/** 끌고 있는 카드 (순서 바꾸기) */
let dragCard = null;
/** 값을 끌고 있는 조작 */
let dragging = null;
/** 미터 흔들기 타이머 */
let meterTimer = 0;

/* ───────────────────────── 시작 · 모드 (243) ───────────────────────── */

/**
 * 시작 (243) — 모드를 정하고, 플러그인 · 트랙을 읽어 그린 뒤 이벤트를 배선합니다.
 * 부르는 곳: sequencer.js (맨 아래 initArrange · initUI 옆)
 * @param {{ onChange?: (change: object) => void }} [options]
 */
export function initDevices(options) {
  const onChange = (options && options.onChange) || function () {};
  projectId = readProjectId();
  active = projectId !== null;

  wireCells(document.getElementById('lanes'), onChange);
  wireDialogs();
  wireDemoControls(document);

  loadPlugins()
    .then(function () {
      if (!active) return null;
      return loadTracks();
    })
    .then(function () {
      if (!active) return;
      renderTracks();
      // FR-261 — 예시 줄을 갈아 끼운 뒤라, 담아 둔 펼침 상태를 실제 트랙 줄에 다시 적용합니다
      restoreOpenPanels();
      Array.prototype.forEach.call(document.querySelectorAll('#tracks > .sq-track.is-open'), ensureLiveCells);
      // 트랙 줄 · 믹서 줄의 악기 이름을 바로 보여 주기 위해 값을 미리 모읍니다
      preloadDevices(tracks).then(syncTrackSubs);
    })
    .catch(function (err) {
      if (err instanceof ApiError && err.status === 401) return;
      active = false;
      showToast('Could not read this project — showing the example screen');
      if (window.console) console.warn('[devices]', err);
    });
}

/**
 * 주소에서 projectId 읽기 (243) — ?projectId=12 는 '12', 없거나 빈 값이면 null
 * @returns {string|null}
 */
export function readProjectId() {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('projectId');
  return raw ? String(raw) : null;
}

/**
 * 플러그인 목록 (FR-244) — GET /plugins?active_only=true
 * @returns {Promise<object[]>}
 */
export async function loadPlugins() {
  const res = await api.get('/plugins?active_only=true');
  plugins = (res && res.items) || [];
  return plugins;
}

/**
 * 프로젝트의 트랙 목록 (FR-251) — GET /projects/{id}/tracks
 * @returns {Promise<object[]>}
 */
export async function loadTracks() {
  const res = await api.get('/projects/' + encodeURIComponent(projectId) + '/tracks');
  tracks = (res && res.items) || [];
  return tracks;
}

/**
 * 트랙 하나의 악기 · 이펙트 읽기 (FR-245) — GET /tracks/{id}/instruments · GET /tracks/{id}/plugins
 * @param {object} track
 * @returns {Promise<{instruments: object[], effects: object[]}>}
 */
export async function loadDevices(track) {
  const id = track.track_id;
  const both = await Promise.all([
    api.get('/tracks/' + id + '/instruments'),
    api.get('/tracks/' + id + '/plugins'),
  ]);
  devices[id] = { instruments: both[0] || [], effects: both[1] || [] };
  return devices[id];
}

/**
 * 모든 트랙의 악기 · 이펙트를 미리 읽기 (FR-245)
 * 트랙 줄 아래 작은 글과 아래 믹서 줄에는 악기 이름이 먼저 보여야 하므로, 펼치기 전에 값을 모읍니다.
 * 동시에 네 개씩만 읽어 서버에 부담을 주지 않습니다. 실패한 트랙은 펼칠 때 다시 읽습니다.
 * @param {object[]} list
 * @returns {Promise<void>}
 */
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

/** 트랙 줄 아래 작은 글 · 믹서 줄 이름을 지금 값에 맞추기 (미리 읽기가 끝난 뒤) */
function syncTrackSubs() {
  tracks.forEach(function (track) {
    const row = rowOf(track);
    if (!row) return;
    const small = row.querySelector('.sq-track__name small');
    if (small) small.textContent = trackInfo(track).sub;
  });
  renderMixerStrips();
}

/* ───────────────────────── 트랙 그리기 (FR-251·252) ───────────────────────── */

/**
 * 트랙 목록 그리기 (FR-251·252) — #tracks 를 서버 트랙으로 다시 채우고 MASTER 는 늘 맨 아래.
 * 펼침 칸 본보기 #acc-1 · #acc-2 는 지우지 않고 목록 끝에 남겨 둡니다(ensureAccordion 이 복제해서 씀).
 */
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

/** 예시 화면의 MASTER 줄을 실제 트랙 값에 맞추기 (data-track-id · 이름 · ⏻ · M) */
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

/**
 * 트랙 한 줄 만들기 (FR-251) — studioNx.html 의 li.sq-track 과 같은 모양
 * @param {object} track
 * @param {number} i              목록 순서 (색 고르기용, MASTER 는 -1)
 * @param {boolean} [master]
 * @returns {HTMLLIElement}
 */
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
  const info = trackInfo(track);
  li.innerHTML = '\n            <div class="sq-track__head">\n'
    + (master ? '' : '<button type="button" class="sq-grip" aria-label="Reorder track" title="Drag to reorder">⠿</button>')
    + '<button type="button" class="sq-power" aria-pressed="' + String(track.is_enabled !== false) + '" aria-label="Track on/off"></button>'
    + '<button type="button" class="sq-expand" aria-expanded="false" aria-label="Open track">V</button>'
    + '<span class="sq-track__name"><b>' + esc(num + track.name) + ' ' + badge + '</b><small>' + esc(info.sub) + '</small></span>'
    + '<span class="sq-msr"><button type="button" class="is-mute" aria-pressed="' + String(!!track.is_muted) + '" aria-label="Mute">M</button>'
    + (master ? '' : '<button type="button" class="is-solo" aria-pressed="' + String(!!track.is_solo) + '" aria-label="Solo">S</button>')
    + (master || track.track_type === 'RETURN' ? '' : '<button type="button" class="is-arm" aria-pressed="false" aria-label="Record arm">●</button>')
    + '</span>\n            </div>\n            <div class="sq-track__lane"><span class="sq-track__note">' + esc(info.note) + '</span></div>';
  return li;
}

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

/** 값 고치기 — PATCH /tracks/{id} (볼륨 · 팬 · M · S · 켜기) */
export async function updateTrack(track, patch) {
  const saved = await api.patch('/tracks/' + track.track_id, patch);
  Object.assign(track, saved);
  return saved;
}

/** 트랙 머리의 M · S · ⏻ 를 눌렀을 때 서버에 저장 (화면은 arrange 가 이미 바꿔 둠 → 다음 틱에 읽음) */
export function syncTrackHead(track) {
  const row = rowOf(track);
  if (!row || !active) return;
  const head = row.querySelector('.sq-track__head');
  if (!head) return;
  const patch = {
    is_enabled: pressed(head, '.sq-power'),
    is_muted: pressed(head, '.is-mute'),
  };
  if (head.querySelector('.is-solo')) patch.is_solo = pressed(head, '.is-solo');
  updateTrack(track, patch).catch(warn);
}

/** 트랙 줄 찾기 */
function rowOf(track) {
  return document.querySelector('.sq-track[data-track-id="' + track.track_id + '"]');
}

/** 버튼이 눌려 있나 */
function pressed(scope, sel) {
  const b = scope.querySelector(sel);
  return !!b && b.getAttribute('aria-pressed') === 'true';
}

/* ───────────────────────── 펼침 칸 그리기 (FR-241) ───────────────────────── */

/**
 * 펼친 트랙의 칸 채우기 (FR-241) — .is-live 를 붙이고 악기 · 이펙트 · 믹서를 서버 값으로 그림.
 * 값이 아직 없으면 먼저 읽고 다시 그림
 * @param {object} track
 * @returns {HTMLElement|null} 펼침 칸(.sq-acc)
 */
export function ensureLiveCells(track) {
  const acc = accOf(track);
  if (!acc) return null;
  acc.classList.add('is-live');
  if (!devices[track.track_id]) {
    renderCells(acc, track);
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

/**
 * 펼침 칸 안 네 칸 그리기 (FR-241) — Instrument · Effects · Connect · Mixer
 * @param {HTMLElement} acc
 * @param {object} track
 */
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
    setCellBody(conn, '<p class="sq-cell__hint">Linking this track to another one is saved in the next work unit (S1-10, FR-2197)</p>');
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

/* ───────────────────────── Nyxi 카드 (FR-2181) ───────────────────────── */

/** 악기 칸 — Nyxi 카드 여러 장 + ＋ (한 트랙에서 같은 노트를 여러 악기가 함께 연주, FR-245) */
function instrumentsHtml(track) {
  const list = sorted((devices[track.track_id] || { instruments: [] }).instruments);
  const cards = list.map(function (d) { return cardHtml('INSTRUMENT', track, d); }).join('');
  return '<div class="sq-istack sq-istack--cards">' + cards
    + '<div class="sq-dev-empty">' + (list.length ? '' : 'No instrument — the note clips play nothing.')
    + '<button type="button" class="is-dev-add" data-kind="INSTRUMENT">＋ Add instrument</button></div></div>';
}

/** 이펙트 칸 — 카드 → 카드, 마지막에 ＋ (FR-263) */
function effectsHtml(track) {
  const list = sorted((devices[track.track_id] || { effects: [] }).effects);
  const parts = [];
  list.forEach(function (d, i) {
    if (i) parts.push('<li class="sq-flow" aria-hidden="true">→</li>');
    parts.push(cardHtml('EFFECT', track, d));
  });
  parts.push('<li><button type="button" class="sq-fx-add is-dev-add" data-kind="EFFECT" aria-label="Add effect after the last one">＋</button></li>');
  return '<ol class="sq-chain">' + parts.join('') + '</ol>'
    + '<p class="sq-cell__hint">Parallel branches and the PATCHER board come later (FR-265)</p>';
}

/** slot_index 순서로 */
function sorted(list) {
  return list.slice().sort(function (a, b) { return a.slot_index - b.slot_index; });
}

/**
 * Nyxi 카드 한 장 (FR-2181) — 아트 자리 · 이름 · 바이패스 · 핵심 파라미터 노브(2~4개) · 프리셋 이름 ·
 * 미니 미터. 악기 카드는 아래에 겹 볼륨 · 팬 · 솔로 줄이 더 붙습니다
 * @param {string} kind  'INSTRUMENT' | 'EFFECT'
 * @param {object} track
 * @param {object} d     track_instruments | track_plugins 줄
 * @returns {string} li HTML
 */
export function cardHtml(kind, track, d) {
  const p = pluginById(d.plugin_id);
  const name = p ? p.name : 'Plugin #' + d.plugin_id;
  const values = withDefaults(p, d.params);
  const prim = primaryItems(p);
  const bypassed = kind === 'EFFECT' && d.is_bypassed;
  const idAttr = kind === 'EFFECT'
    ? ' data-track-plugin-id="' + d.track_plugin_id + '"'
    : ' data-track-instrument-id="' + d.track_instrument_id + '"';
  const knobs = prim.map(function (item) {
    return '<span class="sq-knob" role="slider" tabindex="0" data-param-key="' + esc(item.key) + '"'
      + ' aria-label="' + esc(item.name) + '" aria-valuemin="' + numOr(item.min, 0) + '"'
      + ' aria-valuemax="' + numOr(item.max, 1) + '" aria-valuenow="' + numOr(values[item.key], 0) + '">'
      + '<i style="--a:' + knobAngle(item, values[item.key]) + 'deg"></i>'
      + '<span class="sq-knob__val">' + esc(fmtValue(item, values[item.key])) + '</span>'
      + '<span class="sq-knob__name">' + esc(item.name) + '</span></span>';
  }).join('');
  const mix = kind === 'INSTRUMENT' ? instrumentMixHtml(d) : effectExtraHtml();
  return '<li class="sq-fx sq-fx--dev' + (bypassed ? ' is-bypassed' : '') + '" draggable="' + String(kind === 'EFFECT') + '"'
    + ' data-device-kind="' + kind + '"' + idAttr + '>'
    + '<span class="sq-fx__art" aria-hidden="true">' + artHtml(p) + '</span>'
    + '<div class="sq-fx__head"><span class="sq-fx__grip" aria-hidden="true">' + (kind === 'EFFECT' ? '⠿' : '⏻') + '</span>'
    + '<span class="sq-fx__name">' + esc(name) + '</span>'
    + (kind === 'EFFECT'
      ? '<button type="button" class="sq-fx__power" aria-pressed="' + String(!d.is_bypassed) + '" aria-label="Bypass">🎛</button>'
      : '')
    + '<button type="button" class="sq-fx__del" aria-label="Remove ' + (kind === 'EFFECT' ? 'effect' : 'instrument') + '">✕</button></div>'
    + '<div class="sq-knobs">' + knobs + '</div>'
    + '<span class="sq-fx__preset">Preset: ' + esc(d.__preset || 'Init') + '</span>'
    + mix + '</li>';
}

/** 악기 카드 아래 줄 — 겹 볼륨 · 팬 · 솔로 */
function instrumentMixHtml(d) {
  const db = Number(d.volume_db || 0);
  return '<div class="sq-fx__mix">'
    + '<span class="sq-irow__vol sq-num" role="slider" tabindex="0" data-live="layer-volume"'
    + ' aria-label="Layer volume" aria-valuemin="-60" aria-valuemax="6" aria-valuenow="' + db + '">'
    + '<span class="sq-irow__db sq-num">' + fmtDb(db) + '</span><i style="--v:' + volPct(db) + '%"></i></span>'
    + '<span class="sq-irow__pan" role="slider" tabindex="0" data-live="layer-pan" aria-label="Pan" style="--p:' + panDeg(Number(d.pan || 0)) + 'deg"></span>'
    + '<button type="button" class="sq-irow__solo" aria-pressed="' + String(!!d.is_solo) + '" aria-label="Solo layer">S</button></div>';
}

/** 이펙트 카드 아래 줄 — 미니 미터 (엔진이 붙기 전까지 흉내) */
function effectExtraHtml() {
  return '<span class="sq-fx__mini" aria-hidden="true"><i style="--m:38%"></i><i style="--m:26%"></i><i style="--m:12%"></i></span>';
}

/** 카드 아트 — card_asset 이 있으면 그림, 없으면 이름 두 글자 (시드 7종은 모두 NULL → 글자) */
function artHtml(plugin) {
  if (plugin && plugin.card_asset) return '<img src="' + esc(plugin.card_asset) + '" alt="">';
  const name = plugin ? plugin.name : 'PL';
  return esc(name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'PL');
}

/** 카드에 올릴 핵심 파라미터 — primary=true 노브를 먼저, 2~4개 (없으면 앞의 노브 2개) */
function primaryItems(plugin) {
  const schema = (plugin && plugin.param_schema) || [];
  const knobs = schema.filter(function (it) { return it.type === 'knob'; });
  const prim = knobs.filter(function (it) { return it.primary === true; });
  const pick = prim.length ? prim : knobs;
  return pick.slice(0, 4);
}

/* ───────────────────────── 믹서 칸 (FR-252) ───────────────────────── */

/** 펼침 칸의 믹서 — 볼륨 · 팬 · 미터 (MASTER 는 볼륨만) */
function mixerHtml(track) {
  const db = Number(track.volume_db || 0);
  const master = track.track_type === 'MASTER';
  return '<div class="sq-mixer">'
    + '<div class="sq-vm">'
    + '<span class="sq-fader" role="slider" tabindex="0" data-live="track-volume" aria-label="Volume"'
    + ' aria-valuemin="-60" aria-valuemax="6" aria-valuenow="' + db + '"><i style="--y:' + faderY(db) + '%"></i></span>'
    + '<span class="sq-meter"><i style="--m:0%"></i><i style="--m:0%"></i></span>'
    + '</div>'
    + '<span class="sq-db sq-num">' + fmtDb(db) + '</span>'
    + (master
      ? '<span class="sq-pan">L<i></i>R</span>'
      : '<span class="sq-pan">L<i role="slider" tabindex="0" data-live="track-pan" aria-label="Pan" style="--p:' + panDeg(Number(track.pan || 0)) + 'deg"></i>R</span>'
        + '<span class="sq-sends" title="Sends come with the mixer work unit">A<i style="--a:40deg"></i>B<i style="--a:-10deg"></i></span>')
    + '</div>';
}

/** 아래 칸 믹서 — 실제 트랙마다 줄 하나, MASTER 는 끝에 */
export function renderMixerStrips() {
  if (!active) return;
  const list = document.getElementById('mixer-strips');
  if (!list) return;
  const ordered = tracks.slice().sort(function (a, b) { return a.order_index - b.order_index; });
  const master = ordered.filter(function (t) { return t.track_type === 'MASTER'; })[0] || null;
  list.innerHTML = '';
  ordered.forEach(function (track) {
    if (track.track_type === 'MASTER') return;
    list.append(buildStrip(track, false));
  });
  const old = document.querySelector('#panel-mixer .sq-strip--master');
  if (master) {
    const strip = buildStrip(master, true);
    if (old) old.replaceWith(strip);
    else list.after(strip);
  }
  const head = document.querySelector('#panel-mixer .sq-bottom__head span');
  if (head) head.textContent = list.children.length + ' tracks · MASTER';
}

/** 아래 칸 믹서 줄 하나 만들기 */
function buildStrip(track, master) {
  const db = Number(track.volume_db || 0);
  const info = stripInfo(track);
  const strip = document.createElement('div');
  strip.className = 'sq-strip is-live' + (master ? ' sq-strip--master' : '');
  strip.dataset.trackId = String(track.track_id);
  strip.dataset.color = track.track_type === 'AUDIO' ? 'audio' : '1';
  strip.innerHTML = '<b class="sq-strip__name">' + esc(info.title) + '</b>'
    + '<small class="sq-strip__sub">' + esc(info.sub) + '</small>'
    + '<span class="sq-strip__fx">FX ' + info.fx + '</span>'
    + '<div class="sq-vm"><span class="sq-fader" role="slider" tabindex="0" data-live="track-volume" aria-label="Volume"'
    + ' aria-valuemin="-60" aria-valuemax="6" aria-valuenow="' + db + '"><i style="--y:' + faderY(db) + '%"></i></span>'
    + '<span class="sq-meter"><i style="--m:0%"></i><i style="--m:0%"></i></span></div>'
    + '<span class="sq-db sq-num">' + fmtDb(db) + '</span>'
    + '<span class="sq-pan">L<i' + (master ? '' : ' role="slider" tabindex="0" data-live="track-pan" aria-label="Pan" style="--p:' + panDeg(Number(track.pan || 0)) + 'deg"') + '></i>R</span>'
    + '<span class="sq-msr"><button type="button" class="is-mute" aria-pressed="' + String(!!track.is_muted) + '" aria-label="Mute">M</button>'
    + (master ? '' : '<button type="button" class="is-solo" aria-pressed="' + String(!!track.is_solo) + '" aria-label="Solo">S</button>'
      + '<button type="button" class="is-arm" aria-pressed="false" aria-label="Record arm">●</button>')
    + '</span>';
  return strip;
}

/* ───────────────────────── 값 다듬기 · 표시 ───────────────────────── */

/** 값 범위 안으로 다듬고 step 에 맞추기 (step 0 = 자유) */
export function clampValue(item, v) {
  const min = item && item.min != null ? item.min : 0;
  const max = item && item.max != null ? item.max : 1;
  let out = Math.min(max, Math.max(min, Number(v)));
  const step = item && item.step ? item.step : 0;
  if (step > 0) out = Math.round(out / step) * step;
  return Number(out.toFixed(4)) || 0;
}

/** 값 → 0~1 자리 (log 곡선이면 로그 자리) */
export function normOf(item, v) {
  const min = item && item.min != null ? item.min : 0;
  const max = item && item.max != null ? item.max : 1;
  if (item && item.curve === 'log' && min > 0 && max > min) {
    return Math.log(Number(v) / min) / Math.log(max / min);
  }
  return (Number(v) - min) / ((max - min) || 1);
}

/** 0~1 자리 → 값 */
export function valueOfNorm(item, n) {
  const min = item && item.min != null ? item.min : 0;
  const max = item && item.max != null ? item.max : 1;
  const k = Math.min(1, Math.max(0, n));
  if (item && item.curve === 'log' && min > 0 && max > min) {
    return clampValue(item, min * Math.pow(max / min, k));
  }
  return clampValue(item, min + k * (max - min));
}

/** 값 → 노브 각도 (가운데 0, 좌우 KNOB_SWEEP) */
export function knobAngle(item, v) {
  return Math.round((normOf(item, v) * 2 - 1) * KNOB_SWEEP);
}

/** 값 → 화면에 쓸 글 (단위 · 소수 자리) */
export function fmtValue(item, v) {
  if (!item) return String(v);
  if (item.type === 'toggle') return v ? 'On' : 'Off';
  if (item.type === 'select') return selectLabel(item, v);
  const step = item.step ? item.step : 0;
  const dec = step >= 1 ? 0 : (step >= 0.1 ? 1 : (step >= 0.01 ? 2 : 3));
  const unit = item.unit ? (item.unit === '%' ? ' %' : ' ' + item.unit) : '';
  return Number(v).toFixed(dec) + unit;
}

/** 셀렉트 값 → 보여 줄 이름 */
function selectLabel(item, v) {
  const opts = (item && item.options) || [];
  for (let i = 0; i < opts.length; i += 1) {
    if (String(opts[i].value) === String(v)) return opts[i].label;
  }
  return String(v);
}

/** dB 글자 */
function fmtDb(db) {
  const v = Number(db) || 0;
  return (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
}

/** 겹 볼륨 막대 길이(%) — -60 dB = 0%, +6 dB = 100% */
function volPct(db) {
  return Math.round(((Math.min(6, Math.max(-60, Number(db) || 0)) + 60) / 66) * 100);
}

/** 페이더 손잡이 위치(%) — +6 dB = 0%(위), -60 dB = 100%(아래) */
function faderY(db) {
  return Math.round(((6 - Math.min(6, Math.max(-60, Number(db) || 0))) / 66) * 100);
}

/** 팬(-1 ~ 1) → 각도 */
function panDeg(v) {
  return Math.round(Math.min(1, Math.max(-1, Number(v) || 0)) * KNOB_SWEEP);
}

/** 값에서 쓸 수 있는 숫자 */
function numOr(v, fallback) {
  return v == null ? fallback : Number(v);
}

/** 플러그인의 기본값만 모은 params (붙일 때 · 초기화할 때) */
export function defaultParams(plugin) {
  const out = {};
  const schema = (plugin && plugin.param_schema) || [];
  schema.forEach(function (item) { out[item.key] = item.default; });
  return out;
}

/** 저장된 params 위에 기본값을 깔아 완전한 params 만들기 (빠진 키 채우기) */
export function withDefaults(plugin, saved) {
  const out = defaultParams(plugin);
  if (saved) {
    Object.keys(saved).forEach(function (k) { out[k] = saved[k]; });
  }
  return out;
}

/** 스키마에서 키로 항목 찾기 */
function schemaItem(plugin, key) {
  const schema = (plugin && plugin.param_schema) || [];
  for (let i = 0; i < schema.length; i += 1) {
    if (schema[i].key === key) return schema[i];
  }
  return null;
}

/* ───────────────────────── 조작 — 끌기 · 휠 · 키 (FR-2187) ───────────────────────── */

/**
 * 값을 끌어서 바꾸는 조작 연결 (FR-2187) — 노브 · 페이더 · 팬 · 겹 볼륨 모두 이걸 씁니다.
 * 위로 끌면 커지고, Shift 를 누르면 10배 미세 조정, 휠 한 칸 = step, 화살표 키 · PageUp/Down · Home/End 도 됩니다
 * @param {HTMLElement} el
 * @param {object} cfg  { value, min, max, step, curve, unit, type, name, render(v), commit(v) }
 */
export function bindControl(el, cfg) {
  if (!el || el.dataset.devBound === '1') return;
  el.dataset.devBound = '1';
  el.devCfg = cfg;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  if (!el.hasAttribute('role')) el.setAttribute('role', 'slider');
  el.addEventListener('pointerdown', onControlDown);
  el.addEventListener('pointermove', onControlMove);
  el.addEventListener('pointerup', onControlUp);
  el.addEventListener('pointercancel', onControlUp);
  el.addEventListener('wheel', onControlWheel, { passive: false });
  el.addEventListener('keydown', onControlKey);
  syncAria(el, cfg);
}

/** 조작 하나의 값을 바꾸고 화면 · aria 를 맞춤 (commit=true 면 서버 저장까지) */
export function setControlValue(el, cfg, v, commit) {
  const item = cfg.item || cfg;
  cfg.value = clampValue(item, v);
  if (cfg.render) cfg.render(cfg.value);
  syncAria(el, cfg);
  if (commit && cfg.commit) cfg.commit(cfg.value);
}

/** aria-valuenow · aria-valuetext 맞추기 */
function syncAria(el, cfg) {
  el.setAttribute('aria-valuenow', String(cfg.value));
  const text = cfg.type === 'select' ? cfg.value : fmtValue(cfg.item || cfg, cfg.value);
  el.setAttribute('aria-valuetext', String(text));
}

function onControlDown(e) {
  const cfg = e.currentTarget.devCfg;
  if (!cfg || e.button !== 0) return;
  e.preventDefault();
  dragging = {
    el: e.currentTarget,
    startY: e.clientY,
    startNorm: normOf(cfg.item || cfg, cfg.value),
  };
  e.currentTarget.classList.add('is-drag');
  if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
}

function onControlMove(e) {
  if (!dragging || dragging.el !== e.currentTarget) return;
  const cfg = e.currentTarget.devCfg;
  const item = cfg.item || cfg;
  const fine = e.shiftKey ? 0.1 : 1;
  const dn = ((dragging.startY - e.clientY) * fine) / (cfg.pixels || DRAG_PIXELS);
  setControlValue(e.currentTarget, cfg, valueOfNorm(item, dragging.startNorm + dn), false);
}

function onControlUp(e) {
  if (!dragging || dragging.el !== e.currentTarget) return;
  const cfg = e.currentTarget.devCfg;
  e.currentTarget.classList.remove('is-drag');
  dragging = null;
  if (cfg && cfg.commit) cfg.commit(cfg.value);
}

function onControlWheel(e) {
  const cfg = e.currentTarget.devCfg;
  if (!cfg) return;
  const item = cfg.item || cfg;
  e.preventDefault();
  const step = item.step > 0 ? item.step : (item.max - item.min) / 100;
  const dir = e.deltaY < 0 ? 1 : -1;
  const fine = e.shiftKey ? 0.1 : 1;
  setControlValue(e.currentTarget, cfg, cfg.value + dir * step * fine, true);
}

function onControlKey(e) {
  const cfg = e.currentTarget.devCfg;
  if (!cfg) return;
  const item = cfg.item || cfg;
  const step = item.step > 0 ? item.step : (item.max - item.min) / 100;
  let v = null;
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') v = cfg.value + step;
  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') v = cfg.value - step;
  else if (e.key === 'PageUp') v = cfg.value + step * 10;
  else if (e.key === 'PageDown') v = cfg.value - step * 10;
  else if (e.key === 'Home') v = item.min;
  else if (e.key === 'End') v = item.max;
  if (v === null) return;
  e.preventDefault();
  setControlValue(e.currentTarget, cfg, v, true);
}

/**
 * 한 칸 안의 조작 연결 (FR-2187·245) — 트랙 볼륨 · 팬, 겹 볼륨 · 팬, 카드 노브
 * @param {HTMLElement} scope
 * @param {object} track
 */
export function wireControls(scope, track) {
  Array.prototype.forEach.call(scope.querySelectorAll('[data-live="track-volume"]'), function (el) {
    const box = el.closest('.sq-strip') || el.closest('.sq-cell');
    bindControl(el, {
      item: { min: -60, max: 6, step: 0.1 },
      value: Number(track.volume_db) || 0,
      pixels: 120,
      render: function (v) {
        const bar = el.querySelector('i');
        if (bar) bar.style.setProperty('--y', faderY(v) + '%');
        const text = box && box.querySelector('.sq-db');
        if (text) text.textContent = fmtDb(v);
      },
      commit: function (v) {
        track.volume_db = v;
        updateTrack(track, { volume_db: v }).catch(warn);
      },
    });
  });

  Array.prototype.forEach.call(scope.querySelectorAll('[data-live="track-pan"]'), function (el) {
    bindControl(el, {
      item: { min: -1, max: 1, step: 0.01 },
      value: Number(track.pan) || 0,
      pixels: 100,
      render: function (v) { el.style.setProperty('--p', panDeg(v) + 'deg'); },
      commit: function (v) {
        track.pan = v;
        updateTrack(track, { pan: v }).catch(warn);
      },
    });
  });

  Array.prototype.forEach.call(scope.querySelectorAll('.sq-fx[data-device-kind]'), function (card) {
    const device = deviceOfCard(track, card);
    const plugin = device ? pluginById(device.plugin_id) : null;
    if (!device || !plugin) return;
    const values = withDefaults(plugin, device.params);

    Array.prototype.forEach.call(card.querySelectorAll('.sq-knob[data-param-key]'), function (el) {
      const item = schemaItem(plugin, el.dataset.paramKey + '');
      if (!item) return;
      bindControl(el, {
        item: item,
        value: values[item.key],
        pixels: 130,
        render: function (v) { paintKnob(el, item, v); },
        commit: function (v) {
          const next = withDefaults(plugin, device.params);
          next[item.key] = v;
          device.params = next;
          updateDevice(track, card.dataset.deviceKind, device, { params: next }).catch(warn);
        },
      });
    });

    Array.prototype.forEach.call(card.querySelectorAll('[data-live="layer-volume"]'), function (el) {
      bindControl(el, {
        item: { min: -60, max: 6, step: 0.1 },
        value: Number(device.volume_db) || 0,
        pixels: 100,
        render: function (v) {
          const bar = el.querySelector('i');
          if (bar) bar.style.setProperty('--v', volPct(v) + '%');
          const out = el.querySelector('.sq-irow__db');
          if (out) out.textContent = fmtDb(v);
        },
        commit: function (v) {
          device.volume_db = v;
          updateDevice(track, card.dataset.deviceKind, device, { volume_db: v }).catch(warn);
        },
      });
    });

    Array.prototype.forEach.call(card.querySelectorAll('[data-live="layer-pan"]'), function (el) {
      bindControl(el, {
        item: { min: -1, max: 1, step: 0.01 },
        value: Number(device.pan) || 0,
        pixels: 80,
        render: function (v) { el.style.setProperty('--p', panDeg(v) + 'deg'); },
        commit: function (v) {
          device.pan = v;
          updateDevice(track, card.dataset.deviceKind, device, { pan: v }).catch(warn);
        },
      });
    });
  });
}

/** 카드의 장치 찾기 (devices 캐시에서) */
function deviceOfCard(track, card) {
  const d = devices[track.track_id];
  if (!d) return null;
  if (card.dataset.trackPluginId) {
    const id = Number(card.dataset.trackPluginId);
    return d.effects.filter(function (x) { return x.track_plugin_id === id; })[0] || null;
  }
  const id = Number(card.dataset.trackInstrumentId);
  return d.instruments.filter(function (x) { return x.track_instrument_id === id; })[0] || null;
}

/** 노브 그리기 — 각도와 값 글자 */
export function paintKnob(el, item, v) {
  const ring = el.querySelector('i');
  if (ring) ring.style.setProperty('--a', knobAngle(item, v) + 'deg');
  const out = el.querySelector('.sq-knob__val');
  if (out) out.textContent = fmtValue(item, v);
}

/* ───────────────────────── 플러그인 고르기 창 (FR-244) ───────────────────────── */

/**
 * 플러그인 고르기 창 열기 (FR-244) — 플러그인 표에서 종류에 맞는 것만 보여 주고, 고르면 onPick(plugin)
 * @param {string} kind  'INSTRUMENT' | 'EFFECT'
 * @param {(plugin: object) => void} onPick
 */
export function openPluginPicker(kind, onPick) {
  if (!active || !plugins.length) {
    showToast('Open a project with ?projectId=… to add plugins — this is the example screen');
    return;
  }
  picker = { kind: kind, onPick: onPick };
  const dlg = document.getElementById('plugin-picker');
  const title = document.getElementById('plugin-picker-title');
  const note = document.getElementById('picker-note');
  const search = document.getElementById('picker-search');
  if (title) title.textContent = kind === 'INSTRUMENT' ? 'Choose an instrument' : 'Choose an effect';
  if (note) note.textContent = plugins.length + ' plugins in the Plugins table (FR-244)';
  if (search) search.value = '';
  renderPickerList('');
  if (dlg && dlg.showModal) dlg.showModal();
  if (search) search.focus();
}

/** 고르기 창 목록 그리기 (검색어로 거르기) */
export function renderPickerList(query) {
  const list = document.getElementById('picker-list');
  if (!list || !picker) return;
  const want = picker.kind === 'INSTRUMENT' ? 'INSTRUMENT' : 'EFFECT';
  const q = String(query || '').trim().toLowerCase();
  const found = plugins.filter(function (p) {
    if (p.plugin_type !== want) return false;
    if (!q) return true;
    return p.name.toLowerCase().indexOf(q) >= 0 || String(p.code).toLowerCase().indexOf(q) >= 0;
  });
  if (!found.length) {
    list.innerHTML = '<li class="sq-picker__empty">No plugin matches. Plugins are added to the Plugins table by the admin screen.</li>';
    return;
  }
  list.innerHTML = found.map(function (p) {
    return '<li><button type="button" class="sq-plug" data-plugin-id="' + p.plugin_id + '">'
      + '<span class="sq-plug__art" aria-hidden="true">' + artHtml(p) + '</span>'
      + '<span><span class="sq-plug__name">' + esc(p.name) + '</span><br>'
      + '<span class="sq-plug__sub">' + esc(p.code) + ' · ' + esc(p.engine) + ' · v' + esc(p.version) + ' · '
      + paramSummary(p) + '</span></span>'
      + '<span class="sq-plug__badge">' + esc(p.plugin_type) + '</span></button></li>';
  }).join('');
}

/** 플러그인 파라미터 요약 — "47 parameters · 18 on the card" 처럼 */
function paramSummary(plugin) {
  const schema = plugin.param_schema || [];
  const knobs = schema.filter(function (it) { return it.type === 'knob'; }).length;
  return knobs + ' knobs · ' + primaryItems(plugin).length + ' on the card';
}

/* ───────────────────────── 붙이기 · 고치기 · 떼기 (FR-244·245) ───────────────────────── */

/**
 * 장치 붙이기 (FR-245) — POST /tracks/{id}/instruments (악기) 또는 POST /tracks/{id}/plugins (이펙트).
 * 자리는 지금 것들 뒤, 값은 플러그인 기본값에서 시작
 * @param {object} track
 * @param {string} kind
 * @param {object} plugin
 */
export async function addDevice(track, kind, plugin) {
  const d = devices[track.track_id] || { instruments: [], effects: [] };
  devices[track.track_id] = d;
  const list = kind === 'INSTRUMENT' ? d.instruments : d.effects;
  const body = { plugin_id: plugin.plugin_id, slot_index: tailSlot(list), params: defaultParams(plugin) };
  try {
    const path = kind === 'INSTRUMENT'
      ? '/tracks/' + track.track_id + '/instruments'
      : '/tracks/' + track.track_id + '/plugins';
    const saved = await api.post(path, body);
    list.push(saved);
    refreshCells(track);
    showToast((kind === 'INSTRUMENT' ? 'Instrument' : 'Effect') + ' added: ' + plugin.name);
  } catch (err) {
    warn(err);
  }
}

/**
 * 새 장치를 붙일 자리 (FR-245) — 지금 것들 뒤(가장 큰 slot_index + 1)가 첫 후보입니다.
 * 그 자리가 이미 쓰이거나 127 을 넘으면 빈 칸(0~126) 중 가장 앞 번호를 씁니다
 * @param {object[]} list
 * @returns {number} 0~127
 */
function tailSlot(list) {
  const used = {};
  let top = -1;
  list.forEach(function (x) {
    used[x.slot_index] = true;
    if (x.slot_index > top) top = x.slot_index;
  });
  if (top + 1 <= 126 && !used[top + 1]) return top + 1;
  let n = 0;
  while (used[n] && n < 127) n += 1;
  return n;
}

/**
 * 장치 고치기 (FR-245) — PATCH /tracks/{id}/instruments/{iid} · /tracks/{id}/plugins/{pid}
 * @param {object} track
 * @param {string} kind
 * @param {object} device
 * @param {object} patch  { params, is_bypassed, is_solo, volume_db, pan, slot_index … }
 * @returns {Promise<object|null>} 저장된 줄
 */
export async function updateDevice(track, kind, device, patch) {
  try {
    const path = kind === 'INSTRUMENT'
      ? '/tracks/' + track.track_id + '/instruments/' + device.track_instrument_id
      : '/tracks/' + track.track_id + '/plugins/' + device.track_plugin_id;
    const saved = await api.patch(path, patch);
    Object.assign(device, saved);
    return saved;
  } catch (err) {
    warn(err);
    return null;
  }
}

/**
 * 장치 떼기 (FR-245) — DELETE 같은 경로
 * @param {object} track
 * @param {string} kind
 * @param {object} device
 */
export async function removeDevice(track, kind, device) {
  const plugin = pluginById(device.plugin_id);
  const name = plugin ? plugin.name : 'this device';
  if (window.confirm && !window.confirm('Remove ' + name + '?')) return;
  try {
    const path = kind === 'INSTRUMENT'
      ? '/tracks/' + track.track_id + '/instruments/' + device.track_instrument_id
      : '/tracks/' + track.track_id + '/plugins/' + device.track_plugin_id;
    await api.delete(path);
    const d = devices[track.track_id];
    if (d) {
      const list = kind === 'INSTRUMENT' ? d.instruments : d.effects;
      const at = list.indexOf(device);
      if (at >= 0) list.splice(at, 1);
    }
    refreshCells(track);
    if (modal && modal.device === device) closeDeviceModal();
    showToast(name + ' removed');
  } catch (err) {
    warn(err);
  }
}

/**
 * 이펙트 순서 바꾸기 (FR-263) — UQ(track_id, slot_index) 때문에 옮기는 카드를 빈 칸 100 에 잠깐 두고,
 * 사이 카드들을 한 칸씩 밀거나 당긴 다음 마지막 자리로 옮깁니다
 * @param {object} track
 * @param {number} from  지금 자리 (0부터)
 * @param {number} to    갈 자리 (0부터)
 */
export async function moveEffect(track, from, to) {
  const d = devices[track.track_id];
  if (!d) return;
  const list = sorted(d.effects);
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
  const ids = list.map(function (x) { return x.track_plugin_id; });
  const movedId = ids.splice(from, 1)[0];
  ids.splice(to, 0, movedId);
  try {
    await updateDevice(track, 'EFFECT', list[from], { slot_index: OPEN_SLOT });
    if (to > from) {
      for (let i = from + 1; i <= to; i += 1) {
        await updateDevice(track, 'EFFECT', byId(list, ids[i]), { slot_index: i - 1 });
      }
    } else {
      for (let i = from - 1; i >= to; i -= 1) {
        await updateDevice(track, 'EFFECT', byId(list, ids[i]), { slot_index: i + 1 });
      }
    }
    await updateDevice(track, 'EFFECT', byId(list, movedId), { slot_index: to });
    await loadDevices(track);
    refreshCells(track);
    showToast('Effect order changed');
  } catch (err) {
    warn(err);
    await loadDevices(track).catch(function () {});
    refreshCells(track);
  }
}

/** 목록에서 id 로 찾기 */
function byId(list, id) {
  return list.filter(function (x) { return x.track_plugin_id === id; })[0];
}

/* ───────────────────────── 상세 설정 모달 (FR-2181·2187) ───────────────────────── */

/**
 * 상세 설정 모달 열기 (FR-2181·2187) — 그룹 탭 · 전체 파라미터 · 프리셋 · A/B · 초기화
 * @param {object} track
 * @param {string} kind
 * @param {object} device
 */
export function openDeviceModal(track, kind, device) {
  const plugin = pluginById(device.plugin_id);
  if (!plugin) return;
  const base = withDefaults(plugin, device.params);
  modal = {
    track: track,
    kind: kind,
    device: device,
    plugin: plugin,
    base: base,
    alt: device.__alt || null,
    draft: withDefaults(plugin, device.params),
    sideB: false,
    dirty: false,
  };
  const groups = paramGroups(plugin);
  modal.group = groups[0];
  setText('device-art', artHtml(plugin).replace(/<[^>]*>/g, ''));
  setText('device-title', plugin.name);
  setText('device-sub', (kind === 'INSTRUMENT' ? 'Instrument' : 'Effect') + ' · slot ' + device.slot_index + ' · ' + plugin.engine);
  renderModalTabs(groups);
  renderModalParams();
  loadPresets(plugin).then(fillPresetSelect).catch(warn);
  markDirty(false);
  const dlg = document.getElementById('device-modal');
  if (dlg && dlg.showModal) dlg.showModal();
  updateSideButtons();
}

/** 모달 그룹 탭 그리기 */
function renderModalTabs(groups) {
  const tabs = document.getElementById('device-tabs');
  if (!tabs) return;
  tabs.innerHTML = groups.map(function (g) {
    return '<button type="button" data-group="' + esc(g) + '" class="' + (g === modal.group ? 'is-on' : '') + '">' + esc(g) + '</button>';
  }).join('');
}

/** param_schema 의 group 을 처음 나온 차례대로 (없으면 General) */
function paramGroups(plugin) {
  const out = [];
  ((plugin && plugin.param_schema) || []).forEach(function (item) {
    const g = item.group || 'General';
    if (out.indexOf(g) < 0) out.push(g);
  });
  return out.length ? out : ['General'];
}

/**
 * 모달의 파라미터 칸 그리기 (FR-2187) — 노브 · 셀렉트 · 토글을 param_schema 대로 자동 생성.
 * 값은 초안(modal.draft)에 담고, Save 를 눌러야 서버에 저장합니다
 */
export function renderModalParams() {
  const box = document.getElementById('device-params');
  if (!box || !modal) return;
  const schema = (modal.plugin.param_schema || []).filter(function (item) {
    return (item.group || 'General') === modal.group;
  });
  box.innerHTML = schema.map(function (item) { return paramCellHtml(item); }).join('')
    || '<p class="sq-cell__hint">This plugin has no parameters.</p>';
  schema.forEach(function (item) {
    const cell = box.querySelector('[data-param-cell="' + item.key + '"]');
    if (cell) bindModalParam(cell, item);
  });
}

/** 파라미터 한 칸 — 노브 / 셀렉트 / 토글 */
function paramCellHtml(item) {
  const v = modal.draft[item.key];
  let control;
  if (item.type === 'select') {
    const opts = (item.options || []).map(function (o) {
      return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(v) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
    control = '<select data-modal-param="' + esc(item.key) + '" aria-label="' + esc(item.name) + '">' + opts + '</select>';
  } else if (item.type === 'toggle') {
    control = '<span class="sq-switch" role="switch" tabindex="0" data-modal-param="' + esc(item.key) + '" aria-label="' + esc(item.name) + '" aria-pressed="' + String(!!v) + '"></span>';
  } else {
    control = '<span class="sq-knob" role="slider" tabindex="0" data-modal-param="' + esc(item.key) + '" aria-label="' + esc(item.name) + '"'
      + ' aria-valuemin="' + numOr(item.min, 0) + '" aria-valuemax="' + numOr(item.max, 1) + '" aria-valuenow="' + numOr(v, 0) + '">'
      + '<i style="--a:' + knobAngle(item, v) + 'deg"></i>'
      + '<span class="sq-knob__val">' + esc(fmtValue(item, v)) + '</span></span>';
  }
  return '<div class="sq-param" data-param-cell="' + esc(item.key) + '">' + control
    + '<span class="sq-param__name" title="' + esc(item.key) + '">' + esc(item.name) + '</span></div>';
}

/** 모달 파라미터 하나에 동작 연결 — 고치면 초안에 담고 "Edited" 로 표시 */
function bindModalParam(cell, item) {
  const el = cell.querySelector('[data-modal-param]');
  if (!el) return;
  if (item.type === 'select') {
    el.addEventListener('change', function () { setDraft(item.key, cell.querySelector('select').value); });
    return;
  }
  if (item.type === 'toggle') {
    // 토글은 끌지 않고 누를 때마다 켜짐 · 꺼짐만 바뀝니다
    const flip = function () {
      const next = el.getAttribute('aria-pressed') !== 'true';
      el.setAttribute('aria-pressed', String(next));
      setDraft(item.key, next);
    };
    el.addEventListener('click', flip);
    el.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      }
    });
    return;
  }
  bindControl(el, {
    item: item,
    value: numOr(v0(modal.draft, item.key), 0),
    render: function (v) { paintKnob(el, item, v); },
    commit: function (v) { setDraft(item.key, v); },
  });
}

function v0(obj, key) {
  return obj ? obj[key] : null;
}

/** 초안 값 바꾸기 → 저장 안 된 상태로 표시 */
function setDraft(key, v) {
  if (!modal) return;
  modal.draft[key] = v;
  markDirty(true);
}

/** 저장 여부 표시 */
function markDirty(dirty) {
  modal.dirty = !!dirty;
  const state = document.getElementById('device-state');
  if (state) state.textContent = dirty ? 'Unsaved changes' : 'Saved';
  const save = document.getElementById('device-save');
  if (save) save.classList.toggle('is-dirty', !!dirty);
}

/** 모달 저장 (FR-2187) — 초안을 params 로 PATCH. A/B 비교를 위해 저장 전 값을 B 쪽에 담아 둠 */
export async function saveDeviceModal() {
  if (!modal) return;
  const saved = await updateDevice(modal.track, modal.kind, modal.device, { params: modal.draft });
  if (!saved) return;
  modal.device.__alt = modal.base;
  modal.alt = modal.base;
  modal.base = withDefaults(modal.plugin, modal.device.params);
  modal.draft = Object.assign({}, modal.base);
  markDirty(false);
  refreshCells(modal.track);
  updateSideButtons();
  showToast(modal.plugin.name + ' saved');
}

/** A / B / 초기화 버튼 (FR-246) */
export function updateSideButtons() {
  const ab = document.getElementById('device-ab');
  if (!ab || !modal) return;
  Array.prototype.forEach.call(ab.querySelectorAll('[data-ab]'), function (b) {
    const side = b.dataset.ab;
    const on = side === 'A' ? !modal.sideB : modal.sideB;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

/* ───────────────────────── 프리셋 (FR-246) ───────────────────────── */

/**
 * 프리셋 목록 읽기 (FR-246) — GET /plugins/{id}/presets (한 번 읽고 기억)
 * @param {object} plugin
 * @returns {Promise<object[]>}
 */
export async function loadPresets(plugin) {
  if (presets[plugin.plugin_id]) return presets[plugin.plugin_id];
  const list = await api.get('/plugins/' + plugin.plugin_id + '/presets');
  presets[plugin.plugin_id] = list || [];
  return presets[plugin.plugin_id];
}

/** 프리셋 고르기 <select> 채우기 */
function fillPresetSelect(list) {
  const sel = document.getElementById('device-preset');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Init —</option>' + (list || []).map(function (p) {
    return '<option value="' + p.preset_id + '">' + esc(p.name) + ' (' + esc(p.source) + ')</option>';
  }).join('');
}

/**
 * 프리셋 적용 (FR-246) — 프리셋 params 를 초안에 올림. Save 를 누르면 서버에 저장됩니다
 * @param {number|string} presetId
 */
export function applyPreset(presetId) {
  if (!modal) return;
  const list = presets[modal.plugin.plugin_id] || [];
  const found = list.filter(function (p) { return String(p.preset_id) === String(presetId); })[0];
  if (!found) {
    modal.draft = defaultParams(modal.plugin);
    modal.device.__preset = null;
  } else {
    modal.draft = withDefaults(modal.plugin, found.params);
    modal.device.__preset = found.name;
  }
  markDirty(true);
  renderModalParams();
}

/** 이펙트 카드의 바이패스 켜기/끄기 (FR-263) */
export function toggleBypass(track, card) {
  const device = deviceOfCard(track, card);
  if (!device) return;
  const next = !device.is_bypassed;
  updateDevice(track, 'EFFECT', device, { is_bypassed: next }).then(function (saved) {
    if (saved) refreshCells(track);
  });
}

/** 악기 겹 솔로 켜기/끄기 (FR-245) */
export function toggleSolo(track, card) {
  const device = deviceOfCard(track, card);
  if (!device) return;
  const next = !device.is_solo;
  updateDevice(track, 'INSTRUMENT', device, { is_solo: next }).then(function (saved) {
    if (saved) refreshCells(track);
  });
}

/* ───────────────────────── 이벤트 배선 ───────────────────────── */

/** 펼침 칸 안에서 눌림 · 끌림을 받기 (예시 화면은 건드리지 않음 — .sq-acc.is-live 만) */
function wireCells(lanes, onChange) {
  if (!lanes || lanes.dataset.devWired === '1') return;
  lanes.dataset.devWired = '1';
  lanes.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    const acc = e.target.closest('.sq-acc');
    const live = !!acc && acc.classList.contains('is-live');
    // 펼침 칸(.sq-acc)은 트랙 줄(.sq-track)의 형제이므로 칸 안을 누르면 줄이 잡히지 않습니다.
    // 그때는 칸 바로 앞 줄을 트랙 줄로 씁니다.
    let row = e.target.closest('.sq-track');
    if (!row && acc && acc.previousElementSibling) row = acc.previousElementSibling;
    const track = row && row.classList.contains('sq-track') ? trackById(row.dataset.trackId) : null;

    // 트랙 머리 — 실제 모드면 값을 서버에 저장 (arrange 가 화면을 먼저 바꾸므로 다음 틱에 읽음)
    if (track && b && b.closest('.sq-track__head') && b.matches('.sq-power, .is-mute, .is-solo')) {
      window.setTimeout(function () { syncTrackHead(track); }, 0);
      onChange({ type: 'trackState', trackId: track.track_id });
      return;
    }
    // V — 펼침 칸을 서버 값으로 채우기
    if (track && b && b.matches('.sq-expand')) {
      window.setTimeout(function () { ensureLiveCells(track); }, 0);
      return;
    }
    if (!live || !track) return;

    const card = e.target.closest('.sq-fx');
    if (b) {
      if (b.classList.contains('is-dev-add')) {
        const kind = b.dataset.kind === 'INSTRUMENT' ? 'INSTRUMENT' : 'EFFECT';
        openPluginPicker(kind, function (plugin) { addDevice(track, kind, plugin); });
        return;
      }
      if (card && b.classList.contains('sq-fx__power')) { toggleBypass(track, card); return; }
      if (card && b.classList.contains('sq-fx__del')) {
        const device = deviceOfCard(track, card);
        if (device) removeDevice(track, card.dataset.deviceKind, device);
        return;
      }
      if (card && b.classList.contains('sq-irow__solo')) { toggleSolo(track, card); return; }
    }
    // 카드 몸통 · 악기 줄 이름 클릭 → 상세 설정 모달
    if (card && !e.target.closest('[role="slider"]')) {
      const device = deviceOfCard(track, card);
      if (device) openDeviceModal(track, card.dataset.deviceKind, device);
      return;
    }
    onChange({ type: 'deviceClick' });
  });
  wireChainDrag(lanes);
}

/** ⠿ 를 끌어 이펙트 순서 바꾸기 (FR-263) — 끼울 자리에 보라 선 */
function wireChainDrag(lanes) {
  const line = document.createElement('li');
  line.className = 'sq-fx-insert';

  lanes.addEventListener('dragstart', function (e) {
    const card = e.target.closest('.sq-fx[data-track-plugin-id]');
    if (!card || !card.closest('.sq-acc.is-live')) return;
    const row = card.closest('.sq-acc').previousElementSibling;
    dragCard = card;
    dragCard.__track = row ? trackById(row.dataset.trackId) : null;
    const chain = card.parentElement;
    dragCard.__from = Array.prototype.indexOf.call(chain.querySelectorAll(':scope > .sq-fx'), card);
    card.classList.add('is-dragging');
    e.dataTransfer.setData('text/plain', 'device');
    e.dataTransfer.effectAllowed = 'move';
  });
  lanes.addEventListener('dragover', function (e) {
    if (!dragCard) return;
    const chain = e.target.closest('.sq-chain');
    if (!chain || chain !== dragCard.parentElement) return;
    e.preventDefault();
    const cards = Array.prototype.filter.call(chain.querySelectorAll(':scope > .sq-fx'), function (c) { return c !== dragCard; });
    const before = cards.filter(function (c) {
      const r = c.getBoundingClientRect();
      return e.clientX < r.left + r.width / 2;
    })[0];
    const add = chain.querySelector('.sq-fx-add');
    const anchor = before || (add ? add.closest('li') : null);
    if (anchor) anchor.before(line);
  });
  lanes.addEventListener('drop', function (e) {
    if (!dragCard || !line.parentElement) return;
    e.preventDefault();
    const track = dragCard.__track;
    const from = dragCard.__from;
    const chain = dragCard.parentElement;
    line.replaceWith(dragCard);
    const to = Array.prototype.indexOf.call(chain.querySelectorAll(':scope > .sq-fx'), dragCard);
    dragCard.classList.remove('is-dragging');
    dragCard = null;
    line.remove();
    if (track && from !== to) moveEffect(track, from, to);
  });
  lanes.addEventListener('dragend', function () {
    if (dragCard) dragCard.classList.remove('is-dragging');
    dragCard = null;
    line.remove();
  });
}

/** 고르기 창 · 상세 설정 모달 · 프리셋 · A/B 배선 */
function wireDialogs() {
  const dlg = document.getElementById('plugin-picker');
  if (dlg && dlg.dataset.devWired !== '1') {
    dlg.dataset.devWired = '1';
    const search = document.getElementById('picker-search');
    if (search) search.addEventListener('input', function () { renderPickerList(search.value); });
    dlg.addEventListener('click', function (e) {
      const pick = e.target.closest('.sq-plug');
      if (pick) {
        const plugin = pluginById(pick.dataset.pluginId);
        const cb = picker && picker.onPick;
        dlg.close();
        if (plugin && cb) cb(plugin);
        return;
      }
      if (e.target.closest('[data-picker="close"]') || e.target === dlg) dlg.close();
    });
  }

  const box = document.getElementById('device-modal');
  if (!box || box.dataset.devWired === '1') return;
  box.dataset.devWired = '1';
  box.addEventListener('click', function (e) {
    if (e.target.closest('[data-modal="close"]')) { closeDeviceModal(); return; }
    const tab = e.target.closest('[data-group]');
    if (tab && modal) {
      modal.group = tab.dataset.group;
      renderModalTabs(paramGroups(modal.plugin));
      renderModalParams();
      return;
    }
    const ab = e.target.closest('[data-ab]');
    if (ab && modal) {
      if (ab.dataset.ab === 'A') {
        modal.draft = Object.assign({}, modal.base);
        modal.sideB = false;
      } else {
        modal.draft = Object.assign({}, modal.alt || modal.base);
        modal.sideB = true;
      }
      renderModalParams();
      markDirty(!!modal.sideB);
      updateSideButtons();
      return;
    }
    if (e.target === box) box.close();
  });
  box.addEventListener('close', function () { modal = null; });
  const save = document.getElementById('device-save');
  if (save) save.addEventListener('click', function () { saveDeviceModal(); });
  const reset = document.getElementById('device-reset');
  if (reset) reset.addEventListener('click', function () {
    if (!modal) return;
    modal.draft = defaultParams(modal.plugin);
    modal.device.__preset = null;
    markDirty(true);
    renderModalParams();
  });
  const apply = document.getElementById('device-preset-apply');
  if (apply) apply.addEventListener('click', function () {
    const sel = document.getElementById('device-preset');
    if (sel) applyPreset(sel.value);
  });
}

/** 상세 설정 모달 닫기 */
export function closeDeviceModal() {
  const dlg = document.getElementById('device-modal');
  if (dlg && dlg.close) dlg.close();
  modal = null;
}

/**
 * 데모 모드 조작 (2026-10-18 결정) — projectId 가 없을 때 예시 화면의 노브 · 페이더 · 팬만
 * 화면에서 움직이게 합니다(저장 없음)
 * @param {Document|HTMLElement} scope
 */
export function wireDemoControls(scope) {
  const sel = '.sq-acc:not(.is-live) .sq-knob, .sq-acc:not(.is-live) .sq-fader, .sq-acc:not(.is-live) .sq-pan i, .sq-acc:not(.is-live) .sq-irow__pan';
  Array.prototype.forEach.call(scope.querySelectorAll(sel), function (el) {
    const isKnob = el.classList.contains('sq-knob');
    bindControl(el, {
      item: isKnob ? { min: -1, max: 1, step: 0 } : { min: 0, max: 1, step: 0 },
      value: 0,
      pixels: DRAG_PIXELS,
      render: function (v) {
        if (isKnob) {
          const ring = el.querySelector('i');
          if (ring) ring.style.setProperty('--a', knobAngle({ min: -1, max: 1 }, v) + 'deg');
        } else if (el.classList.contains('sq-fader')) {
          const bar = el.querySelector('i');
          if (bar) bar.style.setProperty('--y', Math.round((1 - v) * 100) + '%');
        } else {
          el.style.setProperty('--p', panDeg(v) + 'deg');
        }
      },
    });
  });
}

/* ───────────────────────── 미터 (S1-11 전까지 흉내) ───────────────────────── */

/** 재생 중일 때만 미터를 흔드는 타이머 시작 */
export function startMeters() {
  if (meterTimer) return;
  if (typeof window === 'undefined' || !window.setInterval) return;
  meterTimer = window.setInterval(tickMeters, 140);
}

function tickMeters() {
  const bars = document.querySelectorAll('.sq-acc.is-live .sq-meter i, .sq-strip.is-live .sq-meter i');
  if (!bars.length) {
    window.clearInterval(meterTimer);
    meterTimer = 0;
    return;
  }
  const playing = isPlaying();
  Array.prototype.forEach.call(bars, function (bar) {
    const now = parseFloat(bar.style.getPropertyValue('--m')) || 0;
    const next = playing
      ? Math.max(4, Math.min(96, now + (Math.random() * 34 - 14)))
      : Math.max(0, now - 9);
    bar.style.setProperty('--m', Math.round(next) + '%');
  });
}

/* ───────────────────────── 잔손질 ───────────────────────── */

/** 글 넣기 */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** 오류 알림 + 콘솔 */
function warn(err) {
  showToast(errText(err));
  if (window.console) console.warn('[devices]', err);
}

/** 오류 → 보여 줄 글 */
function errText(err) {
  if (err instanceof ApiError) return err.message || ('Request failed (' + err.status + ')');
  return 'Something went wrong — please try again';
}

/** HTML 에 넣을 글 안전하게 */
function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"]/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
  });
}
