// 로그인 모달의 계정 찾기 화면 (P1-28, FR-118~119)
// 같은 모달(#login-modal) 안에서 로그인 화면(data-view="login")과 복구 화면(data-view="recover")이 바뀜.
// 화면 구조: static/partials/login-modal.html, 설명: docs/ai-notes/70_p1-28_account_recovery_ui.md
// 함수를 하나씩 만들어 가는 중: showView, selectTab, initRecoverTabs, initRecover, initRecoverFromHash, showSentView, initRecoverForms → (send again 잠금)

import { api } from './api.js';

/** 모달 안의 화면 이름 */
export const RECOVER_VIEWS = ['login', 'recover'];

/** 복구 화면의 탭 이름 (탭 id = recover-tab-<이름>, 패널 id = recover-panel-<이름>) */
export const RECOVER_TABS = ['password', 'email'];

/**
 * 모달 안에서 보여 줄 화면을 바꿈 (로그인 화면 ⇄ 복구 화면)
 * - name 의 [data-view] 만 보이고 나머지는 숨김 (hidden 속성)
 * - 모달 제목(#login-modal-title)을 그 화면의 글자로 바꿈: data-title-<name> 속성 (없으면 그대로)
 * - 화면이 바뀌면 그 화면에서 보이는 첫 입력칸으로 커서를 옮김 (키보드와 화면 낭독기 사용자가 위치를 잃지 않게)
 * - 모르는 화면 이름이거나 모달이 없으면 아무것도 바꾸지 않고 false
 * - 이미 그 화면이면 다시 그려도 같은 결과 (두 번 불러도 안전)
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @param {HTMLElement|null} modal  #login-modal
 * @param {'login'|'recover'} name
 * @returns {boolean} 바꿨으면(또는 이미 그 화면이면) true
 */
export function showView(modal, name) {
  if (!modal || RECOVER_VIEWS.indexOf(name) < 0) return false;
  const views = modal.querySelectorAll('[data-view]');
  if (views.length === 0) return false;

  let shown = null;
  for (const view of views) {
    const on = view.getAttribute('data-view') === name;
    view.hidden = !on;
    if (on) shown = view;
  }
  if (shown === null) return false;

  const title = modal.querySelector('#login-modal-title');
  const text = title ? title.getAttribute('data-title-' + name) : null;
  if (title && text !== null) title.textContent = text;

  // 보이는 첫 입력칸 (hidden 인 패널 안의 칸은 건너뜀)
  const inputs = shown.querySelectorAll('input:not([type="hidden"]):not([disabled])');
  for (const input of inputs) {
    if (input.closest('[hidden]') === null) {
      input.focus();
      break;
    }
  }
  return true;
}

/**
 * 복구 화면의 탭을 고름 (Password ⇄ Email)
 * - 고른 탭만 aria-selected="true" + tabindex="0", 나머지는 "false" + "-1"
 *   (탭 목록에서는 Tab 키가 선택된 탭 하나에만 멈추고 나머지는 화살표 키로 옮기는 방식, WAI-ARIA 탭 패턴)
 * - 짝이 되는 패널(recover-panel-<이름>)만 보이고 나머지는 숨김
 * - 입력칸의 값과 오류 문구는 건드리지 않음: 탭을 오가도 적던 이메일이 남음
 * - focus 가 true 이면 고른 탭으로 커서를 옮김 (키보드로 옮길 때 쓰고, 클릭은 브라우저가 이미 커서를 줌)
 * - 숨겨질 패널 안의 칸에 커서가 있었으면 focus 와 관계없이 고른 탭으로 옮김 (커서가 사라지지 않게)
 * - 모르는 이름이거나 모달이 없거나 탭, 패널이 없으면 아무것도 바꾸지 않고 false
 * - 이미 그 탭이면 다시 불러도 같은 결과
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @param {HTMLElement|null} modal  #login-modal
 * @param {'password'|'email'} name
 * @param {boolean} [focus=false]
 * @returns {boolean}
 */
