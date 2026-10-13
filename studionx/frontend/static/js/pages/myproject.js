// myProject.html 페이지 스크립트 (템플릿 — 구현은 직접, P1-14)
// 화면 모양은 HTML·CSS로 완성되어 있고(지금 목록은 예시), 모달은 command 속성으로 JS 없이 열고 닫힘.
// 여기서는 API 연결과, 모달을 열 때 "어느 프로젝트인지" 채우는 일을 합니다.
// API (PRD 01 §7): GET /projects?query=&page=&size= · POST /projects · PATCH /projects/{id} · DELETE /projects/{id}

import { initAuthState, initLogoutButton } from '../core/auth-ui.js';
import { requireLogin, loginUrl } from '../core/auth.js';
import { api } from '../core/api.js';
import { initModalFallback } from '../core/modal.js';
import { canOpenStudio, showDesktopOnly, initDesktopOnlyLinks, openStudio, openBlankStudio } from '../core/studio.js';
import { includePartials } from '../core/include.js';
import { initFormAlerts, confirmDialog, showAlert } from '../core/dialog.js';

/** 한 페이지에 보여 줄 프로젝트 수 (FR-123) */
export const PAGE_SIZE = 10;

/** 정렬 값 — #project-sort 의 option value · 서버 ProjectSort 와 같음 */
const SORTS = ['updated', 'title', 'created'];

/** 검색어 최대 길이 — 서버 query max_length 와 같음 */
const QUERY_MAX = 100;

/** 같은 번호의 오류 화면이 있는 상태 코드 (frontend/errors/) — userinfo.js 와 같음 */
const ERROR_PAGES = [400, 403, 404, 429, 500, 503, 504];

/** ··· 메뉴에서 고른 프로젝트 — Edit details · Delete 가 어느 프로젝트인지 (34 가 채움, 36 · 37 이 읽음) */
export const selected = { id: null, title: '', description: '' };

/** 검색 칸 입력을 멈춘 뒤 기다리는 시간 (ms) */
const SEARCH_DELAY = 300;

/** loadProjects 요청 번호 — 늦게 도착한 옛 응답을 버리려고 */
let loadTicket = 0;

/** 지금 보고 있는 목록 조건 — 페이지 넘김 · 삭제 뒤 다시 받을 때 씀 (loadProjects 가 갱신) */
export const current = { query: '', sort: 'updated', page: 1 };


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
 * (구현: AI — 2026-10-08) 값 정리(정렬 3가지 · page 1 이상 · 검색어 공백 제거 100자) → 요청 → 지금 조건(current) ·
 *   주소 갱신. 실패: 401 → 로그인 주소, 503 · 504 · 429 는 같은 번호, 그 밖의 500 이상 → 500,
 *   서버에 닿지 못함(0) → 503, 그 밖의 4xx → 400 (loadMe 22 와 같은 규칙)
 * @returns {Promise<object|null>} 목록 응답 (오류 화면 · 로그인으로 옮겨 가면 null)
 */
