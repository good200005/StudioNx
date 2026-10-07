// myProject.html 페이지 스크립트 (템플릿 — 구현은 직접, P1-14)
// 화면 모양은 HTML·CSS로 완성되어 있고(지금 목록은 예시), 모달은 command 속성으로 JS 없이 열고 닫힘.
// 여기서는 API 연결과, 모달을 열 때 "어느 프로젝트인지" 채우는 일을 합니다.
// API (PRD 01 §7): GET /projects?query=&page=&size= · POST /projects · PATCH /projects/{id} · DELETE /projects/{id}

import { initAuthState } from '../core/auth-ui.js';
import { requireLogin, logout } from '../core/auth.js';
import { initModalFallback } from '../core/modal.js';
import { canOpenStudio, showDesktopOnly, initDesktopOnlyLinks, openStudio } from '../core/studio.js';
import { includePartials } from '../core/include.js';
import { initFormAlerts } from '../core/dialog.js';

/** 한 페이지에 보여 줄 프로젝트 수 (FR-123) */
export const PAGE_SIZE = 10;


/**
 * 목록 받기 (FR-123)
 * - api.get(`/projects?query=${q}&sort=${sort}&page=${page}&size=${PAGE_SIZE}`)   (core/api.js)
 * - 응답 예시 (P1-13 백엔드와 맞춰 정하기):
 *   { items: [ { project_id, title, description, bpm, time_sig_num, time_sig_den, music_key,
 *                updated_at, my_role: 'OWNER'|'EDITOR'|'VIEWER', member_count,
 *                opened: false } ],      // opened = 내 작업 세션(project_sessions)이 1개 이상 (FR-130)
 *     total: 12, page: 1, size: 10 }
 * - 검색어·정렬·페이지는 주소(?query=&sort=&page=)에도 남겨 새로고침·뒤로 가기에서 유지 (history.replaceState)
 * - 실패하면 (2026-10-06 결정) 500 이상 → location.replace('errors/500.html') (목록이라 404·403 없음)
 * @returns {Promise<object>}
 */
export async function loadProjects({ query = '', sort = 'updated', page = 1 } = {}) {
  // TODO
}

/**
 * 목록 그리기
 * - #project-list 비우고, 항목마다 #project-row-template 을 복사해 채움
 *   · li[data-project-id], .pj-row__head·Open 링크 href = `studioNx.html?projectId=${id}` (FR-126)
 *   · 제목 <b>, 설명 <span> (없으면 'No description')
 *   · opened 가 false 면 제목 뒤에 <span class="pj-badge">Not opened</span> (FR-130)
 *   · [data-field="bpm|sig|key"] 값 (키가 없으면 '—'), [data-field="when"] 은 formatRelativeTime(updated_at)
 *   · [data-field="when"] 의 data-meta = '128 BPM · A minor · ' (모바일 한 줄 정보 — CSS 가 앞에 붙여 보여 줌)
 *   · 참여자: member_count 만큼 <i></i> (최대 3개), my_role 이 OWNER 가 아니면 <span class="pj-role">Editor</span>
 *   · OWNER 가 아니면 [data-action="delete"] 버튼 disabled + <small>Owner only</small> (FR-125)
 *   · summary aria-label = `More actions for ${title}`
 * - #project-count ← '12 projects'
 * - 0개: 검색어가 있으면 #project-no-result, 없으면 #project-empty 의 hidden 해제 (목록·제목 줄은 숨김)
 * @param {object} data  loadProjects 응답
 */
export function renderProjects(data) {
  // TODO
}

/**
 * 페이지 넘김 다시 그리기 (#project-pager)
 * - Prev · 1 2 3 … · Next. 지금 페이지는 aria-current="page", 첫/마지막 페이지에서 Prev/Next 는 aria-disabled="true"
 * - 클릭하면 loadProjects({ page }) → renderProjects (주소도 갱신)
 * - 페이지가 1개뿐이면 #project-pager 숨김
 */
export function renderPager(total, page, size = PAGE_SIZE) {
  // TODO
}

/**
 * 검색·정렬 (#project-search)
 * - #project-query 입력을 멈추고 0.3초 뒤 검색 (page 1부터), submit(Enter) 기본 동작은 막기
 * - #project-sort 가 바뀌면 바로 다시 받기
 */
export function initSearch() {
  // TODO
}

