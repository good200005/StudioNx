import { launch, check, summary } from './lib.mjs';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/ai-notes/images/';
const b = await launch(9507, 1280, 900); const q = e => b.ev(e);
const S = async () => JSON.parse(await q(`JSON.stringify({
  login: getComputedStyle(document.querySelector('[data-view=login]')).display!=='none',
  recover: getComputedStyle(document.querySelector('[data-view=recover]')).display!=='none',
  tabs: getComputedStyle(document.querySelector('[role=tablist]')).display!=='none',
  pw: getComputedStyle(document.getElementById('recover-panel-password')).display!=='none',
  em: getComputedStyle(document.getElementById('recover-panel-email')).display!=='none',
  back: getComputedStyle(document.getElementById('recover-back-row')).display!=='none',
  sent: getComputedStyle(document.getElementById('recover-sent')).display!=='none',
  who: document.getElementById('recover-sent-email').textContent,
  whoHtml: document.getElementById('recover-sent-email').innerHTML,
  detail: document.getElementById('recover-sent-detail').textContent,
  title: document.getElementById('login-modal-title').textContent,
  focus: document.activeElement.id})`));
const call = (kind, email) => q(`window.__m.showSentView(document.getElementById('login-modal'), ${kind}, ${email})`);
const run = async (u) => {
  await b.send('Page.navigate', { url: 'http://localhost:8000' + u }); await b.sleep(3500);
  await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(500);
  await q(`const m=document.getElementById('login-modal'); window.__m.initRecover(m); m.showModal(); 1`); await b.sleep(300);

  // 로그인 화면에서 바로 불러도 복구 화면의 보낸 뒤 화면이 보임
  const r1 = await call(`'password'`, `'you@example.com'`); let s = await S();
  check(u + ': password: 보낸 뒤 화면만 보임(탭, 두 패널, Back 줄은 실제로 숨음)', r1 === true && s.recover && !s.login && s.sent && !s.tabs && !s.pw && !s.em && !s.back, JSON.stringify([r1, s]));
  check(u + ': 이메일과 보충 문장(30분), 제목, 커서가 Back to Sign In 버튼', s.who === 'you@example.com' && s.detail === 'The link works for 30 minutes.' && s.title === "Can't sign in?" && s.focus === 'recover-sent-back', JSON.stringify(s));
  if (u === '/home.html') await b.shot(OUT + 'p1-28_sent_view.png');

  const r2 = await call(`'email'`, `'other@example.com'`); s = await S();
  check(u + ': email: 보충 문장이 스팸함 안내로 바뀌고 이메일 글자 갱신', r2 === true && s.detail === "If you don't see it, check your spam folder." && s.who === 'other@example.com' && s.sent, JSON.stringify(s));
  const r3 = await call(`'email'`, `'other@example.com'`); const s3 = await S();
  check(u + ': 같은 값으로 다시 불러도 같은 결과', r3 === true && JSON.stringify(s3) === JSON.stringify(s));

  // 이메일은 글자로 들어감(마크업이 되지 않음)
  await call(`'password'`, `'<img src=x onerror=window.__pwned=1>&amp;"@e.com'`); s = await S();
  const pwned = await q('window.__pwned === 1');
  check(u + ': 이메일의 <, & 는 마크업이 되지 않고 글자 그대로(스크립트 실행 없음)', pwned === false && s.who === '<img src=x onerror=window.__pwned=1>&amp;"@e.com' && !s.whoHtml.includes('<img'), JSON.stringify([s.who, s.whoHtml, pwned]));
  await call(`'password'`, `undefined`); s = await S();
  check(u + ': 이메일이 문자열이 아니면 빈 글자', s.who === '', JSON.stringify(s));
  await call(`'password'`, `123`); s = await S();
  check(u + ': 숫자도 빈 글자', s.who === '', JSON.stringify(s));

  // Back to Sign In 으로 돌아오면 완전히 처음
  await q(`document.getElementById('recover-sent-back').click(); 1`); await b.sleep(250); s = await S();
  check(u + ': Back to Sign In: 로그인 화면, 보낸 뒤 화면과 이메일 글자가 비워짐', s.login && !s.recover && !s.sent && s.who === '', JSON.stringify(s));
  await q(`document.getElementById('login-recover').click(); 1`); await b.sleep(250); s = await S();
  check(u + ': 다시 열면 탭과 Back 줄이 돌아오고 보낸 뒤 화면은 숨음', s.tabs && s.pw && !s.em && s.back && !s.sent, JSON.stringify(s));

  // 잘못된 인자
  await q(`document.getElementById('recover-back').click(); 1`); await b.sleep(200);
  for (const bad of [`'x'`, `''`, `undefined`, `null`, `'PASSWORD'`, `1`, `'login'`]) {
    const before = await S(); const r = await call(bad, `'a@b.com'`); const after = await S();
    check(u + ': 모르는 kind ' + bad + ' → false, 안 바뀜', r === false && JSON.stringify(before) === JSON.stringify(after), JSON.stringify([r, before, after]));
  }
  check(u + ': 모달이 null 이면 false', (await q(`window.__m.showSentView(null,'password','a@b.com')`)) === false);
};
await run('/home.html'); await run('/join.html');
await b.send('Page.navigate', { url: 'http://localhost:8000/home.html' }); await b.sleep(3000);
await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(400);
const f = JSON.parse(await q(`(()=>{ const mk=h=>{const d=document.createElement('div'); d.innerHTML=h; document.body.appendChild(d); return d;};
  const noSent = mk('<div data-view="recover"><div role="tablist"></div></div>'); const noRecover = mk('<div id="recover-sent"></div>');
  const bare = mk('<div data-view="recover"><div id="recover-sent" hidden></div></div>');
  let threw=false, r; try { r = window.__m.showSentView(bare,'password','a@b.com'); } catch(e) { threw=true; }
  return JSON.stringify({noSent: window.__m.showSentView(noSent,'password','a@b.com'), noRecover: window.__m.showSentView(noRecover,'password','a@b.com'), bare: r, threw, bareShown: !bare.querySelector('#recover-sent').hidden}) })()`));
check('보낸 뒤 화면이나 복구 화면이 없으면 false', f.noSent === false && f.noRecover === false, JSON.stringify(f));
check('세부 요소(이메일 칸, 버튼 등)가 없어도 오류 없이 true 이고 보임', f.bare === true && f.threw === false && f.bareShown, JSON.stringify(f));
summary(); await b.close();
