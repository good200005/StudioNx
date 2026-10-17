// 시퀀서 피아노롤 (구현: AI — 사용자 요청 2026-10-06)
// 설명: docs/ai-notes/30_sequencer_arrange_drag.md §4.16
// - 확대·축소는 편곡과 같은 방법: Ctrl+휠, 마우스 아래 박자가 제자리, 1마디 폭은 정수 px, 축소는 화면을 꽉 채우는 데까지
// - 격자도 편곡과 같은 규칙(마디 → 박 → 1/16, 셋잇단, Snap Line/Off, Alt) — sequencer-arrange.js 의 gridLevelFor · snapUnitFor · gridLayers
// - 높이는 노트 하나씩이 아니라 모든 노트(건반 줄) 함께: 건반 줄 경계 끌기 · ↕−/↕+
// - 노트: 빈 곳 클릭 = 찍기(이어서 끌면 옮김) · 끌기 = 옮기기(가로 스냅 · 세로 음높이) · 오른쪽 끝 끌기 = 길이 · Ctrl+클릭 = 여러 선택
//   Shift+클릭 = 기존 노트 위에 겹쳐 새로 찍기 (같은 음정 · 다른 음정 모두 겹침 허용, FR-2317)
//   지우기 = 선택하고 Delete · Backspace (EDIT › Delete 도) · 오른쪽 클릭
// - MIDI 클립 더블 클릭 → 아래 칸에 피아노롤 열기, ✕ 로 닫기
// 노트 저장(PUT /patterns/{id}/notes)은 sequencer.js 구현 때 onChange 에서

import { gridLevelFor, snapUnitFor, gridLayers, isTriplet, TICK, TICKS_PER_BAR, isDeleteKey, focusArea } from './sequencer-arrange.js';

/** 1마디 기본 폭(px) — 처음 열 때 패턴 4마디가 보기 좋게 */
const BAR_BASE = 160;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;
/** 건반 줄 높이(px) 범위 · ↕−/↕+ 단계 */
const ROW_MIN = 6;
const ROW_MAX = 32;
const ROW_STEPS = [6, 8, 10, 12, 14, 16, 20, 24, 28, 32];
const DRAG_THRESHOLD = 4;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);

/** MIDI 번호 → 이름 (60 = C4) */
export const noteName = (p) => `${NAMES[p % 12]}${Math.floor(p / 12) - 1}`;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const round = (v) => Math.round(v * 1e6) / 1e6;

let R = null;   // 피아노롤 상태

/**
 * @param {object} [options]
 * @param {(change: { type: 'add'|'move'|'resize'|'delete', note: HTMLElement, pitch: number, start: number, length: number }) => void} [options.onChange]
 */
export function initRoll({ onChange = () => {} } = {}) {
  const roll = document.getElementById('roll');
  if (!roll) return;
  R = {
    roll, onChange,
    scroll: document.getElementById('roll-scroll'),
    inner: document.getElementById('roll-inner'),
    notes: document.getElementById('roll-notes'),
    keys: document.getElementById('roll-keys'),
    bars: document.getElementById('roll-bars'),
    vel: document.getElementById('roll-vel'),
    canvas: document.getElementById('roll-canvas'),
    low: Number(roll.dataset.low) || 24,
    high: Number(roll.dataset.high) || 108,
    patternBars: Number(roll.dataset.patternBars) || 4,
    rollBars: Number(roll.dataset.rollBars) || 8,
    zoom: 1, rowH: 12, barW: BAR_BASE, level: null, rulerStep: 0,
    lastLength: 0.25,   // 새 노트 길이 = 마지막으로 찍거나 늘린 길이
    frame: 0, opened: false, clip: null,
  };
  // 변화 알림 — 사용자 onChange 뒤에 편곡의 클립 미리보기가 다시 그려지도록 알린다 (요구사항, 2026-10-17)
  const userChange = onChange;
  R.onChange = (change) => {
    if (typeof userChange === 'function') userChange(change);
    emitRollNotes();
  };
  roll.style.setProperty('--roll-bars', R.rollBars);
  roll.style.setProperty('--roll-rows', R.high - R.low + 1);
  roll.style.setProperty('--roll-pattern-bars', R.patternBars);
  buildKeys();
  const end = document.createElement('span');
  end.className = 'sq-roll__end';
  R.notes.prepend(end);
  R.notes.querySelectorAll('.sq-note').forEach(placeNote);
  renderVelocity();
  updateSelectedInfo();

  initOpenClose();
  initZoom();
  initRowHeight();
  initNoteEdit();
  initDeleteNotes();
  initRollOps();
  R.scroll.addEventListener('scroll', () => { syncLane(); requestDraw(); }, { passive: true });
  new ResizeObserver(() => { if (isVisible()) { applyBarWidth(); requestDraw(); } }).observe(R.scroll);
  document.addEventListener('sq:grid-settings', requestDraw);
}

