# JS 76 — `initLogoutButton()` (로그아웃 버튼 정리)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/mypage.js` |
| 작업 | P1-17 마이페이지 JS: 템플릿의 빈 `initLogoutButton`을 지우고 공통 함수를 가져다 쓰기 (PRD 01 FR-132) |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 이전 · 다음 | [75 `renderReadyBanner()`](75_mypage_renderReadyBanner.md) · 77 페이지 시작 코드 (다음) |

## 1. 하는 일
왼쪽 메뉴의 `Log out` 버튼은 마이페이지, 내 프로젝트, 회원 정보에서 모두 같게 동작합니다. 그래서 P1-10 27번에서 `core/auth-ui.js`에 한 번만 구현해 두었고, 이 작업은 그 함수를 `mypage.js`에서 가져다 쓰도록 정리하는 일입니다. 새 로직은 없습니다.

| 바꾼 곳 | 내용 |
|---|---|
| 빈 함수 삭제 | 템플릿에 있던 `export function initLogoutButton() { // TODO }`를 지웠습니다 |
| import 수정 | `initAuthState`와 함께 `initLogoutButton`을 `core/auth-ui.js`에서 가져옵니다 |
| 안 쓰는 import 제거 | `core/auth.js`에서 `logout`을 가져오던 부분을 뺐습니다 (`requireLogin`은 77번에서 씁니다) |
| 안내 주석 | `userinfo.js`와 같은 문장을 남겼습니다 |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 페이지 맨 끝 줄 `initLogoutButton();` | 왼쪽 메뉴의 `Log out` 버튼 |

## 3. 코드
**import** (`mypage.js` 위쪽)
```js
import { initAuthState, initLogoutButton } from '../core/auth-ui.js';
import { requireLogin } from '../core/auth.js';
```

**공통 함수** (`core/auth-ui.js`, 27번에서 구현)
```js
export function initLogoutButton(button = document.getElementById('logout-button')) {
  if (!button || button.dataset.logout === 'on') return;
  button.dataset.logout = 'on';
  button.addEventListener('click', () => {
    button.disabled = true;
    logout(); // 끝나면 다른 페이지로 옮겨 가므로 다시 켤 필요 없음
  });
}
```
`mypage.js`에는 이제 이 함수의 본문이 없고 `// 로그아웃 버튼(27)은 세 화면 공통이라 …` 한 줄만 남아 있습니다.

## 4. 흐름
1. 페이지 시작 코드의 마지막 줄 `initLogoutButton()`이 `#logout-button`을 찾습니다.
2. 이미 연결된 버튼이면(`data-logout="on"`) 아무것도 하지 않습니다.
3. 버튼을 누르면 잠그고, `logout()`이 서버에 `POST /auth/logout`을 보낸 뒤 `home.html`로 이동합니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 페이지마다 만들지 않고 공통 함수를 import | 세 화면의 동작이 같아서, 한 곳만 고치면 되도록 합니다 (27번 결정) |
| `logout` import 삭제 | 공통 함수가 `core/auth-ui.js` 안에서 `logout`을 쓰므로, 이 파일에서는 쓰는 곳이 없습니다 |
| 같은 버튼에 두 번 연결하지 않음 | 공통 함수가 `data-logout`으로 막아 줍니다 |

## 6. 시험 (실제 myPage.html, 헤드리스 Chrome, 3개)
| 시험 | 결과 |
|---|---|
| `mypage.js`가 자체 `initLogoutButton`을 내보내지 않음 | 통과입니다 |
| 페이지가 열린 뒤 `#logout-button`이 한 번 연결됨 (`data-logout="on"`) | 통과입니다 |
| 버튼을 누르면 잠기고 `POST /auth/logout`이 나감 | 통과입니다 |

3개 모두 통과했습니다.
