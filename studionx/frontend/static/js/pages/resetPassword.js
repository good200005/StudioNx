// resetPassword.html 페이지 스크립트 — 비밀번호 재설정 (P1-28, FR-118)
// 재설정 메일의 링크(resetPassword.html#token=…)로 들어오는 로그인 전 페이지.
// 함수를 하나씩 만들어 사용자 검토를 받음 (readResetToken → initResetPasswordRules → initResetForm, 모두 완료).
import { includePartials } from '../core/include.js';
import { initAuthState, initPasswordToggles, setFieldState } from '../core/auth-ui.js';
import { initModalFallback } from '../core/modal.js';
import { initFormAlerts } from '../core/dialog.js';
import { api } from '../core/api.js';
import { PASSWORD_RULES, PASSWORD_ALLOWED } from '../core/password.js';

/** 재설정 토큰 (이 파일 안에서만 씀). 주소창에서 지운 뒤 여기에만 두고 localStorage 에는 두지 않는다 */
let resetToken = null;

/**
 * 주소의 #token=<값> 을 읽고 곧바로 주소창에서 지움 (P1-28, FR-118)
 * - 재설정 메일의 링크는 `resetPassword.html#token=<원문>` 이다 (백엔드 password_reset_service.py:160)
 * - 읽은 값을 돌려주고 이 파일의 `resetToken` 에만 둠. localStorage·쿠키에 두지 않는다 (XSS·기록 대비)
 * - 주소창에서는 곧바로 지움(history.replaceState): 해시는 서버로 가지 않지만, 새로 고침·뒤로 가기·주소 복사로
 *   토큰이 남지 않게 하고, 이 페이지에서 다른 곳으로 갈 때(Referer) 새지 않게 함 (`<meta name="referrer" content="no-referrer">` 와 함께)
 * - `#token=` 로 시작하면 그 뒤를 전부 값으로 봄: 토큰은 `secrets.token_urlsafe(32)` 라 `-` `_` 밖에 안 들어가지만
 *   값이 비어 있으면(#token=) 토큰 없음으로 본다
 * - 해시가 `#token=` 로 시작하지 않으면(다른 해시 또는 해시 없음) 아무것도 지우지 않고 토큰 없음으로 본다
 * - 토큰이 없으면 null 을 돌려주고 `resetToken` 도 null: 부르는 쪽이 "무효 링크" 화면을 보여 준다
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @returns {string|null} 읽은 토큰, 없으면 null
 */
export function readResetToken() {
  const hash = location.hash || '';
  const prefix = '#token=';
  let token = null;

  if (hash.indexOf(prefix) === 0) {
    const value = hash.slice(prefix.length);
    if (value !== '') token = value;
    // 주소창에서 지움 (경로와 쿼리만 남김)
    history.replaceState(null, '', location.pathname + location.search);
  }

  resetToken = token;
  return resetToken;
}

/**
 * 새 비밀번호 규칙 표시와 확인 칸 일치 검사 (P1-28, FR-118·102)
 * - 입력할 때마다 core/password.js 의 PASSWORD_RULES 로 검사해
 *   #reset-password-rules li[data-rule="…"] 에 is-met 클래스 붙이기/빼기 (auth.css: ✓ 초록 / ○ 회색)
 *   같은 li 안 [data-rule-state] 글자도 ', met' / ', not met' 로 (화면 읽기 프로그램용)
 * - PASSWORD_ALLOWED 에 맞지 않으면(한글·공백 등): setFieldState(비밀번호 칸, 'error', 'Use only English letters, numbers and symbols.')
 * - 비밀번호 칸을 벗어날 때(blur) 규칙이 하나라도 안 맞으면: 'Check the password requirements.'
 * - 확인 칸이 다르면: "Passwords don't match." (확인 칸을 벗어났거나, 비밀번호만큼 다 쳤을 때. 맞으면 바로 지움)
 * - join.js 의 initPasswordRules 와 같은 규칙·같은 문구 (가입 화면과 같은 core/password.js 를 씀)
 * - 두 번 불러도 처리기가 겹치지 않음 (oninput, onblur 대입)
 * - 비밀번호 칸이 없으면 아무것도 연결하지 않고 false
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @returns {boolean} 연결했으면 true
 */
