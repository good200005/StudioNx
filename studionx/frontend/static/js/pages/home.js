// home.html 페이지 스크립트 (템플릿 — 구현은 직접)
// 지금 동작은 CSS만으로 됨: 앵커 부드러운 스크롤(scroll-behavior), 세로 앵커 표시(position: sticky),
// 모바일 메뉴(<details>). 아래는 다음에 붙일 동작의 자리입니다.

import { initAuthState, initPasswordToggles, initOAuthPlaceholders } from '../core/auth-ui.js';

/**
 * 세로 앵커(S·Ch·F·D·Co)에서 지금 보고 있는 섹션 표시
 * - IntersectionObserver 로 화면 가운데에 들어온 section 을 찾고
 * - 해당 .side-nav__link 에 aria-current="true" 설정 (CSS가 보라색으로 표시)
 */
export function initSideNavActiveState() {
  // TODO
}

/**
 * 모바일 메뉴: 링크를 누르면 <details class="menu"> 닫기
 */
export function initMobileMenuClose() {
  // TODO
}

/**
 * Contact 폼 전송 (PRD 01 FR-112)
 * - submit 기본 동작을 막고, 브라우저 기본 검사(required, type=email, maxlength)를 통과하면
 * - POST /api/v1/inquiries  JSON { email, title, content, privacy_agreed: true }
 * - 성공: 폼 초기화 + 안내 문구 / 실패: 오류 문구 (서버 메시지 표시)
 * - 연속 전송 막기: 전송 중에는 Send 버튼 disabled
 */
export function initContactForm() {
  // TODO
}

/**
 * 모달 대체 코드 — 버튼의 command="show-modal" / "close" 를 지원하지 않는 브라우저용
 * - [commandfor] 버튼 클릭 시 document.getElementById(id).showModal() / close()
 * - 지원 여부: 'command' in HTMLButtonElement.prototype
 */
export function initModalFallback() {
  // TODO
}

/**
 * Development 공지: GET /api/v1/dev-notes?limit=4 로 최신 4개를 받아 .dev-notes 를 채움
 * (지금 HTML의 4개는 예시 문구)
 */
export function loadDevNotes() {
  // TODO
}

/**
 * 로그인 모달 자동 열기 (PRD 01 FR-105)
 * - 주소가 #login 이면 document.getElementById('login-modal').showModal()
 *   (로그인이 필요한 페이지가 home.html#login?next=myPage.html 로 보냄)
 * - next 값은 저장해 두었다가 로그인 성공 후 이동에 사용 (같은 사이트 경로만 허용 — 외부 주소 금지)
 * - 모달을 닫으면 주소의 #login 제거 (history.replaceState)
 */
export function initLoginModalFromHash() {
  // TODO
}

/**
 * 로그인 전송 (PRD 01 FR-103·109)
 * - POST /api/v1/auth/login  JSON { email, password, remember }  (remember = 자동 로그인 체크 여부)
 * - 성공: next 가 있으면 그 페이지로, 없으면 모달 닫고 <html data-auth="in"> (헤더가 My Page·My Projects로 바뀜)
 * - 실패: #login-error 에 "Email or password is incorrect." 표시 (hidden 해제) — 어느 쪽이 틀렸는지 알려주지 않음
 * - 전송 중에는 Sign In 버튼 disabled
 */
export function initLoginForm() {
  // TODO
}

initAuthState();
initLoginModalFromHash();
initLoginForm();
initPasswordToggles();
initOAuthPlaceholders();
initSideNavActiveState();
initMobileMenuClose();
initContactForm();
initModalFallback();
loadDevNotes();