const isVisible = () => R && R.scroll.clientWidth > 0;

/* ───────── 열기 · 닫기 ───────── */

/** 피아노롤 열기 (아래 칸) — clip 이 있으면 제목을 그 클립으로 */
export function openRoll(clip) {
  const bottom = document.getElementById('bottom');
  bottom.hidden = false;
  bottom.querySelectorAll('.sq-panel').forEach((p) => { p.hidden = p.id !== 'panel-roll'; });
  R.clip = clip || null;
  if (clip) {
    document.getElementById('roll-title').textContent = `🎹 Piano roll — ${clip.querySelector('.sq-clip__name').textContent.replace(/^▤\s*/, '')}`;
    const track = clip.closest('.sq-track');
    const name = track?.querySelector('.sq-track__name b')?.textContent.trim();
    const inst = track?.querySelector('.sq-track__name small')?.textContent.replace(/^.*?🎹\s*/, '').trim();
    if (name) document.getElementById('roll-track').textContent = `${name} · ${inst ?? ''}`;
  }
  requestAnimationFrame(() => {
    applyBarWidth();
    if (!R.opened) { R.opened = true; scrollToNotes(); }
    syncLane();
    requestDraw();
  });
}

export function closeRoll() {
  document.getElementById('bottom').hidden = true;
}

function initOpenClose() {
  document.getElementById('lanes')?.addEventListener('dblclick', (e) => {
    const clip = e.target.closest('.sq-clip--midi');
    if (clip) openRoll(clip);
  });
  document.querySelector('#panel-roll .sq-bottom__close')?.addEventListener('click', closeRoll);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('panel-roll').hidden && !e.target.closest?.('input, textarea, select')) closeRoll();
  });
}

/** 처음 열 때 노트가 있는 음높이가 가운데 오게 */
function scrollToNotes() {
  const ps = [...R.notes.querySelectorAll('.sq-note:not(.is-ghost)')].map((n) => Number(n.dataset.pitch));
  const mid = ps.length ? (Math.max(...ps) + Math.min(...ps)) / 2 : 60;
  R.scroll.scrollTop = (R.high - mid) * R.rowH - R.scroll.clientHeight / 2;
}

/* ───────── 건반 · 노트 위치 ───────── */

function buildKeys() {
  const frag = document.createDocumentFragment();
  for (let p = R.high; p >= R.low; p--) {
    const li = document.createElement('li');
    li.dataset.pitch = p;
    if (BLACK.has(p % 12)) li.classList.add('is-black');
    if (p % 12 === 0) { li.classList.add('is-c'); li.textContent = noteName(p); }
    frag.append(li);
  }
  R.keys.append(frag);
  updateKeyLabels();
}

/** 줄이 너무 낮으면 C 이름을 숨김 */
function updateKeyLabels() {
  R.keys.classList.toggle('is-tiny', R.rowH < 9);
  R.keys.querySelectorAll('li.is-c').forEach((li) => { li.style.color = R.rowH < 9 ? 'transparent' : ''; });
}

