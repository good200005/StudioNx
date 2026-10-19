// Subtractive Synth 음원 (S1-11a, PRD 02 FR-242)
// 노트 하나를 "오실레이터 2개 → 필터 → 앰프 엔벨로프(+LFO)" 그래프로 만들어 울립니다.
// 파라미터는 plugins.param_schema 의 key 를 그대로 씁니다 (osc1_wave, cutoff, env_attack, lfo_target ...).
// 계산(주파수, 파라미터 병합, 엔벨로프 값)은 소리를 쓰지 않는 순수 함수로 두어 Node 에서도 시험합니다.
// 같은 코드를 AudioContext(실시간)와 OfflineAudioContext(WAV 출력, S1-11b)가 함께 씁니다.

import { dbToGain } from './mixer.js';

/** MIDI 노트 번호 → 주파수(Hz). 69(A4) = 440Hz */
export function noteToFreq(pitch) {
  return 440 * Math.pow(2, (Number(pitch) - 69) / 12);
}

/**
 * 파라미터 병합 — param_schema 의 default 를 바탕으로, 저장된 params 값을 덮어씀 (순수 함수)
 * - 스키마에 없는 키는 버립니다
 * - 숫자 칸은 min · max 안으로 잘라 줍니다 (잘못 저장된 값이 소리를 망가뜨리지 않게)
 * @param {Array<object>} schema  plugins.param_schema
 * @param {object|null} params    track_instruments.params
 * @returns {object}
 */
export function resolveParams(schema, params) {
  const out = {};
  (schema || []).forEach(function (item) {
    let value = item.default;
    if (params && params[item.key] !== undefined && params[item.key] !== null) value = params[item.key];
    if (typeof item.min === 'number' && typeof item.max === 'number' && typeof value === 'number') {
      value = Math.max(item.min, Math.min(item.max, value));
    }
    out[item.key] = value;
  });
  return out;
}

/** 파형 이름 → Web Audio 파형 (saw → sawtooth) */
export function oscType(wave) {
  if (wave === 'saw') return 'sawtooth';
  if (wave === 'sine' || wave === 'triangle' || wave === 'square') return wave;
  return 'sawtooth';
}

/**
 * 앰프 엔벨로프의 값 (Attack → Decay → Sustain 구간, 순수 함수)
 * - t 는 노트 시작부터 흐른 초. 릴리스 직전의 값을 구할 때도 씁니다
 * @param {number} t
 * @param {number} a  attack(초)
 * @param {number} d  decay(초)
 * @param {number} s  sustain(0~1)
 * @param {number} peak  최고 값
 * @returns {number}
 */
export function envelopeLevel(t, a, d, s, peak) {
  if (t <= 0) return 0;
  if (a > 0 && t < a) return peak * (t / a);
  const td = t - a;
  if (d > 0 && td < d) return peak * (1 - (1 - s) * (td / d));
  return peak * s;
}

/**
 * 노트 하나를 울림
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest      소리가 나갈 노드 (악기 층의 입력)
 * @param {object} p            resolveParams 결과
 * @param {number} pitch        MIDI 노트 번호
 * @param {number} velocity     1~127
 * @param {number} when         시작할 오디오 시각(초)
 * @param {number} duration     노트 길이(초). 이 시간이 지나면 릴리스가 시작됨
 * @returns {{stop:function(number):void}} 소리를 앞당겨 끊을 때 씀
 */
