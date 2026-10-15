# JS 165 — `showView()` (모달 안에서 로그인 화면과 복구 화면 바꾸기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/recover.js` (새 파일) |
| 작업 | P1-28 계정 찾기 화면: JS 첫 번째 함수 |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 | [개요 70](../../70_p1-28_account_recovery_ui.md) (HTML과 CSS), 백엔드 [164](<../../backend(fastAPI_Python)/P1-28 - 비밀번호 찾기/164_auth_email_reminder_request_route.md>) |
| 다음 | 탭 전환과 키보드 이동, 그다음 열기 연결(`Can't sign in?`, `#recover`) |

## 1. 하는 일
로그인 모달(`#login-modal`) 안의 두 화면, `data-view="login"`과 `data-view="recover"` 중 하나만 보이게 바꿉니다.

| 하는 일 | 설명 |
|---|---|
| 화면 전환 | `name`의 `[data-view]`만 보이고 나머지는 숨깁니다(`hidden` 속성) |
| 제목 변경 | `#login-modal-title`의 글자를 `data-title-<name>` 속성의 값으로 바꿉니다(`Sign In` ⇄ `Can't sign in?`). 속성이 없으면 그대로입니다 |
| 커서 이동 | 새 화면에서 **보이는 첫 입력칸**으로 커서를 옮깁니다 |
| 반환 | 바꿨으면 `true`, 모르는 이름이거나 모달, 화면이 없으면 아무것도 바꾸지 않고 `false` |

