// 오디오 클립 페이드 편집 (S1-15 항목 i) — Ableton 의 Fade In Start / Fade Out End / Fade Curve 핸들과 같은 방식
// - 클립 양끝 위쪽의 네모 핸들을 안쪽으로 끌면 페이드 길이가 바뀌고, 핸들 사이 곡선 위의 동그란 핸들을 위아래로 끌면 곡선 모양이 바뀝니다
// - 핸들을 더블클릭하면 그 페이드가 지워지고, 선택한 클립에 Ctrl+Alt+F 를 누르면 양끝에 기본 페이드가 생깁니다
// - 시작 페이드와 끝 페이드는 서로 겹치지 않습니다 (합이 클립 길이를 넘을 수 없음)
// - 값은 clip.dataset(fadeIn · fadeOut: 마디, fadeInCurve · fadeOutCurve: -1~1)에 두고, 놓을 때 PATCH /clips/{id} 로 저장합니다
// - 재생은 sequencer-audio.js 가 이 값을 모아 audio/fades.js 의 배율로 소리에 반영합니다

import { api } from '../core/api.js';
import { clipRecord } from './sequencer-devices.js';
import { markDirty } from './sequencer-save.js';
import { registerCommand } from './sequencer-commands.js';

const TICKS_PER_BAR = 3840;
const K = 6;
const DEFAULT_FADE_BARS = 0.125;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** 화면(오토메이션)과 같은 곡선: x 0~1 → 배율 0~1 (올라가는 페이드 기준) */
function shape(x, curve) {
  const a = -(Number(curve) || 0) * K;
  if (Math.abs(a) < 1e-6) return x;
  return (Math.exp(a * x) - 1) / (Math.exp(a) - 1);
}

/** 곡선 중간(x=0.5)의 배율 g 가 되게 하는 curve 값 (닫힌 식: a = 2·ln(1/g − 1)) */
function curveForMid(g) {
  const gg = Math.min(Math.max(g, 0.02), 0.98);
  return Math.min(Math.max(-2 * Math.log(1 / gg - 1) / K, -1), 1);
}

function num(clip, key) {
  const v = parseFloat(clip.dataset[key]);
  return isFinite(v) ? v : 0;
}

function lengthBars(clip) {
  return parseFloat(clip.style.getPropertyValue('--l')) || 0;
}

/** 서버 기록의 페이드를 화면 값(마디)으로 옮김 — 화면 값이 이미 있으면 그대로 둠 */
function adopt(clip) {
  if (clip.dataset.fadeIn !== undefined) return;
  const rec = clip.dataset.clipId ? clipRecord(clip.dataset.clipId) : null;
  clip.dataset.fadeIn = String(rec ? (Number(rec.fade_in_tick) || 0) / TICKS_PER_BAR : 0);
  clip.dataset.fadeOut = String(rec ? (Number(rec.fade_out_tick) || 0) / TICKS_PER_BAR : 0);
  clip.dataset.fadeInCurve = String(rec ? Number(rec.fade_in_curve) || 0 : 0);
  clip.dataset.fadeOutCurve = String(rec ? Number(rec.fade_out_curve) || 0 : 0);
}

function part(clip, side) {
  let el = clip.querySelector('.sq-fade--' + side);
  if (el) return el;
  el = document.createElement('span');
  el.className = 'sq-fade sq-fade--' + side;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = '<path class="sq-fade__area"></path><path class="sq-fade__line"></path>';
  el.append(svg);
  ['len', 'curve'].forEach(function (what) {
    const h = document.createElement('i');
    h.className = 'sq-fade__h sq-fade__h--' + what;
    h.dataset.side = side;
    h.dataset.what = what;
    h.title = what === 'len'
      ? (side === 'in' ? 'Fade In Start: drag to change length, double-click to remove' : 'Fade Out End: drag to change length, double-click to remove')
      : 'Fade Curve: drag up or down to change the shape';
    el.append(h);
  });
  clip.append(el);
  return el;
}

/** 한 클립의 페이드 그림을 지금 값으로 다시 그림 */
export function renderFades(clip) {
  if (!clip.classList.contains('sq-clip--audio')) return;
  adopt(clip);
  const len = lengthBars(clip);
  ['in', 'out'].forEach(function (side) {
    const key = side === 'in' ? 'fadeIn' : 'fadeOut';
    const curve = num(clip, key + 'Curve');
    const bars = Math.min(num(clip, key), len);
    const el = part(clip, side);
    el.classList.toggle('is-empty', !(bars > 0));
    if (!(bars > 0)) {
      el.style.width = '0';   // 페이드가 없을 때도 핸들은 클립 끝에 둠 (끌어서 만듦)
      return;
    }
    el.style.width = (len > 0 ? bars / len * 100 : 0) + '%';
    // 곡선: 올라가는 모양을 그린 뒤 끝 페이드는 좌우로 뒤집음
    let d = '';
    for (let i = 0; i <= 24; i++) {
      const x = i / 24;
      const g = shape(side === 'in' ? x : 1 - x, curve);
      d += (i ? 'L' : 'M') + (x * 100).toFixed(2) + ' ' + ((1 - g) * 100).toFixed(2) + ' ';
    }
    el.querySelector('.sq-fade__line').setAttribute('d', d);
    el.querySelector('.sq-fade__area').setAttribute('d', d + 'L' + (side === 'in' ? '0 0' : '100 0') + ' Z');
    const mid = el.querySelector('.sq-fade__h--curve');
    mid.style.left = '50%';
    mid.style.top = ((1 - shape(0.5, curve)) * 100) + '%';
  });
}

