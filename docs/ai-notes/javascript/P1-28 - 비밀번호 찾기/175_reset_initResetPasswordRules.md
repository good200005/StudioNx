# JS 175 — `initResetPasswordRules()` (규칙 표시와 확인 칸 일치)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/resetPassword.js` |
| 작업 | P1-28 비밀번호 재설정 화면: JS 두 번째 함수 |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 | [174 `readResetToken()`](174_reset_readResetToken.md) |
| 다음 | `initResetForm()` (전송, 성공, 무효 링크, 규칙 오류, 연결 실패) |

## 1. 하는 일
새 비밀번호 칸에 입력할 때마다 규칙 다섯 줄의 표시를 바꾸고, 확인 칸이 다르면 안내합니다. 가입 화면(`join.js`의 `initPasswordRules`)과 **같은 규칙, 같은 문구**를 씁니다(`core/password.js`를 함께 씁니다).

| 때 | 화면 |
|---|---|
| 규칙을 채운 줄 | 회색 ○ 가 초록 ✓ 로 바뀜(`is-met`) |
| 허용되지 않는 문자(한글, 공백 등) | `Use only English letters, numbers and symbols.` |
| 규칙이 하나라도 안 맞은 채 칸을 벗어남 | `Check the password requirements.` |
| 확인 칸이 다름(비밀번호만큼 다 쳤거나 칸을 벗어남) | `Passwords don't match.` |
| 확인 칸이 맞거나 비어 있음 | 안내를 지움 |

![무효 링크 화면(규칙 표시가 아닌 다른 상태)](../../images/p1-28_reset_invalid.png)

