// S1-11b 화면 시험 — 시퀀서 화면에서 내보내기 창을 열어 WAV 를 만들고, 내려받은 파일을 브라우저가 다시 읽어 소리를 숫자로 확인합니다.
// 전제: 시험용 서버 8001 에 최신 코드가 떠 있고, 계정 s109-tester@example.com 과 프로젝트 14431 이 DB 에 있습니다.
// 시험용 오디오 트랙에 8초 사인파(440Hz, 진폭 0.4) 클립 두 개(1~2마디, 5~6마디)를 놓고 시작하며, 끝나면 만든 것을 모두 지웁니다.
// 파일 내려받기는 가로채서(a.click) 바이트를 페이지 안에서 분석합니다 (실제 다운로드 폴더는 건드리지 않음).
// 실행: node docs/handoff/s1-11b_tests/ui_export.mjs
import fs from 'node:fs';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-20_s1-11b_wav_export/';
const BASE = 'http://localhost:8001';
const PID = '14431';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9572, 1600, 1000);
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
const near = (x, y, tol) => Math.abs(x - y) <= tol;

await b.goto(BASE + '/home.html');
const creds = J({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
const status = await q(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${J(creds)},credentials:'same-origin'});return r.status})()`);
check('시험 계정으로 로그인(200)', status === 200, 'status=' + status);

/* ── 씨앗: 시험 전용 오디오 트랙 + 8초 사인파 클립 2개 ── */
const seed = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of full.clips) { await m.api.delete('/clips/' + c.clip_id); }
  const old = await m.api.get('/samples?page_size=100');
  for (const sm of (old.items || [])) { if (sm.name.indexOf('s1-11b') === 0) await m.api.delete('/samples/' + sm.sample_id); }
  for (const t of full.tracks) { if (t.name === 'S1-11b Export Test') await m.api.delete('/tracks/' + t.track_id); }
  const audio = await m.api.post('/projects/${PID}/tracks', { project_id: ${PID}, name: 'S1-11b Export Test', track_type: 'AUDIO', order_index: 50 });
  const sr = 44100, n = sr * 8, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 0.4 * 32767), true);
  const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'audio/wav' }), 's1-11b-export-sine440.wav');
  const sample = await m.api.post('/samples', fd);
  const c1 = await m.api.post('/tracks/' + audio.track_id + '/clips', { clip_type: 'AUDIO', sample_id: sample.sample_id, start_tick: 0, length_tick: 3840 * 2 });
  const c2 = await m.api.post('/tracks/' + audio.track_id + '/clips', { clip_type: 'AUDIO', sample_id: sample.sample_id, start_tick: 3840 * 4, length_tick: 3840 * 2 });
  return JSON.stringify({ trackId: audio.track_id, sampleId: sample.sample_id, c1: c1.clip_id, c2: c2.clip_id });
`));
check('사인파 클립 2개를 만들었음', !!seed.c1 && !!seed.c2, J(seed));

await nav(`${BASE}/studioNx.html?projectId=${PID}`);

