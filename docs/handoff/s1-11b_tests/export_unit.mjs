// S1-11b 내보내기 순수 함수 시험 — WAV 인코딩, 범위 계산, 꼬리, 파일명, 시간 창 (소리 · 브라우저 불필요)
// 실행: node docs/handoff/s1-11b_tests/export_unit.mjs
import { encodeWav, peakOfChannels, normalizeGain, wavByteLength } from '../../../studionx/frontend/static/js/audio/wav.js';
import {
  projectEndTick, resolveExportRange, rangeSeconds, autoTailSeconds, sanitizeFileName, exportFileName, formatDuration, formatBytes, MAX_TAIL_SECONDS,
} from '../../../studionx/frontend/static/js/audio/export_plan.js';
import { clipsInRange, windowBoundaries } from '../../../studionx/frontend/static/js/audio/offline.js';

let ok = 0, bad = 0;
const t = (n, c, d) => { if (c) ok++; else { bad++; console.log('FAIL', n, d === undefined ? '' : d); } };
const text = (u8, o, n) => String.fromCharCode(...u8.slice(o, o + n));
const dv = (u8) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

// ── WAV 머리 (16bit 스테레오)
const L = new Float32Array([0, 0.5, -0.5, 1]);
const R = new Float32Array([0, -0.5, 0.5, -1]);
const w16 = encodeWav([L, R], 44100, 16, { dither: false });
const v16 = dv(w16);
t('16-길이', w16.length === 44 + 4 * 2 * 2 && w16.length === wavByteLength(4, 2, 16), w16.length);
t('16-RIFF/WAVE/fmt/data', text(w16, 0, 4) === 'RIFF' && text(w16, 8, 4) === 'WAVE' && text(w16, 12, 4) === 'fmt ' && text(w16, 36, 4) === 'data');
t('16-RIFF 크기', v16.getUint32(4, true) === w16.length - 8);
t('16-포맷 PCM(1)', v16.getUint16(20, true) === 1);
t('16-채널 · 샘플레이트 · 비트', v16.getUint16(22, true) === 2 && v16.getUint32(24, true) === 44100 && v16.getUint16(34, true) === 16);
t('16-초당 바이트 · 프레임 바이트', v16.getUint32(28, true) === 44100 * 4 && v16.getUint16(32, true) === 4);
t('16-data 크기', v16.getUint32(40, true) === 16);
t('16-값: 0.5 → 16384 (왼쪽 2번째 프레임)', v16.getInt16(44 + 4, true) === 16384, v16.getInt16(48, true));
// Math.round 는 .5 를 +방향으로 올리므로 -16383.5 는 -16383 이 됨 (1 LSB 이내의 차이라 소리에는 영향이 없음)
t('16-값: 채널 번갈아 (오른쪽 -0.5 → -16383)', v16.getInt16(44 + 6, true) === -16383, v16.getInt16(50, true));
t('16-값: 1.0 → 32767', v16.getInt16(44 + 12, true) === 32767);
t('16-값: -1.0 → -32767', v16.getInt16(44 + 14, true) === -32767);
const over = encodeWav([new Float32Array([2, -2])], 44100, 16, { dither: false });
t('16-클리핑 +', dv(over).getInt16(44, true) === 32767);
t('16-클리핑 -', dv(over).getInt16(46, true) === -32768);

// ── 디더
const quiet = new Float32Array(2000).fill(0.0001);
const a = encodeWav([quiet], 44100, 16, { dither: true });
const b = encodeWav([quiet], 44100, 16, { dither: true });
const c = encodeWav([quiet], 44100, 16, { dither: false });
t('디더: 같은 입력이면 같은 파일 (재현성)', a.every((x, i) => x === b[i]));
t('디더: 끄면 값이 한결같음', new Set(Array.from({ length: 2000 }, (_, i) => dv(c).getInt16(44 + i * 2, true))).size === 1);
let spread = 0, maxDev = 0;
const base0 = dv(c).getInt16(44, true);
for (let i = 0; i < 2000; i++) { const d = Math.abs(dv(a).getInt16(44 + i * 2, true) - base0); if (d > maxDev) maxDev = d; if (d > 0) spread++; }
t('디더: 값이 흔들림 (몇 개는 달라짐)', spread > 200, spread);
t('디더: 흔들림은 최대 2 LSB 이내', maxDev <= 2, maxDev);

