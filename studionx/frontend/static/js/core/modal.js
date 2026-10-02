// <dialog> 모달 공통 (뼈대 — 구현은 직접)
// 지금 모달은 버튼의 command="show-modal" / "close" 속성으로 JS 없이 열고 닫힘.
// 쓰는 곳: home.html(개발 공지·개인정보·로그인), join.html(로그인)

/**
 * 모달 대체 코드 — command 속성을 지원하지 않는 브라우저용
 * - 지원 여부: 'command' in HTMLButtonElement.prototype  (지원하면 아무것도 안 함)
 * - [commandfor] 버튼 클릭 시 document.getElementById(id) 의
 *   command 가 'show-modal' 이면 showModal(), 'close' 이면 close()
 */
export function initModalFallback() {
  // TODO
}
