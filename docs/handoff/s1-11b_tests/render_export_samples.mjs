// S1-11b 내보내기 결과를 귀로 확인할 WAV 샘플 만들기
// 내보내기 창이 쓰는 실제 코드(offline.js 의 renderOffline, wav.js 의 encodeWav, export_plan.js 의 범위 계산)를 그대로 돌려
// 옵션(비트 깊이, 샘플레이트, 정규화, 꼬리, 범위, 선택한 클립, 뮤트와 솔로)마다 파일을 하나씩 만듭니다.
// 큰 오디오 파일은 저장소에 넣지 않는 규칙이라 저장소 밖 폴더에 만듭니다 (WAV_OUT 환경 변수로 위치 변경).
// 전제: 시험용 서버 8001 과 시험 계정 (플러그인 정의를 받기 위해 로그인합니다).
// 실행: node docs/handoff/s1-11b_tests/render_export_samples.mjs
import fs from 'node:fs';
import { launch } from '../p1-28_tests/lib.mjs';

const OUT = process.env.WAV_OUT || 'C:/Users/USER/Desktop/StudioNx_s1-11b_audio/';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9612, 800, 600);
await b.goto('http://localhost:8001/home.html');
await b.ev(`fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'s109-tester@example.com',password:'Test1234!',remember:false}),credentials:'same-origin'}).then(r=>r.status)`);

await b.ev(`window.__export = async (name, cfg) => {
  const api = await import('/static/js/core/api.js');
  const off = await import('/static/js/audio/offline.js');
  const wav = await import('/static/js/audio/wav.js');
  const plan = await import('/static/js/audio/export_plan.js');
  const plugins = (await api.api.get('/plugins?active_only=true')).items;
  const schemaOf = (code) => plugins.filter((p) => p.code === code)[0].param_schema;
  const TPB = 3840;

  // 곡: 1~2마디(클립 A: A 마이너 아르페지오)와 3~4마디(클립 B: 한 옥타브 위)를 한 Synth 트랙에, 트랙 2 는 낮은 베이스
  const arp = (base) => [[0, 0], [960, 3], [1920, 7], [2880, 12], [3840, 7], [4800, 3], [5760, 0], [6720, 12]].map(([t, semi]) => ({ pitch: base + semi, velocity: 100, start_tick: t, length_tick: 880 }));
  const clipA = { track_id: 1, start_tick: 0, length_tick: TPB * 2, offset_tick: 0, notes: arp(57), selected: false };
  const clipB = { track_id: 1, start_tick: TPB * 2, length_tick: TPB * 2, offset_tick: 0, notes: arp(69), selected: !!cfg.selectB };
  const bass = { track_id: 2, start_tick: 0, length_tick: TPB * 4, offset_tick: 0, notes: [[45, 0], [45, 3840], [48, 7680], [43, 11520]].map(([p, t]) => ({ pitch: p, velocity: 100, start_tick: t, length_tick: 3500 })), selected: false };
  const midiClips = [clipA, clipB].concat(cfg.bass ? [bass] : []);

  const T = (id, o) => Object.assign({ track_id: id, track_type: 'MIDI', volume_db: 0, pan: 0, is_muted: false, is_solo: false }, o || {});
  const tracks = [T(1, cfg.t1), T(2, cfg.t2), { track_id: 99, track_type: 'MASTER', volume_db: 0 }];
  const synthParams = { env_attack: 0.01, env_release: 0.25, cutoff: 3000 };
  const instruments = { 1: [{ params: synthParams }], 2: [{ params: Object.assign({ osc1_wave: 'square', cutoff: 600, env_release: 0.15 }, {}) }] };
  const fx = cfg.fx || {};

  const o = Object.assign({ mode: 'all', sampleRate: 44100, bitDepth: 16, normalize: false, normalizeDb: -0.3, tailSec: 0 }, cfg.opt || {});
  const sel = midiClips.filter((c) => c.selected);
  const range = plan.resolveExportRange({ mode: o.mode, clips: midiClips, loop: null, selected: sel, fromBar: o.fromBar, toBar: o.toBar, ticksPerBar: TPB });
  if (!range.ok) throw new Error(name + ': 범위 ' + range.reason);
  const used = o.mode === 'selected' ? sel : midiClips;

  const out = await off.renderOffline({
    tracks, audioClips: [], midiClips: used,
    getInstruments: (id) => (instruments[id] || []).map((l, i) => ({ id: i + 1, plugin_code: 'synth_sub', schema: schemaOf('synth_sub'), params: l.params, volume_db: 0, pan: 0, is_enabled: true })),
    getEffects: (id) => (fx[id] || []).map((e, i) => ({ id: 'e' + id + '_' + i, plugin_code: e.code, schema: schemaOf(e.code), params: e.params, is_bypassed: false, slot_index: i })),
    bpm: 120, tempoChanges: [], startTick: range.startTick, endTick: range.endTick, tailSec: o.tailSec, sampleRate: o.sampleRate,
    loadSampleBytes: () => Promise.reject(new Error('no samples')),
  });
  const peak = wav.peakOfChannels(out.channels);
  const gain = o.normalize ? wav.normalizeGain(peak, o.normalizeDb) : 1;
  const bytes = wav.encodeWav(out.channels, out.sampleRate, o.bitDepth, { gain, dither: true });
  let s = '';
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return JSON.stringify({ name, peak, after: peak * gain, seconds: out.frames / out.sampleRate, rate: out.sampleRate, bits: o.bitDepth, b64: btoa(s) });
}; 1`);

