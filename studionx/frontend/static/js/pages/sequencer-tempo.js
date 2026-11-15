/**
 * 시퀀서 템포 줄 편집 (S1-16, FR-202a)
 *
 * - 오토메이션 모드에서 보이는 템포 줄에 변경점을 찍고, 끌고, 지웁니다.
 * - 변경점은 서버 PUT /projects/{id}/tempo-changes 로 통째로 저장합니다 (400ms 모아서).
 * - 재생과 내보내기는 sequencer-devices.js 의 목록을 읽으므로, 고친 즉시 반영됩니다.
 * - 마디 0 의 기준 점은 상단 BPM 이라 이 줄에서 고치지 않습니다.
 */
import { api } from '../core/api.js';
import { playbackTempoChanges, replaceTempoChanges } from './sequencer-devices.js';
import { getSnap } from './sequencer-arrange.js';
import { projectIdOf } from './sequencer-save.js';

const TICKS_PER_BAR = 3840;
const MIN_BARS = 64;
const MIN_BPM = 20;
const MAX_BPM = 300;
const MIN_SPAN = 80;
const SAVE_DELAY_MS = 400;
const NS = 'http://www.w3.org/2000/svg';

let body = null;
let saveTimer = 0;
let frozen = null;      // 끄는 동안 세로 범위를 고정해 점이 튀지 않게 함
let drag = null;

function baseBpm() {
  const el = document.getElementById('bpm');
  const v = el ? parseFloat(el.textContent) : NaN;
  return isFinite(v) && v > 0 ? v : 120;
}

/** 기준 점(마디 0)과 변경점을 합친 목록 */
function allPoints() {
  const list = [{ tick: 0, bpm: baseBpm(), ramp: 'STEP', base: true }];
  return list.concat(playbackTempoChanges());
}

/** 점이 보이는 세로 범위. 데이터에서 계산하고 최소 80 BPM 폭을 유지합니다 */
function rangeOf(points) {
  if (frozen) return frozen;
  let lo = Infinity;
  let hi = -Infinity;
  points.forEach(function (p) { lo = Math.min(lo, p.bpm); hi = Math.max(hi, p.bpm); });
  let a = Math.max(MIN_BPM, Math.floor(lo / 10) * 10 - 30);
  let b = Math.min(MAX_BPM, Math.ceil(hi / 10) * 10 + 30);
  if (b - a < MIN_SPAN) b = Math.min(MAX_BPM, a + MIN_SPAN);
  if (b - a < MIN_SPAN) a = Math.max(MIN_BPM, b - MIN_SPAN);
  return { lo: a, hi: b };
}

function yOf(bpm, r) {
  return ((r.hi - bpm) / (r.hi - r.lo)) * 100;
}

function bpmAt(y, r, fine) {
  const raw = r.hi - (y / 100) * (r.hi - r.lo);
  const v = fine ? Math.round(raw * 10) / 10 : Math.round(raw);
  return Math.max(MIN_BPM, Math.min(MAX_BPM, v));
}

function barsFor(points) {
  const last = points[points.length - 1].tick;
  return Math.max(MIN_BARS, Math.ceil(last / TICKS_PER_BAR) + 16);
}

function fmt(bpm) {
  return String(Math.round(bpm * 100) / 100);
}

/** 템포 줄을 현재 변경점으로 다시 그립니다 */
export function renderTempoRow() {
  if (!body) return;
  const pts = allPoints();
  const r = rangeOf(pts);
  const bars = barsFor(pts);
  body.textContent = '';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sq-global__line');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.width = 'calc(var(--sq-bar-w) * ' + bars + ')';
  const line = [];
  pts.forEach(function (p, i) {
    const x = (p.tick / TICKS_PER_BAR / bars) * 100;
    const y = yOf(p.bpm, r);
    if (i > 0 && p.ramp !== 'LINEAR') line.push(x + ',' + yOf(pts[i - 1].bpm, r));
    line.push(x + ',' + y);
  });
  line.push('100,' + yOf(pts[pts.length - 1].bpm, r));
  const poly = document.createElementNS(NS, 'polyline');
  poly.setAttribute('points', line.join(' '));
  poly.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(poly);
  body.appendChild(svg);

  pts.forEach(function (p, i) {
    const at = p.tick / TICKS_PER_BAR;
    const y = yOf(p.bpm, r);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sq-global__pt' + (p.base ? ' is-base' : '');
    btn.dataset.i = String(i);
    btn.style.setProperty('--at', String(at));
    btn.style.setProperty('--y', String(y));
    btn.setAttribute('aria-label', 'Bar ' + (at + 1) + ' · ' + fmt(p.bpm) + ' BPM' + (p.ramp === 'LINEAR' ? ' linear' : ''));
    body.appendChild(btn);
    const lab = document.createElement('span');
    lab.className = 'sq-global__lab sq-num';
    lab.style.setProperty('--at', String(at + 0.05));
    lab.style.setProperty('--y', String(y));
    lab.textContent = fmt(p.bpm) + (p.ramp === 'LINEAR' ? ' ↗' : '');
    body.appendChild(lab);
  });
}

