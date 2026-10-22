// S1-14 시퀀서 로딩 화면 화면 시험 — 실제 시퀀서를 열어 로딩 화면이 덮고, 진행되고, 열리는 과정을 시간순으로 기록해 확인합니다.
// 이 시험은 자기 앱 서버(8014)를 띄웁니다 (서버용 Sentry 는 끔). 시험 계정 s109-tester@example.com 과 프로젝트 14431 이 DB 에 있어야 합니다.
// 샘플 불러오기를 느리게 하거나 실패시키려고, 페이지가 열리기 전에 fetch 를 감싸는 스크립트를 넣습니다 (시험 전용).
// 시험이 만든 트랙, 클립, 샘플은 끝나면 모두 지웁니다.
// 실행: node docs/handoff/s1-14_tests/ui_loader.mjs
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const REPO = process.cwd();
const OUT = REPO.replace(/\\/g, '/') + '/docs/screenshots/2026-10-21_s1-14_loader/';
const PORT = 8014;
const BASE = 'http://localhost:' + PORT;
const PID = '14431';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const app = spawn(`${REPO}/studionx/.venv/Scripts/python.exe`, ['-m', 'uvicorn', 'app.main:app', '--port', String(PORT)], {
  cwd: `${REPO}/studionx/backend`, env: Object.assign({}, process.env, { SENTRY_DSN: '', SENTRY_BROWSER_DSN: '' }), stdio: 'ignore',
});
const stopApp = () => { try { execSync(`taskkill /pid ${app.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { /* 이미 끝남 */ } };
let up = false;
for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(BASE + '/api/v1/health')).ok; } catch (e) { await new Promise((r) => setTimeout(r, 500)); } }
check('시험용 앱 서버가 떴음 (' + PORT + ')', up);
if (!up) { stopApp(); process.exit(1); }

const b = await launch(9621, 1440, 900, { loader: true });   // 로딩 화면을 끄는 표시를 넣지 않음
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);
const near = (x, y, tol) => Math.abs(x - y) <= tol;

await b.goto(BASE + '/home.html');
const creds = J({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
const status = await q(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${J(creds)},credentials:'same-origin'});return r.status})()`);
check('시험 계정으로 로그인(200)', status === 200, 'status=' + status);

/* ── 씨앗: 오디오 트랙(샘플 A, B, A 를 두 번 쓰는 클립 셋) + Sampler 트랙(샘플 C) ── */
const seed = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of full.clips) { await m.api.delete('/clips/' + c.clip_id); }
  const old = await m.api.get('/samples?page_size=100');
  for (const sm of (old.items || [])) { if (sm.name.indexOf('s1-14') === 0) await m.api.delete('/samples/' + sm.sample_id); }
  for (const t of full.tracks) { if (t.name.indexOf('S1-14 Loader') === 0) await m.api.delete('/tracks/' + t.track_id); }
  const wavOf = (secs, freq, name) => {
    const sr = 44100, n = Math.round(sr * secs), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * freq * i / sr) * 0.4 * 32767), true);
    const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'audio/wav' }), name);
    return fd;
  };
  const sa = await m.api.post('/samples', wavOf(0.4, 330, 's1-14-a.wav'));
  const sb = await m.api.post('/samples', wavOf(0.4, 440, 's1-14-b.wav'));
  const sc = await m.api.post('/samples', wavOf(0.4, 550, 's1-14-c.wav'));
  const audio = await m.api.post('/projects/${PID}/tracks', { project_id: ${PID}, name: 'S1-14 Loader Audio', track_type: 'AUDIO', order_index: 80 });
  const c1 = await m.api.post('/tracks/' + audio.track_id + '/clips', { clip_type: 'AUDIO', sample_id: sa.sample_id, start_tick: 0, length_tick: 3840 });
  const c2 = await m.api.post('/tracks/' + audio.track_id + '/clips', { clip_type: 'AUDIO', sample_id: sa.sample_id, start_tick: 3840, length_tick: 3840 });
  const c3 = await m.api.post('/tracks/' + audio.track_id + '/clips', { clip_type: 'AUDIO', sample_id: sb.sample_id, start_tick: 7680, length_tick: 3840 });
  const midi = await m.api.post('/projects/${PID}/tracks', { project_id: ${PID}, name: 'S1-14 Loader Sampler', track_type: 'MIDI', order_index: 81 });
  const plugins = (await m.api.get('/plugins?active_only=true')).items;
  const sampler = plugins.filter(p => p.code === 'sampler')[0];
  const inst = await m.api.post('/tracks/' + midi.track_id + '/instruments', { plugin_id: sampler.plugin_id, slot_index: 0 });
  await m.api.patch('/tracks/' + midi.track_id + '/instruments/' + inst.track_instrument_id, { params: { sample_id: sc.sample_id, mode: 'oneshot' } });
  const after = await m.api.get('/projects/${PID}/full');
  return JSON.stringify({ a: sa.sample_id, b: sb.sample_id, c: sc.sample_id, audioId: audio.track_id, midiId: midi.track_id, clips: [c1.clip_id, c2.clip_id, c3.clip_id],
    title: after.project.title, bpm: after.project.bpm, tracks: after.tracks.filter(t => t.track_type !== 'MASTER').length });
