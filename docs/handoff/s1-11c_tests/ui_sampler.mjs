// S1-11c 화면 시험 — Sampler 카드 경고, 상세 창(Sample 줄, Mode 줄), 저장, MIDI 노트로 실제 소리, WAV 내보내기
// 전제: 시험용 서버 8001 에 최신 코드가 떠 있고, 계정 s109-tester@example.com 과 프로젝트 14431 이 DB 에 있습니다.
// 이 시험은 시험 전용 MIDI 트랙(Sampler 악기 하나)과 샘플 2개(440Hz 2초, 880Hz 1초), 패턴(C4 한 음, 반 박)과 클립을 만들고,
// 끝나면 만든 것을 모두 지웁니다. 프로젝트의 기존 클립은 시험 시작 때 지웁니다(다른 시험과 같은 방식).
// 실행: node docs/handoff/s1-11c_tests/ui_sampler.mjs
import fs from 'node:fs';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-21_s1-11c_sampler/';
const BASE = 'http://localhost:8001';
const PID = '14431';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9582, 1600, 1000);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);
const errs = () => b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
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
const click = async (sel, wait = 350) => {
  const pos = await q(`(()=>{const e=document.querySelector(${J(sel)}); if(!e) return ''; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`);
  if (!pos) return false;
  const r = JSON.parse(pos);
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  }
  await sleep(wait);
  return true;
};
const near = (x, y, tol) => Math.abs(x - y) <= tol;

await b.goto(BASE + '/home.html');
const creds = J({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
const status = await q(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${J(creds)},credentials:'same-origin'});return r.status})()`);
check('시험 계정으로 로그인(200)', status === 200, 'status=' + status);

/* ── 씨앗: 시험 전용 MIDI 트랙 + Sampler(샘플 없음) + 샘플 2개 + 패턴 + 클립 ── */
const seed = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of full.clips) { await m.api.delete('/clips/' + c.clip_id); }
  const old = await m.api.get('/samples?page_size=100');
  for (const sm of (old.items || [])) { if (sm.name.indexOf('s1-11c') === 0) await m.api.delete('/samples/' + sm.sample_id); }
  for (const t of full.tracks) { if (t.name === 'S1-11c Sampler Test') await m.api.delete('/tracks/' + t.track_id); }
  const plugins = (await m.api.get('/plugins?active_only=true')).items;
  const sampler = plugins.filter(p => p.code === 'sampler')[0];
  const track = await m.api.post('/projects/${PID}/tracks', { project_id: ${PID}, name: 'S1-11c Sampler Test', track_type: 'MIDI', order_index: 60 });
  await m.api.patch('/tracks/' + track.track_id, { volume_db: 0 });
  const added = await m.api.post('/tracks/' + track.track_id + '/instruments', { plugin_id: sampler.plugin_id, slot_index: 0 });
  const wavOf = (secs, freq, name) => {
    const sr = 44100, n = Math.round(sr * secs), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * freq * i / sr) * 0.5 * 32767), true);
    const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'audio/wav' }), name);
    return fd;
  };
  const s440 = await m.api.post('/samples', wavOf(2, 440, 's1-11c-sine440.wav'));
  const s880 = await m.api.post('/samples', wavOf(1, 880, 's1-11c-sine880.wav'));
  const pat = await m.api.post('/patterns', { project_id: ${PID}, name: 'S1-11c Sampler Seed', length_tick: 7680 });
  await m.api.put('/patterns/' + pat.pattern_id + '/notes', { notes: [{ pitch: 60, start_tick: 0, length_tick: 960, velocity: 127 }] });
  const clip = await m.api.post('/tracks/' + track.track_id + '/clips', { clip_type: 'MIDI', pattern_id: pat.pattern_id, start_tick: 0, length_tick: 7680 });
  return JSON.stringify({ trackId: track.track_id, instId: added.track_instrument_id, s440: s440.sample_id, s880: s880.sample_id, patternId: pat.pattern_id, clipId: clip.clip_id });
`));
check('시험 씨앗을 만들었음(트랙, Sampler, 샘플 2개, 클립)', !!seed.clipId && !!seed.s440 && !!seed.s880 && !!seed.instId, J(seed));

