// S1-13 화면 시험 — 화면에서 난 JS 오류가 Sentry 로 가는지 (가짜 Sentry 서버로 받아서 확인)
// 이 시험은 자기 서버를 직접 띄웁니다: 가짜 Sentry 서버(임의 포트)와 앱 서버 두 개(8011: 화면용 DSN 이 가짜 Sentry 를 가리킴,
// 8012: 화면용 DSN 이 비어 있음). 앱 서버의 서버용 DSN(SENTRY_DSN)은 비워서 진짜 Sentry 로는 아무것도 가지 않습니다.
// 전제: DB 에 시험 계정 s109-tester@example.com 이 있음 (모든 페이지에서 처리기가 설치되는지 로그인 상태로 확인하려고)
// 실행: node docs/handoff/s1-13_tests/ui_sentry.mjs
import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const J = (v) => JSON.stringify(v);
const REPO = process.cwd();

/* ── 가짜 Sentry: 받은 요청을 모두 기록 (브라우저가 다른 출처로 보내므로 CORS 도 흉내) ── */
const received = [];
const mock = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    received.push({ method: req.method, url: req.url, headers: req.headers, body });
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
    res.end('{"id":"ok"}');
  });
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const mockPort = mock.address().port;

/* ── 앱 서버 두 개 ── */
const servers = [];
function startApp(port, browserDsn) {
  const child = spawn(`${REPO}/studionx/.venv/Scripts/python.exe`, ['-m', 'uvicorn', 'app.main:app', '--port', String(port)], {
    cwd: `${REPO}/studionx/backend`,
    env: Object.assign({}, process.env, { SENTRY_DSN: '', SENTRY_BROWSER_DSN: browserDsn }),
    stdio: 'ignore',
  });
  servers.push(child);
  return child;
}
async function waitUp(port) {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${port}/api/v1/health`); if (r.ok) return true; } catch (e) { /* 아직 */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
function stopAll() {
  servers.forEach((s) => { try { execSync(`taskkill /pid ${s.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { /* 이미 끝남 */ } });
  try { mock.close(); } catch (e) { /* 무시 */ }
}

startApp(8011, `http://testkey@127.0.0.1:${mockPort}/7`);
startApp(8012, '');
const up = (await waitUp(8011)) && (await waitUp(8012));
check('시험용 앱 서버 두 개가 떴음 (8011: 가짜 Sentry, 8012: DSN 없음)', up);
if (!up) { stopAll(); process.exit(1); }

const b = await launch(9611, 1400, 900);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const nav = async (url) => {
  const before = b.events.length;
  const p = b.send('Page.navigate', { url });
  let done = false; p.then(() => { done = true; });
  for (let i = 0; i < 80 && !done; i++) {
    await sleep(150);
    if (b.events.slice(before).some((e) => e.method === 'Page.javascriptDialogOpening')) await b.send('Page.handleJavaScriptDialog', { accept: true });
  }
  await sleep(1800);
};
const events = () => received.map((r) => JSON.parse(r.body.split('\n')[2]));

/* ── 1. 서버가 화면에 DSN 을 내려줌 ── */
await nav('http://localhost:8011/home.html');
const cfg = JSON.parse(await q(`(async()=>{const r=await fetch('/api/v1/client-config'); return JSON.stringify(await r.json())})()`));
check('8011: /client-config 가 화면용 DSN 을 줌', cfg.sentry_dsn === `http://testkey@127.0.0.1:${mockPort}/7` && cfg.release === 'studionx@0.1.0', J(cfg));
check('오류가 나기 전에는 아무것도 보내지 않음 (페이지를 열기만 해서는 요청이 없음)', received.length === 0, 'received=' + received.length);

/* ── 2. 오류를 일부러 냄: 주소에 토큰이 든 채로 ── */
await nav('http://localhost:8011/home.html?token=URLSECRET#access_token=HASHSECRET');
await q(`(async()=>{
  const m = await import('/static/js/core/api.js');
  // 1) 잡히지 않은 오류 (이메일과 토큰이 문구에 들어 있음)
  setTimeout(function () { throw new Error('S1-13 uncaught user@example.com token=abc123XYZ'); }, 0);
  // 2) 처리하지 않은 Promise 거절
  Promise.reject(new Error('S1-13 rejected promise'));
  // 3) 서버가 일부러 준 오류(ApiError)는 보내지 않아야 함
  Promise.reject(new m.ApiError(401, 'UNAUTHORIZED', 'Please sign in'));
  // 4) 같은 자리에서 두 번 나는 오류는 한 번만
  window.__boom = function () { throw new Error('S1-13 repeated'); };
  setTimeout(window.__boom, 0);
  setTimeout(window.__boom, 10);
  // 5) 무해한 브라우저 알림과 내용 없는 오류는 보내지 않아야 함
  setTimeout(function () { throw new Error('ResizeObserver loop completed with undelivered notifications.'); }, 20);
  return 1;
})()`);
await sleep(2500);
const evs = events();
const msgs = evs.map((e) => e.exception && e.exception.values[0].value).filter(Boolean);
check('보낸 오류는 3건 (잡히지 않은 오류, Promise 거절, 반복 오류 한 번)', received.length === 3, J(msgs));
check('ApiError 와 ResizeObserver 알림은 보내지 않았음', !msgs.some((m) => /Please sign in|ResizeObserver/.test(m)), J(msgs));
check('같은 자리에서 두 번 난 오류는 한 번만', msgs.filter((m) => m.indexOf('S1-13 repeated') >= 0).length === 1, J(msgs));

