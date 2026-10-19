// S1-11a 소리를 WAV 파일로 렌더링 — 직접 들어 보기 위한 샘플 (S1-11b 의 렌더링 방식을 미리 쓰는 셈)
// 실제 재생과 같은 코드(synth.js, effects.js, mixer.js)를 OfflineAudioContext 에서 돌려 결과를 파일로 저장합니다.
// 큰 오디오 파일은 저장소에 넣지 않는 규칙이라 저장소 밖 폴더에 만듭니다.
// 전제: 시험용 서버 8001 과 시험 계정 (플러그인 정의를 받기 위해 로그인합니다).
// 실행: node docs/handoff/s1-11a_tests/render_samples.mjs
import fs from 'node:fs';
import { launch } from '../p1-28_tests/lib.mjs';

const OUT = process.env.WAV_OUT || 'C:/Users/USER/Desktop/StudioNx_s1-11a_audio/';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9611, 800, 600);
await b.goto('http://localhost:8001/home.html');
await b.ev(`fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'s109-tester@example.com',password:'Test1234!',remember:false}),credentials:'same-origin'}).then(r=>r.status)`);

// 렌더링 도구: 짧은 프레이즈를 Synth 로 연주해 이펙트 체인을 거쳐 WAV(16bit 스테레오)로 돌려줌
await b.ev(`window.__render = async (name, secs, setup) => {
  const api = await import('/static/js/core/api.js');
  const synth = await import('/static/js/audio/synth.js');
  const fx = await import('/static/js/audio/effects.js');
  const mix = await import('/static/js/audio/mixer.js');
  const plugins = (await api.api.get('/plugins?active_only=true')).items;
  const schemaOf = (code) => plugins.filter(p => p.code === code)[0].param_schema;
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.floor(sr * secs), sr);
  const mixer = new mix.MixerGraph(ctx);
  const bpm = 120;
  const params = (code, over) => synth.resolveParams(schemaOf(code), over || {});
  const chain = (list) => list.map(([code, over]) => fx.createEffect(ctx, code, params(code, over), () => bpm));
  const play = (trackId, notes, over) => {
    const p = params('synth_sub', over);
    const dest = mixer.trackInput(trackId);
    notes.forEach(([pitch, t, len]) => synth.playSynthNote(ctx, dest, p, pitch, 100, t, len));
  };
  // 프레이즈: A3 C4 E4 A4 (한 음 0.5초)
  const phrase = [[57, 0, 0.45], [60, 0.5, 0.45], [64, 1.0, 0.45], [69, 1.5, 0.9]];
  await setup({ mixer, play, chain, phrase });
  const buf = await ctx.startRendering();
  // WAV 인코딩 (16bit PCM 스테레오)
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  const out = new ArrayBuffer(44 + n * 4), v = new DataView(out);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true);
  v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, R[i]));
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    v.setInt16(44 + i * 4, Math.round(l * 32767), true);
    v.setInt16(46 + i * 4, Math.round(r * 32767), true);
  }
  const bytes = new Uint8Array(out); let s = '';
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return JSON.stringify({ name, peak, b64: btoa(s) });
}; 1`);

// 렌더링할 목록: [파일 이름, 길이(초), 설정 코드]
const jobs = [
  ['01_synth_dry', 3, `async (c) => { c.play(1, c.phrase); }`],
  ['02_gain_minus12dB', 3, `async (c) => { c.play(1, c.phrase); c.mixer.setTrackEffects(1, c.chain([['gain', { gain: -12 }]])); }`],
  ['03_eq_low_cut_-24dB', 3, `async (c) => { c.play(1, c.phrase); c.mixer.setTrackEffects(1, c.chain([['eq3', { low_gain: -24, low_freq: 400 }]])); }`],
  ['04_compressor', 3, `async (c) => { c.play(1, c.phrase); c.mixer.setTrackEffects(1, c.chain([['compressor', { threshold: -30, ratio: 8, makeup: 6 }]])); }`],
  ['05_delay_0.25s_feedback0.5', 5, `async (c) => { c.play(1, c.phrase); c.mixer.setTrackEffects(1, c.chain([['delay', { time: 0.25, sync: false, feedback: 0.5, mix: 0.5 }]])); }`],
  ['06_reverb_decay2s', 5, `async (c) => { c.play(1, c.phrase); c.mixer.setTrackEffects(1, c.chain([['reverb', { mix: 0.4, decay: 2, damping: 0.5 }]])); }`],
  ['07_limiter_ceiling-12dB', 3, `async (c) => { c.play(1, c.phrase); c.mixer.setTrackEffects(1, c.chain([['limiter', { ceiling: -12 }]])); }`],
  ['08_mixer_pan_left_and_right', 3, `async (c) => { c.play(1, c.phrase, { osc1_wave: 'square' }); c.play(2, c.phrase.map(([p, t, l]) => [p + 12, t, l]), { osc1_wave: 'triangle' });
      c.mixer.applyTracks([{ track_id: 1, volume_db: 0, pan: -1 }, { track_id: 2, volume_db: 0, pan: 1 }]); }`],
  ['09_full_chain_eq_comp_delay_reverb_limiter', 6, `async (c) => { c.play(1, c.phrase); c.mixer.setTrackEffects(1, c.chain([
      ['eq3', { low_gain: -6, low_freq: 250, high_gain: 3 }], ['compressor', { threshold: -24, ratio: 4, makeup: 4 }],
      ['delay', { time: 0.25, feedback: 0.35, mix: 0.3 }], ['reverb', { mix: 0.25, decay: 1.8 }], ['limiter', { ceiling: -1 }]])); }`],
];

for (const [name, secs, setup] of jobs) {
  const res = JSON.parse(await b.ev(`window.__render(${JSON.stringify(name)}, ${secs}, ${setup})`));
  const file = OUT + name + '.wav';
  fs.writeFileSync(file, Buffer.from(res.b64, 'base64'));
  console.log(name.padEnd(46), (fs.statSync(file).size / 1024).toFixed(0) + 'KB', 'peak', res.peak.toFixed(3));
}
b.close();
process.exit(0);