/**
 * 새 프로젝트 (#new-project-form, FR-122)
 * - submit 막고 api.post('/projects', { title, description, bpm, time_sig_num, time_sig_den })
 *   (#new-sig 의 '7/8' 을 num 7 / den 8 로 나눠서)
 * - 서버가 OWNER 멤버 + MASTER 트랙까지 한 트랜잭션으로 만듦 (P1-13)
 * - 성공 (FR-129):
 *   · canOpenStudio() 이면 openStudio(project_id, { isNew: true })  — 별도 창 + 로딩 "새 프로젝트" 모드
 *     (팝업이 막히지 않게: 제출 클릭 때 빈 창을 먼저 열고, 응답 뒤 그 창 주소를 바꿈 — studio.js openStudio 설명)
 *     만든 뒤 이 목록 창은 그대로 두고 목록만 다시 받음 (새 프로젝트가 맨 위)
 *   · 아니면 모달 닫고 목록 다시 받기(새 프로젝트가 맨 위) + showDesktopOnly('created', title)
 * - 실패: #new-project-error 에 서버 메시지 (hidden 해제). 전송 중 버튼 disabled
 */
export function initNewProjectForm() {
  // TODO
}

/**
 * ··· 메뉴의 [Edit details] / [Delete] (FR-124·125)
 * - #project-list 에 click 이벤트 하나만 걸고 (항목이 다시 그려져도 동작) [data-action] 버튼을 찾음
 * - 버튼이 속한 li[data-project-id] 의 id·제목·설명을 기억 (모달은 command 속성이 이미 엶)
 *   · edit:   #edit-title, #edit-description 에 현재 값
 *   · delete: #delete-project-name 에 제목
 * - 열었던 <details class="pj-menu"> 는 open 속성 제거 (메뉴 닫기)
 * - 메뉴 바깥을 누르거나 Esc 를 누르면 열린 .pj-menu 닫기
 */
export function initRowMenus() {
  // TODO
}

/**
 * 제목·설명 저장 (#edit-project-form, FR-124)
 * - api.patch(`/projects/${id}`, { title, description }) → 성공하면 모달 닫고 목록의 그 줄만 갱신
 * - 실패: #edit-project-error
 */
export function initEditProjectForm() {
  // TODO
}

/**
 * 삭제 확인 (#delete-project-confirm, FR-125)
 * - (2026-10-07 결정) 확인은 core/dialog.js confirmDialog({ title: 'Delete project?', text: …, confirmText: 'Delete project', danger: true })
 *   로 띄움 (목업 docs/page_mockups/sweetalert/05 · 12). P1-14 구현 때 #delete-project-modal 과 행 메뉴의
 *   command="show-modal" commandfor="delete-project-modal" 을 지우고, Delete 클릭 → confirmDialog → true 면 아래 삭제
 * - api.delete(`/projects/${id}`) (서버는 소프트 삭제 deleted_at, OWNER 가 아니면 403)
 * - 성공: 모달 닫고 목록 다시 받기 (지금 페이지가 비면 한 페이지 앞으로)
 * - 실패: #delete-project-error. 누른 뒤 버튼 disabled (두 번 누름 방지)
 */
export function initDeleteProject() {
  // TODO
}

/**
 * '12 minutes ago' · '2 hours ago' · 'Yesterday' · 'Sep 27' (7일 넘으면 날짜)
 * @param {string} isoTime  updated_at (UTC)
 * @returns {string}
 */
export function formatRelativeTime(isoTime) {
  // TODO
}

/** 로그아웃 버튼 (#logout-button) → core/auth.js logout() — myPage.html 과 같음 */
export function initLogoutButton() {
  // TODO
}

// 공통 헤더·푸터를 먼저 끼움 (static/partials/) — 아래 init 들은 그 요소를 찾으므로 순서 중요
await includePartials();

initAuthState();
initModalFallback();
initFormAlerts();   // 19 — 새 프로젝트 · 정보 수정 폼의 기본 말풍선 대신 알림창
// TODO: await requireLogin() — 로그인 안 했으면 home.html#login?next=myProject.html 로 보냄 (core/auth.js)
// TODO: 주소의 ?query=&sort=&page= 를 읽어 loadProjects → renderProjects → renderPager
initSearch();
initNewProjectForm();
initRowMenus();
initDesktopOnlyLinks(document.getElementById('project-list'));   // 작은 화면에서 Open·제목 → 안내 (FR-129)
initEditProjectForm();
initDeleteProject();
initLogoutButton();
