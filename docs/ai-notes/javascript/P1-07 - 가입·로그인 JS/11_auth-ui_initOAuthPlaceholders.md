# JS 11 — `initOAuthPlaceholders()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/auth-ui.js`, `studionx/frontend/static/css/auth.css` (한 줄) |
| 작업 | P1-07 가입 · 로그인 JS (PRD 01 FR-110) |
| 작성 | Claude (AI), 2026-10-07, 사용자 검토 |
| 이전 · 다음 | [10 `initPasswordToggles()`](10_auth-ui_initPasswordToggles.md) · [12 `initAuthState()`](12_auth-ui_initAuthState.md) |

## 1. 하는 일
소셜 로그인 버튼(**Google, Discord, SoundCloud**)을 누르면, 버튼 줄 바로 아래에 "아직 준비 중"이라는 안내 한 줄을 보여 줍니다. 연동은 나중에 할 예정이라(FR-110) 지금은 자리만 있습니다.

![SoundCloud 를 누른 뒤 — join.html](../../images/javascript_p1-07/11_oauth_coming_soon.png)

| 누른 버튼 | 버튼 아래 안내 |
|---|---|
| Google | Google sign-in is coming soon. Please use your email for now. |
| Discord | Discord sign-in is coming soon. Please use your email for now. |
| SoundCloud | SoundCloud sign-in is coming soon. Please use your email for now. |

다른 버튼을 누르면 **같은 줄의 글만 바뀝니다** (줄이 늘어나지 않습니다).

## 2. 언제 쓰나
페이지가 열릴 때 한 번 부릅니다.

| 페이지 | 버튼 줄 |
|---|---|
| join.html | 가입 폼 아래의 "or sign up with" 줄과 로그인 모달 안의 줄 (버튼 6개) |
| home.html | 로그인 모달 안의 줄 (`home.js`, P1-07의 뒤 순서) |

**나중에 연동할 때:** 이 함수 안의 "안내 쓰기" 부분을 `location.href = '/api/v1/auth/oauth/<provider>/start'`로 바꾸면 됩니다 (템플릿 주석에 적혀 있으며, PRD 01 개정이 필요합니다).

## 3. 코드
**import** (파일 맨 위)
```js
// (없음)
```
**이 함수는 import가 필요하지 않습니다.** 브라우저의 기본 기능만 씁니다.

**함수**
```js
/** 소셜 로그인 서비스 이름 (안내 문구용) */
const OAUTH_NAMES = { google: 'Google', discord: 'Discord', soundcloud: 'SoundCloud' };

export function initOAuthPlaceholders(root = document) {
  const buttons = root.querySelectorAll('.oauth[data-provider]');
  for (const button of buttons) {
    if (button.dataset.oauthReady === 'on') continue;
    button.dataset.oauthReady = 'on';
    button.addEventListener('click', () => {
      const provider = button.dataset.provider;
      const name = OAUTH_NAMES[provider] || provider;
      const row = button.closest('.oauth-row') || button.parentElement;
      let note = row.nextElementSibling;
      if (!note || !note.classList.contains('oauth-note')) {
        note = document.createElement('p');
        note.className = 'field__msg oauth-note';
        note.setAttribute('role', 'status');
        row.after(note);
      }
      note.textContent = `${name} sign-in is coming soon. Please use your email for now.`;
    });
  }
}
```
**CSS 한 줄 추가** (`auth.css`)
```css
.oauth-note { margin-top: var(--sp-2); text-align: center; }
```
글자 크기와 색은 기존의 `.field__msg`(작은 회색 글씨)를 함께 써서 따로 정하지 않았습니다.

