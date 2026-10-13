// star.html 의 시트(#s1, #s2)를 PNG 로 저장. node shot.mjs <출력 폴더> [pick]
// 사용: 이 폴더에서 node shot.mjs .. [추천 3안 번호, 예: 1,3,4] → ../03_star_variations.png, ../04_star_in_use.png
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const OUT = process.argv[2]; const pick = process.argv[3] || '1,3,4';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9340', `--user-data-dir=${path.join(DIR, 'profile')}`, '--hide-scrollbars', 'about:blank']);
await new Promise(r => setTimeout(r, 1500));
const t = (await (await fetch('http://127.0.0.1:9340/json')).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) pend.get(m.id)?.(m); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file:///' + path.join(DIR, 'star.html').replace(/\\/g, '/') + '?pick=' + pick });
await new Promise(r => setTimeout(r, 3000));
for (const [sid, name] of [['s1', '03_star_variations'], ['s2', '04_star_in_use']]) {
  const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(()=>{const b=document.getElementById('${sid}').getBoundingClientRect();return {y:b.top+scrollY,h:b.height}})()` });
  const { y, h } = r.result.result.value;
  const s = await send('Page.captureScreenshot', { captureBeyondViewport: true, clip: { x: 0, y, width: 1600, height: h, scale: 1 } });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(s.result.data, 'base64')); console.log(name, Math.round(h));
}
ws.close(); chrome.kill();