export function selectTab(modal, name, focus) {
  if (!modal || RECOVER_TABS.indexOf(name) < 0) return false;
  const tabs = modal.querySelectorAll('[role="tab"]');
  const panels = modal.querySelectorAll('[role="tabpanel"]');
  const tabId = 'recover-tab-' + name;
  const panelId = 'recover-panel-' + name;

  let chosen = null;
  let chosenPanel = null;
  for (const tab of tabs) if (tab.id === tabId) chosen = tab;
  for (const panel of panels) if (panel.id === panelId) chosenPanel = panel;
  if (chosen === null || chosenPanel === null) return false;

  for (const tab of tabs) {
    const on = tab === chosen;
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
    tab.setAttribute('tabindex', on ? '0' : '-1');
  }
  // 커서가 곧 숨겨질 패널 안의 칸에 있으면 탭으로 옮김: 숨은 칸에서는 브라우저가 커서를 빼앗아 body 로 가 버려서
  // 키보드 사용자가 위치를 잃는다
  const active = document.activeElement;
  let lostFocus = false;
  for (const panel of panels) {
    if (panel !== chosenPanel && active && panel.contains(active)) lostFocus = true;
    panel.hidden = panel !== chosenPanel;
  }
  if (focus === true || lostFocus) chosen.focus();
  return true;
}

/** 탭 버튼 → 탭 이름 (id 가 recover-tab-<이름> 이 아니면 null) */
function tabNameOf(tab) {
  const prefix = 'recover-tab-';
  if (!tab || typeof tab.id !== 'string' || tab.id.indexOf(prefix) !== 0) return null;
  const name = tab.id.slice(prefix.length);
  return RECOVER_TABS.indexOf(name) < 0 ? null : name;
}

/**
 * 복구 화면의 탭 목록에 클릭과 키보드 이동을 연결
 * - 탭을 누르면 그 탭을 고름
 * - 키보드(탭에 커서가 있을 때): 오른쪽 화살표 = 다음 탭, 왼쪽 화살표 = 이전 탭(끝에서 처음으로 이어짐),
 *   Home = 첫 탭, End = 마지막 탭. 옮기면 바로 그 탭을 고르고 커서도 따라감 (WAI-ARIA 탭 패턴의 자동 선택)
 * - 처리한 키만 기본 동작(스크롤 등)을 막음. Ctrl, Alt, Meta, Shift 를 함께 누르면 처리하지 않음
 *   (브라우저, 화면 낭독기의 단축키를 가로채지 않게)
 * - 두 번 불러도 처리기가 겹치지 않음 (onclick, onkeydown 에 대입)
 * - 모달이나 탭 목록이 없으면 아무것도 연결하지 않고 false
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @param {HTMLElement|null} modal  #login-modal
 * @returns {boolean} 연결했으면 true
 */
export function initRecoverTabs(modal) {
  if (!modal) return false;
  const list = modal.querySelector('[role="tablist"]');
  if (!list) return false;

  list.onclick = function (event) {
    const tab = event.target && event.target.closest ? event.target.closest('[role="tab"]') : null;
    const name = tabNameOf(tab);
    if (name !== null) selectTab(modal, name);
  };

  list.onkeydown = function (event) {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const key = event.key;
    if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;
    const current = event.target && event.target.closest ? event.target.closest('[role="tab"]') : null;
    if (tabNameOf(current) === null) return;

    const names = [];
    list.querySelectorAll('[role="tab"]').forEach(function (tab) {
      if (tabNameOf(tab) !== null) names.push(tabNameOf(tab));
    });
    let index = names.indexOf(tabNameOf(current));
    if (key === 'ArrowRight') index = (index + 1) % names.length;
    else if (key === 'ArrowLeft') index = (index - 1 + names.length) % names.length;
    else if (key === 'Home') index = 0;
    else index = names.length - 1;

    event.preventDefault();
    selectTab(modal, names[index], true);
  };
  return true;
}