export async function loadProjects({ query = '', sort = 'updated', page = 1 } = {}) {
  // 1. 값 정리 — 주소창에 손으로 친 값(?page=abc, ?sort=random)도 서버가 422 를 내지 않게
  query = String(query).trim().slice(0, QUERY_MAX);
  if (SORTS.indexOf(sort) < 0) sort = 'updated';
  page = parseInt(page, 10);
  if (!(page >= 1)) page = 1;   // NaN · 0 · 음수 → 1

  // 2. 서버에 요청
  const params = new URLSearchParams({ query: query, sort: sort, page: String(page), size: String(PAGE_SIZE) });
  const ticket = ++loadTicket;
  let data;
  try {
    data = await api.get('/projects?' + params.toString());
  } catch (err) {
    if (ticket !== loadTicket) return null;   // 더 새 요청이 있으면 이 실패는 무시
    if (err.status === 401) {
      location.replace(loginUrl(location.pathname + location.search + location.hash));
    } else {
      let errorPage = err.status >= 500 ? 500 : 400;
      if (ERROR_PAGES.indexOf(err.status) >= 0) errorPage = err.status;
      else if (err.status === 0) errorPage = 503;
      location.replace('errors/' + errorPage + '.html');
    }
    return null;
  }

  if (ticket !== loadTicket) return null;   // 그사이 더 새 요청을 보냄 → 이 응답은 버림 (33)

  // 3. 지금 조건 기억 + 주소에 남김 (기본값은 빼서 주소를 짧게) — 새로고침 · 뒤로 가기에서 유지
  current.query = query;
  current.sort = sort;
  current.page = page;
  const shown = new URLSearchParams();
  if (query) shown.set('query', query);
  if (sort !== 'updated') shown.set('sort', sort);
  if (page !== 1) shown.set('page', String(page));
  const search = shown.toString();
  history.replaceState(null, '', location.pathname + (search ? '?' + search : '') + location.hash);

  return data;
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
 * (구현: AI — 2026-10-08) 글자는 모두 textContent 로 넣음 (제목에 <b> 같은 글자가 있어도 태그가 되지 않게).
 *   bpm 은 서버가 글자 '128.50' 으로 보냄 → Number 로 바꿔 '128.5' · '120'. VIEWER 는 Edit 도 잠금 (서버 403 과 같게)
 * @param {object} data  loadProjects 응답
 */
export function renderProjects(data) {
  const list = document.getElementById('project-list');
  const template = document.getElementById('project-row-template');
  const count = document.getElementById('project-count');
  const label = document.querySelector('.pj-list .pj-row--label');
  const empty = document.getElementById('project-empty');
  const noResult = document.getElementById('project-no-result');
  if (!list || !template) return;

  // 1. 개수 · 빈 목록 안내
  if (count) count.textContent = data.total === 1 ? '1 project' : data.total + ' projects';
  const isEmpty = data.items.length === 0;
  list.hidden = isEmpty;
  if (label) label.hidden = isEmpty;
  if (empty) empty.hidden = !(isEmpty && !current.query);
  if (noResult) noResult.hidden = !(isEmpty && current.query);

  // 2. 줄 그리기 — 예시 줄을 지우고 틀을 복사해 채움
  list.textContent = '';
  for (let i = 0; i < data.items.length; i++) {
    list.appendChild(buildRow(template, data.items[i]));
  }
}

/** 프로젝트 하나 → 목록 한 줄 <li> (renderProjects 가 씀) */
function buildRow(template, item) {
  const row = template.content.firstElementChild.cloneNode(true);
  const field = function (name) { return row.querySelector('[data-field="' + name + '"]'); };
  const href = 'studioNx.html?projectId=' + item.project_id;
  const bpm = String(Number(item.bpm));             // '128.50' → '128.5', '120.00' → '120'
  const key = item.music_key ? item.music_key : '—';
  const isOwner = item.my_role === 'OWNER';

  row.dataset.projectId = item.project_id;
  row.dataset.title = item.title;                                        // 34 가 수정 칸을 채울 때 씀
  row.dataset.description = item.description ? item.description : '';
  row.querySelector('.pj-row__head').href = href;
  row.querySelector('.pj-row__act a').href = href;

  // 제목 · 설명 · Not opened
  const title = row.querySelector('.pj-row__head b');
  title.textContent = item.title;
  if (!item.opened) {
    const badge = document.createElement('span');
    badge.className = 'pj-badge';
    badge.textContent = 'Not opened';
    title.appendChild(document.createTextNode(' '));
    title.appendChild(badge);
  }
  row.querySelector('.pj-row__head > span').textContent = item.description ? item.description : 'No description';

  // BPM · 박자 · 키 · 언제 (모바일 한 줄 정보는 data-meta)
  field('bpm').textContent = bpm;
  field('sig').textContent = item.time_sig_num + '/' + item.time_sig_den;
  field('key').textContent = key;
  const when = field('when');
  when.textContent = formatRelativeTime(item.updated_at);
  when.dataset.meta = bpm + ' BPM · ' + (item.music_key ? item.music_key + ' · ' : '');

  // 참여자 점 (최대 3개) + 내 역할 (OWNER 가 아니면)
  const members = field('members');
  for (let i = 0; i < Math.min(item.member_count, 3); i++) {
    members.appendChild(document.createElement('i'));
  }
  let membersLabel = item.member_count === 1 ? '1 member' : item.member_count + ' members';
  if (!isOwner) {
    const roleName = item.my_role.charAt(0) + item.my_role.slice(1).toLowerCase();   // 'EDITOR' → 'Editor'
    const role = document.createElement('span');
    role.className = 'pj-role';
    role.textContent = roleName;
    members.appendChild(role);
    membersLabel += ', your role: ' + roleName.toLowerCase();
  }
  members.setAttribute('aria-label', membersLabel);

  // ··· 메뉴 — 삭제는 OWNER 만, 수정은 OWNER · EDITOR 만
  row.querySelector('.pj-more').setAttribute('aria-label', 'More actions for ' + item.title);
  if (!isOwner) {
    const deleteButton = row.querySelector('[data-action="delete"]');
    deleteButton.disabled = true;
    deleteButton.title = 'Only the owner can delete';
    const small = document.createElement('small');
    small.textContent = 'Owner only';
    deleteButton.appendChild(document.createTextNode(' '));
    deleteButton.appendChild(small);
  }
  if (item.my_role === 'VIEWER') {
    const editButton = row.querySelector('[data-action="edit"]');
    editButton.disabled = true;
    editButton.title = 'Viewers can’t edit';
  }
  return row;
}

/**
 * 페이지 넘김 다시 그리기 (#project-pager)
 * - Prev · 1 2 3 … · Next. 지금 페이지는 aria-current="page", 첫/마지막 페이지에서 Prev/Next 는 aria-disabled="true"
 * - 클릭하면 loadProjects({ page }) → renderProjects (주소도 갱신)
 * - 페이지가 1개뿐이면 #project-pager 숨김
 * (구현: AI — 2026-10-08) 페이지가 7개 넘으면 1 … 4 5 6 … 20 처럼 줄임. 링크 href 에도 검색어 · 정렬을 넣어
 *   새 탭으로 열어도 같은 목록. 클릭 처리는 nav 하나에 onclick (다시 그려도 한 번만 걸림)
 */
export function renderPager(total, page, size = PAGE_SIZE) {
  const pager = document.getElementById('project-pager');
  if (!pager) return;
  const pages = Math.max(1, Math.ceil(total / size));
  pager.textContent = '';
  pager.hidden = pages <= 1;
  if (pages <= 1) return;

  // 버튼 하나 — 갈 수 없으면 href 없이 aria-disabled
  const addButton = function (text, target, label) {
    const button = document.createElement('a');
    button.className = 'pj-pager__btn';
    button.textContent = text;
    if (label) button.setAttribute('aria-label', label);
    if (target < 1 || target > pages) {
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.href = pageHref(target);
      button.dataset.page = target;
      if (target === page && !label) button.setAttribute('aria-current', 'page');
    }
    pager.appendChild(button);
  };
  const addGap = function () {
    const gap = document.createElement('span');
    gap.className = 'pj-pager__btn';
    gap.setAttribute('aria-hidden', 'true');
    gap.textContent = '…';
    pager.appendChild(gap);
  };

  addButton('Prev', page - 1, 'Previous page');
  for (let n = 1; n <= pages; n++) {
    // 7쪽 이하는 전부, 넘으면 처음 · 끝 · 지금 앞뒤 하나만 (사이는 …)
    const near = n === 1 || n === pages || Math.abs(n - page) <= 1;
    if (pages <= 7 || near) {
      addButton(String(n), n);
    } else if (n === page - 2 || n === page + 2) {
      // … 가 한 쪽만 가리면 (2 · 끝에서 둘째) 그냥 그 번호를 보임
      if (n === 2 || n === pages - 1) addButton(String(n), n);
      else addGap();
    }
  }
  addButton('Next', page + 1, 'Next page');

  // 클릭 → 같은 검색어 · 정렬로 그 페이지를 받아 다시 그림 (페이지는 바뀌지 않음)
  pager.onclick = async function (event) {
    const button = event.target.closest('a[data-page]');
    if (!button) return;
    event.preventDefault();
    const data = await refreshList({ query: current.query, sort: current.sort, page: button.dataset.page });
    if (data) window.scrollTo(0, 0);
  };
}

/** 페이지 링크 주소 — 지금 검색어 · 정렬 + 그 페이지 (loadProjects 가 주소창에 남기는 모양과 같음) */
function pageHref(page) {
  const params = new URLSearchParams();
  if (current.query) params.set('query', current.query);
  if (current.sort !== 'updated') params.set('sort', current.sort);
  if (page !== 1) params.set('page', String(page));
  const search = params.toString();
  return search ? '?' + search : location.pathname;
}

/**
 * 검색·정렬 (#project-search)
 * - #project-query 입력을 멈추고 0.3초 뒤 검색 (page 1부터), submit(Enter) 기본 동작은 막기
 * - #project-sort 가 바뀌면 바로 다시 받기
 * (구현: AI — 2026-10-08) 정렬 · Enter 는 기다리지 않고 바로. 검색어가 지금 목록과 같으면 다시 받지 않음.
 *   늦게 도착한 옛 응답은 loadProjects 가 버림 (빠르게 치면 요청 순서와 응답 순서가 바뀔 수 있음)
 */
export function initSearch() {
  const form = document.getElementById('project-search');
  const input = document.getElementById('project-query');
  const sort = document.getElementById('project-sort');
  if (!form || !input || !sort) return;
  let timer = null;

  const search = function () {
    clearTimeout(timer);
    refreshList({ query: input.value, sort: sort.value, page: 1 });
  };

  input.addEventListener('input', function () {
    clearTimeout(timer);
    if (input.value.trim() === current.query) return;   // 공백만 더 쳤거나 원래대로 되돌림
    timer = setTimeout(search, SEARCH_DELAY);
  });
  sort.addEventListener('change', search);
  form.addEventListener('submit', function (event) {
    event.preventDefault();   // 페이지를 새로 열지 않음
    search();
  });
}

/** 목록 다시 받아 그리기 — loadProjects → renderProjects → renderPager (실패 · 옛 응답이면 아무것도 안 함) */
async function refreshList(options) {
  const data = await loadProjects(options);
  if (!data) return null;
  renderProjects(data);
  renderPager(data.total, data.page, data.size);
  return data;
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
 * (구현: AI — 2026-10-08) 공백만 친 제목은 보내지 않고 문구. 만든 뒤 검색 · 정렬을 기본으로 되돌려
 *   새 프로젝트가 목록 맨 위에 보이게 함. 실패하면 미리 연 빈 창을 닫음
 */
export function initNewProjectForm() {
  const form = document.getElementById('new-project-form');
  if (!form) return;
  const modal = document.getElementById('new-project-modal');
  const error = document.getElementById('new-project-error');
  const submit = form.querySelector('[type="submit"]');
  const showError = function (message) {
    error.textContent = message;
    error.hidden = false;
  };

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const title = document.getElementById('new-title').value.trim();
    const description = document.getElementById('new-description').value.trim();
    const sig = document.getElementById('new-sig').value.split('/');   // '7/8' → ['7', '8']
    error.hidden = true;
    if (!title) {
      showError('Enter a title.');
      return;
    }

    // 넓은 화면: 클릭한 지금 빈 창을 열어 둠 (응답 뒤에 열면 팝업으로 막힘 — 37)
    const wide = canOpenStudio();
    const win = wide ? openBlankStudio() : null;
    submit.disabled = true;
    let project;
    try {
      project = await api.post('/projects', {
        title: title,
        description: description ? description : null,
        bpm: Number(document.getElementById('new-bpm').value),
        time_sig_num: Number(sig[0]),
        time_sig_den: Number(sig[1]),
      });
    } catch (err) {
      if (win) win.close();
      showError(err.message);
      return;
    } finally {
      submit.disabled = false;
    }

    // 성공 — 모달 닫고 폼 비우기
    if (modal && modal.open) modal.close();
    form.reset();
    if (wide) {
      openStudio(project.project_id, { isNew: true, win: win });
    } else {
      showDesktopOnly('created', project.title);
    }

    // 목록은 기본 조건(최근 수정순 · 검색 없음)으로 — 새 프로젝트가 맨 위
    const query = document.getElementById('project-query');
    const sort = document.getElementById('project-sort');
    if (query) query.value = '';
    if (sort) sort.value = 'updated';
    refreshList({ query: '', sort: 'updated', page: 1 });
  });
}

