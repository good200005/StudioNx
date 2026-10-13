# JS 96 — `initErrorActions()` (오류 페이지의 Go back, Try again 버튼)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/error.js` |
| 작업 | P1-23 화면 마무리: 오류 페이지의 두 버튼이 눌러도 아무 일도 하지 않던 것을 동작하게 함 (PRD 01 FR-116) |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 이전 · 다음 | (P1-23 첫 함수) · 97 `loadDevNotes()` (다음) |

## 1. 하는 일
`errors/400 ~ 504.html` 일곱 페이지가 같이 쓰는 스크립트에서, 버튼 두 종류를 동작하게 합니다.

| 버튼 | 있는 페이지 | 동작 |
|---|---|---|
| `Go back` (`data-action="back"`) | 400, 403, 404 | 돌아갈 기록이 있으면 이전 페이지로, 없으면 `home.html`로 |
| `Try again` (`data-action="retry"`) | 429, 500, 503, 504 | 원래 하려던 일을 다시 시도 (아래 두 경우로 나뉩니다) |
| `Back to home` (일반 링크) | 전부 | 링크 그대로 (JS가 건드리지 않음) |

![서버 오류로 마이페이지에서 옮겨 온 500 오류 페이지: Try again 버튼](../../images/javascript_p1-23/96_error_500.png)

**`Try again`이 두 경우로 나뉘는 이유**: 오류 페이지가 화면에 나타나는 길이 두 가지라서, 똑같이 `reload`하면 한쪽에서 쓸모가 없습니다.

| 오류 페이지가 열린 방식 | 주소 | `Try again`이 하는 일 |
|---|---|---|
| 서버가 그 주소에 **직접** 보냄 (P1-22) | 원래 주소 그대로 (예: `/boom`) | `location.reload()`: 같은 주소를 다시 요청하므로 원래 요청이 다시 시도됩니다 |
| 화면의 JS가 **옮겨 옴** (`core/page-errors.js`, 예: 마이페이지의 API 실패) | `/errors/500.html` | `reload`하면 오류 페이지만 다시 뜨고 원래 일은 다시 안 합니다. 그래서 **어디서 왔는지(`document.referrer`)**를 보고 그 페이지로 돌아가 다시 시도합니다 |
| 위에서 온 곳을 알 수 없음 (주소를 직접 입력해서 옴 등) | `/errors/…` | `home.html` |

## 2. 언제 쓰나
| 호출하는 곳 | 시점 |
|---|---|
| 페이지 맨 아래 `initErrorActions();` | 오류 페이지가 열릴 때 한 번 |

## 3. 코드
```js
export function initErrorActions() {
  document.addEventListener('click', function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');

    if (action === 'back') {
      if (history.length > 1) history.back();
      else location.href = 'home.html';
    } else if (action === 'retry') {
      if (location.pathname.indexOf('/errors/') !== 0) {
        location.reload();
      } else if (document.referrer && document.referrer.indexOf(location.origin + '/') === 0
        && document.referrer.indexOf(location.origin + '/errors/') !== 0) {
        location.href = document.referrer;
      } else {
        location.href = 'home.html';
      }
    }
  });
}
```

**최신 문법으로 쓰면** (공부용이며, 실제 코드는 위에 있습니다)
```js
export const initErrorActions = () => {
  document.addEventListener('click', ({ target }) => {
    const action = target.closest('[data-action]')?.dataset.action;
    if (action === 'back') {
      history.length > 1 ? history.back() : (location.href = 'home.html');
    } else if (action === 'retry') {
      const { origin, pathname } = location;
      const from = document.referrer;
      if (!pathname.startsWith('/errors/')) location.reload();
      else location.href = from.startsWith(`${origin}/`) && !from.startsWith(`${origin}/errors/`) ? from : 'home.html';
    }
  });
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `target.closest(...)?.dataset.action` | `button`이 없으면 `return` | 없을 수 있는 값에서 안전하게 꺼냅니다 (옵셔널 체이닝) |
| `startsWith(...)` | `indexOf(...) === 0` | 글자가 그것으로 시작하는지 봅니다 |
| `` `${origin}/` `` | `location.origin + '/'` | 글자에 값을 끼워 넣습니다 (템플릿 문자열) |
| `({ target }) =>` | `function (event)`와 `event.target` | 화살표 함수와 구조 분해입니다 |

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `document.addEventListener('click', …)` | 문서 어디든 클릭하면 부릅니다. 버튼마다 걸지 않고 **한 곳**에서 받습니다 |
| `event.target.closest('[data-action]')` | 누른 곳에서 위로 올라가며 `data-action` 속성이 있는 가장 가까운 요소를 찾습니다. 버튼 안의 글자를 눌러도 버튼을 찾습니다. 없으면 `null`입니다 |
| `history.length` | 이 탭의 기록 개수입니다. 1이면 돌아갈 곳이 없습니다 |
| `location.pathname.indexOf('/errors/') !== 0` | 주소의 경로가 `/errors/`로 **시작하지 않는지**입니다 (`indexOf`가 0이면 시작) |
| `document.referrer` | 이 페이지로 오기 직전에 있던 페이지의 주소입니다. 모르면 빈 글자입니다 |
| `location.origin` | 사이트의 주소 부분입니다 (예: `http://localhost:8001`) |