/** 노트 하나의 위치를 CSS 변수로 (--ns 시작 마디 · --nr 줄 번호 · --nl 길이) + 글자 */
function placeNote(n) {
  const p = Number(n.dataset.pitch);
  n.style.setProperty('--ns', n.dataset.start);
  n.style.setProperty('--nr', R.high - p);
  n.style.setProperty('--nl', n.dataset.length);
  if (!n.classList.contains('is-ghost')) n.textContent = noteName(p);
}

function renderVelocity() {
  R.vel.replaceChildren(...[...R.notes.querySelectorAll('.sq-note:not(.is-ghost)')].map((n) => {
    const v = document.createElement('span');
    v.className = 'sq-vel';
    v.style.setProperty('--ns', n.dataset.start);
    v.style.setProperty('--v', n.dataset.vel ?? 100);
    return v;
  }));
}

/** 벨로시티 줄을 피아노롤 가로 스크롤에 맞춤 */
function syncLane() {
  const keysW = R.keys.getBoundingClientRect().width;
  R.vel.style.transform = `translateX(${keysW - R.scroll.scrollLeft}px)`;
}

function updateSelectedInfo() {
  const sel = R.notes.querySelectorAll('.sq-note.is-selected');
  const dd = document.getElementById('roll-selected');
  if (!dd) return;
  if (sel.length === 1) dd.textContent = `${noteName(Number(sel[0].dataset.pitch))} · vel ${sel[0].dataset.vel ?? 100}`;
  else dd.textContent = sel.length ? `${sel.length} notes` : '—';
}

/* ───────── 가로 확대 · 축소 (편곡과 같음) ───────── */

function keysWidth() {
  return R.keys.getBoundingClientRect().width;
}

/** 1마디 폭을 정수 px 로 — 축소는 화면을 꽉 채우는 데까지 */
function applyBarWidth() {
  const fill = (R.scroll.clientWidth - keysWidth()) / R.rollBars;
  R.barW = Math.max(1, Math.round(BAR_BASE * R.zoom), Math.ceil(fill));
  R.roll.style.setProperty('--roll-bar-w', `${R.barW}px`);
  R.level = gridLevelFor(R.barW);
  if (R.rulerStep !== R.level.ruler) renderRuler(R.level.ruler);
}

function renderRuler(step) {
  R.rulerStep = step;
  R.bars.replaceChildren();
  for (let b = 1; b <= R.rollBars; b += step) {
    const s = document.createElement('span');
    s.style.setProperty('--bar', b);
    s.textContent = b;
    R.bars.append(s);
  }
}

/**
 * 확대 배율 바꾸기 — anchorX(피아노롤 칸 왼쪽 기준 px)에 있던 박자가 그 자리에 남도록
 * @param {number} zoom  1 = 1마디 160px
 * @param {number} [anchorX]
 */
export function setRollZoom(zoom, anchorX) {
  const keysW = keysWidth();
  const x = anchorX ?? keysW + (R.scroll.clientWidth - keysW) / 2;
  const barAt = (R.scroll.scrollLeft + x - keysW) / R.barW;
  const fitZoom = (R.scroll.clientWidth - keysW) / R.rollBars / BAR_BASE;
  R.zoom = clamp(zoom, Math.max(ZOOM_MIN, fitZoom), ZOOM_MAX);
  applyBarWidth();
  R.scroll.scrollLeft = keysW + barAt * R.barW - x;
  syncLane();
  requestDraw();
}