await nav(`${BASE}/studioNx.html?projectId=${PID}`);
const errs0 = errs();
const ROW = `#tracks > .sq-track[data-track-id="${seed.trackId}"]`;
const CARD = `${ROW} + .sq-acc .sq-fx[data-device-kind="INSTRUMENT"]`;

await q(`window.__peak=async(ms)=>{const m=await import('/static/js/pages/sequencer-audio.js');const s=m.audioSession();if(!s||!s.mixer)return -1;
  if(!window.__an){window.__an=s.mixer.context.createAnalyser();window.__an.fftSize=2048;s.mixer.out.connect(window.__an);}
  const d=new Float32Array(2048);let peak=0;const t0=performance.now();
  while(performance.now()-t0<ms){window.__an.getFloatTimeDomainData(d);for(const x of d)peak=Math.max(peak,Math.abs(x));await new Promise(r=>setTimeout(r,20));}
  return peak;}; 1`);

/* ── 1. 카드: 샘플이 없으면 경고 ── */
check('Sampler 트랙 줄이 있음', !!(await q(`!!document.querySelector(${J(ROW)})`)));
await click(`${ROW} .sq-expand`, 1200);
const card0 = JSON.parse(await q(`(()=>{const c=document.querySelector(${J(CARD)}); if(!c) return JSON.stringify({none:true});
  const s=c.querySelector('.sq-fx__sub'); return JSON.stringify({none:false, name:c.querySelector('.sq-fx__name').textContent, sub:s?s.textContent:'', warn:s?s.classList.contains('is-warn'):false, dashed:c.classList.contains('is-nosample'), knobs:[...c.querySelectorAll('.sq-knob__name')].map(x=>x.textContent)});})()`));
check('Sampler 카드가 보임', !card0.none && card0.name === 'Sampler', J(card0));
check('샘플이 없으면 카드에 "No sample chosen. Notes make no sound." 경고', card0.warn && card0.sub.indexOf('No sample chosen. Notes make no sound.') >= 0, J(card0));
check('경고 카드는 점선(is-nosample)', card0.dashed === true);
check('카드의 핵심 노브는 Gain, Tune, Decay (Sample, Mode 는 노브가 아님)', J(card0.knobs) === J(['Gain', 'Tune', 'Decay']), J(card0.knobs));
await b.shot(OUT + '01_card_no_sample.png');

/* ── 2. 샘플이 없을 때 재생하면 조용함 ── */
await q(`document.getElementById('btn-stop').click()`);
await sleep(300);
await q(`document.getElementById('btn-play').click()`);
await sleep(700);
await q(`window.__peak(10)`);
const peakNone = await q(`window.__peak(500)`);
check('샘플이 없으면 노트를 쳐도 소리가 없음 (피크 < 0.01)', peakNone >= 0 && peakNone < 0.01, 'peak=' + peakNone);
await q(`document.getElementById('btn-stop').click()`);
await sleep(400);

/* ── 3. 상세 창: Sample 줄과 Mode 줄 ── */
await click(`${CARD} .sq-fx__preset`, 700);
const m0 = JSON.parse(await q(`(()=>{const d=document.getElementById('device-modal');
  const cell=(k)=>document.querySelector('#device-params [data-param-cell="'+k+'"]');
  const seg=cell('mode');
  return JSON.stringify({open:!!(d&&d.open), title:document.getElementById('device-title').textContent,
    tabs:[...document.querySelectorAll('#device-tabs button')].map(x=>x.textContent.trim()),
    sampleCell:!!cell('sample_id'), sampleName:cell('sample_id')?cell('sample_id').querySelector('.sq-samp__name').textContent:'',
    chooseBtn:cell('sample_id')?cell('sample_id').querySelector('[data-samp="change"]').textContent:'',
    warn:!!(cell('sample_id')&&cell('sample_id').querySelector('.sq-samp__warn')),
    segButtons:seg?[...seg.querySelectorAll('[data-seg]')].map(x=>x.textContent+':'+x.getAttribute('aria-pressed')):[],
    hint:seg&&seg.querySelector('.sq-segcell__hint')?seg.querySelector('.sq-segcell__hint').textContent:'',
    rootText:cell('root_note')?cell('root_note').querySelector('.sq-knob__val').textContent:'',
    ignored:[...document.querySelectorAll('#device-params .is-ignored')].map(x=>x.dataset.paramCell)});})()`));
