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
};
await run('/home.html'); await run('/join.html');
summary(); await b.close();
