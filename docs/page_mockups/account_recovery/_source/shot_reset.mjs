// resetPassword.html 목업 스크린샷 (mock_reset.html → mock_reset.png)
// 실행: node docs/page_mockups/account_recovery/_source/shot_reset.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..', '..');
const page = path.join(root, 'docs', 'page_mockups', 'account_recovery', 'mock_reset.html');
const out = path.join(root, 'docs', 'page_mockups', 'account_recovery', 'mock_reset.png');

const port = 9461;
const dir = process.env.TEMP + '\\cdp_mock_reset_' + port;
fs.rmSync(dir, { recursive: true, force: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--hide-scrollbars', '--window-size=1000,1200', 'about:blank']);
await new Promise(r => setTimeout(r, 1800));
const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) { const f = pend.get(m.id); if (f) f(m); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 1200, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: 'file:///' + page.replace(/\\/g, '/') });
await sleep(2500);
const h = (await send('Runtime.evaluate', { expression: 'document.body.scrollHeight', returnByValue: true })).result.result.value;
await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: Math.ceil(h) + 20, deviceScaleFactor: 2, mobile: false });
await sleep(400);
const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
console.log('wrote', out, '(height ' + Math.ceil(h) + ')');
ws.close(); chrome.kill();
