import { launch, check, summary } from './lib.mjs';
const b = await launch(9514, 1280, 900); const q = e => b.ev(e);
const exceptions = () => b.events.filter(e => e.method === 'Runtime.exceptionThrown').length;
const run = async (u) => {
  await b.send('Page.navigate', { url: 'http://localhost:8000' + u }); await b.sleep(3500);
  await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(500);
  await q(`(()=>{ const m=document.getElementById('login-modal'); window.__m.initRecover(m); window.__m.initRecoverResend(m); m.showModal(); document.getElementById('login-recover').click(); })(); 1`);
  await q(`window.__calls = []; window.fetch = (url) => { window.__calls.push(String(url)); return Promise.resolve(new Response('{}', {status: 202, headers: {'Content-Type': 'application/json'}})); }; 1`);

  // 남긴 값이 없는데 send again 이 눌림(잠금을 푼 상태): 요청도 오류도 없어야 함
  const e0 = exceptions();
  await q(`(()=>{ const m=document.getElementById('login-modal'); m.recoverLast = null; const r=document.getElementById('recover-resend'); r.disabled=false; r.click(); r.click(); })(); 1`);
  await b.sleep(500);
  const calls = await q('window.__calls.length');
  check(u + ': 남긴 값이 없으면 눌러도 요청이 가지 않고 자바스크립트 오류도 없음', calls === 0 && exceptions() === e0, JSON.stringify({ calls, errors: exceptions() - e0 }));
  // 남긴 값이 알 수 없는 종류여도 오류 없이 무시
  await q(`(()=>{ const m=document.getElementById('login-modal'); m.recoverLast = {kind: 'nope', email: 'a@b.com'}; const r=document.getElementById('recover-resend'); r.disabled=false; r.click(); })(); 1`);
  await b.sleep(500);
  const calls2 = await q('window.__calls.length');
  check(u + ': 알 수 없는 종류의 남긴 값도 요청 없이 오류 없이 무시', calls2 === 0 && exceptions() === e0, JSON.stringify({ calls: calls2, errors: exceptions() - e0 }));
  // 보내는 중 표시가 붙은 버튼은 눌러도 무시(요청이 이미 가는 중이라는 뜻)
  await q(`(()=>{ const m=document.getElementById('login-modal'); m.recoverLast = {kind: 'password', email: 'a@b.com'}; const r=document.getElementById('recover-resend'); r.disabled=false; r.setAttribute('data-busy','true'); r.click(); })(); 1`);
  await b.sleep(500);
  const calls3 = await q('window.__calls.length');
  check(u + ': 보내는 중 표시(data-busy)가 있으면 눌러도 무시', calls3 === 0, String(calls3));

  // 마지막으로 보낸 이메일은 화면을 처음으로 돌리면 지워짐 (개인정보를 메모리에 남기지 않음)
  await q(`(()=>{ const m=document.getElementById('login-modal'); m.recoverLast = {kind: 'password', email: 'keep@example.com'}; document.getElementById('recover-back').click(); })(); 1`);
  await b.sleep(250);
  const cleared = await q(`document.getElementById('login-modal').recoverLast === null`);
  check(u + ': Back to Sign In 하면 recoverLast(마지막 이메일)가 지워짐', cleared === true, String(cleared));
  await q(`(()=>{ const m=document.getElementById('login-modal'); m.recoverLast = {kind: 'email', email: 'keep2@example.com'}; m.close(); })(); 1`);
  await b.sleep(250);
  const cleared2 = await q(`document.getElementById('login-modal').recoverLast === null`);
  check(u + ': 모달을 닫아도 recoverLast 가 지워짐', cleared2 === true, String(cleared2));

  // 옛 요청이 늦게 끝나도 그 사이 시작한 새 요청의 잠금을 풀지 않음 (같은 세대일 때만 풂)
  await q(`window.__calls = []; window.fetch = (url) => { window.__calls.push(String(url)); const isRecover = String(url).indexOf('/password-reset') >= 0; const delay = !isRecover ? 0 : (window.__calls.filter(c => c.indexOf('/password-reset') >= 0).length === 1 ? 1200 : 3000); return new Promise(resolve => setTimeout(() => resolve(new Response('{}', {status: isRecover ? 202 : 401, headers: {'Content-Type': 'application/json'}})), delay)); }; 1`);
  await q(`(()=>{ const m=document.getElementById('login-modal'); window.__m.initRecoverForms(m); m.showModal(); document.getElementById('login-recover').click(); document.getElementById('recover-password-email').value='old@example.com'; document.getElementById('recover-password-form').requestSubmit(); })(); 1`);
  await b.sleep(900);
  await q(`(()=>{ document.getElementById('recover-back').click(); document.getElementById('login-recover').click(); document.getElementById('recover-password-email').value='new@example.com'; document.getElementById('recover-password-form').requestSubmit(); })(); 1`);
  await b.sleep(1100);   // 옛 요청(1200ms)이 끝날 즈음
  await b.sleep(500);
  await q(`document.getElementById('recover-password-form').requestSubmit(); document.getElementById('recover-password-form').requestSubmit(); 1`);
  await b.sleep(300);
  const pwCalls = await q(`window.__calls.filter(c => c.indexOf('/password-reset') >= 0).length`);
  const lockedNow = await q(`document.querySelector('#recover-password-form button[type=submit]').disabled`);
  check(u + ': 옛 요청이 끝나도 새 요청의 잠금은 그대로(요청 2번뿐, 버튼 잠김)', pwCalls === 2 && lockedNow === true, JSON.stringify({ pwCalls, lockedNow }));
  await b.sleep(3200);
  await q(`document.getElementById('login-modal').open && document.getElementById('login-modal').close(); 1`);
};
await run('/home.html'); await run('/join.html');
summary(); await b.close();