const DELAY_REVERB = { 1: [{ code: 'delay', params: { time: 0.375, sync: false, feedback: 0.55, mix: 0.4 } }, { code: 'reverb', params: { mix: 0.35, decay: 2.5 } }] };
const jobs = [
  ['01_기본_16bit_44.1k_4마디', {}],
  ['02_24bit_48k', { opt: { sampleRate: 48000, bitDepth: 24 } }],
  ['03_32bit_float_48k', { opt: { sampleRate: 48000, bitDepth: 32 } }],
  ['04_작은소리_정규화_안함', { t1: { volume_db: -20 } }],
  ['05_작은소리_정규화_함(-0.3dBFS)', { t1: { volume_db: -20 }, opt: { normalize: true } }],
  ['06_딜레이와_리버브_꼬리_0초(뚝_끊김)', { fx: DELAY_REVERB, opt: { tailSec: 0 } }],
  ['07_딜레이와_리버브_꼬리_4초', { fx: DELAY_REVERB, opt: { tailSec: 4 } }],
  ['08_범위_3마디부터_4마디까지(직접_지정)', { opt: { mode: 'custom', fromBar: 3, toBar: 4 } }],
  ['09_선택한_클립만(클립B)', { selectB: true, opt: { mode: 'selected' } }],
  ['10_두_트랙_베이스_함께', { bass: true }],
  ['11_두_트랙_베이스_뮤트', { bass: true, t2: { is_muted: true } }],
  ['12_두_트랙_베이스만_솔로', { bass: true, t2: { is_solo: true } }],
];

for (const [name, cfg] of jobs) {
  const res = JSON.parse(await b.ev(`window.__export(${JSON.stringify(name)}, ${JSON.stringify(cfg)})`));
  const file = OUT + name + '.wav';
  fs.writeFileSync(file, Buffer.from(res.b64, 'base64'));
  console.log(name.padEnd(44), (fs.statSync(file).size / 1024).toFixed(0).padStart(5) + 'KB', res.seconds.toFixed(1) + 's', res.rate + 'Hz', res.bits + 'bit', 'peak', res.peak.toFixed(3), '→', res.after.toFixed(3));
}
b.close();
process.exit(0);
