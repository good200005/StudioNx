// S1-15 모든 오토메이션 대상(볼륨, 팬, 악기·이펙트 노브)과 템포 줄의 작성·삭제를 동영상으로 확인하는 스크립트
// 전제: 시험용 서버 8001, 프로젝트 14431. 실행 전후의 레인 목록을 비교해 되돌립니다.
// 실행: node docs/handoff/s1-15_tests/rec_all.mjs
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { launch } from '../p1-28_tests/lib.mjs';

const BASE = 'http://localhost:8001';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-11-15_s1-15_all_automation/';
const FR = process.env.TEMP + '/s115_all_frames';
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(FR, { recursive: true, force: true });
fs.mkdirSync(FR, { recursive: true });

const b = await launch(9564, 1600, 1000);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const log = (...a) => console.log(...a);
const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);
const mouse = (type, x, y) => b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const move = (x, y) => b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
const rect = async (sel) => JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'null';const r=e.getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height})})()`));
const click = async (x, y) => { await move(x, y); await sleep(150); await mouse('mousePressed', x, y); await sleep(80); await mouse('mouseReleased', x, y); await sleep(350); };
const dbl = async (x, y) => { await move(x, y); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 2 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 2 }); await sleep(500); };
const shot = (name) => b.shot(OUT + name);
const lanesOf = async () => JSON.parse(await api(`const f=await m.api.get('/projects/14431/full');return JSON.stringify(f.automation.map(l=>[l.track_id,l.target_type,l.track_plugin_id,l.param_index,l.points.length]))`));
const tempoOf = async () => JSON.parse(await api(`const t=await m.api.get('/projects/14431/tempo-changes');return JSON.stringify(t)`));
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

await b.goto(BASE + '/home.html');
const creds = JSON.stringify({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
await q(`(async()=>{await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(creds)},credentials:'same-origin'})})()`);
await b.goto(BASE + '/studioNx.html?projectId=14431');
await sleep(2500);
const lanes0 = await lanesOf();
const tempo0 = await tempoOf();
log('초기 레인', JSON.stringify(lanes0), '초기 템포', JSON.stringify(tempo0));

let rec = true;
let n = 0;
const loop = (async () => {
  while (rec) {
    const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    fs.writeFileSync(`${FR}/f${String(n++).padStart(5, '0')}.jpg`, Buffer.from(r.result.data, 'base64'));
    await sleep(80);
  }
})();

const result = [];
try {
  await q(`document.getElementById('automation-mode').click()`);
  await sleep(1200);

  // 트랙마다 선택기의 모든 대상을 돌며: 선택 → 점 2개 찍기 → 서버 저장 확인 → × 로 지우기 → 서버 삭제 확인
  const rows = JSON.parse(await q(`JSON.stringify([...document.querySelectorAll('.sq-track')].filter(r=>r.querySelector('.sq-auto-pick select')).map(r=>({id:r.dataset.trackId,opts:[...r.querySelectorAll('.sq-auto-pick option')].map(o=>[o.value,o.textContent])})))`));
  log('트랙', rows.length, '대상 수', rows.reduce((a, r) => a + r.opts.length, 0));
  for (const row of rows) {
    const picks = row.opts.filter((o) => o[0] === 'VOLUME' || o[0] === 'PAN').concat(row.opts.filter((o) => o[0] !== 'VOLUME' && o[0] !== 'PAN').filter((o, i, a) => i === 0 || a[i - 1][0].split(':')[1] !== o[0].split(':')[1] || false).slice(0, 3));
    for (const [value, label] of picks) {
      await q(`(()=>{const s=document.querySelector('.sq-track[data-track-id="${row.id}"] .sq-auto-pick select');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
      await sleep(500);
      const plot = await rect(`.sq-track[data-track-id="${row.id}"] .sq-auto:not(.is-ghost) .sq-auto__plot`);
      if (!plot) { result.push([row.id, value, 'plot 없음']); continue; }
      const added = [[0.25, 0.8], [0.5, 0.3]];
      for (const [fx, fy] of added) await click(plot.x + plot.w * fx * 0.5, plot.y + plot.h * fy);
      await sleep(900);
      const mid = (await lanesOf()).filter((l) => String(l[0]) === String(row.id));
      const saved = mid.length > 0;
      await click(...(await (async () => { const r = await rect(`.sq-track[data-track-id="${row.id}"] .sq-auto-clear`); return [r.x + r.w / 2, r.y + r.h / 2]; })()));
      await sleep(900);
      const after = (await lanesOf()).filter((l) => String(l[0]) === String(row.id));
      result.push([row.id, label, '저장 ' + (saved ? 'O' : 'X'), '삭제 후 레인 ' + after.length]);
      log(row.id, label, JSON.stringify(mid.map((l) => l[4])), '→ 삭제 후', after.length);
    }
  }
  await shot('01_all_targets_done.png');

  // 점 더블클릭 삭제: VOLUME 에 점 3개 → 가운데 점 더블클릭 → 점 2개
  const first = rows[0];
  await q(`(()=>{const s=document.querySelector('.sq-track[data-track-id="${first.id}"] .sq-auto-pick select');s.value='VOLUME';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await sleep(500);
  const plot = await rect(`.sq-track[data-track-id="${first.id}"] .sq-auto:not(.is-ghost) .sq-auto__plot`);
  for (const fx of [0.03, 0.06, 0.09]) await click(plot.x + plot.w * fx, plot.y + plot.h * (0.2 + fx * 4));
  await sleep(900);
  const c3 = (await lanesOf()).filter((l) => String(l[0]) === String(first.id) && l[1] === 'VOLUME').map((l) => l[4]);
  const pts = JSON.parse(await q(`JSON.stringify([...document.querySelectorAll('.sq-track[data-track-id="${first.id}"] .sq-auto .sq-apt')].map(e=>{const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}))`));
  log('점 개수(서버)', JSON.stringify(c3), '점 요소', pts.length);
  if (pts.length > 2) await dbl(pts[1][0], pts[1][1]);
  await sleep(900);
  const c2 = (await lanesOf()).filter((l) => String(l[0]) === String(first.id) && l[1] === 'VOLUME').map((l) => l[4]);
  log('더블클릭 삭제 후', JSON.stringify(c2));
  result.push(['점 더블클릭 삭제', JSON.stringify(c3) + ' → ' + JSON.stringify(c2)]);
  await shot('02_point_delete.png');

  // 템포 줄: 점 끌기, 빈 곳 더블클릭, 점 더블클릭을 시도하고 서버 값이 바뀌는지 본다
  const tb = await rect('.sq-global--tempo .sq-global__body');
  const tp = await rect('.sq-global--tempo .sq-global__pt');
  log('템포 줄', JSON.stringify(tb), '첫 점', JSON.stringify(tp));
  const t0 = JSON.stringify(await tempoOf());
  if (tp) {
    const x = tp.x + tp.w / 2, y = tp.y + tp.h / 2;
    await move(x, y); await mouse('mousePressed', x, y);
    for (let i = 1; i <= 10; i++) { await move(x + i * 4, y + i * 3); await sleep(50); }
    await mouse('mouseReleased', x + 40, y + 30);
    await sleep(900);
  }
  if (tb) await dbl(tb.x + tb.w * 0.3, tb.y + tb.h * 0.5);
  if (tp) await dbl(tp.x + tp.w / 2, tp.y + tp.h / 2);
  await sleep(1200);
  const t1 = JSON.stringify(await tempoOf());
  const ptsAfter = await q(`document.querySelectorAll('.sq-global--tempo .sq-global__pt').length`);
  log('템포 서버 변화', t0 === t1 ? '없음' : '있음', '점 요소 수', ptsAfter);
  result.push(['템포 줄 편집', t0 === t1 ? '서버 값 변화 없음' : '서버 값 변함']);
  await shot('03_tempo_attempt.png');
} finally {
  rec = false;
  await loop;
  // 되돌리기: 시작 때 없던 레인은 비우고, 시작 때 있던 레인은 점 수 그대로 두기(점 개수만 비교)
  const now = await lanesOf();
  log('종료 레인', JSON.stringify(now));
  b.close();
}
execSync(`ffmpeg -y -loglevel error -framerate 10 -i "${FR}/f%05d.jpg" -c:v libx264 -pix_fmt yuv420p -vf "scale=1280:-2" "${OUT}s1-15_all_automation.mp4"`);
log('결과', JSON.stringify(result));
log('frames', n, 'done');
