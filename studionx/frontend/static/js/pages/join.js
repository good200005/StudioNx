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
 * - 입력값이 바뀌면 확인 결과를 지움 (다시 확인해야 가입 가능)
 * - (권장) 입력을 멈추고 0.5초 뒤 자동 확인 — "실시간 중복 확인"
 */
export function initDuplicateChecks() {
  // TODO
}

/**
 * 비밀번호 규칙·확인 (PRD 01 FR-102)
 * - 규칙: 8자 이상, 영문 + 숫자 포함 (bcrypt 한계로 최대 72자)
 * - 규칙 위반: setFieldState(passwordField, 'error', '8+ characters, letters and numbers')
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
