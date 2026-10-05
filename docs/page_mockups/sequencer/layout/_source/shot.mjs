// layout.html?s=1..14 를 1440×960 PNG 로 → ../01_default.png … ../14_tempo_meter.png
// 사용: 이 폴더에서 node shot.mjs ..
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const OUT = path.resolve(DIR, process.argv[2] || '..');
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9348', `--user-data-dir=${path.join(DIR, 'profile')}`, '--hide-scrollbars', 'about:blank']);
await new Promise(r => setTimeout(r, 3000));
const t = (await (await fetch('http://127.0.0.1:9348/json')).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) pend.get(m.id)?.(m); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
for (const st of [1,2,3,4,5,6,7,8,9,10,11,12,13,14]) {
  await send('Page.navigate', { url: 'file:///' + path.join(DIR, 'layout.html').replace(/\\/g, '/') + '?s=' + st });
  await new Promise(r => setTimeout(r, st === 1 ? 2500 : 1000));
  const s = await send('Page.captureScreenshot', { clip: { x: 0, y: 0, width: 1440, height: 960, scale: 1 } });
  const name = ['01_default', '02_collab', '03_automation', '04_track_serial', '05_track_parallel', '06_piano_roll', '07_sample', '08_nyxi_agent', '09_automation_dialog', '10_layer_stack', '11_layer_track', '12_layer_from', '13_mixer', '14_tempo_meter'][st - 1] + '.png';
  fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64')); console.log(name);
}
ws.close(); chrome.kill();
