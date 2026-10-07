// 알림 · 확인 · 입력창 — 브라우저 기본 창(alert · confirm · prompt · 입력칸 말풍선) 대신 SweetAlert2
// 쓰는 곳: home.html · join.html(로그인 모달), myProject.html, userInfo.html …
// 모양은 static/css/dialog.css (home.html 분위기: 먹색 면 · Unbounded 제목 · 모서리 0)
// 사용자 요청: frontend-reference/images/main page reference/sweetalert수정.pdf (2026-10-07)

import Swal from '../../vendor/sweetalert2/sweetalert2.esm.min.js';

/**
 * 알림창 — 제목(큰 글씨) · 설명 · OK 버튼 하나
 * - 열린 <dialog> 모달(예: 로그인 모달)이 있으면 그 안에 띄움 — 모달 밖은 눌리지 않는 상태라서
 * - 설명은 글자 그대로 넣음 (HTML 로 해석하지 않음)
 * - 닫히면 열기 전에 커서가 있던 곳으로 돌아감
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * @param {string} title 큰 글씨 한 줄 (예: 'Check your email')
 * @param {string} [text] 설명 (예: 'Enter a valid email address.')
 * @param {{ tone?: 'info' | 'error', note?: string, confirmText?: string }} [options]
 *   tone 'error' 면 위쪽 선이 빨강 · note = 설명 아래 작은 글씨 한 줄 · confirmText = 버튼 글자 (기본 'OK')
 * @returns {Promise<void>} 창이 닫히면 끝남
 */
export async function showAlert(title, text, options = {}) {
  const tone = options.tone === 'error' ? 'error' : 'info';
  const openModal = document.querySelector('dialog[open]');
  let note;
  if (options.note) {
    note = document.createElement('span');
    note.textContent = options.note; // 글자 그대로 (footer 에 글자를 바로 주면 HTML 로 해석됨)
  }
  await Swal.fire({
    target: openModal || document.body,
    title: title,
    text: text || '',
    footer: note,
    confirmButtonText: options.confirmText || 'OK',
    buttonsStyling: false,          // 버튼 모양은 우리 .btn
    heightAuto: false,              // <html> · <body> 높이를 건드리지 않음
    scrollbarPadding: false,
    returnFocus: true,
    showClass: { popup: 'snx-dialog-in' },
    hideClass: { popup: 'snx-dialog-out' },
    customClass: {
      popup: 'snx-dialog snx-dialog--' + tone,
      title: 'snx-dialog__title',
      htmlContainer: 'snx-dialog__text',
      actions: 'snx-dialog__actions',
      footer: 'snx-dialog__note',
      confirmButton: 'btn btn--primary',
    },
  });
}

/**
 * 폼의 브라우저 기본 검사 말풍선("이 입력란을 작성하세요." 등) 대신 showAlert
 * - 보내기를 눌렀을 때 틀린 칸이 있으면: 말풍선을 막고 → 첫 번째 틀린 칸의 이유를 알림창으로 → 닫으면 그 칸에 커서
 * - 대상: novalidate 가 없는 폼 (로그인 모달, 문의, 새 프로젝트 …). join.html 처럼 칸 아래 문구를 쓰는 폼은 그대로
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * @param {ParentNode} [root=document]
 */
export function initFormAlerts(root = document) {
  for (const form of root.querySelectorAll('form:not([novalidate])')) {
    if (form.dataset.formAlerts === 'on') continue; // 두 번 연결하지 않음
    form.dataset.formAlerts = 'on';
    let showing = false;

    // 'invalid' 는 위로 퍼지지 않음 → 폼에서 잡으려면 capture(세 번째 인자 true)
    form.addEventListener('invalid', (event) => {
      event.preventDefault(); // 브라우저 말풍선 막기
      if (showing) return; // 한 번 보낼 때 틀린 칸마다 invalid 가 옴 → 첫 칸만 알림
      showing = true;
      const input = event.target;
      const message = alertMessageFor(input);
      input.focus(); // 먼저 커서를 옮김 → 알림창이 닫히면 이 칸으로 돌아옴 (showAlert 의 returnFocus)
      showAlert(message.title, message.text).then(() => {
        showing = false;
      });
    }, true);
  }
}

/** 틀린 칸 하나 → 알림창 제목 · 설명 (initFormAlerts 안에서만 씀) */
function alertMessageFor(input) {
  const label = input.labels && input.labels[0] ? input.labels[0].textContent.replace('*', '').replace(/\s+/g, ' ').trim().replace(/\.$/, '') : 'This field';
  const v = input.validity;
  if (v.valueMissing && input.type === 'checkbox') {
    return { title: 'Please confirm', text: `Check “${label}” to continue.` };
  }
  if (v.valueMissing) {
    return { title: `${label} is required`, text: 'Fill in this field to continue.' };
  }
  if (v.typeMismatch && input.type === 'email') {
    return { title: 'Check your email', text: 'Enter an email like you@example.com.' };
  }
  if (v.tooShort) {
    return { title: `Check ${label}`, text: `Use at least ${input.minLength} characters.` };
  }
  if (v.tooLong) {
    return { title: `Check ${label}`, text: `Use up to ${input.maxLength} characters.` };
  }
  if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch || v.badInput) {
    const range = input.min !== '' && input.max !== '' ? `Enter a number from ${input.min} to ${input.max}.` : 'Enter a valid number.';
    return { title: `Check ${label}`, text: range };
  }
  return { title: `Check ${label}`, text: 'Check this field and try again.' };
}

