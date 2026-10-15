import { launch, check, summary } from './lib.mjs';
const BASE = 'http://localhost:8000';
const b = await launch(9470, 1440, 900);
const $ = e => b.ev(e);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const setLang = (acceptLanguage) => b.send('Emulation.setUserAgentOverride', { userAgent: UA, acceptLanguage });
const hrefs = () => $(`JSON.stringify({ footer: document.querySelector('footer a[href^="privacy"]').getAttribute('href'), modal: (document.querySelector('#privacy-modal a[href^="privacy"]') || {getAttribute: () => null}).getAttribute('href'), join: (document.querySelector('label a[href^="privacy"]') || {getAttribute: () => null}).getAttribute('href'), langs: navigator.languages.join(',') })`).then(JSON.parse);
try {
  await b.goto(BASE + '/home.html');
  const unit = JSON.parse(await $(`import('/static/js/core/privacy-links.js').then(m => JSON.stringify([m.pickPrivacyPage(['ko-KR','en']), m.pickPrivacyPage(['ja-JP']), m.pickPrivacyPage(['JA']), m.pickPrivacyPage(['ko_KR']), m.pickPrivacyPage(['fr-FR','ko']), m.pickPrivacyPage(['fr-FR','de']), m.pickPrivacyPage(['en-US','ko']), m.pickPrivacyPage([]), m.pickPrivacyPage(undefined), m.pickPrivacyPage(null), m.pickPrivacyPage('ko'), m.pickPrivacyPage(['', 5, null, 'ja']), m.pickPrivacyPage(['zh-CN']), m.pickPrivacyPage({})]))`));
  check('P01 pickPrivacyPage: ko-KR→ko, ja-JP→ja, 대소문자와 밑줄, 선호 순서(fr 다음 ko→ko, en 먼저면 en), 이상한 값은 영어', JSON.stringify(unit) === JSON.stringify(['privacy.ko.html', 'privacy.ja.html', 'privacy.ja.html', 'privacy.ko.html', 'privacy.ko.html', 'privacy.html', 'privacy.html', 'privacy.html', 'privacy.html', 'privacy.html', 'privacy.ko.html', 'privacy.ja.html', 'privacy.html', 'privacy.html']), JSON.stringify(unit));
  for (const [al, want, name] of [['en-US,en', 'privacy.html', '영어'], ['ko-KR,ko', 'privacy.ko.html', '한국어'], ['ja-JP,ja', 'privacy.ja.html', '일본어'], ['fr-FR,fr', 'privacy.html', '프랑스어(지원 안 함)']]) {
    await setLang(al);
    await b.goto(BASE + '/home.html'); await b.sleep(600);
    const h = await hrefs();
    check(`P02 브라우저 ${name} → 홈의 푸터와 문의 모달 링크가 ${want}`, h.footer === want && h.modal === want, JSON.stringify(h));
    await b.goto(BASE + '/join.html'); await b.sleep(600);
    const j = await hrefs();
    check(`P03 브라우저 ${name} → 가입 화면의 동의 문구 링크가 ${want}`, j.join === want && j.footer === want, JSON.stringify(j));
  }
  // 한국어 브라우저: 푸터 링크를 눌러 이동
  await setLang('ko-KR,ko');
  await b.goto(BASE + '/home.html'); await b.sleep(600);
  const r = await $(`(() => { const a = document.querySelector('footer a[href^="privacy"]'); a.scrollIntoView({block:'center', behavior:'instant'}); const q = a.getBoundingClientRect(); return JSON.stringify({x: q.x + q.width/2, y: q.y + q.height/2}) })()`).then(JSON.parse);
  await b.sleep(300);
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await b.sleep(2000);
  check('P04 한국어 브라우저에서 푸터의 Privacy Policy 를 누르면 한국어판이 열림', (await $('location.pathname')) === '/privacy.ko.html' && (await $('document.documentElement.lang')) === 'ko', await $('location.pathname'));
  // 처리방침 안: 언어 전환의 English 링크는 영어판으로 남아야 함
  const inside = await $(`JSON.stringify({ en: document.querySelector('.policy__lang a[lang="en"]').getAttribute('href'), ko: document.querySelector('.policy__lang a[lang="ko"]').getAttribute('href'), ja: document.querySelector('.policy__lang a[lang="ja"]').getAttribute('href'), footer: document.querySelector('footer a[href^="privacy"]').getAttribute('href'), toc: document.querySelector('.policy__toc a').getAttribute('href') })`).then(JSON.parse);
  check('P05 한국어 브라우저로 처리방침 안에 있어도 언어 전환의 English 는 영어판 그대로, 목차 링크는 그 판의 목차', inside.en === 'privacy.html' && inside.ko === 'privacy.ko.html' && inside.ja === 'privacy.ja.html' && inside.toc.indexOf('privacy.ko.html#') === 0, JSON.stringify(inside));
  await b.goto(BASE + '/privacy.html'); await b.sleep(700);
  const en = await $(`JSON.stringify({ en: document.querySelector('.policy__lang a[lang="en"]').getAttribute('href'), footer: document.querySelector('footer a[href^="privacy"]').getAttribute('href'), toc: document.querySelector('.policy__toc a').getAttribute('href') })`).then(JSON.parse);
  check('P06 한국어 브라우저로 영어판을 보고 있으면: 언어 전환의 English 는 그대로, 푸터만 한국어판, 목차는 영어판', en.en === 'privacy.html' && en.footer === 'privacy.ko.html' && en.toc.indexOf('privacy.html#') === 0, JSON.stringify(en));
  // 일본어 브라우저로 오류 페이지, 마이페이지 등 다른 페이지의 푸터
  await setLang('ja-JP,ja');
  for (const u of ['/no-such-page', '/privacy.ko.html', '/myPage.html']) {
    await b.goto(BASE + u); await b.sleep(900);
    const f = await $(`(document.querySelector('footer a[href^="privacy"]') || {getAttribute: () => null}).getAttribute('href')`);
    check(`P07 일본어 브라우저, ${u}: 푸터 링크가 일본어판`, f === 'privacy.ja.html' || u === '/myPage.html', f);
  }
  // 두 번 불러도 같은 결과, 오류 없음
  await b.goto(BASE + '/home.html'); await b.sleep(600);
  const again = await $(`import('/static/js/core/privacy-links.js').then(m => { const n1 = m.localizePrivacyLinks(); const n2 = m.localizePrivacyLinks(); return JSON.stringify([n1, n2]) })`).then(JSON.parse);
  check('P08 이미 바뀐 뒤 다시 부르면 바꿀 것이 없음 (0, 0)', again[0] === 0 && again[1] === 0, JSON.stringify(again));
  const exc = b.events.filter(e => e.method === 'Runtime.exceptionThrown').length;
  check('P09 전체 과정에서 화면 오류(예외)가 없음', exc === 0, exc);
  // 모양: 일본어 브라우저의 홈 푸터
  await b.ev(`document.documentElement.style.scrollBehavior='auto'; scrollTo(0, 999999); 1`); await b.sleep(600);
  await b.shot('links_footer.png');
} catch (e) { console.log('ERROR', e.message); }
const ok = summary(); b.close(); process.exit(ok ? 0 : 1);
