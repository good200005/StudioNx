import { spawn } from 'node:child_process';
import fs from 'node:fs';
export async function launch(port = 9450, w = 1280, h = 900) {
  const dir = process.env.TEMP + '\cdp_p124_' + port; fs.rmSync(dir, { recursive: true, force: true });
  const chrome = spawn(process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--hide-scrollbars', `--window-size=${w},${h}`, 'about:blank']);
  await new Promise(r => setTimeout(r, 1800));
  const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page');
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const events = [];
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) { const f = pend.get(m.id); if (f) f(m); } else events.push(m); });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const goto = async url => { await send('Page.navigate', { url }); await sleep(2500); };
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : r.result.exceptionDetails)); return r.result && r.result.result ? r.result.result.value : undefined; };
  const shot = async file => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); };
  const resize = (w2, h2, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width: w2, height: h2, deviceScaleFactor: 1, mobile });
  const close = () => { try { ws.close(); } catch (e) {} chrome.kill(); };
  return { send, goto, ev, sleep, shot, close, events, resize };
}
let pass = 0, fail = 0;
export function check(name, ok, detail = '') { if (ok) pass++; else fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + detail)); }
export function summary() { console.log(`\n${pass}/${pass + fail} passed`); return fail === 0; }
