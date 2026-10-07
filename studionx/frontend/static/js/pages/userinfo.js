// userInfo.html 페이지 스크립트 (템플릿 — 구현은 직접, P1-10)
// 화면 모양은 HTML·CSS로 완성되어 있고, 값은 loadMe(22)가 채움. 탈퇴 확인창은 promptDialog(26, FIX-01).
// API (PRD 01 §7): GET·PATCH /users/me · POST /users/me/profile-image · PUT /users/me/password · DELETE /users/me

import { initAuthState, initPasswordToggles, setFieldState, initLogoutButton } from '../core/auth-ui.js';
import { requireLogin, loginUrl } from '../core/auth.js';
import { api, clearAccessToken } from '../core/api.js';
import { promptDialog } from '../core/dialog.js';
import { PASSWORD_RULES, PASSWORD_ALLOWED } from '../core/password.js';
import { initModalFallback } from '../core/modal.js';
import { includePartials } from '../core/include.js';

/** 프로필 사진 제한 (FR-106) — 서버(P1-08)도 같은 기준으로 다시 검사 */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** 오류 화면이 있는 상태 코드 (errors/<상태>.html) */
const ERROR_PAGES = [400, 403, 404, 429, 500, 503, 504];

/**
 * 프로필 동그라미 그리기 — 사진이 있으면 <img>, 없으면 닉네임 첫 글자 (myPage 와 같은 모양)
 * loadMe · 사진 올리기 · 지우기(23)가 함께 씀
 * @param {{ nickname: string, profile_image_url: string|null }} me
 */
export function renderAvatar(me) {
  const avatar = document.getElementById('profile-avatar');
  if (!avatar) return;
  avatar.textContent = '';
  if (me.profile_image_url) {
    const img = document.createElement('img');
    img.src = me.profile_image_url;
    img.alt = ''; // 동그라미는 aria-hidden — 닉네임은 옆 칸에 글자로 있음
    avatar.appendChild(img);
  } else {
    avatar.textContent = me.nickname.charAt(0).toUpperCase();
  }
}

/**
 * 서버 날짜(UTC, 시간대 표시 없음) → 'Oct 7, 2026' (이 컴퓨터의 시간대로)
 * @param {string} value 예: '2026-10-07T01:12:30'
 */
function formatDate(value) {
  const hasZone = /[zZ]$|[+-]\d\d:\d\d$/.test(value);
  const date = new Date(hasZone ? value : value + 'Z');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * 내 정보 채우기 — GET /api/v1/users/me (P1-08 41)
 * - 닉네임 · 이메일 칸, 'Joined Oct 7, 2026', 프로필 동그라미
 * - 닉네임 칸에 data-checked = 지금 닉네임 → 바꾸지 않고 저장해도 중복 확인이 필요 없음 (24)
 * - 실패하면 (2026-10-06 결정) 오류 화면으로: 401 → 로그인 주소, 400 · 403 · 404 · 429 · 503 · 504 는
 *   같은 번호, 그 밖의 500 이상 → 500, 서버에 닿지 못함(0) → 503
 * (구현: AI — 2026-10-08, 함수 하나씩 검토)
 * @returns {Promise<object|null>} 내 정보 (다른 화면으로 옮겨 가면 null)
 */
export async function loadMe() {
  let me;
  try {
    me = await api.get('/users/me');
  } catch (err) {
    if (err.status === 401) {
      location.replace(loginUrl(location.pathname + location.search + location.hash));
    } else {
      let page = 500;
      if (ERROR_PAGES.indexOf(err.status) >= 0) page = err.status;
      else if (err.status === 0) page = 503;
      location.replace('errors/' + page + '.html');
    }
    return null;
  }

  const nickname = document.getElementById('profile-nickname');
  const nicknameField = document.getElementById('nickname-field');
  const email = document.getElementById('profile-email');
  const joined = document.getElementById('profile-joined');
  if (nickname) nickname.value = me.nickname;
  if (nicknameField) nicknameField.dataset.checked = me.nickname;
  if (email) email.value = me.email;
  if (joined) joined.textContent = 'Joined ' + formatDate(me.created_at);
  renderAvatar(me);
  return me;
}

/**
 * 사진 올리기·지우기 (FR-106) — POST · DELETE /api/v1/users/me/profile-image (P1-08 42)
 * - Upload photo 로 파일을 고르면: 종류가 jpg · png · webp 가 아니거나 2MB 를 넘으면 보내지 않고
 *   'Use a JPG, PNG or WebP image up to 2 MB.' (서버도 같은 기준으로 다시 검사 — 415 · 413)
 * - 통과하면 'Uploading…' → FormData 로 보냄 → 응답의 사진 주소로 동그라미를 다시 그림 (22 renderAvatar)
 * - Remove: 지우고 첫 글자로. 사진이 없어도 서버는 200
 * - 보내는 동안 두 버튼을 잠금 (두 번 누름 방지), 끝나면 input.value = '' (같은 파일을 다시 고를 수 있게)
 * - 문구는 #photo-msg, 색은 #photo-field 의 is-ok · is-error (setFieldState, P1-07 09)
 * (구현: AI — 2026-10-08, 함수 하나씩 검토)
 */
export function initPhotoUpload() {
  const input = document.getElementById('photo-input');
  const remove = document.getElementById('photo-remove');
  const field = document.getElementById('photo-field');
  if (!input) return;

  const setBusy = (busy) => {
    input.disabled = busy;
    if (remove) remove.disabled = busy;
  };

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return; // 고르다가 취소
    if (PHOTO_TYPES.indexOf(file.type) < 0 || file.size > PHOTO_MAX_BYTES) {
      setFieldState(field, 'error', 'Use a JPG, PNG or WebP image up to 2 MB.');
      input.value = '';
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    setFieldState(field, null, 'Uploading…');
    try {
      renderAvatar(await api.post('/users/me/profile-image', form));
      setFieldState(field, 'ok', 'Photo updated.');
    } catch (err) {
      setFieldState(field, 'error', err.message);
    } finally {
      setBusy(false);
      input.value = '';
    }
  });

  if (remove) {
    remove.addEventListener('click', async () => {
      setBusy(true);
      try {
        renderAvatar(await api.delete('/users/me/profile-image'));
        setFieldState(field, 'ok', 'Photo removed.');
      } catch (err) {
        setFieldState(field, 'error', err.message);
      } finally {
        setBusy(false);
      }
    });
  }
}