/**
 * 복구 화면 안의 상태를 처음으로 되돌림 (이 파일 안에서만 씀)
 * - Password 탭 선택, 탭 목록과 "Back to Sign In" 줄 보임, 보낸 뒤 화면 숨김
 * - 입력칸 비움(이메일은 개인정보라 남기지 않음), 오류 문구 숨김, 보낸 뒤 화면의 이메일 글자 비움
 */
function resetRecoverState(modal) {
  const recover = modal.querySelector('[data-view="recover"]');
  if (!recover) return;
  stopResendCooldown(modal);   // send again 의 기다림도 처음으로 (다음에 보낼 때 새로 셈)
  modal.recoverEpoch = (modal.recoverEpoch || 0) + 1;   // 화면을 처음으로 돌릴 때마다 올림: 그 전에 보낸 요청의 늦은 응답은 버림
  modal.recoverLast = null;   // 마지막으로 보낸 이메일도 남기지 않음
  // 아직 오지 않은 옛 요청 때문에 새 전송이 막히지 않게 "보내는 중" 표시를 풂
  for (const form of recover.querySelectorAll('form')) {
    form.removeAttribute('data-busy');
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = false;
  }
  const resend = recover.querySelector('#recover-resend');
  if (resend) resend.removeAttribute('data-busy');
  const tabs = recover.querySelector('[role="tablist"]');
  const sent = recover.querySelector('#recover-sent');
  const backRow = recover.querySelector('#recover-back-row');
  if (tabs) tabs.hidden = false;
  if (backRow) backRow.hidden = false;
  if (sent) sent.hidden = true;
  selectTab(modal, 'password');
  for (const input of recover.querySelectorAll('input')) input.value = '';
  for (const error of recover.querySelectorAll('.form-error')) {
    error.textContent = '';
    error.hidden = true;
  }
  const shown = recover.querySelector('#recover-sent-email');
  if (shown) shown.textContent = '';
}

/**
 * 로그인 모달의 계정 찾기 화면을 연결 (P1-28)
 * - "Can't sign in?" (#login-recover): 복구 화면을 엶 (처음 상태, Password 탭)
 * - "Back to Sign In" (#recover-back, #recover-sent-back): 로그인 화면으로 돌아옴 (복구 화면 상태는 비움)
 * - 모달을 닫으면 로그인 화면으로 되돌리고 복구 화면 상태를 비움: 다음에 열면 항상 로그인 화면부터
 * - 탭 클릭과 키보드 이동도 여기서 연결 (initRecoverTabs)
 * - 두 번 불러도 처리기가 겹치지 않음 (onclick 대입, close 처리기는 이전 것을 떼고 다시 닮)
 * - 복구 화면이 없는 모달이면 아무것도 연결하지 않고 false
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @param {HTMLElement|null} modal  #login-modal
 * @returns {boolean} 연결했으면 true
 */
export function initRecover(modal) {
  if (!modal || !modal.querySelector('[data-view="recover"]')) return false;

  const open = modal.querySelector('#login-recover');
  if (open) {
    open.onclick = function () {
      resetRecoverState(modal);
      showView(modal, 'recover');
    };
  }
  for (const id of ['recover-back', 'recover-sent-back']) {
    const back = modal.querySelector('#' + id);
    if (back) {
      back.onclick = function () {
        resetRecoverState(modal);
        showView(modal, 'login');
      };
    }
  }

  if (modal.recoverOnClose) modal.removeEventListener('close', modal.recoverOnClose);
  modal.recoverOnClose = function () {
    resetRecoverState(modal);
    showView(modal, 'login');
  };
  modal.addEventListener('close', modal.recoverOnClose);

  initRecoverTabs(modal);
  return true;
}

