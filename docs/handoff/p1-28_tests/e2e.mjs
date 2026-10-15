import { launch, check, summary } from './lib.mjs';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/ai-notes/images/';
const b = await launch(9510, 1280, 900); const q = e => b.ev(e);
const click = async (sel) => {
  const r = JSON.parse(await q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await b.sleep(400);
};
await b.send('Page.navigate', { url: 'http://localhost:8000/home.html' }); await b.sleep(4000);
const errs0 = b.events.filter(e => e.method === 'Runtime.exceptionThrown').length;
await click('[commandfor="login-modal"]'); await click('#login-recover');
await q(`document.getElementById('recover-password-email').value='e2e-nobody@example.com'; 1`);
await click('#recover-password-form button[type=submit]'); await b.sleep(1500);
const s = JSON.parse(await q(`JSON.stringify({sent: getComputedStyle(document.getElementById('recover-sent')).display!=='none', who: document.getElementById('recover-sent-email').textContent, detail: document.getElementById('recover-sent-detail').textContent, err: document.getElementById('recover-password-error').textContent})`));
check('실제 서버: 없는 주소로 요청해도 같은 "보냈다" 화면(가입 여부 비노출)', s.sent && s.who === 'e2e-nobody@example.com' && s.err === '', JSON.stringify(s));
await b.shot(OUT + 'p1-28_e2e_sent.png');
check('자바스크립트 오류 없음', b.events.filter(e => e.method === 'Runtime.exceptionThrown').length === errs0);
summary(); await b.close();
