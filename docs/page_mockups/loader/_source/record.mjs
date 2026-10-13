// 실제 home.html 을 새로 열면서 실시간 녹화 (CDP screencast) → rec/NNNNN_<ms>.jpg
// 사용: 개발 서버 실행 → node record.mjs [폭 높이] (기본 1440 900, 모바일은 390 844) → python encode.py <출력.mp4> 500 3300 (imageio-ffmpeg 필요)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const OUT = path.join(DIR, 'rec'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9342', `--user-data-dir=${path.join(DIR, 'profile7')}`, '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank']);
await new Promise(r => setTimeout(r, 1500));
const t = (await (await fetch('http://127.0.0.1:9342/json')).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0, n = 0, t0 = null; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id) return pend.get(m.id)?.(m);
  if (m.method === 'Page.screencastFrame') {
    const ts = m.params.metadata.timestamp * 1000; t0 ??= ts;
    fs.writeFileSync(path.join(OUT, `${String(n++).padStart(5, '0')}_${Math.round(ts - t0)}.jpg`), Buffer.from(m.params.data, 'base64'));
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId });
  }
});
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 800 });
await send('Page.navigate', { url: 'about:blank' }); await new Promise(r => setTimeout(r, 300));
await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
await new Promise(r => setTimeout(r, 300));
await send('Page.navigate', { url: 'http://127.0.0.1:8000/home.html' });   // 첫 접속처럼 새로 열기
await new Promise(r => setTimeout(r, 4000));
await send('Page.stopScreencast');
console.log('frames', n);
ws.close(); chrome.kill();
