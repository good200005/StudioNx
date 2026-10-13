// home.html 위에 로딩 오버레이를 넣고, 시간을 멈춰 가며 프레임 캡처 → frames/<콘셉트>/NNNN.png
// 사용: 개발 서버(localhost:8000) 실행 → 이 폴더에서 node render.mjs → python build.py
// 콘셉트 내용(CSS·HTML·시간)은 concepts.mjs — 실제 구현 때 CSS를 그대로 옮겨 쓸 수 있음
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { concepts } from './concepts.mjs';

const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const STEP = 40;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9336', `--user-data-dir=${path.join(DIR, 'profile')}`, '--hide-scrollbars', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', 'about:blank']);
await new Promise(r => setTimeout(r, 1500));
const t = (await (await fetch('http://127.0.0.1:9336/json')).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) pend.get(m.id)?.(m); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
const evalJs = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result?.value;
await send('Page.bringToFront'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

for (const [key, c] of Object.entries(concepts)) {
  await send('Page.navigate', { url: 'http://127.0.0.1:8000/home.html' }); await wait(2500);
  await evalJs(`(async () => {
    const s = document.createElement('style'); s.textContent = ${JSON.stringify(c.css)}; document.head.append(s);
    document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(c.html)});
    await document.fonts.ready;
    // 첫 화면 등장 애니메이션을 처음부터 다시 (로딩 뒤에 시작하도록 시간을 직접 조절)
    document.getAnimations().filter(a => a.timeline === document.timeline).forEach(a => { a.cancel(); a.play(); a.pause(); });
    return true; })()`);
  const out = path.join(DIR, 'frames', key); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  let n = 0;
  for (let ms = 0; ms <= c.total; ms += STEP) {
    await evalJs(`document.getAnimations().filter(a => a.timeline === document.timeline).forEach(a => {
      const inLoader = a.effect?.target?.closest?.('.ldr');
      a.currentTime = inLoader ? ${ms} : Math.max(0, ${ms} - ${c.hero}); });
      new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);
    const s = await send('Page.captureScreenshot', { clip: { x: 0, y: 0, width: 1440, height: 900, scale: 0.5 } });
    fs.writeFileSync(path.join(out, String(n++).padStart(4, '0') + `_${ms}.png`), Buffer.from(s.result.data, 'base64'));
  }
  console.log(key, n, 'frames');
}
ws.close(); chrome.kill();
