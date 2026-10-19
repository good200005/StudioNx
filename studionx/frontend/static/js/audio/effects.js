// 이펙트 (S1-11a, PRD 02 FR-243 · FR-247)
// 시드의 이펙트 6종(Gain, EQ 3-Band, Compressor, Delay, Reverb, Limiter)을 Web Audio 기본 노드 조합으로 만듭니다.
// 모든 이펙트는 같은 모양입니다: { input, output, update(params), dispose() }.
//   - input 에 소리를 넣고 output 에서 꺼내 쓰며, update 는 노브가 바뀔 때 새 값을 소리에 반영합니다.
//   - 파라미터 key 는 plugins.param_schema 와 같습니다 (resolveParams 로 기본값을 채운 값을 넘김).
// 계산(딜레이 시간, 잔향 임펄스)은 소리를 쓰지 않는 순수 함수로 두어 Node 에서도 시험합니다.
// 같은 코드를 AudioContext(실시간)와 OfflineAudioContext(WAV 출력, S1-11b)가 함께 씁니다.

import { dbToGain, createStereoGain } from './mixer.js';

/** 템포 동기 딜레이의 박 길이 (1 = 4분음표 한 박) */
const DIVISION_BEATS = { '1/4': 1, '1/8': 0.5, '1/8d': 0.75, '1/16': 0.25 };

/** 딜레이 최대 시간(초) — DelayNode 의 maxDelayTime */
export const MAX_DELAY_SECONDS = 4;

/**
 * 딜레이 시간(초) (순수 함수)
 * - sync 가 켜지면 템포(bpm)와 박 길이로 계산하고, 아니면 time 값을 그대로 씁니다
 * - 결과는 0.001 ~ MAX_DELAY_SECONDS 로 자릅니다
 * @param {{sync?:boolean, division?:string, time?:number}} p
 * @param {number} bpm
 * @returns {number}
 */
export function delaySeconds(p, bpm) {
  let sec;
  if (p.sync) {
    const beats = DIVISION_BEATS[p.division] != null ? DIVISION_BEATS[p.division] : 0.5;
    sec = beats * 60 / (bpm > 0 ? bpm : 120);
  } else {
    sec = Number(p.time) || 0.35;
  }
  return Math.max(0.001, Math.min(MAX_DELAY_SECONDS, sec));
}

/**
 * 잔향 임펄스 응답을 만듦 (순수 함수, 같은 입력이면 늘 같은 결과)
 * - 감쇠하는 잡음입니다. 길이는 decay 초이고, 소리가 -60dB 로 줄어드는 시간이 decay 입니다
 * - damping(0~1)이 클수록 높은 소리가 더 빨리 사라집니다 (간단한 1차 저역 통과를 거칩니다)
 * - 난수는 고정 시드의 선형 합동 생성기라서, 실시간과 WAV 출력이 같은 잔향을 냅니다 (재현성)
 * @param {number} sampleRate
 * @param {number} decay    초
 * @param {number} damping  0~1
 * @param {number} channel  0 또는 1 (좌우가 다른 잡음이 되게 시드를 바꿈)
 * @returns {Float32Array}
 */
export function makeImpulse(sampleRate, decay, damping, channel) {
  const length = Math.max(1, Math.floor(sampleRate * Math.max(0.1, decay)));
  const out = new Float32Array(length);
  let seed = 12345 + (channel || 0) * 7919;
  const coef = 1 - Math.max(0, Math.min(1, damping)) * 0.9;   // 1 = 그대로, 0.1 = 크게 둔하게
  let lp = 0;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    const envelope = Math.pow(0.001, i / length);   // 끝에서 -60dB
    lp = lp + coef * (noise - lp);
    out[i] = lp * envelope;
  }
  return out;
}

/** 브라우저의 한 번 처리 단위(render quantum) = 128 샘플. 되먹임 고리를 한 바퀴 돌 때마다 이만큼 더 걸립니다 */
const QUANTUM = 128;

/**
 * DynamicsCompressorNode 가 스스로 더하는 메이크업 게인(dB)을 구함 (순수 함수)
 * - 브라우저는 압축한 만큼 소리가 작아지지 않게 자동으로 키웁니다: (0dB 입력에서의 게인)^-0.6
 * - 0dB 입력일 때 곡선의 출력은 threshold + (0 - threshold) / ratio 이므로 게인(dB)은 threshold × (1 - 1/ratio) 입니다
 * - 이 값만큼 다시 줄여 주면 사용자가 정한 메이크업만 남습니다 (리미터가 천장을 지키는 데도 필요함)
 * - 니(knee)가 임계값 근처까지 넓으면 약간 어긋나는 근사입니다
 * @param {number} threshold dB
 * @param {number} ratio
 * @returns {number} 브라우저가 더하는 dB (양수)
 */