export function playSynthNote(ctx, dest, p, pitch, velocity, when, duration) {
  const freq = noteToFreq(pitch);
  const peak = 0.3 * Math.max(0, Math.min(127, velocity)) / 127;
  const a = Number(p.env_attack) || 0;
  const d = Number(p.env_decay) || 0;
  const s = p.env_sustain != null ? Number(p.env_sustain) : 1;
  const r = Math.max(0.005, Number(p.env_release) || 0);
  const dur = Math.max(0.01, duration);

  // 앰프 엔벨로프
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when);
  if (a > 0) amp.gain.linearRampToValueAtTime(peak, when + a);
  else amp.gain.setValueAtTime(peak, when);
  if (d > 0 && dur > a) amp.gain.linearRampToValueAtTime(peak * s, when + Math.min(dur, a + d));
  const atRelease = envelopeLevel(dur, a, d, s, peak);
  amp.gain.setValueAtTime(atRelease, when + dur);
  amp.gain.linearRampToValueAtTime(0, when + dur + r);
  const end = when + dur + r + 0.02;

  // 필터
  const filter = ctx.createBiquadFilter();
  filter.type = p.filter_type === 'highpass' || p.filter_type === 'bandpass' ? p.filter_type : 'lowpass';
  filter.frequency.value = Math.max(20, Math.min(20000, Number(p.cutoff) || 1200));
  filter.Q.value = 0.5 + Math.max(0, Math.min(1, Number(p.resonance) || 0)) * 15;

  // 트레몰로(LFO → 앰프)는 앰프 뒤에 따로 두어 엔벨로프와 곱해지게 함
  const trem = ctx.createGain();
  filter.connect(amp);
  amp.connect(trem);
  trem.connect(dest);

  // 오실레이터 2개 (레벨은 합이 1이 되게 나눠 소리가 겹쳐도 커지지 않게 함)
  const l1 = Math.max(0, Number(p.osc1_level) || 0);
  const l2 = Math.max(0, Number(p.osc2_level) || 0);
  const sum = l1 + l2 > 0 ? l1 + l2 : 1;
  const oscs = [];
  [[l1, p.osc1_wave, Number(p.osc1_detune) || 0, 0], [l2, p.osc2_wave, Number(p.osc2_detune) || 0, Number(p.osc2_semi) || 0]]
    .forEach(function (cfg) {
      if (!(cfg[0] > 0)) return;
      const osc = ctx.createOscillator();
      osc.type = oscType(cfg[1]);
      osc.frequency.value = freq * Math.pow(2, cfg[3] / 12);
      osc.detune.value = cfg[2];
      const g = ctx.createGain();
      g.gain.value = cfg[0] / sum;
      osc.connect(g);
      g.connect(filter);
      osc.start(when);
      osc.stop(end);
      oscs.push(osc);
    });

  // LFO (깊이 0 이거나 대상이 off 면 만들지 않음)
  const depth = Math.max(0, Math.min(1, Number(p.lfo_depth) || 0));
  const target = p.lfo_target;
  const extra = [];
  if (depth > 0 && (target === 'pitch' || target === 'filter' || target === 'amp')) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = Math.max(0.01, Number(p.lfo_rate) || 1);
    const lg = ctx.createGain();
    lfo.connect(lg);
    if (target === 'pitch') {
      lg.gain.value = depth * 100;                       // 최대 ±100 cent
      oscs.forEach(function (o) { lg.connect(o.detune); });
    } else if (target === 'filter') {
      lg.gain.value = depth * filter.frequency.value;   // 컷오프의 ±(깊이 × 컷오프)
      lg.connect(filter.frequency);
    } else {
      trem.gain.value = 1 - depth / 2;                  // 1 - 깊이/2 를 중심으로 ±깊이/2 만큼 흔듦
      lg.gain.value = depth / 2;
      lg.connect(trem.gain);
    }
    lfo.start(when);
    lfo.stop(end);
    extra.push(lfo);
  }

  return {
    // 정지 · 루프 되감기 때 소리를 끊음 (뚝 끊기는 소리를 줄이려고 아주 짧은 릴리스를 줌)
    stop: function (at) {
      const t = Math.max(at, ctx.currentTime);
      try { amp.gain.cancelScheduledValues(t); amp.gain.setTargetAtTime(0, t, 0.01); } catch (e) { /* 무시 */ }
      oscs.concat(extra).forEach(function (o) { try { o.stop(t + 0.08); } catch (e) { /* 이미 끝남 */ } });
    },
  };
}

/** 악기 층의 볼륨(dB) → 선형 게인 (믹서와 같은 변환) */
export function layerGain(volumeDb) {
  return dbToGain(volumeDb || 0);
}
