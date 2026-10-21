// Sampler 음원 (S1-11c, PRD 02 FR-241)
// MIDI 노트 하나를 "샘플 → 앰프 엔벨로프" 그래프로 만들어 울립니다.
// 파라미터는 plugins.param_schema 의 key 를 그대로 씁니다 (sample_id, mode, root_note, loop, gain, tune, attack ...).
// 모드가 둘입니다.
// - classic : 건반을 눌러 음정을 바꿔 치는 방식. 노트 길이만큼 울리고 Release 로 끝나며, Loop 를 켜면 샘플을 되풀이합니다.
// - oneshot : 드럼처럼 한 번 치면 샘플 전체가 울리는 방식. 노트 길이, Loop, Sustain, Release 를 무시합니다.
// 계산(재생 속도, 사용하는 샘플 번호)은 소리를 쓰지 않는 순수 함수로 두어 Node 에서도 시험합니다.
// 같은 코드를 AudioContext(실시간)와 OfflineAudioContext(WAV 출력)가 함께 씁니다.

import { envelopeLevel } from './synth.js';

/** 모드 이름 정리 — 알 수 없는 값은 classic 으로 */
export function samplerMode(value) {
  return value === 'oneshot' ? 'oneshot' : 'classic';
}

/**
 * 재생 속도 (순수 함수) — 눌린 건반이 Root 에서 몇 반음 떨어졌는지에 Tune 을 더해 2 의 거듭제곱으로 바꿈
 * 12 반음 위면 2배 빠르게(한 옥타브 위), 12 반음 아래면 절반 속도로 울립니다.
 * @param {number} pitch  눌린 MIDI 노트 번호
 * @param {number} root   샘플이 원래 내는 음(MIDI 노트 번호)
 * @param {number} tune   미세 조정(반음 단위, 소수 가능)
 * @returns {number}
 */
export function samplerRate(pitch, root, tune) {
  return Math.pow(2, (Number(pitch) - Number(root) + (Number(tune) || 0)) / 12);
}

/**
 * 트랙들의 Sampler 악기가 쓰는 샘플 번호 모음 (순수 함수) — 재생과 내보내기가 미리 디코딩할 목록
 * @param {function(number|string):Array<object>} getInstruments  트랙 번호 → 악기 층 목록
 * @param {Array<number|string>} trackIds
 * @returns {Array<number>} 중복 없는 샘플 번호
 */
export function samplerSampleIds(getInstruments, trackIds) {
  const out = [];
  (trackIds || []).forEach(function (trackId) {
    (getInstruments(trackId) || []).forEach(function (inst) {
      if (inst.plugin_code !== 'sampler' || inst.is_enabled === false) return;
      const params = inst.params || {};
      const id = params.sample_id;
      if (id == null || id === '') return;
      const n = Number(id);
      if (isFinite(n) && out.indexOf(n) < 0) out.push(n);
    });
  });
  return out;
}

/**
 * 노트 하나를 울림
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest      소리가 나갈 노드 (악기 층의 입력)
 * @param {object} p            resolveParams 결과
 * @param {AudioBuffer|null} buffer  디코딩된 샘플 (없으면 소리를 내지 않음)
 * @param {number} pitch        MIDI 노트 번호
 * @param {number} velocity     1~127
 * @param {number} when         시작할 오디오 시각(초)
 * @param {number} duration     노트 길이(초). classic 에서만 쓰임
 * @returns {{stop:function(number):void}} 소리를 앞당겨 끊을 때 씀
 */
export function playSamplerNote(ctx, dest, p, buffer, pitch, velocity, when, duration) {
  if (!buffer) return { stop: function () {} };
  const mode = samplerMode(p.mode);
  const rate = samplerRate(pitch, p.root_note != null ? p.root_note : 60, p.tune);
  const peak = Math.max(0, Number(p.gain) || 0) * Math.max(0, Math.min(127, velocity)) / 127;
  const a = Math.max(0, Number(p.attack) || 0);
  const d = Math.max(0, Number(p.decay) || 0);

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;

  const amp = ctx.createGain();
  src.connect(amp);
  amp.connect(dest);

  let end;
  amp.gain.setValueAtTime(0, when);
  if (mode === 'oneshot') {
    // 노트 길이를 무시하고 샘플 전체를 울림. Attack 은 앞을 부드럽게 열고, Decay 가 있으면 그 시간 동안 0 까지 줄임 (드럼의 꼬리 조절)
    if (a > 0) amp.gain.linearRampToValueAtTime(peak, when + a);
    else amp.gain.setValueAtTime(peak, when);
    if (d > 0) amp.gain.linearRampToValueAtTime(0, when + a + d);
    end = when + buffer.duration / rate + 0.02;
    src.start(when);
    src.stop(end);
  } else {
    const s = p.sustain != null ? Number(p.sustain) : 1;
    const r = Math.max(0.005, Number(p.release) || 0);
    const dur = Math.max(0.01, duration);
    if (a > 0) amp.gain.linearRampToValueAtTime(peak, when + a);
    else amp.gain.setValueAtTime(peak, when);
    if (d > 0 && dur > a) amp.gain.linearRampToValueAtTime(peak * s, when + Math.min(dur, a + d));
    amp.gain.setValueAtTime(envelopeLevel(dur, a, d, s, peak), when + dur);
    amp.gain.linearRampToValueAtTime(0, when + dur + r);
    end = when + dur + r + 0.02;
    if (p.loop === true) {
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = buffer.duration;
    }
    src.start(when);
    src.stop(end);
  }

  return {
    // 정지 · 루프 되감기 때 소리를 끊음 (뚝 끊기는 소리를 줄이려고 아주 짧은 릴리스를 줌)
    stop: function (at) {
      const t = Math.max(at, ctx.currentTime);
      try { amp.gain.cancelScheduledValues(t); amp.gain.setTargetAtTime(0, t, 0.01); } catch (e) { /* 무시 */ }
      try { src.stop(t + 0.08); } catch (e) { /* 이미 끝남 */ }
    },
  };
}
