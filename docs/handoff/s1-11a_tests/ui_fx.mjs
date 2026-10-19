// S1-11a 화면 시험 — 이펙트 체인이 실제 화면의 재생 소리에 반영되는지 (5단계)
// 전제: 시험용 서버 8001 에 최신 코드가 떠 있고, 계정 s109-tester@example.com 과 프로젝트 14431 이 DB 에 있습니다.
// 이 시험은 사인파 클립(진폭 0.4)을 시험 전용 오디오 트랙에 놓고, 트랙 이펙트 · 바이패스 · 마스터 이펙트를 API 로 붙인 뒤
// 화면을 다시 열어 ▶ 로 마스터 출력의 피크를 잽니다. 끝나면 만든 것(트랙 · 클립 · 샘플 · 이펙트)을 모두 지웁니다.
// 실행: node docs/handoff/s1-11a_tests/ui_fx.mjs
import fs from 'node:fs';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-19_s1-11a_audio_graph/';
const BASE = 'http://localhost:8001';
const PID = '14431';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9565, 1600, 1000);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);
const nav = async (url) => {
  const before = b.events.length;
  const p = b.send('Page.navigate', { url });
  let done = false; p.then(() => { done = true; });
  for (let i = 0; i < 80 && !done; i++) {
    await sleep(150);
    if (b.events.slice(before).some((e) => e.method === 'Page.javascriptDialogOpening')) await b.send('Page.handleJavaScriptDialog', { accept: true });
  }
  await sleep(2500);
};

await b.goto(BASE + '/home.html');
const creds = J({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
const status = await q(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${J(creds)},credentials:'same-origin'});return r.status})()`);
check('시험 계정으로 로그인(200)', status === 200, 'status=' + status);

/* ── 씨앗: 8초 사인파(진폭 0.4) 클립을 시험 전용 오디오 트랙에 ── */
const seed = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of full.clips) { await m.api.delete('/clips/' + c.clip_id); }
  const plugins = (await m.api.get('/plugins?active_only=true')).items;
  const code = (c) => plugins.filter(p => p.code === c)[0].plugin_id;
  const master = full.tracks.filter(t => t.track_type === 'MASTER')[0];
  // 지난 시험이 남긴 샘플과 시험용 트랙을 지움
  const old = await m.api.get('/samples?page_size=100');
  for (const sm of (old.items || [])) { if (sm.name.indexOf('s1-11a') === 0) await m.api.delete('/samples/' + sm.sample_id); }
  for (const t of full.tracks) { if (t.name === 'S1-11a FX Test') await m.api.delete('/tracks/' + t.track_id); }
  // 이펙트가 없는 시험 전용 오디오 트랙 (끝나면 지움)
  const audio = await m.api.post('/projects/${PID}/tracks', { project_id: ${PID}, name: 'S1-11a FX Test', track_type: 'AUDIO', order_index: 50 });
  const sr = 44100, n = sr * 8, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 0.4 * 32767), true);
  const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'audio/wav' }), 's1-11a-fx-sine440.wav');
  const sample = await m.api.post('/samples', fd);
  const clip = await m.api.post('/tracks/' + audio.track_id + '/clips', { clip_type: 'AUDIO', sample_id: sample.sample_id, start_tick: 0, length_tick: 3840 * 4 });
  return JSON.stringify({ trackId: audio.track_id, masterId: master.track_id, sampleId: sample.sample_id, clipId: clip.clip_id, gainId: code('gain'), limiterId: code('limiter') });
`));
check('사인파 클립을 만들었음', !!seed.clipId, J(seed));

