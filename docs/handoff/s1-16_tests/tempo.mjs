// S1-16 템포 줄 편집 시험: 찍기, 끌기, 램프 전환, 지우기, 저장과 다시 열기를 서버 값으로 확인합니다.
// 전제: 시험용 서버 8001, 프로젝트 14431. 실행 전 템포 변경점은 끝에 원래대로 되돌립니다.
// 실행: node docs/handoff/s1-16_tests/tempo.mjs
import fs from 'node:fs';
import { launch } from '../p1-28_tests/lib.mjs';

const BASE = 'http://localhost:8001';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-11-15_s1-16_tempo_row/';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9565, 1600, 1000);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);
const tempoOf = async () => JSON.parse(await api(`const t=await m.api.get('/projects/14431/tempo-changes');return JSON.stringify(t.items||t)`));
const rect = async (sel) => JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'null';const r=e.getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height})})()`));
const mouse = (type, x, y, mod, count) => b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: count || 1, modifiers: mod || 0 });
const click = async (x, y, mod) => { await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await sleep(100); await mouse('mousePressed', x, y, mod); await sleep(60); await mouse('mouseReleased', x, y, mod); await sleep(900); };
const dbl = async (x, y) => { await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await mouse('mousePressed', x, y, 0, 2); await mouse('mouseReleased', x, y, 0, 2); await sleep(900); };
const drag = async (x0, y0, x1, y1) => {
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 }); await sleep(100);
  await mouse('mousePressed', x0, y0);
  for (let i = 1; i <= 8; i++) { await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / 8, y: y0 + (y1 - y0) * i / 8, buttons: 1 }); await sleep(30); }
  await mouse('mouseReleased', x1, y1); await sleep(300);
};
const nav = async (url) => {
  const before = b.events.length;
  const p = b.send('Page.navigate', { url });
  let done = false;
  p.then(() => { done = true; });
  for (let i = 0; i < 80 && !done; i++) {
    await sleep(150);
    if (b.events.slice(before).some((e) => e.method === 'Page.javascriptDialogOpening')) await b.send('Page.handleJavaScriptDialog', { accept: true });
  }
  await sleep(2500);
};

const results = [];
const check = (name, ok, extra) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };

await b.goto(BASE + '/home.html');
const creds = JSON.stringify({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
await q(`(async()=>{await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(creds)},credentials:'same-origin'})})()`);
await b.goto(BASE + '/studioNx.html?projectId=14431');
await sleep(2500);
const tempo0 = await tempoOf();
console.log('초기 템포', JSON.stringify(tempo0));
await api(`await m.api.put('/projects/14431/tempo-changes',{changes:[]})`);
await b.goto(BASE + '/studioNx.html?projectId=14431');
await sleep(2500);

try {
  await q(`document.getElementById('automation-mode').click()`);
  await sleep(1000);
  const barW = parseFloat(await q(`getComputedStyle(document.getElementById('lanes')).getPropertyValue('--sq-bar-w')`));
  const body = await rect('.sq-global--tempo .sq-global__body');
  check('템포 줄이 보임', !!body && body.h > 20, JSON.stringify(body));
  const midY = body.y + body.h / 2;
  const atBar = (bar) => body.x + barW * bar;

  // 1) 빈 곳 클릭으로 추가
  await click(atBar(8), midY);
  let t = await tempoOf();
  check('클릭으로 변경점 1개 추가', t.length === 1 && t[0].tick > 0, JSON.stringify(t));
  const firstTick = t.length ? t[0].tick : 0;
  check('틱이 스냅 단위(마디 배수 아님도 허용)에 맞음', firstTick % 240 === 0, 'tick=' + firstTick);
  await click(atBar(16), body.y + body.h * 0.25);
  t = await tempoOf();
  check('두 번째 변경점 추가', t.length === 2 && t[1].tick > t[0].tick, JSON.stringify(t));
  check('위쪽이 더 빠른 BPM', t.length === 2 && t[1].bpm > t[0].bpm, JSON.stringify(t.map((c) => c.bpm)));
  await b.shot(OUT + '01_two_points.png');

  // 2) 끌기: 첫 점을 오른쪽 아래로
  const pt0 = await rect('.sq-global__pt[data-i="1"]');
  const before = { tick: t[0].tick, bpm: t[0].bpm };
  await drag(pt0.x + pt0.w / 2, pt0.y + pt0.h / 2, pt0.x + pt0.w / 2 + barW * 2, pt0.y + pt0.h / 2 + 12);
  await sleep(700);
  t = await tempoOf();
  check('끌면 틱이 오른쪽으로 이동', t[0].tick > before.tick, before.tick + ' → ' + t[0].tick);
  check('끌면 BPM이 내려감', t[0].bpm < before.bpm, before.bpm + ' → ' + t[0].bpm);
  check('끌어도 개수 유지', t.length === 2);
  await b.shot(OUT + '02_dragged.png');

  // 3) Shift+클릭으로 LINEAR 전환
  const pt2 = await rect('.sq-global__pt[data-i="2"]');
  await click(pt2.x + pt2.w / 2, pt2.y + pt2.h / 2, 8);
  await sleep(700);
  t = await tempoOf();
  check('Shift+클릭으로 LINEAR', t[1].ramp === 'LINEAR', JSON.stringify(t[1]));
  await b.shot(OUT + '03_linear.png');
  const rampPlay = await api(`const d=await import('/static/js/pages/sequencer-devices.js');return JSON.stringify(d.playbackTempoChanges())`);
  check('재생 목록에 같은 값이 반영됨', JSON.parse(rampPlay).length === 2 && JSON.parse(rampPlay)[1].ramp === 'LINEAR', rampPlay);

  // 4) 새로 열어도 유지
  await b.goto(BASE + '/studioNx.html?projectId=14431');
  await sleep(2500);
  await q(`document.getElementById('automation-mode').click()`);
  await sleep(800);
  const dots = await q(`document.querySelectorAll('.sq-global--tempo .sq-global__pt').length`);
  check('다시 열면 점 3개(기준 점 포함)', Number(dots) === 3, 'dots=' + dots);

  // 5) 더블클릭으로 삭제
  const p2 = await rect('.sq-global__pt[data-i="2"]');
  await dbl(p2.x + p2.w / 2, p2.y + p2.h / 2);
  await sleep(700);
  t = await tempoOf();
  check('더블클릭으로 변경점 삭제', t.length === 1, JSON.stringify(t));
  const p0 = await rect('.sq-global__pt[data-i="0"]');
  await dbl(p0.x + p0.w / 2, p0.y + p0.h / 2);
  await sleep(500);
  const dots2 = await q(`document.querySelectorAll('.sq-global--tempo .sq-global__pt').length`);
  check('기준 점은 지워지지 않음', Number(dots2) === 2, 'dots=' + dots2);
  await b.shot(OUT + '04_after_delete.png');

  // 6) 되돌리기와 다시 실행 (S1-17)
  const hist = (fn) => api(`const h=await import('/static/js/pages/sequencer-history.js'); await h.${fn}(); return 'ok'`);
  await hist('undo'); await sleep(900);
  t = await tempoOf();
  check('삭제 되돌리기: 점 2개와 LINEAR 복원', t.length === 2 && t[1].ramp === 'LINEAR', JSON.stringify(t));
  await hist('redo'); await sleep(900);
  t = await tempoOf();
  check('다시 실행: 1개', t.length === 1, JSON.stringify(t));

  // 7) 새로 열어 기록을 비우고: 추가 2번, 끌기, 램프를 차례로 되돌림
  await api(`await m.api.put('/projects/14431/tempo-changes',{changes:[]})`);
  await b.goto(BASE + '/studioNx.html?projectId=14431');
  await sleep(2500);
  await q(`document.getElementById('automation-mode').click()`);
  await sleep(800);
  const b2 = await rect('.sq-global--tempo .sq-global__body');
  await click(b2.x + barW * 8, b2.y + b2.h / 2);
  await click(b2.x + barW * 16, b2.y + b2.h * 0.25);
  const q0 = await tempoOf();
  const g1 = await rect('.sq-global__pt[data-i="1"]');
  await drag(g1.x + g1.w / 2, g1.y + g1.h / 2, g1.x + g1.w / 2 + barW * 2, g1.y + g1.h / 2 + 12);
  await sleep(700);
  const g2 = await rect('.sq-global__pt[data-i="2"]');
  await click(g2.x + g2.w / 2, g2.y + g2.h / 2, 8);
  await sleep(700);
  t = await tempoOf();
  check('준비: 점 2개, 램프 LINEAR', t.length === 2 && t[1].ramp === 'LINEAR', JSON.stringify(t));
  await hist('undo'); await sleep(900);
  t = await tempoOf();
  check('램프 되돌리기: STEP', t.length === 2 && t[1].ramp === 'STEP', JSON.stringify(t));
  await hist('undo'); await sleep(900);
  t = await tempoOf();
  check('끌기 되돌리기: 처음 위치와 BPM', t.length === 2 && t[0].tick === q0[0].tick && t[0].bpm === q0[0].bpm, JSON.stringify(t));
  await hist('undo'); await hist('undo'); await sleep(900);
  t = await tempoOf();
  check('추가 두 번 모두 되돌리면 비어 있음', t.length === 0, JSON.stringify(t));
  await hist('redo'); await sleep(900);
  t = await tempoOf();
  check('다시 실행하면 첫 점이 돌아옴', t.length === 1, JSON.stringify(t));
} catch (e) {
  console.log('오류', e && e.message);
  results.push(false);
} finally {
  await api(`await m.api.put('/projects/14431/tempo-changes',{changes:${JSON.stringify(tempo0.map((c) => ({ tick: c.tick, bpm: c.bpm, ramp: c.ramp })))}})`);
  console.log('복원 후 템포', JSON.stringify(await tempoOf()));
  console.log(results.filter(Boolean).length + '/' + results.length + ' 통과');
  await b.close();
}