// ── 24bit
const w24 = encodeWav([new Float32Array([0, 0.5, -0.5, 1, -1])], 48000, 24);
const v24 = dv(w24);
t('24-길이', w24.length === 44 + 5 * 3);
t('24-비트 · 프레임 바이트', v24.getUint16(34, true) === 24 && v24.getUint16(32, true) === 3);
const s24 = (i) => { let n = w24[44 + i * 3] | (w24[45 + i * 3] << 8) | (w24[46 + i * 3] << 16); if (n >= 8388608) n -= 16777216; return n; };
t('24-값 0.5 → 4194304', s24(1) === 4194304, s24(1));
t('24-값 -0.5 → -4194303 (.5 는 +방향 올림)', s24(2) === -4194303, s24(2));
t('24-값 1.0 → 8388607', s24(3) === 8388607);
t('24-값 -1.0 → -8388607', s24(4) === -8388607);

// ── 32bit float
const w32 = encodeWav([new Float32Array([0.25, -0.75])], 44100, 32);
const v32 = dv(w32);
t('32f-길이 (머리 58)', w32.length === 58 + 8 && w32.length === wavByteLength(2, 1, 32), w32.length);
t('32f-포맷 IEEE float(3)', v32.getUint16(20, true) === 3 && v32.getUint16(34, true) === 32);
t('32f-fmt 크기 18, fact 조각에 프레임 수', v32.getUint32(16, true) === 18 && text(w32, 38, 4) === 'fact' && v32.getUint32(46, true) === 2);
t('32f-data 조각', text(w32, 50, 4) === 'data' && v32.getUint32(54, true) === 8);
t('32f-값이 그대로', v32.getFloat32(58, true) === 0.25 && v32.getFloat32(62, true) === -0.75);
t('32f-1 초과도 그대로 (클리핑 없음)', dv(encodeWav([new Float32Array([1.5])], 44100, 32)).getFloat32(58, true) === 1.5);

// ── 배율 · 오류 · 정규화
t('배율 0.5', dv(encodeWav([new Float32Array([1])], 44100, 16, { gain: 0.5, dither: false })).getInt16(44, true) === 16384 || dv(encodeWav([new Float32Array([1])], 44100, 16, { gain: 0.5, dither: false })).getInt16(44, true) === 16384);
let threw = false; try { encodeWav([L], 44100, 8); } catch (e) { threw = true; }
t('지원하지 않는 비트 깊이는 오류', threw);
t('빈 소리도 머리는 만들어짐', encodeWav([new Float32Array(0)], 44100, 16).length === 44);
t('피크: 여러 채널 중 가장 큰 값', peakOfChannels([new Float32Array([0.1, -0.4]), new Float32Array([0.9, 0.2])]) === 0.9 || Math.abs(peakOfChannels([new Float32Array([0.1, -0.4]), new Float32Array([0.9, 0.2])]) - 0.9) < 1e-6);
t('피크: 빈 채널', peakOfChannels([new Float32Array(0)]) === 0 && peakOfChannels([]) === 0);
t('정규화: 피크 0.5 → -6.02dB 목표면 배율 1', Math.abs(normalizeGain(0.5, 20 * Math.log10(0.5)) - 1) < 1e-9);
t('정규화: 피크 0.25 → 0dB 면 4배', Math.abs(normalizeGain(0.25, 0) - 4) < 1e-9);
t('정규화: -0.3dB 목표', Math.abs(normalizeGain(0.5, -0.3) - Math.pow(10, -0.3 / 20) / 0.5) < 1e-9);
t('정규화: 소리가 없으면 배율 1', normalizeGain(0, -0.3) === 1 && normalizeGain(NaN, -0.3) === 1);

