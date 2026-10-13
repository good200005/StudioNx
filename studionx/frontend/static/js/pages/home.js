// home.html 페이지 스크립트 (구현: AI — 함수 하나씩 검토)
// CSS만으로 되는 것: 앵커 부드러운 스크롤(scroll-behavior), 세로 앵커 위치(position: sticky), 모바일 메뉴 모양(<details>).
// 여기서 하는 것: 로딩 첫 접속만, 세로 앵커 현재 표시, 모바일 메뉴 닫기, 문의 폼, 공지 카드와 모달, 로그인 모달.

import { initAuthState, initLoginForm, initPasswordToggles, initOAuthPlaceholders } from '../core/auth-ui.js';
import { initModalFallback } from '../core/modal.js';
import { includePartials } from '../core/include.js';
import { parseLoginHash, isLoggedIn } from '../core/auth.js';
import { initFormAlerts, showAlert } from '../core/dialog.js';
import { api } from '../core/api.js';
import { markdownToFragment } from '../core/markdown.js';

/**
 * 첫 접속 로딩 (P1-20, static/css/pages/intro.css) — 첫 접속에만 보이기
 * - 로딩은 CSS 만으로 재생되고 1초 뒤 스스로 사라짐. 여기서는 "두 번째부터 숨기기"만 함
 * - 같은 탭에서 이미 봤으면(sessionStorage 'snx-intro' === 'seen')
 *   document.documentElement.dataset.intro = 'seen'  → 로딩 숨김 + 첫 화면은 원래 시간대로
 * - 처음이면 sessionStorage 에 'seen' 저장
 * - 주의: 이 모듈은 페이지를 그린 뒤에 실행되므로, 여기서 숨기면 로딩이 잠깐 깜빡일 수 있음
 *   → 깜빡임 없이 하려면 같은 검사를 <head> 안 짧은 인라인 스크립트로 (CSS 보다 먼저) 실행
 * - sessionStorage 를 못 쓰는 환경(사생활 보호 모드 등)은 try/catch → 그냥 매번 보여 줌
 */
export function initIntro() {
  // (구현: AI — 2026-10-13, P1-23, 함수 하나씩 검토)
  // 숨기는 일은 home.html <head> 의 짧은 인라인 검사가 먼저 함 (깜빡임 방지). 여기서는 그 기록을 남기고,
  // 인라인 검사가 막혔을 때(예: 나중에 보안 정책으로 인라인 스크립트를 막는 경우)를 대비해 같은 검사를 한 번 더 함
  try {
    if (sessionStorage.getItem('snx-intro') === 'seen') {
      document.documentElement.dataset.intro = 'seen';
    } else {
      sessionStorage.setItem('snx-intro', 'seen');
    }
  } catch (err) {
    // 저장소를 못 쓰면(사생활 보호 모드 등) 기록하지 못함 → 그냥 매번 보여 줌
  }
}

/**
 * 세로 앵커(S·Ch·F·D·Co)에서 지금 보고 있는 섹션 표시
 * - IntersectionObserver 로 화면 가운데에 들어온 section 을 찾고
 * - 해당 .side-nav__link 에 aria-current="true" 설정 (CSS가 보라색으로 표시)
 */