## 2. 코드
```js
export function initResetPasswordRules() {
  const password = document.getElementById('reset-password');
  const confirm = document.getElementById('reset-password2');
  const passwordField = document.getElementById('reset-password-field');
  const confirmField = document.getElementById('reset-password2-field');
  const items = document.querySelectorAll('#reset-password-rules li[data-rule]');
  if (!password || !confirm || !passwordField || !confirmField) return false;

  const allMet = function () {
    for (const name of Object.keys(PASSWORD_RULES)) {
      if (!PASSWORD_RULES[name](password.value)) return false;
    }
    return true;
  };

  const showRules = function () {
    for (const item of items) {
      const rule = PASSWORD_RULES[item.dataset.rule];
      const met = rule ? rule(password.value) : false;
      item.classList.toggle('is-met', met);
      const state = item.querySelector('[data-rule-state]');
      if (state) state.textContent = met ? ', met' : ', not met';
    }
  };

  const checkConfirm = function (force) {
    if (confirm.value === '') {
      setFieldState(confirmField, null);
    } else if (confirm.value === password.value) {
      setFieldState(confirmField, null);
    } else if (force || confirm.value.length >= password.value.length) {
      setFieldState(confirmField, 'error', "Passwords don't match.");
    }
  };

  password.oninput = function () {
    showRules();
    if (!PASSWORD_ALLOWED.test(password.value)) {
      setFieldState(passwordField, 'error', 'Use only English letters, numbers and symbols.');
    } else {
      setFieldState(passwordField, null);
    }
    if (confirm.value !== '') checkConfirm(true);
  };
  password.onblur = function () {
    if (password.value !== '' && PASSWORD_ALLOWED.test(password.value) && !allMet()) {
      setFieldState(passwordField, 'error', 'Check the password requirements.');
    }
  };
  confirm.oninput = function () { checkConfirm(false); };
  confirm.onblur = function () { checkConfirm(true); };
  showRules();
  return true;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const initResetPasswordRules = () => {
  const q = (id) => document.getElementById(id);
  const password = q('reset-password'), confirm = q('reset-password2');
  const passwordField = q('reset-password-field'), confirmField = q('reset-password2-field');
  const items = document.querySelectorAll('#reset-password-rules li[data-rule]');
  if (!password || !confirm || !passwordField || !confirmField) return false;

  const allMet = () => Object.values(PASSWORD_RULES).every((rule) => rule(password.value));
  const showRules = () => items.forEach((item) => {
    const met = PASSWORD_RULES[item.dataset.rule]?.(password.value) ?? false;
    item.classList.toggle('is-met', met);
    const state = item.querySelector('[data-rule-state]');
    if (state) state.textContent = met ? ', met' : ', not met';
  });
  const checkConfirm = (force = false) => {
    const bad = confirm.value !== '' && confirm.value !== password.value;
    if (!bad || force || confirm.value.length >= password.value.length) {
      setFieldState(confirmField, bad ? 'error' : null, bad ? "Passwords don't match." : '');
    }
  };

  password.oninput = () => {
    showRules();
    setFieldState(passwordField, PASSWORD_ALLOWED.test(password.value) ? null : 'error',
      PASSWORD_ALLOWED.test(password.value) ? '' : 'Use only English letters, numbers and symbols.');
    if (confirm.value !== '') checkConfirm(true);
  };
  password.onblur = () => {
    const ok = password.value !== '' && PASSWORD_ALLOWED.test(password.value) && !allMet();
    if (ok) setFieldState(passwordField, 'error', 'Check the password requirements.');
  };
  confirm.oninput = () => checkConfirm(false);
  confirm.onblur = () => checkConfirm(true);
  showRules();
  return true;
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `Object.values(...).every(...)` | `for` 로 돌며 `return false` | 하나라도 안 맞으면 실패입니다 |
| `rule?.(값) ?? false` | `rule ? rule(값) : false` | 규칙이 없으면 실패로 봅니다 |
| `items.forEach(...)` | `for (const item of items)` | 줄마다 같은 일을 합니다 |
| `force = false` (기본값) | `if (force \|\| ...)` | 값을 안 넘기면 false 로 봅니다 |

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `password.oninput = function () { … }` | 처리기를 **대입**합니다. `addEventListener` 와 달리 두 번 불러도 겹치지 않습니다 |
| `item.dataset.rule` | `data-rule="length"` 의 `length` 값입니다(`data-` 속성) |
| `classList.toggle('is-met', met)` | `met` 이 참이면 붙이고 거짓이면 뺍니다 |
| `[data-rule-state]` | 화면 낭독기용 글자(`sr-only`)입니다. 색으로만 알리는 규칙을 소리로도 알려 줍니다 |
| `PASSWORD_ALLOWED.test(값)` | 값이 허용 문자(영문, 숫자, 기호)로만 되어 있는지 봅니다 |
| `checkConfirm(true)` (blur) | 칸을 벗어나면 다 쳤는지와 상관없이 불일치를 알립니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 가입 화면과 **같은** `core/password.js` | 규칙과 문구가 화면마다 달라지면 사용자가 헷갈립니다. 한 곳에서만 고치게 합니다 |
| 허용 문자 오류와 규칙 미달 오류를 **나눔** | 한글을 쳤을 때는 "규칙을 확인하세요"보다 "영문, 숫자, 기호만 쓰세요"가 맞습니다 |
| 확인 칸은 **입력 중에는 길이 이상일 때만**, 벗어나면 항상 | 아직 다 치지도 않았는데 불일치라고 하면 성급합니다. 다 친 뒤에 알립니다 |
| 처리기를 **대입**(`oninput`, `onblur`) | 두 번 불러도 앞 처리기를 덮어써 겹치지 않습니다 |
| 화면 낭독기용 글자(`data-rule-state`)도 갱신 | 색(○/✓)만으로는 알 수 없는 사용자를 위해 소리로도 알립니다 |
| 칸이 없으면 false | 다른 페이지에 이 파일이 잘못 붙어도 오류가 나지 않습니다 |

## 4. 시험 (실제 서버, 헤드리스 Chrome)
`docs/handoff/p1-28_tests/reset_rules.mjs` 로 시험합니다. 실제 키 입력까지 넣습니다.

| 시험 | 결과 |
|---|---|
| 실제 타이핑 `Passw0rd!` 로 규칙 다섯 줄 모두 `is-met` | 통과 |
| `abc` 는 length 와 lower 만 met | 통과 |
| 규칙 미달로 칸을 벗어나면 `Check the password requirements.` | 통과 |
| 허용되지 않는 문자(한글)에 `Use only English letters, numbers and symbols.` | 통과 |
| 허용 문자로 돌아오면 오류 문구가 사라짐 | 통과 |
| 확인 칸이 비밀번호보다 짧을 때는 입력 중 안내하지 않음 | 통과 |
| 확인 칸을 벗어나면 `Passwords don't match.` | 통과 |
| 확인 칸이 길이 이상이고 다르면 입력 중 알림 | 통과 |
| 확인 칸이 맞으면 오류 없음 | 통과 |
| 두 번 불러도 true | 통과 |
| 화면 낭독기용 글자(`data-rule-state`)가 갱신 | 통과 |

열두 확인이 모두 통과했습니다.

> 페이지가 완성된 뒤에는(`initResetForm` 추가) 토큰 없이 열면 폼이 잠기므로(입력·전송 막음), 시험은 `#token=` 을 붙여 엽니다.

### 시험을 고친 것
처음 시험에서 두 가지가 **시험의 잘못**이었습니다.
- 확인 칸 불일치를 시험할 때 비밀번호보다 짧은 값을 넣어 두고 안내를 기대했습니다. 하지만 입력 중에는 길이 이상일 때만 알리므로 안내가 없었습니다. 값과 기대를 규칙에 맞게 고쳤습니다.
- 칸을 벗어나는 시험에서 `blur()` 만 불렀습니다. 포커스가 없던 칸은 `blur` 이벤트가 나지 않아, **포커스를 준 뒤** 벗어나도록 고쳤습니다.

## 5. 페이지 연결
`resetPassword.js` 아래쪽에서 부릅니다.
```js
await includePartials();
initModalFallback();
initAuthState();
initFormAlerts();
initPasswordToggles();
initResetPasswordRules();
```
`#reset-password` 칸이 없으면 아무것도 연결하지 않고 false 를 돌려줍니다.
