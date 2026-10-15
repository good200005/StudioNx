// readResetToken 검증 (P1-28) — 주소의 #token= 를 읽고 곧바로 지우는가
// 실행: node docs/handoff/p1-28_tests/reset_token.mjs  (개발 서버 8000 필요)
// - 페이지가 뜰 때 resetPassword.js 가 이미 readResetToken() 을 한 번 부르므로(initResetForm),
//   해시를 한 번 더 주소에 넣고(replaceState) 함수를 직접 불러 결과를 본다
import { launch, check, summary } from './lib.mjs';

const { goto, ev, sleep, close } = await launch(9464, 1000, 900);

await goto('http://localhost:8000/resetPassword.html');
await sleep(600);

async function readAt(urlPart) {
  return JSON.parse(await ev(`(async () => {
    history.replaceState(null, '', ${JSON.stringify(urlPart)});
    const m = await import('/static/js/pages/resetPassword.js');
    const t = m.readResetToken();
    return JSON.stringify({ t, hash: location.hash, search: location.search });
  })()`));
}

const a = await readAt('/resetPassword.html#token=abc-123_XYZ');
check('토큰을 그대로 읽음', a.t === 'abc-123_XYZ', JSON.stringify(a));
check('주소창에서 해시를 지움', a.hash === '', JSON.stringify(a));

const b = await readAt('/resetPassword.html#token=');
check('#token= (빈 값)은 토큰 없음', b.t === null, JSON.stringify(b));
check('#token= (빈 값)도 해시를 지움', b.hash === '', JSON.stringify(b));

const c = await readAt('/resetPassword.html');
check('해시 없으면 토큰 없음', c.t === null, JSON.stringify(c));

const d = await readAt('/resetPassword.html#something');
check('다른 해시는 토큰 없음', d.t === null, JSON.stringify(d));
check('다른 해시는 지우지 않음', d.hash === '#something', JSON.stringify(d));

const e = await readAt('/resetPassword.html?x=1#token=tok');
check('쿼리는 남기고 해시만 지움', e.t === 'tok' && e.hash === '' && e.search === '?x=1', JSON.stringify(e));

summary();
close();
