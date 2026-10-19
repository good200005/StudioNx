// S1-11a 화면 시험 — MIDI 노트가 Subtractive Synth 로 실제 소리가 나는지 (4단계)
// 전제: 시험용 서버 8001 에 최신 코드가 떠 있고, 계정 s109-tester@example.com 과 프로젝트 14431 이 DB 에 있습니다.
// 이 시험은 패턴(A4 노트 하나)과 MIDI 클립을 만들고(API), ▶ 를 눌러 마스터 출력의 피크를 잽니다.
// 끝나면 만든 것(클립 · 패턴 · 이 시험이 붙인 악기)을 지우고 트랙 볼륨을 되돌립니다.
// 실행: node docs/handoff/s1-11a_tests/ui_midi.mjs
import fs from 'node:fs';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-19_s1-11a_audio_graph/';
const BASE = 'http://localhost:8001';
const PID = '14431';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9562, 1600, 1000);
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

/* ── 씨앗: MIDI 트랙에 Synth 가 없으면 붙이고, 패턴(A4 한 음, 길게)과 MIDI 클립을 만듦 ── */
const seed = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of full.clips) { await m.api.delete('/clips/' + c.clip_id); }
  const plugins = (await m.api.get('/plugins?active_only=true')).items;
  const synth = plugins.filter(p => p.code === 'synth_sub')[0];
  const midi = full.tracks.filter(t => t.track_type === 'MIDI')[0];
  // 시험은 늘 기본값의 새 Synth 를 한 층 더 붙이고, 트랙 볼륨을 0dB 로 맞춥니다 (끝나면 되돌림)
  const added = await m.api.post('/tracks/' + midi.track_id + '/instruments', { plugin_id: synth.plugin_id, slot_index: 100 });
  const oldVolume = Number(midi.volume_db);
  await m.api.patch('/tracks/' + midi.track_id, { volume_db: 0 });
  const pat = await m.api.post('/patterns', { project_id: ${PID}, name: 'S1-11a Synth Seed', length_tick: 7680 });
  await m.api.put('/patterns/' + pat.pattern_id + '/notes', { notes: [{ pitch: 69, start_tick: 0, length_tick: 7680, velocity: 100 }] });
  const clip = await m.api.post('/tracks/' + midi.track_id + '/clips', { clip_type: 'MIDI', pattern_id: pat.pattern_id, start_tick: 0, length_tick: 7680 });
  return JSON.stringify({ trackId: midi.track_id, patternId: pat.pattern_id, clipId: clip.clip_id, addedId: added.track_instrument_id, oldVolume: oldVolume });
`));
check('MIDI 클립(A4 한 음)을 만들었음', !!seed.clipId, J(seed));

await nav(`${BASE}/studioNx.html?projectId=${PID}`);
const errs0 = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;

await q(`window.__peak=async(ms)=>{const m=await import('/static/js/pages/sequencer-audio.js');const s=m.audioSession();if(!s||!s.mixer)return -1;
  if(!window.__an){window.__an=s.mixer.context.createAnalyser();window.__an.fftSize=2048;s.mixer.out.connect(window.__an);}
  const d=new Float32Array(2048);let peak=0;const t0=performance.now();
  while(performance.now()-t0<ms){window.__an.getFloatTimeDomainData(d);for(const x of d)peak=Math.max(peak,Math.abs(x));await new Promise(r=>setTimeout(r,20));}
  return peak;}; 1`);

/* ── ▶ 재생 (재생선을 0마디로 되돌린 뒤) ── */
await q(`document.getElementById('btn-stop').click()`);
await sleep(300);
await q(`document.getElementById('btn-play').click()`);
await sleep(1000);
await q(`window.__peak(10)`);
const peakPlay = await q(`window.__peak(600)`);
check('MIDI 노트가 소리로 나옴 (피크 > 0.05)', peakPlay > 0.05, 'peak=' + peakPlay);
check('피크가 너무 크지 않음 (< 0.5)', peakPlay < 0.5, 'peak=' + peakPlay);
await b.shot(OUT + '02_midi_playing.png');

/* ── 트랙 뮤트 → 무음 ── */
const mute = `document.querySelector('.sq-track[data-track-id="${seed.trackId}"] .is-mute').click()`;
await q(mute);
await sleep(500);
const peakMute = await q(`window.__peak(500)`);
check('MIDI 트랙을 뮤트하면 무음 (피크 < 0.01)', peakMute < 0.01, 'peak=' + peakMute);
await q(mute);
await sleep(500);
const peakUnmute = await q(`window.__peak(500)`);
check('뮤트 해제하면 소리가 돌아옴', peakUnmute > 0.05, 'peak=' + peakUnmute);

/* ── 정지 → 무음 ── */
await q(`document.getElementById('btn-stop').click()`);
await sleep(700);
const peakStop = await q(`window.__peak(500)`);
check('정지하면 소리가 멈춤', peakStop < 0.01, 'peak=' + peakStop);

const errs1 = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
check('화면에서 JS 오류가 나지 않음', errs1 === errs0, 'errors=' + (errs1 - errs0));

/* ── 씨앗 지우기 ── */
await api(`await m.api.delete('/clips/${seed.clipId}'); await m.api.delete('/patterns/${seed.patternId}');
  await m.api.delete('/tracks/${seed.trackId}/instruments/${seed.addedId}');
  await m.api.patch('/tracks/${seed.trackId}', { volume_db: ${seed.oldVolume} });`);
b.close();
process.exit(summary() ? 0 : 1);
