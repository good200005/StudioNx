// 시퀀서 명령 레지스트리 · 커맨드 팔레트 (S1-10 — FR-2169)
// 설명: docs/ai-notes/javascript/S1-10 - 프로젝트 전체 저장·불러오기/269_sequencer-commands.md
// 상단 메뉴(button[data-command]) · 단축키 · 커맨드 팔레트(Ctrl+P) · 오른쪽 클릭 메뉴 · Nyxi 액션이
// 모두 같은 명령 번호('edit.undo', 'view.mixer' …)를 쓰고, 여기 등록된 함수 하나를 부릅니다.
// 명령을 처리하는 모듈이 registerCommand 로 자기 함수를 올리고, 부르는 쪽은 runCommand 만 알면 됩니다.

/** id → { run, label, keys, group } */
const registry = {};

/** 팔레트가 열려 있는 동안 고른 줄 */
let cursor = 0;

/** 팔레트 만들 때 고른 목록 */
let rows = [];

let palette = null;
let paletteInput = null;
let paletteList = null;
let toast = function () {};

/**
 * 명령 하나 등록 (269) — 같은 번호로 다시 등록하면 마지막 것이 이깁니다.
 * @param {string} id    명령 번호 (예: 'edit.undo')
 * @param {Function} run 실행할 함수
 * @param {{ label?: string, keys?: string, group?: string }} [meta]
 * @returns {boolean} 등록했으면 true
 */
export function registerCommand(id, run, meta) {
  if (!id || typeof run !== 'function') return false;
  const info = meta || {};
  registry[id] = {
    run: run,
    label: info.label || labelFromDom(id) || id,
    keys: info.keys || keysFromDom(id),
    group: info.group || 'command',
  };
  return true;
}

/**
 * 명령 여러 개 한꺼번에 등록 (269) — 사전({ id: 함수 })을 그대로 넘깁니다
 * @param {Object<string, Function>} map
 * @param {{ label?: string, keys?: string, group?: string }} [meta]  모든 명령에 함께 붙일 값
 */
export function registerCommands(map, meta) {
  Object.keys(map || {}).forEach(function (id) { registerCommand(id, map[id], meta); });
}

/** 명령 지우기 (269) */
export function unregisterCommand(id) {
  delete registry[id];
}

/** 이 번호의 명령이 있나요? (269) */
export function hasCommand(id) {
  return !!registry[id];
}

/** 명령 한 건의 정보 (269) — 없으면 null */
export function commandInfo(id) {
  return registry[id] || null;
}

/** 등록된 명령 목록 (269) — 팔레트가 이름 순으로 보여 줍니다 */
export function listCommands() {
  return Object.keys(registry).map(function (id) {
    return { id: id, label: registry[id].label, keys: registry[id].keys, group: registry[id].group };
  }).sort(function (a, b) { return a.label.localeCompare(b.label); });
}

/**
 * 명령 실행 (269) — 없는 번호면 false 를 돌려줍니다 (부르는 쪽이 '아직' 안내를 띄울 수 있게)
 * @param {string} id
 * @returns {boolean}
 */
export function runCommand(id) {
  const info = registry[id];
  if (!info) return false;
  info.run();
  return true;
}

/* ───────── 커맨드 팔레트 (Ctrl+P · FR-2169) ───────── */

/**
 * 팔레트 준비 (269) — 부르는 곳: sequencer.js init()
 * Ctrl+P 로 열리고, 'view.palette' 명령으로도 열립니다.
 * @param {{ toast?: Function }} [options]
 */
export function initPalette(options) {
  if (options && typeof options.toast === 'function') toast = options.toast;
  registerCommand('view.palette', function () { openPalette(); }, {
    label: 'Command palette', keys: 'Ctrl+P', group: 'view',
  });
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    if (e.key.toLowerCase() !== 'p') return;
    if (isTyping(e.target) || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    openPalette();
  });
}

