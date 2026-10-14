// 오디오 엔진 (S1-05, PRD 02 FR-201~205)
// 순수 계산(timing · scheduler · metronome)을 실제 AudioContext 에 연결하는 얇은 층입니다.
// clock 은 AudioContext.currentTime, 타이머는 setInterval, 클릭 소리는 오실레이터로 냅니다.
// 브라우저 전용 부분(오디오 노드)은 options.context 로 바꿔 끼울 수 있어 Node 에서도 시험합니다.

import { Transport } from './scheduler.js';
import { Metronome, countInTicks } from './metronome.js';

/**
 * 짧은 클릭 소리를 내는 함수를 만듦 (브라우저 오디오)
 * - time 시각에 아주 짧은 사각파를 울렸다가 곧바로 줄여서 "딱" 소리를 냅니다
 * - accent(마디 첫 박)는 더 높고 큰 소리로 구분합니다
 * @param {AudioContext} context
 * @param {AudioNode} [destination]
 * @returns {function(number, boolean):void} playClick(time, accent)
 */
export function createClickPlayer(context, destination) {
  if (destination == null) destination = context.destination;
  return function playClick(time, accent) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1600 : 1000;
    const dur = 0.03;
    gain.gain.setValueAtTime(accent ? 0.3 : 0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  };
}

/**
 * 오디오 엔진 — AudioContext · 트랜스포트 · 메트로놈을 묶음
 * - 페이지는 onStep(tick, time) 로 악기 소리를 얹고, 이 클래스로 재생을 다룹니다
 * - 시험할 때는 options.context·setTimer·clearTimer 를 가짜로 바꿔 끼웁니다
 */
export class AudioEngine {
  /**
   * @param {object} [options]
   * @param {AudioContext} [options.context]  없으면 window.AudioContext 로 만듦(브라우저)
   * @param {AudioNode} [options.destination]
   * @param {function(number, number):void} [options.onStep]
   * @param {number} [options.baseBpm] @param {Array} [options.changes]
   * @param {number} [options.timeSigNum] @param {number} [options.timeSigDen]
   * @param {boolean} [options.metronomeEnabled]
   */
  constructor(options) {
    options = options || {};
    let context = options.context != null ? options.context : null;
    if (context == null) {
      const Ctor = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext) : null;
      if (Ctor == null) throw new Error('AudioContext 를 만들 수 없습니다 — options.context 를 넘겨 주세요');
      context = new Ctor();
    }
    this.context = context;
    this.destination = options.destination != null ? options.destination : context.destination;

    const self = this;
    this.clock = { now: function () { return self.context.currentTime; } };
    this.onStep = typeof options.onStep === 'function' ? options.onStep : function () {};

    this.metronome = new Metronome({
      click: createClickPlayer(context, this.destination),
      enabled: options.metronomeEnabled != null ? !!options.metronomeEnabled : false,
      timeSigNum: options.timeSigNum != null ? options.timeSigNum : 4,
      timeSigDen: options.timeSigDen != null ? options.timeSigDen : 4
    });

    this.transport = new Transport({
      clock: this.clock,
      baseBpm: options.baseBpm != null ? options.baseBpm : 120,
      changes: options.changes != null ? options.changes : [],
      stepTicks: options.stepTicks,
      lookahead: options.lookahead,
      intervalMs: options.intervalMs,
      startDelay: options.startDelay,
      setTimer: options.setTimer,
      clearTimer: options.clearTimer,
      onStep: function (tick, time) { self._onStep(tick, time); }
    });
  }

  /** 스케줄러가 넘긴 단계마다 메트로놈을 울리고, 페이지 onStep 을 부름(내부용) */
  _onStep(tick, time) {
    this.metronome.step(tick, time);
    this.onStep(tick, time);
  }

  /**
   * 재생 시작 (FR-201)
   * - 브라우저는 사용자 조작 뒤에야 소리가 나므로, 멈춰 있으면 context 를 깨웁니다(resume)
   * - options.countIn 이 참이면 한 마디 카운트인 뒤 0 에서 곡이 시작됩니다(FR-203)
   * @param {{fromTick?:number, countIn?:boolean}} [options]
   * @returns {AudioEngine} self
   */
  start(options) {
    options = options || {};
    this._resumeContext();
    let from = options.fromTick != null ? options.fromTick : 0;
    if (options.countIn) from = -countInTicks(this.metronome.timeSigNum, this.metronome.timeSigDen);
    this.transport.start(from);
    return this;
  }

  /** 재생 정지 */
  stop() { this.transport.stop(); return this; }
  /** 일시정지 */
  pause() { this.transport.pause(); return this; }
  /** 이어서 재생 */
  resume() { this._resumeContext(); this.transport.resume(); return this; }
  /** 위치 이동 */
  seek(tick) { this.transport.seek(tick); return this; }
  /** 재생 중 템포 변경 (FR-202, FR-202a) */
  setTempo(baseBpm, changes) { this.transport.setTempo(baseBpm, changes); return this; }
  /** 루프 구간·on/off (FR-204) */
  setLoop(startTick, endTick, enabled) { this.transport.setLoop(startTick, endTick, enabled); return this; }
  /** 메트로놈 on/off (FR-203) */
  setMetronome(on) { this.metronome.setEnabled(on); return this; }
  /** 박자 변경 (FR-202a) */
  setTimeSignature(timeSigNum, timeSigDen) { this.metronome.setTimeSignature(timeSigNum, timeSigDen); return this; }
  /** 지금 재생 위치(tick) — 화면 재생선용 */
  positionTick() { return this.transport.positionTick(); }

  /** 멈춰 있으면 AudioContext 를 깨움(내부용). 브라우저 자동재생 정책 대응 */
  _resumeContext() {
    const ctx = this.context;
    if (ctx != null && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try { ctx.resume(); } catch (e) { /* 무시 */ }
    }
  }
}
