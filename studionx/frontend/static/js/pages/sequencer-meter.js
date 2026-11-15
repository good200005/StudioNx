/**
 * 시퀀서 박자 줄 편집 (S1-18, FR-202b)
 *
 * - 오토메이션 모드에서 보이는 박자 줄에 박자 변경점을 더하고, 바꾸고, 지웁니다.
 * - 변경점은 서버 PUT /projects/{id}/meter-changes 로 통째로 저장합니다 (400ms 모아서).
 * - 변경 위치는 마디 경계(3840 tick)에 맞춥니다. 눈금자와 클립 격자는 4/4 마디로 고정이라
 *   박자가 바뀌어도 격자 폭은 그대로이고, 줄과 서버에 박자 정보만 남깁니다.
 * - 첫 구간의 박자는 상단 프로젝트 설정이라 이 줄에서 고치지 않습니다.
 *
 * 조작: 구간 안쪽 클릭 = 그 마디에 변경점 추가, 변경점이 시작하는 마디 클릭 = 다음 박자로 순환
 * (Shift 는 이전 박자), Alt+클릭 = 삭제.
 */
import { api } from '../core/api.js';
import { pushHistory } from './sequencer-history.js';
import { projectIdOf } from './sequencer-save.js';

const TICKS_PER_BAR = 3840;
const MIN_BARS = 64;
const SAVE_DELAY_MS = 400;
const PRESETS = [[4, 4], [3, 4], [2, 4], [5, 4], [6, 8], [7, 8], [12, 8], [6, 4]];

let body = null;
let saveTimer = 0;
let changes = [];                   // { tick, num, den } tick 오름차순
let base = { num: 4, den: 4 };

/** 목록 복사본 (받은 쪽이 고쳐도 원본은 그대로) */
export function playbackMeterChanges() {
  return changes.map(function (c) { return { tick: c.tick, num: c.num, den: c.den }; });
}

/** 구간 목록: 기준 구간(마디 0)과 변경점을 합친 것 */
function segments() {
  const list = [{ tick: 0, num: base.num, den: base.den, base: true }];
  return list.concat(playbackMeterChanges());
}

function label(s) {
  return s.num + '/' + s.den;
}

function presetIndex(num, den) {
  for (let i = 0; i < PRESETS.length; i++) {
    if (PRESETS[i][0] === num && PRESETS[i][1] === den) return i;
  }
  return -1;
}

/** 순환에서 step 칸 옮긴 박자. 목록에 없는 박자(5/8 등)에서는 첫 항목부터 */
function shifted(num, den, step) {
  const i = presetIndex(num, den);
  const n = PRESETS.length;
  const to = PRESETS[i < 0 ? 0 : (i + step + n) % n];
  return { num: to[0], den: to[1] };
}

/** 박자 줄을 현재 변경점으로 다시 그립니다 */
export function renderMeterRow() {
  if (!body) return;
  const segs = segments();
  const last = segs[segs.length - 1].tick / TICKS_PER_BAR;
  const bars = Math.max(MIN_BARS, Math.ceil(last) + 16);
  body.textContent = '';
  segs.forEach(function (s, i) {
    const start = s.tick / TICKS_PER_BAR;
    const end = i < segs.length - 1 ? segs[i + 1].tick / TICKS_PER_BAR : bars;
    const el = document.createElement('div');
    el.className = 'sq-global__seg' + (s.base ? '' : ' is-change');
    el.dataset.i = String(i);
    el.style.setProperty('--s', String(start));
    el.style.setProperty('--l', String(end - start));
    el.textContent = label(s);
    el.title = s.base ? 'Project time signature' : 'Click: next · Shift+click: previous · Alt+click: delete';
    body.appendChild(el);
  });
  const small = document.querySelector('.sq-global--meter .sq-global__head small');
  if (small) small.textContent = label(base);
}

/** 서버가 준 변경점과 프로젝트 박자를 받아 화면에 그립니다 */
export function setMeterRow(list, project) {
  if (project && project.time_sig_num && project.time_sig_den) {
    base = { num: Number(project.time_sig_num), den: Number(project.time_sig_den) };
  }
  changes = (list || []).map(function (c) {
    return { tick: c.tick, num: c.time_sig_num, den: c.time_sig_den };
  }).sort(function (a, b) { return a.tick - b.tick; });
  renderMeterRow();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    const pid = projectIdOf();
    if (!pid) return;
    const items = changes.map(function (c) {
      return { tick: c.tick, time_sig_num: c.num, time_sig_den: c.den };
    });
    api.put('/projects/' + pid + '/meter-changes', { changes: items }).catch(function (err) {
      if (window.console) console.warn('[meter] save failed', err);
    });
  }, SAVE_DELAY_MS);
}

function commit(list) {
  changes = list.slice().sort(function (a, b) { return a.tick - b.tick; });
  renderMeterRow();
  scheduleSave();
}

/** 되돌리기 기록: 바꾸기 전과 후 목록을 들고 있다가 그대로 되돌리거나 다시 적용 */
function record(label, before, after) {
  pushHistory({
    label: label,
    undo: function () { commit(before); },
    redo: function () { commit(after); },
  });
}

function barAt(e) {
  const box = body.getBoundingClientRect();
  const lanes = document.getElementById('lanes');
  const barW = parseFloat(getComputedStyle(lanes).getPropertyValue('--sq-bar-w')) || 40;
  return Math.max(0, Math.floor((e.clientX - box.left) / barW));
}

function onClick(e) {
  if (e.button !== 0) return;
  const bar = barAt(e);
  const segs = segments();
  let i = 0;
  for (let k = 0; k < segs.length; k++) {
    if (segs[k].tick / TICKS_PER_BAR <= bar) i = k;
  }
  const before = playbackMeterChanges();
  const list = playbackMeterChanges();
  const seg = segs[i];
  const startsHere = seg.tick / TICKS_PER_BAR === bar;

  if (startsHere && !seg.base) {
    if (e.altKey) {
      list.splice(i - 1, 1);
      commit(list);
      record('Meter delete', before, list);
    } else {
      const to = shifted(seg.num, seg.den, e.shiftKey ? -1 : 1);
      list[i - 1].num = to.num;
      list[i - 1].den = to.den;
      commit(list);
      record('Meter change', before, list);
    }
    return;
  }
  if (startsHere || bar < 1) return;               // 기준 구간의 첫 마디는 프로젝트 설정
  const to = shifted(seg.num, seg.den, 1);
  list.push({ tick: bar * TICKS_PER_BAR, num: to.num, den: to.den });
  commit(list);
  record('Meter add', before, list);
}

/** 한 번만 부르면 됩니다 — 박자 줄에 클릭을 연결 */
export function initMeterRow() {
  body = document.querySelector('.sq-global--meter .sq-global__body');
  if (!body) return;
  body.addEventListener('click', onClick);
  renderMeterRow();
}