// ── 범위
const TPB = 3840;
const clips = [{ start_tick: 0, length_tick: TPB * 4 }, { start_tick: TPB * 30, length_tick: TPB * 3 }];
t('곡 끝 = 가장 뒤 클립 끝 (33마디)', projectEndTick(clips) === TPB * 33);
t('곡 끝: 클립 없음 0', projectEndTick([]) === 0 && projectEndTick(null) === 0);
let r = resolveExportRange({ mode: 'all', clips, ticksPerBar: TPB });
t('전체 범위', r.ok && r.startTick === 0 && r.endTick === TPB * 33);
r = resolveExportRange({ mode: 'all', clips: [], ticksPerBar: TPB });
t('전체 범위: 빈 곡은 empty', !r.ok && r.reason === 'empty');
r = resolveExportRange({ mode: 'loop', loop: { start: TPB * 4, end: TPB * 8 }, ticksPerBar: TPB });
t('루프 범위', r.ok && r.startTick === TPB * 4 && r.endTick === TPB * 8);
r = resolveExportRange({ mode: 'loop', loop: null, ticksPerBar: TPB });
t('루프 없음은 no-loop', !r.ok && r.reason === 'no-loop');
r = resolveExportRange({ mode: 'selected', selected: [{ start_tick: TPB * 8, length_tick: TPB * 2 }, { start_tick: TPB * 4, length_tick: TPB * 2 }], ticksPerBar: TPB });
t('선택 클립 범위 = 가장 앞 시작 ~ 가장 뒤 끝', r.ok && r.startTick === TPB * 4 && r.endTick === TPB * 10);
r = resolveExportRange({ mode: 'selected', selected: [], ticksPerBar: TPB });
t('선택 없음은 no-selection', !r.ok && r.reason === 'no-selection');
r = resolveExportRange({ mode: 'custom', fromBar: 9, toBar: 25, ticksPerBar: TPB });
t('직접 지정: 9마디 처음 ~ 25마디 끝', r.ok && r.startTick === TPB * 8 && r.endTick === TPB * 25);
r = resolveExportRange({ mode: 'custom', fromBar: 3, toBar: 3, ticksPerBar: TPB });
t('직접 지정: 같은 마디는 1마디 길이', r.ok && r.endTick - r.startTick === TPB);
t('직접 지정: 끝이 시작보다 앞이면 bad-range', resolveExportRange({ mode: 'custom', fromBar: 5, toBar: 4, ticksPerBar: TPB }).reason === 'bad-range');
t('직접 지정: 0 이하 · 글자는 bad-range', resolveExportRange({ mode: 'custom', fromBar: 0, toBar: 4, ticksPerBar: TPB }).reason === 'bad-range' && resolveExportRange({ mode: 'custom', fromBar: 'a', toBar: 4, ticksPerBar: TPB }).reason === 'bad-range');
t('알 수 없는 모드는 bad-range', resolveExportRange({ mode: 'x', ticksPerBar: TPB }).reason === 'bad-range');
t('길이(초): 120BPM 에서 1마디 = 2초', Math.abs(rangeSeconds(0, TPB, 120, []) - 2) < 1e-9);
t('길이(초): 시작이 뒤여도 차이로 계산', Math.abs(rangeSeconds(TPB * 4, TPB * 6, 120, []) - 4) < 1e-9);

// ── 꼬리 (Auto)
const reverbSchema = [{ key: 'decay', default: 2, min: 0.1, max: 10 }, { key: 'pre_delay', default: 0, min: 0, max: 0.5 }];
const delaySchema = [{ key: 'time', default: 0.35, min: 0.001, max: 4 }, { key: 'sync', default: false }, { key: 'division', default: '1/8' }, { key: 'feedback', default: 0.4, min: 0, max: 0.95 }];
const synthSchema = [{ key: 'env_release', default: 0.3, min: 0, max: 10 }];
t('꼬리: 효과가 없으면 0', autoTailSeconds([], [], 120) === 0);
t('꼬리: 리버브 decay 2 + pre 0.1 → 2.5 (0.5초 올림)', autoTailSeconds([{ plugin_code: 'reverb', schema: reverbSchema, params: { decay: 2, pre_delay: 0.1 } }], [], 120) === 2.5);
t('꼬리: 바이패스한 리버브는 뺌', autoTailSeconds([{ plugin_code: 'reverb', schema: reverbSchema, params: { decay: 5 }, is_bypassed: true }], [], 120) === 0);
const dly = autoTailSeconds([{ plugin_code: 'delay', schema: delaySchema, params: { time: 0.5, sync: false, feedback: 0.5 } }], [], 120);
t('꼬리: 딜레이 0.5초, 되먹임 0.5 → 10번 가량 반복해 5초 이상', dly >= 5 && dly <= 6, dly);
t('꼬리: 되먹임 0 이면 한 번만 반복', autoTailSeconds([{ plugin_code: 'delay', schema: delaySchema, params: { time: 0.5, feedback: 0 } }], [], 120) === 1);
t('꼬리: 악기 릴리스 포함', autoTailSeconds([], [{ schema: synthSchema, params: { env_release: 1.2 } }], 120) === 1.5);
t('꼬리: 꺼진 악기 층은 뺌', autoTailSeconds([], [{ schema: synthSchema, params: { env_release: 3 }, is_enabled: false }], 120) === 0);
t('꼬리: 가장 긴 것을 고름', autoTailSeconds([{ plugin_code: 'reverb', schema: reverbSchema, params: { decay: 4 } }], [{ schema: synthSchema, params: { env_release: 1 } }], 120) === 4);
t('꼬리: 한도(30초) 넘지 않음', autoTailSeconds([{ plugin_code: 'delay', schema: [{ key: 'time', default: 4, min: 0.001, max: 4 }, { key: 'feedback', default: 0.95, min: 0, max: 0.95 }], params: {} }], [], 120) <= MAX_TAIL_SECONDS);

