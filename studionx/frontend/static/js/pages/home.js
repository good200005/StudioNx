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

initSideNavActiveState();
initMobileMenuClose();
