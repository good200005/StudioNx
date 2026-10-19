// S1-11a 화면 시험 — 오디오 클립이 실제로 소리가 나고, 트랙 믹서(뮤트 · 솔로)가 소리에 반영되는지
// 전제: 시험용 서버 8001 에 최신 코드가 떠 있고, 계정 s109-tester@example.com 과 프로젝트 14431 이 DB 에 있습니다.
// 이 시험은 8초짜리 440Hz 사인파 WAV 를 업로드하고(API) 오디오 트랙에 클립을 놓은 뒤, ▶ 를 눌러 마스터 출력의 피크를 잽니다.
// 끝나면 만든 것(클립 · 샘플)을 지웁니다.
// 실행: node docs/handoff/s1-11a_tests/ui.mjs
import fs from 'node:fs';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-19_s1-11a_audio_graph/';
const BASE = 'http://localhost:8001';
const PID = '14431';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9561, 1600, 1000);
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

/* ── 1. 로그인 ── */
await b.goto(BASE + '/home.html');
const creds = J({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
const status = await q(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${J(creds)},credentials:'same-origin'});return r.status})()`);
check('시험 계정으로 로그인(200)', status === 200, 'status=' + status);

/* ── 2. 씨앗: 사인파 샘플 올리기 + 오디오 트랙 + 클립 ── */
const seed = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of full.clips) { await m.api.delete('/clips/' + c.clip_id); }
  let audio = full.tracks.filter(t => t.track_type === 'AUDIO')[0];
  if (!audio) audio = await m.api.post('/projects/${PID}/tracks', { name: 'S1-11a Audio', track_type: 'AUDIO' });
  const sr = 44100, n = sr * 8, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 0.5 * 32767), true);
  const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'audio/wav' }), 's1-11a-sine440.wav');
  const sample = await m.api.post('/samples', fd);
  const clip = await m.api.post('/tracks/' + audio.track_id + '/clips', { clip_type: 'AUDIO', sample_id: sample.sample_id, start_tick: 0, length_tick: 3840 * 4 });
  return JSON.stringify({ trackId: audio.track_id, sampleId: sample.sample_id, clipId: clip.clip_id });
`));
check('사인파 샘플 · 오디오 트랙 · 클립을 만들었음', !!seed.sampleId && !!seed.clipId, J(seed));

/* ── 3. 실제 모드로 열기 ── */
await nav(`${BASE}/studioNx.html?projectId=${PID}`);
const hasClip = await q(`!!document.querySelector('.sq-clip--audio[data-sample-id="${seed.sampleId}"]')`);
check('오디오 클립이 화면에 있음', hasClip);
const errs0 = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;

// 마스터 출력의 피크를 재는 도구 (재생 세션의 마스터 게인에 AnalyserNode 를 붙임)
await q(`window.__peak=async(ms)=>{const m=await import('/static/js/pages/sequencer-audio.js');const s=m.audioSession();if(!s||!s.mixer)return -1;
  if(!window.__an){window.__an=s.mixer.context.createAnalyser();window.__an.fftSize=2048;s.mixer.out.connect(window.__an);}
  const d=new Float32Array(2048);let peak=0;const t0=performance.now();
  while(performance.now()-t0<ms){window.__an.getFloatTimeDomainData(d);for(const x of d)peak=Math.max(peak,Math.abs(x));await new Promise(r=>setTimeout(r,20));}
  return peak;}; 1`);

/* ── 4. ▶ 재생 → 소리가 남 ── */
await q(`document.getElementById('btn-stop').click()`);   // 멈춘 상태에서 ■ = 재생선을 곡 처음(0마디)으로
await sleep(300);
await q(`document.getElementById('btn-play').click()`);
await sleep(1500);
await q(`window.__peak(10)`);
const peakPlay = await q(`window.__peak(800)`);
check('재생 중 마스터 출력에 소리가 있음 (피크 > 0.1)', peakPlay > 0.1, 'peak=' + peakPlay);
check('피크가 사인파 진폭 근처 (0.2~0.6)', peakPlay > 0.2 && peakPlay < 0.6, 'peak=' + peakPlay);
await b.shot(OUT + '01_playing.png');

/* ── 5. 트랙 뮤트 → 무음 ── */
const mute = `document.querySelector('.sq-track[data-track-id="${seed.trackId}"] .is-mute').click()`;
await q(mute);
await sleep(500);
const peakMute = await q(`window.__peak(600)`);
check('뮤트하면 소리가 사라짐 (피크 < 0.01)', peakMute < 0.01, 'peak=' + peakMute);
await q(mute);
await sleep(500);
const peakUnmute = await q(`window.__peak(600)`);
check('뮤트 해제하면 소리가 돌아옴', peakUnmute > 0.1, 'peak=' + peakUnmute);

/* ── 6. 다른 트랙을 솔로 → 이 트랙은 무음 ── */
const other = await q(`(()=>{const r=[...document.querySelectorAll('#tracks > .sq-track')].find(x=>x.dataset.trackId!=="${seed.trackId}"&&x.querySelector('.is-solo'));return r?r.dataset.trackId:null})()`);
if (other) {
  const solo = `document.querySelector('.sq-track[data-track-id="${other}"] .is-solo').click()`;
  await q(solo);
  await sleep(500);
  const peakSolo = await q(`window.__peak(600)`);
  check('다른 트랙이 솔로면 이 트랙은 무음', peakSolo < 0.01, 'peak=' + peakSolo);
  await q(solo);
  await sleep(300);
} else check('솔로 시험용 다른 트랙이 있음', false, '다른 트랙이 없음');

/* ── 7. 정지 → 무음 ── */
await q(`document.getElementById('btn-stop').click()`);
await sleep(600);
const peakStop = await q(`window.__peak(500)`);
check('정지하면 소리가 멈춤', peakStop < 0.01, 'peak=' + peakStop);

const errs1 = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
check('화면에서 JS 오류가 나지 않음', errs1 === errs0, 'errors=' + (errs1 - errs0));

/* ── 8. 씨앗 지우기 ── */
await api(`await m.api.delete('/clips/${seed.clipId}'); await m.api.delete('/samples/${seed.sampleId}');`);
b.close();
process.exit(summary() ? 0 : 1);
