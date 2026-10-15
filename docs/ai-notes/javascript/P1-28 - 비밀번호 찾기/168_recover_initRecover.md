# JS 168 — `initRecover()` (계정 찾기 화면 열기와 닫기 연결)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/recover.js` (내부 도우미 `resetRecoverState()` 포함) |
| 작업 | P1-28 계정 찾기 화면: JS 네 번째 함수 |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 | [167 `initRecoverTabs()`](167_recover_initRecoverTabs.md) |
| 다음 | `home.html#recover` 주소로 복구 화면 열기, 그다음 요청 폼 전송 |

## 1. 하는 일
로그인 모달의 계정 찾기 화면을 실제 버튼과 모달의 닫힘에 연결합니다. 앞의 세 함수(화면 전환, 탭 고르기, 탭 조작)를 한곳에서 엮는 함수입니다.

| 조작 | 동작 |
|---|---|
| `Can't sign in?` | 복구 화면을 엽니다(처음 상태, Password 탭, 첫 입력칸에 커서) |
| `Back to Sign In`(복구 화면 아래, 보낸 뒤 화면) | 로그인 화면으로 돌아오고 복구 화면 상태를 비웁니다 |
| 모달 닫기(`Close` 버튼, `Esc`, `close()`) | 로그인 화면으로 되돌리고 복구 화면 상태를 비웁니다. **다음에 열면 항상 로그인 화면부터** 입니다 |
| 탭 클릭, 화살표 | `initRecoverTabs()`를 여기서 연결 |

**복구 화면 상태를 비운다**는 것은 다음을 모두 처음으로 되돌린다는 뜻입니다: Password 탭 선택, 탭 목록과 `Back to Sign In` 줄이 보임, 보낸 뒤 화면이 숨음, 입력칸이 비워짐, 오류 문구가 숨음, 보낸 뒤 화면의 이메일 글자가 비워짐.

## 2. 코드 (요약)
```js
function resetRecoverState(modal) {
  /* 탭 목록과 Back 줄 보이기, 보낸 뒤 화면 숨기기, Password 탭 선택,
     입력칸 비우기, 오류 문구 숨기기, 보낸 이메일 글자 비우기 */
}

export function initRecover(modal) {
  if (!modal || !modal.querySelector('[data-view="recover"]')) return false;

  const open = modal.querySelector('#login-recover');
  if (open) open.onclick = function () { resetRecoverState(modal); showView(modal, 'recover'); };

  for (const id of ['recover-back', 'recover-sent-back']) {
    const back = modal.querySelector('#' + id);
    if (back) back.onclick = function () { resetRecoverState(modal); showView(modal, 'login'); };
  }

  if (modal.recoverOnClose) modal.removeEventListener('close', modal.recoverOnClose);
  modal.recoverOnClose = function () { resetRecoverState(modal); showView(modal, 'login'); };
  modal.addEventListener('close', modal.recoverOnClose);

  initRecoverTabs(modal);
  return true;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const initRecover = (modal) => {
  if (!modal?.querySelector('[data-view="recover"]')) return false;
  const go = (view) => { resetRecoverState(modal); showView(modal, view); };

  modal.querySelector('#login-recover')?.addEventListener('click', () => go('recover'));
  ['recover-back', 'recover-sent-back'].forEach((id) =>
    modal.querySelector(`#${id}`)?.addEventListener('click', () => go('login')));
  modal.addEventListener('close', () => go('login'));

  initRecoverTabs(modal);
  return true;
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `modal?.querySelector(…)` | `!modal \|\| !modal.querySelector(…)` | 모달이 없으면 건너뜁니다 |
| `…?.addEventListener(…)` | `if (open) open.onclick = …` | 버튼이 있을 때만 연결합니다 |
| `go(view)` 도우미 | 같은 두 줄을 반복 | 비우고 화면을 바꾸는 일을 한 번만 적습니다 |
| `addEventListener` 한 번 | `onclick` 대입, `close`는 이전 처리기를 떼고 다시 닮 | 여러 번 불러도 처리기가 쌓이지 않게 합니다 |

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `modal.recoverOnClose` | 모달 요소에 처리기를 붙여 두어, 다시 부를 때 이전 것을 `removeEventListener`로 뗄 수 있게 합니다 |
| `for (const id of […])` | 같은 동작을 두 버튼에 연결합니다 |
| `close` 이벤트 | `<dialog>`가 닫힐 때(`Close` 버튼, `Esc`, `close()`) 한 번 일어납니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| **닫을 때 입력값을 비움** | 복구 화면에 적은 이메일은 개인정보입니다. 모달을 닫아 두면 같은 브라우저를 쓰는 다음 사람이 그 값을 볼 수 있어서, 닫는 순간 비웁니다. 시험에서 확인했습니다 |
| **열 때와 돌아올 때 모두 초기화** | 두 곳이 겹치지만 한쪽만 있으면, 다른 경로(나중에 만들 `#recover` 주소로 열기 등)가 생겼을 때 이전 상태가 남을 수 있습니다. 한쪽을 지워도 시험은 통과하고, **둘 다 지우면 실패**합니다(아래 §4) |
| 닫으면 로그인 화면으로 되돌림 | 다음에 `Sign In`을 눌렀을 때 복구 화면이 먼저 보이면 사용자가 당황합니다 |
| 화면 전환과 비우기를 항상 함께 부름 | 따로 부르다가 하나를 빼먹는 일을 막습니다 |
| 버튼이 없어도 오류 없이 진행 | 이 모달 조각은 여러 페이지가 쓰고, 일부 페이지가 버튼을 빼도 다른 부분이 동작해야 합니다 |
| `close` 처리기는 모달에 붙여 둔 것을 떼고 다시 닮 | `login-modal`은 다른 곳(`initLoginModalFromHash`)도 `close`를 듣고 있어서 `onclose`로 덮어쓰면 그쪽이 사라집니다. `addEventListener`를 쓰되, 이 함수를 두 번 불러도 겹치지 않게 했습니다 |