const r0 = received[0];
check('가짜 Sentry 의 envelope 주소로 POST (프로젝트 7, 키 testkey)', received.every((r) => r.method === 'POST' && r.url.indexOf('/api/7/envelope/?sentry_key=testkey') === 0), J(received.map((r) => r.url)));
check('쿠키, 인증 헤더, Referer 를 보내지 않음', received.every((r) => !r.headers.cookie && !r.headers.authorization && !r.headers.referer), J(Object.keys(r0.headers)));

const all = received.map((r) => r.body).join('\n');
check('보낸 내용 어디에도 주소의 토큰(query, hash)이 없음', all.indexOf('URLSECRET') < 0 && all.indexOf('HASHSECRET') < 0);
check('문구의 이메일과 토큰이 지워짐', all.indexOf('user@example.com') < 0 && all.indexOf('abc123XYZ') < 0 && all.indexOf('[email]') > 0 && all.indexOf('token=[Filtered]') > 0);

const uncaught = evs.filter((e) => e.exception && e.exception.values[0].value.indexOf('S1-13 uncaught') === 0)[0];
check('잡히지 않은 오류: mechanism onerror, 종류 Error', uncaught && uncaught.exception.values[0].mechanism.type === 'onerror' && uncaught.exception.values[0].type === 'Error', J(uncaught && uncaught.exception.values[0].mechanism));
const rejected = evs.filter((e) => e.exception && e.exception.values[0].value.indexOf('S1-13 rejected') === 0)[0];
check('Promise 거절: mechanism onunhandledrejection', rejected && rejected.exception.values[0].mechanism.type === 'onunhandledrejection');
check('이벤트의 환경, 버전, 경로, 브라우저 정보', uncaught && uncaught.environment === 'dev' && uncaught.release === 'studionx@0.1.0'
  && uncaught.tags.page === '/home.html' && uncaught.request.url === 'http://localhost:8011/home.html' && /Chrome|Edg/.test(uncaught.request.headers['User-Agent']), J(uncaught && { e: uncaught.environment, r: uncaught.release, t: uncaught.tags, u: uncaught.request.url }));
check('스택이 frames 로 들어 있고, 파일 주소에 query 가 없음', uncaught && uncaught.exception.values[0].stacktrace && uncaught.exception.values[0].stacktrace.frames.length > 0
  && uncaught.exception.values[0].stacktrace.frames.every((f) => f.filename.indexOf('?') < 0), J(uncaught && uncaught.exception.values[0].stacktrace));
check('envelope 이 세 덩어리(머리, 항목 머리, 이벤트)', r0.body.split('\n').length === 3 && JSON.parse(r0.body.split('\n')[1]).type === 'event');

/* ── 3. 한도: 한 화면에서 10건까지 ── */
await nav('http://localhost:8011/home.html');
const before = received.length;
await q(`(()=>{ for (var i = 0; i < 30; i++) { (function (n) { setTimeout(function () { throw new Error('S1-13 flood ' + n); }, n); })(i); } return 1; })()`);
await sleep(3000);
const flood = received.length - before;
check('오류가 쏟아져도 한 화면에서 10건까지만 보냄 (실제 ' + flood + '건)', flood === 10, 'flood=' + flood);

/* ── 4. 모든 페이지에 처리기가 설치됨 (로그인 상태) ── */
await nav('http://localhost:8011/home.html');
const creds = J({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
const status = await q(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${J(creds)},credentials:'same-origin'});return r.status})()`);
check('시험 계정으로 로그인(200)', status === 200, 'status=' + status);
for (const page of ['home.html', 'join.html', 'myPage.html', 'myProject.html', 'privacy.html', 'resetPassword.html', 'userInfo.html', 'studioNx.html']) {
  await nav('http://localhost:8011/' + page);
  const landed = await q('location.pathname');
  const on = await q('window.__snxErrorHandlers === true');
  check('처리기가 설치됨: ' + page + (landed !== '/' + page ? ' (이동한 곳 ' + landed + ')' : ''), on === true && landed === '/' + page, landed);
}

/* ── 5. DSN 이 비어 있으면 아무것도 보내지 않음 (8012) ── */
const countBefore = received.length;
await nav('http://localhost:8012/home.html');
const cfgEmpty = JSON.parse(await q(`(async()=>{const r=await fetch('/api/v1/client-config'); return JSON.stringify(await r.json())})()`));
check('8012: /client-config 의 DSN 이 빔', cfgEmpty.sentry_dsn === '', J(cfgEmpty));
await q(`setTimeout(function () { throw new Error('S1-13 no dsn'); }, 0); 1`);
await sleep(2000);
check('DSN 이 비어 있으면 오류가 나도 아무것도 보내지 않음', received.length === countBefore, 'before=' + countBefore + ' after=' + received.length);

stopAll();
await b.close();
process.exit(summary() ? 0 : 1);
