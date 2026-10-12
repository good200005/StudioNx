# JS 19 — `initFormAlerts()` (+ `alertMessageFor()`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/dialog.js`, 부르는 곳 `pages/home.js`, `join.js`, `myproject.js` |
| 작업 | 수정: 브라우저 기본 창을 SweetAlert로 바꿈 (사용자 요청 `sweetalert수정.pdf`, 2026-10-07) |
| 작성 | Claude (AI), 2026-10-07, 사용자 검토 |
| 이전 · 다음 | [18 `showAlert()`](18_dialog_showAlert.md) · [20 `confirmDialog()`](20_dialog_confirmDialog.md) |

## 1. 하는 일
폼을 보낼 때 빈 칸이나 틀린 형식이 있으면 브라우저가 띄우던 **기본 말풍선**("이 입력란을 작성하세요.", "이메일 주소에 '@'를 포함해 주세요.")을 막고, 18번 `showAlert` 알림창으로 보여 줍니다. OK를 누르면 그 칸에 커서가 갑니다.

![로그인 모달에서 dddddscf 로 Sign In](../../images/javascript_sweetalert/19_login_invalid_email.png)

![문의 폼에서 동의 없이 Send](../../images/javascript_sweetalert/19_contact_agree.png)

| 상황 (사용자 수정 사항의 캡처) | 전 | 이제 |
|---|---|---|
| 로그인 모달의 Email이 빈 칸 | 말풍선 "이 입력란을 작성하세요." | **Email is required** · Fill in this field to continue. |
| Email에 `dddddscf` | 말풍선 "이메일 주소에 '@'를 포함해 주세요…" | **Check your email** · Enter an email like you@example.com. |
| 문의 폼에서 동의하지 않음 | 말풍선 | **Please confirm** · Check “I agree to the Privacy Policy” to continue. |
| 새 프로젝트의 BPM이 `5` | 말풍선 "값은 20 이상이어야 합니다." | **Check BPM** · Enter a number from 20 to 999. |

말풍선은 브라우저 언어(한국어)로 나와서 영어 사이트와 섞였고, 모양도 사이트와 달랐습니다.

## 2. 언제 쓰나
각 페이지 JS가 공통 조각(헤더, 로그인 모달)을 끼운 **뒤에** 한 번 부릅니다.

| 페이지 | 대상 폼 | 대상이 아닌 폼 |
|---|---|---|
| home.html | 로그인 모달 `#login-form`, 문의 `#contact-form` | |
| join.html | 로그인 모달 | 가입 폼 `#join-form`은 `novalidate`라서 칸 아래 문구(15~17)를 그대로 씁니다 |
| myProject.html | 새 프로젝트, 정보 수정, 검색 폼 | |
| userInfo.html | (없음: 폼이 모두 `novalidate`이고, P1-10에서 칸 아래 문구를 씁니다) | |

## 3. 코드
**import** (`dialog.js`: 18번과 같고, 추가한 것은 없습니다). 부르는 페이지 3곳에는 한 줄씩 추가했습니다.
```js
import { initFormAlerts } from '../core/dialog.js';
```

**함수**
```js
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
```
**안쪽 도우미: 틀린 이유를 문구로 바꿈** (내보내지 않습니다)
```js
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
```

