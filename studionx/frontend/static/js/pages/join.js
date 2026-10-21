// join.html 페이지 스크립트 (템플릿 — 구현은 직접, P1-07)
// 화면 오류를 Sentry 로 보냄 (S1-13) — 다른 파일을 불러오다 난 오류도 잡도록 반드시 첫 import 로 둡니다
import '../core/sentry-init.js';
import { initLoginForm, initPasswordToggles, initOAuthPlaceholders, setFieldState } from '../core/auth-ui.js';
import { initModalFallback } from '../core/modal.js';
import { includePartials } from '../core/include.js';
import { api } from '../core/api.js';
import { initFormAlerts } from '../core/dialog.js';
import { initRecover, initRecoverFromHash, initRecoverForms, initRecoverResend } from '../core/recover.js';
import { PASSWORD_RULES, PASSWORD_ALLOWED } from '../core/password.js'; // 2026-10-08 여기서 core 로 옮김 (P1-10 25)

/** 중복 확인 칸마다 다른 것 — 주소 · 문구 · 서버에 묻기 전 형식 검사 */
const CHECKS = {
  email: {
    path: '/auth/check-email?email=',
    taken: 'This email is already in use.',
    invalid: 'Enter a valid email address.',
    isValid: (input) => input.value.trim() !== '' && input.checkValidity(),
  },
  nickname: {
    path: '/auth/check-nickname?nickname=',
    taken: 'This nickname is already in use.',
    invalid: 'Use 2–20 characters.',
    isValid: (input) => input.value.trim().length >= 2 && input.value.trim().length <= 20,
  },
};

/**
 * 이메일·닉네임 중복 확인 (PRD 01 FR-101)
 * - [data-check="email"] 버튼 → GET /api/v1/auth/check-email?email=
 * - [data-check="nickname"] 버튼 → GET /api/v1/auth/check-nickname?nickname=
 * - 사용 가능: setFieldState(field, 'ok', '✓ Available')
 * - 사용 중:   setFieldState(field, 'error', 'This email is already in use.')
 * - 탈퇴 후 3일 안 (응답 reason === 'REJOIN_TOO_SOON', FR-108):
 *   setFieldState(field, 'error', `You can sign up again after ${available_at 을 'Oct 6' 형식으로}.`)
 * - 입력값이 바뀌면 확인 결과를 지움 (다시 확인해야 가입 가능)
 * - (권장) 입력을 멈추고 0.5초 뒤 자동 확인 — "실시간 중복 확인"
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * - 확인을 통과한 값은 .field 의 data-checked 에 남김 → 가입 전송(initJoinForm)이 "확인했는지" 볼 때 씀
 * - 서버에 묻기 전에 형식(이메일 모양 · 닉네임 2~20자)을 먼저 봄. 자동 확인은 형식이 맞을 때만 (입력 중 빨간 글 방지)
 * - 늦게 도착한 옛 응답은 버림 (그사이 입력이 바뀐 경우)
 */
