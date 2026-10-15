import { launch, check, summary } from './lib.mjs';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/ai-notes/images/';
const b = await launch(9512, 1280, 900); const q = e => b.ev(e);
const click = async (sel) => {
  const r = JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await b.sleep(300);
};
const stub = (mode, delay = 0) => q(`(()=>{ window.__calls = []; window.fetch = (url, opts) => { window.__calls.push({url: String(url), body: opts && opts.body});
  const mk = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const run = () => { const m = ${JSON.stringify(mode)};
    if (m === '429-90') return mk(429, {error: {code: 'TOO_MANY_REQUESTS', message: 'SECRET', details: {retry_after: 90}}});
    if (m === '429-none') return mk(429, {error: {code: 'TOO_MANY_REQUESTS', message: 'SECRET', details: null}});
    if (m === '500') return mk(500, {error: {code: 'INTERNAL_ERROR', message: 'SECRET', details: null}});
    if (m === 'net') throw new TypeError('Failed to fetch');
    return mk(202, {message: 'ok'}); };
  return new Promise((resolve, reject) => setTimeout(() => { try { resolve(run()); } catch (e) { reject(e); } }, ${delay})); }; 1 })()`);
const S = async () => JSON.parse(await q(`JSON.stringify({
  dis: document.getElementById('recover-resend').disabled, note: document.getElementById('recover-resend-wait').textContent,
  err: document.getElementById('recover-resend-error').textContent, errShown: !document.getElementById('recover-resend-error').hidden,
  detail: document.getElementById('recover-sent-detail').textContent, who: document.getElementById('recover-sent-email').textContent,
  timer: !!document.getElementById('login-modal').recoverTimer,
  sent: getComputedStyle(document.getElementById('recover-sent')).display!=='none',
  calls: window.__calls.filter(c => c.url.indexOf('/password-reset') >= 0 || c.url.indexOf('/email-reminder') >= 0).map(c => c.url.replace('/api/v1/auth','') + ' ' + c.body)})`));
