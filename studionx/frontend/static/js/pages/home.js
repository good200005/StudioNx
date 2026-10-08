// home.html 페이지 스크립트 (템플릿 — 구현은 직접)
// 지금 동작은 CSS만으로 됨: 앵커 부드러운 스크롤(scroll-behavior), 세로 앵커 표시(position: sticky),
// 모바일 메뉴(<details>). 아래는 다음에 붙일 동작의 자리입니다.

import { initAuthState, initLoginForm, initPasswordToggles, initOAuthPlaceholders } from '../core/auth-ui.js';
import { initModalFallback } from '../core/modal.js';
import { includePartials } from '../core/include.js';
import { parseLoginHash, isLoggedIn } from '../core/auth.js';
import { initFormAlerts, showAlert } from '../core/dialog.js';
import { api } from '../core/api.js';

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
  // TODO
}

/**
 * 세로 앵커(S·Ch·F·D·Co)에서 지금 보고 있는 섹션 표시
 * - IntersectionObserver 로 화면 가운데에 들어온 section 을 찾고
 * - 해당 .side-nav__link 에 aria-current="true" 설정 (CSS가 보라색으로 표시)
 */
export function initSideNavActiveState() {
  // TODO
}

/**
 * 모바일 메뉴: 링크를 누르면 <details class="menu"> 닫기
 */
export function initMobileMenuClose() {
  // TODO
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
 * Development 공지: GET /api/v1/dev-notes?limit=4 로 최신 4개를 받아 .dev-notes 를 채움
 * (지금 HTML의 4개는 예시 문구)
 */
export function loadDevNotes() {
  // TODO
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
initLoginForm({ onSuccess: null /* TODO: (next) => ... */ });
initPasswordToggles();
initOAuthPlaceholders();
initSideNavActiveState();
initMobileMenuClose();
initContactForm();
initModalFallback();
initFormAlerts();   // 19 — 로그인 모달 · 문의 폼의 기본 말풍선 대신 알림창
loadDevNotes();
