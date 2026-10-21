// S1-13 실제 Sentry 전송 확인 — 화면에서 오류 하나를 일부러 내어 진짜 Sentry 가 받는지 봅니다 (이벤트 1건만 보냄).
// DSN 은 출력하지 않습니다 (호스트와 프로젝트 번호만 보여 줌).
// 사용 (저장소 맨 위에서):
//   $env:SENTRY_BROWSER_DSN = '<브라우저용 DSN>'; node docs/handoff/s1-13_tests/send_real_sentry.mjs
//   브라우저용 DSN 이 아직 없고 서버용 DSN 으로 한 번 시험하려면 --use-server-dsn  (studionx/.env 의 SENTRY_DSN 을 이 시험에서만 빌려 씀, 파일은 바꾸지 않음)
// 이 시험은 자기 앱 서버(8013)를 띄우고, 그 서버의 서버용 DSN(SENTRY_DSN)은 비워서 서버 쪽에서 같은 이벤트가 이중으로 가지 않게 합니다.
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { launch } from '../p1-28_tests/lib.mjs';

const REPO = process.cwd();
let dsn = (process.env.SENTRY_BROWSER_DSN || '').trim();
if (!dsn && process.argv.indexOf('--use-server-dsn') >= 0) {
  const env = fs.readFileSync(`${REPO}/studionx/.env`, 'utf-8');
  const m = /^SENTRY_DSN\s*=\s*(.*)$/m.exec(env);
  dsn = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
if (!dsn) { console.log('DSN 이 없습니다. SENTRY_BROWSER_DSN 을 정하거나 --use-server-dsn 을 붙이세요.'); process.exit(2); }
const parsed = /^https?:\/\/[^@]+@([^\/]+)\/(?:.*\/)?(\d+)\/?$/.exec(dsn);
console.log('보낼 곳: ' + (parsed ? '호스트 ' + parsed[1] + ', 프로젝트 ' + parsed[2] : '(DSN 모양을 읽지 못함)'));

const PORT = 8013;
const app = spawn(`${REPO}/studionx/.venv/Scripts/python.exe`, ['-m', 'uvicorn', 'app.main:app', '--port', String(PORT)], {
  cwd: `${REPO}/studionx/backend`,
  env: Object.assign({}, process.env, { SENTRY_DSN: '', SENTRY_BROWSER_DSN: dsn }),
  stdio: 'ignore',
});
const stop = () => { try { execSync(`taskkill /pid ${app.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { /* 이미 끝남 */ } };
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try { up = (await fetch(`http://localhost:${PORT}/api/v1/health`)).ok; } catch (e) { await new Promise((r) => setTimeout(r, 500)); }
}
if (!up) { console.log('앱 서버가 뜨지 않았습니다.'); stop(); process.exit(1); }

const b = await launch(9612, 1200, 800);
await b.send('Network.enable');
await b.goto(`http://localhost:${PORT}/home.html`);
const cfg = JSON.parse(await b.ev(`(async()=>{const r=await fetch('/api/v1/client-config'); return JSON.stringify(await r.json())})()`));
console.log('서버가 화면에 내려준 설정: DSN ' + (cfg.sentry_dsn ? '있음' : '없음') + ', 환경 ' + cfg.environment + ', 버전 ' + cfg.release);

const mark = b.events.length;
await b.ev(`setTimeout(function () { throw new Error('S1-13 Sentry connectivity test: safe to ignore (sent by the Studio Nx test script)'); }, 0); 1`);

let sentReq = null, status = null, reqId = null;
for (let i = 0; i < 80 && status === null; i++) {
  await b.sleep(150);
  b.events.slice(mark).forEach((e) => {
    if (e.method === 'Network.requestWillBeSent' && e.params.request.url.indexOf('/envelope/') > 0 && !sentReq) { sentReq = e.params.request; reqId = e.params.requestId; }
    if (e.method === 'Network.responseReceived' && e.params.requestId === reqId && reqId) status = e.params.response.status;
    if (e.method === 'Network.loadingFailed' && e.params.requestId === reqId && reqId && status === null) status = 'failed: ' + e.params.errorText;
  });
}
let eventId = null;
if (sentReq && sentReq.postData) { try { eventId = JSON.parse(sentReq.postData.split('\n')[0]).event_id; } catch (e) { /* 무시 */ } }
let body = '';
if (reqId && typeof status === 'number') {
  try { body = (await b.send('Network.getResponseBody', { requestId: reqId })).result.body; } catch (e) { body = '(응답 본문을 읽지 못함)'; }
}
console.log('envelope 요청: ' + (sentReq ? '보냄' : '보내지 않음'));
console.log('Sentry 응답 상태: ' + status);
console.log('Sentry 응답 본문: ' + body);
console.log('보낸 이벤트 번호: ' + eventId);
const ok = status === 200;
console.log(ok ? '\n결과: Sentry 가 이벤트를 받았습니다. 프로젝트의 Issues 에서 위 이벤트 번호나 "S1-13 Sentry connectivity test" 를 찾아 보세요.' : '\n결과: Sentry 가 받지 않았습니다. 위 상태와 본문을 보세요.');
stop();
await b.close();
process.exit(ok ? 0 : 1);