export function initResetPasswordRules() {
  const password = document.getElementById('reset-password');
  const confirm = document.getElementById('reset-password2');
  const passwordField = document.getElementById('reset-password-field');
  const confirmField = document.getElementById('reset-password2-field');
  const items = document.querySelectorAll('#reset-password-rules li[data-rule]');
  if (!password || !confirm || !passwordField || !confirmField) return false;

  const allMet = function () {
    for (const name of Object.keys(PASSWORD_RULES)) {
      if (!PASSWORD_RULES[name](password.value)) return false;
    }
    return true;
  };

  const showRules = function () {
    for (const item of items) {
      const rule = PASSWORD_RULES[item.dataset.rule];
      const met = rule ? rule(password.value) : false;
      item.classList.toggle('is-met', met);
      const state = item.querySelector('[data-rule-state]');
      if (state) state.textContent = met ? ', met' : ', not met';
    }
  };

  const checkConfirm = function (force) {
    if (confirm.value === '') {
      setFieldState(confirmField, null);
    } else if (confirm.value === password.value) {
      setFieldState(confirmField, null);
    } else if (force || confirm.value.length >= password.value.length) {
      setFieldState(confirmField, 'error', "Passwords don't match.");
    }
  };

  password.oninput = function () {
    showRules();
    if (!PASSWORD_ALLOWED.test(password.value)) {
      setFieldState(passwordField, 'error', 'Use only English letters, numbers and symbols.');
    } else {
      setFieldState(passwordField, null);
    }
    if (confirm.value !== '') checkConfirm(true);   // 확인 칸을 이미 쳤으면 바로 다시 비교
  };
  password.onblur = function () {
    if (password.value !== '' && PASSWORD_ALLOWED.test(password.value) && !allMet()) {
      setFieldState(passwordField, 'error', 'Check the password requirements.');
    }
  };
  confirm.oninput = function () { checkConfirm(false); };
  confirm.onblur = function () { checkConfirm(true); };
  showRules();
  return true;
}

/**
 * 재설정 폼 전송과 무효 링크·성공 화면 (P1-28, FR-118)
 * - 페이지를 열면 먼저 토큰을 확인한다(readResetToken). 토큰이 없으면 폼을 잠그고 무효 링크 화면을 보여 준다
 *   (경고 상자 #reset-invalid 를 보이고, .reset__card 에 is-locked 를 붙여 입력·전송을 막고, #reset-recover-row 를 보임)
 * - 전송 전에 화면에서 규칙·확인을 먼저 검사한다. 틀린 칸이 있으면 그 칸에 문구를 넣고 커서를 옮긴 뒤 보내지 않는다
 * - POST /api/v1/auth/password-reset/confirm  JSON { token, new_password }  (로그인 필요 없음 — auth: false)
 * - 성공(204): 자동 로그인을 하지 않고 성공 화면(#reset-done)을 보여 준다 (FR-118). 폼과 안내문을 숨긴다
 * - 400(INVALID_RESET_LINK): 링크가 틀렸거나 만료됐거나 이미 씀 — 무효 링크 화면(경고 + 잠긴 폼 + 다시 요청 줄)
 * - 422: 서버가 규칙 위반을 알림 — 비밀번호 칸에 'Check the password requirements.' (링크는 그대로 쓸 수 있음)
 * - 연결 실패(0)와 그 밖(500 등): #reset-error 에 문구를 보이고 버튼을 풀어 다시 시도할 수 있게 한다
 * - 보내는 동안 버튼을 잠그고 두 번째 전송은 무시한다(data-busy)
 * - 두 번 불러도 처리기가 겹치지 않고, 이미 읽은 토큰을 다시 읽지 않는다 (onsubmit 대입, resetToken 재사용)
 * - 폼이나 입력칸이 없으면 아무것도 연결하지 않고 false
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @returns {boolean} 연결했으면 true
 */