/** 닉네임 길이 (서버 Nickname 타입 · 가입 화면과 같음) */
const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

/**
 * 닉네임 중복 확인 + 저장 (FR-106) — 가입 화면(P1-07 15 · 17)과 같은 방식
 * - Check 를 누르거나 입력을 멈추고 0.5초 → GET /api/v1/auth/check-nickname (가입과 같은 API)
 *   사용 가능 '✓ Available' · 사용 중 'This nickname is already in use.' · 탈퇴 3일 안 'You can use this nickname after Oct 9.'
 * - 지금 내 닉네임과 같으면 묻지 않음. 대소문자만 다르면(p110_user → P110_User) 내 것이라 '✓ Available'
 *   (서버 비교는 대소문자를 구분하지 않아, 물으면 내 닉네임이 "사용 중" 으로 나옴 — P1-08 37 과 같은 이유)
 * - 확인을 통과한 값은 칸의 data-checked 에 남김 (22 loadMe 가 처음에 지금 닉네임을 넣어 둠)
 *   입력이 바뀌면 지움 → 다시 확인해야 저장 가능
 * - Save changes: PATCH /api/v1/users/me (P1-08 41) → 버튼 옆 'Saved' (3초 뒤 사라짐), 동그라미 첫 글자도 새로
 *   409 · 422 는 닉네임 칸에, 그 밖의 오류는 #profile-error
 * (구현: AI — 2026-10-08, 함수 하나씩 검토)
 */
