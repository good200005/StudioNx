// 내보내기 계획 계산 (S1-11b, PRD 03 FR-301 · FR-307)
// 내보내기 창에서 고른 옵션을 "몇 tick 부터 몇 tick 까지, 꼬리는 몇 초, 파일명은 무엇" 으로 바꾸는 순수 함수 모음입니다.
// 소리 장치를 쓰지 않으므로 Node 에서도 시험합니다.

import { ticksToSecondsWithChanges } from './timing.js';
import { delaySeconds } from './effects.js';
import { resolveParams } from './synth.js';

/** 꼬리(tail) 길이의 최댓값(초) — 창의 입력 한도와 같음 */
export const MAX_TAIL_SECONDS = 30;

/**
 * 곡의 끝 tick = 모든 클립의 끝(start + length) 중 가장 뒤 (순수 함수)
 * @param {Array<{start_tick:number, length_tick:number}>} clips  오디오와 MIDI 클립을 합친 목록
 * @returns {number} 클립이 없으면 0
 */
export function projectEndTick(clips) {
  let end = 0;
  (clips || []).forEach(function (c) {
    const e = c.start_tick + c.length_tick;
    if (e > end) end = e;
  });
  return end;
}

/**
 * 내보낼 범위를 계산 (순수 함수)
 * - all: 0 부터 곡 끝까지 / loop: 루프 구간 / selected: 선택한 클립들의 가장 앞 시작 ~ 가장 뒤 끝
 * - custom: fromBar 마디의 처음부터 toBar 마디의 끝까지 (마디 번호는 1부터, toBar 마디도 포함)
 * @param {{mode:string, clips?:Array, loop?:({start:number,end:number}|null), selected?:Array, fromBar?:number, toBar?:number, ticksPerBar:number}} opt
 * @returns {{ok:true, startTick:number, endTick:number}|{ok:false, reason:string}}
 *   reason: 'empty'(곡이 비어 있음) | 'no-loop' | 'no-selection' | 'bad-range'
 */
export function resolveExportRange(opt) {
  const tpb = opt.ticksPerBar;
  if (opt.mode === 'all') {
    const end = projectEndTick(opt.clips);
    return end > 0 ? { ok: true, startTick: 0, endTick: end } : { ok: false, reason: 'empty' };
  }
  if (opt.mode === 'loop') {
    const loop = opt.loop;
    if (!loop || !(loop.end > loop.start)) return { ok: false, reason: 'no-loop' };
    return { ok: true, startTick: loop.start, endTick: loop.end };
  }
  if (opt.mode === 'selected') {
    const sel = opt.selected || [];
    if (sel.length === 0) return { ok: false, reason: 'no-selection' };
    let start = Infinity;
    sel.forEach(function (c) { if (c.start_tick < start) start = c.start_tick; });
    const end = projectEndTick(sel);
    return end > start ? { ok: true, startTick: start, endTick: end } : { ok: false, reason: 'no-selection' };
  }
  if (opt.mode === 'custom') {
    const from = Math.floor(Number(opt.fromBar));
    const to = Math.floor(Number(opt.toBar));
    if (!(from >= 1) || !(to >= from)) return { ok: false, reason: 'bad-range' };
    return { ok: true, startTick: (from - 1) * tpb, endTick: to * tpb };
  }
  return { ok: false, reason: 'bad-range' };
}

/**
 * 범위의 길이(초) (순수 함수) — 템포 변화를 반영
 * @param {number} startTick
 * @param {number} endTick
 * @param {number} baseBpm
 * @param {Array} changes
 * @returns {number}
 */
export function rangeSeconds(startTick, endTick, baseBpm, changes) {
  return ticksToSecondsWithChanges(endTick, baseBpm, changes) - ticksToSecondsWithChanges(startTick, baseBpm, changes);
}

/**
 * 이펙트와 악기가 범위 끝 뒤로 남기는 소리의 길이(초)를 어림 (순수 함수) — 꼬리 "Auto" 값
 * - 리버브: decay + pre_delay / 딜레이: 되먹임이 -60dB 로 줄어들 때까지의 반복 시간 / 악기: 가장 긴 env_release
 * - 바이패스한 이펙트와 꺼진 악기 층은 뺍니다. 결과는 0.5초 단위로 올림하고 MAX_TAIL_SECONDS 로 자릅니다
 * @param {Array<{plugin_code:string, schema:Array, params:object, is_bypassed?:boolean}>} effects  모든 트랙(마스터 포함)의 이펙트
 * @param {Array<{schema:Array, params:object, is_enabled?:boolean}>} layers  모든 트랙의 악기 층
 * @param {number} bpm
 * @returns {number}
 */
export function autoTailSeconds(effects, layers, bpm) {
  let tail = 0;
  (effects || []).forEach(function (e) {
    if (e.is_bypassed) return;
    const p = resolveParams(e.schema, e.params);
    if (e.plugin_code === 'reverb') {
      tail = Math.max(tail, (Number(p.decay) || 2) + (Number(p.pre_delay) || 0));
    } else if (e.plugin_code === 'delay') {
      const fb = Math.max(0, Math.min(0.95, Number(p.feedback) || 0));
      const repeats = fb > 0 ? Math.min(60, Math.ceil(Math.log(0.001) / Math.log(fb))) : 1;
      tail = Math.max(tail, delaySeconds(p, bpm) * (repeats + 1));
    }
  });
  (layers || []).forEach(function (l) {
    if (l.is_enabled === false) return;
    const p = resolveParams(l.schema, l.params);
    if (p.env_release != null) tail = Math.max(tail, Number(p.env_release) || 0);
  });
  return Math.min(MAX_TAIL_SECONDS, Math.ceil(tail * 2) / 2);
}

/**
 * 파일 이름으로 쓸 수 없는 글자를 _ 로 바꿈 (순수 함수)
 * @param {string} name
 * @returns {string} 비어 있으면 'Studio Nx'
 */
export function sanitizeFileName(name) {
  const cleaned = String(name == null ? '' : name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned.replace(/^\.+/, '').slice(0, 80) || 'Studio Nx';
}

/**
 * 기본 파일명 (확장자 제외) — `{프로젝트명}_{YYYYMMDD_HHmm}` (순수 함수, 지금 시각의 지역 시간 기준)
 * @param {string} title
 * @param {Date} date
 * @returns {string}
 */
export function exportFileName(title, date) {
  const two = function (n) { return (n < 10 ? '0' : '') + n; };
  const stamp = date.getFullYear() + two(date.getMonth() + 1) + two(date.getDate()) + '_' + two(date.getHours()) + two(date.getMinutes());
  return sanitizeFileName(title) + '_' + stamp;
}

/**
 * 초 → "m:ss" (순수 함수, 올림하지 않고 반올림)
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

/**
 * 바이트 수 → "11.8 MB" 같은 글자 (순수 함수)
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
