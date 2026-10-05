// privacy.html 페이지 스크립트 — 공통 헤더·푸터·로그인 모달만 끼움 (core/include.js, 구현 완료)
import { includePartials } from '../core/include.js';
import { initAuthState } from '../core/auth-ui.js';
import { initModalFallback } from '../core/modal.js';

/**
 * (선택) 목차에서 지금 읽고 있는 절 표시
 * - IntersectionObserver 로 화면 위쪽에 들어온 section 을 찾아
 *   .policy__toc a[href$="#<id>"] 에 aria-current="true" (CSS 는 :hover 와 같은 모양을 쓰면 됨)
 */
export function initTocActiveState() {
  // TODO
}

await includePartials();
initAuthState();
initModalFallback();
initTocActiveState();