check('상세 창이 Sampler 로 열리고 탭은 Sample, Amp Env', m0.open && m0.title === 'Sampler' && J(m0.tabs) === J(['Sample', 'Amp Env']), J(m0));
check('Sample 줄이 있고 "No sample chosen" + Choose… 버튼 + 경고', m0.sampleCell && m0.sampleName === 'No sample chosen' && m0.chooseBtn === 'Choose…' && m0.warn, J(m0));
check('Mode 줄: Classic 이 눌려 있고 Classic 설명이 보임', J(m0.segButtons) === J(['Classic:true', 'One-Shot:false']) && m0.hint.indexOf('Classic:') === 0, J(m0));
check('Root 노브는 노트 이름(C4)으로 보임', m0.rootText === 'C4', m0.rootText);
check('Classic 에서는 흐려진 칸이 없음', m0.ignored.length === 0, J(m0.ignored));
await b.shot(OUT + '02_modal_empty.png');
// 샘플이 없는 상태에서도 끌어 놓을 수 있고, 안내 문구가 보임
const e0 = JSON.parse(await q(`(()=>{
  const cell=document.querySelector('#device-params [data-param-cell="sample_id"]');
  const hint=cell.querySelector('.sq-samp__drophint');
  const dt=new DataTransfer(); dt.setData('application/x-studionx-clip', JSON.stringify({kind:'audio', name:'s1-11c-sine880', length:1, sampleId:'${seed.s880}', patternId:null}));
  cell.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
  const over=cell.classList.contains('is-drop');
  cell.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  const c2=document.querySelector('#device-params [data-param-cell="sample_id"]');
  return JSON.stringify({hint:hint?hint.textContent:'', over:over, name:c2.querySelector('.sq-samp__name').textContent});})()`));
check('샘플이 없을 때 끌어 놓기 안내가 보임', e0.hint.indexOf('Drag a sample here') === 0, J(e0));
check('샘플이 없는 상태에서도 샘플을 끌어 놓으면 그 샘플이 붙음', e0.over && e0.name === 's1-11c-sine880', J(e0));
await click('#device-reset', 600);

/* ── 4. One-Shot 으로 바꾸면 설명이 바뀌고 Loop 가 흐려짐 ── */
await click('#device-params [data-seg="oneshot"]', 400);
const m1 = JSON.parse(await q(`(()=>{const seg=document.querySelector('#device-params [data-param-cell="mode"]');
  return JSON.stringify({segButtons:[...seg.querySelectorAll('[data-seg]')].map(x=>x.textContent+':'+x.getAttribute('aria-pressed')),
    hint:seg.querySelector('.sq-segcell__hint').textContent, ignored:[...document.querySelectorAll('#device-params .is-ignored')].map(x=>x.dataset.paramCell),
    dirty:document.getElementById('device-save').classList.contains('is-dirty'), state:document.getElementById('device-state').textContent});})()`));
check('One-Shot 이 눌리고 설명이 바뀜', J(m1.segButtons) === J(['Classic:false', 'One-Shot:true']) && m1.hint.indexOf('One-Shot:') === 0, J(m1));
check('One-Shot 에서는 Loop 칸이 흐려짐 (Sample 탭의 무시되는 칸)', m1.ignored.indexOf('loop') >= 0, J(m1.ignored));
check('고치면 "Unsaved changes" 로 바뀜', m1.dirty && m1.state === 'Unsaved changes', J(m1));
await click('#device-tabs button[data-group="Amp Env"]', 400);
const ignoredEnv = JSON.parse(await q(`JSON.stringify([...document.querySelectorAll('#device-params .is-ignored')].map(x=>x.dataset.paramCell))`));
check('One-Shot 에서는 Amp Env 의 Sustain 과 Release 가 흐려짐', ignoredEnv.indexOf('sustain') >= 0 && ignoredEnv.indexOf('release') >= 0 && ignoredEnv.indexOf('attack') < 0, J(ignoredEnv));
await click('#device-tabs button[data-group="Sample"]', 400);
await b.shot(OUT + '03_modal_oneshot_nosample.png');

