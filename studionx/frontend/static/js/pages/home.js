// home.html 페이지 스크립트 (템플릿 — 구현은 직접)
// 지금 동작은 CSS만으로 됨: 앵커 부드러운 스크롤(scroll-behavior), 세로 앵커 표시(position: sticky),
// 모바일 메뉴(<details>). 아래는 다음에 붙일 동작의 자리입니다.

import { initAuthState, initLoginForm, initPasswordToggles, initOAuthPlaceholders } from '../core/auth-ui.js';
import { initModalFallback } from '../core/modal.js';
import { includePartials } from '../core/include.js';

/**
 * 첫 접속 로딩 (P1-20, static/css/pages/intro.css) — 첫 접속에만 보이기
 * - 로딩은 CSS 만으로 재생되고 1초 뒤 스스로 사라짐. 여기서는 "두 번째부터 숨기기"만 함
 * - 같은 탭에서 이미 봤으면(sessionStorage 'snx-intro' === 'seen')
 *   document.documentElement.dataset.intro = 'seen'  → 로딩 숨김 + 첫 화면은 원래 시간대로
 * - 처음이면 sessionStorage 에 'seen' 저장
 * - 주의: 이 모듈은 페이지를 그린 뒤에 실행되므로, 여기서 숨기면 로딩이 잠깐 깜빡일 수 있음
 *   → 깜빡임 없이 하려면 같은 검사를 <head> 안 짧은 인라인 스크립트로 (CSS 보다 먼저) 실행
 * - sessionStorage 를 못 쓰는 환경(사생활 보호 모드 등)은 try/catch → 그냥 매번 보여 줌
 */
export function initIntro() {
  // TODO
}

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
 * Development 공지: GET /api/v1/dev-notes?limit=4 로 최신 4개를 받아 .dev-notes 를 채움
 * (지금 HTML의 4개는 예시 문구)
 */
export function loadDevNotes() {
  // TODO
}

/**
 * 로그인 모달 자동 열기 (PRD 01 FR-105)
 * - core/auth.js 의 parseLoginHash() 로 { open, next } 를 읽고, open 이면
 *   document.getElementById('login-modal').showModal()
 *   (로그인이 필요한 페이지가 home.html#login?next=myPage.html 로 보냄)
 * - next 값은 저장해 두었다가 로그인 성공 후 이동에 사용 (parseLoginHash 가 safeNextPath 로 검사함)
 * - 모달을 닫으면 주소의 #login 제거 (history.replaceState)
 */
export function initLoginModalFromHash() {
  // TODO
}

// 공통 헤더·푸터·로그인 모달을 먼저 끼움 (static/partials/) — 아래 init 들은 그 요소를 찾으므로 순서 중요
await includePartials();

initIntro();
initAuthState();
initLoginModalFromHash();
// 로그인 성공 후: next 가 있으면 그 페이지로, 없으면 모달 닫고 <html data-auth="in"> (헤더 전환)
initLoginForm({ onSuccess: null /* TODO: (next) => ... */ });
initPasswordToggles();
initOAuthPlaceholders();
initSideNavActiveState();
initMobileMenuClose();
initContactForm();
initModalFallback();
loadDevNotes();