function initZoom() {
  R.scroll.addEventListener('wheel', (e) => {
    const box = R.scroll.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+휠 = 가로만 (편곡과 같음)
      e.preventDefault();
      setRollZoom(R.zoom * Math.exp(-e.deltaY * 0.0015), e.clientX - box.left);
    } else if (e.shiftKey) {
      // Shift+휠 = 전체(가로 마디 폭 + 세로 노트 높이)를 같은 비율로. 마우스 아래 박자 · 음높이가 제자리
      // (Windows 브라우저는 Shift+휠을 가로 스크롤로 바꿔 deltaX 로 보내므로 둘 다 봄)
      e.preventDefault();
      const delta = e.deltaY || e.deltaX;
      const factor = Math.exp(-delta * 0.0015);
      setRollZoom(R.zoom * factor, e.clientX - box.left);
      R.rowHf = clamp((R.rowHf ?? R.rowH) * factor, ROW_MIN, ROW_MAX);   // 반올림이 쌓이지 않게 소수 값을 따로 둠
      setRollRowHeight(R.rowHf, e.clientY - box.top, true);
    }
  }, { passive: false });
  // 마디 줄을 끌면 좌우 이동 (편곡과 같음)
  let pan = null;
  R.bars.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    pan = { id: e.pointerId, x: e.clientX, left: R.scroll.scrollLeft };
    R.bars.setPointerCapture(e.pointerId);
  });
  R.bars.addEventListener('pointermove', (e) => { if (pan && e.pointerId === pan.id) R.scroll.scrollLeft = pan.left - (e.clientX - pan.x); });
  const end = (e) => { if (pan && e.pointerId === pan.id) { R.bars.releasePointerCapture(e.pointerId); pan = null; } };
  R.bars.addEventListener('pointerup', end);
  R.bars.addEventListener('pointercancel', end);
}

/* ───────── 모든 노트(건반 줄) 높이 ───────── */

/**
 * 건반 줄 높이 바꾸기 — 모든 노트가 함께. anchorPitch 줄이 화면에서 제자리에 남도록 세로 스크롤
 * @param {number} px
 * @param {number} [anchorY]  피아노롤 칸 위 기준 px (없으면 가운데)
 */
export function setRollRowHeight(px, anchorY, keepFloat = false) {
  if (!keepFloat) R.rowHf = null;
  const rulerH = R.inner.querySelector('.sq-roll__ruler').getBoundingClientRect().height;
  const y = anchorY ?? R.scroll.clientHeight / 2;
  const rowAt = (R.scroll.scrollTop + y - rulerH) / R.rowH;
  R.rowH = Math.round(clamp(px, ROW_MIN, ROW_MAX));
  R.roll.style.setProperty('--roll-row-h', `${R.rowH}px`);
  updateKeyLabels();
  R.scroll.scrollTop = rulerH + rowAt * R.rowH - y;
  requestDraw();
}

function initRowHeight() {
  // ↕− / ↕+
  document.querySelector('#panel-roll .sq-heightctl')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-roll-height]');
    if (!b) return;
    const dir = Number(b.dataset.rollHeight);
    const next = dir > 0 ? ROW_STEPS.find((h) => h > R.rowH) : [...ROW_STEPS].reverse().find((h) => h < R.rowH);
    if (next != null) setRollRowHeight(next);
  });
  // 건반 줄 경계(위아래 3px)를 끌기 — 끈 경계가 포인터를 따라오도록 모든 줄 높이를 바꿈
  const EDGE = 3;
  const edgeAt = (e) => {
    const top = R.keys.getBoundingClientRect().top;
    const y = e.clientY - top;
    const k = Math.round(y / R.rowH);   // 가까운 경계 = k 번째 줄 아래
    return k >= 1 && Math.abs(y - k * R.rowH) <= EDGE ? k : 0;
  };
  let d = null;
  R.keys.addEventListener('pointermove', (e) => {
    if (d) return;
    R.keys.classList.toggle('is-edge', edgeAt(e) > 0);
  });
  R.keys.addEventListener('pointerleave', () => R.keys.classList.remove('is-edge'));
  R.keys.addEventListener('pointerdown', (e) => {
    const k = edgeAt(e);
    if (!k || e.button !== 0) return;
    e.preventDefault();
    d = { id: e.pointerId, k, keysTop: R.keys.getBoundingClientRect().top };
    R.keys.setPointerCapture(e.pointerId);
    R.roll.classList.add('is-resizing');
  });
  R.keys.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    // 맨 위에서 경계까지 = k 줄 → 줄 높이 = (포인터 y − 건반 맨 위) / k. 건반 맨 위가 화면에서 고정되도록 스크롤은 그대로
    const h = Math.round(clamp((e.clientY - d.keysTop) / d.k, ROW_MIN, ROW_MAX));
    if (h !== R.rowH) {
      R.rowH = h;
      R.rowHf = null;
      R.roll.style.setProperty('--roll-row-h', `${h}px`);
      updateKeyLabels();
      requestDraw();
    }
  });
  const end = (e) => {
    if (!d || e.pointerId !== d.id) return;
    R.keys.releasePointerCapture(e.pointerId);
    R.roll.classList.remove('is-resizing');
    d = null;
  };
  R.keys.addEventListener('pointerup', end);
  R.keys.addEventListener('pointercancel', end);
}

