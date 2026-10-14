// 오류 페이지 스크립트 (errors/*.html — 404 포함)
// 공통 헤더·푸터는 core/include.js (구현 완료), 버튼 동작은 템플릿 — 구현은 직접 (P1-22)
import { includePartials } from '../core/include.js';
import { initModalFallback } from '../core/modal.js';
import { initImageProtection } from '../core/protect-images.js';

/**
 * 오류 페이지 버튼
 * - [data-action="back"]   Go back   → history.length > 1 이면 history.back(), 아니면 location.href = 'home.html'
 * - [data-action="retry"]  Try again → location.reload()
 *   (429·503 은 서버가 Retry-After 헤더를 주면 그 초만큼 버튼을 잠시 막아도 좋음 — 선택)
 * (구현: AI — 2026-10-13, P1-23, 함수 하나씩 검토)
 * - 오류 페이지가 열리는 방식이 두 가지라서 Try again 이 다르게 동작함
 *   · 서버가 그 주소에 직접 보낸 오류 페이지 (주소가 /errors/ 로 시작하지 않음): 같은 주소를 다시 불러
 *     원래 요청을 다시 시도 (location.reload)
 *   · 화면의 JS 가 옮겨 온 오류 페이지 (주소가 /errors/500.html 등, core/page-errors.js):
 *     reload 하면 오류 페이지만 다시 뜨므로, 같은 사이트에서 왔다면 그 페이지(document.referrer)로 돌아가
 *     다시 시도하고, 알 수 없으면 home.html 로 보냄
 * - 버튼은 누르는 곳(document)에 한 번만 걸어 둠 (버튼이 나중에 생겨도 동작, 두 번 걸리지 않음)
 */
export function initErrorActions() {
  document.addEventListener('click', function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');

    if (action === 'back') {
      if (history.length > 1) history.back();
      else location.href = 'home.html';
    } else if (action === 'retry') {
      if (location.pathname.indexOf('/errors/') !== 0) {
        location.reload();
      } else if (document.referrer && document.referrer.indexOf(location.origin + '/') === 0
        && document.referrer.indexOf(location.origin + '/errors/') !== 0) {
        location.href = document.referrer;
      } else {
        location.href = 'home.html';
      }
    }
  });
}

await includePartials();
initModalFallback();
initErrorActions();
initImageProtection();
