// 로그인·회원가입 화면 공통 동작 (템플릿 — 구현은 직접, P1-07)
// 쓰는 곳: home.html(로그인 모달), join.html
// 토큰 저장·API 호출은 core/api.js(P1-02)에서. 여기서는 화면 쪽 동작만.

import { api, setAccessToken } from './api.js';
import { isLoggedIn, parseLoginHash, logout } from './auth.js';

/**
 * 로그인 상태를 <html data-auth> 에 표시 → auth.css 가 헤더 버튼을 바꿈
 * - 시작할 때 document.documentElement.dataset.auth = 'pending' (버튼 자리 비움, 깜빡임 방지)
 * - core/auth.js 의 isLoggedIn() (내부에서 api.js refreshAccessToken → POST /api/v1/auth/refresh)
 *   true → 'in' / false → 속성 지우기 (로그아웃 상태)
 * - 자동 로그인(3일) 쿠키가 있으면 브라우저를 다시 열어도 'in' (PRD 01 FR-109)
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * @returns {Promise<boolean>} 로그인 상태면 true — 기다릴 필요가 있는 페이지만 await
 */
export async function initAuthState() {
  const root = document.documentElement;
  root.dataset.auth = 'pending';
  const loggedIn = await isLoggedIn();
  if (loggedIn) {
    root.dataset.auth = 'in';
  } else {
    root.removeAttribute('data-auth');
  }
  return loggedIn;
}

/**
 * 비밀번호 Show / Hide 버튼 (.pw__toggle)
 * - 클릭: aria-controls 로 입력칸을 찾아 type 을 'password' ↔ 'text' 로 바꿈
 * - 버튼 글자 Show ↔ Hide, aria-pressed 'false' ↔ 'true'
 * @param {ParentNode} root  찾을 범위 (기본 document)
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * - 같은 버튼에 두 번 연결하지 않음 (data-pw-toggle 표시) — 두 번 붙으면 한 번 눌러도 두 번 바뀌어 그대로가 됨
 */