export function compressorAutoMakeupDb(threshold, ratio) {
  const r = Math.max(1, ratio);
  const gainDb = Math.min(0, threshold) * (1 - 1 / r);   // 0dB 입력일 때의 감쇠(dB, 음수)
  return -0.6 * gainDb;
}

/** 노드 하나를 안전하게 끊음 */
function drop(node) {
  try { node.disconnect(); } catch (e) { /* 이미 끊김 */ }
}

/* ───────── 이펙트 6종 ───────── */

/** Gain / Utility: 게인(dB), 팬, 위상 반전 */
function createGainFx(ctx) {
  const gain = createStereoGain(ctx);
  const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
  if (pan) gain.connect(pan);
  return {
    input: gain,
    output: pan || gain,
    update: function (p) {
      const g = dbToGain(p.gain);
      gain.gain.value = p.phase_invert ? -g : g;
      if (pan) pan.pan.value = Math.max(-1, Math.min(1, Number(p.pan) || 0));
    },
    dispose: function () { drop(gain); if (pan) drop(pan); },
  };
}

/** EQ 3-Band: 저음 선반, 중음 피킹, 고음 선반 */
function createEq3Fx(ctx) {
  const low = ctx.createBiquadFilter(); low.type = 'lowshelf';
  const mid = ctx.createBiquadFilter(); mid.type = 'peaking';
  const high = ctx.createBiquadFilter(); high.type = 'highshelf';
  low.connect(mid); mid.connect(high);
  return {
    input: low,
    output: high,
    update: function (p) {
      low.frequency.value = Number(p.low_freq) || 200;
      low.gain.value = Number(p.low_gain) || 0;
      mid.frequency.value = Number(p.mid_freq) || 1000;
      mid.gain.value = Number(p.mid_gain) || 0;
      mid.Q.value = Number(p.mid_q) || 0.7;
      high.frequency.value = Number(p.high_freq) || 6000;
      high.gain.value = Number(p.high_gain) || 0;
    },
    dispose: function () { drop(low); drop(mid); drop(high); },
  };
}

/** Compressor: DynamicsCompressorNode + 메이크업 게인 */
function createCompressorFx(ctx) {
  const comp = ctx.createDynamicsCompressor();
  const makeup = ctx.createGain();
  comp.connect(makeup);
  return {
    input: comp,
    output: makeup,
    update: function (p) {
      const threshold = p.threshold != null ? Number(p.threshold) : -20;
      const ratio = Math.max(1, Math.min(20, Number(p.ratio) || 4));
      comp.threshold.value = threshold;
      comp.ratio.value = ratio;
      comp.attack.value = Math.max(0, Math.min(1, Number(p.attack) || 0.01));
      comp.release.value = Math.max(0, Math.min(1, Number(p.release) || 0.2));
      comp.knee.value = Math.max(0, Math.min(40, p.knee != null ? Number(p.knee) : 10));
      // 브라우저가 자동으로 더하는 메이크업을 덜어 내고, 사용자가 정한 메이크업만 더함
      makeup.gain.value = dbToGain((Number(p.makeup) || 0) - compressorAutoMakeupDb(threshold, ratio));
    },
    dispose: function () { drop(comp); drop(makeup); },
  };
}

/** Limiter: 레이시오 20 · 니 0 으로 둔 DynamicsCompressorNode (근사치 — 정확한 리미터는 이후 WASM) */
function createLimiterFx(ctx) {
  const comp = ctx.createDynamicsCompressor();
  const trim = ctx.createGain();
  comp.ratio.value = 20;
  comp.knee.value = 0;
  comp.attack.value = 0.001;
  comp.connect(trim);
  return {
    input: comp,
    output: trim,
    update: function (p) {
      const ceiling = Math.max(-100, Math.min(0, p.ceiling != null ? Number(p.ceiling) : -0.3));
      comp.threshold.value = ceiling;
      comp.release.value = Math.max(0.01, Math.min(1, Number(p.release) || 0.1));
      trim.gain.value = dbToGain(-compressorAutoMakeupDb(ceiling, 20));   // 브라우저의 자동 메이크업을 덜어 내야 천장을 넘지 않음
    },
    dispose: function () { drop(comp); drop(trim); },
  };
}

/**
 * Delay: 딜레이 + 되먹임(피드백) + 톤 필터, 원음과 섞음
 * - 소리 → [원음] 그대로 출력, 소리 → 딜레이 → 톤 필터 → (되먹임으로 딜레이에 다시) / 출력
 * - mix 는 딜레이 소리의 크기(원음은 그대로)
 */
