// 시퀀서 오토메이션 편집 (구현: AI — 사용자 요청 2026-10-06)
// 설명: docs/ai-notes/30_sequencer_arrange_drag.md §4.17 · 기획 PRD 02 FR-2103 · DB automation_points(time, value, curve)
// - 오토메이션 모드: 도구 막대 ⤴ Automation A · A 키 · VIEW › Automation mode — 패턴은 흐리게(누를 수 없음), 곡선만 편집
// - 클립 빈 곳 클릭 = 점 찍기 · 점 끌기 = 시간(격자 스냅, Alt 무시) · 값 · 점 더블 클릭 = 지우기(처음·끝 점 제외)
// - 점과 점 사이 가운데 ↕ 를 누른 채 위아래로 끌기 = 곡선 (손잡이가 포인터를 따라감) · ↕ 더블 클릭 = 직선으로
// 오토메이션 클립 끌어 옮기기 · 겹침 창(Trim/Split/Undo) · 템포·박자 점 편집은 아직 (sequencer.js 템플릿)

import { getSnap, getSnapMode, TICK } from './sequencer-arrange.js';

/** 곡선 세기 — curve = ±1 일 때 지수 곡선의 a 값 */
const K = 6;
/** 한 구간을 몇 조각으로 그릴지 */
const STEPS = 24;
const DRAG_THRESHOLD = 3;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const round = (v) => Math.round(v * 1e6) / 1e6;

/**
 * 두 점 사이 모양 g(x), x 0~1 → 0~1
 * - curve 0 = 직선, curve > 0 = 가운데가 직선보다 위로(올라가는 구간은 볼록), curve < 0 = 아래로
 * - 지수 곡선 (e^(ax) − 1) / (e^a − 1), a = −curve × K × (올라가면 1,내려가면 −1)
 */
function shape(x, curve, rising) {
  const a = -curve * K * (rising ? 1 : -1);
  if (Math.abs(a) < 1e-6) return x;
  return (Math.exp(a * x) - 1) / (Math.exp(a) - 1);
}

/** 가운데(x = 0.5)가 r(0~1) 이 되게 하는 curve — 손잡이를 포인터에 맞출 때 */
function curveForMid(r, rising) {
  const rr = clamp(r, 0.02, 0.98);
  const a = 2 * Math.log(1 / rr - 1);       // g(0.5) = 1 / (e^(a/2) + 1)
  return clamp(-a / (K * (rising ? 1 : -1)), -1, 1);
}

/** 구간 [p0, p1] 안 x(0~1) 의 값 */
function valueAt(p0, p1, x) {
  if (p1[1] === p0[1]) return p0[1];
  return p0[1] + (p1[1] - p0[1]) * shape(x, p0[2] ?? 0, p1[1] > p0[1]);
}

let onChange = () => {};

/**
 * @param {object} [options]
 * @param {(change: { type: 'automation', clip: HTMLElement, points: number[][] } | { type: 'automationMode', on: boolean }) => void} [options.onChange]
 */
export function initAutomation(options = {}) {
  onChange = options.onChange ?? onChange;
  document.querySelectorAll('.sq-auto[data-points]').forEach(render);
  // 켜기 · 끄기
  document.getElementById('automation-mode')?.addEventListener('click', () => setAutomationMode(!isAutomationMode()));
  document.addEventListener('click', (e) => { if (e.target.closest('[data-command="view.automation"]')) setAutomationMode(!isAutomationMode()); });
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'a' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    setAutomationMode(!isAutomationMode());
  });
  // 창 크기 · 확대가 바뀌면 점 · 손잡이 자리는 % 라 그대로, 손잡이 보이기만 다시
  new ResizeObserver(() => document.querySelectorAll('.sq-auto[data-points]').forEach(updateHandles)).observe(document.getElementById('lanes'));
  initEditing();
}

export function isAutomationMode() {
  return document.body.classList.contains('is-automation');
}

/** 오토메이션 모드 켜고 끄기 (FR-224) */
export function setAutomationMode(on) {
  document.body.classList.toggle('is-automation', on);
  document.getElementById('automation-mode')?.setAttribute('aria-pressed', String(on));
  const hint = document.getElementById('hint');
  if (hint) {
    if (on) {
      hint.dataset.before = hint.innerHTML;
      hint.innerHTML = '<b>Automation (A)</b> — Click to add a point · Drag a point · Drag ↕ between points to curve · Double-click to delete';
    } else if (hint.dataset.before) {
      hint.innerHTML = hint.dataset.before;
    }
  }
  document.querySelectorAll('.sq-auto[data-points]').forEach(updateHandles);
  onChange({ type: 'automationMode', on });
}

