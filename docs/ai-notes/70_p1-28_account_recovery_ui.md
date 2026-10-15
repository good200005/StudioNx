# AI 구현 설명 70 — P1-28 계정 찾기 화면 (진행 중)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 작업 | P1-28 (YouTrack StudioNx-76): 비밀번호 찾기와 이메일을 잊은 경우의 화면 |
| 브랜치 | `feature/phase1/p1-28-account-recovery` |
| 백엔드 문서 | `docs/ai-notes/backend(fastAPI_Python)/P1-28 - 비밀번호 찾기/150~164` |
| 상태 | 복구 모달의 HTML, CSS, 화면 전환, 폼 전송(JS 165~171)과 페이지 연결 완료. `send again`, `resetPassword.html`은 진행 예정 |

## 1. 화면 구조 (사용자가 정함)
- 로그인 모달 안에서 화면이 바뀝니다. 별도 페이지는 비밀번호를 바꾸는 `resetPassword.html` 하나뿐입니다.
- `New here? Join Us` 아래의 **`Can't sign in?`** 링크(이름은 사용자가 추천안으로 정함)가 복구 화면을 엽니다.
- 복구 화면은 밑줄 탭 둘(**Password**, **Email**)이고, 보낸 뒤 화면은 두 탭이 공유합니다.
- 보낸 뒤 `send again`은 1분 뒤에 켜집니다.

| 화면 | 내용 |
|---|---|
| Sign In | 기존 로그인 화면 (`data-view="login"`) |
| Password 탭 | 이메일 한 칸, `Send reset link` |
| Email 탭 | "쓸 만한 다른 이메일" 한 칸, `Send reminder`, `Contact us` 안내 |
| 보낸 뒤 | `Check your inbox`, `Back to Sign In`, `send again` |

![Password 탭](images/p1-28_recover_password.png)

![Email 탭](images/p1-28_recover_email.png)

![보낸 뒤 화면](images/p1-28_recover_sent.png)

## 2. 1단계에서 한 일 (HTML과 CSS, JS는 아직)
| 파일 | 내용 |
|---|---|
| `static/partials/login-modal.html` | 로그인 화면을 `data-view="login"`으로 감싸고, `data-view="recover"`(처음에는 `hidden`)에 탭, 두 폼, 보낸 뒤 화면을 더했습니다. 제목의 `data-title-login`, `data-title-recover`에 두 화면의 제목을 두었습니다 |
| `static/css/auth.css` | 밑줄 탭(`.tab`), 보낸 뒤 화면(`.recover-sent`), 안내 줄 규칙 |

- 이 조각 파일은 `home.html`과 `join.html`이 함께 쓰므로 두 페이지에 한 번에 반영됩니다.
- 탭은 `role="tablist"`, `role="tab"`, `role="tabpanel"`과 `aria-selected`, `aria-controls`를 달았습니다(화면 낭독기와 키보드 이동을 위한 것이고, 화살표 키로 탭을 옮기는 동작은 JS 단계에서 만듭니다).
- 폼의 `action`은 백엔드 API(`/api/v1/auth/password-reset/request`, `/api/v1/auth/email-reminder/request`)를 가리킵니다. 실제 전송은 JS가 하고, JS가 없어도 폼이 열려 있는 상태로 두기 위해 `action`과 `method`를 적어 두었습니다.
- 로그인 화면은 그대로입니다. 로그인 폼의 `id`와 기존 시험(`#login-form`, `#login-recover` 등)은 바뀌지 않았습니다.

## 3. 시험 (실제 서버, 헤드리스 Chrome)
| 확인 | 결과 |
|---|---|
| 처음에는 로그인 화면이 보이고 복구 화면은 숨음, 로그인 폼과 `Can't sign in?` 버튼이 그대로 있음 | ✔ |
| Password 탭: 입력칸, 탭, 보내기 버튼, 뒤로 버튼이 모달 안에 들어옴, 제목이 `Can't sign in?`로 바뀜, Email 패널은 숨음 | ✔ |
| Email 탭: 패널 전환, 선택 표시(`aria-selected`), Contact 링크(`home.html#contact`) | ✔ |
| 보낸 뒤 화면: 탭과 두 패널이 **실제로** 숨음, `send again`은 잠김, 이메일 표시 | ✔ |
| 모바일 390px: 모달이 화면 안에 들어오고 가로 넘침 없음 | ✔ |
| 기존 로그인 링크 시험 6개(`home.html`, `join.html`), 처리방침 링크 시험 17개 | ✔ |