/** 화면의 모든 오디오 클립을 다시 그림 (프로젝트를 불러온 뒤) */
export function syncFades() {
  document.querySelectorAll('.sq-clip--audio').forEach(renderFades);
}

function save(clip) {
  const id = clip.dataset.clipId;
  if (!id) return;
  const body = {
    fade_in_tick: Math.round(num(clip, 'fadeIn') * TICKS_PER_BAR),
    fade_out_tick: Math.round(num(clip, 'fadeOut') * TICKS_PER_BAR),
    fade_in_curve: Math.round(num(clip, 'fadeInCurve') * 100) / 100,
    fade_out_curve: Math.round(num(clip, 'fadeOutCurve') * 100) / 100,
  };
  const rec = clipRecord(id);
  if (rec) Object.assign(rec, body);
  api.patch('/clips/' + encodeURIComponent(id), body).then(function () { markDirty('clip'); })
    .catch(function (err) { if (window.console) console.warn('[fade] save failed', err); });
}

function barPx(clip) {
  const len = lengthBars(clip);
  return len > 0 ? clip.getBoundingClientRect().width / len : 28.8;
}

function startDrag(e) {
  const h = e.target.closest ? e.target.closest('.sq-fade__h') : null;
  if (!h || e.button !== 0) return;
  const clip = h.closest('.sq-clip');
  if (!clip) return;
  e.preventDefault();
  e.stopPropagation();
  adopt(clip);
  const side = h.dataset.side;
  const key = side === 'in' ? 'fadeIn' : 'fadeOut';
  const other = side === 'in' ? 'fadeOut' : 'fadeIn';
  const what = h.dataset.what;
  const rect = clip.getBoundingClientRect();
  const px = barPx(clip);
  const len = lengthBars(clip);
  clip.classList.add('is-fading');
  function move(ev) {
    if (what === 'len') {
      const fromEdge = side === 'in' ? ev.clientX - rect.left : rect.right - ev.clientX;
      let bars = Math.round(fromEdge / px * 100) / 100;                        // 0.01 마디 단위
      bars = Math.min(Math.max(bars, 0), Math.max(0, len - num(clip, other))); // 반대쪽 페이드와 겹치지 않음
      clip.dataset[key] = String(bars);
    } else {
      const box = clip.querySelector('.sq-fade--' + side).getBoundingClientRect();
      if (box.height > 0) clip.dataset[key + 'Curve'] = String(curveForMid(1 - (ev.clientY - box.top) / box.height));
    }
    renderFades(clip);
  }
  function up() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    clip.classList.remove('is-fading');
    save(clip);
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function removeFade(e) {
  const h = e.target.closest ? e.target.closest('.sq-fade__h') : null;
  if (!h) return;
  const clip = h.closest('.sq-clip');
  const key = h.dataset.side === 'in' ? 'fadeIn' : 'fadeOut';
  clip.dataset[key] = '0';
  clip.dataset[key + 'Curve'] = '0';
  renderFades(clip);
  save(clip);
}

/** 선택한 오디오 클립 양끝에 기본 페이드를 만들거나, 이미 있으면 지움 (Ableton 의 Create Fade In/Out) */
function toggleFades() {
  document.querySelectorAll('.sq-clip--audio.is-selected').forEach(function (clip) {
    adopt(clip);
    const has = num(clip, 'fadeIn') > 0 || num(clip, 'fadeOut') > 0;
    const v = has ? 0 : Math.min(DEFAULT_FADE_BARS, lengthBars(clip) / 2);
    clip.dataset.fadeIn = String(v);
    clip.dataset.fadeOut = String(v);
    if (has) { clip.dataset.fadeInCurve = '0'; clip.dataset.fadeOutCurve = '0'; }
    renderFades(clip);
    save(clip);
  });
}

/** 클립 길이가 바뀌면 페이드가 길이 안에 들어오도록 줄임 */
function clampToLength(clip) {
  const len = lengthBars(clip);
  const fi = Math.min(num(clip, 'fadeIn'), len);
  const fo = Math.min(num(clip, 'fadeOut'), Math.max(0, len - fi));
  if (fi !== num(clip, 'fadeIn')) clip.dataset.fadeIn = String(fi);
  if (fo !== num(clip, 'fadeOut')) clip.dataset.fadeOut = String(fo);
}

export function initFades(opts) {
  const lanes = opts.lanes;
  lanes.addEventListener('pointerdown', startDrag, true);   // 클립 옮기기보다 먼저 받아야 함
  lanes.addEventListener('dblclick', removeFade);
  registerCommand('clip.fades', toggleFades, { label: 'Create / remove fades' });
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.altKey && !e.shiftKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); toggleFades(); }
  });
  // 새 클립이나 길이가 바뀐 클립의 페이드 그림 갱신
  const mo = new MutationObserver(function (list) {
    list.forEach(function (m) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1 || n.classList.contains('sq-fade')) return;
          // 클립 하나가 들어오든 클립이 든 줄 전체가 들어오든 처리
          const found = n.classList.contains('sq-clip--audio') ? [n] : Array.prototype.slice.call(n.querySelectorAll('.sq-clip--audio'));
          found.forEach(function (c) { if (!c.querySelector('.sq-fade')) renderFades(c); });
        });
      } else if (m.target.classList && m.target.classList.contains('sq-clip--audio')) {
        clampToLength(m.target);
        renderFades(m.target);
      }
    });
  });
  mo.observe(lanes, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  syncFades();
}
