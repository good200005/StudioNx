// sampler.html 을 상태별로 캡처 → ../NN_*.png
// 사용: node shot.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const OUT = path.join(DIR, '..');
const SHOTS = [
  ['01_classic', 's=classic'],
  ['02_oneshot', 's=oneshot'],
  ['03_empty', 's=empty'],
  ['04_picker', 's=picker'],
  ['05_cards_on_track', 's=card'],
];
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9347', `--user-data-dir=${path.join(DIR, 'profile')}`, '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank']);
await new Promise(r => setTimeout(r, 1500));
const t = (await (await fetch('http://127.0.0.1:9347/json')).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
for (const [name, query] of SHOTS) {
  await send('Page.navigate', { url: 'file:///' + path.join(DIR, 'sampler.html').replace(/\\/g, '/') + '?' + query });
  await new Promise(r => setTimeout(r, 2500));
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => 1)', awaitPromise: true });
  const s = await send('Page.captureScreenshot', { clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(s.result.data, 'base64'));
  console.log(name);
}
ws.close(); chrome.kill();
