// home.html 을 1440×900 화면으로 위에서부터 한 화면씩 캡처 (색 배치 참고용) → ./home_ref_N.png (git 제외)
// 사용: 이 폴더에서 node home_ref.mjs [http://127.0.0.1:8001]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const BASE = process.argv[2] || 'http://127.0.0.1:8001';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9349', `--user-data-dir=${path.join(DIR, 'profile')}`, '--hide-scrollbars', 'about:blank']);
await new Promise(r => setTimeout(r, 3000));
const t = (await (await fetch('http://127.0.0.1:9349/json')).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) pend.get(m.id)?.(m); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.result?.value;
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '/home.html' }); await new Promise(r => setTimeout(r, 3000));
const h = await ev(`(async () => { await document.fonts.ready;
  document.querySelectorAll('*').forEach(el => { el.style.animationPlayState = ''; });
  document.getAnimations().forEach(a => { try { a.finish(); } catch {} });
  for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); }
  document.getAnimations().forEach(a => { try { a.finish(); } catch {} });
  scrollTo(0, 0); await new Promise(r => setTimeout(r, 300));
  return document.documentElement.scrollHeight; })()`);
const shots = [];
for (let y = 0, i = 0; y < h; y += 900, i++) {
  await ev(`(async () => { scrollTo(0, ${y}); await new Promise(r => setTimeout(r, 500)); document.getAnimations().forEach(a => { try { a.finish(); } catch {} }); await new Promise(r => setTimeout(r, 200)); })()`);
  const s = await send('Page.captureScreenshot', { clip: { x: 0, y: 0, width: 1440, height: 900, scale: 0.5 } });
  fs.writeFileSync(path.join(DIR, `home_ref_${i}.png`), Buffer.from(s.result.data, 'base64')); shots.push(i);
}
console.log('home_ref_*.png', shots.length, h);
ws.close(); chrome.kill();