export function initDuplicateChecks() {
  for (const kind of Object.keys(CHECKS)) {
    const rule = CHECKS[kind];
    const field = document.getElementById(`join-${kind}-field`);
    const input = document.getElementById(`join-${kind}`);
    const button = document.querySelector(`[data-check="${kind}"]`);
    if (!field || !input) continue;
    let timer = null;

    const check = async () => {
      clearTimeout(timer);
      delete field.dataset.checked; // 이번 확인을 통과해야 다시 남김
      const value = input.value.trim();
      if (!rule.isValid(input)) {
        setFieldState(field, 'error', rule.invalid);
        return;
      }
      setFieldState(field, null, 'Checking…');
      let result;
      try {
        result = await api.get(rule.path + encodeURIComponent(value), { auth: false });
      } catch (err) {
        if (input.value.trim() !== value) return; // 그사이 입력이 바뀜 — 옛 응답은 버림
        setFieldState(field, 'error', err.status === 422 ? rule.invalid : err.message);
        return;
      }
      if (input.value.trim() !== value) return;
      if (result.available) {
        field.dataset.checked = value;
        setFieldState(field, 'ok', '✓ Available');
      } else if (result.reason === 'REJOIN_TOO_SOON') {
        const day = new Date(result.available_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        setFieldState(field, 'error', `You can sign up again after ${day}.`);
      } else {
        setFieldState(field, 'error', rule.taken);
      }
    };

    input.addEventListener('input', () => {
      delete field.dataset.checked; // 값이 바뀌면 다시 확인해야 함
      setFieldState(field, null);
      clearTimeout(timer);
      if (rule.isValid(input)) timer = setTimeout(check, 500);
    });
    if (button) button.addEventListener('click', check);
  }
}

/** 동의한 처리방침 버전 = privacy.html 의 Version. 처리방침을 바꾸면 서버 PRIVACY_VERSION 과 함께 올림
 *  (2026-10-05 → 2026-10-08: 답변하지 않은 문의도 받은 뒤 1년에 삭제) */
export const PRIVACY_VERSION = '2026-10-08';

// 비밀번호 조건 PASSWORD_RULES · PASSWORD_ALLOWED 는 core/password.js (회원 정보 화면과 함께 씀)

/**
 * 비밀번호 조건 표시·확인 (PRD 01 FR-102)
 * - #join-password 입력할 때마다 PASSWORD_RULES 로 검사해
 *   #join-password-rules li[data-rule="…"] 에 is-met 클래스 붙이기/빼기 (auth.css: ✓ 초록 / ○ 회색)
 *   같은 li 안 [data-rule-state] 글자도 ', met' / ', not met' 로 (화면 읽기 프로그램용)
 * - PASSWORD_ALLOWED 에 맞지 않으면(한글·공백 등): setFieldState(passwordField, 'error', 'Use only English letters, numbers and symbols.')
 * - 칸을 벗어날 때(blur) 조건이 하나라도 안 맞으면: setFieldState(passwordField, 'error', 'Check the password requirements.')
 * - 확인 칸이 다르면: setFieldState(confirmField, 'error', "Passwords don't match.")
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * - 비밀번호 칸: 입력 중에는 허용 문자만 바로 알려 주고, 조건 미달은 칸을 벗어날 때 알려 줌
 * - 확인 칸: 다르다는 말은 확인 칸을 벗어났을 때, 또는 비밀번호만큼 다 쳤을 때 — 맞으면 바로 지움
 */
export function initPasswordRules() {
  const password = document.getElementById('join-password');
  const confirm = document.getElementById('join-password2');
  const passwordField = document.getElementById('join-password-field');
  const confirmField = document.getElementById('join-password2-field');
  const items = document.querySelectorAll('#join-password-rules li[data-rule]');
  if (!password || !confirm) return;

  const allMet = () => {
    for (const name of Object.keys(PASSWORD_RULES)) {
      if (!PASSWORD_RULES[name](password.value)) return false;
    }
    return true;
  };

  const showRules = () => {
    for (const item of items) {
      const rule = PASSWORD_RULES[item.dataset.rule];
      const met = rule ? rule(password.value) : false;
      item.classList.toggle('is-met', met);
      const state = item.querySelector('[data-rule-state]');
      if (state) state.textContent = met ? ', met' : ', not met';
    }
  };

  const checkConfirm = (force) => {
    if (confirm.value === '') {
      setFieldState(confirmField, null);
    } else if (confirm.value === password.value) {
      setFieldState(confirmField, null);
    } else if (force || confirm.value.length >= password.value.length) {
      setFieldState(confirmField, 'error', "Passwords don't match.");
    }
  };

  password.addEventListener('input', () => {
    showRules();
    if (!PASSWORD_ALLOWED.test(password.value)) {
      setFieldState(passwordField, 'error', 'Use only English letters, numbers and symbols.');
    } else {
      setFieldState(passwordField, null);
    }
    if (confirm.value !== '') checkConfirm(true); // 확인 칸을 이미 쳤으면 바로 다시 비교
  });
  password.addEventListener('blur', () => {
    if (password.value !== '' && PASSWORD_ALLOWED.test(password.value) && !allMet()) {
      setFieldState(passwordField, 'error', 'Check the password requirements.');
    }
  });
  confirm.addEventListener('input', () => checkConfirm(false));
  confirm.addEventListener('blur', () => checkConfirm(true));
  showRules();
}

/**
 * 가입 전송
 * - 이메일·닉네임 중복 확인을 통과했는지, 비밀번호 규칙·확인이 맞는지 검사
 * - #join-agree(만 16세 이상 + 처리방침 동의)가 체크돼 있어야 전송 (브라우저 required 검사)
 * - POST /api/v1/auth/signup  JSON { email, nickname, password, privacy_agreed: true, privacy_version: PRIVACY_VERSION }
 * - 성공: home.html#login 으로 이동 (로그인 모달이 열림) — 또는 바로 로그인 처리
 * - 실패: #join-error 에 서버 메시지, hidden 해제
 * - 전송 중에는 Create account 버튼 disabled
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * - 화면에서 먼저 모두 검사하고, 틀린 칸이 있으면 첫 칸으로 커서를 옮긴 뒤 보내지 않음
 * - 서버가 막으면(409 · 422) 그 칸 아래에 문구 — 칸을 알 수 없으면 #join-error
 * - 성공하면 home.html#login 으로 (로그인 모달이 열림 — 가입 후 자동 로그인은 하지 않음)
 */
export function initJoinForm() {
  const form = document.getElementById('join-form');
  if (!form) return;
  const fields = {
    email: document.getElementById('join-email-field'),
    nickname: document.getElementById('join-nickname-field'),
    password: document.getElementById('join-password-field'),
    password2: document.getElementById('join-password2-field'),
  };
  const email = document.getElementById('join-email');
  const nickname = document.getElementById('join-nickname');
  const password = document.getElementById('join-password');
  const password2 = document.getElementById('join-password2');
  const agree = document.getElementById('join-agree');
  const error = document.getElementById('join-error');
  const submit = form.querySelector('button[type="submit"]');

  const showFormError = (message) => {
    error.textContent = message;
    error.hidden = false;
  };
  const AGREE_MESSAGE = 'Please confirm you are 16 or older and agree to the Privacy Policy.';

  // 동의를 체크하면 동의 안내를 바로 지움 (다른 안내는 그대로)
  agree.addEventListener('change', () => {
    if (agree.checked && error.textContent === AGREE_MESSAGE) error.hidden = true;
  });

  // 화면에서 먼저 검사 — 틀린 칸의 입력 요소 목록을 돌려줌 (빈 목록이면 통과)
  const findProblems = () => {
    const problems = [];
    for (const kind of ['email', 'nickname']) {
      const input = kind === 'email' ? email : nickname;
      const value = input.value.trim();
      if (!CHECKS[kind].isValid(input)) {
        setFieldState(fields[kind], 'error', CHECKS[kind].invalid);
        problems.push(input);
      } else if (fields[kind].dataset.checked !== value) {
        if (!fields[kind].classList.contains('is-error')) {
          setFieldState(fields[kind], 'error', `Click Check to confirm this ${kind} is available.`);
        }
        problems.push(input);
      }
    }
    let rulesMet = PASSWORD_ALLOWED.test(password.value);
    for (const name of Object.keys(PASSWORD_RULES)) {
      if (!PASSWORD_RULES[name](password.value)) rulesMet = false;
    }
    if (!rulesMet) {
      setFieldState(fields.password, 'error', 'Check the password requirements.');
      problems.push(password);
    }
    if (password2.value !== password.value) {
      setFieldState(fields.password2, 'error', "Passwords don't match.");
      problems.push(password2);
    }
    if (!agree.checked) {
      showFormError(AGREE_MESSAGE);
      problems.push(agree);
    }
    return problems;
  };

  // 서버가 막은 이유를 그 칸 아래에 (409 · 422)
  const showServerError = (err) => {
    const details = err.details || {};
    if (err.code === 'EMAIL_TAKEN' || details.email) {
      delete fields.email.dataset.checked;
      setFieldState(fields.email, 'error', err.code === 'VALIDATION_ERROR' ? CHECKS.email.invalid : err.message);
      email.focus();
    } else if (err.code === 'NICKNAME_TAKEN' || details.nickname) {
      delete fields.nickname.dataset.checked;
      setFieldState(fields.nickname, 'error', err.code === 'VALIDATION_ERROR' ? CHECKS.nickname.invalid : err.message);
      nickname.focus();
    } else if (details.password) {
      setFieldState(fields.password, 'error', 'Check the password requirements.');
      password.focus();
    } else {
      showFormError(err.message || 'Something went wrong. Please try again.');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    const problems = findProblems();
    if (problems.length > 0) {
      problems[0].focus();
      return;
    }
    submit.disabled = true;
    try {
      await api.post(
        '/auth/signup',
        {
          email: email.value.trim(),
          nickname: nickname.value.trim(),
          password: password.value,
          privacy_agreed: true,
          privacy_version: PRIVACY_VERSION,
        },
        { auth: false },
      );
      location.href = 'home.html#login';
    } catch (err) {
      showServerError(err);
      submit.disabled = false;
    }
  });
}

// 공통 헤더·푸터·로그인 모달을 먼저 끼움 (static/partials/) — 아래 init 들은 그 요소를 찾으므로 순서 중요
await includePartials();

initModalFallback();
initFormAlerts();   // 19 — 로그인 모달의 기본 말풍선 대신 알림창 (가입 폼은 novalidate 라 그대로)
// 로그인 모달(이미 가입한 사람용): 성공하면 메인으로 — 헤더가 My Page·My Projects로 보임
initLoginForm({ onSuccess: (next) => { location.href = next || 'home.html'; } }); // 13 — 가입 화면에서 로그인하면 홈(또는 next)으로
// 계정 찾기(Can't sign in?, #recover) — 로그인 모달 안의 복구 화면 (P1-28)
initRecover(document.getElementById('login-modal'));
initRecoverFromHash(document.getElementById('login-modal'));
initRecoverForms(document.getElementById('login-modal'));   // 두 폼 전송 (보낸 뒤 화면까지)
initRecoverResend(document.getElementById('login-modal'));  // send again (1분 뒤 켜짐)
initPasswordToggles();
initOAuthPlaceholders();
initDuplicateChecks();
initPasswordRules();
initJoinForm();
