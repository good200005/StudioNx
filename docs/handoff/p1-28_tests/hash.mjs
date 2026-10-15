import { launch, check, summary } from './lib.mjs';
const b = await launch(9505, 1280, 900); const q = e => b.ev(e);
const press = async (k, code) => {
  await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: code });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code });
  await b.sleep(300);
};
const S = async () => JSON.parse(await q(`JSON.stringify({open: document.getElementById('login-modal').open, login: getComputedStyle(document.querySelector('[data-view=login]')).display!=='none', recover: getComputedStyle(document.querySelector('[data-view=recover]')).display!=='none', title: document.getElementById('login-modal-title').textContent, sel: ['password','email'].filter(n=>document.getElementById('recover-tab-'+n).getAttribute('aria-selected')==='true').join(), hash: location.hash, href: location.pathname + location.search + location.hash})`));
const load = async (url) => {
  await b.send('Page.navigate', { url: 'http://localhost:8000' + url }); await b.sleep(3500);
  await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(500);
};
const exceptions = () => b.events.filter(e => e.method === 'Runtime.exceptionThrown').length;

for (const page of ['/home.html', '/join.html']) {
  // 1. #recover 로 들어옴
  await load(page + '#recover');
  const r = await q(`const m=document.getElementById('login-modal'); [window.__m.initRecover(m), window.__m.initRecoverFromHash(m), window.__m.initRecoverFromHash(m)]`); await b.sleep(300);
  let s = await S();
  check(page + ': 연결하면 true (두 번 불러도)', JSON.stringify(r) === '[true,true,true]', JSON.stringify(r));
  check(page + ': #recover 로 들어오면 모달이 열리고 복구 화면(Password 탭, 제목)', s.open && s.recover && !s.login && s.title === "Can't sign in?" && s.sel === 'password', JSON.stringify(s));
  // 2. 닫으면 #recover 지움
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(300); s = await S();
  check(page + ': 닫으면 주소의 #recover 가 지워짐(경로는 그대로)', s.hash === '' && s.href === page && !s.open, JSON.stringify(s));
  await q(`document.getElementById('login-modal').showModal(); 1`); await b.sleep(300); s = await S();
  check(page + ': 다시 열면 로그인 화면(#recover 가 남아 있지 않음)', s.login && !s.recover, JSON.stringify(s));
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(250);
  // 3. 같은 페이지에서 해시가 바뀜
  await q(`location.hash = '#recover'; 1`); await b.sleep(400); s = await S();
  check(page + ': 페이지 안에서 주소가 #recover 로 바뀌면(hashchange) 열림', s.open && s.recover && s.title === "Can't sign in?", JSON.stringify(s));
  // 4. Esc 로 닫아도 지움
  await press('Escape', 27); s = await S();
  check(page + ': Esc 로 닫아도 #recover 가 지워짐', !s.open && s.hash === '', JSON.stringify(s));
  // 5. 열려 있는 로그인 화면에서 해시가 바뀜 → 복구 화면으로, 오류 없이
  const ex0 = exceptions();
  await q(`document.getElementById('login-modal').showModal(); 1`); await b.sleep(250);
  await q(`location.hash = '#recover'; 1`); await b.sleep(400); s = await S();
  check(page + ': 이미 열린 로그인 화면에서 #recover 로 바뀌면 복구 화면으로 바뀜(showModal 두 번 오류 없음)', s.open && s.recover && !s.login && exceptions() === ex0, JSON.stringify([s, exceptions() - ex0]));
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(250);
  // 6. 다른 해시는 열지 않고, 열린 뒤 다른 해시로 바뀌어도 닫을 때 지우지 않음
  for (const h of ['#recovery', '#recoverx', '#login', '#contact', '#']) {
    await q(`location.hash = ${JSON.stringify(h)}; 1`); await b.sleep(300); s = await S();
    // #login 은 home.html 이 원래 로그인 모달을 여는 주소라서 열릴 수 있지만 복구 화면은 아니어야 함
    check(page + ': ' + h + ' 는 복구 화면을 열지 않음' + (h === '#login' ? ' (로그인 모달은 원래대로 열릴 수 있음)' : ''), s.recover === false && (h === '#login' || s.open === false), JSON.stringify(s));
    await q("document.getElementById('login-modal').open && document.getElementById('login-modal').close(); 1"); await b.sleep(250);
  }
  await q(`location.hash = '#recover'; 1`); await b.sleep(300);
  await q(`history.replaceState(null,'',location.pathname+'#feature'); 1`); await b.sleep(200);
  await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(250); s = await S();
  check(page + ': 다른 해시(#feature)로 바뀐 뒤 닫으면 그 해시는 지우지 않음', s.hash === '#feature', JSON.stringify(s));
  // 7. 해시가 없을 때 연결해도 열지 않음
  await load(page);
  await q(`const m=document.getElementById('login-modal'); window.__m.initRecover(m); window.__m.initRecoverFromHash(m); 1`); await b.sleep(300); s = await S();
  check(page + ': 해시가 없으면 연결해도 열지 않음', s.open === false && s.login, JSON.stringify(s));
  // 8. 두 번 연결해도 닫을 때 한 번만 지움 → 예외 없음
  const ex1 = exceptions();
  await q(`location.hash='#recover'; 1`); await b.sleep(300); await q(`document.getElementById('login-modal').close(); 1`); await b.sleep(250); s = await S();
  check(page + ': 연결 뒤 흐름 전체에서 오류 없음', exceptions() === ex1 && s.hash === '', JSON.stringify([s, exceptions() - ex1]));
}
await load('/home.html');
const f = JSON.parse(await q(`(()=>{ const d=document.createElement('div'); d.innerHTML='<div data-view="login"></div>'; document.body.appendChild(d); return JSON.stringify({nullModal: window.__m.initRecoverFromHash(null), noRecover: window.__m.initRecoverFromHash(d)}) })()`));
check('모달이 null 이거나 복구 화면이 없으면 false', f.nullModal === false && f.noRecover === false, JSON.stringify(f));
summary(); await b.close();
