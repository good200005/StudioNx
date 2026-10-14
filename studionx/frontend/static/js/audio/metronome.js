// 메트로놈 (S1-05, PRD 02 FR-203)
// metronomeClick·countInTicks 는 소리를 쓰지 않는 순수 함수이고, Metronome 클래스는 on/off 와
// 클릭 소리 콜백을 다룸. 소리(AudioContext) 자체는 페이지가 콜백으로 넣어 줌 — 시험하기 쉽게.
// 박 단위는 박자 분모(den)로 정함: 4/4 는 4분음표(960 tick), 6/8 은 8분음표(480 tick).

import { PPQ } from './timing.js';

/** 박자 분모로 쓸 수 있는 값 (DB.md meter_changes.time_sig_den 과 같음) */
export const TIME_SIG_DEN_VALUES = [1, 2, 4, 8, 16, 32];

/**
 * 박자 분자·분모가 올바른지 확인함 (내부용)
 * @param {number} timeSigNum
 * @param {number} timeSigDen
 */
function assertTimeSig(timeSigNum, timeSigDen) {
  if (!Number.isInteger(timeSigNum) || timeSigNum < 1 || timeSigNum > 32) throw new RangeError('timeSigNum 은 1~32 정수여야 합니다: ' + timeSigNum);
  if (TIME_SIG_DEN_VALUES.indexOf(timeSigDen) === -1) throw new RangeError('timeSigDen 은 1,2,4,8,16,32 중 하나여야 합니다: ' + timeSigDen);
}

/**
 * 어떤 tick 이 메트로놈 박에 놓이는지 판정함 (순수 함수)
 * - 박 길이 = PPQ × 4 ÷ 분모, 마디 길이 = 박 길이 × 분자
 * - 마디의 첫 박이면 강박(accent)입니다
 * - tick 이 박 위에 있지 않으면 null 을 돌려줌
 * - tick 이 음수여도(카운트인 1마디) 마디 격자가 이어지도록 계산함: -마디길이 도 강박
 * @param {number} tick
 * @param {number} timeSigNum  박자 분자 (1~32)
 * @param {number} timeSigDen  박자 분모 (1,2,4,8,16,32)
 * @returns {{beatIndex:number, accent:boolean}|null}  박 위이면 {0부터 센 박 번호, 첫 박 여부}, 아니면 null
 */
export function metronomeClick(tick, timeSigNum, timeSigDen) {
  if (typeof tick !== 'number' || !isFinite(tick)) throw new RangeError('tick 은 유한한 숫자여야 합니다: ' + tick);
  assertTimeSig(timeSigNum, timeSigDen);

  const beatTicks = (PPQ * 4) / timeSigDen;
  const measureTicks = beatTicks * timeSigNum;

  let offset = tick % measureTicks;
  if (offset < 0) offset += measureTicks;
  if (Math.abs(offset % beatTicks) > 1e-9) return null;

  const beatIndex = Math.round(offset / beatTicks);
  return { beatIndex: beatIndex, accent: beatIndex === 0 };
}

/**
 * 카운트인 길이(tick) — 재생 전 한 마디 (FR-203)
 * - 트랜스포트를 -countInTicks 에서 시작하면, 0 에 닿기까지 한 마디 동안 카운트인이 들립니다
 * @param {number} timeSigNum
 * @param {number} timeSigDen
 * @returns {number} 한 마디 길이(tick)
 */
export function countInTicks(timeSigNum, timeSigDen) {
  assertTimeSig(timeSigNum, timeSigDen);
  return ((PPQ * 4) / timeSigDen) * timeSigNum;
}

/**
 * 메트로놈 — 켜짐/꺼짐, 박자, 클릭 소리 콜백을 다룸
 * - 페이지는 트랜스포트의 onStep 에서 metronome.step(tick, time) 을 불러 줌
 * - 소리는 page 가 넘긴 click(time, accent) 콜백에서 냅니다(AudioContext)
 */
export class Metronome {
  /**
   * @param {{enabled?:boolean, timeSigNum?:number, timeSigDen?:number, click:function(number, boolean):void}} options
   */
  constructor(options) {
    options = options || {};
    if (typeof options.click !== 'function') throw new TypeError('click 콜백(함수)이 필요합니다');
    this.click = options.click;
    this.enabled = options.enabled != null ? !!options.enabled : false;
    this.timeSigNum = options.timeSigNum != null ? options.timeSigNum : 4;
    this.timeSigDen = options.timeSigDen != null ? options.timeSigDen : 4;
    assertTimeSig(this.timeSigNum, this.timeSigDen);
  }

  /**
   * 켜고 끔 (FR-203 on/off)
   * @param {boolean} on
   * @returns {Metronome} self
   */
  setEnabled(on) {
    this.enabled = !!on;
    return this;
  }

  /**
   * 박자를 바꿈 (FR-202a 박자)
   * @param {number} timeSigNum
   * @param {number} timeSigDen
   * @returns {Metronome} self
   */
  setTimeSignature(timeSigNum, timeSigDen) {
    assertTimeSig(timeSigNum, timeSigDen);
    this.timeSigNum = timeSigNum;
    this.timeSigDen = timeSigDen;
    return this;
  }

  /**
   * 한 단계 판정 — 켜져 있고 박 위이면 click(time, accent) 를 부름
   * @param {number} tick
   * @param {number} time  소리 시각(초)
   * @returns {{beatIndex:number, accent:boolean}|null}  울렸으면 그 정보, 아니면 null
   */
  step(tick, time) {
    if (!this.enabled) return null;
    const info = metronomeClick(tick, this.timeSigNum, this.timeSigDen);
    if (info === null) return null;
    this.click(time, info.accent);
    return info;
  }
}