export function initProfileForm() {
  const form = document.getElementById('profile-form');
  const input = document.getElementById('profile-nickname');
  const field = document.getElementById('nickname-field');
  const checkButton = document.querySelector('#profile-form [data-check="nickname"]');
  const error = document.getElementById('profile-error');
  const saved = document.getElementById('profile-saved');
  const submit = form ? form.querySelector('button[type="submit"]') : null;
  if (!form || !input || !field) return;

  let current = field.dataset.checked || input.value.trim(); // 지금 내 닉네임 (22 가 넣어 둠)
  let timer = null;
  let savedTimer = null;
  const isValid = (value) => value.length >= NICKNAME_MIN && value.length <= NICKNAME_MAX;

  const check = async () => {
    clearTimeout(timer);
    delete field.dataset.checked; // 이번 확인을 통과해야 다시 남김
    const value = input.value.trim();
    if (!isValid(value)) {
      setFieldState(field, 'error', 'Use 2–20 characters.');
      return;
    }
    if (value === current) {
      field.dataset.checked = value;
      setFieldState(field, null); // 내 닉네임 그대로 — 안내 글로
      return;
    }
    if (value.toLowerCase() === current.toLowerCase()) {
      field.dataset.checked = value;
      setFieldState(field, 'ok', '✓ Available');
      return;
    }
    setFieldState(field, null, 'Checking…');
    let result;
    try {
      result = await api.get('/auth/check-nickname?nickname=' + encodeURIComponent(value), { auth: false });
    } catch (err) {
      if (input.value.trim() !== value) return; // 그사이 입력이 바뀜 — 옛 응답은 버림
      setFieldState(field, 'error', err.status === 422 ? 'Use 2–20 characters.' : err.message);
      return;
    }
    if (input.value.trim() !== value) return;
    if (result.available) {
      field.dataset.checked = value;
      setFieldState(field, 'ok', '✓ Available');
    } else if (result.reason === 'REJOIN_TOO_SOON') {
      const day = new Date(result.available_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setFieldState(field, 'error', `You can use this nickname after ${day}.`);
    } else {
      setFieldState(field, 'error', 'This nickname is already in use.');
    }
  };

  input.addEventListener('input', () => {
    delete field.dataset.checked;
    setFieldState(field, null);
    if (saved) saved.textContent = '';
    clearTimeout(timer);
    if (isValid(input.value.trim())) timer = setTimeout(check, 500);
  });
  if (checkButton) checkButton.addEventListener('click', check);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearTimeout(timer);
    if (error) error.hidden = true;
    const value = input.value.trim();
    if (!isValid(value)) {
      setFieldState(field, 'error', 'Use 2–20 characters.');
      input.focus();
      return;
    }
    if (field.dataset.checked !== value) {
      if (!field.classList.contains('is-error')) {
        setFieldState(field, 'error', 'Click Check to confirm this nickname is available.');
      }
      input.focus();
      return;
    }
    if (submit) submit.disabled = true;
    try {
      const me = await api.patch('/users/me', { nickname: value });
      current = me.nickname;
      input.value = me.nickname;
      field.dataset.checked = me.nickname;
      setFieldState(field, null);
      renderAvatar(me); // 사진이 없으면 첫 글자가 바뀔 수 있음
      if (saved) {
        saved.textContent = 'Saved';
        clearTimeout(savedTimer);
        savedTimer = setTimeout(() => { saved.textContent = ''; }, 3000);
      }
    } catch (err) {
      if (err.status === 409 || err.status === 422) {
        delete field.dataset.checked;
        setFieldState(field, 'error', err.status === 422 ? 'Use 2–20 characters.' : err.message);
        input.focus();
      } else if (error) {
        error.textContent = err.message || 'Something went wrong. Please try again.';
        error.hidden = false;
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

/**
 * 비밀번호 변경 (FR-107) — PUT /api/v1/users/me/password (P1-09 47)
 * - 새 비밀번호를 칠 때마다 조건 목록 ✓ (가입 화면 P1-07 16 과 같은 규칙 · 같은 방식, 규칙은 core/password.js)
 *   한글 · 공백은 바로 빨강, 조건 미달은 칸을 벗어날 때 빨강
 * - 확인 칸: 새 비밀번호만큼 쳤는데 다르거나, 칸을 벗어날 때 다르면 "Passwords don't match."
 * - Change password: 세 칸을 모두 검사 → 첫 번째 틀린 칸에 커서 → 보냄 (버튼 잠금)
 *   성공 204: 세 칸 비우고 조건 표시 초기화, 버튼 옆 'Password changed.' (5초)
 *   400 WRONG_PASSWORD: 지금 비밀번호 칸 'Current password is incorrect.' + 그 칸 비우고 커서
 *   422 (새 비밀번호 규칙 · 지금과 같음): 새 비밀번호 칸에 서버 문구, 그 밖은 #password-error
 * (구현: AI — 2026-10-08, 함수 하나씩 검토)
 */
export function initPasswordForm() {
  const form = document.getElementById('password-form');
  const current = document.getElementById('pw-current');
  const password = document.getElementById('pw-new');
  const confirm = document.getElementById('pw-confirm');
  const currentField = document.getElementById('pw-current-field');
  const passwordField = document.getElementById('pw-new-field');
  const confirmField = document.getElementById('pw-confirm-field');
  const items = document.querySelectorAll('#pw-new-rules li[data-rule]');
  const error = document.getElementById('password-error');
  const saved = document.getElementById('password-saved');
  const submit = form ? form.querySelector('button[type="submit"]') : null;
  if (!form || !current || !password || !confirm) return;
  let savedTimer = null;

  const allMet = () => {
    if (!PASSWORD_ALLOWED.test(password.value)) return false;
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
    if (confirm.value === '' || confirm.value === password.value) {
      setFieldState(confirmField, null);
    } else if (force || confirm.value.length >= password.value.length) {
      setFieldState(confirmField, 'error', "Passwords don't match.");
    }
  };

  const clearSaved = () => {
    if (saved) saved.textContent = '';
  };

  current.addEventListener('input', () => {
    setFieldState(currentField, null);
    clearSaved();
  });
  password.addEventListener('input', () => {
    showRules();
    clearSaved();
    if (!PASSWORD_ALLOWED.test(password.value)) {
      setFieldState(passwordField, 'error', 'Use only English letters, numbers and symbols.');
    } else {
      setFieldState(passwordField, null);
    }
    if (confirm.value !== '') checkConfirm(true);
  });
  password.addEventListener('blur', () => {
    if (password.value !== '' && PASSWORD_ALLOWED.test(password.value) && !allMet()) {
      setFieldState(passwordField, 'error', 'Check the password requirements.');
    }
  });
  confirm.addEventListener('input', () => {
    clearSaved();
    checkConfirm(false);
  });
  confirm.addEventListener('blur', () => checkConfirm(true));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (error) error.hidden = true;
    const problems = [];
    if (current.value === '') {
      setFieldState(currentField, 'error', 'Enter your current password.');
      problems.push(current);
    }
    if (!allMet()) {
      setFieldState(passwordField, 'error', 'Check the password requirements.');
      problems.push(password);
    }
    if (confirm.value !== password.value) {
      setFieldState(confirmField, 'error', "Passwords don't match.");
      problems.push(confirm);
    }
    if (problems.length > 0) {
      problems[0].focus();
      return;
    }

    if (submit) submit.disabled = true;
    try {
      await api.put('/users/me/password', { current_password: current.value, new_password: password.value });
      current.value = '';
      password.value = '';
      confirm.value = '';
      setFieldState(currentField, null);
      setFieldState(passwordField, null);
      setFieldState(confirmField, null);
      showRules();
      if (saved) {
        saved.textContent = 'Password changed.';
        clearTimeout(savedTimer);
        savedTimer = setTimeout(clearSaved, 5000);
      }
    } catch (err) {
      if (err.code === 'WRONG_PASSWORD') {
        setFieldState(currentField, 'error', 'Current password is incorrect.');
        current.value = '';
        current.focus();
      } else if (err.status === 422 && err.details && err.details.new_password) {
        setFieldState(passwordField, 'error', err.message);
        password.focus();
      } else if (error) {
        error.textContent = err.message || 'Something went wrong. Please try again.';
        error.hidden = false;
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

/**
 * 회원 탈퇴 (FR-108) — Delete account 버튼 → 확인창 → DELETE /api/v1/users/me (P1-09 48)
 * - 확인창은 FIX-01 promptDialog (2026-10-07 결정: 목업 08 · 14, 체크박스 없이 비밀번호만, 빨간 버튼)
 *   예전 HTML 모달(#withdraw-modal)과 버튼의 command 속성은 지움
 * - 확인창의 check 에서 바로 서버에 탈퇴 요청 — 비밀번호가 틀리면 창 안에 'Password is incorrect.' (창은 닫히지 않음)
 *   확인하는 동안 취소 · Esc 는 잠김 (21 promptDialog)
 * - api.delete('/users/me', { body: { password } }) — 두 번째 인자가 옵션이라 본문은 body 로
 * - 성공: 메모리의 Access Token 을 지우고 home.html 로 (location.replace — 뒤로 가기로 이 화면에 돌아오지 않게)
 *   리프레시 쿠키는 서버가 지움 (48)
 * (구현: AI — 2026-10-08, 함수 하나씩 검토)
 */
export function initWithdraw() {
  const button = document.getElementById('withdraw-button');
  if (!button) return;

  button.addEventListener('click', async () => {
    const password = await promptDialog({
      title: 'Delete account?',
      text: "This closes your account for good. You'll be signed out right away. Enter your password to confirm.",
      inputType: 'password',
      placeholder: 'Password',
      confirmText: 'Delete account',
      danger: true,
      requiredMessage: 'Enter your password.',
      check: async (value) => {
        try {
          await api.delete('/users/me', { body: { password: value } });
          return null; // 탈퇴됨 → 창이 닫힘
        } catch (err) {
          return err.code === 'WRONG_PASSWORD' ? 'Password is incorrect.' : err.message;
        }
      },
    });
    if (password === null) return; // 취소 · Esc · 바깥 클릭
    clearAccessToken();
    location.replace('home.html');
  });
}

// 로그아웃 버튼(27)은 세 화면 공통이라 core/auth-ui.js initLogoutButton 을 import 해서 씀 (아래 맨 끝 줄)

// 공통 헤더·푸터를 먼저 끼움 (static/partials/) — 아래 init 들은 그 요소를 찾으므로 순서 중요
await includePartials();

initAuthState();
initModalFallback();
initPasswordToggles();
// 로그인 안 했으면 home.html#login?next=/userInfo.html 로 (core/auth.js) — 했으면 내 정보 채우기 (22)
if (await requireLogin()) await loadMe();
initPhotoUpload();
initProfileForm();
initPasswordForm();
initWithdraw();
initLogoutButton();
