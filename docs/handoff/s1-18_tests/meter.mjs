// S1-18 박자 줄 편집 시험: 더하기, 바꾸기, 지우기, 되돌리기, 저장과 다시 열기를 서버 값으로 확인합니다.
// 전제: 시험용 서버 8001, 프로젝트 14431. 끝나면 박자 변경점을 원래대로 되돌립니다.
// 실행: node docs/handoff/s1-18_tests/meter.mjs
import fs from 'node:fs';
import { launch } from '../p1-28_tests/lib.mjs';

const BASE = 'http://localhost:8001';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-11-15_s1-18_meter_row/';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9566, 1600, 1000);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);
const meterOf = async () => JSON.parse(await api(`const t=await m.api.get('/projects/14431/meter-changes');return JSON.stringify(t.items||t)`));
const rect = async (sel) => JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'null';const r=e.getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height})})()`));
const mouse = (type, x, y, mod) => b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, modifiers: mod || 0 });
const click = async (x, y, mod) => { await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await sleep(100); await mouse('mousePressed', x, y, mod); await sleep(60); await mouse('mouseReleased', x, y, mod); await sleep(900); };
const hist = (fn) => api(`const h=await import('/static/js/pages/sequencer-history.js'); await h.${fn}(); return 'ok'`);

const results = [];
const check = (name, ok, extra) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };

await b.goto(BASE + '/home.html');
const creds = JSON.stringify({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
await q(`(async()=>{await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(creds)},credentials:'same-origin'})})()`);
await b.goto(BASE + '/studioNx.html?projectId=14431');
await sleep(2500);
const meter0 = await meterOf();
console.log('초기 박자', JSON.stringify(meter0));
await api(`await m.api.put('/projects/14431/meter-changes',{changes:[]})`);

const open = async () => {
  await b.goto(BASE + '/studioNx.html?projectId=14431');
  await sleep(2500);
  await q(`document.getElementById('automation-mode').click()`);
  await sleep(900);
};

try {
  await open();
  const barW = parseFloat(await q(`getComputedStyle(document.getElementById('lanes')).getPropertyValue('--sq-bar-w')`));
  const body = await rect('.sq-global--meter .sq-global__body');
  check('박자 줄이 보임', !!body && body.h > 15, JSON.stringify(body));
  const midY = body.y + body.h / 2;
  const atBar = (bar) => body.x + barW * (bar + 0.5);
  const segs = () => q(`document.querySelectorAll('.sq-global--meter .sq-global__seg').length`);

  // 1) 더하기
  await click(atBar(8), midY);
  let t = await meterOf();
  check('클릭으로 변경점 추가 (9번째 마디, tick 30720)', t.length === 1 && t[0].tick === 30720, JSON.stringify(t));
  check('구간 2개로 표시', Number(await segs()) === 2, 'segs=' + (await segs()));
  await b.shot(OUT + '01_added.png');

  // 2) 같은 시작 마디를 다시 누르면 다음 박자로
  const first = t.length ? t[0].time_sig_num + '/' + t[0].time_sig_den : '';
  await click(atBar(8), midY);
  t = await meterOf();
  const second = t.length ? t[0].time_sig_num + '/' + t[0].time_sig_den : '';
  check('다시 누르면 다음 박자로 바뀜', t.length === 1 && second !== first, first + ' → ' + second);
  await click(atBar(8), midY, 8);
  t = await meterOf();
  check('Shift+클릭은 이전 박자로 돌아옴', t.length === 1 && t[0].time_sig_num + '/' + t[0].time_sig_den === first, JSON.stringify(t));

  // 3) 두 번째 변경점
  await click(atBar(20), midY);
  t = await meterOf();
  check('두 번째 변경점', t.length === 2 && t[1].tick === 76800, JSON.stringify(t));
  await b.shot(OUT + '02_two.png');

  // 4) 새로 열어도 유지
  await open();
  check('다시 열면 구간 3개', Number(await segs()) === 3, 'segs=' + (await segs()));

  // 5) Alt+클릭으로 삭제
  await click(atBar(20), midY, 1);
  t = await meterOf();
  check('Alt+클릭으로 삭제', t.length === 1 && t[0].tick === 30720, JSON.stringify(t));
  await click(atBar(0), midY);
  t = await meterOf();
  check('기준 구간의 첫 마디는 바뀌지 않음', t.length === 1, JSON.stringify(t));

  // 6) 되돌리기
  await hist('undo'); await sleep(900);
  t = await meterOf();
  check('삭제 되돌리기: 2개', t.length === 2, JSON.stringify(t));
  await hist('redo'); await sleep(900);
  t = await meterOf();
  check('다시 실행: 삭제가 다시 적용되어 1개', t.length === 1, JSON.stringify(t));
  await hist('undo'); await sleep(900);
  // 새로 추가한 변경점도 되돌려 봄 (페이지를 다시 연 뒤라 기록은 여기서부터)
  await click(atBar(30), midY);
  t = await meterOf();
  check('세 번째 변경점 추가', t.length === 3, JSON.stringify(t));
  await hist('undo'); await sleep(900);
  t = await meterOf();
  check('추가 되돌리기: 2개', t.length === 2, JSON.stringify(t));
  await hist('redo'); await sleep(900);
  t = await meterOf();
  check('추가 다시 실행: 3개', t.length === 3, JSON.stringify(t));
  await b.shot(OUT + '03_after_undo_redo.png');

  // 7) 재생이 같은 목록을 읽음
  const play = await api(`const d=await import('/static/js/pages/sequencer-meter.js');return JSON.stringify(d.playbackMeterChanges())`);
  check('재생 목록에 같은 개수', JSON.parse(play).length === 3, play);
} catch (e) {
  console.log('오류', e && e.message);
  results.push(false);
} finally {
  await api(`await m.api.put('/projects/14431/meter-changes',{changes:${JSON.stringify(meter0.map((c) => ({ tick: c.tick, time_sig_num: c.time_sig_num, time_sig_den: c.time_sig_den })))}})`);
  console.log('복원 후 박자', JSON.stringify(await meterOf()));
  console.log(results.filter(Boolean).length + '/' + results.length + ' 통과');
  b.close();
}