export function initSideNavActiveState() {
  // (구현: AI — 2026-10-13, P1-23, 함수 하나씩 검토)
  // - 화면 가운데 가로줄(위아래 50% 를 잘라 낸 얇은 띠)에 걸친 section 을 지금 보는 섹션으로 봄
  // - 첫 화면(hero)이나 섹션 사이에서는 어느 것도 표시하지 않음 (aria-current 를 모두 뺌)
  // - IntersectionObserver 를 못 쓰는 브라우저에서는 표시만 안 함 (링크 이동은 그대로 됨)
  const links = document.querySelectorAll('.side-nav__link');
  if (links.length === 0 || typeof IntersectionObserver === 'undefined') return;

  const targets = [];   // { id, link, section, inside }
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href.charAt(0) !== '#') continue;
    const section = document.getElementById(href.slice(1));
    if (section) targets.push({ id: href.slice(1), link: link, section: section, inside: false });
  }
  if (targets.length === 0) return;

  const refresh = function () {
    let current = null;
    for (const target of targets) {
      if (target.inside) { current = target; break; }   // 두 섹션이 경계에서 함께 걸치면 위쪽 것
    }
    for (const target of targets) {
      if (target === current) target.link.setAttribute('aria-current', 'true');
      else target.link.removeAttribute('aria-current');
    }
  };

  const observer = new IntersectionObserver(function (entries) {
    for (const entry of entries) {
      for (const target of targets) {
        if (target.section === entry.target) target.inside = entry.isIntersecting;
      }
    }
    refresh();
  }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });

  for (const target of targets) observer.observe(target.section);
}

/**
 * 모바일 메뉴: 링크를 누르면 <details class="menu"> 닫기
 */
export function initMobileMenuClose() {
  // (구현: AI — 2026-10-13, P1-23, 함수 하나씩 검토)
  // - 메뉴(<details class="menu">)는 공통 머리글 조각이라 includePartials() 뒤에 불러야 찾을 수 있음 (이 파일 맨 아래 순서)
  // - 메뉴 안의 링크와 버튼(Sign In 등)을 누르면 메뉴를 닫음. 글자나 빈 곳을 눌러서는 닫지 않음
  // - onclick 하나만 써서 두 번 불러도 처리기가 겹치지 않음
  const menus = document.querySelectorAll('details.menu');
  for (const menu of menus) {
    const panel = menu.querySelector('.menu__panel');
    if (!panel) continue;
    panel.onclick = function (event) {
      if (event.target.closest('a, button')) menu.open = false;
    };
  }
}

/**
 * Contact 폼 전송 (PRD 01 FR-112 · FR-113) — POST /api/v1/inquiries (P1-12 53)
 * - 빈 칸 · 이메일 형식 · 동의는 브라우저 기본 검사 → 말풍선 대신 알림창 (FIX-01 19 initFormAlerts)
 *   검사를 통과해야 submit 이 일어남 → 여기서는 보내기만
 * - 로그인한 사람은 이메일 칸에 내 이메일을 미리 채움 (P1-12 '로그인 시 자동 채움') — 칸이 비어 있을 때만
 * - 보내는 동안 Send 잠금 (연속 전송 막기)
 * - 결과는 알림창 (FIX-01 18 showAlert): 성공 'Message sent' + 폼 비움(내 이메일은 다시 채움),
 *   429 'Too many messages' + 몇 분 뒤 가능한지, 그 밖의 오류는 서버 문구
 * (구현: AI — 2026-10-08, 함수 하나씩 검토)
 */