/* ── 페이지 안 도우미: 내려받기 가로채기, 파일 분석 ── */
await q(`(() => {
  window.__dl = null;
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { const name = this.download; fetch(this.href).then((r) => r.arrayBuffer()).then((buf) => { window.__dl = { name, buf }; }); return; }
    return orig.call(this);
  };
  const realFetch = window.fetch.bind(window);
  window.__slow = 0;
  window.fetch = async (u, o) => { if (window.__slow && String(u).indexOf('blob:') === 0) await new Promise((r) => setTimeout(r, window.__slow)); return realFetch(u, o); };
  window.__bpm = parseFloat(document.getElementById('bpm').textContent) || 120;
  window.__barSec = 240 / window.__bpm;
  window.__info = async () => {
    const d = window.__dl; if (!d) return null;
    const v = new DataView(d.buf);
    const hdr = { riff: String.fromCharCode(...new Uint8Array(d.buf, 0, 4)), fmt: v.getUint16(20, true), ch: v.getUint16(22, true), sr: v.getUint32(24, true), bits: v.getUint16(34, true), bytes: d.buf.byteLength, name: d.name };
    const ctx = new OfflineAudioContext(2, 1, hdr.sr);
    const buf = await ctx.decodeAudioData(d.buf.slice(0));
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const a = buf.getChannelData(c); for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i])); }
    return Object.assign(hdr, { dur: buf.duration, frames: buf.length, peak: peak });
  };
  window.__peakAt = async (t0, t1) => {
    const d = window.__dl; const v = new DataView(d.buf); const sr = v.getUint32(24, true);
    const ctx = new OfflineAudioContext(2, 1, sr); const buf = await ctx.decodeAudioData(d.buf.slice(0)); const a = buf.getChannelData(0); let p = 0;
    for (let i = Math.floor(t0 * sr); i < Math.min(a.length, Math.floor(t1 * sr)); i++) p = Math.max(p, Math.abs(a[i])); return p;
  };
  window.__open = () => document.querySelector('.sq-shortcuts button[title^="Export"]').click();
  window.__set = (id, v) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  window.__waitDone = async (ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (!document.getElementById('ex-done').hidden) return true; if (!document.getElementById('ex-form').hidden && performance.now() - t0 > 500) return false; await new Promise((r) => setTimeout(r, 50)); } return false; };
  return 1;
})()`);
const bpm = await q('window.__bpm');
const barSec = 240 / bpm;
const info = async () => JSON.parse(await q(`(async()=>{const i=await window.__info(); return JSON.stringify(i ? {riff:i.riff,fmt:i.fmt,ch:i.ch,sr:i.sr,bits:i.bits,bytes:i.bytes,name:i.name,dur:i.dur,frames:i.frames,peak:i.peak} : null)})()`));
const peakAt = (t0, t1) => q(`window.__peakAt(${t0}, ${t1})`);

/* ── 1. ⤓ 버튼으로 창 열기, 기본 화면 ── */
await q('window.__open()');
await sleep(500);
check('⤓ 버튼이 내보내기 창을 엶', await q(`document.getElementById('export-modal').open`) === true);
const view = JSON.parse(await q(`JSON.stringify({
  all: document.getElementById('ex-len-all').textContent, loop: document.getElementById('ex-len-loop').textContent,
  sel: document.getElementById('ex-len-selected').textContent, loopOff: document.getElementById('ex-opt-loop').classList.contains('is-off'),
  selOff: document.getElementById('ex-opt-selected').classList.contains('is-off'), file: document.getElementById('ex-file').value,
  title: document.body.dataset.projectTitle, rate: document.querySelector('#ex-rate .is-on').dataset.rate, depth: document.querySelector('#ex-depth .is-on').dataset.depth,
  go: document.getElementById('ex-go').disabled, sumFmt: document.getElementById('ex-sum-fmt').textContent, mode: document.querySelector('input[name=ex-range]:checked').value })`));
check('전체 범위: 1~6마디, 길이 6마디 분량', view.all.indexOf('bar 1 – 6') === 0, view.all);
check('루프가 없으면 Loop region 이 꺼져 있음', view.loopOff === true && view.loop === 'No loop region', view.loop);
check('클립을 고르지 않았으면 Selected clips 가 꺼져 있음', view.selOff === true, view.sel);
check('범위는 전체로 시작', view.mode === 'all');
check('파일명 기본값: {프로젝트명}_{YYYYMMDD_HHmm}', new RegExp('^' + view.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '_\\d{8}_\\d{4}$').test(view.file), J(view));
const projRate = Number(await q('document.body.dataset.sampleRate')) === 48000 ? 48000 : 44100;
check('기본 형식: 16-bit 스테레오, 샘플레이트는 프로젝트(' + projRate + ')를 따름', view.depth === '16' && view.sumFmt.indexOf('16-bit stereo') > 0 && Number(view.rate) === projRate, J(view));
check('내보내기 버튼이 켜져 있음', view.go === false);
await q(`window.__set('ex-tail', 0)`);
await sleep(200);
await b.shot(OUT + '01_export_form.png');

