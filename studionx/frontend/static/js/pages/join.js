// join.html 페이지 스크립트 (템플릿 — 구현은 직접, P1-07)
import { initLoginForm, initPasswordToggles, initOAuthPlaceholders, setFieldState } from '../core/auth-ui.js';
import { initModalFallback } from '../core/modal.js';
import { includePartials } from '../core/include.js';

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
 */
export function initDuplicateChecks() {
  // TODO
}

/** 비밀번호 조건 (PRD 01 FR-102) — 서버(P1-04)도 같은 규칙으로 다시 검사 */
export const PASSWORD_RULES = {
  length: (pw) => pw.length >= 8 && pw.length <= 20,
  upper: (pw) => /[A-Z]/.test(pw),
  lower: (pw) => /[a-z]/.test(pw),
  number: (pw) => /[0-9]/.test(pw),
  special: (pw) => /[!-/:-@[-`{-~]/.test(pw), // 키보드 기호 (ASCII 33~126 중 영문·숫자 제외: !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~)
};

/** 쓸 수 있는 문자: 영문·숫자·키보드 기호만 (한글·공백·이모지 등 불가) */
export const PASSWORD_ALLOWED = /^[!-~]*$/;

/**
 * 비밀번호 조건 표시·확인 (PRD 01 FR-102)
 * - #join-password 입력할 때마다 PASSWORD_RULES 로 검사해
 *   #join-password-rules li[data-rule="…"] 에 is-met 클래스 붙이기/빼기 (auth.css: ✓ 초록 / ○ 회색)
 *   같은 li 안 [data-rule-state] 글자도 ', met' / ', not met' 로 (화면 읽기 프로그램용)
 * - PASSWORD_ALLOWED 에 맞지 않으면(한글·공백 등): setFieldState(passwordField, 'error', 'Use only English letters, numbers and symbols.')
 * - 칸을 벗어날 때(blur) 조건이 하나라도 안 맞으면: setFieldState(passwordField, 'error', 'Check the password requirements.')
 * - 확인 칸이 다르면: setFieldState(confirmField, 'error', "Passwords don't match.")
 */
export function initPasswordRules() {
  // TODO
}

/**
 * 가입 전송
 * - 이메일·닉네임 중복 확인을 통과했는지, 비밀번호 규칙·확인이 맞는지 검사
 * - POST /api/v1/auth/signup  JSON { email, nickname, password }
 * - 성공: home.html#login 으로 이동 (로그인 모달이 열림) — 또는 바로 로그인 처리
 * - 실패: #join-error 에 서버 메시지, hidden 해제
 * - 전송 중에는 Create account 버튼 disabled
 */
export function initJoinForm() {
  // TODO
}

// 공통 헤더·푸터·로그인 모달을 먼저 끼움 (static/partials/) — 아래 init 들은 그 요소를 찾으므로 순서 중요
await includePartials();

initModalFallback();
// 로그인 모달(이미 가입한 사람용): 성공하면 메인으로 — 헤더가 My Page·My Projects로 보임
initLoginForm({ onSuccess: null /* TODO: () => { location.href = 'home.html'; } */ });
initPasswordToggles();
initOAuthPlaceholders();
initDuplicateChecks();
initPasswordRules();
initJoinForm();
