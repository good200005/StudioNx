// 오디오 스케줄러 (S1-05, PRD 02 FR-201 · FR-205)
// planSchedule 은 소리·시계를 쓰지 않는 순수 계산(시험하기 쉬움)이고,
// Transport 는 그 계산을 실제 소리 시각에 얹는 루프임 — clock(AudioContext)과 타이머를 주입받음.
// 시간 단위는 tick 이고 1박(4분음표) = 960 tick (PPQ) — audio/timing.js 와 같음.

import { PPQ, ticksToSecondsWithChanges, secondsToTicks } from './timing.js';

/** 앞으로 이만큼(초) 미리 예약함 — 소리가 늦지 않게 하는 lookahead 창 */
export const DEFAULT_LOOKAHEAD_SECONDS = 0.1;
/** 타이머가 도는 간격(ms). lookahead 보다 충분히 짧아야 함 */
export const DEFAULT_INTERVAL_MS = 25;
/** 시작할 때 첫 소리를 조금 뒤로 미룸(초) — 타이머 첫 회보다 앞서지 않게 */
export const DEFAULT_START_DELAY_SECONDS = 0.05;

/** 한 번에 예약할 단계가 너무 많아지면(잘못된 호출) 멈추기 위한 안전 한계 */
export const MAX_EVENTS_PER_PLAN = 100000;

/**
 * 스케줄러가 한 번 돌 때 예약할 "소리 목록"을 계산함 (순수 함수, 소리·시계 없음)
 * - 커서(tick, time)는 "아직 예약하지 않은 다음 소리"를 가리킴
 * - time 이 untilTime 보다 작은 동안 커서를 stepTicks 씩 앞으로 옮기며 목록에 담음
 * - 곡 중간 템포 변경(FR-202a)을 반영해 단계마다 걸리는 초를 더함 (한 단계가 변경점을 걸쳐도 맞음)
 * - 돌려주는 nextTick·nextTime 은 다음 번 호출이 이어서 쓸 커서임
 * - time 은 "어디서부터" 가 아니라 절대 오디오 시각이어도 됨 — 구간마다 더하는 값(차이)만 쓰기 때문
 * @param {number} fromTick  커서의 tick
 * @param {number} fromTime  커서의 tick 이 울릴 오디오 시각(초)
 * @param {number} untilTime 이 시각(초) 미만까지만 예약함 (보통 지금 + lookahead)
 * @param {number} stepTicks 한 단계에 나아갈 tick (예: 1/16 = 240, 1/4 = 960)
 * @param {number} baseBpm   시작 BPM (tick 0, 20~300)
 * @param {Array<{tick:number, bpm:number, ramp:string}>} changes  tempo_changes
 * @param {{start:number, end:number}|null} [loop]  루프 구간 (FR-204). 있으면 end 에 닿는 단계가 start 로 되돌아감
 * @returns {{events: Array<{tick:number, time:number}>, nextTick:number, nextTime:number}}
 */
export function planSchedule(fromTick, fromTime, untilTime, stepTicks, baseBpm, changes, loop) {
  if (typeof fromTick !== 'number' || !isFinite(fromTick)) throw new RangeError('fromTick 은 유한한 숫자여야 합니다: ' + fromTick);
  if (typeof fromTime !== 'number' || !isFinite(fromTime)) throw new RangeError('fromTime 은 유한한 숫자여야 합니다: ' + fromTime);
  if (typeof untilTime !== 'number' || !isFinite(untilTime)) throw new RangeError('untilTime 은 유한한 숫자여야 합니다: ' + untilTime);
  if (typeof stepTicks !== 'number' || !isFinite(stepTicks) || stepTicks <= 0) throw new RangeError('stepTicks 는 0 보다 큰 숫자여야 합니다: ' + stepTicks);
  if (typeof baseBpm !== 'number' || !isFinite(baseBpm) || baseBpm <= 0) throw new RangeError('baseBpm 은 0 보다 큰 숫자여야 합니다: ' + baseBpm);
  if (loop != null && (!(loop.end > loop.start))) throw new RangeError('loop 은 start < end 여야 합니다: ' + loop.start + ' ~ ' + loop.end);

  const loopLen = loop != null ? loop.end - loop.start : 0;
  function wrap(t) {
    if (loop == null) return t;
    return t >= loop.end ? loop.start + ((t - loop.start) % loopLen) : t;
  }

  const events = [];
  let tick = fromTick;
  let time = fromTime;
  while (time < untilTime) {
    if (events.length >= MAX_EVENTS_PER_PLAN) throw new RangeError('한 번에 예약할 단계가 너무 많습니다 (' + MAX_EVENTS_PER_PLAN + '개 초과) — untilTime 이 너무 멀거나 stepTicks 가 너무 작습니다');
    events.push({ tick: tick, time: time });
    const rawTick = tick + stepTicks;
    const delta = ticksToSecondsWithChanges(rawTick, baseBpm, changes) - ticksToSecondsWithChanges(tick, baseBpm, changes);
    tick = wrap(rawTick);
    time += delta;
  }
  return { events: events, nextTick: tick, nextTime: time };
}

