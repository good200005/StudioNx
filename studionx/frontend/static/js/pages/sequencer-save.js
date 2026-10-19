// 저장 (S1-10 — FR-253 · FR-256)
// 설명: docs/ai-notes/javascript/S1-10 - 프로젝트 전체 저장·불러오기/271_sequencer-save.md
// 곡 설정(BPM · 박자 · Key · 스케일 · 샘플레이트 · 마스터 설정)을 모아 두었다가
// Ctrl+S(수동 저장) 또는 자동 저장 때 PATCH /projects/{id}/settings 로 한 번에 보냅니다.
// 저장 안 된 것이 남아 있으면 창을 닫거나 옮기려 할 때 브라우저가 한 번 물어봅니다 (FR-256).

import { api } from '../core/api.js';
import { registerCommand } from './sequencer-commands.js';

/** PATCH /projects/{id}/settings 가 받는 칸 (backend schemas/full_project.py 와 같음) */
export const SETTINGS_KEYS = ['bpm', 'time_sig_num', 'time_sig_den', 'music_key', 'scale_mode', 'sample_rate', 'master_settings'];

/** 자동 저장 간격 — 마지막으로 바꾼 뒤 이만큼 지나면 저장합니다 (FR-253) */
export const AUTOSAVE_MS = 30000;

let projectId = null;
let dirty = false;
let pending = {};
let saving = false;
let timer = 0;
let autosaveMs = AUTOSAVE_MS;
let toast = function () {};

/**
 * 준비 (271) — 부르는 곳: sequencer.js init()
 * 프로젝트 번호를 받고, Ctrl+S 명령과 '떠나기 전 물어보기'를 배선합니다.
 * @param {{ projectId?: number|string, autosaveMs?: number, toast?: Function }} [options]
 */
export function initSave(options) {
  const opts = options || {};
  if (typeof opts.toast === 'function') toast = opts.toast;
  if (opts.autosaveMs) autosaveMs = opts.autosaveMs;
  if (opts.projectId !== undefined) setProjectId(opts.projectId);
  registerCommand('project.save', function () { saveNow('menu'); }, { label: 'Save project', group: 'file' });
  registerCommand('project.discard', discardChanges, { label: 'Discard unsaved changes', group: 'file' });
  window.addEventListener('beforeunload', onBeforeUnload);
  paintState();
}

/**
 * 프로젝트 번호 연결 (271) — loadProject 가 부릅니다
 * @param {number|string|null} id
 */
export function setProjectId(id) {
  projectId = id === null || id === undefined || id === '' ? null : String(id);
}

/** 지금 연결된 프로젝트 번호 (271) */
export function projectIdOf() {
  return projectId;
}

/**
 * 저장 안 된 것이 있다고 표시 (271)
 * @param {string} [reason] 무엇이 바뀌었는지 (시험·로그용)
 */
export function markDirty(reason) {
  dirty = true;
  if (reason && window.console) console.debug('[save] dirty:', reason);
  paintState();
  if (!timer) timer = window.setTimeout(function () { timer = 0; saveNow('auto'); }, autosaveMs);
}

/**
 * 곡 설정 바뀐 칸 담아 두기 (271) — 화면이 BPM · Key 를 바꿀 때마다 부릅니다
 * @param {object} patch  { bpm: 140, music_key: 'Am' … }
 */
export function queueSettings(patch) {
  let added = false;
  SETTINGS_KEYS.forEach(function (key) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, key)) {
      pending[key] = patch[key];
      added = true;
    }
  });
  if (added) markDirty('settings');
}

/** 담아 둔 곡 설정 (271) — 시험용 */
export function pendingSettings() {
  return Object.assign({}, pending);
}

/** 저장 안 된 것이 있나요? (271) */
export function isDirty() {
  return dirty;
}

/**
 * 저장 (271) — Ctrl+S · 메뉴 FILE > Save · 자동 저장 · 커맨드 팔레트가 모두 여기로 옵니다
 * @param {'menu'|'auto'|'leave'} [reason]
 * @returns {Promise<boolean>} 서버에 저장했거나 저장할 것이 없었으면 true
 */
export async function saveNow(reason) {
  const why = reason || 'menu';
  if (why === 'menu' && timer) { window.clearTimeout(timer); timer = 0; }
  if (!projectId) {
    if (why === 'menu') toast('Saving needs the server — open a project from My Projects');
    return false;
  }
  if (saving) return false;
  if (!dirty) {
    if (why === 'menu') toast('Everything is saved');
    return true;
  }
  if (!Object.keys(pending).length) {
    dirty = false;
    paintState();
    if (why === 'menu') toast('Everything is saved');
    return true;
  }
  const body = Object.assign({}, pending);
  saving = true;
  paintState('saving');
  try {
    await api.patch('/projects/' + encodeURIComponent(projectId) + '/settings', body);
    Object.keys(body).forEach(function (key) {
      if (pending[key] === body[key]) delete pending[key];
    });
    dirty = Object.keys(pending).length > 0;
    saving = false;
    paintState();
    if (why === 'menu') toast('Saved');
    return true;
  } catch (err) {
    saving = false;
    dirty = true;
    paintState();
    toast(err && err.status === 403 ? 'You cannot save this project' : 'Could not save — we will try again');
    if (window.console) console.warn('[save]', err);
    if (!timer) timer = window.setTimeout(function () { timer = 0; saveNow('auto'); }, autosaveMs);
    return false;
  }
}

/** 담아 둔 것을 버리고 저장된 상태로 되돌리기 (271) — 메뉴 FILE > Discard unsaved changes */
export function discardChanges() {
  if (timer) { window.clearTimeout(timer); timer = 0; }
  pending = {};
  dirty = false;
  paintState();
  toast('Unsaved changes dropped');
}

/**
 * 창을 닫거나 옮기려 할 때 (271 · FR-256) — 저장 안 된 것이 있으면 브라우저가 한 번 물어봅니다
 * @param {BeforeUnloadEvent} event
 */
function onBeforeUnload(event) {
  if (!dirty) return undefined;
  event.preventDefault();
  event.returnValue = '';
  return '';
}

/** 상단 저장 표시(#save-state) 바꾸기 (271) */
function paintState(force) {
  const chip = document.getElementById('save-state');
  if (!chip) return;
  const text = force === 'saving' ? '● Saving…' : dirty ? '● Unsaved changes' : '● Saved';
  chip.textContent = text;
  chip.classList.toggle('is-dirty', dirty);
  chip.setAttribute('aria-label', text.replace('●', '').trim());
}
