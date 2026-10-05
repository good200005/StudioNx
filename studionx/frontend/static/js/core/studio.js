// 시퀀서(studioNx.html) 열기 공통 (템플릿 — 구현은 직접, PRD 01 FR-126·129, PRD 02 FR-258)
// 시퀀서는 별도 브라우저 창으로 엶 (2026-10-05 결정 — 프로젝트 목록 창을 닫아도 작업 창은 남게)
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
 * 시퀀서를 **별도 브라우저 창**으로 열기 (2026-10-05 결정, PRD 01 FR-126 · PRD 02 FR-258)
 * - 프로젝트 목록 창을 닫아도 작업 창은 남음 (새 탭이면 같은 창이라 함께 닫힘)
 * - url = `studioNx.html?projectId=${projectId}` (+ isNew 면 `&new=1` → 로딩 "새 프로젝트" 모드)
 * - 창 이름 = `${STUDIO_WINDOW_PREFIX}${projectId}` → 같은 프로젝트를 다시 누르면 새 창 대신 그 창이 앞으로
 * - 창 옵션(이 문자열이 있어야 탭이 아니라 별도 창): 'popup,width=…,height=…,left=0,top=0'
 *   width/height = screen.availWidth / screen.availHeight (화면에 맞춰 크게)
 * - const win = window.open(url, name, features)
 *   · win 이 있으면 win.focus()
 *   · null 이면 팝업이 막힌 것 → location.href = url (같은 탭에서 열기)
 * - 반드시 클릭 처리 안에서 바로 부를 것 (await 뒤에 부르면 브라우저가 팝업으로 막음)
 *   → 새 프로젝트는 POST /projects 응답을 기다려야 하므로, 클릭 때 먼저
 *     window.open('', name, features) 로 빈 창을 열어 두고 응답 뒤 win.location = url
 * - (Phase 2) 환경 설정 "시퀀서 열기: 별도 창 / 새 탭"(PRD 02 FR-2164) 이 '새 탭'이면 features 없이 '_blank'
 * @param {number|string} projectId
 * @param {{ isNew?: boolean }} [options]
 * @returns {Window|null}
 */
export function openStudio(projectId, options = {}) {
  // TODO
}

/** 시퀀서 창 이름 앞부분 — 프로젝트마다 창 하나 */
export const STUDIO_WINDOW_PREFIX = 'studio-';

/**
 * 시퀀서 링크 처리 (작은 화면 안내 + PC 는 별도 창)
 * - root 에 click 이벤트 하나만 걸고 (목록이 다시 그려져도 동작), 눌린 곳이 a[href^="studioNx.html"] 이면
 *   · canOpenStudio() 가 false → event.preventDefault() 후 showDesktopOnly('open', 제목)
 *     (제목: 링크가 속한 줄의 <b> 글자 — myProject 는 .pj-row, myPage 는 .lane / 배너)
 *   · true → event.preventDefault() 후 openStudio(링크의 projectId)  (별도 창)
 * - 휠 클릭·Ctrl+클릭(새 탭으로 열기)은 막지 않음 → event.button !== 0 || ctrlKey || metaKey 면 그대로 둠
 * - href 는 그대로 남겨 둠 → JS 가 꺼져 있어도 같은 탭에서 열림
 * @param {ParentNode} root  찾을 범위 (기본 document)
 */
export function initDesktopOnlyLinks(root = document) {
  // TODO
}
