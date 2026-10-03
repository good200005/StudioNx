// 시퀀서(studioNx.html) 열기 공통 (템플릿 — 구현은 직접, PRD 01 FR-129)
// 시퀀서는 폭 1280px 이상에서만 엶 (PRD 00 반응형 기준). 작은 화면에서는 안내 모달만 띄움
// 쓰는 곳: myProject.html, myPage.html — 안내 모달은 static/partials/desktop-only-modal.html

/** 시퀀서를 여는 최소 화면 폭 */
export const STUDIO_MIN_WIDTH = 1280;

/**
 * 지금 화면에서 시퀀서를 열 수 있는지
 * - matchMedia(`(min-width: ${STUDIO_MIN_WIDTH}px)`).matches
 * @returns {boolean}
 */
export function canOpenStudio() {
  // TODO
}

/**
 * #desktop-only-modal 열기
 * - variant 'created' | 'open' 에 맞는 [data-variant] 문단만 hidden 해제, 나머지는 hidden
 * - #desktop-only-created-name / #desktop-only-open-name ← 제목
 * - document.getElementById('desktop-only-modal').showModal()
 * @param {'created'|'open'} variant
 * @param {string} title
 */
export function showDesktopOnly(variant, title) {
  // TODO
}

/**
 * 작은 화면에서 시퀀서 링크 막기
 * - root 에 click 이벤트 하나만 걸고 (목록이 다시 그려져도 동작),
 *   눌린 곳이 a[href^="studioNx.html"] 이고 canOpenStudio() 가 false 면
 *   event.preventDefault() 후 showDesktopOnly('open', 제목)
 *   (제목: 링크가 속한 줄의 <b> 글자 — myProject 는 .pj-row, myPage 는 .lane / 배너)
 * - PC 에서는 아무것도 막지 않음 (링크 그대로)
 * @param {ParentNode} root  찾을 범위 (기본 document)
 */
export function initDesktopOnlyLinks(root = document) {
  // TODO
}
