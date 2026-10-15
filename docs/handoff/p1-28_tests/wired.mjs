import { launch, check, summary } from './lib.mjs';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/ai-notes/images/';
const b = await launch(9506, 1280, 900); const q = e => b.ev(e);
const click = async (sel) => {
  const r = JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await b.sleep(300);
};
const key = async (k, code) => {
  await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: code });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code });
  await b.sleep(300);
};
const S = async () => JSON.parse(await q(`JSON.stringify({open: document.getElementById('login-modal').open, login: getComputedStyle(document.querySelector('[data-view=login]')).display!=='none', recover: getComputedStyle(document.querySelector('[data-view=recover]')).display!=='none', title: document.getElementById('login-modal-title').textContent, sel: ['password','email'].filter(n=>document.getElementById('recover-tab-'+n).getAttribute('aria-selected')==='true').join(), focus: document.activeElement.id, hash: location.hash})`));
const errors = () => b.events.filter(e => e.method === 'Runtime.exceptionThrown').length;

for (const page of ['/home.html', '/join.html']) {
  await b.send('Page.navigate', { url: 'http://localhost:8000' + page }); await b.sleep(4000);
  const e0 = errors();
  // 헤더의 Sign In 버튼으로 모달을 엶 (실제 사용자 경로)
  await click('.site-header [command="show-modal"], [commandfor="login-modal"]'); let s = await S();
  check(page + ': Sign In 버튼으로 모달이 열리고 로그인 화면', s.open && s.login && !s.recover && s.title === 'Sign In', JSON.stringify(s));
  if (page === '/home.html') await b.shot(OUT + 'p1-28_wired_login.png');
  await click('#login-recover'); s = await S();
  check(page + ": Can't sign in? 을 누르면 복구 화면(실제 페이지 연결)", s.recover && !s.login && s.title === "Can't sign in?" && s.sel === 'password' && s.focus === 'recover-password-email', JSON.stringify(s));
  await click('#recover-tab-email'); s = await S();
  check(page + ': Email 탭 클릭', s.sel === 'email', JSON.stringify(s));
  if (page === '/home.html') await b.shot(OUT + 'p1-28_wired_email.png');
  await key('ArrowLeft', 37); s = await S();
  check(page + ': ← 로 Password 탭, 커서가 탭으로', s.sel === 'password' && s.focus === 'recover-tab-password', JSON.stringify(s));
  await click('#recover-back'); s = await S();
  check(page + ': Back to Sign In', s.login && !s.recover && s.focus === 'login-email', JSON.stringify(s));
  await key('Escape', 27); s = await S();
  check(page + ': Esc 로 닫힘', s.open === false, JSON.stringify(s));
  check(page + ': 여기까지 자바스크립트 오류 없음', errors() === e0, String(errors() - e0));
  // 로그인 폼이 여전히 동작: 틀린 비밀번호 → 오류 문구(서버 응답)
  await click('[commandfor="login-modal"]');
  await q(`document.getElementById('login-email').value='nobody@example.com'; document.getElementById('login-password').value='Wrong123!'; 1`);
  await click('#login-form button[type=submit]'); await b.sleep(1200);
  const lerr = JSON.parse(await q(`JSON.stringify({text: document.getElementById('login-error').textContent, shown: !document.getElementById('login-error').hidden || document.querySelector('.swal2-popup') !== null, modalOpen: document.getElementById('login-modal').open})`));
  check(page + ': 로그인 폼이 그대로 동작(틀린 계정은 오류 표시, 모달 유지)', lerr.modalOpen && (lerr.shown || lerr.text.length > 0), JSON.stringify(lerr));
  await q(`(document.querySelector('.swal2-confirm')||{click(){}}).click(); document.getElementById('login-modal').open && document.getElementById('login-modal').close(); 1`); await b.sleep(300);
  // #recover 로 직접 들어옴
  await b.send('Page.navigate', { url: 'http://localhost:8000' + page + '#recover' }); await b.sleep(4000);
  s = await S();
  check(page + ': #recover 로 들어오면 복구 화면이 열린 모달(실제 페이지 연결)', s.open && s.recover && s.title === "Can't sign in?" && s.sel === 'password', JSON.stringify(s));
  if (page === '/home.html') await b.shot(OUT + 'p1-28_wired_hash.png');
  await click('#recover-back-row .text-link, #recover-back');
  await key('Escape', 27); s = await S();
  check(page + ': 닫으면 주소에서 #recover 가 사라지고 새로 고침해도 안 열림', s.hash === '' && !s.open, JSON.stringify(s));
  await b.send('Page.reload'); await b.sleep(3500); s = await S();
  check(page + ': 새로 고침: 모달 닫힌 채', s.open === false, JSON.stringify(s));
  check(page + ': 전체 흐름에서 자바스크립트 오류 없음', errors() === e0, String(errors() - e0));
}
summary(); await b.close();