/* ───────── 노트 찍기 · 옮기기 · 길이 · 지우기 ───────── */

function initNoteEdit() {
  const notes = R.notes;
  notes.addEventListener('contextmenu', (e) => e.preventDefault());
  let d = null;
  const point = (e) => {
    const r = notes.getBoundingClientRect();
    return { bar: (e.clientX - r.left) / R.barW, row: Math.floor((e.clientY - r.top) / R.rowH) };
  };
  const unit = (free) => snapUnitFor(R.level ?? gridLevelFor(R.barW), free);
  const snapR = (bar, free) => { const u = unit(free); return round(Math.round(bar / u) * u); };
  const snapF = (bar, free) => { const u = unit(free); return round(Math.floor(bar / u + 1e-9) * u); };
  const select = (n, add) => {
    if (!add) notes.querySelectorAll('.sq-note.is-selected').forEach((x) => x.classList.remove('is-selected'));
    n.classList.add('is-selected');
  };

  notes.addEventListener('pointerdown', (e) => {
    const target = e.target.closest('.sq-note:not(.is-ghost)');
    const multi = e.ctrlKey || e.metaKey;
    // 오른쪽 클릭 = 지우기
    if (e.button === 2) {
      if (target) {
        const info = noteInfo(target);
        target.remove();
        renderVelocity();
        updateSelectedInfo();
        R.onChange({ type: 'delete', note: target, ...info });
      }
      return;
    }
    if (e.button !== 0) return;
    let note = target;
    let added = false;
    // 빈 곳 클릭 = 찍기 · Shift+클릭(노트 위) = 그 노트에 겹쳐 새로 찍기 (FR-2317 노트 겹침 허용)
    if (!note || e.shiftKey) {
      let pitch = null;
      let start = null;
      if (note) {
        pitch = Number(note.dataset.pitch);
        start = clamp(Number(note.dataset.start), 0, R.rollBars - R.lastLength);
      } else {
        const { bar, row } = point(e);
        pitch = R.high - row;
        if (pitch < R.low || pitch > R.high) return;
        start = clamp(snapF(bar, e.altKey), 0, R.rollBars - R.lastLength);
      }
      const n = document.createElement('span');
      n.className = 'sq-note';
      n.dataset.pitch = pitch;
      n.dataset.start = start;
      note = n;
      note.dataset.length = R.lastLength;
      note.dataset.vel = 100;
      notes.append(note);
      placeNote(note);
      renderVelocity();
      added = true;
      select(note, false);
    } else if (!note.classList.contains('is-selected')) {
      select(note, multi);
    } else if (multi) {
      d = { toggleOff: note, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, group: [] };
      return;
    }
    const r = note.getBoundingClientRect();
    const resize = !added && e.clientX > r.right - 6;
    const group = resize ? [note] : [...notes.querySelectorAll('.sq-note.is-selected')];
    d = {
      id: e.pointerId, note, added, resize, x: e.clientX, y: e.clientY, moved: false, sl: R.scroll.scrollLeft,
      group: group.map((n) => ({ n, start: Number(n.dataset.start), length: Number(n.dataset.length), pitch: Number(n.dataset.pitch) })),
    };
    d.primary = d.group.find((g) => g.n === note);
    notes.setPointerCapture(e.pointerId);
    updateSelectedInfo();
    if (added) R.onChange({ type: 'add', note, ...noteInfo(note) });
  });

  notes.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id || !d.primary) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD) return;
    if (!d.moved) { d.moved = true; d.group.forEach((g) => g.n.classList.add('is-dragging')); }
    const dx = (e.clientX - d.x + (R.scroll.scrollLeft - d.sl)) / R.barW;
    if (d.resize) {
      // 오른쪽 끝 = 길이 (최소 한 칸)
      const g = d.primary;
      const u = unit(e.altKey);
      const end = Math.max(g.start + u, snapR(g.start + g.length + dx, e.altKey));
      g.n.dataset.length = round(Math.min(end, R.rollBars) - g.start);
      placeNote(g.n);
      return;
    }
    // 옮기기: 가로는 잡은 노트를 스냅에 맞춘 만큼 모두, 세로는 줄(음높이) 단위
    let delta = snapR(d.primary.start + dx, e.altKey) - d.primary.start;
    const minStart = Math.min(...d.group.map((g) => g.start));
    const maxEnd = Math.max(...d.group.map((g) => g.start + g.length));
    delta = clamp(delta, -minStart, R.rollBars - maxEnd);
    let dp = -Math.round((e.clientY - d.y) / R.rowH);
    const minP = Math.min(...d.group.map((g) => g.pitch));
    const maxP = Math.max(...d.group.map((g) => g.pitch));
    dp = clamp(dp, R.low - minP, R.high - maxP);
    d.group.forEach((g) => {
      g.n.dataset.start = round(g.start + delta);
      g.n.dataset.pitch = g.pitch + dp;
      placeNote(g.n);
    });
  });

  const end = (e) => {
    if (!d || e.pointerId !== d.id) return;
    if (d.toggleOff) {
      if (!d.moved) d.toggleOff.classList.remove('is-selected');   // Ctrl+클릭 = 선택에서 빼기
    } else {
      notes.releasePointerCapture(e.pointerId);
      d.group.forEach((g) => g.n.classList.remove('is-dragging'));
      if (d.moved) {
        renderVelocity();
        if (d.resize) {
          R.lastLength = Number(d.primary.n.dataset.length);
          R.onChange({ type: 'resize', note: d.primary.n, ...noteInfo(d.primary.n) });
        } else {
          d.group.forEach((g) => R.onChange({ type: 'move', note: g.n, ...noteInfo(g.n) }));
        }
      }
    }
    updateSelectedInfo();
    d = null;
  };
  notes.addEventListener('pointerup', end);
  notes.addEventListener('pointercancel', end);
}