/**
 * 주소가 #recover 이면 복구 화면이 열린 모달을 보여 줌 (P1-28, FR-119)
 * - 이메일 안내 메일의 "Reset password" 버튼이 home.html#recover 를 가리킴. 로그인 모달의 #login 과 같은 방식
 * - 지금 주소가 정확히 "#recover" 이면 모달을 열고(이미 열려 있으면 그대로) 복구 화면(처음 상태, Password 탭)을 보여 줌
 *   "#recovery" 같은 다른 해시, "#login", 해시 없음은 아무것도 하지 않음
 * - 이 함수를 부를 때 한 번 확인하고, 페이지 안에서 주소가 바뀌어도(링크 클릭 등) 다시 확인함 (hashchange)
 * - 모달을 닫으면 주소의 #recover 를 지움 (history.replaceState): 새로 고침하면 다시 열리는 일을 막음.
 *   다른 해시(#feature 등)로 바뀐 뒤 닫으면 그 해시는 지우지 않음
 * - 두 번 불러도 처리기가 겹치지 않음 (이전 처리기를 떼고 다시 닮)
 * - 모달이 없거나 복구 화면이 없으면 아무것도 연결하지 않고 false
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @param {HTMLElement|null} modal  #login-modal
 * @returns {boolean} 연결했으면 true
 */
export function initRecoverFromHash(modal) {
  if (!modal || !modal.querySelector('[data-view="recover"]')) return false;

  if (modal.recoverHashHandler) window.removeEventListener('hashchange', modal.recoverHashHandler);
  if (modal.recoverHashOnClose) modal.removeEventListener('close', modal.recoverHashOnClose);

  const openIfRecoverHash = function () {
    if (location.hash !== '#recover') return;
    if (!modal.open) modal.showModal();
    resetRecoverState(modal);
    showView(modal, 'recover');
  };
  modal.recoverHashHandler = openIfRecoverHash;
  modal.recoverHashOnClose = function () {
    if (location.hash === '#recover') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  };

  window.addEventListener('hashchange', openIfRecoverHash);
  modal.addEventListener('close', modal.recoverHashOnClose);
  openIfRecoverHash();
  return true;
}

/** 보낸 뒤 화면의 보충 문장 (요청 종류별) */
const SENT_DETAIL = {
  password: 'The link works for 30 minutes.',
  email: "If you don't see it, check your spam folder.",
};

/**
 * "메일을 보냈다" 화면을 보여 줌 (P1-28, FR-118~119)
 * - 복구 화면 안에서 탭 목록, 두 패널, "Back to Sign In" 줄을 숨기고 #recover-sent 를 보임
 * - 입력한 이메일을 #recover-sent-email 에 **글자로** 넣음 (textContent: 이메일에 <, & 가 있어도 마크업이 되지 않음)
 * - 보충 문장(#recover-sent-detail): password 는 "링크는 30분 동안 유효", email 은 "스팸함을 확인"
 * - 문구는 가입 여부와 관계없이 같다: "있다면 보냈다" (서버 응답도 항상 같음)
 * - 모달이 로그인 화면이었어도 복구 화면으로 바꾸고, 커서는 "Back to Sign In" 버튼으로 옮김
 *   (입력칸은 숨었으므로 키보드와 화면 낭독기 사용자가 위치를 잃지 않게)
 * - 이미 이 화면이어도 다시 불러도 같은 결과(이메일 글자만 갱신)
 * - 모르는 kind, 모달이나 복구 화면이 없음, 보낸 뒤 화면이 없으면 아무것도 바꾸지 않고 false
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @param {HTMLElement|null} modal  #login-modal
 * @param {'password'|'email'} kind  어느 탭에서 보냈는지
 * @param {string} email  사용자가 입력한 이메일 (문자열이 아니면 빈 글자)
 * @returns {boolean}
 */