## 2. 코드
```js
export const RECOVER_VIEWS = ['login', 'recover'];

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

  const inputs = shown.querySelectorAll('input:not([type="hidden"]):not([disabled])');
  for (const input of inputs) {
    if (input.closest('[hidden]') === null) {
      input.focus();
      break;
    }
  }
  return true;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const showView = (modal, name) => {
  if (!modal || !RECOVER_VIEWS.includes(name)) return false;
  const views = [...modal.querySelectorAll('[data-view]')];
  const shown = views.find((v) => v.dataset.view === name);
  if (!shown) return false;
  views.forEach((v) => { v.hidden = v !== shown; });

  const title = modal.querySelector('#login-modal-title');
  const text = title?.dataset[`title${name[0].toUpperCase()}${name.slice(1)}`];
  if (text !== undefined) title.textContent = text;

  [...shown.querySelectorAll('input:not([type="hidden"]):not([disabled])')]
    .find((input) => !input.closest('[hidden]'))?.focus();
  return true;
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `RECOVER_VIEWS.includes(name)` | `indexOf(name) < 0` | 목록에 있는지 확인합니다 |
| `views.find(…)` | `for` 반복에서 `shown`에 담기 | 이름이 같은 화면을 찾습니다 |
| `title?.dataset[…]` | `title ? title.getAttribute(…) : null` | 값이 없으면 건너뜁니다(옵셔널 체이닝) |
| `[...].find(…)?.focus()` | `for`와 `break` | 조건에 맞는 첫 칸에만 커서를 줍니다 |

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `view.hidden = !on` | `hidden` 속성을 켜고 끕니다. CSS에서 `display`를 따로 준 요소는 이 속성이 안 먹을 수 있어서 `[hidden] { display: none }` 규칙이 필요합니다(탭에 이미 더했습니다) |
| `input.closest('[hidden]')` | 입력칸의 조상 중 `hidden`인 것이 있는지 찾습니다. 없으면 `null`이라 "지금 보이는 칸"입니다 |
| `input:not([type="hidden"]):not([disabled])` | 숨김 입력과 비활성 입력은 커서를 받을 수 없어서 뺍니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| **화면 전환을 한 함수에 모음** | 열기, 닫기, 뒤로 가기, 보낸 뒤 모두가 같은 전환을 씁니다. 각자 `hidden`을 만지면 어긋납니다 |
| **커서를 옮김** | 키보드와 화면 낭독기 사용자는 화면이 바뀌어도 커서가 전에 누른 버튼에 남아 있으면 위치를 잃습니다. 새 화면의 첫 입력칸으로 옮기면 바로 입력할 수 있습니다 |
| **보이는 칸만 선택(`closest('[hidden]')`)** | 복구 화면에는 Email 패널의 입력칸도 있는데, 숨은 패널의 칸에 커서를 주면 아무 일도 일어나지 않거나 엉뚱한 곳으로 갑니다. 시험으로 확인했습니다 |
| 제목을 데이터 속성에서 읽음 | 화면 글자를 JS에 적지 않고 HTML에 둡니다. 나중에 글자를 바꿔도 JS는 그대로입니다 |
| **모르는 이름은 `false`로 아무것도 바꾸지 않음** | 오타(`'RECOVER'`)로 두 화면이 모두 숨는 일을 막습니다. 예외를 던지지 않고 값으로 알려서, 이벤트 처리기가 끊기지 않게 합니다 |
| 이미 그 화면이면 다시 불러도 같은 결과 | 두 번 눌러도 안전합니다 |
| 탭, 폼 상태는 건드리지 않음 | 이 함수는 화면 전환 한 가지만 합니다. 탭 선택과 입력값 비우기는 다음 함수들이 맡습니다 |

## 4. 시험 (실제 서버, 헤드리스 Chrome, 27개 통과)
`home.html`과 `join.html` 두 페이지에서 같은 시험을 했습니다.

| 확인 | 결과 |
|---|---|
| 시작 상태: 로그인 화면이 보이고 제목이 `Sign In` | ✔ ✔ |
| `recover`로 바꿈: 복구 화면만 **실제로** 보임(`getComputedStyle`), 제목이 `Can't sign in?`, 커서가 Password 탭의 이메일 칸 | ✔ ✔ |
| 이미 그 화면이면 다시 불러도 같은 결과 | ✔ ✔ |
| Email 패널이 보이는 상태면 그 패널의 입력칸에 커서(숨은 Password 패널의 칸은 건너뜀) | ✔ ✔ |
| `login`으로 돌아옴: 제목 `Sign In`, 커서가 로그인 이메일 칸 | ✔ ✔ |
| 모르는 이름 6종(`'x'`, `''`, `undefined`, `null`, `'RECOVER'`, `1`)은 `false`이고 아무것도 바뀌지 않음 | ✔ (12개) |
| 모달이 `null`이면 `false`(오류 없음) | ✔ ✔ |
| 제목 속성이 없으면 제목은 그대로이고 화면은 바뀜 | ✔ |
| `[data-view]`가 하나도 없는 모달은 `false`이고 제목도 그대로 | ✔ |
| 내보내는 상수 | ✔ |

**시험을 확인하는 시험.** 일부러 틀리게 바꿔 시험이 잡는지 보았습니다.

| 바꾼 것 | 결과 |
|---|---|
| `hidden`을 반대로 | 8개 실패 |
| 제목 바꾸기 제거 | 2개 실패 |
| 커서 이동 제거 | 8개 실패 |
| 숨은 패널의 칸도 선택 | 2개 실패 |
| 이름 검사 제거 | 3개 실패 |
| 제목 속성이 없어도 덮어씀 | 1개 실패 |
| **`[data-view]`가 없을 때의 조기 반환 제거** | **실패 없음** |

마지막은 시험의 빈틈이 아니라 중복 방어입니다. 그 줄을 지워도 바로 아래의 `shown === null` 검사가 같은 경우를 `false`로 막기 때문입니다. 앞의 검사는 쓸모없는 반복을 피하는 빠른 반환입니다.

## 5. 아직 이 함수를 부르는 곳이 없습니다
화면에서 실제로 쓰이려면 다음 함수들이 필요합니다. 지금은 `Can't sign in?`을 눌러도 아무 일도 일어나지 않습니다.
- 탭 전환과 키보드 이동
- `Can't sign in?` 버튼과 `home.html#recover`로 복구 화면을 여는 연결
