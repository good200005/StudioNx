// S1-11a 이펙트 시험 — 이펙트마다 소리가 실제로 달라지는지 OfflineAudioContext 로 확인합니다 (화면 · 로그인 불필요).
// 서버 8001 이 static 파일을 내주는 것만 필요합니다. 이 방식은 S1-11b(WAV 출력)가 쓸 렌더링과 같습니다.
// 실행: node docs/handoff/s1-11a_tests/effects_offline.mjs
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const b = await launch(9563, 800, 600);
await b.goto('http://localhost:8001/home.html');

// 입력(사인파 또는 임펄스)을 이펙트에 통과시켜 렌더링하고 통계를 돌려주는 도구
await b.ev(`window.__fx = async (code, params, opts) => {
  opts = opts || {};
  const m = await import('/static/js/audio/effects.js');
  const sr = 44100, secs = opts.secs || 1;
  const ctx = new OfflineAudioContext(2, sr * secs, sr);
  const buf = ctx.createBuffer(1, sr * secs, sr);
  const d = buf.getChannelData(0);
  if (opts.impulse) d[0] = 1;
  else for (let i = 0; i < d.length; i++) d[i] = (opts.amp || 0.5) * Math.sin(2 * Math.PI * (opts.freq || 440) * i / sr);
  const src = ctx.createBufferSource(); src.buffer = buf;
  let last = src;
  if (code) { const fx = m.createEffect(ctx, code, params, () => (opts.bpm || 120)); src.connect(fx.input); last = fx.output; }
  last.connect(ctx.destination);
  src.start(0);
  const out = (await ctx.startRendering()).getChannelData(0);
  const from = Math.floor(sr * (opts.skip || 0.2));
  let peak = 0, sum = 0, n = 0;
  for (let i = from; i < out.length; i++) { peak = Math.max(peak, Math.abs(out[i])); sum += out[i] * out[i]; n++; }
  const at = (t) => { let p = 0; const s = Math.floor(t * sr); for (let i = s - 20; i < s + 20; i++) if (i >= 0 && i < out.length) p = Math.max(p, Math.abs(out[i])); return p; };
  const tailEnergy = (t0, t1) => { let e = 0; for (let i = Math.floor(t0 * sr); i < Math.min(out.length, Math.floor(t1 * sr)); i++) e += out[i] * out[i]; return e; };
  return { peak, rms: Math.sqrt(sum / n), at: [0, 0.1, 0.2, 0.25, 0.3].map(at), tail: tailEnergy(0.6, 1) };
}; 1`);
const run = async (code, params, opts) => b.ev(`window.__fx(${JSON.stringify(code)}, ${JSON.stringify(params)}, ${JSON.stringify(opts || {})})`);

const base = await run(null, {});
check('기준: 0.5 사인파의 피크가 약 0.5', Math.abs(base.peak - 0.5) < 0.02, JSON.stringify(base));

// Gain
const g12 = await run('gain', { gain: -12, pan: 0, phase_invert: false });
check('Gain -12dB: 크기가 약 1/4 (0.251)', Math.abs(g12.rms / base.rms - 0.251) < 0.02, 'ratio=' + g12.rms / base.rms);
const g6 = await run('gain', { gain: 6, pan: 0, phase_invert: false });
check('Gain +6dB: 크기가 약 2배', Math.abs(g6.rms / base.rms - 1.995) < 0.05, 'ratio=' + g6.rms / base.rms);

