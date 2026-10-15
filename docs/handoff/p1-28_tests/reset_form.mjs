// initResetForm 검증 (P1-28) — 전송, 성공, 무효 링크(400), 규칙 오류(422), 연결 실패, 중복 클릭, 토큰 없음
// 실행: node docs/handoff/p1-28_tests/reset_form.mjs  (개발 서버 8000 필요)
import { launch, check, summary } from './lib.mjs';

const b = await launch(9466, 1100, 900);
const q = e => b.ev(e);
const BASE = 'http://localhost:8000/resetPassword.html';
// 해시만 바꾸면 페이지가 다시 안 실림(same-document 이동) — 매번 다른 쿼리를 붙여 새로 실음
let nav = 0;
const open = async hash => { await b.goto(BASE + '?r=' + (++nav) + hash); await b.sleep(400); };

const setVals = (p, c) => q(`(()=>{const a=document.getElementById('reset-password');const b=document.getElementById('reset-password2');a.value=${JSON.stringify(p)};b.value=${JSON.stringify(c)};})()`);
const submit = () => q(`document.getElementById('reset-form').dispatchEvent(new Event('submit',{cancelable:true})); 1`);
const state = async () => JSON.parse(await q(`JSON.stringify({
  locked: document.querySelector('.reset__card').classList.contains('is-locked'),
  invalidShown: !document.getElementById('reset-invalid').hidden,
  formShown: !document.getElementById('reset-form').hidden,
  doneShown: !document.getElementById('reset-done').hidden,
  subShown: !document.getElementById('reset-sub').hidden,
  recoverShown: !document.getElementById('reset-recover-row').hidden,
  errShown: !document.getElementById('reset-error').hidden,
  errText: document.getElementById('reset-error').textContent,
  pwErr: document.getElementById('reset-password-field').classList.contains('is-error'),
  pwMsg: document.getElementById('reset-password-msg').textContent,
  cfErr: document.getElementById('reset-password2-field').classList.contains('is-error'),
  submitDisabled: document.querySelector('#reset-form button[type=submit]').disabled,
  disabledCount: document.querySelectorAll('#reset-form input:disabled, #reset-form button:disabled').length,
  calls: window.__calls ? window.__calls.length : -1
})`));

// 가짜 fetch 설치: status 204(성공) / 그 외(오류) / 0(연결 실패) / 'slow'(지연)
const installFetch = mode => q(`(()=>{
  window.__calls = [];
  window.fetch = function(url, opts){
    window.__calls.push({ url: url, body: opts && opts.body });
    if (${JSON.stringify(mode)} === 0) return Promise.reject(new TypeError('network'));
    const status = ${JSON.stringify(mode)};
    const fail = (code) => ({ ok:false, status, json: async () => ({ error: { code: code, message: 'server says' } }), text: async () => '' });
    const reply = status === 204
      ? Promise.resolve({ ok:true, status:204, text: async () => '', json: async () => null })
      : Promise.resolve(fail(status === 400 ? 'INVALID_RESET_LINK' : 'VALIDATION_ERROR'));
    if (${JSON.stringify(mode)} === 'slow') return new Promise(r => setTimeout(() => r({ ok:true, status:204, text: async()=>'' }), 400));
    return reply;
  };
})()`);

// ---------- 준비: 유효 토큰으로 열기 ----------
await open('#token=GOOD-TOKEN_1');
await installFetch(204);

let s = await state();
check('유효 토큰: 잠기지 않음', s.locked === false, JSON.stringify(s));
check('유효 토큰: 무효 경고 숨김, 폼 보임, 다시 요청 줄 숨김', s.invalidShown === false && s.formShown === true && s.recoverShown === false && s.doneShown === false, JSON.stringify(s));

// ---------- 1. 규칙 미달 → 전송하지 않음 ----------
await setVals('abc', 'abc');
await submit();
await b.sleep(150);
s = await state();
check('규칙 미달 → 비밀번호 칸 오류, 서버로 안 보냄', s.pwErr === true && s.pwMsg === 'Check the password requirements.' && s.calls === 0, JSON.stringify(s));

