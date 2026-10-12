# JS 08 — `logout()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/auth.js` |
| 작업 | P1-02 프론트 공통 JS (PRD 01 FR-104) |
| 작성 | Claude (AI), 2026-10-06, 사용자 검토 |
| 이전 · 다음 | [07 `requireLogin()`](07_auth_requireLogin.md) (P1-02의 마지막 함수) · [09 `setFieldState()`](<../P1-07 - 가입·로그인 JS/09_auth-ui_setFieldState.md>) (P1-07) |

## 1. 하는 일
로그아웃합니다. 서버에 리프레시 쿠키를 지워 달라고 요청하고, 메모리의 Access Token을 지운 뒤 홈으로 이동합니다.

## 2. 언제 쓰나
마이페이지, 내 프로젝트, 회원 정보 화면의 **왼쪽 메뉴 맨 아래에 있는 `Log out` 버튼**(`#logout-button`)을 누를 때 부릅니다.

| 페이지 | 부르는 곳 |
|---|---|
| 마이페이지 `myPage.html` | `pages/mypage.js` (P1-17) |
| 내 프로젝트 `myProject.html` | `pages/myproject.js` (P1-14) |
| 회원 정보 `userInfo.html` | `pages/userinfo.js` (P1-10) |

### 누르면 일어나는 일 (예)
| 순서 | 화면과 브라우저 |
|---|---|
| ① 마이페이지에서 `Log out`을 누릅니다 | — |
| ② 서버가 리프레시 쿠키(`snx_refresh`)를 지웁니다 | 다음에 페이지를 열어도 재발급이 되지 않습니다 |
| ③ 메모리의 Access Token을 지웁니다 | 지금 페이지에서도 API를 부를 수 없습니다 |
| ④ 홈으로 이동합니다 | `home.html`로 가고, 헤더 오른쪽이 **Sign In, Join Us** 버튼으로 바뀝니다 |
| ⑤ 뒤로 가기를 누릅니다 | 마이페이지가 아니라 그 전에 보던 페이지로 갑니다 |

토큰이 두 개이기 때문에 로그아웃할 때도 두 곳에서 지웁니다.

| 토큰 | 지우는 곳 |
|---|---|
| 리프레시 토큰 (HttpOnly 쿠키) | 서버가 지웁니다. JS는 이 쿠키를 읽거나 지울 수 없습니다 |
| Access Token (메모리) | 이 함수가 `clearAccessToken()`으로 지웁니다 |

## 3. 코드
**import** (파일 맨 위)
```js
import { api, clearAccessToken, getAccessToken, refreshAccessToken } from './api.js';
```
`auth.js` 맨 위의 import 줄입니다. 이 함수는 이 중에서 **`api`와 `clearAccessToken`**을 씁니다. `LOGIN_PAGE`는 같은 파일 안에 있습니다.

**함수**
```js
export async function logout() {
  try {
    await api.post('/auth/logout', undefined, { auth: false });
  } catch {
    // 이미 만료 · 네트워크 오류여도 화면에서는 로그아웃을 계속함
  }
  clearAccessToken();
  location.replace(LOGIN_PAGE);
}
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `import { a, b } from './api.js'` | `api.js`가 `export`한 것 중 `a`와 `b`를 이름 그대로 가져옵니다. `'./'`는 같은 폴더라는 뜻입니다. 브라우저는 `<script type="module">`일 때만 `import`를 읽습니다 |

| 식 | 뜻 |
|---|---|
| `api.post('/auth/logout', undefined, { auth: false })` | 본문 없이(`undefined`) POST를 보냅니다. `auth: false`이므로 토큰을 붙이지 않고, 토큰이 없어도 재발급을 먼저 시도하지 않습니다 ([02](02_api_apiFetch.md)) |
| `try { … } catch { }` | 요청이 실패해도 오류로 멈추지 않고 다음 줄로 넘어갑니다. `catch` 뒤의 `(err)`는 쓰지 않을 때 생략할 수 있습니다 |
| `location.replace(LOGIN_PAGE)` | `home.html`로 이동하면서 지금 페이지를 방문 기록에서 지웁니다 |

## 4. 흐름
1. `POST /api/v1/auth/logout`을 보내고, 서버가 리프레시 쿠키를 지웁니다.
2. 요청이 실패해도 그대로 진행합니다.
3. 메모리의 Access Token을 지웁니다.
4. `home.html`로 이동합니다 (방문 기록에서 지금 페이지를 지웁니다).

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `auth: false` | 서버는 토큰을 확인하지 않고 쿠키만 지웁니다 (P1-05 템플릿). 토큰이 없을 때 재발급을 먼저 하면 **로그아웃하려다가 오히려 새 토큰을 받는** 일이 생깁니다 |
| 요청이 실패해도 계속 진행 | 사용자는 로그아웃 버튼을 눌렀습니다. 네트워크가 끊겨도 화면에서는 로그아웃된 상태가 되어야 합니다 |
| `location.href` 대신 `location.replace` | `href`를 쓰면 뒤로 가기로 마이페이지가 다시 보일 수 있습니다(브라우저가 저장해 둔 화면). `replace`는 그 기록을 지웁니다. 템플릿에는 `href`로 되어 있었는데 바꿨습니다 |
| 메모리 토큰은 마지막에 지움 | 요청을 보내는 동안에는 필요하지 않지만, 실패 여부와 상관없이 반드시 지우도록 `try` 바깥에 두었습니다 |

## 6. 시험 (fetch와 location을 가짜로 바꿔서 시험)
| 경우 | 결과 |
|---|---|
| 정상 (204) | `POST /api/v1/auth/logout`을 1번 보내고, `credentials`는 있고 `Authorization`은 없으며, 토큰을 지우고 `home.html`로 replace합니다 |
| 토큰이 이미 없음 | 재발급을 시도하지 않고 로그아웃 요청만 1번 보냅니다 |
| 서버 오류 500 | 예외 없이 토큰을 지우고 이동합니다 |
| 네트워크 오류 | 예외 없이 토큰을 지우고 이동합니다 |