// 화면을 열고 ▶ 로 피크를 재는 한 번의 시험
const measure = async (label) => {
  await nav(`${BASE}/studioNx.html?projectId=${PID}`);
  await q(`window.__peak=async(ms)=>{const m=await import('/static/js/pages/sequencer-audio.js');const s=m.audioSession();if(!s||!s.mixer)return -1;
    if(!window.__an){window.__an=s.mixer.out.context.createAnalyser();window.__an.fftSize=2048;s.mixer.out.connect(window.__an);}
    const d=new Float32Array(2048);let peak=0;const t0=performance.now();
    while(performance.now()-t0<ms){window.__an.getFloatTimeDomainData(d);for(const x of d)peak=Math.max(peak,Math.abs(x));await new Promise(r=>setTimeout(r,20));}
    return peak;}; 1`);
  await q(`document.getElementById('btn-stop').click()`);
  await sleep(300);
  await q(`document.getElementById('btn-play').click()`);
  await sleep(1500);
  await q(`window.__peak(10)`);
  const peak = await q(`window.__peak(800)`);
  await b.shot(OUT + '03_fx_' + label + '.png');
  await q(`document.getElementById('btn-stop').click()`);
  await sleep(500);
  return peak;
};

/* ── 1. 이펙트 없음: 기준 (0.4) ── */
const base = await measure('base');
check('이펙트 없음: 피크가 사인파 진폭(0.4)과 같음', Math.abs(base - 0.4) < 0.03, 'peak=' + base);

/* ── 2. 트랙에 Gain -12dB ── */
const gainFx = JSON.parse(await api(`
  const fx = await m.api.post('/tracks/${seed.trackId}/plugins', { plugin_id: ${seed.gainId}, slot_index: 0, params: { gain: -12, pan: 0, phase_invert: false } });
  return JSON.stringify({ id: fx.track_plugin_id });
`));
const withGain = await measure('gain');
check('트랙 Gain -12dB: 피크가 약 1/4 (0.1)', Math.abs(withGain / base - 0.251) < 0.03, 'ratio=' + withGain / base + ' peak=' + withGain);

/* ── 3. 바이패스하면 원래 소리 ── */
await api(`await m.api.patch('/tracks/${seed.trackId}/plugins/${gainFx.id}', { is_bypassed: true });`);
const bypass = await measure('bypass');
check('바이패스하면 이펙트가 빠져 원래 소리로 돌아옴', Math.abs(bypass - base) < 0.03, 'peak=' + bypass);

/* ── 4. 바이패스를 풀고 파라미터를 바꾸면 반영 (Gain +0dB → 원래 소리, -24dB → 거의 무음) ── */
await api(`await m.api.patch('/tracks/${seed.trackId}/plugins/${gainFx.id}', { is_bypassed: false, params: { gain: -24, pan: 0, phase_invert: false } });`);
const quiet = await measure('gain24');
check('Gain -24dB: 피크가 약 1/16 (0.025)', Math.abs(quiet / base - 0.0631) < 0.02, 'ratio=' + quiet / base);

/* ── 5. 마스터 트랙에 Limiter(천장 -12dB) → 마스터 출력의 피크가 줄어듦 ── */
await api(`await m.api.delete('/tracks/${seed.trackId}/plugins/${gainFx.id}');`);
const lim = JSON.parse(await api(`
  const fx = await m.api.post('/tracks/${seed.masterId}/plugins', { plugin_id: ${seed.limiterId}, slot_index: 0, params: { ceiling: -12, release: 0.1 } });
  return JSON.stringify({ id: fx.track_plugin_id });
`));
const masterLim = await measure('master_limiter');
check('마스터 Limiter 천장 -12dB: 피크가 줄어듦 (< 0.3)', masterLim < 0.3 && masterLim > 0.05, 'peak=' + masterLim);

/* ── 6. 정지 후 JS 오류 없음 ── */
const errs = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
check('화면에서 JS 오류가 나지 않음', errs === 0, 'errors=' + errs);

/* ── 씨앗 지우기 ── */
await api(`await m.api.delete('/tracks/${seed.masterId}/plugins/${lim.id}');
  await m.api.delete('/samples/${seed.sampleId}'); await m.api.delete('/tracks/${seed.trackId}');`);
b.close();
process.exit(summary() ? 0 : 1);
