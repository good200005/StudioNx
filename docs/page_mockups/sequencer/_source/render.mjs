// loader.html 을 시간을 멈춰 가며 30fps 프레임으로 → frames_<mode>/NNNN_<ms>.png
// 사용: node render.mjs open 3600  /  node render.mjs new 2400
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const MODE = process.argv[2] || 'open', TOTAL = +(process.argv[3] || 3600);
const OUT = path.join(DIR, 'frames_' + MODE); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
const STEP = 1000 / 30;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9345', `--user-data-dir=${path.join(DIR, 'profile')}`, '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank']);
await new Promise(r => setTimeout(r, 1500));
const t = (await (await fetch('http://127.0.0.1:9345/json')).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) pend.get(m.id)?.(m); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.result?.value;
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file:///' + path.join(DIR, 'loader.html').replace(/\\/g, '/') + '?mode=' + MODE }); await new Promise(r => setTimeout(r, 2500));
await ev(`document.fonts.ready.then(() => { document.getAnimations().forEach(a => { a.cancel(); a.play(); a.pause(); }); return 1; })`);
let n = 0;
for (let ms = 0; ms <= TOTAL; ms += STEP) {
  const m = Math.round(ms);
  await ev(`document.getAnimations().forEach(a => a.currentTime = ${m}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
  const s = await send('Page.captureScreenshot', { clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } });
  fs.writeFileSync(path.join(OUT, `${String(n++).padStart(4, '0')}_${m}.png`), Buffer.from(s.result.data, 'base64'));
}
console.log('frames', n);
ws.close(); chrome.kill();