/**
 * 확인창 — 되돌릴 수 없는 일 전에 (window.confirm 대신, 목업 05 · 12)
 * - 버튼 두 개: 취소(왼쪽) · 확인(오른쪽). 휴대폰에서는 위아래로, 확인이 위 (dialog.css)
 * - danger 면 위쪽 선 · 확인 버튼이 빨강, 처음 커서는 **취소**에 (Enter 를 바로 눌러도 지워지지 않게)
 * - 열린 <dialog> 모달이 있으면 그 안에 띄움 (18 과 같은 이유)
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * @param {{ title: string, text?: string, confirmText?: string, cancelText?: string, danger?: boolean }} options
 * @returns {Promise<boolean>} 확인 = true, 취소 · Esc · 바깥 클릭 = false
 */
export async function confirmDialog(options) {
  const danger = options.danger === true;
  const openModal = document.querySelector('dialog[open]');
  const result = await Swal.fire({
    target: openModal || document.body,
    title: options.title,
    text: options.text || '',
    showCancelButton: true,
    confirmButtonText: options.confirmText || 'OK',
    cancelButtonText: options.cancelText || 'Cancel',
    reverseButtons: true,           // 취소 · 확인 순서 (확인이 오른쪽)
    focusCancel: danger,
    buttonsStyling: false,
    heightAuto: false,
    scrollbarPadding: false,
    returnFocus: true,
    showClass: { popup: 'snx-dialog-in' },
    hideClass: { popup: 'snx-dialog-out' },
    customClass: {
      popup: 'snx-dialog snx-dialog--' + (danger ? 'danger' : 'info'),
      title: 'snx-dialog__title',
      htmlContainer: 'snx-dialog__text',
      actions: 'snx-dialog__actions',
      confirmButton: danger ? 'btn btn--danger' : 'btn btn--primary',
      cancelButton: 'btn btn--ghost',
    },
  });
  return result.isConfirmed === true;
}

/**
 * 입력창 — 칸 하나를 받을 때 (window.prompt 대신, 목업 08 · 14: 회원 탈퇴 비밀번호)
 * - 비운 채 확인 → 창 안에 requiredMessage (닫히지 않음)
 * - check 가 있으면 확인을 누를 때 불러서, 문구를 돌려주면 창 안에 보여 주고 닫지 않음
 *   (예: 서버가 "비밀번호 틀림" → 창을 다시 열 필요 없이 바로 다시 입력)
 * - 버튼 · danger · 열린 모달 처리는 20 confirmDialog 와 같음. 처음 커서는 입력칸
 * (구현: AI — 2026-10-07, 함수 하나씩 검토)
 * @param {{ title: string, text?: string, inputType?: 'text' | 'password', value?: string, placeholder?: string,
 *   maxLength?: number, confirmText?: string, cancelText?: string, danger?: boolean, requiredMessage?: string,
 *   check?: (value: string) => Promise<string | null> }} options
 * @returns {Promise<string | null>} 입력한 값 (text 는 앞뒤 공백 제거, password 는 그대로), 취소면 null
 */
export async function promptDialog(options) {
  const danger = options.danger === true;
  const isPassword = options.inputType === 'password';
  const clean = (value) => (isPassword ? value : value.trim()); // 비밀번호의 공백도 비밀번호의 일부
  const openModal = document.querySelector('dialog[open]');
  const attributes = { 'aria-label': options.placeholder || options.title };
  if (options.maxLength) attributes.maxlength = String(options.maxLength);
  if (isPassword) attributes.autocomplete = 'current-password';

  const result = await Swal.fire({
    target: openModal || document.body,
    title: options.title,
    text: options.text || '',
    input: isPassword ? 'password' : 'text',
    inputValue: options.value || '',
    inputPlaceholder: options.placeholder || '',
    inputAttributes: attributes,
    inputAutoTrim: false,           // 라이브러리는 기본으로 앞뒤 공백을 지움 → 비밀번호가 바뀌므로 끄고 clean 으로
    inputValidator: (value) => (clean(value) === '' ? (options.requiredMessage || 'Fill in this field.') : null),
    preConfirm: async (value) => {
      if (!options.check) return clean(value);
      // 확인 중에는 취소 못 함 — 서버가 이미 처리하는데 화면만 "취소" 가 되지 않게 (탈퇴)
      Swal.getCancelButton().disabled = true;
      let message;
      try {
        message = await options.check(clean(value));
      } catch (err) {
        message = err.message || 'Something went wrong. Please try again.';
      }
      Swal.getCancelButton().disabled = false;
      if (message) {
        Swal.showValidationMessage(message); // 창 안 빨간 글, 닫지 않음
        return false;
      }
      return clean(value);
    },
    showLoaderOnConfirm: true,      // check 를 기다리는 동안 버튼 자리에 도는 표시
    allowEscapeKey: () => !Swal.isLoading(),    // 확인 중에는 Esc · 바깥 클릭으로도 닫히지 않음
    allowOutsideClick: () => !Swal.isLoading(),
    showCancelButton: true,
    confirmButtonText: options.confirmText || 'OK',
    cancelButtonText: options.cancelText || 'Cancel',
    reverseButtons: true,
    buttonsStyling: false,
    heightAuto: false,
    scrollbarPadding: false,
    returnFocus: true,
    showClass: { popup: 'snx-dialog-in' },
    hideClass: { popup: 'snx-dialog-out' },
    customClass: {
      popup: 'snx-dialog snx-dialog--' + (danger ? 'danger' : 'info'),
      title: 'snx-dialog__title',
      htmlContainer: 'snx-dialog__text',
      input: 'snx-dialog__input',
      actions: 'snx-dialog__actions',
      loader: 'snx-dialog__loader',
      confirmButton: danger ? 'btn btn--danger' : 'btn btn--primary',
      cancelButton: 'btn btn--ghost',
    },
  });
  return result.isConfirmed ? result.value : null;
}