/**
 * ··· 메뉴의 [Edit details] / [Delete] (FR-124·125)
 * - #project-list 에 click 이벤트 하나만 걸고 (항목이 다시 그려져도 동작) [data-action] 버튼을 찾음
 * - 버튼이 속한 li[data-project-id] 의 id·제목·설명을 기억 (모달은 command 속성이 이미 엶)
 *   · edit:   #edit-title, #edit-description 에 현재 값
 *   · delete: #delete-project-name 에 제목
 * - 열었던 <details class="pj-menu"> 는 open 속성 제거 (메뉴 닫기)
 * - 메뉴 바깥을 누르거나 Esc 를 누르면 열린 .pj-menu 닫기
 * (구현: AI — 2026-10-08) 고른 프로젝트는 selected 에 기억 (36 저장 · 37 삭제가 읽음).
 *   제목 · 설명은 줄의 data-title · data-description 에서 (31 buildRow 가 넣음 — 화면 글자에는 'Not opened' · 'No description' 이 섞여 있어서)
 */
export function initRowMenus() {
  const list = document.getElementById('project-list');
  if (!list) return;

  // ··· 메뉴 안 버튼 — 목록에 하나만 걸어 둠 (줄을 다시 그려도 동작)
  list.addEventListener('click', function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const row = button.closest('li[data-project-id]');
    selected.id = Number(row.dataset.projectId);
    selected.title = row.dataset.title;
    selected.description = row.dataset.description;

    if (button.dataset.action === 'edit') {
      const title = document.getElementById('edit-title');
      const description = document.getElementById('edit-description');
      const error = document.getElementById('edit-project-error');
      if (title) title.value = selected.title;
      if (description) description.value = selected.description;
      if (error) { error.hidden = true; error.textContent = ''; }   // 지난번 실패 문구 지우기
    }
    const menu = button.closest('details');
    if (menu) menu.open = false;
  });

  // 메뉴 바깥을 누르면 열린 메뉴 닫기 (다른 줄의 ··· 를 눌러도 앞 메뉴는 닫힘)
  document.addEventListener('click', function (event) {
    const menus = document.querySelectorAll('.pj-menu[open]');
    for (let i = 0; i < menus.length; i++) {
      if (!menus[i].contains(event.target)) menus[i].open = false;
    }
  });

  // Esc → 열린 메뉴 닫고, 메뉴 안에 있던 포커스는 ··· 버튼으로 돌려줌
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    const menus = document.querySelectorAll('.pj-menu[open]');
    for (let i = 0; i < menus.length; i++) {
      const hadFocus = menus[i].contains(document.activeElement);
      menus[i].open = false;
      if (hadFocus) menus[i].querySelector('summary').focus();
    }
  });
}

