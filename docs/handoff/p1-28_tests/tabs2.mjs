import { launch, check, summary } from './lib.mjs';
const b = await launch(9503, 1280, 900); const q = e => b.ev(e);
const key = async (k, mods = 0) => {
  const code = { ArrowRight: 39, ArrowLeft: 37, Home: 36, End: 35, a: 65, Enter: 13 }[k];
  await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, windowsVirtualKeyCode: code, modifiers: mods });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, windowsVirtualKeyCode: code, modifiers: mods });
  await b.sleep(150);
};
const click = async (sel) => {
  const r = JSON.parse(await q(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await b.sleep(200);
};
const run = async (u) => {
  await b.send('Page.navigate', { url: 'http://localhost:8000' + u }); await b.sleep(3500);
  await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(500);
  await q(`document.getElementById('login-modal').showModal(); const m=document.getElementById('login-modal'); window.__m.showView(m,'recover'); window.__r1 = window.__m.initRecoverTabs(m); window.__m.initRecoverTabs(m); 1`); await b.sleep(300);
  const S = async () => JSON.parse(await q(`JSON.stringify({sel: ['password','email'].filter(n=>document.getElementById('recover-tab-'+n).getAttribute('aria-selected')==='true').join(), shown: ['password','email'].filter(n=>getComputedStyle(document.getElementById('recover-panel-'+n)).display!=='none').join(), focus: document.activeElement.id, tabs: ['password','email'].map(n=>document.getElementById('recover-tab-'+n).tabIndex).join()})`));
  const pick = async (name) => { await q(`window.__m.selectTab(document.getElementById('login-modal'),'${name}', true); 1`); await b.sleep(100); };
  check(u + ': 연결했으면 true(두 번 불러도)', (await q('window.__r1')) === true);
  let s = await S();
  check(u + ': 시작: Password', s.sel === 'password' && s.shown === 'password', JSON.stringify(s));
  await click('#recover-tab-email'); s = await S();
  check(u + ': Email 탭을 마우스로 누르면 선택, 패널 전환', s.sel === 'email' && s.shown === 'email', JSON.stringify(s));
  await click('#recover-tab-password'); s = await S();
  check(u + ': Password 탭을 마우스로 누르면 선택', s.sel === 'password' && s.shown === 'password', JSON.stringify(s));
  await pick('password');
  await key('ArrowRight'); s = await S();
  check(u + ': →: Password에서 Email로, 커서도 따라가고 tabindex 갱신', s.sel === 'email' && s.focus === 'recover-tab-email' && s.tabs === '-1,0', JSON.stringify(s));
  await key('ArrowRight'); s = await S();
  check(u + ': →: 끝에서 처음으로 이어짐', s.sel === 'password' && s.focus === 'recover-tab-password', JSON.stringify(s));
  await key('ArrowLeft'); s = await S();
  check(u + ': ←: 처음에서 끝으로 이어짐', s.sel === 'email' && s.focus === 'recover-tab-email', JSON.stringify(s));
  await key('ArrowLeft'); s = await S();
  check(u + ': ←: Email에서 Password로', s.sel === 'password' && s.focus === 'recover-tab-password', JSON.stringify(s));
  await key('End'); s = await S();
  check(u + ': End: 마지막 탭(Email)', s.sel === 'email' && s.focus === 'recover-tab-email', JSON.stringify(s));
  await key('Home'); s = await S();
  check(u + ': Home: 첫 탭(Password)', s.sel === 'password' && s.focus === 'recover-tab-password', JSON.stringify(s));
  await key('Home'); s = await S();
  check(u + ': 이미 첫 탭에서 Home 을 눌러도 그대로', s.sel === 'password' && s.focus === 'recover-tab-password', JSON.stringify(s));
  // 처리하지 않는 키와 조합 키
  await key('a'); s = await S();
  check(u + ': 다른 키(a)는 처리하지 않음', s.sel === 'password' && s.focus === 'recover-tab-password', JSON.stringify(s));
  for (const [name, mod] of [['Ctrl', 2], ['Alt', 1], ['Meta', 4], ['Shift', 8]]) {
    await key('ArrowRight', mod); s = await S();
    check(u + ': ' + name + '+→ 는 처리하지 않음(브라우저 단축키를 가로채지 않음)', s.sel === 'password' && s.focus === 'recover-tab-password', JSON.stringify(s));
  }
  // preventDefault 확인: 처리한 키만 막음
  const pd = JSON.parse(await q(`(()=>{ const t=document.getElementById('recover-tab-password'); const mk=(k,o)=>{const e=new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o||{})); t.dispatchEvent(e); return e.defaultPrevented;};
    const out={right:mk('ArrowRight'), left:mk('ArrowLeft'), home:mk('Home'), end:mk('End'), a:mk('a'), up:mk('ArrowUp'), ctrlRight:mk('ArrowRight',{ctrlKey:true})}; window.__m.selectTab(document.getElementById('login-modal'),'password',true); return JSON.stringify(out)})()`));
  check(u + ': 처리한 키(→ ← Home End)만 기본 동작을 막고, a, ↑, Ctrl+→ 는 막지 않음', pd.right && pd.left && pd.home && pd.end && !pd.a && !pd.up && !pd.ctrlRight, JSON.stringify(pd));
  // 탭 목록의 빈 곳을 눌러도, 탭 밖에서 키를 눌러도 아무 일 없음
  await pick('password');
  await q(`document.getElementById('recover-password-email').focus(); 1`);
  await key('ArrowRight'); s = await S();
  check(u + ': 입력칸에서 → 를 눌러도 탭이 바뀌지 않음(칸의 커서 이동용)', s.sel === 'password' && s.focus === 'recover-password-email', JSON.stringify(s));
  const bg = JSON.parse(await q(`(()=>{ const l=document.querySelector('[role=tablist]'); l.dispatchEvent(new MouseEvent('click',{bubbles:true})); return JSON.stringify(document.getElementById('recover-tab-password').getAttribute('aria-selected')) })()`));
  check(u + ': 탭 목록의 빈 곳(탭이 아닌 곳)을 눌러도 바뀌지 않음', bg === 'true');
};
await run('/home.html'); await run('/join.html');
await b.send('Page.navigate', { url: 'http://localhost:8000/home.html' }); await b.sleep(3000);
await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(400);
const f = JSON.parse(await q(`(()=>{ const d=document.createElement('div'); d.innerHTML='<div>no list</div>'; document.body.appendChild(d);
  return JSON.stringify({nullModal: window.__m.initRecoverTabs(null), noList: window.__m.initRecoverTabs(d)}) })()`));
check('모달이 null 이거나 탭 목록이 없으면 false', f.nullModal === false && f.noList === false, JSON.stringify(f));
summary(); await b.close();