// EQ
const low100 = await run(null, {}, { freq: 100 });
const eqCut = await run('eq3', { low_gain: -24, low_freq: 200, mid_gain: 0, mid_freq: 1000, mid_q: 0.7, high_gain: 0, high_freq: 6000 }, { freq: 100 });
check('EQ 저음 -24dB: 100Hz 소리가 크게 줄어듦 (< 30%)', eqCut.rms / low100.rms < 0.3, 'ratio=' + eqCut.rms / low100.rms);
const eqMid = await run('eq3', { low_gain: 0, low_freq: 200, mid_gain: 12, mid_freq: 1000, mid_q: 0.7, high_gain: 0, high_freq: 6000 }, { freq: 1000 });
const mid1k = await run(null, {}, { freq: 1000 });
check('EQ 중음 +12dB: 1kHz 소리가 약 4배', eqMid.rms / mid1k.rms > 3.5 && eqMid.rms / mid1k.rms < 4.5, 'ratio=' + eqMid.rms / mid1k.rms);
const eqFlat = await run('eq3', { low_gain: 0, low_freq: 200, mid_gain: 0, mid_freq: 1000, mid_q: 0.7, high_gain: 0, high_freq: 6000 });
check('EQ 모두 0dB: 소리가 그대로', Math.abs(eqFlat.rms / base.rms - 1) < 0.02, 'ratio=' + eqFlat.rms / base.rms);

// Compressor
const comp = await run('compressor', { threshold: -40, ratio: 20, attack: 0.001, release: 0.1, knee: 0, makeup: 0 }, { secs: 1.5, skip: 0.8 });
const compBase = await run(null, {}, { secs: 1.5, skip: 0.8 });
check('Compressor 임계값 -40dB, 20:1: 소리가 줄어듦 (< 50%)', comp.rms / compBase.rms < 0.5, 'ratio=' + comp.rms / compBase.rms);
const compMk = await run('compressor', { threshold: -40, ratio: 20, attack: 0.001, release: 0.1, knee: 0, makeup: 12 }, { secs: 1.5, skip: 0.8 });
check('Compressor 메이크업 +12dB: 소리가 커짐 (약 4배)', compMk.rms / comp.rms > 3.5 && compMk.rms / comp.rms < 4.5, 'ratio=' + compMk.rms / comp.rms);

// Limiter
const lim = await run('limiter', { ceiling: -12, release: 0.1 }, { secs: 1.5, skip: 0.8 });
check('Limiter 천장 -12dB: 피크가 입력(0.5)보다 줄어듦', lim.peak < 0.4, 'peak=' + lim.peak);

// Delay: 임펄스, 0.1초 간격 반복(되먹임 0.5)
const dl = await run('delay', { time: 0.1, sync: false, division: '1/8', feedback: 0.5, tone: 20000, mix: 1 }, { impulse: true, secs: 1 });
check('Delay: 원음(0초)이 그대로', dl.at[0] > 0.9, JSON.stringify(dl.at));
check('Delay: 0.1초에 첫 반복', dl.at[1] > 0.8, JSON.stringify(dl.at));
check('Delay: 0.2초에 두 번째 반복(되먹임 0.5 이므로 약 0.5)', dl.at[2] > 0.35 && dl.at[2] < 0.65, JSON.stringify(dl.at));
const dlSync = await run('delay', { time: 0.9, sync: true, division: '1/8', feedback: 0, tone: 20000, mix: 1 }, { impulse: true, secs: 1, bpm: 120 });
check('Delay 템포 동기: 120BPM 1/8 이면 0.25초에 반복', dlSync.at[3] > 0.8, JSON.stringify(dlSync.at));

// Reverb
const rv = await run('reverb', { mix: 1, decay: 2, pre_delay: 0, damping: 0.3 }, { impulse: true, secs: 1 });
check('Reverb mix 1: 0.6~1초 구간에 꼬리가 남음', rv.tail > 1e-6, 'tail=' + rv.tail);
const rv0 = await run('reverb', { mix: 0, decay: 2, pre_delay: 0, damping: 0.3 }, { impulse: true, secs: 1 });
check('Reverb mix 0: 꼬리가 없음', rv0.tail < 1e-9, 'tail=' + rv0.tail);
const r1 = await run('reverb', { mix: 0.5, decay: 1, pre_delay: 0.01, damping: 0.5 }, { impulse: true });
const r2 = await run('reverb', { mix: 0.5, decay: 1, pre_delay: 0.01, damping: 0.5 }, { impulse: true });
check('Reverb: 같은 설정이면 렌더링 결과가 같음 (재현성)', r1.tail === r2.tail && r1.peak === r2.peak, JSON.stringify([r1, r2]));

b.close();
process.exit(summary() ? 0 : 1);
