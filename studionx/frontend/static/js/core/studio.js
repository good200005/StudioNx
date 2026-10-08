// 시퀀서(studioNx.html) 열기 공통 (템플릿 — 구현은 직접, PRD 01 FR-126·129, PRD 02 FR-258)
// 시퀀서는 별도 브라우저 창으로 엶 (2026-10-05 결정 — 프로젝트 목록 창을 닫아도 작업 창은 남게)
// 시퀀서는 폭 1280px 이상에서만 엶 (PRD 00 반응형 기준). 작은 화면에서는 안내 모달만 띄움
// 쓰는 곳: myProject.html, myPage.html — 안내 모달은 static/partials/desktop-only-modal.html

/** 시퀀서를 여는 최소 화면 폭 */
export const STUDIO_MIN_WIDTH = 1280;

/**
 * 지금 화면에서 시퀀서를 열 수 있는지
 * - matchMedia(`(min-width: ${STUDIO_MIN_WIDTH}px)`).matches
 * (구현: AI — 2026-10-08, 함수 하나씩 검토) CSS 의 @media 와 같은 기준 — 브라우저 확대(Ctrl +)를 하면 CSS 픽셀 폭이 줄어
 *   1280 미만이 될 수 있음 (화면 · 레이아웃이 실제로 그만큼 좁아진 것이므로 그대로 따름)
 * @returns {boolean}
 */
export function canOpenStudio() {
  return window.matchMedia('(min-width: ' + STUDIO_MIN_WIDTH + 'px)').matches;
}

/**
 * #desktop-only-modal 열기
 * - variant 'created' | 'open' 에 맞는 [data-variant] 문단만 hidden 해제, 나머지는 hidden
 * - #desktop-only-created-name / #desktop-only-open-name ← 제목
 * - document.getElementById('desktop-only-modal').showModal()
 * @param {'created'|'open'} variant
 * (구현: AI — 2026-10-08, 함수 하나씩 검토) 'created' 가 아니면 'open' 문구. 제목은 textContent 로 (태그가 되지 않게).
 *   이미 열려 있으면 다시 열지 않음 (showModal 을 두 번 부르면 오류)
 * @param {string} title
 */
export function showDesktopOnly(variant, title) {
  const modal = document.getElementById('desktop-only-modal');
  if (!modal) return;
  if (variant !== 'created') variant = 'open';

  // 상황에 맞는 문단만 보이기
  const leads = modal.querySelectorAll('[data-variant]');
  for (let i = 0; i < leads.length; i++) {
    leads[i].hidden = leads[i].dataset.variant !== variant;
  }
  const name = document.getElementById('desktop-only-' + variant + '-name');
  if (name) name.textContent = title;

  if (!modal.open) modal.showModal();
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
 * (구현: AI — 2026-10-08, 함수 하나씩 검토) options.win = 클릭 때 openBlankStudio() 로 미리 연 빈 창 —
 *   있으면 그 창의 주소 · 이름만 바꿈 (사용자가 그사이 닫았으면 새로 엶)
 * @param {number|string} projectId
 * @param {{ isNew?: boolean, win?: Window|null }} [options]
 * @returns {Window|null}
 */
export function openStudio(projectId, options = {}) {
  let url = 'studioNx.html?projectId=' + encodeURIComponent(projectId);
  if (options.isNew) url += '&new=1';
  const name = STUDIO_WINDOW_PREFIX + projectId;

  // 미리 열어 둔 빈 창이 있으면 그 창에서 (새 프로젝트 — 응답을 기다린 뒤라 새로 열면 팝업으로 막힘)
  let win = options.win;
  if (win && !win.closed) {
    win.name = name;            // 다음에 같은 프로젝트를 누르면 이 창이 앞으로 오게
    win.location.href = url;
  } else {
    win = window.open(url, name, studioWindowFeatures());
  }

  if (!win) {
    location.href = url;        // 팝업이 막힘 → 같은 탭에서 열기
    return null;
  }
  win.focus();
  return win;
}

/**
 * 시퀀서용 빈 창을 먼저 열기 — 클릭 처리 안에서 **await 전에** 부를 것 (39 새 프로젝트)
 * 응답이 오면 openStudio(id, { win }) 로 주소를 넣고, 실패하면 win.close()
 * (구현: AI — 2026-10-08, 37 과 함께)
 * @returns {Window|null}  팝업이 막혔으면 null
 */
export function openBlankStudio() {
  return window.open('', '', studioWindowFeatures());
}

/** 창 옵션 — 'popup' 이 있어야 탭이 아니라 별도 창, 크기는 화면에 맞춤 */
function studioWindowFeatures() {
  return 'popup,width=' + screen.availWidth + ',height=' + screen.availHeight + ',left=0,top=0';
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
 * (구현: AI — 2026-10-08, 함수 하나씩 검토) Shift(새 창) · Alt(내려받기) 클릭도 브라우저 기본 그대로.
 *   제목은 줄의 data-title(myProject 31) → 없으면 <b> 의 첫 글자 마디 ('Not opened' 표는 빼고)
 */
export function initDesktopOnlyLinks(root = document) {
  if (!root) return;
  root.addEventListener('click', function (event) {
    // 새 탭 · 새 창 · 내려받기 같은 브라우저 기본 동작은 막지 않음
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="studioNx.html"]');
    if (!link) return;

    event.preventDefault();
    if (!canOpenStudio()) {
      showDesktopOnly('open', studioLinkTitle(link));
      return;
    }
    const params = new URLSearchParams(link.getAttribute('href').split('?')[1]);
    openStudio(params.get('projectId'));
  });
}

/** 링크가 속한 프로젝트의 제목 — 줄의 data-title, 없으면 <b> 안 첫 글자 마디 */
function studioLinkTitle(link) {
  const row = link.closest('[data-title]');
  if (row) return row.dataset.title;
  const holder = link.querySelector('b') ? link : link.closest('li, section, article, div');
  const bold = holder ? holder.querySelector('b') : null;
  return bold && bold.firstChild ? bold.firstChild.textContent.trim() : 'This project';
}