**최신 문법으로 쓰면** (공부용이며, 바뀌는 부분만 적었습니다)
```js
const label = input.labels?.[0]?.textContent.replace('*', '').replace(/\s+/g, ' ').trim().replace(/\.$/, '') ?? 'This field';
…
form.addEventListener('invalid', handler, { capture: true });
…
await showAlert(message.title, message.text);
showing = false;
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `input.labels?.[0]?.textContent` | `input.labels && input.labels[0] ? input.labels[0].textContent : …` | 이름표가 있을 때만 읽습니다 |
| `… ?? 'This field'` | 삼항 연산자의 `: 'This field'` | 없으면 기본 글자를 씁니다 |
| `{ capture: true }` | 세 번째 인자 `true` | 같은 뜻입니다. 객체로 쓰면 이름이 보입니다 |
| `async` 처리기 + `await showAlert(…)` | `showAlert(…).then(() => { … })` | 창이 닫힌 뒤에 할 일을 정합니다 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `import { initFormAlerts } from '../core/dialog.js'` | `pages/`에서 한 폴더 위로 올라가 `core/dialog.js`의 이름 있는 내보내기를 가져옵니다 |

| 식 | 뜻 |
|---|---|
| `'form:not([novalidate])'` | `novalidate` 속성이 **없는** 폼만 고릅니다 |
| `'invalid'` 이벤트 | 보내기를 누르면 브라우저가 칸마다 검사하고, 틀린 칸**마다** 이 이벤트를 보냅니다 (화면 순서대로). 하나라도 있으면 `submit`은 일어나지 않습니다 |
| `addEventListener(…, true)` | **capture**입니다. 이벤트가 칸에 닿기 전에 바깥(폼)에서 먼저 받습니다. `invalid`는 위로 퍼지지(bubble) 않으므로, 이렇게 해야 폼 하나에 한 번만 걸면 됩니다 |
| `event.preventDefault()` | 기본 동작(말풍선)을 막습니다. 보내기는 여전히 막힌 상태입니다 |
| `input.validity` | 왜 틀렸는지 알려 줍니다. `valueMissing`(빈 칸), `typeMismatch`(이메일 형식), `tooShort`, `rangeUnderflow`(min 미만) 등입니다 |
| `input.labels[0]` | 그 칸의 `<label for=…>`입니다 |
| `.replace(/\s+/g, ' ')` | 줄바꿈과 여러 칸의 공백을 한 칸으로 바꿉니다 (문의 동의 이름표는 HTML에서 두 줄이기 때문입니다) |
| `.replace(/\.$/, '')` | 끝의 마침표 하나를 뺍니다. 따옴표 안에 넣기 때문입니다 |

## 4. 흐름
1. 페이지에서 `novalidate`가 없는 폼마다, 아직 붙이지 않았으면 `invalid` 받기를 붙입니다.
2. 보내기를 누르면 브라우저가 틀린 칸마다 `invalid`를 보냅니다.
3. 매번 말풍선을 막습니다. 첫 번째 칸이면 이유에 맞는 문구를 정하고, 그 칸에 커서를 옮긴 뒤 알림창을 띄웁니다.
4. 두 번째 칸부터는 무시합니다 (알림은 하나만 띄웁니다).
5. 알림창이 닫히면 커서가 그 칸으로 돌아오고, 다음 보내기를 받을 준비를 합니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `novalidate`를 붙이지 않고 `invalid`만 막음 | 브라우저의 검사 규칙(`required`, `type="email"`, `min/max`, `maxlength`)은 그대로 쓰고 **보여 주는 방법만** 바꿉니다. HTML에 규칙이 이미 있으므로 JS에 다시 쓰지 않습니다 |
| 첫 번째 칸만 알림 | 알림창이 여러 개 겹치면 안 됩니다. 고치고 다시 누르면 다음 칸을 알려 줍니다 (칸 아래 문구 방식인 가입 폼은 17번처럼 한 번에 다 보여 줍니다) |
| 알림 **전에** 커서를 옮김 | 처음에는 창이 닫힌 뒤 `input.focus()`를 불렀는데, SweetAlert가 그 **뒤에** "열기 전 자리"(보내기 버튼)로 커서를 되돌려서 시험 3개가 실패했습니다. 먼저 옮겨 두면 "열기 전 자리"가 그 칸이 됩니다 |
| 문구는 이름표에서 만듦 | 칸마다 문구를 HTML에 따로 적지 않아도 됩니다. 새 폼이 생겨도 그대로 동작합니다 |
| 기본 말풍선 문구(`validationMessage`)를 쓰지 않음 | 브라우저 언어(한국어)로 나와서 영어 사이트와 섞입니다 |
| `data-form-alerts="on"` 표시 | 두 번 불려도 알림이 두 번 뜨지 않게 합니다 (10번 비밀번호 토글과 같은 방식) |
| 페이지 3곳에서 부름 (`includePartials` 뒤) | 로그인 모달은 공통 조각이라서, 끼운 뒤에야 폼이 생깁니다 |

## 6. 시험 (실제 페이지를 헤드리스 Chrome으로 열고 그 안에서 실행, 18개)
| 페이지 | 시험 | 확인한 것 |
|---|---|---|
| home | 로그인 빈 칸 | 알림이 **1개**("Email is required")이고, 말풍선이 막혔으며(`defaultPrevented`), 로그인 요청은 0번이고, 알림은 모달 안에 있습니다 |
| | OK | Email 칸에 커서가 가고, 모달은 그대로입니다 |
| | `dddddscf` | "Check your email" |
| | 비밀번호 빈 칸 → OK | "Password is required"가 나오고, OK를 누르면 Password 칸에 커서가 갑니다 |
| | 다 채움 | 알림 없이 로그인 요청이 1번 가고, 13번의 "Email or password is incorrect."가 나옵니다 (방해하지 않습니다) |
| | 문의 빈 칸 → OK | "Email is required"(body에 뜸)가 나오고, OK를 누르면 문의 Email 칸에 커서가 갑니다 |
| | 문의 동의 안 함 → OK | "Please confirm"과 Check “I agree to the Privacy Policy” …가 나오고, OK를 누르면 체크박스에 커서가 갑니다 |
| join | 대상 | 가입 폼에는 붙지 않고, 로그인 폼에만 붙습니다 |
| | 가입 폼 빈 칸 | 알림 없이 칸 아래에 "Enter a valid email address."가 나옵니다 (17번 그대로) |
| | 로그인 모달 빈 칸 | 알림이 뜹니다 |
| myProject | 새 프로젝트 제목 빈 칸 | "Title is required"가 나옵니다 (새 프로젝트 모달 안) |
| | BPM `5` → OK | "Check BPM"과 Enter a number from 20 to 999.가 나오고, OK를 누르면 BPM 칸에 커서가 갑니다 |

처음에는 15/18이었습니다. 커서 관련 3개가 실패했고(§5), 동의 문구에 줄바꿈이 섞여 있었습니다. 고친 뒤 **18개 모두 통과**했습니다. 18번 `showAlert` 시험 14개와 P1-07 시험(13, 14, 12, 16, 17)도 다시 돌려서 모두 통과했습니다. 시험에서 만든 계정은 지웠습니다.
