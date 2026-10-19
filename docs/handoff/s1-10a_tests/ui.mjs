// S1-10a 화면 시험 — Connect to Another 저장(FR-2197) · 타임라인 클립 · 패턴 저장(FR-2196)
// 전제: 시험용 서버 8001 에 최신 코드가 떠 있고, 계정 s109-tester@example.com 과
//       프로젝트 "S1-09 UI Test" (project_id 14431) 가 DB 에 있습니다.
// 이 시험은 스스로 패턴을 하나 만들고(API), 화면에서 클립을 놓아 저장되는지 본 뒤,
// 연결 한 건을 저장했다가, 마지막에 만든 것(클립 · 연결 · 패턴)을 모두 지워 되돌립니다.
// 실행: node docs/handoff/s1-10a_tests/ui.mjs
import fs from 'node:fs';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-19_s1-10a_clips_connections/';
const BASE = 'http://localhost:8001';
const PID = '14431';
const SEED = 'S1-10a Seed';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9541, 1600, 1000);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);

// 로그인 뒤 화면이 dirty 이면 beforeunload 가 뜨고 Page.navigate 가 멈춥니다 → 뜨면 바로 닫습니다
const nav = async (url) => {
  const before = b.events.length;
  const p = b.send('Page.navigate', { url });
  let done = false; p.then(() => { done = true; });
  for (let i = 0; i < 80 && !done; i++) {
    await sleep(150);
    if (b.events.slice(before).some((e) => e.method === 'Page.javascriptDialogOpening')) {
      await b.send('Page.handleJavaScriptDialog', { accept: true });
    }
  }
  await sleep(2500);
};

/* ── 1. 로그인 ─────────────────────────────────────────────── */
await b.goto(BASE + '/home.html');
const creds = J({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
const status = await q(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${J(creds)},credentials:'same-origin'});return r.status})()`);
check('시험 계정으로 로그인(200)', status === 200, 'status=' + status);

/* ── 2. 지난 시험 찌꺼기 지우기 → 씨앗 만들기 ─────────────────── */
const seed = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of full.clips) { await m.api.delete('/clips/' + c.clip_id); }
  for (const t of full.tracks) { if ((t.connections || []).length) await m.api.delete('/tracks/' + t.track_id + '/connection'); }
  for (const p of full.patterns) { if (p.name === ${J(SEED)}) await m.api.delete('/patterns/' + p.pattern_id); }
  const now = await m.api.get('/projects/${PID}/full');
  const midi = now.tracks.filter(t => t.track_type === 'MIDI')[0];
  const other = now.tracks.filter(t => t.track_type !== 'MASTER' && t.track_id !== midi.track_id)[0];
  const pat = await m.api.post('/patterns', { project_id: ${PID}, name: ${J(SEED)}, length_tick: 3840 });
  return JSON.stringify({ midiId: midi.track_id, midiNum: midi.order_index + 1, otherId: other.track_id, otherName: other.name, otherNum: other.order_index + 1, patternId: pat.pattern_id });
`));
check('찌꺼기를 지우고 시험용 MIDI 트랙 · 대상 트랙을 찾음', !!seed.midiId && !!seed.otherId, J(seed));
check('시험용 패턴을 만들었음', !!seed.patternId, J(seed));

/* ── 3. 실제 모드로 열기 ───────────────────────────────────── */
await nav(`${BASE}/studioNx.html?projectId=${PID}`);
const errs0 = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;

const listed = await q(`(()=>{const li=document.querySelector('#pattern-list li.sq-pattern[data-pattern-id="${seed.patternId}"]'); return li?li.dataset.patternId:''})()`);
check('씨앗 패턴이 왼쪽 목록에 보임', String(listed) === String(seed.patternId), 'listed=' + listed);

/* ── 4. 목록에서 패턴을 끌어 MIDI 트랙에 놓기 → 클립 저장 ─────── */
// arrange 의 initListDrop 은 dragstart 의 클로저 값을 씁니다 → dragstart → dragover → drop 순서로 흉내 냅니다
const dropped = await q(`(()=>{
  const li=document.querySelector('#pattern-list li.sq-pattern[data-pattern-id="${seed.patternId}"]');
  const lane=document.querySelector('#tracks > .sq-track[data-track-id="${seed.midiId}"] .sq-track__lane');
  if(!li||!lane) return JSON.stringify({ok:false, no:!li?'li':'lane'});
  const dt=new DataTransfer();
  li.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));
  const r=lane.getBoundingClientRect();
  const x=r.left+30, y=r.top+r.height/2;
  lane.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:x,clientY:y}));
  lane.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:x,clientY:y}));
  return JSON.stringify({ok:true});
})()`);
check('패턴을 트랙 레인에 끌어 놓음', JSON.parse(dropped).ok === true, dropped);
await sleep(1500);

const clipEl = JSON.parse(await q(`(()=>{
  const c=document.querySelector('#tracks > .sq-track[data-track-id="${seed.midiId}"] .sq-clip[data-pattern-id="${seed.patternId}"]');
  return JSON.stringify({ found:!!c, clipId:c?c.dataset.clipId:null, patternId:c?c.dataset.patternId:null });
})()`));
check('화면에 시험용 클립이 생기고 서버 번호가 붙음', clipEl.found && !!clipEl.clipId && String(clipEl.patternId) === String(seed.patternId), J(clipEl));

