import { launch, check, summary } from './lib.mjs';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/ai-notes/images/';
const b = await launch(9508, 1280, 900); const q = e => b.ev(e);
const click = async (sel) => {
  const r = JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await b.sleep(250);
};
// 가짜 서버: window.fetch 를 바꿔 요청을 기록하고, 정해 둔 응답을 돌려줌 (실제 서버의 요청 횟수 제한과 메일 기록을 건드리지 않음)
const stub = (mode, delay = 0) => q(`(()=>{ window.__calls = []; window.fetch = (url, opts) => { window.__calls.push({url: String(url), method: opts && opts.method, body: opts && opts.body, headers: opts && opts.headers});
  const mk = (status, body) => new Response(body === null ? null : JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const run = () => { const m = ${JSON.stringify(mode)};
    if (m === 'ok') return mk(202, {message: 'If an account exists for that email, we\\'ve sent a message.'});
    if (m === '429-61') return mk(429, {error: {code: 'TOO_MANY_REQUESTS', message: 'SECRET server words', details: {retry_after: 61}}});
    if (m === '429-600') return mk(429, {error: {code: 'TOO_MANY_REQUESTS', message: 'x', details: {retry_after: 600}}});
    if (m === '429-1') return mk(429, {error: {code: 'TOO_MANY_REQUESTS', message: 'x', details: {retry_after: 1}}});
    if (m === '429-none') return mk(429, {error: {code: 'TOO_MANY_REQUESTS', message: 'x', details: null}});
    if (m === '422') return mk(422, {error: {code: 'VALIDATION_ERROR', message: 'SECRET server words', details: {email: 'bad'}}});
    if (m === '500') return mk(500, {error: {code: 'INTERNAL_ERROR', message: 'SECRET server words', details: null}});
    if (m === 'net') throw new TypeError('Failed to fetch');
    return mk(202, {}); };
  return new Promise((resolve, reject) => setTimeout(() => { try { resolve(run()); } catch (e) { reject(e); } }, ${delay})); }; 1 })()`);
const S = async () => JSON.parse(await q(`JSON.stringify({
  sent: getComputedStyle(document.getElementById('recover-sent')).display!=='none',
  who: document.getElementById('recover-sent-email').textContent,
  detail: document.getElementById('recover-sent-detail').textContent,
  pwErr: document.getElementById('recover-password-error').textContent, pwErrShown: !document.getElementById('recover-password-error').hidden,
  emErr: document.getElementById('recover-email-error').textContent, emErrShown: !document.getElementById('recover-email-error').hidden,
  pwBtn: document.querySelector('#recover-password-form button[type=submit]').disabled, emBtn: document.querySelector('#recover-email-form button[type=submit]').disabled,
  focus: document.activeElement.id, pwInvalid: document.getElementById('recover-password-email').getAttribute('aria-invalid'),
  last: window.__lastJson || null,
  calls: window.__calls.filter(c => c.url.indexOf('/password-reset') >= 0 || c.url.indexOf('/email-reminder') >= 0).length})`));