/**
 * 트랜스포트 — 재생/정지와 스케줄러 루프 (FR-201)
 * - clock: `now()` 가 초를 돌려주는 것. 브라우저에서는 `AudioContext` 를 그대로 넘김(그 `currentTime`)
 * - onStep(tick, time): 예약할 소리마다 부름. 여기서 오실레이터·샘플 등을 time 에 맞춰 시작함
 * - setTimer·clearTimer: 기본은 전역 setInterval·clearInterval. 시험할 때 가짜로 바꿔 끼움
 * - start() 는 커서를 now + startDelay 로 잡고 곧바로 한 번 예약한 뒤 타이머를 겁니다.
 *   그래서 첫 소리도 lookahead 안에 미리 걸립니다.
 * - pause() 는 지금 위치를 기억하고 멈추며, resume() 은 그 위치를 다음 단계 경계로 올려 잇습니다.
 *   seek(tick) 은 위치를 옮기고, 재생 중이면 그 위치에서 다시 예약합니다.
 * - 재생 중 템포 변경은 setTempo() 로 합니다. 지금 위치를 다음 단계 경계로 올려 새 템포로 다시 예약합니다.
 * - 루프는 setLoop(start, end, enabled) 로 켭니다. 위치가 end 를 지나면 start 로 되돌아갑니다(FR-204).
 */
export class Transport {
  constructor(options) {
    options = options || {};
    if (options.clock == null || typeof options.clock.now !== 'function') {
      throw new TypeError('Transport 에는 now() 를 가진 clock 이 필요합니다 (브라우저에서는 AudioContext)');
    }
    this.clock = options.clock;
    this.onStep = typeof options.onStep === 'function' ? options.onStep : function () {};
    this.baseBpm = options.baseBpm != null ? options.baseBpm : 120;
    this.changes = options.changes != null ? options.changes : [];
    this.stepTicks = options.stepTicks != null ? options.stepTicks : PPQ / 4; // 기본 1/16
    this.lookahead = options.lookahead != null ? options.lookahead : DEFAULT_LOOKAHEAD_SECONDS;
    this.intervalMs = options.intervalMs != null ? options.intervalMs : DEFAULT_INTERVAL_MS;
    this.startDelay = options.startDelay != null ? options.startDelay : DEFAULT_START_DELAY_SECONDS;
    this.setTimer = options.setTimer != null ? options.setTimer : setInterval;
    this.clearTimer = options.clearTimer != null ? options.clearTimer : clearInterval;

    this.playing = false;
    this.timerId = null;
    this.cursorTick = 0;   // 아직 예약하지 않은 다음 소리의 tick
    this.cursorTime = 0;   // 그 소리의 오디오 시각(초)
    this.originTick = 0;   // 재생을 시작한 tick (위치 계산 기준)
    this.originTime = 0;   // originTick 이 울릴 오디오 시각(초)

    this.loopStart = options.loopStart != null ? options.loopStart : 0;
    this.loopEnd = options.loopEnd != null ? options.loopEnd : 0;
    this.loopEnabled = options.loopEnabled != null ? !!options.loopEnabled : false;
    if (this.loopEnabled && !(this.loopEnd > this.loopStart)) throw new RangeError('loopEnabled 이면 loopEnd > loopStart 여야 합니다: ' + this.loopStart + ' ~ ' + this.loopEnd);
  }