export function initContactForm() {
  const form = document.getElementById('contact-form');
  const email = document.getElementById('contact-email');
  const title = document.getElementById('contact-subject');
  const content = document.getElementById('contact-content');
  const agree = document.getElementById('contact-agree');
  if (!form || !email || !title || !content || !agree) return;
  const submit = form.querySelector('button[type="submit"]');
  let myEmail = '';

  // 로그인 상태면 내 이메일을 미리 채움 (기다리지 않음 — 폼은 바로 쓸 수 있음)
  isLoggedIn().then(async (loggedIn) => {
    if (!loggedIn) return;
    try {
      myEmail = (await api.get('/users/me')).email;
    } catch {
      return; // 못 받아도 문의는 직접 적어 보낼 수 있음
    }
    if (email.value === '') email.value = myEmail;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit) submit.disabled = true;
    try {
      const sentTo = email.value.trim();
      // 토큰을 붙여 보냄 → 로그인한 회원이면 서버가 문의를 회원과 연결 (FR-112).
      // 토큰이 없거나 틀려도 이 API 는 401 이 아니라 비회원으로 받음 (백엔드 53)
      await api.post('/inquiries', {
        email: sentTo,
        title: title.value,
        content: content.value,
        privacy_agreed: agree.checked,
      });
      form.reset();
      if (myEmail) email.value = myEmail;
      showAlert('Message sent', `Thanks for reaching out. We'll reply to ${sentTo}.`); // 닫힐 때까지 기다리지 않음 — 버튼은 바로 다시 켬
    } catch (err) {
      if (err.status === 429) {
        const wait = err.details && err.details.retry_after ? err.details.retry_after : 600;
        const minutes = Math.ceil(wait / 60);
        showAlert(
          'Too many messages',
          `Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
          { tone: 'error' },
        );
      } else {
        showAlert("Couldn't send your message", err.message, { tone: 'error' });
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

/**
 * 공지 날짜 글자 (카드, 모달에서 같이 씀)
 * - 서버의 시각은 UTC 이고 시간대 표시가 없어서(`2026-10-12T22:06:57.448000`) 끝에 Z 를 붙여 읽음
 *   → 이 컴퓨터의 시간대 날짜로 '2026.10.12' (화면 글자), '2026-10-12' (<time datetime>)
 * - 읽을 수 없는 값이면 둘 다 빈 글자
 * (구현: AI — 2026-10-13, P1-23, 함수 하나씩 검토)
 * @param {string} isoTime
 * @returns {{ label: string, iso: string }}
 */
export function formatNoteDate(isoTime) {
  const hasZone = /[zZ]$|[+-]\d\d:\d\d$/.test(isoTime);
  const date = new Date(hasZone ? isoTime : isoTime + 'Z');
  if (isNaN(date.getTime())) return { label: '', iso: '' };
  const pad = function (n) { return n < 10 ? '0' + n : String(n); };
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return { label: y + '.' + m + '.' + d, iso: y + '-' + m + '-' + d };
}

/**
 * Development 공지: GET /api/v1/dev-notes?limit=4 로 최신 4개를 받아 .dev-notes 를 채움
 * - 로그인 없이 읽는 API 라서 토큰을 붙이지 않음 (auth: false)
 * - 칸마다 li.dev-note > time(날짜) · h3.dev-note__title(제목) · p.dev-note__excerpt(요약)
 * - 글자는 textContent 로만 넣음 (제목, 요약에 <b> 같은 글자가 있어도 태그로 해석되지 않게)
 * - 공지가 하나도 없으면 안내 문구('No notes yet…'), 불러오지 못하면 'Notes are unavailable…'
 *   두 경우 모두 + View More 는 숨김 (HTML 에 예시 문구를 두지 않음 — 가짜 공지가 보이지 않게)
 * - 오류를 밖으로 던지지 않음 (홈의 나머지 동작이 멈추지 않게), 다시 불러도 같은 결과(목록을 비우고 다시 그림)
 * (구현: AI — 2026-10-13, P1-23, 함수 하나씩 검토)
 * @returns {Promise<void>}
 */
export async function loadDevNotes() {
  const list = document.getElementById('dev-notes');
  const empty = document.getElementById('dev-notes-empty');
  const more = document.getElementById('dev-notes-more');
  if (!list) return;

  const showMessage = function (text) {
    list.textContent = '';
    if (more) more.hidden = true;
    if (empty) {
      empty.textContent = text;
      empty.hidden = false;
    }
  };

  let data = null;
  try {
    data = await api.get('/dev-notes?limit=4', { auth: false });
  } catch (err) {
    showMessage('Notes are unavailable right now. Please try again later.');
    return;
  }
  const items = data && Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    showMessage('No notes yet. Check back soon.');
    return;
  }

  list.textContent = '';
  for (const note of items) {
    const when = formatNoteDate(note.published_at);
    const item = document.createElement('li');
    item.className = 'dev-note';
    const time = document.createElement('time');
    if (when.iso) time.setAttribute('datetime', when.iso);
    time.textContent = when.label;
    const title = document.createElement('h3');
    title.className = 'dev-note__title';
    title.textContent = note.title;
    const excerpt = document.createElement('p');
    excerpt.className = 'dev-note__excerpt';
    excerpt.textContent = note.summary;
    item.appendChild(time);
    item.appendChild(title);
    item.appendChild(excerpt);
    list.appendChild(item);
  }
  if (empty) empty.hidden = true;
  if (more) more.hidden = false;
}

/**
 * 공지 모달 (+ View More): 목록 화면과 상세 화면을 번갈아 보여 줌 (PRD 01 FR-114)
 * - + View More 를 누를 때마다 GET /dev-notes?limit=50 으로 목록을 새로 불러 보여 줌 (새 공지가 반영되게)
 *   (모달 자체는 버튼의 command="show-modal" 이 엶 — 여기서는 열릴 때 목록만 채움)
 * - 목록: 날짜 + 제목 한 줄씩. 하나를 누르면 GET /dev-notes/{id} 로 본문을 받아 상세 화면으로 바꿈
 *   · 본문(Markdown)은 core/markdown.js markdownToFragment 로만 넣음 (안전 처리가 그 안에 있음)
 *   · Back to list 로 목록 화면으로 돌아감 (목록은 다시 부르지 않음, 방금 누른 공지에 포커스)
 * - 공지가 없거나 불러오지 못하면 97 과 같은 방식의 안내 문구, 상세에서 404(그 사이 비공개, 삭제)면
 *   'This note is no longer available.' 와 Back to list
 * - 응답이 늦게 와도 마지막에 누른 것만 화면에 반영 (번호표 requestId 로 늦게 온 응답은 버림)
 * - 모달을 닫으면 다음에 열 때 항상 목록 화면부터 (닫힐 때 목록 화면으로 되돌림)
 * - 글자는 textContent 로만 넣음 (제목 등), 두 번 호출해도 처리기가 겹치지 않게 onclick 하나만 씀
 * (구현: AI — 2026-10-13, P1-23, 함수 하나씩 검토)
 */
export function initDevNotesModal() {
  const modal = document.getElementById('dev-notes-modal');
  const more = document.querySelector('#dev-notes-more button');
  const listView = document.getElementById('note-list-view');
  const detailView = document.getElementById('note-detail-view');
  const list = document.getElementById('note-list');
  const listEmpty = document.getElementById('note-list-empty');
  const back = document.getElementById('note-back');
  const title = document.getElementById('note-detail-title');
  const date = document.getElementById('note-detail-date');
  const body = document.getElementById('note-detail-body');
  const detailEmpty = document.getElementById('note-detail-empty');
  if (!modal || !list || !listView || !detailView) return;

  let requestId = 0;      // 요청마다 번호를 올려서, 늦게 온 이전 응답을 버림
  let lastOpenedId = null; // Back to list 때 포커스를 돌려줄 공지

  const showList = function () {
    requestId += 1;
    detailView.hidden = true;
    listView.hidden = false;
    if (lastOpenedId !== null) {
      const item = list.querySelector('[data-note-id="' + lastOpenedId + '"]');
      if (item) item.focus();
    }
  };

  const showListMessage = function (text) {
    list.textContent = '';
    listEmpty.textContent = text;
    listEmpty.hidden = false;
  };

  const openNote = async function (noteId) {
    requestId += 1;
    const mine = requestId;
    lastOpenedId = noteId;
    listView.hidden = true;
    detailView.hidden = false;
    title.textContent = 'Loading…';
    date.textContent = '';
    date.removeAttribute('datetime');
    body.textContent = '';
    detailEmpty.hidden = true;
    modal.querySelector('.modal__body').scrollTop = 0;
    back.focus();

    let note = null;
    let failure = '';
    try {
      note = await api.get('/dev-notes/' + encodeURIComponent(noteId), { auth: false });
    } catch (err) {
      failure = err && err.status === 404
        ? 'This note is no longer available.'
        : 'The note could not be loaded. Please try again later.';
    }
    if (mine !== requestId) return;  // 그 사이 다른 공지를 눌렀거나 목록으로 돌아감

    if (!note) {
      title.textContent = '';
      detailEmpty.textContent = failure;
      detailEmpty.hidden = false;
      return;
    }
    const when = formatNoteDate(note.published_at);
    title.textContent = note.title;
    date.textContent = when.label;
    if (when.iso) date.setAttribute('datetime', when.iso);
    body.textContent = '';
    body.appendChild(markdownToFragment(note.content));
    title.focus();
  };

  const loadList = async function () {
    requestId += 1;
    const mine = requestId;
    detailView.hidden = true;
    listView.hidden = false;
    listEmpty.hidden = true;
    list.textContent = '';
    lastOpenedId = null;

    let data = null;
    try {
      data = await api.get('/dev-notes?limit=50', { auth: false });
    } catch (err) {
      if (mine === requestId) showListMessage('Notes are unavailable right now. Please try again later.');
      return;
    }
    if (mine !== requestId) return;
    const items = data && Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
      showListMessage('No notes yet. Check back soon.');
      return;
    }
    for (const note of items) {
      const when = formatNoteDate(note.published_at);
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'note-list__item';
      button.setAttribute('data-note-id', String(note.note_id));
      const time = document.createElement('time');
      if (when.iso) time.setAttribute('datetime', when.iso);
      time.textContent = when.label;
      const name = document.createElement('span');
      name.className = 'note-list__title';
      name.textContent = note.title;
      button.appendChild(time);
      button.appendChild(name);
      row.appendChild(button);
      list.appendChild(row);
    }
  };

  list.onclick = function (event) {
    const button = event.target.closest('[data-note-id]');
    if (button) openNote(Number(button.getAttribute('data-note-id')));
  };
  back.onclick = showList;
  if (more) more.onclick = loadList;
  modal.onclose = function () {
    requestId += 1;           // 닫은 뒤에 도착하는 응답은 버림
    detailView.hidden = true;
    listView.hidden = false;
  };
}

/**
 * 로그인 모달 자동 열기 (PRD 01 FR-105)
 * - core/auth.js 의 parseLoginHash() 로 { open, next } 를 읽고, open 이면
 *   document.getElementById('login-modal').showModal()
 *   (로그인이 필요한 페이지가 home.html#login?next=myPage.html 로 보냄)
 * - next 값은 저장해 두었다가 로그인 성공 후 이동에 사용 (parseLoginHash 가 safeNextPath 로 검사함)
 * - 모달을 닫으면 주소의 #login 제거 (history.replaceState)
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * - next 는 따로 저장하지 않음 — 모달이 열려 있는 동안 주소에 #login?next= 가 남아 있고,
 *   로그인 성공 때 initLoginForm 이 parseLoginHash() 로 직접 읽음
 * - 페이지 안에서 주소가 #login 으로 바뀌어도(링크 클릭 등) 모달을 엶 (hashchange)
 */
export function initLoginModalFromHash() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;

  const openIfLoginHash = () => {
    if (parseLoginHash().open && !modal.open) modal.showModal();
  };

  modal.addEventListener('close', () => {
    if (location.hash.startsWith('#login')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  });
  window.addEventListener('hashchange', openIfLoginHash);
  openIfLoginHash();
}

// 공통 헤더·푸터·로그인 모달을 먼저 끼움 (static/partials/) — 아래 init 들은 그 요소를 찾으므로 순서 중요
await includePartials();

initIntro();
initAuthState();
initLoginModalFromHash();
// 로그인 성공 후: next 가 있으면 그 페이지로, 없으면 모달 닫고 <html data-auth="in"> (헤더 전환)
initLoginForm({ onSuccess: null });   // onSuccess 를 안 주면 기본 동작 (core/auth-ui.js 13): next 가 있으면 그 페이지로, 없으면 모달을 닫고 헤더 전환
initPasswordToggles();
initOAuthPlaceholders();
initSideNavActiveState();
initMobileMenuClose();
initContactForm();
initModalFallback();
initFormAlerts();   // 19 — 로그인 모달 · 문의 폼의 기본 말풍선 대신 알림창
loadDevNotes();
initDevNotesModal();