`));
check('씨앗을 만들었음 (샘플 3개, 클립 3개, Sampler)', !!seed.a && !!seed.b && !!seed.c && seed.clips.length === 3, J(seed));

/* ── 도구: 페이지가 열리기 전에 fetch 를 감싸 샘플 받기를 느리게 하거나 실패시킴 ── */
let injected = null;
async function arm(cfg) {
  const conf = Object.assign({ delayAll: 0, delay: {}, fail: [], failFull: false }, cfg || {});
  const source = `(function () {
    var cfg = ${J(conf)}; window.__ldFetches = []; var orig = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : ((input && input.url) || '');
      var m = /\\/samples\\/(\\d+)\\/file/.exec(url);
      if (m) {
        var id = Number(m[1]); window.__ldFetches.push(id);
        if (cfg.fail.indexOf(id) >= 0) return Promise.reject(new TypeError('blocked by test'));
        var d = cfg.delay[id] || cfg.delayAll || 0;
        if (d) return new Promise(function (r) { setTimeout(r, d); }).then(function () { return orig(input, init); });
      }
      if (cfg.failFull && /\\/projects\\/\\d+\\/full/.test(url)) return Promise.reject(new TypeError('blocked by test'));
      return orig(input, init);
    };
  })();`;
  if (injected) await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected });
  injected = (await b.send('Page.addScriptToEvaluateOnNewDocument', { source })).result.identifier;
}

const PROBE = `(() => {
  const r = document.getElementById('sq-loader');
  const base = { href: location.href, t: performance.now() };
  if (!r) return JSON.stringify(Object.assign(base, { gone: true }));
  const g = (s) => r.querySelector(s);
  const rect = r.getBoundingClientRect(); const mid = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  const top = document.querySelector('.sq-top');
  return JSON.stringify(Object.assign(base, { gone: false, cls: r.className, pct: g('.sq-ld__pct').textContent, valuenow: r.getAttribute('aria-valuenow'),
    off: g('.sq-ld__wave').style.strokeDashoffset, kind: g('.sq-ld__kind').textContent, name: g('.sq-ld__name').textContent.trim(), info: g('.sq-ld__info').textContent.trim(),
    cnt: g('[data-step="content"] .sq-ld__cnt').textContent, labels: [...r.querySelectorAll('.sq-ld__st')].map((x) => x.firstChild.nodeValue.trim()),
    done: [...r.querySelectorAll('.sq-ld__step')].map((s) => s.classList.contains('is-done')),
    cssReady: getComputedStyle(r).position === 'fixed',   // studio.css 가 적용된 뒤인지 (적용 전에는 브라우저가 화면을 그리지 않아 사용자에게 보이지 않음)
    kindVis: getComputedStyle(g('.sq-ld__kind')).visibility, stepsVis: getComputedStyle(g('.sq-ld__steps')).visibility,
    covers: rect.width >= innerWidth - 1 && rect.height >= innerHeight - 1, topIsLoader: !!(mid && r.contains(mid)), appInert: top ? top.inert : null }));
})()`;

/** 페이지를 열고 로딩이 끝날 때까지 60ms 마다 기록 */
async function run(url, o) {
  const opts = Object.assign({ shots: null, limitMs: 30000 }, o || {});
  await b.goto('about:blank');
  const t0 = Date.now();
  b.send('Page.navigate', { url });
  const tl = [];
  const shotDone = {};
  while (Date.now() - t0 < opts.limitMs) {
    let s = null;
    try { s = JSON.parse(await q(PROBE)); } catch (e) { s = null; }
    if (s && s.href.indexOf('studioNx.html') >= 0) {
      s.ms = Date.now() - t0;
      tl.push(s);
      if (opts.shots && !s.gone) {
        const pct = parseInt(s.pct, 10) || 0;
        const hit = (key, cond) => { if (opts.shots[key] && !shotDone[key] && cond) { shotDone[key] = true; return true; } return false; };
        if (hit('start', true)) await b.shot(OUT + opts.shots.start);
        else if (hit('mid', pct >= 35 && pct <= 70 && s.cls.indexOf('is-in') < 0)) await b.shot(OUT + opts.shots.mid);
        else if (hit('in', s.cls.indexOf('is-in') >= 0 && s.cls.indexOf('is-opening') < 0)) await b.shot(OUT + opts.shots.in);
        else if (hit('opening', s.cls.indexOf('is-opening') >= 0)) await b.shot(OUT + opts.shots.opening);
      }
      if (s.gone && tl.length > 1) break;
    }
    await sleep(60);
  }
  return tl;
}
const live = (tl) => tl.filter((s) => !s.gone);
const started = (tl) => live(tl).filter((s) => /\bis-(open|new|demo)\b/.test(s.cls));   // 스크립트가 종류를 정한 뒤의 표본
const lastOf = (arr) => arr[arr.length - 1];
const goneAt = (tl) => { const g = tl.filter((s) => s.gone)[0]; return g ? g.ms : null; };
const firstIdx = (tl, f) => { for (let i = 0; i < tl.length; i++) if (f(tl[i])) return i; return -1; };
const pctOf = (s) => parseInt(s.pct, 10);
const monotone = (arr) => arr.every((v, i) => i === 0 || v >= arr[i - 1]);

/* ═══════ A. 기존 프로젝트 열기 (샘플 3개, 각 0.7초 지연) ═══════ */
await arm({ delayAll: 700 });
const A = await run(`${BASE}/studioNx.html?projectId=${PID}`, { shots: { start: '01_open_start.png', mid: '02_open_loading.png', in: '03_open_signal_in.png', opening: '04_open_opening.png' } });
const aLive = live(A);
check('A 기록이 쌓였음 (로딩 화면이 보인 표본이 여러 개)', aLive.length >= 10, 'n=' + aLive.length);
check('A 첫 표본부터 로딩 화면이 화면 전체를 덮고, 한가운데가 로딩 화면임', aLive[0].covers && aLive[0].topIsLoader, J({ covers: aLive[0].covers, top: aLive[0].topIsLoader, ms: aLive[0].ms }));
const aStarted = started(A);
const aPre = aLive.filter((s) => s.cssReady && !/\bis-(open|new|demo)\b/.test(s.cls));   // CSS 가 적용되었는데 아직 종류가 안 정해진 표본
check('A 스크립트가 종류를 정하기 전의 표본(' + aPre.length + '개)에는 종류 문구와 단계가 숨겨져 있고, 정한 뒤에는 보임', aPre.every((s) => s.kindVis === 'hidden' && s.stepsVis === 'hidden') && aStarted.every((s) => s.kindVis === 'visible' && s.stepsVis === 'visible'), J({ pre: aPre.length, started: aStarted.length }));
check('A 종류 글이 OPENING PROJECT', aStarted.length > 0 && aStarted[0].kind === 'OPENING PROJECT', aStarted[0] && aStarted[0].kind);
check('A 스크립트가 시작된 뒤로는 뒤 화면이 늘 inert (Tab 으로 못 들어감)', aStarted.length > 0 && aStarted.every((s) => s.appInert === true), J(aStarted.map((s) => s.appInert).filter((v, i, a) => a.indexOf(v) === i)));
const named = aLive.filter((s) => s.name === seed.title);
check('A 프로젝트 이름이 제목으로 나옴 (' + seed.title + ')', named.length > 0, J(aLive[aLive.length - 1].name));
const bpmText = (Math.round(Number(seed.bpm) * 100) % 100 === 0 ? String(Math.round(Number(seed.bpm))) : Number(seed.bpm).toFixed(2));
check('A 정보 글이 "BPM · 박자 · Key · N TRACKS" 모양', named.length > 0 && named[named.length - 1].info.indexOf(bpmText + ' BPM') === 0 && named[named.length - 1].info.endsWith(seed.tracks + ' TRACKS'), named.length ? named[named.length - 1].info : 'none');
const aPct = aLive.map(pctOf);
check('A 퍼센트가 0 에서 시작해 100 까지 가고 줄어들지 않음', aPct[0] <= 15 && Math.max.apply(null, aPct) === 100 && monotone(aPct), J(aPct.filter((v, i) => i % 4 === 0)));
check('A aria-valuenow 가 퍼센트와 같음', aLive.every((s) => Number(s.valuenow) === pctOf(s)));
const offs = aLive.map((s) => (s.off === '' ? 100 : Number(s.off)));   // 아직 정하지 않았으면 CSS 기본값 100
check('A 파형(stroke-dashoffset)이 100 에서 0 으로 줄어듦', offs[0] >= 80 && offs[offs.length - 1] <= 1 && offs.every((v, i) => i === 0 || v <= offs[i - 1] + 1e-9), J(offs.filter((v, i) => i % 5 === 0)));
const cnts = aLive.map((s) => s.cnt).filter(Boolean);
check('A 샘플 개수가 0/3 부터 3/3 까지 (중복 샘플은 한 번만 세서 전체 3개)', cnts.length > 0 && cnts.every((c) => /^\d\/3$/.test(c)) && cnts[cnts.length - 1] === '3/3' && cnts.some((c) => c !== '3/3'), J([...new Set(cnts)]));
check('A 단계 글: PROJECT DATA, SAMPLES, AUDIO ENGINE', J(aLive[aLive.length - 1].labels) === J(['PROJECT DATA', 'SAMPLES', 'AUDIO ENGINE']), J(aLive[aLive.length - 1].labels));
const firstDone = [0, 1, 2].map((k) => firstIdx(aLive, (s) => s.done[k]));
check('A 세 점이 차례로 켜짐 (데이터, 샘플, 엔진 순서)', firstDone.every((i) => i >= 0) && firstDone[0] <= firstDone[1] && firstDone[1] <= firstDone[2], J(firstDone));
const inIdx = firstIdx(aLive, (s) => s.cls.indexOf('is-in') >= 0);
const openIdx = firstIdx(aLive, (s) => s.cls.indexOf('is-opening') >= 0);
check('A SIGNAL IN 이 켜진 뒤에 열림 (is-in 이 is-opening 보다 먼저)', inIdx >= 0 && openIdx >= 0 && inIdx <= openIdx, J({ inIdx, openIdx }));
check('A SIGNAL IN 이 켜질 때는 100%', inIdx >= 0 && pctOf(aLive[inIdx]) === 100 && aLive[inIdx].done.every(Boolean), inIdx >= 0 ? aLive[inIdx].pct : 'none');
const aGone = goneAt(A);
check('A 끝나면 로딩 화면이 DOM 에서 사라짐', aGone !== null, 'gone=' + aGone);
check('A 최소 표시 시간(1600ms) + 열기 시간 이상, 그러나 9초 안', aGone !== null && aGone >= 1900 && aGone <= 9000, 'gone=' + aGone);
const aEnd = JSON.parse(await q(`(async()=>{const m=await import('/static/js/pages/sequencer-audio.js'); const top=document.querySelector('.sq-top'); const btn=document.getElementById('btn-play'); const r=btn.getBoundingClientRect(); const hit=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
  return JSON.stringify({ fetches: window.__ldFetches, state: m.preloadState(), inert: top.inert, hitIsButton: hit === btn || btn.contains(hit), loaderGone: !document.getElementById('sq-loader') })})()`));
check('A 샘플 파일을 각각 한 번씩만 받음 (A 는 클립 둘이 써도 한 번)', J(aEnd.fetches.slice().sort((x, y) => x - y)) === J([seed.a, seed.b, seed.c].sort((x, y) => x - y)), J(aEnd.fetches));
check('A 미리 받아 둔 샘플이 3개이고 바이트가 있음', aEnd.state.count === 3 && aEnd.state.bytes > 1000, J(aEnd.state));
check('A 로딩이 끝나면 뒤 화면의 inert 가 풀리고, 재생 버튼이 눌림(맨 위가 버튼)', aEnd.inert === false && aEnd.hitIsButton === true, J(aEnd));
await q(`document.getElementById('btn-play').click()`);
await sleep(2200);
const aPlay = JSON.parse(await q(`(async()=>{const m=await import('/static/js/pages/sequencer-audio.js'); return JSON.stringify({ fetches: window.__ldFetches, state: m.preloadState(), playing: document.body.classList.contains('is-playing') })})()`));
check('A 재생을 누르면 미리 받아 둔 샘플을 한 번씩 넘겨받고(캐시가 비고) 서버에서 다시 받지 않음', aPlay.state.count === 0 && aPlay.fetches.length === 3 && aPlay.playing, J(aPlay));
await q(`document.getElementById('btn-stop').click()`);
await sleep(300);

/* ═══════ B. 샘플 하나는 실패, 하나는 많이 느림 ═══════ */
await arm({ delay: { [seed.b]: 2500 }, fail: [seed.c] });
const B = await run(`${BASE}/studioNx.html?projectId=${PID}`);
const bLive = live(B);
const bGone = goneAt(B);
check('B 샘플 하나가 실패하고 하나가 늦어도 열림', bGone !== null && bGone <= 12000, 'gone=' + bGone);
const bCnt = bLive.map((s) => s.cnt).filter(Boolean);
check('B 실패한 샘플도 끝난 것으로 세어 3/3 까지 감 (멈추지 않음)', bCnt[bCnt.length - 1] === '3/3', J([...new Set(bCnt)]));
check('B 느린 샘플을 기다림 (열리기까지 2.5초 이상)', bGone !== null && bGone >= 2500, 'gone=' + bGone);
check('B 그래도 정상으로 SIGNAL IN 이 켜지고 열림 (실패한 샘플 하나로 NO SIGNAL 에 머물지 않음)', firstIdx(bLive, (s) => s.cls.indexOf('is-in') >= 0) >= 0 && firstIdx(bLive, (s) => s.cls.indexOf('is-failed') >= 0) < 0);
const bState = JSON.parse(await q(`(async()=>{const m=await import('/static/js/pages/sequencer-audio.js'); return JSON.stringify(m.preloadState())})()`));
check('B 받은 샘플 2개만 담아 둠 (실패한 것은 재생 때 다시 시도)', bState.count === 2, J(bState));

/* ═══════ C. 새 프로젝트 (?new=1) ═══════ */
await arm({ delayAll: 700 });
const C = await run(`${BASE}/studioNx.html?projectId=${PID}&new=1`, { shots: { mid: '05_new_loading.png' } });
const cLive = live(C);
const cGone = goneAt(C);
check('C 종류 글이 NEW PROJECT', started(C).length > 0 && started(C)[0].kind === 'NEW PROJECT', started(C)[0] && started(C)[0].kind);
check('C 단계 글: CREATING PROJECT, MASTER TRACK, AUDIO ENGINE', cLive.length > 0 && J(cLive[cLive.length - 1].labels) === J(['CREATING PROJECT', 'MASTER TRACK', 'AUDIO ENGINE']), J(cLive.length && cLive[cLive.length - 1].labels));
const cNamed = cLive.filter((s) => s.name === seed.title);
check('C 정보 글이 "... · MASTER TRACK ONLY" 로 끝남', cNamed.length > 0 && cNamed[cNamed.length - 1].info.endsWith('MASTER TRACK ONLY'), cNamed.length ? cNamed[cNamed.length - 1].info : 'none');
check('C 샘플 개수 칸이 비어 있고 샘플 파일을 받지 않음', cLive.every((s) => s.cnt === '') && (await q('JSON.stringify(window.__ldFetches)')) === '[]');
check('C 열림: 최소 1100ms + 열기 이상이고, 기존 프로젝트(A)보다 짧음', cGone !== null && cGone >= 1500 && cGone < aGone, 'C=' + cGone + ' A=' + aGone);
const cPct = cLive.map(pctOf);
check('C 퍼센트가 100 까지 가고 줄지 않음', Math.max.apply(null, cPct) === 100 && monotone(cPct));

/* ═══════ D. 예시 화면 (projectId 없음) ═══════ */
await arm({});
const D = await run(`${BASE}/studioNx.html`, { shots: { mid: '06_demo_loading.png' } });
const dLive = live(D);
const dGone = goneAt(D);
check('D 종류 글이 EXAMPLE SCREEN, 단계 글이 EXAMPLE PROJECT, TRACKS, AUDIO ENGINE', started(D).length > 0 && started(D)[0].kind === 'EXAMPLE SCREEN' && J(lastOf(dLive).labels) === J(['EXAMPLE PROJECT', 'TRACKS', 'AUDIO ENGINE']), J(started(D)[0] && started(D)[0].kind));
const dNamed = dLive.filter((s) => s.name === 'Example Project');
check('D 제목이 "Example Project", 정보 글이 "SAMPLE DATA, NOTHING IS SAVED" (저장되지 않는 예시라는 안내)', dNamed.length > 0 && lastOf(dNamed).info === 'SAMPLE DATA, NOTHING IS SAVED', J(lastOf(dLive) && { n: lastOf(dLive).name, i: lastOf(dLive).info }));
check('D 열림: 최소 800ms + 열기 이상, 4초 안', dGone !== null && dGone >= 1200 && dGone <= 4000, 'gone=' + dGone);
check('D 예시 화면은 샘플 파일을 받지 않음', (await q('JSON.stringify(window.__ldFetches)')) === '[]');

/* ═══════ E. 움직임 줄이기 ═══════ */
await arm({ delayAll: 700 });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
const E = await run(`${BASE}/studioNx.html?projectId=${PID}`);
const eLive = live(E);
const eGone = goneAt(E);
check('E 움직임 줄이기: is-reduced 클래스가 붙음', started(E).length > 0 && started(E)[0].cls.indexOf('is-reduced') >= 0, J(started(E)[0] && started(E)[0].cls));
check('E 움직임 줄이기: 최소 표시 시간과 열기 대기가 없어 A 보다 훨씬 빨리 끝남 (샘플 0.7초 + 준비)', eGone !== null && eGone < aGone - 500 && eGone >= 600, 'E=' + eGone + ' A=' + aGone);
await b.send('Emulation.setEmulatedMedia', { features: [] });

/* ═══════ F. 프로젝트 읽기 실패 (네트워크 오류) ═══════ */
await arm({ failFull: true });
const F = await run(`${BASE}/studioNx.html?projectId=${PID}`, { limitMs: 12000 });
const fGone = goneAt(F);
const fLive = live(F);
check('F 프로젝트를 읽지 못해도 로딩 화면이 멈추지 않고 열림', fGone !== null && fGone <= 6000, 'gone=' + fGone);
check('F 실패면 NO SIGNAL 을 그대로 두고 엶 (is-failed, is-in 아님)', firstIdx(fLive, (s) => s.cls.indexOf('is-failed') >= 0) >= 0 && firstIdx(fLive, (s) => s.cls.indexOf('is-in') >= 0) < 0, J(fLive.map((s) => s.cls).filter((v, i, a) => a.indexOf(v) === i)));
const toast = await q(`document.body.innerText.indexOf('Could not open this project') >= 0`);
check('F 안내 알림("Could not open this project")이 뜸', toast === true);

/* ═══════ G. 안전장치: 스크립트가 끝내지 못해도 CSS 가 30초 뒤에 풀어 줌 ═══════ */
await arm({ delayAll: 60000 });
await b.goto('about:blank');
b.send('Page.navigate', { url: `${BASE}/studioNx.html?projectId=${PID}` });
await sleep(2500);
const g1 = JSON.parse(await q(`(() => { const r = document.getElementById('sq-loader'); if (!r) return JSON.stringify({ gone: true });
  const a = r.getAnimations().filter((x) => x.animationName === 'sq-ld-failsafe')[0]; const cs = getComputedStyle(r);
  return JSON.stringify({ gone: false, hasAnim: !!a, delay: a ? a.effect.getTiming().delay : null, visBefore: cs.visibility }) })()`));
check('G 안전장치 애니메이션이 있고 30초 뒤 시작', g1.gone === false && g1.hasAnim === true && g1.delay === 30000 && g1.visBefore === 'visible', J(g1));
const g2 = JSON.parse(await q(`(() => { const r = document.getElementById('sq-loader'); r.getAnimations().filter((x) => x.animationName === 'sq-ld-failsafe')[0].finish(); const cs = getComputedStyle(r);
  return JSON.stringify({ vis: cs.visibility, pe: cs.pointerEvents }) })()`));
check('G 30초가 지난 것으로 건너뛰면 로딩 화면이 숨고 클릭을 막지 않음', g2.vis === 'hidden' && g2.pe === 'none', J(g2));
await b.shot(OUT + '07_stuck_loading_before_failsafe.png');

/* ── 씨앗 지우기 ── */
await arm({});
await b.goto(BASE + '/home.html');
await api(`for (const id of ${J(seed.clips)}) { await m.api.delete('/clips/' + id); }
  await m.api.delete('/tracks/${seed.audioId}'); await m.api.delete('/tracks/${seed.midiId}');
  for (const id of [${seed.a}, ${seed.b}, ${seed.c}]) { await m.api.delete('/samples/' + id); }`);
const left = JSON.parse(await api(`const f = await m.api.get('/projects/${PID}/full'); return JSON.stringify(f.tracks.filter(t => t.name.indexOf('S1-14 Loader') === 0).length)`));
check('시험이 만든 트랙을 모두 지웠음', left === 0, 'left=' + left);

stopApp();
await b.close();
process.exit(summary() ? 0 : 1);
