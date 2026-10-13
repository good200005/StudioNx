# JS 26 — `initWithdraw()` (템플릿 `initWithdrawForm`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/userinfo.js`, `userInfo.html` (탈퇴 모달 삭제, 버튼), `backend/app/schemas/user.py` (주석 한 줄) |
| 작업 | P1-10 회원 정보 화면 JS: 회원 탈퇴 (PRD 01 FR-108) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [25 `initPasswordForm()`](25_userinfo_initPasswordForm.md) · [27 `initLogoutButton()`](27_auth-ui_initLogoutButton.md) |

## 1. 하는 일
**Delete account**를 누르면 FIX-01의 확인창(`promptDialog`)으로 비밀번호를 받고, 맞으면 탈퇴한 뒤 홈으로 보냅니다.

![탈퇴 확인창 — 틀린 비밀번호](../../images/javascript_p1-10/26_withdraw_wrong_password.png)

| 한 일 | 결과 |
|---|---|
| Delete account | 빨간 확인창 "Delete account?"가 뜨고, 비밀번호 칸에 커서가 갑니다 |
| Cancel, Esc, 바깥 클릭 | 창이 닫히고, 아무 일도 일어나지 않습니다 |
| 빈 채로 Delete account | 창 안에 "Enter your password."가 나옵니다 |
| 틀린 비밀번호 | 창 안에 "Password is incorrect."가 나옵니다. **창은 그대로 있으므로** 다시 입력할 수 있습니다 |
| 맞는 비밀번호 | 탈퇴한 뒤 `home.html`로 갑니다 (헤더는 Sign In, Join Us). 뒤로 가기를 눌러도 회원 정보 화면으로 돌아오지 않습니다 |

## 2. 언제 쓰나
userInfo.html이 열릴 때 한 번 부릅니다. 이어지는 것들은 다음과 같습니다.

| 순서 | 하는 곳 |
|---|---|
| ① 확인창, 비밀번호 칸, 확인 중 잠금 | [FIX-01 21 `promptDialog`](<../fix - SweetAlert 알림창/21_dialog_promptDialog.md>) |
| ② 탈퇴 요청 | [백엔드 48 `DELETE /users/me`](<../../backend(fastAPI_Python)/P1-09 - 비밀번호 변경·탈퇴/48_users_route_withdraw.md>) → 46 (소프트 삭제, 사진 삭제), 리프레시 쿠키 삭제 |
| ③ 메모리 토큰 지우기 | [P1-02 `clearAccessToken`](<../P1-02 - 프론트 공통 JS/01_api_refreshAccessToken.md>) |

### 사용자 결정 반영 (2026-10-07, FIX-01 목업 08, 14)
탈퇴 확인은 **비밀번호만** 받고(체크박스 없음), SweetAlert 확인창으로 하기로 했습니다. 그래서 HTML을 다음과 같이 바꿨습니다.

| 전 | 지금 |
|---|---|
| `<dialog id="withdraw-modal">`: 비밀번호 칸, "I understand…" 체크박스, 오류 줄, 버튼 | **삭제했습니다** (그 자리에 "확인창은 JS가 띄움"이라는 주석을 남겼습니다) |
| Delete account 버튼의 `command="show-modal" commandfor="withdraw-modal"` | `id="withdraw-button"`으로 바꾸고, JS가 누름을 받습니다 |
| 함수 이름 `initWithdrawForm` | 더 이상 폼이 아니라서 `initWithdraw`로 바꿨습니다. 아래쪽의 호출 줄과 서버 스키마 주석도 함께 바꿨습니다 |

## 3. 코드
**import** (파일 맨 위)
```js
import { api, clearAccessToken } from '../core/api.js';
import { promptDialog } from '../core/dialog.js';
```
**`clearAccessToken`과 `dialog.js` 줄을 이번에 추가했습니다.**

**함수**
```js
export function initWithdraw() {
  const button = document.getElementById('withdraw-button');
  if (!button) return;

  button.addEventListener('click', async () => {
    const password = await promptDialog({
      title: 'Delete account?',
      text: "This closes your account for good. You'll be signed out right away. Enter your password to confirm.",
      inputType: 'password',
      placeholder: 'Password',
      confirmText: 'Delete account',
      danger: true,
      requiredMessage: 'Enter your password.',
      check: async (value) => {
        try {
          await api.delete('/users/me', { body: { password: value } });
          return null; // 탈퇴됨 → 창이 닫힘
        } catch (err) {
          return err.code === 'WRONG_PASSWORD' ? 'Password is incorrect.' : err.message;
        }
      },
    });
    if (password === null) return; // 취소 · Esc · 바깥 클릭
    clearAccessToken();
    location.replace('home.html');
  });
}
```