function noteInfo(n) {
  return { pitch: Number(n.dataset.pitch), start: Number(n.dataset.start), length: Number(n.dataset.length) };
}

/** 지금 피아노롤의 노트 전부를 저장용 모양(tick 단위)으로 모은다 (요구사항 1, 2026-10-17) */
function rollNotes() {
  return [...R.notes.querySelectorAll('.sq-note:not(.is-ghost)')].map((n) => ({
    pitch: Number(n.dataset.pitch),
    start_tick: Math.round(Number(n.dataset.start) * TICKS_PER_BAR),
    length_tick: Math.round(Number(n.dataset.length) * TICKS_PER_BAR),
    velocity: Number(n.dataset.vel) || 100,
  }));
}

/** 노트가 바뀔 때마다 알린다 — sequencer.js 가 듣고 그 MIDI 클립의 미리보기를 다시 그린다 */
function emitRollNotes() {
  if (!R || !R.clip) return;
  document.dispatchEvent(new CustomEvent('sq:roll-notes', {
    detail: { clip: R.clip, notes: rollNotes(), bars: R.patternBars },
  }));
}

/* ───────── 격자 그리기 (canvas, 편곡과 같은 방식) ───────── */

function requestDraw() {
  if (!R || R.frame) return;
  R.frame = requestAnimationFrame(() => { R.frame = 0; draw(); });
}