const setEmail = (id, v) => q(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(v)}; document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('input',{bubbles:true})); 1`);
const open = async () => { await q(`document.getElementById('login-recover').click(); 1`); await b.sleep(200); };

const run = async (u) => {
  await b.send('Page.navigate', { url: 'http://localhost:8000' + u }); await b.sleep(3500);
  await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(500);
  const wired = await q(`const m=document.getElementById('login-modal'); [window.__m.initRecover(m), window.__m.initRecoverForms(m), window.__m.initRecoverForms(m)]`);
  check(u + ': 연결하면 true (두 번 불러도)', JSON.stringify(wired) === '[true,true,true]', JSON.stringify(wired));
  await q(`document.getElementById('login-modal').showModal(); 1`); await b.sleep(250);

  // 1) Password 탭 성공
  await stub('ok'); await open();
  await setEmail('recover-password-email', '  you@example.com  ');
  await click('#recover-password-form button[type=submit]'); await b.sleep(300);
  let s = await S();
  const call = JSON.parse(await q(`JSON.stringify(window.__calls.filter(c => c.url.indexOf('/auth/refresh') < 0)[0])`));
  check(u + ': Password 탭: 올바른 주소와 POST, 공백을 뗀 이메일, JSON', call.url === '/api/v1/auth/password-reset/request' && call.method === 'POST' && JSON.parse(call.body).email === 'you@example.com', JSON.stringify(call));
  check(u + ': 한 번만 보냄', s.calls === 1, JSON.stringify(s));
  check(u + ': 성공하면 보낸 뒤 화면(30분 문장, 공백 뗀 이메일), 커서가 Back 버튼', s.sent && s.who === 'you@example.com' && s.detail === 'The link works for 30 minutes.' && s.focus === 'recover-sent-back', JSON.stringify(s));
  const last = JSON.parse(await q(`JSON.stringify(document.getElementById('login-modal').recoverLast)`));
  check(u + ': 성공한 요청의 종류와 이메일을 modal.recoverLast 에 남김', last && last.kind === 'password' && last.email === 'you@example.com', JSON.stringify(last));
  if (u === '/home.html') await b.shot(OUT + 'p1-28_forms_sent.png');
  await q(`document.getElementById('recover-sent-back').click(); 1`); await b.sleep(200);

  // 2) Email 탭 성공
  await stub('ok'); await open();
  await click('#recover-tab-email'); await setEmail('recover-email-email', 'maybe@example.com');
  await click('#recover-email-form button[type=submit]'); await b.sleep(300); s = await S();
  const call2 = JSON.parse(await q(`JSON.stringify(window.__calls.filter(c => c.url.indexOf('/auth/refresh') < 0)[0])`));
  check(u + ': Email 탭: 이메일 안내 주소로 보냄, 스팸함 문장', call2.url === '/api/v1/auth/email-reminder/request' && JSON.parse(call2.body).email === 'maybe@example.com' && s.sent && s.detail === "If you don't see it, check your spam folder.", JSON.stringify([call2, s]));
  await q(`document.getElementById('recover-sent-back').click(); 1`); await b.sleep(200);

  // 3) 실패 문구들
  const cases = [['429-61', 'Too many requests. Please try again in 2 minutes.'], ['429-600', 'Too many requests. Please try again in 10 minutes.'], ['429-1', 'Too many requests. Please try again in 1 minute.'], ['429-none', 'Too many requests. Please try again in 10 minutes.'], ['422', 'Please enter a valid email address.'], ['500', 'Something went wrong. Please try again.'], ['net', "Can't reach the server. Check your connection and try again."]];
  for (const [mode, text] of cases) {
    await stub(mode); await open(); await click('#recover-tab-password'); await setEmail('recover-password-email', 'a@example.com');
    await click('#recover-password-form button[type=submit]'); await b.sleep(300); s = await S();
    check(u + ': ' + mode + ' → "' + text + '", 보낸 뒤 화면은 안 뜸, 서버 문구 노출 없음', s.pwErrShown && s.pwErr === text && !s.sent && !s.pwErr.includes('SECRET'), JSON.stringify(s));
    check(u + ': ' + mode + ' → 커서가 입력칸으로, aria-invalid, 버튼이 다시 켜짐', s.focus === 'recover-password-email' && s.pwInvalid === 'true' && s.pwBtn === false, JSON.stringify(s));
    await q(`document.getElementById('recover-back').click(); 1`); await b.sleep(150);
  }
  // Email 탭의 실패는 Email 탭의 문구 자리에
  await stub('429-61'); await open(); await click('#recover-tab-email'); await setEmail('recover-email-email', 'a@example.com');
  await click('#recover-email-form button[type=submit]'); await b.sleep(300); s = await S();
  check(u + ': Email 탭의 실패는 Email 탭의 문구 자리에(Password 쪽은 비어 있음)', s.emErrShown && s.emErr.includes('2 minutes') && !s.pwErrShown && s.focus === 'recover-email-email', JSON.stringify(s));
  if (u === '/home.html') await b.shot(OUT + 'p1-28_forms_error.png');
  // 다시 적기 시작하면 오류가 사라짐
  await setEmail('recover-email-email', 'b@example.com'); s = await S();
  check(u + ': 다시 입력하면 오류 문구와 aria-invalid 가 사라짐', !s.emErrShown && s.emErr === '', JSON.stringify(s));
  await q(`document.getElementById('recover-back').click(); 1`); await b.sleep(150);

  // 4) 보내는 동안 버튼 잠김, 연속 전송은 한 번만
  await stub('ok', 600); await open(); await click('#recover-tab-password'); await setEmail('recover-password-email', 'slow@example.com');
  await q(`const f=document.getElementById('recover-password-form'); f.requestSubmit(); f.requestSubmit(); f.requestSubmit(); 1`); await b.sleep(900);
  s = await S();
  check(u + ': 보내는 동안 버튼이 잠기고 연속 세 번 전송해도 요청은 한 번', s.pwBtn === true && s.calls === 1, JSON.stringify(s));
  await b.sleep(1800); s = await S();
  check(u + ': 끝나면 버튼이 풀리고 보낸 뒤 화면, 요청은 여전히 한 번', s.pwBtn === false && s.sent && s.calls === 1, JSON.stringify(s));
  await q(`document.getElementById('recover-sent-back').click(); 1`); await b.sleep(200);

  // 5) 오류 뒤 새로 전송하면 이전 오류가 지워지고 성공
  await stub('500'); await open(); await click('#recover-tab-password'); await setEmail('recover-password-email', 'retry@example.com');
  await click('#recover-password-form button[type=submit]'); await b.sleep(300);
  await stub('ok');
  await click('#recover-password-form button[type=submit]'); await b.sleep(300); s = await S();
  check(u + ': 오류 뒤 다시 보내 성공하면 보낸 뒤 화면, 이전 오류는 지워짐', s.sent && s.pwErr === '' && !s.pwErrShown, JSON.stringify(s));
  await q(`document.getElementById('recover-sent-back').click(); 1`); await b.sleep(200);

  // 6) 형식이 틀린 이메일은 전송되지 않음 (브라우저 검사)
  await stub('ok'); await open(); await click('#recover-tab-password'); await setEmail('recover-password-email', 'not-an-email');
  await click('#recover-password-form button[type=submit]'); await b.sleep(400); s = await S();
  check(u + ': 형식이 틀린 이메일은 서버로 가지 않음', s.calls === 0 && !s.sent, JSON.stringify(s));
  await q(`(document.querySelector('.swal2-confirm')||{click(){}}).click(); document.getElementById('login-modal').close(); 1`); await b.sleep(300);
};
await run('/home.html'); await run('/join.html');
await b.send('Page.navigate', { url: 'http://localhost:8000/home.html' }); await b.sleep(3000);
await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(400);
const f = JSON.parse(await q(`(()=>{ const d=document.createElement('div'); d.innerHTML='<div data-view="recover"></div>'; document.body.appendChild(d);
  const half=document.createElement('div'); half.innerHTML='<form id="recover-password-form"></form>'; document.body.appendChild(half);
  return JSON.stringify({nullModal: window.__m.initRecoverForms(null), noForms: window.__m.initRecoverForms(d), noInput: window.__m.initRecoverForms(half)}) })()`));
check('모달이 null 이거나 폼이 없거나 이메일 칸이 없으면 false', f.nullModal === false && f.noForms === false && f.noInput === false, JSON.stringify(f));
summary(); await b.close();
