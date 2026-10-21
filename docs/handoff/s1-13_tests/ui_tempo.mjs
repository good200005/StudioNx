// S1-13 화면 시험 — 템포 변경점이 서버에서 화면으로 오고, 재생과 WAV 내보내기가 같은 템포 지도를 쓰는지
// 전제: 시험용 서버 8001 에 최신 코드가 떠 있고, 계정 s109-tester@example.com 과 프로젝트 14431 이 DB 에 있습니다.
// 이 시험은 시험 전용 오디오 트랙에 8초 사인파 클립(2마디)을 놓고, 둘째 마디부터 템포를 절반으로 낮춥니다.
// 끝나면 만든 것과 템포 변경점을 모두 지웁니다. 프로젝트의 기존 클립은 시험 시작 때 지웁니다(다른 시험과 같은 방식).
// 실행: node docs/handoff/s1-13_tests/ui_tempo.mjs
import fs from 'node:fs';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-21_s1-13_tempo/';
const BASE = 'http://localhost:8001';
const PID = '14431';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9591, 1600, 1000);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);
const errs = () => b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
const near = (x, y, tol) => Math.abs(x - y) <= tol;
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

/* ── 씨앗: 시험 전용 오디오 트랙 + 8초 사인파 클립(2마디) + 템포 변경점(둘째 마디부터 절반) ── */
const seed = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of full.clips) { await m.api.delete('/clips/' + c.clip_id); }
  const old = await m.api.get('/samples?page_size=100');
  for (const sm of (old.items || [])) { if (sm.name.indexOf('s1-13') === 0) await m.api.delete('/samples/' + sm.sample_id); }
  for (const t of full.tracks) { if (t.name === 'S1-13 Tempo Test') await m.api.delete('/tracks/' + t.track_id); }
  const baseBpm = Number(full.project.bpm);
  const slow = Math.round(baseBpm / 2 * 100) / 100;
  const audio = await m.api.post('/projects/${PID}/tracks', { project_id: ${PID}, name: 'S1-13 Tempo Test', track_type: 'AUDIO', order_index: 70 });
  const sr = 44100, n = sr * 8, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 0.4 * 32767), true);
  const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'audio/wav' }), 's1-13-tempo-sine440.wav');
  const sample = await m.api.post('/samples', fd);
  const clip = await m.api.post('/tracks/' + audio.track_id + '/clips', { clip_type: 'AUDIO', sample_id: sample.sample_id, start_tick: 0, length_tick: 3840 * 2 });
  const put = await m.api.put('/projects/${PID}/tempo-changes', { changes: [{ tick: 3840, bpm: slow, ramp: 'STEP' }] });
  return JSON.stringify({ trackId: audio.track_id, sampleId: sample.sample_id, clipId: clip.clip_id, baseBpm: baseBpm, slow: slow, put: put });