export function initResetForm() {
  const form = document.getElementById('reset-form');
  const card = document.querySelector('.reset__card');
  const invalid = document.getElementById('reset-invalid');
  const invalidText = document.getElementById('reset-invalid-text');
  const recoverRow = document.getElementById('reset-recover-row');
  const done = document.getElementById('reset-done');
  const sub = document.getElementById('reset-sub');
  const password = document.getElementById('reset-password');
  const confirm = document.getElementById('reset-password2');
  const passwordField = document.getElementById('reset-password-field');
  const confirmField = document.getElementById('reset-password2-field');
  const error = document.getElementById('reset-error');
  if (!form || !password || !confirm) return false;
  const submit = form.querySelector('button[type="submit"]');

  const isLocked = function () {
    return card ? card.classList.contains('is-locked') : false;
  };

  // 무효 링크: 경고를 보이고 폼을 잠근다 (입력·전송을 막고), 다시 요청 줄을 보인다
  const showInvalid = function () {
    if (invalid) invalid.hidden = false;
    if (card) card.classList.add('is-locked');
    for (const control of form.querySelectorAll('input, button')) control.disabled = true;
    if (recoverRow) recoverRow.hidden = false;
  };

  // 성공: 폼과 안내문을 감추고 성공 화면을 보인다 (자동 로그인은 하지 않음)
  const showDone = function () {
    form.hidden = true;
    if (sub) sub.hidden = true;
    if (invalid) invalid.hidden = true;
    if (recoverRow) recoverRow.hidden = true;
    if (done) done.hidden = false;
  };

  // 토큰이 없으면 폼을 잠그고 무효 링크 화면만 보여 준다 (전송은 연결하지 않음)
  // - 이미 읽은 토큰(resetToken)이 있으면 다시 읽지 않는다 (두 번 불렀을 때 해시가 이미 지워져 있음)
  const token = resetToken || readResetToken();
  if (!token) {
    showInvalid();
    return true;
  }

  form.onsubmit = async function (event) {
    event.preventDefault();
    if (form.getAttribute('data-busy') === 'true') return;
    if (error) error.hidden = true;

    // 화면에서 먼저 검사 — 틀린 칸에 문구를 넣고 그 칸으로 커서를 옮긴 뒤 보내지 않음
    let problem = null;
    if (!PASSWORD_ALLOWED.test(password.value)) {
      setFieldState(passwordField, 'error', 'Use only English letters, numbers and symbols.');
      problem = password;
    } else {
      let met = true;
      for (const name of Object.keys(PASSWORD_RULES)) {
        if (!PASSWORD_RULES[name](password.value)) met = false;
      }
      if (!met) {
        setFieldState(passwordField, 'error', 'Check the password requirements.');
        problem = password;
      }
    }
    if (!problem && confirm.value !== password.value) {
      setFieldState(confirmField, 'error', "Passwords don't match.");
      problem = confirm;
    }
    if (problem) {
      problem.focus();
      return;
    }

    form.setAttribute('data-busy', 'true');
    if (submit) submit.disabled = true;
    try {
      await api.post(
        '/auth/password-reset/confirm',
        { token: token, new_password: password.value },
        { auth: false },
      );
      showDone();
    } catch (err) {
      if (err && err.status === 400) {
        showInvalid();   // 링크가 틀렸거나 만료됐거나 이미 씀 — 다시 요청 안내
      } else if (err && err.status === 422) {
        setFieldState(passwordField, 'error', 'Check the password requirements.');
        password.focus();
      } else if (error) {
        error.textContent = err && err.status === 0
          ? "Can't reach the server. Check your connection and try again."
          : 'Something went wrong. Please try again.';
        error.hidden = false;
      }
    } finally {
      form.removeAttribute('data-busy');
      if (submit && !isLocked()) submit.disabled = false;   // 잠긴(무효 링크) 화면에서는 풀지 않음
    }
  };
  return true;
}

// 공통 헤더·푸터·로그인 모달을 먼저 끼움 (static/partials/)
await includePartials();

initModalFallback();
initAuthState();
initFormAlerts();
initPasswordToggles();
initResetPasswordRules();
initResetForm();