**시험이 잡은 문제.** 처음 시험에서 "탭 숨김"이 통과했는데, 스크린샷을 보니 보낸 뒤 화면에 **탭이 그대로 보였습니다.** 시험이 `hidden` 속성만 확인했고, 실제로는 `.tabs { display: grid }`가 `hidden` 속성을 이겨서 숨지 않았기 때문입니다. `.tabs[hidden] { display: none; }`을 더했고, 시험도 계산된 스타일(`getComputedStyle().display`)을 보도록 고쳤습니다. 홈 화면의 공지 없음 화면에서 겪었던 것과 같은 종류의 문제(`[hidden]`과 `display`의 충돌)입니다.

## 4. JS 연결 (2026-10-15)
함수 5개를 `static/js/core/recover.js`에 만들고([165](javascript/P1-28%20-%20비밀번호%20찾기/165_recover_showView.md) ~ [169](javascript/P1-28%20-%20비밀번호%20찾기/169_recover_initRecoverFromHash.md)), `home.js`와 `join.js`에서 두 줄씩 불러 실제 화면에 연결했습니다.

```js
initRecover(document.getElementById('login-modal'));          // Can't sign in?, Back to Sign In, 닫으면 초기화, 탭
initRecoverFromHash(document.getElementById('login-modal'));  // home.html#recover 로 열기
```

| 함수 | 하는 일 |
|---|---|
| `showView` | 모달 안에서 로그인 화면 ⇄ 복구 화면 |
| `selectTab` | Password ⇄ Email 탭 |
| `initRecoverTabs` | 탭 클릭과 `← → Home End` |
| `initRecover` | 열기, 돌아오기, 닫으면 로그인 화면으로 초기화(입력값 비움) |
| `initRecoverFromHash` | `#recover`로 열기, 닫으면 주소의 `#recover` 지움 |
| `showSentView` ([170](javascript/P1-28%20-%20비밀번호%20찾기/170_recover_showSentView.md)) | "Check your inbox" 화면 |
| `initRecoverForms` ([171](javascript/P1-28%20-%20비밀번호%20찾기/171_recover_initRecoverForms.md)) | 두 폼 전송, 성공 화면, 실패 문구 |

### 실제 화면 시험 (헤드리스 Chrome, 24개 통과)
`home.html`, `join.html`에서 **실제 마우스 클릭과 키 입력**으로 시험했습니다.

| 확인 | 결과 |
|---|---|
| 헤더의 `Sign In`으로 모달 열기, `Can't sign in?` 누르기, 복구 화면 | ✔ ✔ |
| Email 탭 클릭, `←`로 Password 탭(커서가 탭으로), `Back to Sign In`, `Esc`로 닫기 | ✔ (8개) |
| 위 흐름에서 자바스크립트 오류 없음 | ✔ ✔ |
| **로그인 폼이 그대로 동작**(틀린 계정은 오류, 모달 유지) | ✔ ✔ |
| `#recover`로 들어오면 복구 화면이 열린 모달 | ✔ ✔ |
| 닫으면 주소의 `#recover`가 사라지고 새로 고침해도 닫힌 채 | ✔ (4개) |
| 전체 흐름에서 자바스크립트 오류 없음 | ✔ ✔ |

기존 시험도 그대로 통과합니다: 로그인 링크 6개, 처리방침 링크 17개, 함수별 시험 27, 40, 39, 28, 31개, 홈 세 칸 폭 14개. 홈 공지 없음 시험 V02는 일러스트가 정사각형으로 바뀐 요구(P1-26)에 맞게 기준을 고쳐야 해서 계속 실패하며 이번 작업과 무관합니다.

![Sign In 모달](images/p1-28_wired_login.png)

![`#recover`로 연 복구 화면](images/p1-28_wired_hash.png)

![Email 탭](images/p1-28_wired_email.png)

## 5. 남은 일
| 단계 | 내용 |
|---|---|
| 3 | JS: `send again` 1분 잠금과 다시 보내기 |
| 4 | `resetPassword.html`의 HTML과 CSS |
| 5 | `resetPassword.html`의 JS: `#token=` 읽기와 주소창에서 지우기, 새 비밀번호 전송 |
