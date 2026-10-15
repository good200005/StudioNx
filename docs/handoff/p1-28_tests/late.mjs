import { launch, check, summary } from './lib.mjs';
const b = await launch(9513, 1280, 900); const q = e => b.ev(e);
const click = async (sel) => {
  const r = JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await b.sleep(250);
};
// 응답이 늦게 도착하는 가짜 서버. mode: ok | 500
const stub = (mode, delay) => q(`(()=>{ window.__calls = []; window.fetch = (url, opts) => { window.__calls.push(String(url));
  const mk = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const isRecover = String(url).indexOf('/auth/refresh') < 0;
  return new Promise(resolve => setTimeout(() => resolve(isRecover ? (${JSON.stringify(mode)} === 'ok' ? mk(202, {message: 'ok'}) : mk(500, {error: {code: 'INTERNAL_ERROR', message: 'x', details: null}})) : mk(401, {error: {code: 'UNAUTHORIZED', message: 'x', details: null}})), isRecover ? ${delay} : 0)); }; 1 })()`);
const S = async () => JSON.parse(await q(`JSON.stringify({
  login: getComputedStyle(document.querySelector('[data-view=login]')).display!=='none',
  recover: getComputedStyle(document.querySelector('[data-view=recover]')).display!=='none',
  sent: getComputedStyle(document.getElementById('recover-sent')).display!=='none',
  tabs: getComputedStyle(document.querySelector('[role=tablist]')).display!=='none',
  pwErr: !document.getElementById('recover-password-error').hidden, resendErr: !document.getElementById('recover-resend-error').hidden,
  timer: !!document.getElementById('login-modal').recoverTimer, last: !!document.getElementById('login-modal').recoverLast,
  open: document.getElementById('login-modal').open, title: document.getElementById('login-modal-title').textContent})`));

const run = async (u) => {
  await b.send('Page.navigate', { url: 'http://localhost:8000' + u }); await b.sleep(3500);
  await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(500);
  await q(`(()=>{ const m=document.getElementById('login-modal'); window.__m.initRecover(m); window.__m.initRecoverForms(m); window.__m.initRecoverResend(m); })(); 1`);
  const openRecover = async () => { await q(`(()=>{ const m=document.getElementById('login-modal'); m.open || m.showModal(); document.getElementById('login-recover').click(); })(); 1`); await b.sleep(200); };
  const typeAndSend = async (email) => { await q(`document.getElementById('recover-password-email').value=${JSON.stringify(email)}; 1`); await click('#recover-password-form button[type=submit]'); };

  // A) 보낸 뒤 응답이 오기 전에 Back to Sign In
  await stub('ok', 1500); await openRecover(); await typeAndSend('late@example.com'); await b.sleep(300);
  await click('#recover-back');
  let s = await S();
  check(u + ': (A) 응답 전에 Back: 로그인 화면', s.login && !s.recover, JSON.stringify(s));
  await b.sleep(3200); s = await S();
  check(u + ': (A) 늦게 온 성공 응답은 버려짐: 보낸 뒤 화면이 뜨지 않고, 로그인 화면 그대로, 타이머와 recoverLast 없음', s.login && !s.recover && !s.sent && !s.timer && !s.last && s.title === 'Sign In', JSON.stringify(s));

  // B) 응답 전에 모달을 닫음 → 다시 열면 로그인 화면
  await stub('ok', 1500); await openRecover(); await typeAndSend('late2@example.com'); await b.sleep(300);
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(3200);
  await q(`document.getElementById('login-modal').showModal(); 1`); await b.sleep(250); s = await S();
  check(u + ': (B) 응답 전에 모달을 닫으면 늦은 응답이 화면을 바꾸지 않음: 다시 열면 로그인 화면', s.open && s.login && !s.recover && !s.sent && !s.timer && !s.last, JSON.stringify(s));
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(250);

  // C) 늦게 온 실패 응답도 버려짐(오류 문구가 뜨지 않음)
  await stub('500', 1500); await openRecover(); await typeAndSend('late3@example.com'); await b.sleep(300);
  await click('#recover-back'); await b.sleep(3200); s = await S();
  await openRecover(); const again = await S();
  check(u + ': (C) 늦게 온 실패 응답도 버려짐: 오류 문구가 뜨지 않음(다시 열어도 깨끗함)', !s.pwErr && !again.pwErr, JSON.stringify([s, again]));
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(250);

  // D) 정상: 기다리는 동안 그대로 있으면 평소대로 보낸 뒤 화면
  await stub('ok', 800); await openRecover(); await typeAndSend('stay@example.com'); await b.sleep(2800); s = await S();
  check(u + ': (D) 그 자리에서 기다리면 평소대로 보낸 뒤 화면과 타이머', s.sent && s.timer && s.last, JSON.stringify(s));

  // E) send again 의 응답이 오기 전에 Back
  await q(`window.__m.startResendCooldown(document.getElementById('login-modal'), 0.2); 1`); await b.sleep(1400);
  await stub('ok', 1500);
  await click('#recover-resend'); await b.sleep(300);
  await click('#recover-sent-back'); await b.sleep(3200); s = await S();
  check(u + ': (E) send again 의 늦은 응답도 버려짐: 타이머가 되살아나지 않음, 로그인 화면 그대로', s.login && !s.recover && !s.timer, JSON.stringify(s));
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(250);

  // F) 같은 모달에서 연달아: 첫 요청이 늦게 끝나도 두 번째 화면을 망가뜨리지 않음
  await stub('ok', 2500); await openRecover(); await typeAndSend('first@example.com'); await b.sleep(300);
  await click('#recover-back'); await openRecover();
  await stub('ok', 200); await typeAndSend('second@example.com'); await b.sleep(900);
  s = await S(); const who = await q(`document.getElementById('recover-sent-email').textContent`);
  await b.sleep(2600); const s2 = await S(); const who2 = await q(`document.getElementById('recover-sent-email').textContent`);
  check(u + ': (F) 먼저 보낸 요청의 늦은 응답이 두 번째 요청의 결과를 덮어쓰지 않음', s.sent && who === 'second@example.com' && s2.sent && who2 === 'second@example.com', JSON.stringify([s, who, s2, who2]));
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(250);
};
await run('/home.html'); await run('/join.html');
summary(); await b.close();
