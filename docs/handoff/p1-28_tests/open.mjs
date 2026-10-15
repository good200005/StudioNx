import { launch, check, summary } from './lib.mjs';
const b = await launch(9504, 1280, 900); const q = e => b.ev(e);
const click = async (sel) => {
  const r = JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await b.sleep(250);
};
const press = async (k, code) => {
  await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: code });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code });
  await b.sleep(300);
};
const run = async (u) => {
  await b.send('Page.navigate', { url: 'http://localhost:8000' + u }); await b.sleep(3500);
  await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(500);
  const r1 = await q(`const m=document.getElementById('login-modal'); [window.__m.initRecover(m), window.__m.initRecover(m)]`);
  check(u + ': 연결했으면 true (두 번 불러도)', JSON.stringify(r1) === '[true,true]', JSON.stringify(r1));
  const S = async () => JSON.parse(await q(`JSON.stringify({login: getComputedStyle(document.querySelector('[data-view=login]')).display!=='none', recover: getComputedStyle(document.querySelector('[data-view=recover]')).display!=='none', title: document.getElementById('login-modal-title').textContent, focus: document.activeElement.id, sel: ['password','email'].filter(n=>document.getElementById('recover-tab-'+n).getAttribute('aria-selected')==='true').join(), tabs: getComputedStyle(document.querySelector('[role=tablist]')).display!=='none', sent: getComputedStyle(document.getElementById('recover-sent')).display!=='none', back: getComputedStyle(document.getElementById('recover-back-row')).display!=='none', pwVal: document.getElementById('recover-password-email').value, emVal: document.getElementById('recover-email-email').value, open: document.getElementById('login-modal').open})`));

  await q(`document.getElementById('login-modal').showModal(); 1`); await b.sleep(300);
  let s = await S();
  check(u + ': 열면 로그인 화면', s.login && !s.recover && s.title === 'Sign In', JSON.stringify(s));
  await click('#login-recover'); s = await S();
  check(u + ": Can't sign in? 을 누르면 복구 화면, 제목, Password 탭, 첫 칸에 커서", !s.login && s.recover && s.title === "Can't sign in?" && s.sel === 'password' && s.focus === 'recover-password-email', JSON.stringify(s));
  await click('#recover-tab-email'); s = await S();
  check(u + ': 탭 연결도 됨(Email 탭을 누르면 선택)', s.sel === 'email', JSON.stringify(s));
  await q(`document.getElementById('recover-email-email').value='typed@example.com'; document.getElementById('recover-password-error').textContent='x'; document.getElementById('recover-password-error').hidden=false; 1`);
  await click('#recover-back'); s = await S();
  check(u + ': Back to Sign In: 로그인 화면, 제목, 로그인 칸에 커서', s.login && !s.recover && s.title === 'Sign In' && s.focus === 'login-email', JSON.stringify(s));
  await click('#login-recover'); s = await S();
  check(u + ': 다시 열면 처음 상태(Password 탭, 입력값 비움, 오류 숨김)', s.sel === 'password' && s.emVal === '' && s.pwVal === '' && (await q(`document.getElementById('recover-password-error').hidden`)) === true && (await q(`document.getElementById('recover-password-error').textContent`)) === '', JSON.stringify(s));
  // 보낸 뒤 화면에서 돌아오기
  await q(`document.querySelector('[role=tablist]').hidden=true; document.getElementById('recover-panel-password').hidden=true; document.getElementById('recover-sent').hidden=false; document.getElementById('recover-back-row').hidden=true; document.getElementById('recover-sent-email').textContent='you@example.com'; 1`);
  s = await S();
  check(u + ': (준비) 보낸 뒤 화면이 보임', s.sent && !s.tabs && !s.back, JSON.stringify(s));
  await click('#recover-sent-back'); s = await S();
  check(u + ': 보낸 뒤 화면의 Back to Sign In: 로그인 화면으로', s.login && !s.recover && s.focus === 'login-email', JSON.stringify(s));
  await click('#login-recover'); s = await S();
  check(u + ': 다시 열면 보낸 뒤 화면이 사라지고 탭과 Back 줄이 돌아옴, 이메일 글자 비움', !s.sent && s.tabs && s.back && s.sel === 'password' && (await q(`document.getElementById('recover-sent-email').textContent`)) === '', JSON.stringify(s));
  // 닫기: close()
  await q(`document.getElementById('recover-password-email').value='leak@example.com'; 1`);
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(250);
  await q(`document.getElementById('login-modal').showModal(); 1`); await b.sleep(250); s = await S();
  check(u + ': 복구 화면에서 닫았다 다시 열면 로그인 화면, 입력값 비움', s.login && !s.recover && s.title === 'Sign In' && s.pwVal === '', JSON.stringify(s));
  // 닫기: Esc 키
  await click('#login-recover'); await q(`document.getElementById('recover-password-email').value='leak2@example.com'; 1`);
  await press('Escape', 27); s = await S();
  check(u + ': Esc 로 닫힘', s.open === false, JSON.stringify(s));
  await q(`document.getElementById('login-modal').showModal(); 1`); await b.sleep(250); s = await S();
  check(u + ': Esc 로 닫았다 다시 열면 로그인 화면, 입력값 비움', s.login && !s.recover && s.pwVal === '', JSON.stringify(s));
  // 로그인 화면은 그대로 쓸 수 있음
  const lg = JSON.parse(await q(`JSON.stringify({form: !!document.getElementById('login-form'), email: document.getElementById('login-email').getBoundingClientRect().height>0, pw: document.getElementById('login-password').getBoundingClientRect().height>0, join: !!document.querySelector('[data-view=login] a[href="join.html"]')})`));
  check(u + ': 로그인 화면(폼, 입력칸, Join Us)은 그대로', lg.form && lg.email && lg.pw && lg.join, JSON.stringify(lg));
};
await run('/home.html'); await run('/join.html');
await b.send('Page.navigate', { url: 'http://localhost:8000/home.html' }); await b.sleep(3000);
await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(400);
const f = JSON.parse(await q(`(()=>{ const mk=h=>{const d=document.createElement('div'); d.innerHTML=h; document.body.appendChild(d); return d;};
  const noRecover = mk('<div data-view="login"></div>'); const partial = mk('<div data-view="login"></div><div data-view="recover" hidden></div>');
  let threw=false, r; try { r = window.__m.initRecover(partial); } catch(e) { threw=true; }
  return JSON.stringify({nullModal: window.__m.initRecover(null), noRecover: window.__m.initRecover(noRecover), partial: r, threw}) })()`));
check('모달이 null 이거나 복구 화면이 없으면 false', f.nullModal === false && f.noRecover === false, JSON.stringify(f));
check('복구 화면은 있지만 버튼, 탭이 없어도 오류 없이 true', f.partial === true && f.threw === false, JSON.stringify(f));
summary(); await b.close();