export function initPasswordToggles(root = document) {
  const buttons = root.querySelectorAll('.pw__toggle');
  for (const button of buttons) {
    if (button.dataset.pwToggle === 'on') continue;
    button.dataset.pwToggle = 'on';
    button.addEventListener('click', () => {
      const input = document.getElementById(button.getAttribute('aria-controls'));
      if (!input) return;
      const show = input.type === 'password'; // 지금 가려져 있으면 → 보이게
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
  }
}

/** 소셜 로그인 서비스 이름 (안내 문구용) */
const OAUTH_NAMES = { google: 'Google', discord: 'Discord', soundcloud: 'SoundCloud' };

/**
 * 소셜 로그인 버튼 (.oauth[data-provider]) — 지금은 자리만
 * - 클릭하면 "Coming soon" 안내 (예: 버튼 아래 짧은 문구, 또는 alert)
 * - 연동할 때: location.href = `/api/v1/auth/oauth/${provider}/start` (추후 PRD 01 개정)
 * @param {ParentNode} root
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * - 버튼 줄(.oauth-row) 바로 아래에 안내 한 줄(p.oauth-note, role="status")을 만들어 씀 — alert 는 쓰지 않음
 */
export function initOAuthPlaceholders(root = document) {
  const buttons = root.querySelectorAll('.oauth[data-provider]');
  for (const button of buttons) {
    if (button.dataset.oauthReady === 'on') continue;
    button.dataset.oauthReady = 'on';
    button.addEventListener('click', () => {
      const provider = button.dataset.provider;
      const name = OAUTH_NAMES[provider] || provider;
      const row = button.closest('.oauth-row') || button.parentElement;
      let note = row.nextElementSibling;
      if (!note || !note.classList.contains('oauth-note')) {
        note = document.createElement('p');
        note.className = 'field__msg oauth-note';
        note.setAttribute('role', 'status');
        row.after(note);
      }
      note.textContent = `${name} sign-in is coming soon. Please use your email for now.`;
    });
  }
}

/**
 * 입력칸 상태 바꾸기 (forms.css 의 상태 6가지 중 ok / error / 기본)
 * @param {HTMLElement} field   .field 요소
 * @param {'ok'|'error'|null} state
 * @param {string} [message]    .field__msg 에 넣을 문구
 * - ok:    field.classList 에 is-ok,    입력칸 aria-invalid 제거
 * - error: field.classList 에 is-error, 입력칸 aria-invalid="true"
 * - null:  둘 다 제거
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * - message 를 안 넘기면: 문구를 처음 HTML 에 있던 안내 글(없으면 빈 글자)로 되돌림
 */
export function setFieldState(field, state, message) {
  if (!field) return;
  const control = field.querySelector('.field__control');
  const msg = field.querySelector('.field__msg');

  field.classList.remove('is-ok', 'is-error');
  if (control) control.removeAttribute('aria-invalid');

  if (state === 'ok') {
    field.classList.add('is-ok');
  } else if (state === 'error') {
    field.classList.add('is-error');
    if (control) control.setAttribute('aria-invalid', 'true');
  }

  if (msg) {
    if (msg.dataset.hint === undefined) msg.dataset.hint = msg.textContent; // 처음 안내 글을 기억
    msg.textContent = message === undefined ? msg.dataset.hint : message;
  }
}

/**
 * 로그인 모달 전송 (PRD 01 FR-103·109) — home.html, join.html 이 같이 씀
 * @param {object} [options]
 * @param {(next: string|null) => void} [options.onSuccess]  로그인 성공 후 할 일 (페이지마다 다름)
 *   - home.html: next 가 있으면 그 페이지로, 없으면 모달 닫고 <html data-auth="in">
 *   - join.html: location.href = 'home.html'
 * TODO:
 * - #login-form submit 기본 동작 막기
 * - api.post('/auth/login', { email, password, remember }, { auth: false })  (core/api.js)
 *   remember = #login-remember 체크 여부, 성공 응답의 access_token → setAccessToken
 * - 성공: options.onSuccess(next)  (next 는 core/auth.js parseLoginHash 로 읽은 값)
 * - 실패: #login-error 에 "Email or password is incorrect." 표시 (hidden 해제) — 어느 쪽이 틀렸는지 알려주지 않음
 * - 전송 중에는 Sign In 버튼 disabled
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * - onSuccess 가 없으면 기본 동작: next 가 있으면 그 페이지로, 없으면 모달 닫고 data-auth="in"
 * - 실패하면 비밀번호 칸만 비움 (이메일은 그대로) · 403 정지 계정은 서버 문구 그대로
 */
export function initLoginForm(options = {}) {
  const form = document.getElementById('login-form');
  if (!form || form.dataset.loginReady === 'on') return;
  form.dataset.loginReady = 'on';

  const email = document.getElementById('login-email');
  const password = document.getElementById('login-password');
  const remember = document.getElementById('login-remember');
  const error = document.getElementById('login-error');
  const submit = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    submit.disabled = true;
    try {
      const data = await api.post(
        '/auth/login',
        { email: email.value, password: password.value, remember: remember.checked },
        { auth: false },
      );
      setAccessToken(data.access_token);
      const next = parseLoginHash().next;
      if (options.onSuccess) {
        options.onSuccess(next);
      } else if (next) {
        location.href = next;
      } else {
        const modal = document.getElementById('login-modal');
        if (modal && modal.open) modal.close();
        document.documentElement.dataset.auth = 'in';
        form.reset();
      }
    } catch (err) {
      if (err.status === 401 || err.status === 422) {
        error.textContent = 'Email or password is incorrect.';
      } else {
        error.textContent = err.message || 'Something went wrong. Please try again.';
      }
      error.hidden = false;
      password.value = '';
      password.focus();
    } finally {
      submit.disabled = false;
    }
  });
}

/**
 * 로그아웃 버튼 (#logout-button) — 마이페이지 · 내 프로젝트 · 회원 정보의 왼쪽 메뉴 Log out (세 화면 공통)
 * - 누르면 버튼을 잠그고(두 번 누름 방지) core/auth.js logout() — 서버 쿠키 삭제 → 메모리 토큰 삭제 → home.html
 * - 같은 버튼에 두 번 연결하지 않음 (data-logout="on")
 * (구현: AI — 2026-10-08, P1-10 27, 함수 하나씩 검토 — 세 화면이 같아 페이지 JS 대신 여기에 하나만 둠)
 * @param {HTMLElement|null} [button] 기본은 #logout-button
 */
export function initLogoutButton(button = document.getElementById('logout-button')) {
  if (!button || button.dataset.logout === 'on') return;
  button.dataset.logout = 'on';
  button.addEventListener('click', () => {
    button.disabled = true;
    logout(); // 끝나면 다른 페이지로 옮겨 가므로 다시 켤 필요 없음
  });
}
