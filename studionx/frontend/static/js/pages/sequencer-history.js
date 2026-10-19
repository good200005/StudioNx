// 되돌리기 · 다시 하기 (S1-10 — FR-255)
// 설명: docs/ai-notes/javascript/S1-10 - 프로젝트 전체 저장·불러오기/270_sequencer-history.md
// 악기·이펙트(디바이스)를 바꾼 동작을 최소 100단계까지 기억합니다.
// 한 단계는 { label, undo, redo } 한 벌이고, undo/redo 는 이력을 건드리지 않습니다(applying 깃발).
// 메뉴 EDIT > Undo/Redo · Ctrl+Z / Ctrl+Shift+Z · 커맨드 팔레트가 모두 'edit.undo' · 'edit.redo' 명령을 씁니다 (FR-2169).

import { registerCommand, registerCommands } from './sequencer-commands.js';

/** 기억할 최대 단계 (FR-255 — 최소 100) */
export const HISTORY_LIMIT = 100;

/** { label, undo, redo } 목록 — 뒤로 갈수록 최근 */
let stack = [];

/** 다음에 쌓일 자리 = 지금까지 실행한 수 (되돌리기 위치) */
let at = 0;

/** undo/redo 를 실행하는 동안에는 새 이력을 쌓지 않습니다 */
let applying = false;

/** 이력이 바뀔 때 알림 (메뉴 항목 켜고 끄기 등) */
let onStateChange = function () {};

let toast = function () {};

/**
 * 준비 (270) — 부르는 곳: sequencer.js init()
 * 'edit.undo' · 'edit.redo' 명령을 등록해 메뉴·단축키·팔레트가 같은 길로 들어오게 합니다.
 * @param {{ onStateChange?: Function, toast?: Function }} [options]
 */
export function initHistory(options) {
  const opts = options || {};
  if (typeof opts.onStateChange === 'function') onStateChange = opts.onStateChange;
  if (typeof opts.toast === 'function') toast = opts.toast;
  registerCommands({ 'edit.undo': undo, 'edit.redo': redo }, { group: 'edit' });
  registerCommand('edit.clearHistory', clearHistory, { label: 'Clear undo history', group: 'edit' });
  notifyState();
}

/**
 * 이력 한 단계 쌓기 (270) — 바꾼 뒤에 부릅니다
 * @param {{ label: string, undo: Function, redo: Function }} entry
 * @returns {boolean} 쌓았으면 true (되돌리기·다시 하기를 실행하는 중이면 false)
 */
export function pushHistory(entry) {
  if (applying || !entry || typeof entry.undo !== 'function' || typeof entry.redo !== 'function') return false;
  stack = stack.slice(0, at);
  stack.push(entry);
  if (stack.length > HISTORY_LIMIT) stack = stack.slice(stack.length - HISTORY_LIMIT);
  at = stack.length;
  notifyState();
  return true;
}

/**
 * 되돌리기 (270) — 가장 최근 동작 한 단계를 물립니다
 * @returns {boolean} 되돌렸으면 true
 */
export function undo() {
  if (!canUndo()) {
    toast('Nothing to undo');
    return false;
  }
  const entry = stack[at - 1];
  applying = true;
  try {
    entry.undo();
  } finally {
    applying = false;
  }
  at -= 1;
  notifyState();
  return true;
}

/**
 * 다시 하기 (270)
 * @returns {boolean} 다시 했으면 true
 */
export function redo() {
  if (!canRedo()) {
    toast('Nothing to redo');
    return false;
  }
  const entry = stack[at];
  applying = true;
  try {
    entry.redo();
  } finally {
    applying = false;
  }
  at += 1;
  notifyState();
  return true;
}

/** 되돌릴 것이 있나요? (270) */
export function canUndo() {
  return at > 0;
}

/** 다시 할 것이 있나요? (270) */
export function canRedo() {
  return at < stack.length;
}

/** 지금까지 쌓인 단계 수 (270) */
export function historyDepth() {
  return stack.length;
}

/** 이력 비우기 (270) — 프로젝트를 새로 열었을 때 */
export function clearHistory() {
  stack = [];
  at = 0;
  notifyState();
}

/** 이력 목록의 이름들 (270) — 시험·팔레트에서 확인용 */
export function historyLabels() {
  return stack.map(function (entry, i) { return (i < at ? '' : '↷ ') + entry.label; });
}

/** 메뉴 EDIT > Undo · Redo 항목을 지금 상태에 맞추기 (270) */
function notifyState() {
  const map = { 'edit.undo': canUndo(), 'edit.redo': canRedo() };
  Object.keys(map).forEach(function (id) {
    const btn = document.querySelector('[data-command="' + id + '"]');
    if (!btn) return;
    btn.disabled = !map[id];
    btn.setAttribute('aria-disabled', String(!map[id]));
  });
  onStateChange({ at: at, depth: stack.length });
}
