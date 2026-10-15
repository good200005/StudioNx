import { launch, check, summary } from './lib.mjs';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/ai-notes/images/';
const b = await launch(9511, 1280, 900); const q = e => b.ev(e);
const S = async () => JSON.parse(await q(`JSON.stringify({dis: document.getElementById('recover-resend').disabled, note: document.getElementById('recover-resend-wait').textContent, timer: !!document.getElementById('login-modal').recoverTimer})`));
const call = (expr) => q(`window.__m.${expr}`);
const run = async (u) => {
  await b.send('Page.navigate', { url: 'http://localhost:8000' + u }); await b.sleep(3500);
  await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(500);
  const M = `document.getElementById('login-modal')`;
  check(u + ': 기본 시간 상수 60', (await q(`window.__m.RESEND_COOLDOWN_SECONDS`)) === 60);
  let s = await S();
  check(u + ': 시작 전: 잠겨 있고 글자 없음', s.dis === true && s.note === '' && s.timer === false, JSON.stringify(s));
  const r = await call(`startResendCooldown(${M}, 3)`); s = await S();
  check(u + ': 시작하면 true, 잠김, "(available in 3s)", 타이머 있음', r === true && s.dis && s.note === '(available in 3s)' && s.timer, JSON.stringify([r, s]));
  await b.sleep(1300); s = await S();
  check(u + ': 1초쯤 뒤 2초로 줄어듦(아직 잠김)', s.dis && s.note === '(available in 2s)', JSON.stringify(s));
  await b.sleep(2200); s = await S();
  check(u + ': 끝나면 풀리고 글자가 지워지고 타이머가 정리됨', s.dis === false && s.note === '' && s.timer === false, JSON.stringify(s));
  await b.sleep(1500); s = await S();
  check(u + ': 끝난 뒤에는 다시 잠기거나 글자가 생기지 않음(타이머 누수 없음)', s.dis === false && s.note === '', JSON.stringify(s));

  // 다시 시작하면 처음부터
  await call(`startResendCooldown(${M}, 5)`); await b.sleep(2200);
  const mid = await S();
  await call(`startResendCooldown(${M}, 5)`); const re = await S();
  check(u + ': 세는 중에 다시 시작하면 처음부터(5초)', mid.note === '(available in 3s)' && re.note === '(available in 5s)' && re.dis, JSON.stringify([mid, re]));
  await b.sleep(1300); s = await S();
  check(u + ': 다시 시작한 뒤 타이머가 하나뿐(1초에 1씩만 줄어듦)', s.note === '(available in 4s)', JSON.stringify(s));
  // 멈추기
  const st = await call(`stopResendCooldown(${M})`); s = await S();
  check(u + ': stop: true, 잠기고 글자 지워지고 타이머 정리', st === true && s.dis && s.note === '' && s.timer === false, JSON.stringify([st, s]));
  await b.sleep(1500); s = await S();
  check(u + ': stop 뒤 시간이 지나도 풀리지 않음', s.dis === true && s.note === '', JSON.stringify(s));
  check(u + ': 타이머가 없을 때 stop 을 또 불러도 오류 없이 true', (await call(`stopResendCooldown(${M})`)) === true);

  // 끝난 뒤(풀린 상태)에 stop 하면 다시 잠김
  await call(`startResendCooldown(${M}, 1)`); await b.sleep(1800);
  const done = await S(); await call(`stopResendCooldown(${M})`); const after = await S();
  check(u + ': 풀린 뒤 stop 하면 다시 잠김(다음 전송까지 잠금)', done.dis === false && after.dis === true, JSON.stringify([done, after]));

  // 시간은 지금 시각 기준: 시계를 앞으로 돌리면 다음 틱에 풀림 (횟수를 세지 않음)
  await call(`startResendCooldown(${M}, 60)`);
  await q(`window.__realNow = Date.now; Date.now = () => window.__realNow() + 120000; 1`); await b.sleep(1300);
  s = await S(); await q(`Date.now = window.__realNow; 1`);
  check(u + ': 시계가 앞서가면(백그라운드 탭이 느려진 경우) 다음 틱에 풀림', s.dis === false && s.note === '' && s.timer === false, JSON.stringify(s));
  await call(`stopResendCooldown(${M})`);

  // 기본값 60초
  await call(`startResendCooldown(${M})`); s = await S();
  check(u + ': 시간을 생략하면 60초', s.note === '(available in 60s)' && s.dis, JSON.stringify(s));
  await call(`stopResendCooldown(${M})`);
  // 소수 초는 올림
  await call(`startResendCooldown(${M}, 2.2)`); s = await S();
  check(u + ': 2.2초는 3으로 올림해 보여 줌', s.note === '(available in 3s)', JSON.stringify(s));
  await call(`stopResendCooldown(${M})`);

  // 잘못된 시간
  for (const bad of ['0', '-1', 'NaN', 'Infinity', '-Infinity', `'5'`, 'null', 'true', '[]', '{}']) {
    await call(`stopResendCooldown(${M})`); const before = await S();
    const rr = await call(`startResendCooldown(${M}, ${bad})`); const after = await S();
    check(u + ': 잘못된 시간 ' + bad + ' → false, 안 바뀜', rr === false && JSON.stringify(before) === JSON.stringify(after), JSON.stringify([rr, before, after]));
  }
  check(u + ': 모달이 null 이면 둘 다 false', (await call(`startResendCooldown(null, 3)`)) === false && (await call(`stopResendCooldown(null)`)) === false);
  if (u === '/home.html') {
    await q(`const m=${M}; m.showModal(); window.__m.initRecover(m); document.getElementById('login-recover').click(); window.__m.showSentView(m,'password','you@example.com'); window.__m.startResendCooldown(m, 42); 1`); await b.sleep(400);
    await b.shot(OUT + 'p1-28_resend_cooldown.png');
    await q(`${M}.close(); 1`);
  }
};
await run('/home.html'); await run('/join.html');
await b.send('Page.navigate', { url: 'http://localhost:8000/home.html' }); await b.sleep(3000);
await q(`import('/static/js/core/recover.js').then(m => { window.__m = m; }); 1`); await b.sleep(400);
const f = JSON.parse(await q(`(()=>{ const d=document.createElement('div'); d.innerHTML='<div id="recover-resend-wait"></div>'; document.body.appendChild(d);
  const onlyBtn=document.createElement('div'); onlyBtn.innerHTML='<button id="recover-resend" disabled></button>'; document.body.appendChild(onlyBtn);
  let threw=false, r; try { r = window.__m.startResendCooldown(onlyBtn, 2); } catch(e) { threw=true; }
  const ok = window.__m.stopResendCooldown(onlyBtn);
  return JSON.stringify({noButtonStart: window.__m.startResendCooldown(d, 2), noButtonStop: window.__m.stopResendCooldown(d), onlyBtn: r, threw, stopOk: ok}) })()`));
check('버튼이 없으면 false(글자 칸만 있어도)', f.noButtonStart === false && f.noButtonStop === false, JSON.stringify(f));
check('안내 글자 칸이 없어도 오류 없이 동작', f.onlyBtn === true && f.threw === false && f.stopOk === true, JSON.stringify(f));
summary(); await b.close();