const setEmail = (id, v) => q(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(v)}; 1`);
const unlock = () => q(`window.__m.startResendCooldown(document.getElementById('login-modal'), 0.3); 1`);

const run = async (u) => {
  await b.send('Page.navigate', { url: 'http://localhost:8000' + u }); await b.sleep(3500);
  await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(500);
  const wired = await q(`window.__m.initRecoverResend(document.getElementById('login-modal'))`);
  check(u + ': 연결하면 true', wired === true);
  const sendFirst = async (kind, email) => {
    await stub('ok'); await q(`document.getElementById('login-modal').open || document.getElementById('login-modal').showModal(); document.getElementById('login-recover').click(); 1`); await b.sleep(200);
    if (kind === 'email') { await click('#recover-tab-email'); await setEmail('recover-email-email', email); await click('#recover-email-form button[type=submit]'); }
    else { await setEmail('recover-password-email', email); await click('#recover-password-form button[type=submit]'); }
    await b.sleep(400);
  };

  // 1) 처음 보낸 뒤: 잠겨 있고 60초부터 셈
  await sendFirst('password', 'you@example.com'); let s = await S();
  check(u + ': 처음 보낸 직후 send again 은 잠기고 (available in 60s), 타이머가 돎', s.sent && s.dis && s.note === '(available in 60s)' && s.timer, JSON.stringify(s));
  // 잠긴 동안 눌러도 요청이 가지 않음
  await q(`document.getElementById('recover-resend').click(); 1`); await b.sleep(300); s = await S();
  check(u + ': 잠긴 동안은 눌러도 다시 보내지 않음', s.calls.length === 1, JSON.stringify(s));

  // 2) 풀린 뒤 실제 클릭: 같은 종류, 같은 이메일로 다시 보냄
  await unlock(); await b.sleep(1300); s = await S();
  check(u + ': (준비) 시간이 지나 풀림', s.dis === false && s.note === '', JSON.stringify(s));
  await stub('ok'); await click('#recover-resend'); await b.sleep(400); s = await S();
  check(u + ': 클릭하면 같은 주소로 같은 이메일을 다시 보냄(한 번)', s.calls.length === 1 && s.calls[0] === '/password-reset/request {"email":"you@example.com"}', JSON.stringify(s));
  check(u + ': 성공하면 "We\'ve sent it again." 문장, 새 1분(잠김, 60s), 오류 없음', s.detail === "We've sent it again. The link works for 30 minutes." && s.dis && s.note === '(available in 60s)' && !s.errShown, JSON.stringify(s));
  if (u === '/home.html') await b.shot(OUT + 'p1-28_resend_done.png');

  // 3) 429: 서버가 알려 준 시간만큼 다시 잠금 + 문구
  await unlock(); await b.sleep(1300);
  await stub('429-90'); await click('#recover-resend'); await b.sleep(400); s = await S();
  check(u + ': 429(90초): 문구 "2 minutes", 서버 문구 노출 없음, 90초로 다시 잠금', s.errShown && s.err === 'Too many requests. Please try again in 2 minutes.' && !s.err.includes('SECRET') && s.dis && s.note === '(available in 90s)', JSON.stringify(s));
  await unlock(); await b.sleep(1300);
  await stub('429-none'); await click('#recover-resend'); await b.sleep(400); s = await S();
  check(u + ': 429(시간 모름): 문구는 보이고 버튼은 풀려 다시 누를 수 있음', s.errShown && s.err.includes('10 minutes') && s.dis === false, JSON.stringify(s));
  // 4) 500, 연결 실패: 문구 + 버튼 풀림
  for (const [mode, text] of [['500', 'Something went wrong. Please try again.'], ['net', "Can't reach the server. Check your connection and try again."]]) {
    await stub(mode); await click('#recover-resend'); await b.sleep(400); s = await S();
    check(u + ': ' + mode + ' → 문구, 버튼은 다시 누를 수 있음(잠기지 않음)', s.errShown && s.err === text && s.dis === false && s.note === '', JSON.stringify(s));
  }
  // 5) 오류 뒤 성공하면 오류 문구가 사라짐
  await stub('ok'); await click('#recover-resend'); await b.sleep(400); s = await S();
  check(u + ': 오류 뒤 성공하면 오류가 지워지고 새 1분', !s.errShown && s.err === '' && s.dis && s.note === '(available in 60s)', JSON.stringify(s));

  // 6) 보내는 동안 연속 클릭은 한 번만
  await unlock(); await b.sleep(1300);
  await stub('ok', 600);
  await q(`const r=document.getElementById('recover-resend'); r.click(); r.click(); r.click(); 1`); await b.sleep(800); s = await S();
  check(u + ': 보내는 동안 버튼이 잠기고 연속 세 번 눌러도 요청은 한 번', s.dis && s.calls.length === 1, JSON.stringify(s));
  await b.sleep(900);

  // 7) Back to Sign In: 시간 세기가 멈추고 다음에는 새로
  await click('#recover-sent-back'); s = await S();
  check(u + ': Back to Sign In 하면 타이머가 멈추고 잠김, 글자와 오류가 비워짐', s.timer === false && s.dis && s.note === '' && !s.errShown, JSON.stringify(s));
  await b.sleep(1200); s = await S();
  check(u + ': 돌아온 뒤 시간이 지나도 풀리거나 글자가 생기지 않음', s.dis && s.note === '', JSON.stringify(s));

  // 8) Email 탭도 같은 방식(다른 주소)
  await sendFirst('email', 'maybe@example.com'); await unlock(); await b.sleep(1300);
  await stub('ok'); await click('#recover-resend'); await b.sleep(400); s = await S();
  check(u + ': Email 탭: 이메일 안내 주소로 다시 보내고 스팸함 문장', s.calls[0] === '/email-reminder/request {"email":"maybe@example.com"}' && s.detail === "We've sent it again. If you don't see it, check your spam folder.", JSON.stringify(s));

  // 9) 모달을 닫으면 타이머 정리
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(300); s = await S();
  check(u + ': 모달을 닫으면 타이머가 정리되고 잠김', s.timer === false && s.dis && s.note === '', JSON.stringify(s));
  // 10) 새로 열어 처음 보내면 다시 60초부터
  await sendFirst('password', 'again@example.com'); s = await S();
  check(u + ': 다시 열어 보내면 새로 60초부터', s.dis && s.note === '(available in 60s)' && s.who === 'again@example.com', JSON.stringify(s));
  // 11) 보낸 적 없는데 눌림(남긴 값 없음)
  await q(`const m=document.getElementById('login-modal'); delete m.recoverLast; window.__m.startResendCooldown(m, 0.2); 1`); await b.sleep(1300);
  await stub('ok'); await q(`document.getElementById('recover-resend').click(); 1`); await b.sleep(300); s = await S();
  check(u + ': 남긴 값(recoverLast)이 없으면 눌러도 아무것도 하지 않음', s.calls.length === 0, JSON.stringify(s));
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(250);
};
await run('/home.html'); await run('/join.html');
await b.send('Page.navigate', { url: 'http://localhost:8000/home.html' }); await b.sleep(3000);
await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(400);
const f = JSON.parse(await q(`(()=>{ const d=document.createElement('div'); d.innerHTML='<div></div>'; document.body.appendChild(d); return JSON.stringify({nullModal: window.__m.initRecoverResend(null), noButton: window.__m.initRecoverResend(d)}) })()`));
check('모달이 null 이거나 버튼이 없으면 false', f.nullModal === false && f.noButton === false, JSON.stringify(f));
summary(); await b.close();