/** 서버가 준 변경점을 받아 화면에 그립니다 */
export function setTempoRow(list) {
  replaceTempoChanges(list || []);
  renderTempoRow();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    const pid = projectIdOf();
    if (!pid) return;
    api.put('/projects/' + pid + '/tempo-changes', { changes: playbackTempoChanges() }).catch(function (err) {
      if (window.console) console.warn('[tempo] save failed', err);
    });
  }, SAVE_DELAY_MS);
}

function commit(list, saveNow) {
  replaceTempoChanges(list);
  renderTempoRow();
  if (saveNow) scheduleSave();
}

/** 포인터 위치 → 줄 안의 가로(틱)와 세로(0~100) */
function locate(e) {
  const box = body.getBoundingClientRect();
  const lanes = document.getElementById('lanes');
  const barW = parseFloat(getComputedStyle(lanes).getPropertyValue('--sq-bar-w')) || 40;
  const pad = parseFloat(getComputedStyle(body).getPropertyValue('--pad')) || 0;
  const padPx = pad * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  const h = Math.max(1, box.height - padPx * 2);
  return {
    bar: Math.max(0, (e.clientX - box.left) / barW),
    y: Math.max(0, Math.min(100, ((e.clientY - box.top - padPx) / h) * 100)),
  };
}

function snapTick(bar, free) {
  if (free) return Math.max(1, Math.round(bar * TICKS_PER_BAR));
  const unit = getSnap() * TICKS_PER_BAR;
  return Math.max(1, Math.round(Math.round(bar * TICKS_PER_BAR / unit) * unit));
}

function onDown(e) {
  if (e.button !== 0) return;
  const btn = e.target.closest ? e.target.closest('.sq-global__pt') : null;
  const pts = allPoints();
  const r = rangeOf(pts);
  const at = locate(e);

  if (btn) {
    const i = parseInt(btn.dataset.i, 10);
    if (i === 0) return;                         // 기준 점은 상단 BPM 으로 고침
    if (e.shiftKey) {                            // Shift+클릭: STEP ↔ LINEAR
      const list = playbackTempoChanges();
      list[i - 1].ramp = list[i - 1].ramp === 'LINEAR' ? 'STEP' : 'LINEAR';
      commit(list, true);
      e.preventDefault();
      return;
    }
    frozen = r;
    drag = { index: i - 1, moved: false };
    btn.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }

  if (e.target.closest && e.target.closest('.sq-global__lab')) return;
  const tick = snapTick(at.bar, e.altKey);
  const list = playbackTempoChanges();
  if (list.some(function (c) { return c.tick === tick; })) return;
  list.push({ tick: tick, bpm: bpmAt(at.y, r, e.shiftKey), ramp: 'STEP' });
  list.sort(function (a, b) { return a.tick - b.tick; });
  commit(list, true);
  e.preventDefault();
}

function onMove(e) {
  if (!drag) return;
  const list = playbackTempoChanges();
  const c = list[drag.index];
  if (!c) return;
  const at = locate(e);
  const lo = drag.index > 0 ? list[drag.index - 1].tick + 1 : 1;
  const hi = drag.index < list.length - 1 ? list[drag.index + 1].tick - 1 : Infinity;
  c.tick = Math.max(lo, Math.min(hi, snapTick(at.bar, e.altKey)));
  c.bpm = bpmAt(at.y, frozen, e.shiftKey);
  drag.moved = true;
  commit(list, false);
}

function onUp() {
  if (!drag) return;
  const moved = drag.moved;
  drag = null;
  frozen = null;
  if (!moved) return;                            // 그대로 눌렀다 떼면 다시 그리지 않음: 점이 바뀌면 더블클릭이 끊김
  renderTempoRow();
  scheduleSave();
}

function onDouble(e) {
  const btn = e.target.closest ? e.target.closest('.sq-global__pt') : null;
  if (!btn) return;
  const i = parseInt(btn.dataset.i, 10);
  if (i === 0) return;
  const list = playbackTempoChanges();
  list.splice(i - 1, 1);
  commit(list, true);
}

/** 한 번만 부르면 됩니다 — 템포 줄에 포인터 이벤트를 연결 */
export function initTempoRow() {
  body = document.querySelector('.sq-global--tempo .sq-global__body');
  if (!body) return;
  body.addEventListener('pointerdown', onDown);
  body.addEventListener('pointermove', onMove);
  body.addEventListener('pointerup', onUp);
  body.addEventListener('pointercancel', onUp);
  body.addEventListener('dblclick', onDouble);
  renderTempoRow();
}