/* ── 2. 기본값으로 내보내기: 16bit, 44.1kHz, 전체, 꼬리 0 ── */
await q(`document.getElementById('ex-go').click()`);
const done1 = await q('window.__waitDone(15000)');
check('내보내기가 완료 화면까지 감', done1 === true);
await b.shot(OUT + '03_export_done.png');
const doneText = JSON.parse(await q(`JSON.stringify({ name: document.getElementById('ex-done-name').textContent, meta: document.getElementById('ex-done-meta').textContent, note: document.getElementById('ex-done-note').textContent })`));
check('완료 화면: 파일명이 .wav 로 끝남', /\.wav$/.test(doneText.name), doneText.name);
check('완료 화면: 피크가 표시됨', /^Peak -?\d/.test(doneText.note), doneText.note);
await q(`document.getElementById('ex-download').click()`);
await sleep(800);
let f = await info();
check('내려받은 파일: RIFF, PCM, 스테레오, ' + projRate + 'Hz, 16bit', f && f.riff === 'RIFF' && f.fmt === 1 && f.ch === 2 && f.sr === projRate && f.bits === 16, J(f));
check('내려받은 파일 이름 = 화면의 이름', f && f.name === doneText.name, f && f.name);
check('길이: 6마디 (' + (6 * barSec).toFixed(2) + '초)', f && near(f.dur, 6 * barSec, 0.02), f && f.dur);
check('소리: 1~2마디(클립 1)에 소리, 피크가 0.4', near(await peakAt(0.2, 2 * barSec - 0.2), 0.4, 0.03), await peakAt(0.2, 2 * barSec - 0.2));
check('소리: 3~4마디(빈 구간)는 무음', (await peakAt(2 * barSec + 0.1, 4 * barSec - 0.1)) < 0.001);
check('소리: 5~6마디(클립 2)에 소리', near(await peakAt(4 * barSec + 0.2, 6 * barSec - 0.2), 0.4, 0.03));
await q(`document.getElementById('ex-close').click()`);
await sleep(300);
check('닫기 버튼이 창을 닫음', await q(`document.getElementById('export-modal').open`) === false);

/* ── 3. 옵션: 24bit + 48kHz + 정규화(-0.3) + 꼬리 1초 ── */
await q(`window.__dl = null; window.__open()`);
await sleep(400);
await q(`document.querySelector('#ex-rate [data-rate="48000"]').click(); document.querySelector('#ex-depth [data-depth="24"]').click(); const n = document.getElementById('ex-norm'); n.checked = true; n.dispatchEvent(new Event('change', { bubbles: true })); window.__set('ex-tail', 1); window.__set('ex-file', 'My Test/Song')`);
await sleep(300);
const sum2 = JSON.parse(await q(`JSON.stringify({ fmt: document.getElementById('ex-sum-fmt').textContent, len: document.getElementById('ex-sum-len').textContent, normOff: document.getElementById('ex-norm-db').disabled })`));
check('요약 줄이 선택을 따라 바뀜 (48 kHz, 24-bit)', sum2.fmt.indexOf('48 kHz') > 0 && sum2.fmt.indexOf('24-bit') > 0, sum2.fmt);
check('정규화를 켜면 dBFS 칸이 풀림', sum2.normOff === false);
await b.shot(OUT + '02_export_options.png');
await q(`document.getElementById('ex-go').click()`);
await q('window.__waitDone(15000)');
await q(`document.getElementById('ex-download').click()`);
await sleep(800);
f = await info();
check('옵션 반영: 48kHz, 24bit', f && f.sr === 48000 && f.bits === 24, J(f));
check('옵션 반영: 길이 = 6마디 + 꼬리 1초', f && near(f.dur, 6 * barSec + 1, 0.02), f && f.dur);
check('옵션 반영: 정규화로 피크가 -0.3dBFS (0.966)', f && near(f.peak, Math.pow(10, -0.3 / 20), 0.003), f && f.peak);
check('파일명의 금지 글자(/)가 _ 로 바뀜', f && f.name === 'My Test_Song.wav', f && f.name);
await q(`document.getElementById('ex-close').click()`);
await sleep(300);