// ---------- 2. 확인 불일치 → 전송하지 않음 ----------
await setVals('Passw0rd!', 'Passw0rd?');
await submit();
await b.sleep(150);
s = await state();
check('확인 불일치 → 확인 칸 오류, 서버로 안 보냄', s.cfErr === true && s.calls === 0, JSON.stringify(s));

// ---------- 3. 성공(204) ----------
await setVals('Passw0rd!', 'Passw0rd!');
await submit();
await b.sleep(200);
s = await state();
const sent = JSON.parse(await q(`JSON.stringify(window.__calls[0])`));
check('성공 → 성공 화면, 폼·안내문 숨김', s.doneShown === true && s.formShown === false && s.subShown === false && s.invalidShown === false, JSON.stringify(s));
check('성공 → 한 번 보냄, 주소가 confirm', s.calls === 1 && sent.url === '/api/v1/auth/password-reset/confirm', JSON.stringify(sent));
const sentBody = JSON.parse(sent.body);
check('성공 → 본문에 token 과 new_password', sentBody.token === 'GOOD-TOKEN_1' && sentBody.new_password === 'Passw0rd!', sent.body);

// ---------- 4. 400 무효 링크 ----------
await open('#token=BAD');
await installFetch(400);
await setVals('Passw0rd!', 'Passw0rd!');
await submit();
await b.sleep(200);
s = await state();
check('400 → 무효 경고 보임, 폼 잠김, 다시 요청 줄 보임', s.invalidShown === true && s.locked === true && s.recoverShown === true, JSON.stringify(s));
check('400 → 폼은 그대로 보이되 입력·전송 잠김', s.formShown === true && s.disabledCount >= 2 && s.submitDisabled === true, JSON.stringify(s));

// ---------- 5. 422 규칙 오류 (링크는 그대로 쓸 수 있음) ----------
await open('#token=GOOD-TOKEN_2');
await installFetch(422);
await setVals('Passw0rd!', 'Passw0rd!');
await submit();
await b.sleep(200);
s = await state();
check('422 → 비밀번호 칸 오류, 잠기지 않고 버튼 다시 켜짐', s.pwErr === true && s.locked === false && s.invalidShown === false && s.submitDisabled === false, JSON.stringify(s));

// ---------- 6. 연결 실패 ----------
await open('#token=GOOD-TOKEN_3');
await installFetch(0);
await setVals('Passw0rd!', 'Passw0rd!');
await submit();
await b.sleep(200);
s = await state();
check('연결 실패 → 폼 아래 문구, 버튼 다시 켜짐', s.errShown === true && /reach the server/.test(s.errText) && s.submitDisabled === false && s.locked === false, JSON.stringify(s));

// ---------- 7. 보내는 중 두 번째 전송 무시 (중복 클릭) ----------
await open('#token=GOOD-TOKEN_4');
await installFetch('slow');
await setVals('Passw0rd!', 'Passw0rd!');
await submit();
await b.sleep(50);
await submit();
await b.sleep(600);
s = await state();
check('보내는 중 두 번째 전송은 무시 (한 번만)', s.calls === 1 && s.doneShown === true, JSON.stringify(s));

// ---------- 8. 토큰 없음 → 처음부터 무효 링크 ----------
await open('');
s = await state();
check('토큰 없음 → 무효 경고, 폼 잠김, 다시 요청 줄 보임', s.invalidShown === true && s.locked === true && s.recoverShown === true && s.formShown === true, JSON.stringify(s));

// ---------- 9. 두 번 불러도 안전 (토큰을 다시 읽지 않음) ----------
await open('#token=AGAIN');
const twice = await q(`(async()=>{const m=await import('/static/js/pages/resetPassword.js'); return m.initResetForm();})()`);
s = await state();
check('두 번 불러도 true 이고 잠기지 않음', twice === true && s.locked === false && s.invalidShown === false, JSON.stringify(s));

summary();
b.close();
