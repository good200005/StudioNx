// 시퀀서 색 시안 — ../../layout/_source/layout.html?s=N&theme=A|B|C|D 를 1440×960 PNG 로 → ../{A..D}_{01,05,06}.png
// 사용: 이 폴더에서 node shot.mjs ..
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const OUT = path.resolve(DIR, process.argv[2] || '..');
const PAGE = 'file:///' + path.resolve(DIR, '../../layout/_source/layout.html').replace(/\\/g, '/');
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9350', `--user-data-dir=${path.join(DIR, 'profile')}`, '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank']);
await new Promise(r => setTimeout(r, 3000));
const t = (await (await fetch('http://127.0.0.1:9350/json')).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) pend.get(m.id)?.(m); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
let first = true;
for (const th of ['A', 'B', 'C', 'D']) for (const st of [1, 5, 6]) {
  await send('Page.navigate', { url: `${PAGE}?s=${st}&theme=${th}` });
  await new Promise(r => setTimeout(r, first ? 2500 : 1000)); first = false;
  const s = await send('Page.captureScreenshot', { clip: { x: 0, y: 0, width: 1440, height: 960, scale: 1 } });
  const name = `${th}_${String(st).padStart(2, '0')}.png`;
  fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64')); console.log(name);
}
ws.close(); chrome.kill();