function draw() {
  if (!isVisible()) return;
  const { canvas, scroll } = R;
  const dpr = window.devicePixelRatio || 1;
  const w = scroll.clientWidth;
  const h = scroll.clientHeight;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  const css = getComputedStyle(R.roll);
  const color = (name) => css.getPropertyValue(name).trim();
  const keysW = keysWidth();
  const rulerH = R.inner.querySelector('.sq-roll__ruler').getBoundingClientRect().height;
  const x0 = scroll.scrollLeft;
  const y0 = scroll.scrollTop;
  const px = Math.max(1, Math.round(dpr));
  const fill = (x, y, ww, hh) => g.fillRect(Math.round(x * dpr), Math.round(y * dpr), Math.max(px, Math.round(ww * dpr)), Math.max(px, Math.round(hh * dpr)));

  // 가로: 검은 건반 줄 음영 · 줄 선 · 옥타브(C) 선
  const firstRow = Math.max(0, Math.floor((y0 - 0) / R.rowH));
  const lastRow = Math.min(R.high - R.low, Math.ceil((y0 + h) / R.rowH));
  for (let row = firstRow; row <= lastRow; row++) {
    const p = R.high - row;
    const y = rulerH + row * R.rowH - y0;
    if (y + R.rowH < rulerH || y > h) continue;
    if (BLACK.has(p % 12)) { g.fillStyle = 'rgba(0,0,0,0.18)'; fill(keysW, y, w - keysW, R.rowH); }
    g.fillStyle = color(p % 12 === 0 ? '--sq-line-2' : '--sq-grid');
    fill(keysW, y + R.rowH - 1, w - keysW, 1);
  }
  // 세로: 편곡과 같은 단계 · 셋잇단
  const layers = gridLayers(R.level ?? gridLevelFor(R.barW), isTriplet());
  const firstBar = Math.max(0, Math.floor(x0 / R.barW) - 1);
  const lastBar = Math.min(R.rollBars, Math.ceil((x0 + w - keysW) / R.barW) + 1);
  for (const [div, name] of layers) {
    g.fillStyle = color(name);
    const step = R.barW / div;
    for (let n = Math.floor((firstBar * R.barW) / step); n <= Math.ceil((lastBar * R.barW) / step); n++) {
      const x = keysW + n * step - x0 - 1;
      if (x < keysW - 1 || x > w) continue;
      fill(x, rulerH, 1, h - rulerH);
    }
  }
}

/** 선택한 노트 지우기 — 지운 수를 돌려줌 */
export function deleteSelectedNotes() {
  const sel = [...R.notes.querySelectorAll('.sq-note.is-selected:not(.is-ghost)')];
  sel.forEach((n) => {
    const info = noteInfo(n);
    n.remove();
    R.onChange({ type: 'delete', note: n, ...info });
  });
  if (sel.length) { renderVelocity(); updateSelectedInfo(); }
  return sel.length;
}

/** Delete · Backspace — 피아노롤이 열려 있고 마지막으로 누른 곳이 피아노롤일 때 */
function initDeleteNotes() {
  const rollOpen = () => !document.getElementById('bottom').hidden && !document.getElementById('panel-roll').hidden;
  document.addEventListener('keydown', (e) => {
    if (!isDeleteKey(e) || !rollOpen() || focusArea() !== 'roll') return;
    if (deleteSelectedNotes()) e.preventDefault();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-command="edit.delete"]') && rollOpen() && focusArea() === 'roll') deleteSelectedNotes();
  });
}

/* ───────── 피아노롤 머리줄 명령 (2026-10-06) — 선택한 노트, 없으면 전체 ───────── */

/** 명령 대상 노트 */
function targets() {
  const sel = [...R.notes.querySelectorAll('.sq-note.is-selected:not(.is-ghost)')];
  return sel.length ? sel : [...R.notes.querySelectorAll('.sq-note:not(.is-ghost)')];
}
const unitNow = () => snapUnitFor(R.level ?? gridLevelFor(R.barW));
const setNote = (n, start, length) => {
  n.dataset.start = round(start);
  n.dataset.length = round(Math.max(TICK, length));
  placeNote(n);
};
const finish = (type, list) => {
  renderVelocity();
  updateSelectedInfo();
  list.forEach((n) => R.onChange({ type, note: n, ...noteInfo(n) }));
};

