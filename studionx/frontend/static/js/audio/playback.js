// 클립 재생 (S1-11a, PRD 02 FR-205 · FR-221~)
// 오디오 클립을 "언제, 샘플의 어디부터, 얼마나" 울릴지 계산하는 순수 함수와,
// 그 계산을 실제 AudioBufferSourceNode 로 옮기는 ClipPlayer 로 이루어져 있습니다.
// 시간 단위는 tick (1박 = 960). 같은 코드를 실시간과 오프라인 렌더링이 함께 씁니다.

import { ticksToSecondsWithChanges } from './timing.js';
import { dbToGain } from './mixer.js';

/**
 * 구간 [fromTick, toTick) 안에서 새로 시작해야 하는 오디오 클립을 고름 (순수 함수)
 * @param {Array<{start_tick:number}>} clips
 * @param {number} fromTick  포함
 * @param {number} toTick    미포함
 * @returns {Array<object>}
 */
export function clipsStartingIn(clips, fromTick, toTick) {
  return (clips || []).filter(function (c) {
    return c.start_tick >= fromTick && c.start_tick < toTick;
  });
}

/**
 * 재생 위치(tick)가 한가운데 걸친 클립을 고름 — 중간부터 재생해야 하는 클립 (순수 함수)
 * - 시작 tick 이 위치보다 앞이고, 끝(start + length)이 위치보다 뒤인 클립입니다
 * @param {Array<{start_tick:number, length_tick:number}>} clips
 * @param {number} tick
 * @returns {Array<object>}
 */
export function clipsCovering(clips, tick) {
  return (clips || []).filter(function (c) {
    return c.start_tick < tick && c.start_tick + c.length_tick > tick;
  });
}

/**
 * 클립 하나를 샘플의 어디서부터 얼마나 울릴지 계산 (순수 함수)
 * - when: 클립 시작이 울릴 오디오 시각(초). 이미 지난 시작이면 위치만큼 샘플을 건너뜁니다
 * - offsetSec: 샘플 안에서 시작할 위치(초) = 클립 offset + (이미 흐른 길이)
 * - durationSec: 울릴 길이(초) = 남은 클립 길이
 * @param {{start_tick:number, length_tick:number, offset_tick?:number}} clip
 * @param {number} nowTick   지금 위치(tick). 클립이 이보다 뒤에서 시작하면 그 시작을 기준으로 함
 * @param {number} nowTime   지금 tick 이 울릴 오디오 시각(초)
 * @param {number} baseBpm
 * @param {Array} changes    tempo_changes
 * @returns {{when:number, offsetSec:number, durationSec:number}}
 */
export function planClipPlayback(clip, nowTick, nowTime, baseBpm, changes) {
  const startTick = Math.max(clip.start_tick, nowTick);
  const skippedTicks = startTick - clip.start_tick;
  const toSec = function (a, b) {
    return ticksToSecondsWithChanges(b, baseBpm, changes) - ticksToSecondsWithChanges(a, baseBpm, changes);
  };
  const when = nowTime + toSec(nowTick, startTick);
  const offsetSec = toSec(0, (clip.offset_tick || 0) + skippedTicks);
  const durationSec = toSec(startTick, clip.start_tick + clip.length_tick);
  return { when: when, offsetSec: offsetSec, durationSec: durationSec };
}

/**
 * 오디오 클립 재생기 — 클립을 AudioBufferSourceNode 로 예약하고, 멈출 때 모두 끔
 */
export class ClipPlayer {
  /**
   * @param {BaseAudioContext} context
   * @param {function(number|string):AudioNode} trackInput  트랙 번호 → 그 트랙의 입력 노드 (MixerGraph.trackInput)
   * @param {function(number|string):(AudioBuffer|null)} getBuffer  샘플 번호 → 디코딩된 버퍼(없으면 null)
   */
  constructor(context, trackInput, getBuffer) {
    this.context = context;
    this.trackInput = trackInput;
    this.getBuffer = getBuffer;
    this.active = [];   // 울리는 중이거나 예약된 소스 노드
  }

  /**
   * 클립 하나를 예약 (샘플이 아직 없으면 조용히 건너뜀)
   * @param {object} clip  서버 클립 (track_id, sample_id, start_tick, length_tick, offset_tick, gain_db, is_looped, pitch_semitones)
   * @param {number} nowTick
   * @param {number} nowTime
   * @param {number} baseBpm
   * @param {Array} changes
   * @returns {boolean} 예약했으면 true
   */
  schedule(clip, nowTick, nowTime, baseBpm, changes) {
    if (clip.sample_id == null) return false;
    const buffer = this.getBuffer(clip.sample_id);
    if (!buffer) return false;
    const plan = planClipPlayback(clip, nowTick, nowTime, baseBpm, changes);
    if (!(plan.durationSec > 0)) return false;
    // 샘플보다 뒤에서 시작하면 소리가 없음 (루프가 아닐 때)
    if (!clip.is_looped && plan.offsetSec >= buffer.duration) return false;

    const ctx = this.context;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = !!clip.is_looped;
    const semis = Number(clip.pitch_semitones) || 0;
    if (semis !== 0) src.playbackRate.value = Math.pow(2, semis / 12);
    const gain = ctx.createGain();
    gain.gain.value = dbToGain(clip.gain_db || 0);
    src.connect(gain);
    gain.connect(this.trackInput(clip.track_id));

    const when = Math.max(plan.when, ctx.currentTime);
    src.start(when, plan.offsetSec % (buffer.duration || 1));
    src.stop(when + plan.durationSec);
    const self = this;
    src.onended = function () {
      const i = self.active.indexOf(src);
      if (i >= 0) self.active.splice(i, 1);
    };
    this.active.push(src);
    return true;
  }

  /**
   * 울리는 소리와 예약을 모두 끔 (정지 · 일시정지 · 루프 되감기)
   * - atTime 이 있으면 그 오디오 시각에 끊습니다 (루프 되감기는 미리 예약한 시각에 끊어야 소리가 일찍 끊기지 않음)
   * @param {number} [atTime]
   */
  stopAll(atTime) {
    const when = atTime != null ? atTime : 0;
    this.active.slice().forEach(function (src) {
      try { src.stop(when); } catch (e) { /* 이미 끝난 소스 */ }
      if (atTime == null) { try { src.disconnect(); } catch (e) { /* 무시 */ } }
    });
    if (atTime == null) this.active = [];
  }
}
