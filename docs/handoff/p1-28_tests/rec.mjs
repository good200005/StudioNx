import { launch, check, summary } from './lib.mjs';
const b = await launch(9496, 1280, 900); const q = e => b.ev(e);
for (const u of ['/home.html', '/join.html']) {
  await b.send('Page.navigate',{url:'http://localhost:8000'+u}); await b.sleep(3500);
  await q(`document.getElementById('login-modal').showModal(); 1`); await b.sleep(500);
  const r = JSON.parse(await q(`(()=>{const l=document.getElementById('login-recover'), j=document.querySelector('#login-modal .auth-foot a'); const lr=l.getBoundingClientRect(), jr=j.getBoundingClientRect(); const m=document.querySelector('#login-modal').getBoundingClientRect(); return JSON.stringify({text:l.textContent, below: lr.top>=jr.bottom, gap: Math.round(lr.top-jr.bottom), h: Math.round(lr.height), inModal: lr.bottom<=m.bottom, centered: Math.abs((lr.left+lr.width/2)-(jr.left+jr.width/2))<60, ov: document.documentElement.scrollWidth<=innerWidth})})()`));
  check(u+': 링크가 Join Us 아래에 있음', r.below && r.text==="Can't sign in?" && r.inModal, JSON.stringify(r));
  check(u+': 가운데 정렬, 누르는 높이 24px 이상', r.centered && r.h>=24, JSON.stringify(r));
  const y0 = await q('scrollY'); await q(`document.getElementById('login-recover').click(); 1`); await b.sleep(300);
  check(u+': 눌러도 화면이 움직이지 않고 모달이 그대로', (await q('scrollY'))===y0 && await q(`document.getElementById('login-modal').open`));
  if (u==='/home.html') await b.shot('C:/Users/USER/Desktop/myProject/StudioNx/docs/ai-notes/images/p1-28_login_modal_link.png');
}
summary(); await b.close();
