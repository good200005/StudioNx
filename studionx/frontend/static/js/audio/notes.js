// MIDI 노트 재생 계산 (S1-11a, PRD 02 FR-205 · FR-233)
// MIDI 클립 안의 노트를 "타임라인 위의 절대 시작 tick" 으로 펼치고, 단계마다 새로 시작할 노트를 고르는
// 순수 함수와, 그 노트를 악기에 흘려 보내는 NotePlayer 로 이루어져 있습니다.
// 노트의 start_tick 은 패턴 시작 기준이고, 클립은 offset_tick 부터 length_tick 만큼을 보여 줍니다
// (오디오 클립의 offset 과 같은 뜻). 클립 밖으로 나가는 노트는 클립 끝에서 잘립니다.

import { ticksToSecondsWithChanges } from './timing.js';
import { noteToFreq } from './synth.js';

/**
 * MIDI 클립들의 노트를 타임라인 절대 tick 으로 펼침 (순수 함수)
 * - 음소거된 노트(is_muted)는 뺍니다
 * - 클립이 보여 주는 구간(offset ~ offset + length) 밖의 노트는 뺍니다
 * @param {Array<{track_id:number, start_tick:number, length_tick:number, offset_tick?:number, notes:Array}>} clips
 * @returns {Array<{track_id:number, pitch:number, velocity:number, abs_start:number, length_tick:number}>} abs_start 순
 */
export function expandNotes(clips) {
  const out = [];
  (clips || []).forEach(function (clip) {
    const offset = clip.offset_tick || 0;
    const clipEnd = clip.start_tick + clip.length_tick;
    (clip.notes || []).forEach(function (n) {
      if (n.is_muted) return;
      if (n.start_tick < offset) return;
      const abs = clip.start_tick + (n.start_tick - offset);
      if (abs >= clipEnd) return;
      out.push({
        track_id: clip.track_id,
        pitch: n.pitch,
        velocity: n.velocity != null ? n.velocity : 100,
        abs_start: abs,
        length_tick: Math.max(1, Math.min(n.length_tick, clipEnd - abs)),
      });
    });
  });
  out.sort(function (a, b) { return a.abs_start - b.abs_start; });
  return out;
}

/**
 * 구간 [fromTick, toTick) 에서 새로 시작하는 노트를 고름 (순수 함수)
 * @param {Array<{abs_start:number}>} events  expandNotes 결과
 * @param {number} fromTick  포함
 * @param {number} toTick    미포함
 */
export function notesStartingIn(events, fromTick, toTick) {
  return (events || []).filter(function (e) { return e.abs_start >= fromTick && e.abs_start < toTick; });
}

/**
 * 노트 하나를 울릴 시각과 길이(초)로 바꿈 (순수 함수)
 * @param {{abs_start:number, length_tick:number}} ev
 * @param {number} nowTick  지금 단계의 tick
 * @param {number} nowTime  그 tick 이 울릴 오디오 시각(초)
 * @param {number} baseBpm
 * @param {Array} changes   tempo_changes
 * @returns {{when:number, durationSec:number}}
 */
export function planNote(ev, nowTick, nowTime, baseBpm, changes) {
  const sec = function (a, b) {
    return ticksToSecondsWithChanges(b, baseBpm, changes) - ticksToSecondsWithChanges(a, baseBpm, changes);
  };
  return { when: nowTime + sec(nowTick, ev.abs_start), durationSec: sec(ev.abs_start, ev.abs_start + ev.length_tick) };
}

/**
 * 노트 재생기 — 노트를 해당 트랙의 악기 층에 예약하고, 멈출 때 울리는 소리를 끔
 */
export class NotePlayer {
  /**
   * @param {BaseAudioContext} context
   * @param {function(number|string, number, number, number, number):Array<{stop:function(number):void}>} playOnTrack
   *   (trackId, pitch, velocity, when, durationSec) → 울린 소리 목록 (트랙의 악기 층마다 하나)
   */
  constructor(context, playOnTrack) {
    this.context = context;
    this.playOnTrack = playOnTrack;
    this.active = [];
  }

  /** 노트 하나를 예약 */
  schedule(ev, nowTick, nowTime, baseBpm, changes) {
    const plan = planNote(ev, nowTick, nowTime, baseBpm, changes);
    if (!(plan.durationSec > 0)) return 0;
    const voices = this.playOnTrack(ev.track_id, ev.pitch, ev.velocity, Math.max(plan.when, this.context.currentTime), plan.durationSec);
    const self = this;
    (voices || []).forEach(function (v) {
      self.active.push({ voice: v, end: plan.when + plan.durationSec + 6 });   // 릴리스 여유 포함
    });
    this._prune();
    return (voices || []).length;
  }

  /** 오래전에 끝난 소리를 목록에서 뺌 (목록이 끝없이 자라지 않게) */
  _prune() {
    const now = this.context.currentTime;
    this.active = this.active.filter(function (a) { return a.end > now; });
  }

  /**
   * 울리는 소리를 모두 끔
   * @param {number} [atTime]  이 시각에 끊음 (없으면 지금)
   */
  stopAll(atTime) {
    const t = atTime != null ? atTime : this.context.currentTime;
    this.active.forEach(function (a) { try { a.voice.stop(t); } catch (e) { /* 무시 */ } });
    this.active = [];
  }
}

export { noteToFreq };