const clipSrv = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  const c = (full.clips||[]).filter(x => x.track_id === ${seed.midiId} && String(x.pattern_id) === ${J(String(seed.patternId))})[0];
  return JSON.stringify({ clipId:c?c.clip_id:null, patternId:c?c.pattern_id:null, start:c?c.start_tick:null });
`));
check('서버에 클립이 저장됨(POST /tracks/{id}/clips)', !!clipSrv.clipId && String(clipSrv.patternId) === String(seed.patternId), J(clipSrv));
await b.shot(OUT + '01_clip_created.png');

/* ── 5. Connect to Another 저장 (FR-2197) ───────────────────── */
await q(`(()=>{const row=document.querySelector('#tracks > .sq-track[data-track-id="${seed.midiId}"]'); const b=row&&row.querySelector('.sq-expand'); if(b) b.click(); return true})()`);
await sleep(1500);

const connSet = await q(`(()=>{
  const row=document.querySelector('#tracks > .sq-track[data-track-id="${seed.midiId}"]');
  const acc=row&&row.nextElementSibling;
  const route=acc&&acc.querySelector('.sq-route');
  if(!route) return JSON.stringify({ok:false});
  const type=route.querySelector('.sq-route__type');
  const num=route.querySelector('.sq-route__track');
  const plug=route.querySelector('.sq-route__plugin');
  type.value='connected';
  type.dispatchEvent(new Event('change',{bubbles:true}));
  num.value=${J(String(seed.otherNum))};
  num.dispatchEvent(new Event('input',{bubbles:true}));
  plug.value='instruments';
  plug.dispatchEvent(new Event('change',{bubbles:true}));
  return JSON.stringify({ok:true});
})()`);
check('Connect 칸에서 Connected · 대상 트랙 선택', JSON.parse(connSet).ok === true, connSet);
await sleep(1500);

const connSrv = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  const t = full.tracks.filter(x => x.track_id === ${seed.midiId})[0];
  const c = t && (t.connections||[])[0];
  return JSON.stringify({ has:!!c, to:c?c.to_track_id:null, target:c?c.target:null });
`));
check('서버에 연결이 저장됨(PUT /tracks/{id}/connection)', connSrv.has && connSrv.to === seed.otherId && connSrv.target === 'INSTRUMENTS', J(connSrv));

const badge = await q(`(()=>{const s=document.querySelector('#tracks > .sq-track[data-track-id="${seed.midiId}"] .sq-track__name small'); return s?s.innerHTML:''})()`);
check('트랙 이름 줄에 →N 연결 표시가 붙음', String(badge).indexOf('→') >= 0, badge);
await b.shot(OUT + '02_connection_saved.png');

/* ── 6. 새로 열어도 남아 있는지 (dirty 를 먼저 지워 beforeunload 회피) ── */
await q(`(async()=>{const m=await import('/static/js/pages/sequencer-save.js'); await m.saveNow('menu'); return m.isDirty()})()`);
await nav(`${BASE}/studioNx.html?projectId=${PID}`);
const after = JSON.parse(await q(`(()=>{
  const c=document.querySelector('#tracks > .sq-track[data-track-id="${seed.midiId}"] .sq-clip[data-pattern-id="${seed.patternId}"]');
  const s=document.querySelector('#tracks > .sq-track[data-track-id="${seed.midiId}"] .sq-track__name small');
  return JSON.stringify({ clip:!!c, clipId:c?c.dataset.clipId:null, badge:s?s.innerHTML:'' });
})()`));
check('다시 열어도 클립이 남아 있음', after.clip && !!after.clipId, J(after));
check('다시 열어도 연결 표시가 남아 있음', String(after.badge).indexOf('→') >= 0, after.badge);
const errs1 = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
check('여기까지 자바스크립트 오류 없음', errs1 === errs0, String(errs1 - errs0));
await b.shot(OUT + '03_reloaded.png');

/* ── 7. 정리 — 만든 클립 · 연결 · 패턴을 지움 ─────────────────── */
const cleaned = await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of (full.clips||[]).filter(x => x.track_id === ${seed.midiId})) { await m.api.delete('/clips/' + c.clip_id); }
  for (const t of full.tracks) { if ((t.connections||[]).length) await m.api.delete('/tracks/' + t.track_id + '/connection'); }
  for (const p of full.patterns) { if (p.name === ${J(SEED)}) await m.api.delete('/patterns/' + p.pattern_id); }
  const after = await m.api.get('/projects/${PID}/full');
  return JSON.stringify({ clips: (after.clips||[]).filter(x=>x.track_id===${seed.midiId}).length, conns: after.tracks.filter(x=>x.track_id===${seed.midiId})[0].connections.length, seeds: after.patterns.filter(p=>p.name===${J(SEED)}).length });
`);
const c7 = JSON.parse(cleaned);
check('정리 후 클립 · 연결 · 시험용 패턴이 없음', c7.clips === 0 && c7.conns === 0 && c7.seeds === 0, cleaned);

b.close();
summary();
