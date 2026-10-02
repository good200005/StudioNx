// 오류 페이지 스크립트 (404.html, errors/*.html)
// 공통 헤더·푸터는 core/include.js (구현 완료), 버튼 동작은 템플릿 — 구현은 직접 (P1-22)
import { includePartials } from '../core/include.js';
import { initModalFallback } from '../core/modal.js';

/**
 * 오류 페이지 버튼
 * - [data-action="back"]   Go back   → history.length > 1 이면 history.back(), 아니면 location.href = 'home.html'
 * - [data-action="retry"]  Try again → location.reload()
 *   (429·503 은 서버가 Retry-After 헤더를 주면 그 초만큼 버튼을 잠시 막아도 좋음 — 선택)
 */
export function initErrorActions() {
  // TODO
}

await includePartials();
initModalFallback();
initErrorActions();
