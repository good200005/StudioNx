// 오프라인 렌더링 (S1-11b, PRD 03 FR-302 · FR-306)
// 재생과 같은 그래프(MixerGraph · EffectRack · InstrumentRack · ClipPlayer · NotePlayer)를 OfflineAudioContext 에 만들어,
// 범위 안의 소리를 실시간보다 빠르게 계산합니다. 재생과 코드를 나눠 쓰므로 들리는 소리와 파일의 소리가 같습니다.
// 노드를 한꺼번에 만들지 않고 2초 창마다 suspend 로 멈춰 가며 만들기 때문에, 진행률을 알려 주고 도중에 멈출 수 있습니다.

import { MixerGraph } from './mixer.js';
import { ClipPlayer, clipsCovering, clipsStartingIn } from './playback.js';
import { InstrumentRack } from './instruments.js';
import { samplerSampleIds } from './sampler.js';
import { NotePlayer, expandNotes, notesStartingIn } from './notes.js';
import { EffectRack } from './effect_rack.js';
import { ticksToSecondsWithChanges, secondsToTicks } from './timing.js';

/** 한 번에 노드를 만들어 두는 시간 창(초) */
export const WINDOW_SECONDS = 2;

/**
 * 범위 [startTick, endTick) 와 겹치는 클립만 남기고, 범위 밖으로 나가는 끝은 잘라 냄 (순수 함수)
 * @param {Array<{start_tick:number, length_tick:number}>} clips
 * @param {number} startTick
 * @param {number} endTick
 * @returns {Array<object>} 원본은 바꾸지 않고 복사해서 돌려줌
 */
export function clipsInRange(clips, startTick, endTick) {
  const out = [];
  (clips || []).forEach(function (c) {
    const end = c.start_tick + c.length_tick;
    if (end <= startTick || c.start_tick >= endTick) return;
    const copy = {};
    Object.keys(c).forEach(function (k) { copy[k] = c[k]; });
    copy.length_tick = Math.min(end, endTick) - c.start_tick;
    out.push(copy);
  });
  return out;
}

/**
 * 시간 창의 경계 tick 목록 (순수 함수) — 인접한 창이 경계를 함께 써서 틈이나 겹침이 없음
 * - 경계는 올림해서, 경계 tick 에서 시작하는 소리가 창이 열리는 시각보다 이르지 않게 합니다
 * @param {number} startTick
 * @param {number} endTick
 * @param {number} baseBpm
 * @param {Array} changes
 * @param {number} windowSec
 * @returns {Array<number>} [startTick, ..., endTick] (오름차순, 중복 없음)
 */
export function windowBoundaries(startTick, endTick, baseBpm, changes, windowSec) {
  const t0 = ticksToSecondsWithChanges(startTick, baseBpm, changes);
  const total = ticksToSecondsWithChanges(endTick, baseBpm, changes) - t0;
  const out = [startTick];
  for (let k = 1; k * windowSec < total; k++) {
    const tick = Math.ceil(secondsToTicks(t0 + k * windowSec, baseBpm, changes));
    if (tick > out[out.length - 1] && tick < endTick) out.push(tick);
  }
  out.push(endTick);
  return out;
}

/**
 * 범위를 렌더링해 채널별 샘플을 돌려줌
 * @param {object} o
 * @param {Array} o.tracks             트랙 목록 (믹서 값, 뮤트, 솔로 포함)
 * @param {Array} o.audioClips         오디오 클립 (재생 때와 같은 모양)
 * @param {Array} o.midiClips          MIDI 클립 (notes 포함)
 * @param {function} o.getInstruments  트랙 번호 → 악기 층 목록
 * @param {function} o.getEffects      트랙 번호 → 이펙트 목록
 * @param {number} o.bpm
 * @param {Array} [o.tempoChanges]
 * @param {number} o.startTick
 * @param {number} o.endTick
 * @param {number} o.tailSec           범위 끝 뒤로 더 렌더링할 초 (딜레이와 리버브의 꼬리)
 * @param {number} o.sampleRate
 * @param {function(number):Promise<ArrayBuffer>} o.loadSampleBytes
 * @param {function(number):void} [o.onProgress]  0~1
 * @param {function():boolean} [o.isCancelled]
 * @param {function} [o.OfflineContext]  시험용으로 바꿔 끼움 (기본 OfflineAudioContext)
 * @returns {Promise<{channels:Array<Float32Array>, sampleRate:number, frames:number}>}
 *   취소하면 message 가 'cancelled' 인 Error 로 거절됩니다.
 */
