import { launch, check, summary } from './lib.mjs';
const b = await launch(9501, 1280, 900); const q = e => b.ev(e);
const run = async (u) => {
  await b.send('Page.navigate',{url:'http://localhost:8000'+u}); await b.sleep(3500);
  await q(`window.__m = null; import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(500);
  await q(`document.getElementById('login-modal').showModal(); 1`); await b.sleep(300);
  const st = `JSON.stringify({loginShown: getComputedStyle(document.querySelector('[data-view=login]')).display!=='none', recoverShown: getComputedStyle(document.querySelector('[data-view=recover]')).display!=='none', title: document.getElementById('login-modal-title').textContent, focus: document.activeElement.id})`;
  const S = async () => JSON.parse(await q(st));
  const call = async (name) => q(`window.__m.showView(document.getElementById('login-modal'), ${name})`);

  const a0 = await S();
  check(u+': 시작 상태: 로그인 화면, 제목 Sign In', a0.loginShown && !a0.recoverShown && a0.title==='Sign In', JSON.stringify(a0));
  const r1 = await call(`'recover'`); const a1 = await S();
  check(u+': recover 로 바꿈: 복구 화면만 보임, 제목 변경, 첫 입력칸(Password 탭 이메일)에 커서', r1===true && !a1.loginShown && a1.recoverShown && a1.title==="Can't sign in?" && a1.focus==='recover-password-email', JSON.stringify([r1,a1]));
  const r2 = await call(`'recover'`); const a2 = await S();
  check(u+': 이미 그 화면이면 다시 불러도 같은 결과(true)', r2===true && JSON.stringify(a2)===JSON.stringify(a1));
  // Email 탭이 보이는 상태에서는 그 패널의 입력칸으로
  await q(`document.getElementById('recover-panel-password').hidden=true; document.getElementById('recover-panel-email').hidden=false; window.__m.showView(document.getElementById('login-modal'),'recover'); 1`);
  const a3 = await S();
  check(u+': Email 패널이 보이는 상태면 그 칸에 커서(숨은 패널의 칸은 건너뜀)', a3.focus==='recover-email-email', JSON.stringify(a3));
  await q(`document.getElementById('recover-panel-password').hidden=false; document.getElementById('recover-panel-email').hidden=true; 1`);
  const r4 = await call(`'login'`); const a4 = await S();
  check(u+': login 으로 돌아옴: 제목 Sign In, 로그인 입력칸에 커서', r4===true && a4.loginShown && !a4.recoverShown && a4.title==='Sign In' && a4.focus==='login-email', JSON.stringify([r4,a4]));
  for (const bad of [`'x'`, `''`, `undefined`, `null`, `'RECOVER'`, `1`]) {
    const before = await S(); const r = await call(bad); const after = await S();
    check(u+': 모르는 이름 '+bad+' → false 이고 아무것도 안 바뀜', r===false && JSON.stringify(before)===JSON.stringify(after), JSON.stringify([r,before,after]));
  }
  const rn = await q(`window.__m.showView(null,'recover')`);
  check(u+': 모달이 없으면 false(오류 없음)', rn===false);
};
await run('/home.html'); await run('/join.html');
// 제목 속성이 없는 모달, 화면이 없는 모달
await b.send('Page.navigate',{url:'http://localhost:8000/home.html'}); await b.sleep(3000);
await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(400);
const fake = JSON.parse(await q(`(()=>{ const d=document.createElement('div'); d.innerHTML='<h2 id="login-modal-title">Keep me</h2><div data-view="login"></div><div data-view="recover" hidden><input id="x"></div>'; document.body.appendChild(d);
  const r=window.__m.showView(d,'recover'); const none=document.createElement('div'); none.innerHTML='<h2 id="login-modal-title">T</h2>'; return JSON.stringify({r, title: d.querySelector('h2').textContent, loginHidden: d.querySelector('[data-view=login]').hidden, recHidden: d.querySelector('[data-view=recover]').hidden, noViews: window.__m.showView(none,'recover'), noViewsTitle: none.querySelector('h2').textContent}) })()`));
check('제목 속성이 없으면 제목은 그대로, 화면은 바뀜', fake.r===true && fake.title==='Keep me' && fake.loginHidden && !fake.recHidden, JSON.stringify(fake));
check('[data-view]가 하나도 없는 모달은 false이고 제목도 그대로', fake.noViews===false && fake.noViewsTitle==='T', JSON.stringify(fake));
check('내보내는 상수', JSON.stringify(await q(`window.__m.RECOVER_VIEWS`))==='["login","recover"]');
summary(); await b.close();