export function showSentView(modal, kind, email) {
  if (!modal || RECOVER_TABS.indexOf(kind) < 0) return false;
  const recover = modal.querySelector('[data-view="recover"]');
  const sent = modal.querySelector('#recover-sent');
  if (!recover || !sent) return false;

  const tabs = recover.querySelector('[role="tablist"]');
  const backRow = recover.querySelector('#recover-back-row');
  if (tabs) tabs.hidden = true;
  for (const panel of recover.querySelectorAll('[role="tabpanel"]')) panel.hidden = true;
  if (backRow) backRow.hidden = true;
  sent.hidden = false;

  const shown = sent.querySelector('#recover-sent-email');
  if (shown) shown.textContent = typeof email === 'string' ? email : '';
  const detail = sent.querySelector('#recover-sent-detail');
  if (detail) detail.textContent = SENT_DETAIL[kind];

  showView(modal, 'recover');
  const back = sent.querySelector('#recover-sent-back');
  if (back) back.focus();
  return true;
}

/** 요청 종류별 폼, 오류 문구 자리, API 주소 */
const RECOVER_FORMS = [
  { kind: 'password', formId: 'recover-password-form', errorId: 'recover-password-error', path: '/auth/password-reset/request' },
  { kind: 'email', formId: 'recover-email-form', errorId: 'recover-email-error', path: '/auth/email-reminder/request' },
];

/**
 * 요청 실패를 사용자에게 보여 줄 문구로 바꿈 (이 파일 안에서만 씀)
 * - 서버가 보낸 문구는 그대로 보여 주지 않음: 내부 사정이 새거나 가입 여부를 짐작하게 할 수 있음
 * - 429: "N분 뒤에" (retry_after 초를 올림, 없으면 10분), 422: 이메일 확인, 연결 실패: 연결 확인, 그 밖: 일반 문구
 */
function recoverErrorText(err) {
  const status = err && typeof err.status === 'number' ? err.status : -1;
  if (status === 429) {
    const wait = err.details && typeof err.details.retry_after === 'number' ? err.details.retry_after : 600;
    const minutes = Math.max(1, Math.ceil(wait / 60));
    return 'Too many requests. Please try again in ' + minutes + ' minute' + (minutes === 1 ? '' : 's') + '.';
  }
  if (status === 422) return 'Please enter a valid email address.';
  if (status === 0) return "Can't reach the server. Check your connection and try again.";
  return 'Something went wrong. Please try again.';
}

/**
 * 복구 화면의 두 폼(Password, Email 탭) 전송을 연결 (P1-28, FR-118~119)
 * - 전송하면 이메일(앞뒤 공백 제거)을 API 로 보냄: Password 탭 = POST /auth/password-reset/request,
 *   Email 탭 = POST /auth/email-reminder/request
 * - 성공하면 보낸 뒤 화면(showSentView). 서버 응답은 가입 여부와 관계없이 같으므로 화면도 같음.
 *   성공한 요청의 종류와 이메일을 modal.recoverLast 에 남김 ("send again" 이 다시 보낼 때 씀)
 * - 실패하면 폼 아래에 문구를 보이고 입력칸으로 커서를 돌려줌 (recoverErrorText: 429 는 몇 분 뒤인지, 422 는 이메일 확인,
 *   연결 실패, 그 밖). 서버가 보낸 문구는 그대로 보여 주지 않음
 * - 보내는 동안 버튼을 잠그고 같은 폼의 두 번째 전송은 무시 (연속 클릭으로 메일이 두 통 가지 않게). 끝나면 풀음
 * - 기다리는 사이 화면을 떠나거나(Back to Sign In) 모달을 닫으면(resetRecoverState 가 recoverEpoch 를 올림)
 *   그 요청의 늦은 응답은 버림: 닫힌 모달에 보낸 뒤 화면이 나타나거나 새 요청의 결과를 덮어쓰지 않게
 * - 새로 전송하면 이전 오류 문구를 지움. 입력칸에 다시 적기 시작하면 오류 표시(aria-invalid)도 풂
 * - 브라우저의 이메일 형식 검사를 통과해야 전송됨 (틀리면 initFormAlerts 가 알림창, 이 처리기는 안 불림)
 * - 두 번 불러도 처리기가 겹치지 않음 (onsubmit, oninput 대입)
 * - 폼이 하나도 없으면 아무것도 연결하지 않고 false
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @param {HTMLElement|null} modal  #login-modal
 * @returns {boolean} 하나라도 연결했으면 true
 */