/** Quantize — 시작을 지금 격자에 strength 만큼 당김 (75%) */
export function quantizeNotes(strength = 0.75) {
  const u = unitNow();
  const list = targets();
  list.forEach((n) => {
    const s = Number(n.dataset.start);
    setNote(n, s + (Math.round(s / u) * u - s) * strength, Number(n.dataset.length));
  });
  finish('quantize', list);
}

/** Legato — 각 노트를 같은 대상 중 다음에 시작하는 노트까지 늘림 */
export function legatoNotes() {
  const list = targets().sort((a, b) => a.dataset.start - b.dataset.start);
  list.forEach((n) => {
    const s = Number(n.dataset.start);
    const next = list.find((m) => Number(m.dataset.start) > s + 1e-6);
    if (next) setNote(n, s, Number(next.dataset.start) - s);
  });
  finish('legato', list);
}

/** Humanize — 시작을 ±1/64 마디 안에서, 벨로시티를 ±12 안에서 조금씩 흔듦 */
export function humanizeNotes() {
  const list = targets();
  list.forEach((n) => {
    const s = Number(n.dataset.start);
    setNote(n, clamp(s + (Math.random() - 0.5) * (2 / 64), 0, R.rollBars - Number(n.dataset.length)), Number(n.dataset.length));
    n.dataset.vel = clamp(Math.round(Number(n.dataset.vel ?? 100) + (Math.random() - 0.5) * 24), 1, 127);
  });
  finish('humanize', list);
}

/** Chop — 노트를 지금 격자 단위로 잘게 자름 */
export function chopNotes() {
  const u = unitNow();
  const made = [];
  targets().forEach((n) => {
    const s = Number(n.dataset.start);
    const l = Number(n.dataset.length);
    const parts = Math.floor(l / u + 1e-9);
    if (parts < 2) return;
    setNote(n, s, u);
    for (let k = 1; k < parts; k++) {
      const c = n.cloneNode(false);
      c.classList.remove('is-dragging');
      R.notes.append(c);
      setNote(c, s + k * u, k === parts - 1 ? l - k * u : u);
      made.push(c);
    }
    made.push(n);
  });
  finish('chop', made);
}

/** Glue — 같은 음높이로 이어지는(또는 겹치는) 노트를 하나로 붙임 */
export function glueNotes() {
  const byPitch = new Map();
  targets().forEach((n) => { const p = n.dataset.pitch; if (!byPitch.has(p)) byPitch.set(p, []); byPitch.get(p).push(n); });
  const kept = [];
  byPitch.forEach((list) => {
    list.sort((a, b) => a.dataset.start - b.dataset.start);
    let cur = list[0];
    for (const n of list.slice(1)) {
      const cs = Number(cur.dataset.start);
      const ce = cs + Number(cur.dataset.length);
      if (Number(n.dataset.start) <= ce + 1e-6) {
        setNote(cur, cs, Math.max(ce, Number(n.dataset.start) + Number(n.dataset.length)) - cs);
        n.remove();
      } else { kept.push(cur); cur = n; }
    }
    kept.push(cur);
  });
  finish('glue', kept);
}

/** 머리줄 버튼(data-roll-op) 연결 */
function initRollOps() {
  const head = document.querySelector('#panel-roll .sq-bottom__head');
  head?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-roll-op]');
    if (!b) return;
    ({ quantize: () => quantizeNotes(0.75), legato: legatoNotes, humanize: humanizeNotes, chop: chopNotes, glue: glueNotes })[b.dataset.rollOp]?.();
  });
  // 벨로시티 줄 탭 (Velocity 외 줄은 값 편집이 아직 없음 — 탭만 바뀜)
  document.querySelector('#panel-roll .sq-lane__tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('[role="tab"]');
    if (!t) return;
    t.parentElement.querySelectorAll('[role="tab"]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    R.vel.hidden = t.textContent.trim() !== 'Velocity';
  });
}