## 4. 흐름
1. 오류 페이지가 열리면 문서에 클릭 처리기를 하나 겁니다.
2. 클릭한 곳에서 `data-action`을 찾아, 없으면(일반 링크, 글자) 아무것도 하지 않습니다.
3. `back`이면 기록이 있을 때 뒤로, 없으면 홈으로 갑니다.
4. `retry`이면 주소가 `/errors/`로 시작하지 않을 때(서버가 직접 보낸 경우) 다시 불러오고, 시작하면 온 곳으로 돌아갑니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 버튼마다 걸지 않고 문서에 한 번 | 7개 페이지가 같은 스크립트를 쓰고, 버튼 위치가 페이지마다 다릅니다. 한 곳에서 받으면 어느 페이지에서나 동작합니다 |
| `onclick`이 아니라 `addEventListener` | 이 파일은 페이지마다 한 번 실행되어 겹쳐 걸릴 일이 없습니다 |
| `Try again`을 두 경우로 나눔 | `reload`만 쓰면 마이페이지에서 서버 오류가 난 뒤 `Try again`을 눌러도 오류 페이지만 다시 뜹니다 (실제 화면 시험 전에는 이 문제를 예상하지 못했고, 시험 설계 중에 발견했습니다) |
| `core/page-errors.js`(P1-17)를 고치지 않고 `document.referrer`를 씀 | 이동할 때 `location.replace`를 쓰므로 기록에는 오류 페이지만 남지만, 브라우저가 어디서 왔는지는 기억합니다. 이미 병합된 파일을 건드리지 않고 풀 수 있습니다 |
| 오류 페이지끼리 오가는 경우 제외 (`/errors/`로 시작하는 referrer) | 오류 페이지에서 온 것을 "원래 페이지"로 보고 돌아가면 같은 곳을 맴돕니다 |
| 같은 사이트의 referrer만 믿음 | 다른 사이트에서 왔다면(링크 등) 그쪽으로 보내지 않고 홈으로 보냅니다 |
| 429, 503의 `Retry-After`로 버튼 잠시 막기는 하지 않음 | 선택 사항이었고, 서버가 지금 그 헤더를 보내지 않습니다 |

## 6. 시험 (실제 서버, 헤드리스 Chrome, 마우스로 버튼 클릭, 10개)
서버가 `/api/v1/me/dashboard`에 500을 주도록, 그리고 항상 오류를 던지는 `/boom` 주소를 임시로 붙인 실행 파일을 썼습니다 (시험 뒤 지움).

| # | 한 일 | 결과 |
|---|---|---|
| E01 | 로그인한 상태로 마이페이지를 열었더니 서버 오류 | `/errors/500.html`로 옮겨 옴 ✔ |
| E02 | `Try again`을 누름(서버는 여전히 오류) | 마이페이지로 돌아갔다가 다시 오류 페이지 ✔ |
| E03 | 서버를 회복시킨 뒤 `Try again` | 마이페이지가 **정상으로** 열림 (프로필 이름 확인) ✔ |
| E04 | `/boom`(서버가 직접 보낸 500)을 엶 | 주소가 `/boom` 그대로 ✔ |
| E05 | `Try again` | 같은 주소를 서버에 다시 요청함(요청 횟수가 정확히 1 증가) ✔ |
| E06 | 주소창으로 `/errors/500.html`을 직접 열고 `Try again` | `home.html` ✔ |
| E07 | 404 페이지의 `Go back` 버튼 | 있음 ✔ |
| E08 | 홈 → 없는 주소 → `Go back` | `home.html`로 돌아감 ✔ |
| E09 | 기록이 없는 상태(`history.length`가 1)에서 `Go back` | `home.html` ✔ |
| E10 | `Back to home` 링크 | 그대로 `home.html` ✔ |

10개 모두 통과했습니다.