export async function renderOffline(o) {
  const changes = o.tempoChanges || [];
  const progress = o.onProgress || function () {};
  const cancelled = o.isCancelled || function () { return false; };
  const Ctx = o.OfflineContext || (typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null);
  if (!Ctx) throw new Error('이 브라우저는 OfflineAudioContext 를 지원하지 않습니다');

  const rangeSec = ticksToSecondsWithChanges(o.endTick, o.bpm, changes) - ticksToSecondsWithChanges(o.startTick, o.bpm, changes);
  const totalSec = rangeSec + Math.max(0, o.tailSec || 0);
  const frames = Math.max(1, Math.ceil(totalSec * o.sampleRate));
  const ctx = new Ctx(2, frames, o.sampleRate);

  const audioClips = clipsInRange(o.audioClips, o.startTick, o.endTick);
  const midiClips = clipsInRange(o.midiClips, o.startTick, o.endTick);

  // 1) 샘플 디코딩 (오프라인 컨텍스트의 샘플레이트로 다시 맞춰짐). 전체 진행률의 앞 10%
  const buffers = {};
  const ids = [];
  audioClips.forEach(function (c) { if (c.sample_id != null && ids.indexOf(String(c.sample_id)) < 0) ids.push(String(c.sample_id)); });
  // Sampler 악기가 쓰는 샘플도 함께 디코딩 (S1-11c)
  samplerSampleIds(o.getInstruments, o.tracks.map(function (t) { return t.track_id; })).forEach(function (id) {
    if (ids.indexOf(String(id)) < 0) ids.push(String(id));
  });
  for (let i = 0; i < ids.length; i++) {
    if (cancelled()) throw new Error('cancelled');
    try {
      const bytes = await o.loadSampleBytes(Number(ids[i]));
      buffers[ids[i]] = await ctx.decodeAudioData(bytes);
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[export] 샘플 ' + ids[i] + ' 을(를) 불러오지 못해 건너뜁니다', err);
    }
    progress(0.1 * (i + 1) / ids.length);
  }

  // 2) 재생과 같은 그래프
  const mixer = new MixerGraph(ctx);
  const effects = new EffectRack(ctx, mixer, o.getEffects, function () { return o.bpm; });
  const rack = new InstrumentRack(ctx, function (id) { return mixer.trackInput(id); }, o.getInstruments, function (sid) { return buffers[String(sid)] || null; });
  const player = new ClipPlayer(ctx, function (id) { return mixer.trackInput(id); }, function (sid) { return buffers[String(sid)] || null; });
  const notePlayer = new NotePlayer(ctx, function (id, pitch, vel, when, dur) { return rack.playNote(id, pitch, vel, when, dur); });
  effects.sync(o.tracks);
  mixer.applyTracks(o.tracks, true);

  // 3) 창마다 소리를 예약
  const noteEvents = expandNotes(midiClips).filter(function (ev) { return ev.abs_start >= o.startTick; });
  const bounds = windowBoundaries(o.startTick, o.endTick, o.bpm, changes, WINDOW_SECONDS);
  const scheduleWindow = function (k) {
    const a = bounds[k];
    const b = bounds[k + 1];
    const nowTime = ticksToSecondsWithChanges(a, o.bpm, changes) - ticksToSecondsWithChanges(o.startTick, o.bpm, changes);
    if (k === 0) {
      // 시작 위치에 걸쳐 있는 클립은 중간부터 울림
      clipsCovering(audioClips, a).forEach(function (c) { player.schedule(c, a, nowTime, o.bpm, changes); });
    }
    clipsStartingIn(audioClips, a, b).forEach(function (c) { player.schedule(c, a, nowTime, o.bpm, changes); });
    notesStartingIn(noteEvents, a, b).forEach(function (ev) { notePlayer.schedule(ev, a, nowTime, o.bpm, changes); });
  };
  scheduleWindow(0);

  // 4) 창 경계마다 멈춰서 다음 창을 예약. 경계 시각은 렌더링 샘플 단위로 맞춰짐
  const t0 = ticksToSecondsWithChanges(o.startTick, o.bpm, changes);
  const stops = [];
  for (let k = 1; k < bounds.length - 1; k++) {
    const sec = ticksToSecondsWithChanges(bounds[k], o.bpm, changes) - t0;
    if (sec > 0 && sec < totalSec) stops.push({ k: k, sec: sec });
  }
  let failed = null;
  stops.forEach(function (s) {
    ctx.suspend(s.sec).then(function () {
      if (failed) { ctx.resume(); return; }
      if (cancelled()) { failed = new Error('cancelled'); ctx.resume(); return; }   // 남은 구간은 소리 없이 빠르게 끝내고 결과를 버림
      scheduleWindow(s.k);
      progress(0.1 + 0.9 * (s.sec / totalSec));
      ctx.resume();
    });
  });

  const rendered = await ctx.startRendering();
  if (failed) throw failed;
  progress(1);
  const channels = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) channels.push(rendered.getChannelData(c));
  return { channels: channels, sampleRate: rendered.sampleRate, frames: rendered.length };
}