/* ── 4. 선택한 클립만 (클립 2) ── */
await q(`window.__dl = null; document.querySelectorAll('.sq-clip--audio')[1].classList.add('is-selected')`);
await q('window.__open()');
await sleep(400);
const selView = JSON.parse(await q(`JSON.stringify({ off: document.getElementById('ex-opt-selected').classList.contains('is-off'), text: document.getElementById('ex-len-selected').textContent })`));
check('클립을 선택하면 Selected clips 가 켜지고 범위를 보여 줌', selView.off === false && selView.text.indexOf('1 clip · bar 5 – 6') === 0, selView.text);
await q(`{ const r = document.querySelector('input[name=ex-range][value=selected]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } window.__set('ex-tail', 0)`);
await sleep(300);
check('Selected clips 를 고르면 안내 문구가 보임', await q(`document.getElementById('ex-selected-note').hidden`) === false);
await b.shot(OUT + '04_export_selected.png');
await q(`document.getElementById('ex-go').click()`);
await q('window.__waitDone(15000)');
await q(`document.getElementById('ex-download').click()`);
await sleep(800);
f = await info();
check('선택 클립 내보내기: 길이 2마디', f && near(f.dur, 2 * barSec, 0.02), f && f.dur);
const selPk = await peakAt(0.1, 2 * barSec - 0.1);
// 3번 단계에서 켠 정규화를 창이 기억하므로 피크는 0.4 가 아니라 -0.3dBFS(0.966) 입니다 (기억 기능의 확인을 겸함)
check('선택 클립 내보내기: 처음부터 소리가 남 (정규화 기억: 0.966)', near(selPk, 0.966, 0.01), 'peak=' + selPk);
await q(`document.getElementById('ex-close').click()`);
await q(`document.querySelectorAll('.sq-clip--audio')[1].classList.remove('is-selected')`);

/* ── 5. 루프 구간 (3~4마디: 빈 구간) 과 직접 지정 (5~6마디) ── */
await q(`(async()=>{const m=await import('/static/js/pages/sequencer-arrange.js'); m.setLoop({ on: true, start: 4, length: 2 }); window.__dl = null;})()`);
await q('window.__open()');
await sleep(400);
const loopView = await q(`document.getElementById('ex-len-loop').textContent`);
check('루프를 켜면 Loop region 이 켜지고 범위를 보여 줌 (5~6마디)', loopView.indexOf('bar 5 – 6') === 0, loopView);
await q(`{ const r = document.querySelector('input[name=ex-range][value=loop]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } window.__set('ex-tail', 0)`);
await sleep(200);
await q(`document.getElementById('ex-go').click()`);
await q('window.__waitDone(15000)');
await q(`document.getElementById('ex-download').click()`);
await sleep(800);
f = await info();
check('루프 구간 내보내기: 길이 2마디, 소리 있음 (정규화 기억: 0.966)', f && near(f.dur, 2 * barSec, 0.02) && near(await peakAt(0.1, 2 * barSec - 0.1), 0.966, 0.01), f && f.dur);
await q(`document.getElementById('ex-close').click()`);
await q(`(async()=>{const m=await import('/static/js/pages/sequencer-arrange.js'); m.setLoop({ on: false, start: 4, length: 2 }); window.__dl = null;})()`);

await q('window.__open()');
await sleep(400);
await q(`{ const r = document.querySelector('input[name=ex-range][value=custom]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } window.__set('ex-from', 3); window.__set('ex-to', 4); window.__set('ex-tail', 0)`);
await sleep(200);
const customLen = await q(`document.getElementById('ex-len-custom').textContent`);
check('직접 지정 3~4마디: 설명이 맞음', customLen.indexOf('bar 3 – 4') === 0, customLen);
await q(`document.getElementById('ex-go').click()`);
await q('window.__waitDone(15000)');
await q(`document.getElementById('ex-download').click()`);
await sleep(800);
f = await info();
check('직접 지정 3~4마디(빈 구간): 길이 2마디, 완전한 무음', f && near(f.dur, 2 * barSec, 0.02) && f.peak < 0.001, J(f));
check('빈 구간을 내보내면 완료 화면이 소리 없음을 알려 줌', (await q(`document.getElementById('ex-done-note').textContent`)).indexOf('No sound was rendered') === 0);
await q(`document.getElementById('ex-close').click()`);

/* ── 6. 잘못된 범위는 내보내기 버튼이 꺼지고 안내가 뜸 ── */
await q('window.__open()');
await sleep(400);
await q(`{ const r = document.querySelector('input[name=ex-range][value=custom]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } window.__set('ex-from', 5); window.__set('ex-to', 2)`);
await sleep(200);
const bad = JSON.parse(await q(`JSON.stringify({ go: document.getElementById('ex-go').disabled, msgHidden: document.getElementById('ex-msg').hidden, msg: document.getElementById('ex-msg').textContent })`));
check('끝이 시작보다 앞이면 내보내기 버튼이 꺼지고 안내가 보임', bad.go === true && bad.msgHidden === false, J(bad));
await q(`document.getElementById('ex-cancel').click()`);

