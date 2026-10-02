// home.html 페이지 스크립트 (템플릿 — 구현은 직접)
// 지금 동작은 CSS만으로 됨: 앵커 부드러운 스크롤(scroll-behavior), 세로 앵커 표시(position: sticky),
// 모바일 메뉴(<details>). 아래는 다음에 붙일 동작의 자리입니다.

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

initSideNavActiveState();
initMobileMenuClose();
initContactForm();
initModalFallback();
loadDevNotes();