export function initRecoverForms(modal) {
  if (!modal) return false;
  let wired = false;

  for (const spec of RECOVER_FORMS) {
    const form = modal.querySelector('#' + spec.formId);
    if (!form) continue;
    const input = form.querySelector('input[name="email"]');
    const button = form.querySelector('button[type="submit"]');
    const errorBox = modal.querySelector('#' + spec.errorId);
    if (!input) continue;
    wired = true;

    const clearError = function () {
      if (errorBox) {
        errorBox.textContent = '';
        errorBox.hidden = true;
      }
      input.removeAttribute('aria-invalid');
    };

    input.oninput = clearError;
    form.onsubmit = async function (event) {
      event.preventDefault();
      if (form.getAttribute('data-busy') === 'true') return;
      form.setAttribute('data-busy', 'true');
      if (button) button.disabled = true;
      clearError();

      const email = input.value.trim();
      const epoch = modal.recoverEpoch || 0;
      try {
        await api.post(spec.path, { email: email });
        if ((modal.recoverEpoch || 0) !== epoch) return;   // 기다리는 사이 화면을 떠났거나 모달을 닫음: 늦은 응답은 버림
        modal.recoverLast = { kind: spec.kind, email: email };
        showSentView(modal, spec.kind, email);
        startResendCooldown(modal);   // send again 은 1분 뒤에 켜짐
      } catch (err) {
        if ((modal.recoverEpoch || 0) !== epoch) return;
        if (errorBox) {
          errorBox.textContent = recoverErrorText(err);
          errorBox.hidden = false;
        }
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      } finally {
        if ((modal.recoverEpoch || 0) === epoch) {   // 옛 요청의 끝이 새 요청의 잠금을 풀지 않게
          form.removeAttribute('data-busy');
          if (button) button.disabled = false;
        }
      }
    };
  }
  return wired;
}

/** "send again" 을 다시 누를 수 있게 되기까지의 기본 시간(초) */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * "send again" 의 기다리는 시간을 멈추고 처음 상태(잠김, 안내 글자 없음)로 되돌림
 * - 돌고 있는 타이머를 끊음 (화면을 떠나거나 모달을 닫을 때, 또 새로 시작하기 전에 부름)
 * - 버튼은 잠그고 "(available in …)" 글자는 비움
 * - 타이머가 없어도, 버튼이 없어도 오류 없음 (버튼이 없으면 false)
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @param {HTMLElement|null} modal  #login-modal
 * @returns {boolean} 버튼이 있어서 처음 상태로 되돌렸으면 true
 */
export function stopResendCooldown(modal) {
  if (!modal) return false;
  if (modal.recoverTimer) {
    window.clearInterval(modal.recoverTimer);
    modal.recoverTimer = null;
  }
  const button = modal.querySelector('#recover-resend');
  const note = modal.querySelector('#recover-resend-wait');
  if (note) note.textContent = '';
  if (!button) return false;
  button.disabled = true;
  return true;
}

/**
 * "send again" 을 잠그고 남은 시간을 세어 보여 주다가 0 이 되면 풀음 (P1-28, FR-118)
 * - 보낸 직후 시작: 버튼 잠금, 옆에 "(available in 58s)" 를 1초마다 갱신, 0 이 되면 글자를 지우고 버튼을 풀음
 * - 남은 시간은 끝나는 시각에서 지금 시각을 빼서 계산함(setInterval 의 횟수를 세지 않음):
 *   탭이 백그라운드에 있어 타이머가 느려져도 시간이 어긋나지 않음
 * - 이미 세는 중이면 처음부터 다시 셈 (다시 보낸 직후 또 1분)
 * - seconds 는 0 보다 큰 유한한 숫자여야 함 (생략하면 60초). 아니면 아무것도 바꾸지 않고 false
 * - 모달이나 버튼이 없으면 false
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @param {HTMLElement|null} modal  #login-modal
 * @param {number} [seconds=60]
 * @returns {boolean} 시작했으면 true
 */