/* ── 5. 샘플 고르기 창 ── */
await click('#device-params [data-samp="change"]', 900);
const p0 = JSON.parse(await q(`(()=>{const pick=document.querySelector('#device-params [data-samp="pick"]');
  const items=[...pick.querySelectorAll('.sq-samp__item')].map(x=>x.querySelector('.sq-samp__iname').textContent);
  return JSON.stringify({open:!pick.hidden, items:items, hasPreview:pick.querySelectorAll('.sq-samp__prev').length});})()`));
check('Choose… 를 누르면 라이브러리 목록이 열림 (시험 샘플 2개 포함)', p0.open && p0.items.indexOf('s1-11c-sine440') >= 0 && p0.items.indexOf('s1-11c-sine880') >= 0, J(p0));
check('목록 줄마다 미리 듣기 버튼이 있음', p0.hasPreview === p0.items.length && p0.items.length >= 2, J(p0));
await b.shot(OUT + '04_picker.png');
await q(`(()=>{const s=document.querySelector('#device-params [data-samp="search"]'); s.value='sine880'; s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await sleep(200);
const p1 = JSON.parse(await q(`JSON.stringify([...document.querySelectorAll('#device-params .sq-samp__item .sq-samp__iname')].map(x=>x.textContent))`));
check('검색하면 이름으로 거름 (sine880 하나)', J(p1) === J(['s1-11c-sine880']), J(p1));
await q(`(()=>{const s=document.querySelector('#device-params [data-samp="search"]'); s.value='sine440'; s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await sleep(200);
await click('#device-params .sq-samp__item', 1200);
const s1 = JSON.parse(await q(`(()=>{const c=document.querySelector('#device-params [data-param-cell="sample_id"]'); const cv=c.querySelector('canvas');
  let painted=0; if(cv){const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; for(let i=3;i<d.length;i+=4) if(d[i]>0) painted++;}
  return JSON.stringify({name:c.querySelector('.sq-samp__name').textContent, meta:c.querySelector('.sq-samp__meta').textContent,
    btn:c.querySelector('[data-samp="change"]').textContent, root:c.querySelector('.sq-samp__root')?c.querySelector('.sq-samp__root').textContent:'',
    warn:!!c.querySelector('.sq-samp__warn'), painted:painted, pickHidden:c.querySelector('[data-samp="pick"]').hidden,
    mode:[...document.querySelectorAll('#device-params [data-seg]')].filter(x=>x.getAttribute('aria-pressed')==='true').map(x=>x.dataset.seg)});})()`));
check('샘플을 고르면 이름이 바뀌고 버튼이 Change… 로, 경고가 사라짐', s1.name === 's1-11c-sine440' && s1.btn === 'Change…' && s1.warn === false, J(s1));
check('샘플 정보 줄: 길이 · 샘플레이트 · 채널', s1.meta.indexOf('0:02') === 0 && s1.meta.indexOf('44.1 kHz') > 0 && s1.meta.indexOf('mono') > 0, s1.meta);
check('파형이 그려지고 Root C4 가 표시됨', s1.painted > 500 && s1.root === 'Root C4', J({ painted: s1.painted, root: s1.root }));
check('샘플을 고른 뒤에도 Mode(One-Shot) 선택이 유지됨', J(s1.mode) === J(['oneshot']), J(s1.mode));
await b.shot(OUT + '05_modal_oneshot_sample.png');

/* ── 6. 저장 → 서버 params ── */
await click('#device-save', 900);
const saved = JSON.parse(await api(`const r = await m.api.get('/tracks/${seed.trackId}/instruments'); return JSON.stringify(r[0].params)`));
check('Save 하면 서버에 sample_id 와 mode 가 저장됨', saved.sample_id === seed.s440 && saved.mode === 'oneshot', J(saved));
const card1 = JSON.parse(await q(`(()=>{const c=document.querySelector(${J(CARD)}); const s=c.querySelector('.sq-fx__sub'); return JSON.stringify({sub:s.textContent, warn:s.classList.contains('is-warn'), dashed:c.classList.contains('is-nosample')});})()`));
check('카드 부제가 "샘플 이름 · One-Shot" 으로 바뀌고 경고가 사라짐', card1.sub === 's1-11c-sine440 · One-Shot' && !card1.warn && !card1.dashed, J(card1));
await click('#device-modal [data-modal="close"]', 400);
await b.shot(OUT + '06_card_with_sample.png');

/* ── 7. MIDI 노트로 실제 소리: One-Shot 은 노트(0.5초)가 끝난 뒤에도 샘플이 끝까지 울림 ── */
const playWindow = async (fromMs, lenMs) => {
  await q(`document.getElementById('btn-stop').click()`);
  await sleep(400);
  await q(`document.getElementById('btn-play').click()`);
  await sleep(fromMs);
  const p = await q(`window.__peak(${lenMs})`);
  await q(`document.getElementById('btn-stop').click()`);
  await sleep(400);
  return p;
};
await q(`window.__peak(10)`);
await playWindow(300, 100);   // 첫 재생(샘플 불러오기)을 지나감
const peakNote = await playWindow(900, 100);
check('샘플이 있으면 노트 시작 직후(0.9~1.0초) 소리가 남 (피크 > 0.05)', peakNote > 0.05, 'peak=' + peakNote);
const peakAfter = await playWindow(1100, 300);
check('One-Shot: 노트(0.5초)가 끝난 뒤(1.1~1.4초)에도 샘플이 이어서 울림 (피크 > 0.05)', peakAfter > 0.05, 'peak=' + peakAfter);
check('피크가 너무 크지 않음 (< 0.6)', peakAfter < 0.6, 'peak=' + peakAfter);
await b.shot(OUT + '07_playing.png');

/* ── 8. 같은 설정을 Classic 으로 바꾸면 노트가 끝난 뒤 조용함 ── */
await api(`await m.api.patch('/tracks/${seed.trackId}/instruments/${seed.instId}', { params: Object.assign({}, (await m.api.get('/tracks/${seed.trackId}/instruments'))[0].params, { mode: 'classic' }) });`);
await nav(`${BASE}/studioNx.html?projectId=${PID}`);
await q(`window.__peak=async(ms)=>{const m=await import('/static/js/pages/sequencer-audio.js');const s=m.audioSession();if(!s||!s.mixer)return -1;
  if(!window.__an){window.__an=s.mixer.context.createAnalyser();window.__an.fftSize=2048;s.mixer.out.connect(window.__an);}
  const d=new Float32Array(2048);let peak=0;const t0=performance.now();
  while(performance.now()-t0<ms){window.__an.getFloatTimeDomainData(d);for(const x of d)peak=Math.max(peak,Math.abs(x));await new Promise(r=>setTimeout(r,20));}
  return peak;}; 1`);
await playWindow(300, 100);
const peakClassicAfter = await playWindow(1300, 300);
check('Classic: 노트(0.5초)가 끝나고 Release 가 지난 뒤(1.3~1.6초)에는 조용함', peakClassicAfter < 0.01, 'peak=' + peakClassicAfter);
const peakClassicDuring = await playWindow(150, 200);
check('Classic: 노트가 울리는 동안(0.15~0.35초)에는 소리가 남', peakClassicDuring > 0.05, 'peak=' + peakClassicDuring);

/* ── 9. WAV 내보내기에 Sampler 소리가 들어감 ── */
const exp = JSON.parse(await q(`(async()=>{
  const a = await import('/static/js/pages/sequencer-audio.js');
  const off = await import('/static/js/audio/offline.js');
  const snap = a.exportSnapshot();
  const out = await off.renderOffline({ tracks: snap.tracks, audioClips: snap.audioClips, midiClips: snap.midiClips, getInstruments: snap.getInstruments, getEffects: snap.getEffects,
    bpm: snap.bpm, tempoChanges: [], startTick: 0, endTick: 3840, tailSec: 0, sampleRate: 44100, loadSampleBytes: snap.loadSampleBytes });
  const sr = out.sampleRate, d = out.channels[0]; let p1 = 0, p2 = 0;
  for (let i = 0; i < Math.floor(0.4 * sr); i++) p1 = Math.max(p1, Math.abs(d[i]));
  for (let i = Math.floor(1.2 * sr); i < Math.floor(1.9 * sr); i++) p2 = Math.max(p2, Math.abs(d[i]));
  return JSON.stringify({ frames: out.frames, p1, p2 });})()`));
check('내보내기(Classic): 노트 구간에는 소리가 있고 끝난 뒤에는 조용함', exp.p1 > 0.05 && exp.p2 < 0.01, J(exp));
await api(`await m.api.patch('/tracks/${seed.trackId}/instruments/${seed.instId}', { params: Object.assign({}, (await m.api.get('/tracks/${seed.trackId}/instruments'))[0].params, { mode: 'oneshot' }) });`);
await nav(`${BASE}/studioNx.html?projectId=${PID}`);
const exp2 = JSON.parse(await q(`(async()=>{
  const a = await import('/static/js/pages/sequencer-audio.js');
  const off = await import('/static/js/audio/offline.js');
  const snap = a.exportSnapshot();
  const out = await off.renderOffline({ tracks: snap.tracks, audioClips: snap.audioClips, midiClips: snap.midiClips, getInstruments: snap.getInstruments, getEffects: snap.getEffects,
    bpm: snap.bpm, tempoChanges: [], startTick: 0, endTick: 3840, tailSec: 0, sampleRate: 44100, loadSampleBytes: snap.loadSampleBytes });
  const sr = out.sampleRate, d = out.channels[0]; let p2 = 0;
  for (let i = Math.floor(1.2 * sr); i < Math.floor(1.9 * sr); i++) p2 = Math.max(p2, Math.abs(d[i]));
  return JSON.stringify({ p2 });})()`));
check('내보내기(One-Shot): 노트가 끝난 뒤에도 샘플이 끝까지 울림', exp2.p2 > 0.05, J(exp2));

/* ── 10. 파형 위로 끌어 놓기 (브라우저의 샘플 줄을 놓는 동작) ── */
// 펼침 상태는 화면이 기억해 두므로(restoreOpenPanels) 닫혀 있을 때만 펼침
if (!(await q(`document.querySelector(${J(ROW)}).classList.contains('is-open')`))) await click(`${ROW} .sq-expand`, 1500);
await click(`${CARD} .sq-fx__preset`, 700);
const dnd =JSON.parse(await q(`(()=>{
  const cell=document.querySelector('#device-params [data-param-cell="sample_id"]');
  const dt=new DataTransfer(); dt.setData('application/x-studionx-clip', JSON.stringify({kind:'audio', name:'s1-11c-sine880', length:1, sampleId:'${seed.s880}', patternId:null}));
  cell.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
  const over=cell.classList.contains('is-drop');
  cell.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  const c2=document.querySelector('#device-params [data-param-cell="sample_id"]');
  return JSON.stringify({over:over, name:c2.querySelector('.sq-samp__name').textContent, dirty:document.getElementById('device-save').classList.contains('is-dirty')});})()`));
check('샘플 줄을 칸 위로 끌면 강조되고, 놓으면 그 샘플로 바뀜(저장 전)', dnd.over && dnd.name === 's1-11c-sine880' && dnd.dirty, J(dnd));
const dnd2 = JSON.parse(await q(`(()=>{
  const cell=document.querySelector('#device-params [data-param-cell="sample_id"]');
  const dt=new DataTransfer(); dt.setData('application/x-studionx-clip', JSON.stringify({kind:'midi', name:'Pattern', length:1, sampleId:null, patternId:'5'}));
  cell.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  return JSON.stringify({name:document.querySelector('#device-params [data-param-cell="sample_id"] .sq-samp__name').textContent});})()`));
check('MIDI 패턴을 놓으면 무시됨 (샘플 그대로)', dnd2.name === 's1-11c-sine880', J(dnd2));
await click('#device-reset', 600);
const afterReset = await q(`document.querySelector('#device-params [data-param-cell="sample_id"] .sq-samp__name').textContent`);
check('Reset 은 기본값(샘플 없음)으로 되돌림', afterReset === 'No sample chosen', afterReset);
await click('#device-modal [data-modal="close"]', 400);

const jsErrors = errs() - errs0;
check('화면 시험 중 JS 예외 0건', jsErrors === 0, 'errors=' + jsErrors);

/* ── 씨앗 지우기 ── */
await api(`await m.api.delete('/clips/${seed.clipId}'); await m.api.delete('/patterns/${seed.patternId}');
  await m.api.delete('/tracks/${seed.trackId}');
  await m.api.delete('/samples/${seed.s440}'); await m.api.delete('/samples/${seed.s880}');`);
b.close();
process.exit(summary() ? 0 : 1);

