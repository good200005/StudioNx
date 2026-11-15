// S1-15 오토메이션·페이드 화면을 동영상으로 담는 스크립트 (CDP 스크린샷 연속 촬영 + ffmpeg)
// 전제: 시험용 서버 8001, 계정 s109-tester@example.com, 프로젝트 14431.
// 끝나면 스스로 만든 클립·샘플·오토메이션 레인을 지웁니다(시작 전에 있던 레인은 그대로 둠).
// 실행: node docs/handoff/s1-15_tests/rec.mjs
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { launch } from '../p1-28_tests/lib.mjs';

const BASE = 'http://localhost:8001';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-11-15_s1-15_automation_fades/';
const FR = process.env.TEMP + '/s115_frames';
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(FR, { recursive: true, force: true });
fs.mkdirSync(FR, { recursive: true });

const b = await launch(9562, 1600, 1000);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);
const log = (...a) => console.log(...a);

const nav = async (url) => {
  const before = b.events.length;
  const p = b.send('Page.navigate', { url });
  let done = false;
  p.then(() => { done = true; });
  for (let i = 0; i < 80 && !done; i++) {
    await sleep(150);
    if (b.events.slice(before).some((e) => e.method === 'Page.javascriptDialogOpening')) {
      await b.send('Page.handleJavaScriptDialog', { accept: true });
    }
  }
  await sleep(2500);
};
const mouse = (type, x, y) => b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const move = (x, y) => b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
const center = async (sel) => JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'null';const r=e.getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height})})()`));
const shot = (name) => b.shot(OUT + name);

await b.goto(BASE + '/home.html');
const creds = JSON.stringify({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
await q(`(async()=>{await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(creds)},credentials:'same-origin'})})()`);
await b.goto(BASE + '/studioNx.html?projectId=14431');

// 준비: 4초짜리 WAV 를 올리고 Vocal 트랙(4640)에 오디오 클립을 둔다. 시작 전 레인 목록도 기억한다.
const made = JSON.parse(await api(`
  const sr=8000,n=sr*4,buf=new ArrayBuffer(44+n*2),v=new DataView(buf);
  const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.round(Math.sin(i/8000*2*Math.PI*220)*12000),true);
  const s=await m.uploadSample(new File([buf],'fadedemo.wav',{type:'audio/wav'}));
  const c=await m.api.post('/tracks/4640/clips',{clip_type:'AUDIO',sample_id:s.sample_id,start_tick:0,length_tick:61440});
  const f=await m.api.get('/projects/14431/full');
  return JSON.stringify({s:s.sample_id,c:c.clip_id,lanes:f.automation.map(l=>l.lane_id)});`));
log('made', JSON.stringify(made));
await nav(BASE + '/studioNx.html?projectId=14431');

let rec = true;
let n = 0;
const loop = (async () => {
  while (rec) {
    const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    fs.writeFileSync(`${FR}/f${String(n++).padStart(5, '0')}.jpg`, Buffer.from(r.result.data, 'base64'));
    await sleep(60);
  }
})();

try {
  await sleep(1000);
  // 1) 오토메이션 모드 켜기
  await q(`document.getElementById('automation-mode').click()`);
  await sleep(1200);
  log('picks', await q(`document.querySelectorAll('.sq-auto-pick').length`), 'plots', await q(`document.querySelectorAll('.sq-auto__plot').length`));
  await shot('01_automation_mode.png');

  // 2) 첫 레인에 점을 찍고, 하나를 끌어 옮긴다
  const plot = await center('.sq-auto:not(.is-ghost) .sq-auto__plot');
  log('plot', JSON.stringify(plot));
  if (plot) {
    const pts = [[0.08, 0.2], [0.3, 0.7], [0.55, 0.35], [0.8, 0.8]];
    for (const [fx, fy] of pts) {
      const x = plot.x + plot.w * fx;
      const y = plot.y + plot.h * fy;
      await move(x, y); await sleep(250);
      await mouse('mousePressed', x, y); await sleep(120);
      await mouse('mouseReleased', x, y); await sleep(450);
    }
    const x0 = plot.x + plot.w * 0.3;
    const y0 = plot.y + plot.h * 0.7;
    await move(x0, y0);
    await mouse('mousePressed', x0, y0);
    for (let i = 1; i <= 12; i++) { await move(x0 + i * 6, y0 - i * 4); await sleep(40); }
    await mouse('mouseReleased', x0 + 72, y0 - 48);
    await sleep(900);
    await shot('02_automation_points.png');
  }
  await q(`document.getElementById('automation-mode').click()`);
  await sleep(1200);

  // 3) 페이드: 오디오 클립 선택 후 Ctrl+Alt+F, 핸들 끌기
  const clip = await center('.sq-clip--audio');
  log('audio clip', JSON.stringify(clip));
  if (clip) {
    const cx = clip.x + clip.w / 2;
    const cy = clip.y + clip.h / 2;
    await mouse('mousePressed', cx, cy); await mouse('mouseReleased', cx, cy); await sleep(600);
    await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70, modifiers: 3 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70, modifiers: 3 });
    await sleep(1000);
    log('handles', await q(`document.querySelectorAll('.sq-fade__h').length`));
    await shot('03_fade_default.png');
    const h = await center('.sq-fade__h[data-side="in"][data-what="len"]');
    log('in-handle', JSON.stringify(h));
    if (h) {
      const hx = h.x + h.w / 2;
      const hy = h.y + h.h / 2;
      await move(hx, hy); await sleep(300);
      await mouse('mousePressed', hx, hy);
      for (let i = 1; i <= 14; i++) { await move(hx + i * 5, hy); await sleep(45); }
      await mouse('mouseReleased', hx + 70, hy);
      await sleep(900);
    }
    const h2 = await center('.sq-fade__h[data-side="out"][data-what="len"]');
    if (h2) {
      const hx = h2.x + h2.w / 2;
      const hy = h2.y + h2.h / 2;
      await move(hx, hy); await sleep(300);
      await mouse('mousePressed', hx, hy);
      for (let i = 1; i <= 14; i++) { await move(hx - i * 5, hy); await sleep(45); }
      await mouse('mouseReleased', hx - 70, hy);
      await sleep(900);
    }
    await shot('04_fade_dragged.png');
  }
  await sleep(1500);

  // 저장 확인: 서버에 값이 남았는지
  log('saved', await api(`const f=await m.api.get('/projects/14431/full');const c=f.clips.find(x=>x.clip_type==='AUDIO');return JSON.stringify({fades:c&&[c.fade_in_tick,c.fade_out_tick],lanes:f.automation.map(l=>[l.target_type,l.points.length])})`));
} finally {
  rec = false;
  await loop;
  // 되돌리기: 만든 클립·샘플, 새로 생긴 레인
  await api(`
    const f=await m.api.get('/projects/14431/full');
    const keep=new Set(${JSON.stringify(made.lanes)});
    for(const l of f.automation){ if(!keep.has(l.lane_id)) await m.api.put('/tracks/'+l.track_id+'/automation',{target_type:l.target_type,track_plugin_id:l.track_plugin_id,param_index:l.param_index,points:[]}); }
    await m.api.delete('/clips/${made.c}').catch(()=>{});
    await m.api.delete('/samples/${made.s}').catch(()=>{});
    return 1`).catch((e) => log('cleanup', e.message));
  b.close();
}
execSync(`ffmpeg -y -loglevel error -framerate 12 -i "${FR}/f%05d.jpg" -c:v libx264 -pix_fmt yuv420p -vf "scale=1280:-2" "${OUT}s1-15_automation_fades.mp4"`);
log('frames', n, 'done');
