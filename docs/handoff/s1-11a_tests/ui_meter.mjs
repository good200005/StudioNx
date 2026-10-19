// S1-11a 화면 시험 — 레벨 미터가 흉내가 아니라 진짜 소리 크기를 보여 주는지 (6단계)
// 전제: 시험용 서버 8001 에 최신 코드가 떠 있고, 계정 s109-tester@example.com 과 프로젝트 14431 이 DB 에 있습니다.
// 이 시험은 진폭 0.4 사인파 클립을 시험 전용 오디오 트랙에 놓고, ▶ 를 눌러 그 트랙 믹서 줄의 미터 막대(--m)를 읽습니다.
//   진폭 0.4 → 약 -8dB → 막대 약 87% 여야 하고, 정지하면 천천히 0% 로 내려가야 합니다 (흉내 값은 이 수치와 맞지 않음).
// 끝나면 만든 것(트랙 · 클립 · 샘플)을 지웁니다.
// 실행: node docs/handoff/s1-11a_tests/ui_meter.mjs
import fs from 'node:fs';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-19_s1-11a_audio_graph/';
const BASE = 'http://localhost:8001';
const PID = '14431';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9567, 1600, 1000);
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

const seed = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of full.clips) { await m.api.delete('/clips/' + c.clip_id); }
  const old = await m.api.get('/samples?page_size=100');
  for (const sm of (old.items || [])) { if (sm.name.indexOf('s1-11a') === 0) await m.api.delete('/samples/' + sm.sample_id); }
  for (const t of full.tracks) { if (t.name === 'S1-11a Meter Test') await m.api.delete('/tracks/' + t.track_id); }
  const audio = await m.api.post('/projects/${PID}/tracks', { project_id: ${PID}, name: 'S1-11a Meter Test', track_type: 'AUDIO', order_index: 50 });
  const sr = 44100, n = sr * 8, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 0.4 * 32767), true);
  const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'audio/wav' }), 's1-11a-meter-sine440.wav');
  const sample = await m.api.post('/samples', fd);
  const clip = await m.api.post('/tracks/' + audio.track_id + '/clips', { clip_type: 'AUDIO', sample_id: sample.sample_id, start_tick: 0, length_tick: 3840 * 4 });
  return JSON.stringify({ trackId: audio.track_id, sampleId: sample.sample_id, clipId: clip.clip_id });
`));
check('사인파 클립을 만들었음', !!seed.clipId, J(seed));

await nav(`${BASE}/studioNx.html?projectId=${PID}`);
const read = (id) => q(`(()=>{const s=document.querySelector('.sq-strip[data-track-id="${id}"]');if(!s)return null;
  return [...s.querySelectorAll('.sq-meter i')].map(i=>parseFloat(i.style.getPropertyValue('--m'))||0)})()`);
check('시험 트랙의 믹서 줄에 미터가 있음', (await read(seed.trackId)) !== null);

check('재생 전: 미터가 0', (await read(seed.trackId)).every((v) => v === 0), J(await read(seed.trackId)));

await q(`document.getElementById('btn-stop').click()`);
await sleep(300);
await q(`document.getElementById('btn-play').click()`);
await sleep(2200);
const samples = [];
for (let i = 0; i < 6; i++) { samples.push(await read(seed.trackId)); await sleep(150); }
const flat = samples.flat();
check('재생 중: 좌우 미터가 약 87% (진폭 0.4 = -8dB)', flat.every((v) => v >= 80 && v <= 93), J(samples));
const spread = Math.max.apply(null, flat) - Math.min.apply(null, flat);
check('재생 중: 값이 흉내처럼 흔들리지 않고 안정적 (변동 5% 이내)', spread <= 5, 'spread=' + spread);
await b.shot(OUT + '04_meter_playing.png');

const master = await q(`(()=>{const s=document.querySelector('.sq-strip--master');if(!s)return null;return [...s.querySelectorAll('.sq-meter i')].map(i=>parseFloat(i.style.getPropertyValue('--m'))||0)})()`);
check('마스터 미터도 소리를 보여 줌 (> 50%)', master && master.every((v) => v > 50), J(master));

await q(`document.getElementById('btn-stop').click()`);
await sleep(300);
const after = await read(seed.trackId);
check('정지 직후: 막대가 천천히 내려오는 중 (0 보다 크고 87 보다 작음)', after.every((v) => v > 0 && v < 87), J(after));
await sleep(2200);
const gone = await read(seed.trackId);
check('정지 2초 뒤: 막대가 0 으로 내려감', gone.every((v) => v === 0), J(gone));

const errs = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
check('화면에서 JS 오류가 나지 않음', errs === 0, 'errors=' + errs);

await api(`await m.api.delete('/samples/${seed.sampleId}'); await m.api.delete('/tracks/${seed.trackId}');`);
b.close();
process.exit(summary() ? 0 : 1);