function createDelayFx(ctx, getBpm) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const delay = ctx.createDelay(MAX_DELAY_SECONDS);
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass';
  const feedback = ctx.createGain();
  const tap = ctx.createDelay(0.1);      // 고리를 한 바퀴 돌 때 더 걸리는 128 샘플만큼 첫 반복을 늦춤 (아래 설명)
  const wet = ctx.createGain();
  input.connect(output);                 // 원음
  input.connect(delay);
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);               // 되먹임
  tone.connect(tap);
  tap.connect(wet);
  wet.connect(output);
  // 브라우저는 되먹임 고리를 한 바퀴 돌 때마다 128 샘플(한 번 처리 단위)을 더 걸리게 합니다.
  // 그래서 고리의 딜레이는 그만큼 줄이고, 첫 반복은 tap 으로 같은 양을 늦춰서 모든 반복이 정확히 time 간격이 되게 함
  return {
    input: input,
    output: output,
    update: function (p) {
      const q = QUANTUM / ctx.sampleRate;
      const time = Math.max(2 * q, delaySeconds(p, getBpm()));
      delay.delayTime.value = time - q;
      tap.delayTime.value = q;
      feedback.gain.value = Math.max(0, Math.min(0.95, Number(p.feedback) || 0));
      tone.frequency.value = Math.max(200, Math.min(20000, Number(p.tone) || 6000));
      wet.gain.value = Math.max(0, Math.min(1, p.mix != null ? Number(p.mix) : 0.3));
    },
    dispose: function () { [input, output, delay, tone, feedback, tap, wet].forEach(drop); },
  };
}

/**
 * Reverb: 프리딜레이 → 컨볼버(코드로 만든 임펄스) → 섞기
 * - mix 는 등출력(equal-power) 곡선으로 원음과 잔향을 섞습니다
 * - 임펄스는 decay · damping 이 바뀔 때만 다시 만듭니다 (노브를 돌릴 때마다 만들지 않게)
 */
function createReverbFx(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const pre = ctx.createDelay(0.5);
  const conv = ctx.createConvolver();
  input.connect(dry); dry.connect(output);
  input.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(output);
  let key = '';
  return {
    input: input,
    output: output,
    update: function (p) {
      const decay = Math.max(0.1, Math.min(10, Number(p.decay) || 2));
      const damping = Math.max(0, Math.min(1, p.damping != null ? Number(p.damping) : 0.5));
      const next = decay + ':' + damping;
      if (next !== key) {
        key = next;
        const sr = ctx.sampleRate;
        const buf = ctx.createBuffer(2, Math.max(1, Math.floor(sr * decay)), sr);
        buf.copyToChannel(makeImpulse(sr, decay, damping, 0), 0);
        buf.copyToChannel(makeImpulse(sr, decay, damping, 1), 1);
        conv.buffer = buf;
      }
      pre.delayTime.value = Math.max(0, Math.min(0.5, Number(p.pre_delay) || 0));
      const mix = Math.max(0, Math.min(1, p.mix != null ? Number(p.mix) : 0.3));
      dry.gain.value = Math.cos(mix * Math.PI / 2);
      wet.gain.value = Math.sin(mix * Math.PI / 2) * 0.5;   // 컨볼버는 소리를 크게 만들어서 절반으로
    },
    dispose: function () { [input, output, dry, wet, pre, conv].forEach(drop); },
  };
}

/** 플러그인 코드 → 만드는 함수 */
const FACTORIES = {
  gain: createGainFx,
  eq3: createEq3Fx,
  compressor: createCompressorFx,
  limiter: createLimiterFx,
  delay: createDelayFx,
  reverb: createReverbFx,
};

/** 소리가 나는 이펙트 코드 목록 */
export const EFFECT_CODES = Object.keys(FACTORIES);

/**
 * 이펙트 하나를 만들고 처음 값을 반영함
 * @param {BaseAudioContext} ctx
 * @param {string} code      플러그인 코드 (gain, eq3, compressor, limiter, delay, reverb)
 * @param {object} params    resolveParams 결과
 * @param {function():number} getBpm  Delay 의 템포 동기에 씀
 * @returns {{input:AudioNode, output:AudioNode, update:function(object):void, dispose:function():void}|null} 모르는 코드면 null
 */
export function createEffect(ctx, code, params, getBpm) {
  const make = FACTORIES[code];
  if (!make) return null;
  const fx = make(ctx, getBpm || function () { return 120; });
  fx.update(params || {});
  return fx;
}