/* ───────── 그리기 ───────── */

const pointsOf = (clip) => JSON.parse(clip.dataset.points);
const lengthOf = (clip) => parseFloat(clip.style.getPropertyValue('--l')) || 1;

/** 점 · 곡선 · ↕ 손잡이를 다시 그림 */
function render(clip) {
  const pts = pointsOf(clip);
  const len = lengthOf(clip);
  let plot = clip.querySelector('.sq-auto__plot');
  if (!plot) {
    plot = document.createElement('div');
    plot.className = 'sq-auto__plot';
    clip.append(plot);
  }
  // 곡선: viewBox 0~100, 구간마다 STEPS 조각 (선 두께는 늘어나지 않게)
  const xy = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0] = pts[i];
    const [t1] = pts[i + 1];
    for (let k = 0; k <= STEPS; k++) {
      const x = k / STEPS;
      const t = t0 + (t1 - t0) * x;
      xy.push(`${((t / len) * 100).toFixed(3)},${((1 - valueAt(pts[i], pts[i + 1], x)) * 100).toFixed(3)}`);
    }
  }
  const line = xy.join(' ');
  plot.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon class="sq-auto__fill" points="0,100 ${line} 100,100"/>
      <polyline points="${line}" vector-effect="non-scaling-stroke"/></svg>`;
  pts.forEach(([t, v], i) => {
    const dot = document.createElement('span');
    dot.className = 'sq-apt';
    dot.dataset.i = i;
    dot.style.left = `${(t / len) * 100}%`;
    dot.style.top = `${(1 - v) * 100}%`;
    dot.title = `${Math.round(v * 100)}%`;
    plot.append(dot);
  });
  for (let i = 0; i < pts.length - 1; i++) {
    const h = document.createElement('span');
    h.className = 'sq-acurve';
    h.dataset.i = i;
    h.textContent = '↕';
    h.title = 'Drag up/down to curve · double-click for a straight line';
    const tm = (pts[i][0] + pts[i + 1][0]) / 2;
    h.style.left = `${(tm / len) * 100}%`;
    h.style.top = `${(1 - valueAt(pts[i], pts[i + 1], 0.5)) * 100}%`;
    plot.append(h);
  }
  updateHandles(clip);
}

/** 구간이 너무 좁거나 평평하면(곡선이 의미 없음) ↕ 를 숨김 */
function updateHandles(clip) {
  const plot = clip.querySelector('.sq-auto__plot');
  if (!plot) return;
  const w = plot.getBoundingClientRect().width;
  const pts = pointsOf(clip);
  const len = lengthOf(clip);
  plot.querySelectorAll('.sq-acurve').forEach((h) => {
    const i = Number(h.dataset.i);
    const segPx = ((pts[i + 1][0] - pts[i][0]) / len) * w;
    h.hidden = segPx < 22 || pts[i][1] === pts[i + 1][1];
  });
}

function save(clip, pts) {
  clip.dataset.points = JSON.stringify(pts.map(([t, v, c]) => [round(t), round(v), round(c ?? 0)]));
}

/* ───────── 편집 ───────── */

function initEditing() {
  const lanes = document.getElementById('lanes');
  let d = null;
  let tip = null;
  const showTip = (plot, x, y, text) => {
    if (!tip) { tip = document.createElement('span'); tip.className = 'sq-auto__tip'; }
    if (tip.parentElement !== plot) plot.append(tip);
    tip.style.left = x;
    tip.style.top = y;
    tip.textContent = text;
  };
  const hideTip = () => tip?.remove();
  // 포인터 → 클립 안 시간(마디) · 값(0~1)
  const posOf = (plot, clip, e) => {
    const r = plot.getBoundingClientRect();
    return { t: ((e.clientX - r.left) / r.width) * lengthOf(clip), v: clamp(1 - (e.clientY - r.top) / r.height, 0, 1) };
  };
  const snapT = (t, free) => {
    const u = free || getSnapMode() === 'off' ? TICK : getSnap();
    return round(Math.round(t / u) * u);
  };

  lanes.addEventListener('pointerdown', (e) => {
    if (!isAutomationMode() || e.button !== 0) return;
    const plot = e.target.closest('.sq-auto:not(.is-ghost) .sq-auto__plot');
    if (!plot) return;
    const clip = plot.closest('.sq-auto');
    e.preventDefault();
    e.stopPropagation();
    const pts = pointsOf(clip);
    const handle = e.target.closest('.sq-acurve');
    let dot = e.target.closest('.sq-apt');
    if (handle) {
      d = { kind: 'curve', clip, plot, i: Number(handle.dataset.i), pts, id: e.pointerId, y: e.clientY, moved: false };
      handle.classList.add('is-active');
    } else {
      if (!dot) {
        // 빈 곳 클릭 = 점 찍기 (구간을 둘로 — 새 두 구간은 직선부터)
        const { t, v } = posOf(plot, clip, e);
        const tt = clamp(snapT(t, e.altKey), 0, lengthOf(clip));
        const at = pts.findIndex((p) => p[0] > tt);
        if (at <= 0 || pts.some((p) => Math.abs(p[0] - tt) < TICK)) return;   // 처음 · 끝 바깥, 같은 시간에 이미 점
        pts[at - 1][2] = 0;
        pts.splice(at, 0, [tt, v, 0]);
        save(clip, pts);
        render(clip);
        onChange({ type: 'automation', clip, points: pointsOf(clip) });
        dot = plot.querySelector(`.sq-apt[data-i="${at}"]`);
      }
      d = { kind: 'point', clip, plot, i: Number(dot.dataset.i), pts: pointsOf(clip), id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      dot.classList.add('is-active');
    }
    plot.setPointerCapture(e.pointerId);
  });

  lanes.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.hypot(e.clientX - (d.x ?? e.clientX), e.clientY - d.y) < DRAG_THRESHOLD) return;
    d.moved = true;
    const { clip, plot, pts, i } = d;
    const len = lengthOf(clip);
    if (d.kind === 'curve') {
      // ↕: 포인터 높이가 곡선 가운데가 되도록 curve 를 계산
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const { v } = posOf(plot, clip, e);
      const r = (v - p0[1]) / (p1[1] - p0[1]);
      p0[2] = round(curveForMid(r, p1[1] > p0[1]));
      save(clip, pts);
      render(clip);
      plot.querySelector(`.sq-acurve[data-i="${i}"]`)?.classList.add('is-active');
      showTip(plot, `${(((p0[0] + p1[0]) / 2) / len) * 100}%`, `${(1 - valueAt(p0, p1, 0.5)) * 100}%`, `curve ${p0[2] > 0 ? '+' : ''}${p0[2].toFixed(2)}`);
    } else {
      // 점: 처음 · 끝 점은 시간 고정, 나머지는 앞뒤 점 사이에서만
      const { t, v } = posOf(plot, clip, e);
      let tt = pts[i][0];
      if (i > 0 && i < pts.length - 1) tt = clamp(snapT(t, e.altKey), pts[i - 1][0] + TICK, pts[i + 1][0] - TICK);
      pts[i] = [tt, round(v), pts[i][2] ?? 0];
      save(clip, pts);
      render(clip);
      plot.querySelector(`.sq-apt[data-i="${i}"]`)?.classList.add('is-active');
      showTip(plot, `${(tt / len) * 100}%`, `${(1 - v) * 100}%`, `${Math.round(v * 100)}%`);
    }
  });

  const end = (e) => {
    if (!d || e.pointerId !== d.id) return;
    d.plot.releasePointerCapture(e.pointerId);
    d.plot.querySelectorAll('.is-active').forEach((x) => x.classList.remove('is-active'));
    hideTip();
    if (d.moved) onChange({ type: 'automation', clip: d.clip, points: pointsOf(d.clip) });
    d = null;
  };
  lanes.addEventListener('pointerup', end);
  lanes.addEventListener('pointercancel', end);

  // 더블 클릭: 점 = 지우기(처음·끝 제외), ↕ = 직선으로
  lanes.addEventListener('dblclick', (e) => {
    if (!isAutomationMode()) return;
    const plot = e.target.closest('.sq-auto__plot');
    if (!plot) return;
    const clip = plot.closest('.sq-auto');
    const pts = pointsOf(clip);
    // (끌기 때 포인터를 plot 에 붙잡아 target 이 plot 이 될 수 있어 위치로도 찾음)
    const near = (sel) => [...plot.querySelectorAll(sel)].find((el) => {
      const r = el.getBoundingClientRect();
      return Math.abs(r.left + r.width / 2 - e.clientX) <= 7 && Math.abs(r.top + r.height / 2 - e.clientY) <= 7;
    });
    const handle = e.target.closest('.sq-acurve') || near('.sq-acurve:not([hidden])');
    const dot = e.target.closest('.sq-apt') || near('.sq-apt');
    if (handle) {
      pts[Number(handle.dataset.i)][2] = 0;
    } else if (dot) {
      const i = Number(dot.dataset.i);
      if (i === 0 || i === pts.length - 1) return;
      pts.splice(i, 1);
      pts[i - 1][2] = 0;
    } else {
      return;
    }
    save(clip, pts);
    render(clip);
    onChange({ type: 'automation', clip, points: pointsOf(clip) });
  });
}