/**
 * 제목·설명 저장 (#edit-project-form, FR-124)
 * - api.patch(`/projects/${id}`, { title, description }) → 성공하면 모달 닫고 목록의 그 줄만 갱신
 * - 실패: #edit-project-error
 * (구현: AI — 2026-10-08) 어느 프로젝트인지는 34 의 selected. 공백 제목은 보내지 않음. 바뀐 줄은 제자리에서
 *   다시 그림 (31 buildRow) — 최근 수정순이라도 바로 맨 위로 옮기지 않음 (다음 새로고침 때 올라감).
 *   404(그사이 다른 곳에서 지워짐)면 목록도 다시 받음
 */
export function initEditProjectForm() {
  const form = document.getElementById('edit-project-form');
  if (!form) return;
  const modal = document.getElementById('edit-project-modal');
  const error = document.getElementById('edit-project-error');
  const submit = form.querySelector('[type="submit"]');
  const showError = function (message) {
    error.textContent = message;
    error.hidden = false;
  };

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (selected.id === null) return;
    const title = document.getElementById('edit-title').value.trim();
    const description = document.getElementById('edit-description').value.trim();
    error.hidden = true;
    if (!title) {
      showError('Enter a title.');
      return;
    }

    submit.disabled = true;
    let item;
    try {
      item = await api.patch('/projects/' + selected.id, {
        title: title,
        description: description ? description : null,   // 비우면 설명 지우기
      });
    } catch (err) {
      showError(err.message);
      if (err.status === 404) refreshList({ query: current.query, sort: current.sort, page: current.page });
      return;
    } finally {
      submit.disabled = false;
    }

    if (modal && modal.open) modal.close();
    selected.title = item.title;
    selected.description = item.description ? item.description : '';
    const row = document.querySelector('#project-list > li[data-project-id="' + item.project_id + '"]');
    const template = document.getElementById('project-row-template');
    if (row && template) row.replaceWith(buildRow(template, item));
  });
}

