// P1-28 사이트 시험 — 실제 서버와 실제 재설정 토큰으로 한 흐름
// 실행:
//   1) ..\.venv\Scripts\python <prep.py> <token.json>   (시험용 회원 + 실제 토큰)
//   2) node docs/handoff/p1-28_tests/reset_site.mjs <token.json>
// 요청(메일 보내기) 쪽은 e2e.mjs 가 본다. 이 파일은 메일 링크로 들어와 새 비밀번호를 정하는 쪽을 본다.
import fs from 'node:fs';
import { launch, check, summary } from './lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/ai-notes/images/';
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = await launch(9470, 1280, 900);
const q = e => b.ev(e);

const click = async sel => {
  const r = JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await b.sleep(350);
};
const type = async (sel, text) => {
  await q(`document.querySelector(${JSON.stringify(sel)}).focus(); 1`);
  await b.send('Input.insertText', { text });
  await b.sleep(120);
};
const st = async () => JSON.parse(await q(`JSON.stringify({
  locked: document.querySelector('.reset__card').classList.contains('is-locked'),
  invalid: !document.getElementById('reset-invalid').hidden,
  form: !document.getElementById('reset-form').hidden,
  done: !document.getElementById('reset-done').hidden,
  recover: !document.getElementById('reset-recover-row').hidden,
  err: document.getElementById('reset-error').textContent,
  hash: location.hash
})`));
const errs = () => b.events.filter(e => e.method === 'Runtime.exceptionThrown').length;

// ---------- 1. 메일 링크(#token=)로 들어와 새 비밀번호 정하기 ----------
await b.goto('http://localhost:8000/resetPassword.html#token=' + data.token);
const e0 = errs();
let s = await st();
check('실제 링크로 열면 폼이 열려 있고(잠기지 않음) 경고·다시 요청 줄이 숨겨짐', s.locked === false && s.invalid === false && s.form === true && s.recover === false, JSON.stringify(s));
check('토큰이 주소창에서 곧바로 사라짐', s.hash === '', JSON.stringify(s));

await type('#reset-password', data.new_password);
await type('#reset-password2', data.new_password);
await click('#reset-form button[type=submit]');
await b.sleep(1200);
s = await st();
check('전송 성공 → 성공 화면, 폼·안내문 숨김 (자동 로그인 없음)', s.done === true && s.form === false && s.invalid === false, JSON.stringify(s));
await b.shot(OUT + 'p1-28_site_reset_done.png');
check('이 흐름에서 자바스크립트 오류 없음', errs() === e0);

// ---------- 2. 새 비밀번호로 실제 로그인 ----------
await b.goto('http://localhost:8000/home.html');
await b.sleep(2500);
await click('[commandfor="login-modal"]');
await type('#login-email', data.email);
await type('#login-password', data.new_password);
await click('#login-form button[type=submit]');
await b.sleep(1500);
const loggedIn = await q(`document.documentElement.dataset.auth === 'in'`);
check('새 비밀번호로 로그인 성공 (헤더가 로그인 상태)', loggedIn === true, await q(`JSON.stringify({auth: document.documentElement.dataset.auth, err: document.getElementById('login-error').textContent})`));
await b.shot(OUT + 'p1-28_site_login_new.png');

// ---------- 3. 옛 비밀번호로는 로그인 실패 (API로 확인) ----------
const oldStatus = await q(`fetch('/api/v1/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: ${JSON.stringify(data.email)}, password: ${JSON.stringify(data.old_password)} }) }).then(r => r.status)`);
check('옛 비밀번호로는 로그인 실패(401) — 비밀번호가 실제로 바뀜', oldStatus === 401, 'status=' + oldStatus);

// ---------- 4. 재설정 전에 받은 로그인 토큰도 무효 (API로 확인) ----------
const oldTokenStatus = await q(`fetch('/api/v1/users/me', { headers: { Authorization: 'Bearer ' + ${JSON.stringify(data.access_token)} } }).then(r => r.status)`);
check('재설정 전에 받은 로그인 토큰이 거부됨(401) — 이전 로그인 무효화', oldTokenStatus === 401, 'status=' + oldTokenStatus);

// ---------- 5. 무효 링크(틀린 토큰)로 들어와 전송하면 무효 링크 화면 ----------
await b.goto('http://localhost:8000/resetPassword.html#token=this-is-not-a-real-token');
await type('#reset-password', data.new_password);
await type('#reset-password2', data.new_password);
await click('#reset-form button[type=submit]');
await b.sleep(1200);
s = await st();
check('무효 링크 → 400 무효 링크 화면(경고 + 잠긴 폼 + 다시 요청 줄)', s.invalid === true && s.locked === true && s.recover === true && s.form === true, JSON.stringify(s));
await b.shot(OUT + 'p1-28_site_reset_invalid.png');

summary();
await b.close();
