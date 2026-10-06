# JS 07 — `requireLogin()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/auth.js` |
| 작업 | P1-02 프론트 공통 JS · PRD 01 FR-105 |
| 작성 | Claude (AI) · 2026-10-06 · 사용자 검토 |
| 이전 · 다음 | [06 `isLoggedIn()`](06_auth_isLoggedIn.md) · [08 `logout()`](08_auth_logout.md) |

## 1. 하는 일
로그인이 필요한 페이지의 맨 처음에 부른다. 로그인 상태면 `true` 를 돌려주고, 아니면 로그인 화면으로 보낸 뒤 `false` 를 돌려준다.

## 2. 언제 쓰나
로그인한 사람만 볼 수 있는 페이지 네 곳이 페이지 코드의 맨 처음에 부른다.

| 페이지 | 부르는 곳 |
|---|---|
| 마이페이지 `myPage.html` | `pages/mypage.js` (P1-17) |
| 내 프로젝트 `myProject.html` | `pages/myproject.js` (P1-14) |
| 회원 정보 `userInfo.html` | `pages/userinfo.js` (P1-10) |
| 시퀀서 `studioNx.html` | `pages/sequencer.js` `init()` |

```js
const ok = await requireLogin();
if (!ok) return;          // 로그인 화면으로 이동 중 — 아래 코드(대시보드 불러오기 등)를 실행하지 않음
```

### 실제로 일어나는 일 — 예
로그아웃한 상태에서 주소창에 `localhost:8000/myProject.html#new` 를 직접 입력했을 때:

| 순서 | 화면 · 주소창 |
|---|---|
| ① 내 프로젝트 페이지가 열리기 시작 | `/myProject.html#new` |
| ② `requireLogin()` → 로그인 안 됨 | — |
| ③ 홈으로 이동하고 로그인 모달이 열림 | `home.html#login?next=%2FmyProject.html%23new` |
| ④ 로그인 성공 (P1-07) | — |
| ⑤ 원래 가려던 곳으로 돌아옴 — 새 프로젝트 모달까지 열림 | `/myProject.html#new` |

로그인한 상태라면 ② 에서 `true` 가 나오고 페이지가 그대로 이어진다.

## 3. 코드
```js
export async function requireLogin() {
  if (await isLoggedIn()) return true;
  location.replace(loginUrl(location.pathname + location.search + location.hash));
  return false;
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `await isLoggedIn()` | 로그인 상태 확인이 끝날 때까지 기다린 뒤 `true` · `false` 를 받음 ([06](06_auth_isLoggedIn.md)) |
| `location.pathname` | 주소의 경로 — `/myProject.html` |
| `location.search` | `?` 부터 — `?projectId=3` (없으면 `''`) |
| `location.hash` | `#` 부터 — `#new` (없으면 `''`) |
| `location.replace(url)` | `url` 로 이동하되 **지금 페이지를 방문 기록에서 지움** |

## 4. 흐름
1. `isLoggedIn()` 이 `true` 면 바로 `true` — 페이지가 계속 진행된다.
2. 아니면 지금 주소(경로 + 쿼리 + 해시)로 로그인 주소를 만든다 ([04 `loginUrl()`](04_auth_loginUrl.md)).
3. 그 주소로 `location.replace` 하고 `false` 를 돌려준다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `location.href` 대신 `location.replace` | `href` 로 이동하면 로그인 화면에서 뒤로 가기를 눌렀을 때 마이페이지로 돌아갔다가 **다시 로그인 화면으로 튕긴다** (반복). `replace` 는 마이페이지를 기록에서 지워 뒤로 가기가 그 전 페이지로 간다 |
| 쿼리 · 해시까지 넣음 | `?projectId=3`(어떤 프로젝트) · `#new`(새 프로젝트 모달)가 빠지면 로그인 후 엉뚱한 화면이 된다. 원래 템플릿은 경로 + 쿼리였는데 해시도 더함 |
| `false` 를 돌려줌 | 이동은 바로 끝나지 않는다. 그 사이 페이지 코드가 API 를 부르지 않도록 `if (!ok) return;` 으로 멈추게 한다 |
| 판단은 `isLoggedIn()` 에 맡김 | 토큰 · 재발급 처리를 다시 쓰지 않는다 |

## 6. 시험 (fetch · location 을 가짜로)
| 경우 | 결과 |
|---|---|
| 토큰 있음 | `true`, 이동 없음 |
| 토큰 없음 · 리프레시 쿠키 유효 | `true`, 이동 없음 |
| 로그인 안 됨 · `/myPage.html` | `false`, `home.html#login?next=%2FmyPage.html` 로 이동 |
| `/studioNx.html?projectId=3` | `…next=%2FstudioNx.html%3FprojectId%3D3` |
| `/myProject.html#new` | `…next=%2FmyProject.html%23new` |
| 위 주소를 `parseLoginHash()` 로 다시 읽기 | `/myProject.html#new` 그대로 |