/* ── 7. 중지: 진행 화면에서 Stop → 설정 화면으로 돌아오고 파일은 없음 ── */
await q(`window.__dl = null; window.__slow = 1500; window.__open()`);
await sleep(400);
await q(`window.__set('ex-tail', 0); document.getElementById('ex-go').click()`);
await sleep(700);
const prog = JSON.parse(await q(`JSON.stringify({ hidden: document.getElementById('ex-progress').hidden, title: document.getElementById('export-title').textContent, stop: document.getElementById('ex-stop').disabled })`));
check('렌더링 중에는 진행 화면이 보임', prog.hidden === false && prog.title.indexOf('Exporting') >= 0, J(prog));
await b.shot(OUT + '05_export_progress.png');
await q(`document.getElementById('ex-stop').click()`);
const back = await q(`(async()=>{const t0=performance.now(); while(performance.now()-t0<15000){ if(!document.getElementById('ex-form').hidden) return true; await new Promise(r=>setTimeout(r,50)); } return false;})()`);
check('중지하면 설정 화면으로 돌아옴', back === true);
check('중지하면 오류 안내 없이 돌아옴', (await q(`document.getElementById('ex-msg').hidden`)) === true);
await q(`window.__slow = 0; document.getElementById('ex-cancel').click()`);
await sleep(300);
check('중지한 뒤 파일이 만들어지지 않음', (await q('window.__dl')) === null);

/* ── 8. 렌더링 중 Esc 는 닫지 않고 중지 ── */
await q(`window.__slow = 1500; window.__open()`);
await sleep(400);
await q(`window.__set('ex-tail', 0); document.getElementById('ex-go').click()`);
await sleep(600);
await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(300);
check('렌더링 중 Esc: 창이 닫히지 않고 중지 중으로 바뀜', (await q(`document.getElementById('export-modal').open`)) === true && (await q(`document.getElementById('ex-prog-title').textContent`)) === 'Stopping…');
await q(`(async()=>{const t0=performance.now(); while(performance.now()-t0<15000){ if(!document.getElementById('ex-form').hidden) return true; await new Promise(r=>setTimeout(r,50)); } return false;})()`);
await q(`window.__slow = 0; document.getElementById('ex-cancel').click()`);
await sleep(300);

/* ── 9. 메뉴 항목과 단축키 ── */
// 메뉴는 사람이 누른 클릭(isTrusted)만 받으므로 실제 마우스 이벤트로 FILE > Export… 를 누름
const clickAt = async (selector) => {
  const r = JSON.parse(await q(`(() => { const e = document.querySelector('${selector}'); const r = e.getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }); })()`));
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
};
await clickAt('[data-menu="file"]');
await sleep(300);
await clickAt('[data-command="file.export"]');
await sleep(400);
check('FILE > Export… 가 창을 엶', (await q(`document.getElementById('export-modal').open`)) === true);
await q(`document.getElementById('ex-x').click()`);
await sleep(300);
check('✕ 버튼이 창을 닫음', (await q(`document.getElementById('export-modal').open`)) === false);
await q(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', ctrlKey: true, shiftKey: true, bubbles: true }))`);
await sleep(400);
check('Ctrl+Shift+R 이 창을 엶', (await q(`document.getElementById('export-modal').open`)) === true);
await q(`document.getElementById('ex-cancel').click()`);

/* ── 10. 지난번 선택 기억 (24bit, 48kHz, 정규화) ── */
await q('window.__open()');
await sleep(400);
const mem = JSON.parse(await q(`JSON.stringify({ rate: document.querySelector('#ex-rate .is-on').dataset.rate, depth: document.querySelector('#ex-depth .is-on').dataset.depth, norm: document.getElementById('ex-norm').checked })`));
check('지난번에 고른 샘플레이트 · 비트 깊이 · 정규화를 기억함', mem.rate === '48000' && mem.depth === '24' && mem.norm === true, J(mem));
await q(`document.getElementById('ex-cancel').click()`);

/* ── 11. 재생이 여전히 되는지 (내보내기가 재생 그래프를 망가뜨리지 않음) + JS 오류 ── */
const errs = b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
check('화면에서 JS 오류가 나지 않음', errs === 0, 'errors=' + errs);

/* ── 씨앗 지우기 ── */
await api(`await m.api.delete('/clips/${seed.c1}'); await m.api.delete('/clips/${seed.c2}');
  await m.api.delete('/samples/${seed.sampleId}'); await m.api.delete('/tracks/${seed.trackId}');`);
b.close();
process.exit(summary() ? 0 : 1);