`));
check('시험 씨앗을 만들었음(트랙, 클립, 템포 변경점)', !!seed.clipId && seed.put.total === 1, J(seed));
const B = seed.baseBpm;
const S = seed.slow;
const bar1 = 240 / B;                 // 첫째 마디: 시작 템포
const bar2 = 240 / S;                 // 둘째 마디: 절반 템포라 두 배 길다
const total = bar1 + bar2;
const flatTotal = 2 * bar1;           // 템포 변경을 무시하면 이 길이가 됨

/* ── 1. 서버: /full 이 변경점을 담음 ── */
const full = JSON.parse(await api(`const f = await m.api.get('/projects/${PID}/full'); return JSON.stringify(f.tempo_changes)`));
check('GET /full 의 tempo_changes 에 변경점 한 건 (숫자 bpm)', full.length === 1 && full[0].tick === 3840 && typeof full[0].bpm === 'number' && near(full[0].bpm, S, 0.005), J(full));

/* ── 2. 화면: 템포 지도가 재생과 내보내기에 넘어감 ── */
await nav(`${BASE}/studioNx.html?projectId=${PID}`);
const errs0 = errs();
const snap = JSON.parse(await q(`(async()=>{
  const d = await import('/static/js/pages/sequencer-devices.js');
  const a = await import('/static/js/pages/sequencer-audio.js');
  return JSON.stringify({ play: d.playbackTempoChanges(), exp: a.exportSnapshot().tempoChanges, bpm: a.exportSnapshot().bpm });
})()`));
check('재생이 쓰는 템포 변경점: tick 3840, 절반 템포, STEP', snap.play.length === 1 && snap.play[0].tick === 3840 && near(snap.play[0].bpm, S, 0.005) && snap.play[0].ramp === 'STEP', J(snap.play));
check('내보내기 스냅샷의 템포 변경점이 재생과 같음', J(snap.exp) === J(snap.play), J(snap.exp));
check('시작 템포(상단 BPM)는 프로젝트 값 그대로', near(snap.bpm, B, 0.001), snap.bpm + ' / ' + B);

/* ── 3. 재생: 엔진이 템포 지도로 위치를 셈 ── */
await q(`document.getElementById('btn-stop').click()`);
await sleep(300);
await q(`document.getElementById('btn-play').click()`);
await sleep(4500);
const play = JSON.parse(await q(`(async()=>{
  const a = await import('/static/js/pages/sequencer-audio.js');
  const r = await import('/static/js/pages/sequencer-arrange.js');
  const s = a.audioSession(); const t = s.engine.transport; const e = s.engine.context.currentTime - t.originTime;
  const clock = document.getElementById('time-main').textContent.split(':').map(Number);
  return JSON.stringify({ changes: t.changes, tick: s.positionTick(), elapsed: e, origin: t.originTick, bar: r.getPlayheadBar(), clock: clock[0] * 60 + clock[1] + clock[2] / 1000 });
})()`));
const tickAt = (e) => (e <= bar1 ? e * B * 16 : 3840 + (e - bar1) * S * 16);
check('재생 엔진이 템포 변경점을 받음', play.changes.length === 1 && play.changes[0].tick === 3840, J(play.changes));
check('재생 위치가 템포 지도를 따름 (같은 시간에 시작 템포 그대로라면 훨씬 앞서 있을 위치가 아님)', near(play.tick, tickAt(play.elapsed), 200) && play.tick < play.elapsed * B * 16 - 500, J({ tick: play.tick, expect: tickAt(play.elapsed), flat: play.elapsed * B * 16 }));
// 재생선(화면)도 소리와 같은 위치여야 함. 화면은 곧바로 시작하고 엔진은 샘플을 불러온 뒤 시작해서 조금 앞서므로 0.2마디까지 허용
const flatBar = play.elapsed * B / 240;
check('재생선이 엔진 위치(템포 지도)와 0.2마디 안으로 맞음', near(play.bar, play.tick / 3840, 0.2), J({ bar: play.bar, engine: play.tick / 3840 }));
check('재생선이 시작 템포 그대로라면 있을 위치(' + flatBar.toFixed(2) + '마디)보다 분명히 뒤에 있음', play.bar < flatBar - 0.3, J({ bar: play.bar, flat: flatBar }));
check('상단 시간 표시(#time-main)가 소리의 경과 시간과 0.6초 안으로 맞음', near(play.clock, play.elapsed, 0.6), J({ clock: play.clock, elapsed: play.elapsed }));
check('시간 표시가 시작 템포 하나로 계산한 시간(' + (play.bar * 240 / B).toFixed(2) + '초)과 다름', Math.abs(play.clock - (play.bar * 240 / B)) > 0.5, J({ clock: play.clock, flat: play.bar * 240 / B }));
await q(`document.getElementById('btn-stop').click()`);
await sleep(400);

/* ── 4. 내보내기 창: 길이와 소리가 템포 지도를 따름 ── */
await q(`(() => {
  window.__dl = null;
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { const name = this.download; fetch(this.href).then((r) => r.arrayBuffer()).then((buf) => { window.__dl = { name, buf }; }); return; }
    return orig.call(this);
  };
  window.__info = async () => {
    const d = window.__dl; if (!d) return null;
    const v = new DataView(d.buf); const sr = v.getUint32(24, true);
    const ctx = new OfflineAudioContext(2, 1, sr); const buf = await ctx.decodeAudioData(d.buf.slice(0)); const a = buf.getChannelData(0);
    const peak = (t0, t1) => { let p = 0; for (let i = Math.floor(t0 * sr); i < Math.min(a.length, Math.floor(t1 * sr)); i++) p = Math.max(p, Math.abs(a[i])); return p; };
    return { sr, dur: buf.duration, frames: buf.length, p1: peak(0.2, ${bar1} - 0.1), p2: peak(${bar1} + 0.1, ${total} - 0.05) };
  };
  window.__waitDone = async (ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (!document.getElementById('ex-done').hidden) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
})()`);
await q(`document.querySelector('.sq-shortcuts button[title^="Export"]').click()`);
await sleep(600);
const len = await q(`document.getElementById('ex-len-all').textContent`);
const lenSec = Number((String(len).match(/(\d+):(\d+)/) || [0, 0, 0]).slice(1).reduce((m, s) => m * 60 + Number(s), 0));
check('창이 보여 주는 전체 길이가 템포 지도 기준 (' + total.toFixed(1) + '초 근처, 변경을 무시하면 ' + flatTotal.toFixed(1) + '초)', Math.abs(lenSec - total) < 1 && Math.abs(lenSec - flatTotal) > 1.5, len + ' / 기대 ' + total.toFixed(2) + ' / 무시하면 ' + flatTotal.toFixed(2));
await q(`(()=>{const el=document.getElementById('ex-tail'); el.value='0'; el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await sleep(200);
await b.shot(OUT + '01_export_form.png');
await q(`document.getElementById('ex-go').click()`);
const done = await q('window.__waitDone(20000)');
check('내보내기가 완료 화면까지 감', done === true);
await q(`document.getElementById('ex-download').click()`);
await sleep(900);
const info = JSON.parse(await q(`(async()=>JSON.stringify(await window.__info()))()`));
check('파일 길이 = 템포 지도의 길이 (' + total.toFixed(2) + '초)', info && near(info.dur, total, 0.03), info && info.dur + ' / 기대 ' + total.toFixed(2));
check('파일 길이가 변경을 무시한 길이(' + flatTotal.toFixed(2) + '초)와 분명히 다름', info && Math.abs(info.dur - flatTotal) > 1.5, info && info.dur);
check('첫째 마디에 소리 (피크가 0.4)', info && near(info.p1, 0.4, 0.03), info && info.p1);
check('느려진 둘째 마디 끝(' + total.toFixed(1) + '초 직전)까지 소리가 이어짐', info && near(info.p2, 0.4, 0.03), info && info.p2);
await b.shot(OUT + '02_export_done.png');

const jsErrors = errs() - errs0;
check('화면 시험 중 JS 예외 0건', jsErrors === 0, 'errors=' + jsErrors);

/* ── 씨앗 지우기 ── */
await api(`await m.api.delete('/clips/${seed.clipId}'); await m.api.delete('/tracks/${seed.trackId}'); await m.api.delete('/samples/${seed.sampleId}');
  await m.api.put('/projects/${PID}/tempo-changes', { changes: [] });`);
const after = JSON.parse(await api(`const f = await m.api.get('/projects/${PID}/tempo-changes'); return JSON.stringify(f)`));
check('시험이 만든 템포 변경점을 모두 지웠음', after.total === 0, J(after));
b.close();
process.exit(summary() ? 0 : 1);