/** 팔레트 열기 (269) */
export function openPalette() {
  buildPalette();
  palette.hidden = false;
  paletteInput.value = '';
  paletteInput.placeholder = 'Type a command…';
  filterPalette('');
  paletteInput.focus();
}

/** 팔레트 닫기 (269) */
export function closePalette() {
  if (palette) palette.hidden = true;
}

/** 팔레트가 열려 있나요? (269) */
export function isPaletteOpen() {
  return !!palette && !palette.hidden;
}

function buildPalette() {
  if (palette) return;
  palette = document.createElement('div');
  palette.className = 'sq-palette';
  palette.hidden = true;
  palette.innerHTML = ''
    + '<div class="sq-palette__box" role="dialog" aria-label="Command palette">'
    + '<input class="sq-palette__input" type="search" autocomplete="off" spellcheck="false">'
    + '<ul class="sq-palette__list" role="listbox"></ul>'
    + '</div>';
  document.body.append(palette);
  paletteInput = palette.querySelector('.sq-palette__input');
  paletteList = palette.querySelector('.sq-palette__list');

  palette.addEventListener('pointerdown', function (e) { if (e.target === palette) closePalette(); });
  paletteInput.addEventListener('input', function () { filterPalette(paletteInput.value); });
  paletteInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); pickCursor(); }
    e.stopPropagation();
  });
  paletteList.addEventListener('click', function (e) {
    const li = e.target.closest('li');
    if (li) runRow(Number(li.dataset.at));
  });
}

/** 글자에 맞는 명령만 남기기 (269) */
function filterPalette(query) {
  const q = String(query || '').trim().toLowerCase();
  rows = listCommands().filter(function (c) {
    if (!q) return true;
    return c.label.toLowerCase().indexOf(q) >= 0 || c.id.toLowerCase().indexOf(q) >= 0;
  });
  cursor = 0;
  if (!rows.length) {
    paletteList.innerHTML = '<li class="sq-palette__empty">No command matches.</li>';
    return;
  }
  paletteList.innerHTML = rows.map(function (c, i) {
    return '<li role="option" data-at="' + i + '" aria-selected="' + (i === cursor) + '">'
      + '<span>' + escapeHtml(c.label) + '</span>'
      + (c.keys ? '<kbd>' + escapeHtml(c.keys) + '</kbd>' : '')
      + '</li>';
  }).join('');
}

function moveCursor(step) {
  if (!rows.length) return;
  cursor = (cursor + step + rows.length) % rows.length;
  Array.prototype.forEach.call(paletteList.querySelectorAll('li'), function (li, i) {
    li.setAttribute('aria-selected', String(i === cursor));
  });
  const cur = paletteList.querySelector('li[aria-selected="true"]');
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
}

function pickCursor() {
  runRow(cursor);
}

/** 줄 하나 실행 (269) — 팔레트를 닫고 명령을 부릅니다 */
function runRow(at) {
  const row = rows[at];
  if (!row) return;
  closePalette();
  if (!runCommand(row.id)) toast(row.label + ' — not available yet');
}

/* ───────── 작은 도우미 ───────── */

/** 입력칸에 커서가 있으면 단축키를 무시 (269) */
function isTyping(el) {
  if (!el || !el.closest) return false;
  return !!el.closest('input, textarea, select, [contenteditable]');
}

/** 메뉴 항목(button[data-command])에서 이름을 가져오기 (269) */
function labelFromDom(id) {
  const btn = document.querySelector('[data-command="' + id + '"]');
  if (!btn) return '';
  const kbd = btn.querySelector('kbd');
  const text = kbd ? btn.textContent.replace(kbd.textContent, '') : btn.textContent;
  return text.trim();
}

/** 메뉴 항목의 <kbd> 에서 단축키 글자를 가져오기 (269) */
function keysFromDom(id) {
  const btn = document.querySelector('[data-command="' + id + '"]');
  const kbd = btn ? btn.querySelector('kbd') : null;
  return kbd ? kbd.textContent.trim() : '';
}

/** 팔레트 목록에 넣을 글자 다듬기 (269) */
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}
