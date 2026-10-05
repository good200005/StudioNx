// mix.html?fl=0..100 (10 단위)을 1440×900 PNG 로 → ../NN_ableton_A_fl_F.png, 그리고 한 장에 모은 ../00_overview.png 는 build 단계에서
// 사용: 이 폴더에서 node shot.mjs ..
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const OUT = path.resolve(DIR, process.argv[2] || '..');
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9347', `--user-data-dir=${path.join(DIR, 'profile')}`, '--hide-scrollbars', 'about:blank']);
await new Promise(r => setTimeout(r, 1500));
const t = (await (await fetch('http://127.0.0.1:9347/json')).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) pend.get(m.id)?.(m); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
for (let fl = 0; fl <= 100; fl += 10) {
  await send('Page.navigate', { url: 'file:///' + path.join(DIR, 'mix.html').replace(/\\/g, '/') + '?fl=' + fl });
  await new Promise(r => setTimeout(r, fl === 0 ? 2500 : 900));
  const s = await send('Page.captureScreenshot', { clip: { x: 0, y: 0, width: 1440, height: 960, scale: 1 } });
  const name = `${String(fl / 10 + 1).padStart(2, '0')}_ableton${100 - fl}_fl${fl}.png`;
  fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64')); console.log(name);
}
ws.close(); chrome.kill();