  /**
   * fromTick 부터 재생 시작
   * @param {number} [fromTick=0]
   * @returns {Transport} self (이어 쓰기 좋게)
   */
  start(fromTick) {
    this._clearTimer();
    this.playing = true;
    this._anchor(fromTick != null ? fromTick : 0, this.clock.now() + this.startDelay);
    this.pump();
    this._scheduleTimer();
    return this;
  }

  /**
   * 재생 정지 — 타이머를 끊음(이미 예약된 소리 창 안의 소리는 울린 뒤 멈춤)
   * @returns {Transport} self
   */
  stop() {
    this._clearTimer();
    this.playing = false;
    return this;
  }

  /**
   * 일시정지 — 지금 위치를 기억하고 타이머를 끊음. positionTick 은 이 위치에 멈춤
   * - 이미 예약된 창(최대 lookahead = 0.1초)의 소리는 울린 뒤 멈춤. 곧바로 끊으려면 화면에서 그 노드를 취소해야 함(소리를 잇는 함수에서 다룸)
   * @returns {Transport} self
   */
  pause() {
    if (!this.playing) return this;
    const tick = this.positionTick();
    this._clearTimer();
    this.playing = false;
    this._anchor(tick, this.clock.now());
    return this;
  }

  /**
   * 이어서 재생 — 멈춘 위치를 다음 단계 경계로 올려 다시 예약함
   * - 경계로 올리는 이유: 멈추기 직전에 이미 예약된 단계와 겹치지 않게 하려고(최대 한 단계, 1/16박)
   * @returns {Transport} self
   */
  resume() {
    if (this.playing) return this;
    const from = this._alignUp(this.cursorTick);
    this.playing = true;
    this._anchor(from, this.clock.now() + this.startDelay);
    this.pump();
    this._scheduleTimer();
    return this;
  }

  /**
   * 위치 이동 — 재생 중이면 그 위치에서 다시 예약, 멈춰 있으면 그 위치로만 옮김
   * @param {number} tick
   * @returns {Transport} self
   */
  seek(tick) {
    const wasPlaying = this.playing;
    this._clearTimer();
    this._anchor(tick, wasPlaying ? this.clock.now() + this.startDelay : this.clock.now());
    if (wasPlaying) {
      this.pump();
      this._scheduleTimer();
    }
    return this;
  }

  /**
   * 재생 중 템포 변경 — 시작 BPM·템포 변경점을 바꿈 (FR-202, FR-202a)
   * - 재생 중이면 지금 위치를 기억하고 다음 단계 경계로 올려 그곳부터 새 템포로 다시 예약함
   * - 경계로 올리므로 재생선이 최대 한 단계(1/16박) 앞으로 살짝 뛸 수 있음
   * - 이미 예약된 창(최대 lookahead)은 옛 템포로 울리고, 그 뒤부터 새 템포가 적용됨
   * @param {number} baseBpm  시작 BPM (tick 0, 20~300)
   * @param {Array<{tick:number, bpm:number, ramp:string}>} [changes]
   * @returns {Transport} self
   */
  setTempo(baseBpm, changes) {
    if (typeof baseBpm !== 'number' || !isFinite(baseBpm) || baseBpm <= 0) throw new RangeError('baseBpm 은 0 보다 큰 숫자여야 합니다: ' + baseBpm);
    const tick = this.positionTick();
    this.baseBpm = baseBpm;
    this.changes = changes != null ? changes : [];
    if (this.playing) {
      const from = this._alignUp(tick);
      this._clearTimer();
      this._anchor(from, this.clock.now() + this.startDelay);
      this.pump();
      this._scheduleTimer();
    }
    return this;
  }

