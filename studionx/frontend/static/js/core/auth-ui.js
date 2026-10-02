// 로그인·회원가입 화면 공통 동작 (템플릿 — 구현은 직접, P1-07)
// 쓰는 곳: home.html(로그인 모달), join.html
// 토큰 저장·API 호출은 core/api.js(P1-02)에서. 여기서는 화면 쪽 동작만.

/**
 * 로그인 상태를 <html data-auth> 에 표시 → auth.css 가 헤더 버튼을 바꿈
 * - 시작할 때 document.documentElement.dataset.auth = 'pending' (버튼 자리 비움, 깜빡임 방지)
 * - core/auth.js 의 isLoggedIn() (내부에서 api.js refreshAccessToken → POST /api/v1/auth/refresh)
 *   true → 'in' / false → 속성 지우기 (로그아웃 상태)
 * - 자동 로그인(3일) 쿠키가 있으면 브라우저를 다시 열어도 'in' (PRD 01 FR-109)
 */
export function initAuthState() {
  // TODO
}

/**
 * 비밀번호 Show / Hide 버튼 (.pw__toggle)
 * - 클릭: aria-controls 로 입력칸을 찾아 type 을 'password' ↔ 'text' 로 바꿈
 * - 버튼 글자 Show ↔ Hide, aria-pressed 'false' ↔ 'true'
 * @param {ParentNode} root  찾을 범위 (기본 document)
 */
export function initPasswordToggles(root = document) {
  // TODO
}

/**
 * 소셜 로그인 버튼 (.oauth[data-provider]) — 지금은 자리만
 * - 클릭하면 "Coming soon" 안내 (예: 버튼 아래 짧은 문구, 또는 alert)
 * - 연동할 때: location.href = `/api/v1/auth/oauth/${provider}/start` (추후 PRD 01 개정)
 * @param {ParentNode} root
 */
export function initOAuthPlaceholders(root = document) {
  // TODO
}

/**
 * 입력칸 상태 바꾸기 (forms.css 의 상태 6가지 중 ok / error / 기본)
 * @param {HTMLElement} field   .field 요소
 * @param {'ok'|'error'|null} state
 * @param {string} [message]    .field__msg 에 넣을 문구
 * - ok:    field.classList 에 is-ok,    입력칸 aria-invalid 제거
 * - error: field.classList 에 is-error, 입력칸 aria-invalid="true"
 * - null:  둘 다 제거
 */
export function setFieldState(field, state, message) {
  // TODO
}