**최신 문법으로 쓰면** (공부용이며, 바뀌는 부분만 적었습니다)
```js
check: (value) => api.delete('/users/me', { body: { password: value } })
  .then(() => null)
  .catch((err) => (err.code === 'WRONG_PASSWORD' ? 'Password is incorrect.' : err.message)),
…
document.getElementById('withdraw-button')?.addEventListener('click', async () => { … });
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `.then(…).catch(…)` 이어 쓰기 | `try { await … } catch (err) { … }` | 성공과 실패를 나눕니다. `try`가 더 읽기 쉽습니다 |
| `el?.addEventListener(…)` | `if (!button) return;` | 버튼이 있을 때만 연결합니다 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `import { api, clearAccessToken } from '../core/api.js'` | 같은 파일에서 두 개를 가져옵니다. `clearAccessToken`은 메모리의 Access Token을 지우는 함수입니다 (P1-02) |
| `import { promptDialog } from '../core/dialog.js'` | FIX-01 21번으로, 입력칸이 하나 있는 확인창입니다 |

| 식 | 뜻 |
|---|---|
| `check: async (value) => { … }` | 객체 칸에 함수를 넣습니다. 확인을 누르면 `promptDialog`가 이 함수를 부릅니다. 문자열을 돌려주면 창 안에 빨갛게 보여 주고, `null`을 돌려주면 창을 닫습니다 |
| `api.delete('/users/me', { body: { … } })` | `api.delete`의 두 번째 인자는 **옵션**이므로, 본문은 그 안의 `body`로 넘깁니다 (P1-09 48에서 찾아 고친 점입니다) |
| `err.code === 'WRONG_PASSWORD'` | 서버(P1-09 44)가 400과 함께 주는 코드입니다 |
| `password === null` | 확인을 누르지 않고 창이 닫혔다는 뜻입니다 (21번의 약속) |
| `location.replace('home.html')` | 방문 기록에 회원 정보 화면을 남기지 않고 옮겨 갑니다 |

## 4. 흐름
1. 버튼을 누르면 확인창을 엽니다.
2. 확인을 누르면, 빈 칸일 때는 창 안에 문구를 보여 주고, 아니면 서버에 탈퇴를 요청합니다 (그동안 취소와 Esc가 잠깁니다).
3. 비밀번호가 틀리면 창 안에 문구를 보여 주고, 계속 입력하게 합니다.
4. 성공하면 창이 닫히고, 메모리 토큰을 지운 뒤 홈으로 갑니다.
5. 취소하면 아무 일도 일어나지 않습니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 확인창 **안에서** 서버에 요청 (`check`) | 비밀번호가 틀렸을 때 창을 다시 열 필요가 없습니다. 예전 모달도 틀리면 모달 안에 문구를 보여 주었습니다 |
| 체크박스 없음 | 사용자의 결정입니다. 빨간 선, 빨간 버튼, 설명, 비밀번호 입력이 이미 확인 단계 역할을 합니다 |
| 설명에 닉네임을 넣지 않음 ("your account") | 템플릿 모달은 닉네임을 보여 주었지만, 닉네임 칸(24)에 저장하지 않은 글자가 있으면 틀린 이름을 보여 줄 수 있습니다 |
| 성공하면 `clearAccessToken` | 서버가 쿠키는 지웠지만, 이 페이지의 메모리에는 Access Token(최대 30분)이 남아 있습니다. 어차피 서버가 막지만(06), 깨끗이 지웁니다 |
| `location.replace` (템플릿은 `location.href`) | 뒤로 가기를 누르면 탈퇴한 계정의 회원 정보 화면으로 돌아가서 오류가 납니다 |
| 오류 문구는 서버 문구를 그대로 쓰되, 비밀번호 틀림만 따로 정함 | 서버 문구 "Password is incorrect."와 같지만, 화면 문구를 이 함수가 정하도록 코드로 확인합니다 |

## 6. 시험 (실제 userInfo.html, 실제 서버, 10개)
탈퇴하면 그 계정을 다시 쓸 수 없으므로, 이 시험만 따로 만든 계정(`sitetest.p110w@example.com`)으로 하고, 끝난 뒤 지웠습니다.

| 시험 | 확인한 것 |
|---|---|
| HTML | `#withdraw-modal`이 없고, 버튼에 `command`가 없습니다 |
| 열기 | 제목은 "Delete account?"이고, 비밀번호 칸에 커서가 있으며, 빨간 창과 빨간 "Delete account" 버튼이 나옵니다 |
| Cancel | 창이 닫히고, 로그인은 그대로이며, 탈퇴되지 않고, 주소도 그대로입니다 |
| 빈 칸, 틀린 비밀번호 | "Enter your password.", "Password is incorrect."가 나오고(창은 그대로), 탈퇴되지 않습니다 |
| 맞는 비밀번호 (옮겨 간 뒤 확인) | `/home.html`로 가고, `isLoggedIn()`은 false이며, 헤더는 로그아웃 상태입니다. 그 계정으로 로그인하면 401이고, 방문 기록 수는 그대로입니다 (replace) |

처음에는 9/10이었습니다. 방문 기록 수를 "2"로 고정해서 비교한 **시험 쪽의 실수**였습니다 (시험 도구가 먼저 연 빈 페이지와 서버 주소도 기록에 들어갑니다). 누르기 전후의 수가 같은지 비교하도록 고쳐서 10개 모두 통과했습니다. 22~25번 시험도 다시 돌려서 모두 통과했습니다.
