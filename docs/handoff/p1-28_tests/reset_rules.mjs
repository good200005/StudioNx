// initResetPasswordRules 검증 (P1-28) — 규칙 표시, 허용 문자, 확인 칸 일치
// 실행: node docs/handoff/p1-28_tests/reset_rules.mjs  (개발 서버 8000 필요)
import { launch, check, summary } from './lib.mjs';

const b = await launch(9465, 1100, 900);
const q = e => b.ev(e);
// 토큰을 붙여 연다 — 토큰이 없으면 initResetForm 이 폼을 잠가(입력·전송 막음) 타이핑 시험이 안 된다
await b.send('Page.navigate', { url: 'http://localhost:8000/resetPassword.html#token=RULES-TOKEN' });
await b.sleep(2500);

const focus = sel => q(`document.querySelector(${JSON.stringify(sel)}).focus(); 1`);
const typeInto = async (sel, text) => { await focus(sel); await b.send('Input.insertText', { text }); await b.sleep(120); };
const setVal = async (sel, text) => q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(text)}; e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const blur = sel => q(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.focus(); e.blur();})()`);
const rules = async () => JSON.parse(await q(`JSON.stringify([...document.querySelectorAll('#reset-password-rules li')].map(li=>({r:li.dataset.rule, met:li.classList.contains('is-met')})))`));
const msg = sel => q(`document.querySelector(${JSON.stringify(sel)}).textContent`);
const isErr = sel => q(`document.querySelector(${JSON.stringify(sel)}).classList.contains('is-error')`);

// 1. 실제 타이핑으로 모든 규칙 충족
await typeInto('#reset-password', 'Passw0rd!');
let r = await rules();
check('실제 타이핑: 규칙 5개 모두 is-met', r.every(x => x.met), JSON.stringify(r));

// 2. 규칙 미달 + blur 안내
await setVal('#reset-password', 'abc');
r = await rules();
check('"abc": length·lower만 met', JSON.stringify(r) === JSON.stringify([
  { r: 'length', met: false }, { r: 'upper', met: false }, { r: 'lower', met: true },
  { r: 'number', met: false }, { r: 'special', met: false }]), JSON.stringify(r));
await blur('#reset-password');
check('규칙 미달로 blur → Check the password requirements.', (await msg('#reset-password-msg')) === 'Check the password requirements.', await msg('#reset-password-msg'));
check('비밀번호 칸 is-error', (await isErr('#reset-password-field')) === true);

// 3. 허용되지 않는 문자(한글)
await setVal('#reset-password', '한글');
check('한글 입력 → Use only English letters, numbers and symbols.', (await msg('#reset-password-msg')) === 'Use only English letters, numbers and symbols.', await msg('#reset-password-msg'));
await setVal('#reset-password', 'Passw0rd!');
check('허용 문자로 돌아오면 오류 문구 사라짐', (await isErr('#reset-password-field')) === false);

// 4. 확인 칸 불일치 / 일치 (입력 중에는 비밀번호 길이 이상일 때만, blur에서는 무조건)
await setVal('#reset-password2', 'Passw0rd');   // 8 < 9: 입력 중에는 아직 안내하지 않음
check('확인 칸이 비밀번호보다 짧을 때 입력 중에는 안내 없음', (await isErr('#reset-password2-field')) === false);
await blur('#reset-password2');
check('확인 칸 blur → Passwords don\'t match.', (await msg('#reset-password2-msg')) === "Passwords don't match.", await msg('#reset-password2-msg'));
await setVal('#reset-password2', 'Passw0rd?'); // 9 >= 9, 다름: 입력 중 바로 안내
check('확인 칸이 길이 이상이고 다르면 입력 중 안내', (await msg('#reset-password2-msg')) === "Passwords don't match.", await msg('#reset-password2-msg'));
await setVal('#reset-password2', 'Passw0rd!');
check('확인 칸 일치 → 오류 없음', (await isErr('#reset-password2-field')) === false);

// 5. 두 번 불러도 true
check('두 번 불러도 true', (await q(`(async()=>{const m=await import('/static/js/pages/resetPassword.js'); return m.initResetPasswordRules();})()`)) === true);

// 6. 화면 읽기용 문구도 갱신되는가
await setVal('#reset-password', 'x');
const states = JSON.parse(await q(`JSON.stringify([...document.querySelectorAll('#reset-password-rules li')].map(li=>li.querySelector('[data-rule-state]').textContent))`));
check('data-rule-state 글자 갱신 (5개)', states.length === 5 && states[0] === ', not met', JSON.stringify(states));

summary();
b.close();
