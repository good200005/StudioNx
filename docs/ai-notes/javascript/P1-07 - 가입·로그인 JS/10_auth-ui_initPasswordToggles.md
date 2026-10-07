# JS 10 — `initPasswordToggles()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/auth-ui.js` |
| 작업 | P1-07 가입 · 로그인 JS · PRD 01 FR-101 · FR-103 |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [09 `setFieldState()`](09_auth-ui_setFieldState.md) · [11 `initOAuthPlaceholders()`](11_auth-ui_initOAuthPlaceholders.md) |

## 1. 하는 일
비밀번호 칸 오른쪽의 **Show / Hide** 버튼이 동작하게 한다. 누를 때마다 입력한 비밀번호를 보였다 가렸다 한다.

| 누르기 전 | 누른 뒤 |
|---|---|
| `••••••••` · 버튼 **Show** | `Abcdef1!` · 버튼 **Hide** |
| `<input type="password">` · `aria-pressed="false"` | `<input type="text">` · `aria-pressed="true"` |

입력한 값은 바뀌지 않는다. 보이는 방식(`type`)만 바뀐다.

## 2. 언제 쓰나
페이지가 열릴 때 한 번 부른다. 그러면 그 페이지의 Show 버튼이 모두 동작한다.

| 페이지 | 버튼 | 부르는 곳 |
|---|---|---|
| join.html | Password · Confirm password · 로그인 모달 Password (3개) | `join.js` |
| home.html | 로그인 모달 Password | `home.js` (P1-07 뒤 순서) |
| userInfo.html | 현재 · 새 · 확인 비밀번호, 탈퇴 비밀번호 (4개) | `userinfo.js` (P1-10) |

버튼과 입력칸은 HTML 의 `aria-controls` 로 짝지어져 있다.
```html
<input class="field__control" id="join-password" type="password" …>
<button type="button" class="pw__toggle" aria-controls="join-password" aria-pressed="false">Show</button>
```

## 3. 코드
**import** (파일 맨 위)
```js
// (없음)
```
`auth-ui.js` 는 아직 import 가 없다. **이 함수는 import 가 필요 없다** — 브라우저 기본 기능만 쓴다.

**함수**
```js
export function initPasswordToggles(root = document) {
  const buttons = root.querySelectorAll('.pw__toggle');
  for (const button of buttons) {
    if (button.dataset.pwToggle === 'on') continue;
    button.dataset.pwToggle = 'on';
    button.addEventListener('click', () => {
      const input = document.getElementById(button.getAttribute('aria-controls'));
      if (!input) return;
      const show = input.type === 'password'; // 지금 가려져 있으면 → 보이게
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
  }
}
```

**최신 문법으로 쓰면** (공부용 — 실제 코드는 위)
```js
export function initPasswordToggles(root = document) {
  root.querySelectorAll('.pw__toggle:not([data-pw-toggle])').forEach((button) => {
    button.dataset.pwToggle = 'on';
    button.addEventListener('click', () => {
      const input = document.getElementById(button.getAttribute('aria-controls'));
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.ariaPressed = String(show);
    });
  });
}
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `querySelectorAll('…:not([data-pw-toggle])')` | 반복문 안에서 `if (… === 'on') continue;` | 이미 연결한 버튼 건너뛰기 |
| `.forEach((button) => { … })` | `for (const button of buttons) { … }` | 하나씩 돌기 |
| `button.ariaPressed = String(show)` | `button.setAttribute('aria-pressed', show ? 'true' : 'false')` | 속성 바꾸기 (`ariaPressed` 는 2020년 무렵 생긴 속성 이름) |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `export function` | `join.js` 등이 가져다 씀 |

| 식 | 뜻 |
|---|---|
| `root = document` | 인자를 안 주면 페이지 전체에서 찾음 (기본값) |
| `root.querySelectorAll('.pw__toggle')` | 범위 안의 Show 버튼 **모두** |
| `for (const button of buttons)` | 하나씩 꺼내 반복 |
| `continue` | 이번 차례를 건너뛰고 다음 버튼으로 |
| `button.dataset.pwToggle = 'on'` | HTML 에 `data-pw-toggle="on"` 을 붙여 "연결함" 표시 |
| `addEventListener('click', () => { … })` | 누를 때마다 `{ … }` 를 실행 |
| `getAttribute('aria-controls')` | 버튼이 가리키는 입력칸의 `id` |
| `show ? 'text' : 'password'` | 보일 차례면 `'text'`, 아니면 `'password'` |

## 4. 흐름
1. 범위 안의 Show 버튼을 모두 찾는다.
2. 이미 연결한 버튼은 건너뛴다.
3. 각 버튼에 "누르면" 동작을 붙인다 — 짝 입력칸을 찾아 `type` · 글자 · `aria-pressed` 를 함께 바꾼다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 같은 버튼에 두 번 연결하지 않음 (`data-pw-toggle`) | 두 번 연결되면 한 번 누를 때 두 번 바뀌어 **아무 일도 안 일어난 것처럼** 보인다. 로그인 모달처럼 나중에 끼워 넣는 HTML 이 있어 함수가 여러 번 불릴 수 있다 |
| `root` 인자 | 나중에 끼워 넣은 부분(모달 등)만 골라 연결할 수 있다 |
| 입력칸은 `aria-controls` 로 찾음 | 버튼 바로 앞 칸을 찾는 방식보다 HTML 구조가 바뀌어도 안전하다. 화면 읽기 프로그램도 같은 속성으로 짝을 안다 |
| `aria-pressed` 도 함께 | 화면 읽기 프로그램이 "Show, 눌림" / "눌리지 않음" 으로 상태를 읽는다 |
| 글자 · 상태는 입력칸의 지금 `type` 을 보고 정함 | 버튼 글자를 기준으로 하면, 다른 코드가 `type` 을 바꿨을 때 어긋난다 |

## 6. 시험 (실제 join.html 을 헤드리스 Chrome 으로 열고 그 안에서 실행 · 9개)
`join.js` 가 페이지를 열 때 이미 이 함수를 부르므로, 시험에서 **두 번 더** 불러 중복 연결이 막히는지도 함께 확인했다.

| 시험 | 확인한 것 |
|---|---|
| 연결 | 페이지의 Show 버튼 3개(가입 2 + 로그인 모달 1)가 모두 연결됨 |
| 누르기 | 처음 `password · Show · false` → 한 번 누르면 `text · Hide · true` (세 번 불렀어도 **한 번만** 바뀜) → 다시 누르면 처음으로 |
| 값 | 입력한 `Abcdef1!` 은 그대로 |
| 짝 | 확인 칸 버튼은 확인 칸만 바꿈 |
| `root` | 새로 넣은 버튼은 연결 전, `initPasswordToggles(box)` 뒤에는 동작 |
| 짝 칸이 없는 버튼 | 눌러도 오류 없음, 글자 그대로 |

9/9 통과.
