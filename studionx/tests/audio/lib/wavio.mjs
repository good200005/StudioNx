// 골든 WAV 읽고 쓰기 (S1-12)
// 쓰기는 앱이 내보낼 때 쓰는 encodeWav 를 그대로 씁니다 (32bit float 은 렌더링 결과를 손실 없이 담음).
// 읽기는 그 형식(32bit float, fmt 18바이트 + fact 조각)과 일반 PCM 16, 24bit 를 읽습니다.

import fs from 'node:fs';
import { encodeWav } from '../../../frontend/static/js/audio/wav.js';

/** 채널별 Float32Array 를 32bit float WAV 로 저장 */
export function writeFloatWav(file, channels, sampleRate) {
  const bytes = encodeWav(channels, sampleRate, 32, { gain: 1, dither: false });
  fs.writeFileSync(file, bytes);
  return bytes.length;
}

/**
 * WAV 파일 읽기
 * @returns {{channels:Float32Array[], sampleRate:number, bitDepth:number, frames:number}}
 */
export function readWav(file) {
  const buf = fs.readFileSync(file);
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = function (o) { return String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]); };
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('WAV 파일이 아닙니다: ' + file);
  let pos = 12, fmt = null, dataOff = -1, dataLen = 0;
  while (pos + 8 <= buf.length) {
    const id = tag(pos), size = v.getUint32(pos + 4, true);
    if (id === 'fmt ') fmt = { format: v.getUint16(pos + 8, true), ch: v.getUint16(pos + 10, true), rate: v.getUint32(pos + 12, true), bits: v.getUint16(pos + 22, true) };
    if (id === 'data') { dataOff = pos + 8; dataLen = size; break; }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || dataOff < 0) throw new Error('fmt 나 data 조각이 없습니다: ' + file);
  const bytes = fmt.bits / 8;
  const frames = Math.floor(dataLen / (bytes * fmt.ch));
  const channels = [];
  for (let c = 0; c < fmt.ch; c++) channels.push(new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.ch; c++) {
      const o = dataOff + (i * fmt.ch + c) * bytes;
      let x;
      if (fmt.format === 3 && fmt.bits === 32) x = v.getFloat32(o, true);
      else if (fmt.bits === 16) x = v.getInt16(o, true) / 32768;
      else if (fmt.bits === 24) { let n = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16); if (n & 0x800000) n -= 0x1000000; x = n / 8388608; }
      else throw new Error('지원하지 않는 형식: ' + fmt.format + ' / ' + fmt.bits + 'bit');
      channels[c][i] = x;
    }
  }
  return { channels: channels, sampleRate: fmt.rate, bitDepth: fmt.bits, frames: frames };
}
