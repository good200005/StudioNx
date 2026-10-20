// WAV 인코딩 (S1-11b, PRD 03 FR-303)
// 렌더링한 소리(채널별 Float32Array)를 WAV 파일 바이트로 바꿉니다. 소리 장치를 쓰지 않는 순수 함수라 Node 에서도 시험합니다.
// 16bit 와 24bit 는 정수 PCM, 32bit 는 부동소수점(IEEE float) 입니다. 16bit 는 TPDF 디더를 넣어 작은 소리의 끝이 거칠어지지 않게 합니다.

/** 지원하는 비트 깊이 */
export const BIT_DEPTHS = [16, 24, 32];

/**
 * 채널들의 피크(절댓값의 최댓값) (순수 함수)
 * @param {Array<Float32Array>} channels
 * @returns {number}
 */
export function peakOfChannels(channels) {
  let peak = 0;
  for (let c = 0; c < channels.length; c++) {
    const data = channels[c];
    for (let i = 0; i < data.length; i++) {
      const v = data[i] < 0 ? -data[i] : data[i];
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/**
 * 정규화에 곱할 배율 (순수 함수) — 가장 큰 피크가 목표 dBFS 가 되게 함
 * - 소리가 전혀 없으면(피크 0) 1 을 돌려줘서 아무것도 바꾸지 않습니다
 * @param {number} peak      지금 피크(0~1 이상)
 * @param {number} targetDb  목표 피크(dBFS, 보통 -0.3)
 * @returns {number}
 */
export function normalizeGain(peak, targetDb) {
  if (!(peak > 0)) return 1;
  return Math.pow(10, targetDb / 20) / peak;
}

/**
 * WAV 파일의 크기(바이트) (순수 함수) — 머리와 데이터를 합한 값
 * @param {number} frames
 * @param {number} numChannels
 * @param {number} bitDepth
 * @returns {number}
 */
export function wavByteLength(frames, numChannels, bitDepth) {
  const header = bitDepth === 32 ? 58 : 44;   // 32bit float 는 fmt 확장(2바이트)과 fact 조각(12바이트)이 더 있음
  return header + frames * numChannels * (bitDepth / 8);
}

function writeText(view, offset, text) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/**
 * WAV 파일 바이트를 만듦
 * @param {Array<Float32Array>} channels  채널별 샘플(−1~1). 길이가 모두 같아야 함
 * @param {number} sampleRate
 * @param {number} bitDepth  16, 24, 32 중 하나
 * @param {{gain?:number, dither?:boolean}} [options]
 *   gain: 모든 샘플에 곱할 배율(정규화용, 기본 1) / dither: 16bit 에서만 쓰임(기본 true)
 * @returns {Uint8Array}
 */
export function encodeWav(channels, sampleRate, bitDepth, options) {
  const opt = options || {};
  const gain = opt.gain != null ? opt.gain : 1;
  const dither = opt.dither == null ? true : !!opt.dither;
  if (BIT_DEPTHS.indexOf(bitDepth) < 0) throw new Error('지원하지 않는 비트 깊이: ' + bitDepth);
  const numCh = channels.length;
  const frames = numCh > 0 ? channels[0].length : 0;
  const bytes = bitDepth / 8;
  const isFloat = bitDepth === 32;
  const total = wavByteLength(frames, numCh, bitDepth);
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);

  // 머리
  let p = 0;
  writeText(view, p, 'RIFF'); view.setUint32(p + 4, total - 8, true); writeText(view, p + 8, 'WAVE'); p += 12;
  writeText(view, p, 'fmt '); view.setUint32(p + 4, isFloat ? 18 : 16, true);
  view.setUint16(p + 8, isFloat ? 3 : 1, true);                  // 1 = PCM, 3 = IEEE float
  view.setUint16(p + 10, numCh, true);
  view.setUint32(p + 12, sampleRate, true);
  view.setUint32(p + 16, sampleRate * numCh * bytes, true);      // 초당 바이트
  view.setUint16(p + 20, numCh * bytes, true);                   // 한 프레임의 바이트
  view.setUint16(p + 22, bitDepth, true);
  p += 24;
  if (isFloat) {
    view.setUint16(p, 0, true); p += 2;                          // 확장 크기 0
    writeText(view, p, 'fact'); view.setUint32(p + 4, 4, true); view.setUint32(p + 8, frames, true); p += 12;
  }
  writeText(view, p, 'data'); view.setUint32(p + 4, frames * numCh * bytes, true); p += 8;

  // 데이터 (채널을 프레임마다 번갈아 씀)
  let seed = 22222;                                              // 디더 난수는 고정 시드: 같은 입력이면 같은 파일
  const rand = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const v = channels[c][i] * gain;
      if (isFloat) {
        view.setFloat32(p, v, true); p += 4;
      } else if (bitDepth === 16) {
        let s = v * 32767;
        if (dither) s += rand() - rand();                        // TPDF: 최대 ±1 LSB
        s = Math.round(s);
        if (s > 32767) s = 32767; else if (s < -32768) s = -32768;
        view.setInt16(p, s, true); p += 2;
      } else {
        let s = Math.round(v * 8388607);
        if (s > 8388607) s = 8388607; else if (s < -8388608) s = -8388608;
        if (s < 0) s += 16777216;                                // 24bit 음수는 2의 보수
        view.setUint8(p, s & 255); view.setUint8(p + 1, (s >> 8) & 255); view.setUint8(p + 2, (s >> 16) & 255); p += 3;
      }
    }
  }
  return new Uint8Array(buffer);
}