// ── 파일명
t('파일명: 금지 글자를 _ 로', sanitizeFileName('a/b:c*d?e"f<g>h|i\\j') === 'a_b_c_d_e_f_g_h_i_j');
t('파일명: 앞뒤 공백과 연속 공백 정리', sanitizeFileName('  My   Song  ') === 'My Song');
t('파일명: 비면 기본값', sanitizeFileName('') === 'Studio Nx' && sanitizeFileName('   ') === 'Studio Nx' && sanitizeFileName(null) === 'Studio Nx');
t('파일명: 맨 앞 점 제거', sanitizeFileName('..hidden') === 'hidden');
t('파일명: 한글 그대로', sanitizeFileName('한밤의 드라이브') === '한밤의 드라이브');
t('파일명: {제목}_{YYYYMMDD_HHmm}', exportFileName('Midnight Drive', new Date(2026, 9, 20, 14, 5)) === 'Midnight Drive_20261020_1405');
t('파일명: 한 자리 월 · 시 · 분에 0 채움', exportFileName('A', new Date(2027, 0, 3, 4, 7)) === 'A_20270103_0407');
t('파일명: 제목의 금지 글자도 정리', exportFileName('A/B', new Date(2026, 9, 20, 14, 5)) === 'A_B_20261020_1405');

// ── 표시
t('길이 표시 65초 → 1:05', formatDuration(65) === '1:05');
t('길이 표시 0.4초 → 0:00, 음수도 0:00', formatDuration(0.4) === '0:00' && formatDuration(-3) === '0:00');
t('길이 표시 600초 → 10:00', formatDuration(600) === '10:00');
t('크기 표시 MB', formatBytes(12373000) === '11.8 MB', formatBytes(12373000));
t('크기 표시 KB', formatBytes(2048) === '2 KB' && formatBytes(10) === '1 KB');

// ── 클립 자르기 · 시간 창
const cl = [{ id: 1, start_tick: 0, length_tick: 1000 }, { id: 2, start_tick: 900, length_tick: 500 }, { id: 3, start_tick: 2000, length_tick: 100 }, { id: 4, start_tick: 100, length_tick: 50 }];
const cut = clipsInRange(cl, 500, 1200);
t('클립 자르기: 겹치는 것만 (1, 2)', cut.length === 2 && cut[0].id === 1 && cut[1].id === 2, JSON.stringify(cut));
t('클립 자르기: 범위 끝 밖은 잘림 (2번 길이 500 → 300)', cut[1].length_tick === 300);
t('클립 자르기: 시작 쪽은 그대로 둠 (offset 으로 처리)', cut[0].start_tick === 0 && cut[0].length_tick === 1000);
t('클립 자르기: 원본은 바뀌지 않음', cl[1].length_tick === 500);
t('클립 자르기: 끝이 범위 시작과 같으면 뺌', clipsInRange([{ start_tick: 0, length_tick: 500 }], 500, 900).length === 0);
t('클립 자르기: 시작이 범위 끝과 같으면 뺌', clipsInRange([{ start_tick: 900, length_tick: 50 }], 500, 900).length === 0);

const bd = windowBoundaries(0, TPB * 5, 120, [], 2);       // 10초 → 2초 창 5개
t('시간 창: 경계 [0, 3840, 7680, 11520, 15360, 19200]', JSON.stringify(bd) === JSON.stringify([0, 3840, 7680, 11520, 15360, 19200]), JSON.stringify(bd));
const bd2 = windowBoundaries(TPB * 2, TPB * 2 + 1000, 120, [], 2);
t('시간 창: 짧은 범위는 [시작, 끝] 한 창', JSON.stringify(bd2) === JSON.stringify([TPB * 2, TPB * 2 + 1000]), JSON.stringify(bd2));
const bd3 = windowBoundaries(0, 11000, 120, [], 2);
t('시간 창: 오름차순이고 중복이 없음', bd3.every((x, i) => i === 0 || x > bd3[i - 1]) && bd3[0] === 0 && bd3[bd3.length - 1] === 11000, JSON.stringify(bd3));
const bd4 = windowBoundaries(0, TPB * 4, 120, [{ tick: TPB * 2, bpm: 240 }], 2);   // 템포 변경 포함
t('시간 창: 템포가 바뀌어도 경계가 끝을 넘지 않음', bd4[bd4.length - 1] === TPB * 4 && bd4.every((x) => x <= TPB * 4), JSON.stringify(bd4));

console.log(ok + ' passed, ' + bad + ' failed');
process.exit(bad === 0 ? 0 : 1);