**최신 문법으로 쓰면** (공부용이며, 실제 코드는 위에 있습니다)
```js
export function initOAuthPlaceholders(root = document) {
  root.querySelectorAll('.oauth[data-provider]:not([data-oauth-ready])').forEach((button) => {
    button.dataset.oauthReady = 'on';
    button.addEventListener('click', () => {
      const { provider } = button.dataset;
      const name = OAUTH_NAMES[provider] ?? provider;
      const row = button.closest('.oauth-row') ?? button.parentElement;
      let note = row.nextElementSibling;
      if (!note?.classList.contains('oauth-note')) {
        note = Object.assign(document.createElement('p'), { className: 'field__msg oauth-note', role: 'status' });
        row.after(note);
      }
      note.textContent = `${name} sign-in is coming soon. Please use your email for now.`;
    });
  });
}
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `const { provider } = button.dataset` | `const provider = button.dataset.provider` | 구조 분해입니다. 칸을 같은 이름의 변수로 꺼냅니다 |
| `OAUTH_NAMES[provider] ?? provider` | `OAUTH_NAMES[provider] \|\| provider` | 없으면 대신 쓸 값입니다 (여기서는 이름이 빈 문자열일 일이 없으므로 둘의 결과가 같습니다) |
| `!note?.classList.contains(…)` | `!note \|\| !note.classList.contains(…)` | `note`가 없거나, 안내 줄이 아니면 참입니다 |
| `Object.assign(요소, { … })` | `className = …`과 `setAttribute('role', …)`를 한 줄씩 씀 | 여러 속성을 한 번에 넣습니다 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `export function` | `join.js`와 `home.js`가 가져다 씁니다 (`OAUTH_NAMES`는 `export`가 없어서 이 파일 안에서만 씁니다) |

| 식 | 뜻 |
|---|---|
| `'.oauth[data-provider]'` | `oauth` 클래스이면서 `data-provider` 속성이 있는 요소입니다 |
| `button.dataset.provider` | HTML의 `data-provider="google"`을 읽으면 `'google'`입니다 |
| `OAUTH_NAMES[provider] \|\| provider` | 표에 있으면 보기 좋은 이름(`SoundCloud`)을, 없으면 받은 문자열을 그대로 씁니다 |
| `button.closest('.oauth-row')` | 버튼에서 **위로** 올라가며 가장 가까운 버튼 줄을 찾습니다 |
| `row.nextElementSibling` | 버튼 줄 **바로 다음** 요소입니다. 안내 줄이 이미 있으면 그것입니다 |
| `document.createElement('p')`, `row.after(note)` | 새 `<p>`를 만들어 버튼 줄 바로 뒤에 넣습니다 |
| `` `${name} sign-in …` `` | 템플릿 문자열입니다. `${ }` 안의 값을 문자열에 끼워 넣습니다 (2015년에 나온 문법이며, 지금은 기본입니다) |

## 4. 흐름
1. 범위 안의 소셜 버튼을 모두 찾습니다 (이미 연결한 버튼은 건너뜁니다).
2. 버튼을 누르면 서비스 이름을 정하고, 버튼 줄 바로 아래에 안내 줄이 없으면 만듭니다.
3. 안내 줄의 글을 그 서비스의 문구로 바꿉니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `alert` 대신 화면 안에 안내 한 줄 (템플릿은 둘 다 허용) | `alert`는 화면을 멈추고 확인 버튼을 눌러야 합니다. 안내 한 줄은 하던 일을 방해하지 않습니다 |
| 안내 줄을 하나만 두고 글만 바꿈 | 여러 번 눌러도 줄이 쌓이지 않습니다 |
| `role="status"` | 화면 읽기 프로그램이 새 안내를 방해 없이(`polite`) 읽어 줍니다 |
| "Please use your email for now." | 막혔다는 말만 하지 않고, 지금 할 수 있는 일을 알려 줍니다 |
| 같은 버튼에 두 번 연결하지 않음 (`data-oauth-ready`) | 10번과 같은 이유입니다 |
| 이름 표(`OAUTH_NAMES`) | `soundcloud`를 `SoundCloud`처럼 대소문자를 바르게 보여 줍니다. 표에 없는 서비스가 추가되어도 오류 없이 그 이름으로 보입니다 |
| CSS는 기존 `.field__msg`를 함께 씀 | 다른 칸 아래 문구와 같은 크기와 색이 됩니다. 추가한 것은 여백과 가운데 정렬 한 줄뿐입니다 |

## 6. 시험 (실제 join.html을 헤드리스 Chrome으로 열고 그 안에서 실행, 8개)
| 시험 | 확인한 것 |
|---|---|
| 연결 | 버튼 6개(가입 3개, 로그인 모달 3개)가 모두 연결되었고, 한 번 더 불러도 중복되지 않습니다 |
| 누르기 전 | 안내 줄이 없습니다 |
| Google | 줄 바로 아래에 `<p class="field__msg oauth-note" role="status">`와 Google 문구가 나옵니다 |
| Discord | 안내 줄은 그대로 1개이고, 글만 Discord로 바뀝니다 |
| SoundCloud | "SoundCloud"로 표기됩니다 |
| 페이지 이동 | 없습니다 (`/join.html` 그대로) |
| 모양 | 가운데 정렬, 위 여백 8px입니다 |
| 표에 없는 서비스 | `github`를 그대로 표시하고, 오류가 나지 않습니다 |

8개 모두 통과했습니다. 위의 캡처는 같은 방식으로 SoundCloud를 누른 뒤에 찍었습니다.