## 4. 시험 (실제 서버, 마우스와 키보드 이벤트, 28개 통과)
헤드리스 Chrome에 **실제 마우스 클릭과 `Esc` 키**를 보냈고 `home.html`, `join.html`에서 같은 시험을 했습니다.

| 확인 | 결과 |
|---|---|
| 연결하면 `true`(두 번 불러도) | ✔ ✔ |
| 모달을 열면 로그인 화면(제목 `Sign In`) | ✔ ✔ |
| `Can't sign in?`을 누르면 복구 화면, 제목, Password 탭, 첫 칸에 커서 | ✔ ✔ |
| 탭 연결도 됨(Email 탭을 누르면 선택) | ✔ ✔ |
| `Back to Sign In`: 로그인 화면, 제목, 로그인 칸에 커서 | ✔ ✔ |
| 다시 열면 처음 상태(Password 탭, 입력값과 오류 문구가 비워짐) | ✔ ✔ |
| 보낸 뒤 화면의 `Back to Sign In`: 로그인 화면으로 | ✔ ✔ |
| 다시 열면 보낸 뒤 화면이 사라지고 탭과 Back 줄이 돌아옴, 이메일 글자 비워짐 | ✔ ✔ |
| 복구 화면에서 `close()`로 닫았다 다시 열면 로그인 화면, 입력값 비워짐 | ✔ ✔ |
| **`Esc` 키로 닫았다 다시 열어도** 로그인 화면, 입력값 비워짐 | ✔ ✔ ✔ ✔ |
| 로그인 화면(폼, 입력칸, `Join Us`)은 그대로 | ✔ ✔ |
| 모달이 `null`이거나 복구 화면이 없으면 `false` | ✔ |
| 복구 화면은 있지만 버튼, 탭이 없어도 오류 없이 `true` | ✔ |

**시험을 확인하는 시험.** 일부러 틀리게 바꿔 시험이 잡는지 보았습니다.

| 바꾼 것 | 결과 |
|---|---|
| 열기 연결 제거 | 12개 실패 |
| `Back to Sign In` 연결 제거 | 8개 실패 |
| 닫기 처리 제거 | 6개 실패 |
| 닫을 때 입력값을 안 비움 | 6개 실패 |
| 닫을 때 로그인 화면으로 안 돌림 | 6개 실패 |
| 탭 연결 제거 | 2개 실패 |
| 보낸 뒤 화면 초기화 제거 | 2개 실패 |
| 탭 목록 복구 제거 | 2개 실패 |
| 오류 문구를 안 비움 | 2개 실패 |
| 복구 화면이 없어도 진행 | 1개 실패 |
| **열 때의 초기화만 제거** | **실패 없음** |
| **돌아올 때의 초기화만 제거** | **실패 없음** |
| 위 둘을 **함께** 제거 | 4개 실패 |

마지막 세 줄은 시험의 빈틈이 아니라 **이중 방어**의 증거입니다. 한쪽(열 때 또는 돌아올 때)만 지우면 다른 쪽이 같은 일을 하므로 결과가 같고, 둘 다 지우면 실패합니다. 그리고 **닫을 때**의 초기화가 세 번째 방어입니다. 일부러 겹쳐 두었습니다.

## 5. 아직 이 함수를 부르는 곳이 없습니다
이 함수를 `home.js`와 `join.js`가 불러야 실제 화면에서 동작합니다. 연결은 `#recover` 주소로 여는 함수까지 만든 뒤에 한 번에 하겠습니다(두 번 손대지 않기 위해서). 지금까지의 함수 4개는 모두 시험으로만 확인했습니다.