  /**
   * 루프 구간·on/off 설정 (FR-204)
   * - 재생 중이면 지금 위치를 다음 단계 경계로 올려 그곳부터 새 루프로 다시 예약함(setTempo 와 같은 방식)
   * - 재생 위치가 구간을 지나 end 에 닿으면 start 로 되돌아감. 시간(초)은 계속 흐르고 tick만 되돌아감
   * @param {number} [startTick]  루프 시작 tick
   * @param {number} [endTick]    루프 끝 tick (start 보다 커야 함)
   * @param {boolean} [enabled]   루프 켜기/끄기
   * @returns {Transport} self
   */
  setLoop(startTick, endTick, enabled) {
    if (startTick != null) this.loopStart = startTick;
    if (endTick != null) this.loopEnd = endTick;
    if (enabled != null) this.loopEnabled = !!enabled;
    if (this.loopEnabled && !(this.loopEnd > this.loopStart)) throw new RangeError('loopEnd > loopStart 여야 합니다: ' + this.loopStart + ' ~ ' + this.loopEnd);
    if (this.playing) {
      const from = this._alignUp(this.positionTick());
      this._clearTimer();
      this._anchor(from, this.clock.now() + this.startDelay);
      this.pump();
      this._scheduleTimer();
    }
    return this;
  }

  /** 지금 적용할 루프 구간을 돌려줌(켜져 있고 길이가 있으면 {start,end}, 아니면 null)(내부용) */
  _loopRegion() {
    if (this.loopEnabled && this.loopEnd > this.loopStart) return { start: this.loopStart, end: this.loopEnd };
    return null;
  }

  /**
   * 한 번 예약함 — now + lookahead 까지의 소리를 onStep 으로 넘기고 커서를 옮김
   * (타이머가 부르는 함수. 시험에서는 직접 불러도 됨)
   * @returns {{events: Array<{tick:number, time:number}>, nextTick:number, nextTime:number}}
   */
  pump() {
    const untilTime = this.clock.now() + this.lookahead;
    const plan = planSchedule(this.cursorTick, this.cursorTime, untilTime, this.stepTicks, this.baseBpm, this.changes, this._loopRegion());
    for (let i = 0; i < plan.events.length; i++) {
      this.onStep(plan.events[i].tick, plan.events[i].time);
    }
    this.cursorTick = plan.nextTick;
    this.cursorTime = plan.nextTime;
    return plan;
  }

  /**
   * 지금 재생 위치(tick) — 화면의 재생선을 그릴 때 씀(소수점 있음)
   * - 멈춰 있으면(재생·일시정지 아님) 마지막 위치에 고정해 돌려줌
   * - 루프가 켜져 있고 위치가 끝을 지나면 시작으로 되돌린 값을 돌려줌
   * @returns {number} tick
   */
  positionTick() {
    if (!this.playing) return this.originTick;
    const originSeconds = ticksToSecondsWithChanges(this.originTick, this.baseBpm, this.changes);
    const nowSeconds = originSeconds + (this.clock.now() - this.originTime);
    const tick = secondsToTicks(nowSeconds, this.baseBpm, this.changes);
    const loop = this._loopRegion();
    if (loop !== null && tick >= loop.end) return loop.start + ((tick - loop.start) % (loop.end - loop.start));
    return tick;
  }

  /** 타이머가 걸려 있으면 끊음(내부용) */
  _clearTimer() {
    if (this.timerId != null) {
      this.clearTimer(this.timerId);
      this.timerId = null;
    }
  }

  /** 재생 기준점과 커서를 한 위치(tick, time)로 맞춤(내부용) */
  _anchor(tick, time) {
    this.originTick = tick;
    this.originTime = time;
    this.cursorTick = tick;
    this.cursorTime = time;
  }

  /** tick 을 다음 단계 경계로 올림 (예: 250 → 480, stepTicks 240)(내부용) */
  _alignUp(tick) {
    return Math.ceil(tick / this.stepTicks) * this.stepTicks;
  }

  /** pump 를 주기적으로 부르는 타이머를 검(내부용) */
  _scheduleTimer() {
    const self = this;
    this.timerId = this.setTimer(function () { self.pump(); }, this.intervalMs);
  }
}
