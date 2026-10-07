// userInfo.html 페이지 스크립트 (템플릿 — 구현은 직접, P1-10)
// 화면 모양은 HTML·CSS로 완성되어 있고(지금 값은 예시), 탈퇴 확인창은 command 속성으로 JS 없이 열림.
// API (PRD 01 §7): GET·PATCH /users/me · POST /users/me/profile-image · PUT /users/me/password · DELETE /users/me

import { initAuthState, initPasswordToggles, setFieldState } from '../core/auth-ui.js';
import { requireLogin, logout } from '../core/auth.js';
import { initModalFallback } from '../core/modal.js';
import { includePartials } from '../core/include.js';

/** 프로필 사진 제한 (FR-106) — 서버(P1-08)도 같은 기준으로 다시 검사 */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * 내 정보 채우기
 * - const me = await api.get('/users/me')   (core/api.js)
 *   응답 예시: { nickname, email, created_at, last_login_at, profile_image_url }
 * - #profile-nickname value, #profile-email value, #withdraw-nickname 글자
 * - #profile-joined ← 'Joined Oct 1, 2026'
 * - #profile-avatar: 사진이 있으면 안에 <img src alt="">, 없으면 닉네임 첫 글자 (myPage 와 같음)
 * - 실패하면 (2026-10-06 결정) 404 → location.replace('errors/404.html'), 403 → errors/403.html, 500 이상 → errors/500.html
 */
export async function loadMe() {
  // TODO
}

/**
 * 사진 올리기·지우기 (FR-106)
 * - #photo-input change: 파일 종류가 PHOTO_TYPES 가 아니거나 PHOTO_MAX_BYTES 를 넘으면
 *   #photo-msg 에 'Use a JPG, PNG or WebP image up to 2 MB.' (전송하지 않음)
 * - 통과하면 FormData 로 api.post('/users/me/profile-image', formData) → 성공하면 #profile-avatar 갱신
 * - #photo-remove: api.delete('/users/me/profile-image') 후 첫 글자로 되돌림
 * - 같은 파일을 다시 고를 수 있게 끝나면 input.value = ''
 */
export function initPhotoUpload() {
  // TODO
}

/**
 * 닉네임 중복 확인 + 저장 (FR-106)
 * - [data-check="nickname"] → GET /api/v1/auth/check-nickname?nickname= (가입 화면과 같은 API)
 *   사용 가능: setFieldState(#nickname-field, 'ok', '✓ Available') / 사용 중: 'error', 'This nickname is already in use.'
 *   지금 내 닉네임과 같으면 확인하지 않고 그대로 둠
 * - 입력이 바뀌면 확인 결과 지움 → 다시 확인해야 저장 가능
 * - #profile-form submit: api.patch('/users/me', { nickname }) → 성공하면 버튼 옆 짧은 'Saved' 표시
 *   실패: #profile-error (hidden 해제)
 */
export function initProfileForm() {
  // TODO
}

/**
 * 비밀번호 변경 (FR-107)
 * - #pw-new 입력마다 조건 표시: join.js 의 PASSWORD_RULES · PASSWORD_ALLOWED 와 같은 규칙으로
 *   #pw-new-rules li[data-rule] 에 is-met, [data-rule-state] 글자 ', met' / ', not met'
 *   (권장: 규칙을 core/password.js 로 옮겨 join.js 와 여기서 함께 import — join.js 를 import 하면 그 페이지 코드까지 실행됨)
 * - 확인 칸이 다르면 setFieldState(#pw-confirm-field, 'error', "Passwords don't match.")
 * - submit: api.put('/users/me/password', { current_password, new_password })
 *   현재 비밀번호가 틀리면 setFieldState(#pw-current-field, 'error', 'Current password is incorrect.')
 *   성공: 세 칸 비우고 조건 표시 초기화 + 'Password changed.' 안내
 */
export function initPasswordForm() {
  // TODO
}

/**
 * 회원 탈퇴 (FR-108) — #withdraw-form
 * - (2026-10-07 결정) 확인은 core/dialog.js promptDialog 로 (목업 docs/page_mockups/sweetalert/08 · 14, 체크박스 없이 비밀번호만):
 *   promptDialog({ title: 'Delete account?', text: …, inputType: 'password', placeholder: 'Password', confirmText: 'Delete account',
 *     danger: true, requiredMessage: 'Enter your password.', check: (pw) => api.delete … 실패면 'Password is incorrect.' 돌려줌 })
 *   P1-10 구현 때 #withdraw-modal 과 Delete account 버튼의 command="show-modal" 을 지우고 아래 내용은 check 안으로
 * - 비밀번호가 비었거나 #withdraw-agree 체크가 없으면 전송하지 않음
 * - api.delete('/users/me', { body: { password } }) — api.delete 는 두 번째 인자가 옵션이라 본문은 body 로 (2026-10-07 고침)
 *   (서버: 비밀번호 확인 → 소프트 삭제 → 이후 로그인 차단)
 * - 성공: clearAccessToken() 후 location.href = 'home.html'  (core/api.js, core/auth.js)
 * - 비밀번호가 틀리면 #withdraw-error 'Password is incorrect.' / 누른 뒤 버튼 disabled
 */
export function initWithdrawForm() {
  // TODO
}

/** 로그아웃 버튼 (#logout-button) → core/auth.js logout() — myPage.html 과 같음 */
export function initLogoutButton() {
  // TODO
}

// 공통 헤더·푸터를 먼저 끼움 (static/partials/) — 아래 init 들은 그 요소를 찾으므로 순서 중요
await includePartials();

initAuthState();
initModalFallback();
initPasswordToggles();
// TODO: await requireLogin() — 로그인 안 했으면 home.html#login?next=userInfo.html 로 보냄 (core/auth.js)
// TODO: await loadMe();
initPhotoUpload();
initProfileForm();
initPasswordForm();
initWithdrawForm();
initLogoutButton();
