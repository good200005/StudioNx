// resetPassword.html 실제 페이지 3상태 스크린샷 (개발 서버 8000)
// 실행: node docs/page_mockups/account_recovery/_source/shot_reset_live.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..');
const port = 9462;
const dir = process.env.TEMP + '\\cdp_reset_live_' + port;
fs.rmSync(dir, { recursive: true, force: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--hide-scrollbars', '--window-size=1100,1400', 'about:blank']);
await new Promise(r => setTimeout(r, 1800));
const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) { const f = pend.get(m.id); if (f) f(m); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
const shot = async file => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); };

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1400, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: 'http://localhost:8000/resetPassword.html' });
await sleep(2500);

await shot(path.join(outDir, 'live_reset_default.png'));
console.log('default done', await ev("JSON.stringify({form:getComputedStyle(document.getElementById('reset-form')).display, invalid:getComputedStyle(document.getElementById('reset-invalid')).display, done:getComputedStyle(document.getElementById('reset-done')).display})"));

await ev("document.getElementById('reset-invalid').hidden=false;document.querySelector('.reset__card').classList.add('is-locked');document.getElementById('reset-recover-row').hidden=false;document.getElementById('reset-form').querySelectorAll('input,button').forEach(function(e){e.disabled=true;});");
await sleep(400);
await shot(path.join(outDir, 'live_reset_invalid.png'));
console.log('invalid done', await ev("JSON.stringify({form:getComputedStyle(document.getElementById('reset-form')).display, invalid:getComputedStyle(document.getElementById('reset-invalid')).display, done:getComputedStyle(document.getElementById('reset-done')).display})"));

await ev("document.getElementById('reset-sub').hidden=true;document.getElementById('reset-form').hidden=true;document.getElementById('reset-invalid').hidden=true;document.getElementById('reset-recover-row').hidden=true;document.querySelector('.reset__card').classList.remove('is-locked');document.getElementById('reset-done').hidden=false;");
await sleep(400);
await shot(path.join(outDir, 'live_reset_done.png'));
console.log('done', await ev(`(function(){
  var title=document.getElementById('reset-title').getBoundingClientRect();
  var icon=document.querySelector('.reset__done-icon').getBoundingClientRect();
  var h2=document.querySelector('.reset__done-title').getBoundingClientRect();
  return JSON.stringify({
    form:getComputedStyle(document.getElementById('reset-form')).display,
    gap_title_icon: Math.round(icon.top - title.bottom),
    gap_icon_h2: Math.round(h2.top - icon.bottom)
  });
})()`));

ws.close(); chrome.kill();