/**
 * 삭제 확인 (#delete-project-confirm, FR-125)
 * - (2026-10-07 결정) 확인은 core/dialog.js confirmDialog({ title: 'Delete project?', text: …, confirmText: 'Delete project', danger: true })
 *   로 띄움 (목업 docs/page_mockups/sweetalert/05 · 12). P1-14 구현 때 #delete-project-modal 과 행 메뉴의
 *   command="show-modal" commandfor="delete-project-modal" 을 지우고, Delete 클릭 → confirmDialog → true 면 아래 삭제
 * - api.delete(`/projects/${id}`) (서버는 소프트 삭제 deleted_at, OWNER 가 아니면 403)
 * - 성공: 모달 닫고 목록 다시 받기 (지금 페이지가 비면 한 페이지 앞으로)
 * - 실패: #delete-project-error. 누른 뒤 버튼 disabled (두 번 누름 방지)
 * (구현: AI — 2026-10-08) HTML 삭제 모달은 지우고 confirmDialog 로 바꿈. 어느 프로젝트인지는 누른 줄의
 *   data-project-id · data-title 에서 바로 읽음. 실패는 showAlert (모달이 없어져 문구 칸이 없으므로)
 */
export function initDeleteProject() {
  const list = document.getElementById('project-list');
  if (!list) return;

  list.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-action="delete"]');
    if (!button || button.disabled) return;
    const row = button.closest('li[data-project-id]');
    const id = row.dataset.projectId;
    const title = row.dataset.title;

    const ok = await confirmDialog({
      title: 'Delete project?',
      text: '“' + title + '” will be removed from your projects. Collaborators will lose access too.',
      confirmText: 'Delete project',
      danger: true,
    });
    if (!ok) return;

    button.disabled = true;   // 두 번 누름 방지 (성공하면 줄이 다시 그려짐)
    try {
      await api.delete('/projects/' + id);
    } catch (err) {
      button.disabled = false;
      await showAlert('Couldn’t delete', err.message, { tone: 'error' });
      if (err.status === 404) refreshList({ query: current.query, sort: current.sort, page: current.page });
      return;
    }

    // 같은 조건으로 다시 받기 — 마지막 줄을 지워 그 페이지가 비면 (빈 화면을 그리지 않고) 한 페이지 앞으로
    const page = current.page;
    const data = await loadProjects({ query: current.query, sort: current.sort, page: page });
    if (!data) return;
    if (data.items.length === 0 && page > 1) {
      refreshList({ query: current.query, sort: current.sort, page: page - 1 });
      return;
    }
    renderProjects(data);
    renderPager(data.total, data.page, data.size);
  });
}