export function startResendCooldown(modal, seconds) {
  const total = seconds === undefined ? RESEND_COOLDOWN_SECONDS : seconds;
  if (!modal || typeof total !== 'number' || !isFinite(total) || total <= 0) return false;
  const button = modal.querySelector('#recover-resend');
  const note = modal.querySelector('#recover-resend-wait');
  if (!button) return false;

  stopResendCooldown(modal);
  const endAt = Date.now() + total * 1000;

  const render = function () {
    const left = Math.ceil((endAt - Date.now()) / 1000);
    if (left <= 0) {
      stopResendCooldown(modal);
      button.disabled = false;   // stop 은 잠그므로 끝난 뒤에 풀음
      return;
    }
    if (note) note.textContent = '(available in ' + left + 's)';
  };

  button.disabled = true;
  render();
  modal.recoverTimer = window.setInterval(render, 1000);
  return true;
}

/**
 * "send again" 을 누르면 마지막으로 보낸 요청을 다시 보냄 (P1-28, FR-118~119)
 * - 다시 보낼 대상은 initRecoverForms 가 성공 때 남긴 modal.recoverLast ({ kind, email }): 같은 종류, 같은 이메일.
 *   남긴 것이 없으면(아직 보낸 적 없음) 아무것도 하지 않음
 * - 성공하면 보충 문장을 "We've sent it again. …" 로 바꾸고 새로 1분을 셈 (startResendCooldown)
 * - 실패하면 보낸 뒤 화면 안의 #recover-resend-error 에 문구를 보임 (recoverErrorText)
 *   · 429 면 서버가 알려 준 retry_after(초)만큼 다시 잠금: 서버의 한도가 풀리기 전에 또 누르게 하지 않음
 *   · 그 밖의 실패는 버튼을 풀어 다시 누를 수 있게 함
 * - 보내는 동안 버튼을 잠그고 같은 버튼의 두 번째 클릭은 무시 (data-busy)
 * - 두 번 불러도 처리기가 겹치지 않음 (onclick 대입)
 * - 버튼이 없으면 아무것도 연결하지 않고 false
 * (구현: AI — 2026-10-15, P1-28, 함수 하나씩 검토)
 * @param {HTMLElement|null} modal  #login-modal
 * @returns {boolean} 연결했으면 true
 */
export function initRecoverResend(modal) {
  if (!modal) return false;
  const button = modal.querySelector('#recover-resend');
  if (!button) return false;
  const errorBox = modal.querySelector('#recover-resend-error');

  button.onclick = async function () {
    const last = modal.recoverLast;
    if (!last || button.getAttribute('data-busy') === 'true') return;
    let spec = null;
    for (const candidate of RECOVER_FORMS) if (candidate.kind === last.kind) spec = candidate;
    if (spec === null) return;

    button.setAttribute('data-busy', 'true');
    button.disabled = true;
    const epoch = modal.recoverEpoch || 0;
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.hidden = true;
    }
    try {
      await api.post(spec.path, { email: last.email });
      if ((modal.recoverEpoch || 0) !== epoch) return;   // 기다리는 사이 화면을 떠남: 늦은 응답은 버림
      const detail = modal.querySelector('#recover-sent-detail');
      if (detail) detail.textContent = "We've sent it again. " + SENT_DETAIL[last.kind];
      startResendCooldown(modal);
    } catch (err) {
      if ((modal.recoverEpoch || 0) !== epoch) return;
      if (errorBox) {
        errorBox.textContent = recoverErrorText(err);
        errorBox.hidden = false;
      }
      const wait = err && err.status === 429 && err.details && typeof err.details.retry_after === 'number'
        ? err.details.retry_after
        : 0;
      if (wait > 0) startResendCooldown(modal, wait);
      else button.disabled = false;
    } finally {
      if ((modal.recoverEpoch || 0) === epoch) button.removeAttribute('data-busy');
    }
  };
  return true;
}