/**
 * '12 minutes ago' · '2 hours ago' · 'Yesterday' · '3 days ago' · 'Sep 27' (7일 넘으면 날짜)
 * - 서버 시각은 UTC 인데 시간대 표시가 없음 ('2026-10-08T02:10:11.123000') → 'Z' 를 붙여 UTC 로 읽음
 * - 'Yesterday' 와 날짜는 이 컴퓨터의 시간대(달력) 기준, 다른 해면 'Sep 27, 2025'
 * - 1분 안 · 미래 시각(컴퓨터 시계가 조금 느릴 때)은 'Just now'
 * (구현: AI — 2026-10-08, 함수 하나씩 검토)
 * @param {string} isoTime  updated_at (UTC)
 * @param {Date} [now]  지금 시각 — 시험할 때만 넘김
 * @returns {string}
 */
export function formatRelativeTime(isoTime, now = new Date()) {
  const hasZone = /[zZ]$|[+-]\d\d:\d\d$/.test(isoTime);
  const time = new Date(hasZone ? isoTime : isoTime + 'Z');
  const minutes = Math.floor((now - time) / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : minutes + ' minutes ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : hours + ' hours ago';

  // 달력으로 며칠 전인지 — 두 날의 자정끼리 비교 (시각은 버림)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(time.getFullYear(), time.getMonth(), time.getDate());
  const days = Math.round((today - day) / 86400000);   // round: 서머타임으로 하루가 23·25시간인 날 대비
  if (days <= 1) return 'Yesterday';
  if (days <= 7) return days + ' days ago';

  const options = { month: 'short', day: 'numeric' };
  if (time.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return time.toLocaleDateString('en-US', options);
}

/**
 * 페이지를 열 때 첫 목록 (FR-123)
 * - 주소의 ?query=&sort=&page= 로 받음 → 새로고침 · 뒤로 가기 · 복사한 주소에서도 같은 목록 (30 이 주소에 남긴 값)
 * - 받은 뒤 검색 칸 · 정렬 칸을 그 값으로 맞춤 (틀린 값은 30 이 고친 값으로)
 * - 없는 페이지(?page=9 인데 2쪽까지)면 마지막 쪽으로
 * - 받는 동안 HTML 의 예시 줄 · 개수가 보이지 않게 먼저 비움
 * (구현: AI — 2026-10-08, 함수 하나씩 검토)
 * @returns {Promise<object|null>} 목록 응답 (로그인 · 오류 화면으로 옮겨 가면 null)
 */
export async function loadInitialList() {
  const list = document.getElementById('project-list');
  const count = document.getElementById('project-count');
  const pager = document.getElementById('project-pager');
  if (list) list.textContent = '';
  if (count) count.textContent = '';
  if (pager) pager.hidden = true;

  const params = new URLSearchParams(location.search);
  const options = {
    query: params.get('query') || '',
    sort: params.get('sort') || 'updated',
    page: params.get('page') || 1,
  };
  let data = await refreshList(options);
  if (data && data.items.length === 0 && data.total > 0) {
    options.page = Math.ceil(data.total / data.size);   // 없는 쪽 → 마지막 쪽
    data = await refreshList(options);
  }
  if (!data) return null;

  const query = document.getElementById('project-query');
  const sort = document.getElementById('project-sort');
  if (query) query.value = current.query;
  if (sort) sort.value = current.sort;
  return data;
}

// 공통 헤더·푸터를 먼저 끼움 (static/partials/) — 아래 init 들은 그 요소를 찾으므로 순서 중요
await includePartials();

initAuthState();
initModalFallback();
initFormAlerts();   // 19 — 새 프로젝트 · 정보 수정 폼의 기본 말풍선 대신 알림창
initSearch();
initNewProjectForm();
initRowMenus();
initDesktopOnlyLinks(document.getElementById('project-list'));   // 작은 화면에서 Open·제목 → 안내 (FR-129)
initEditProjectForm();
initDeleteProject();
initLogoutButton();   // core/auth-ui.js (P1-10 27) — 세 화면 공용

// 로그인 확인 → 첫 목록 (로그인 안 했으면 home.html#login?next=… 로 옮겨 감)
if (await requireLogin()) await loadInitialList();
