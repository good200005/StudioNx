# JS 169 — `initRecoverFromHash()` (주소 `#recover`로 복구 화면 열기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/recover.js` |
| 작업 | P1-28 계정 찾기 화면: JS 다섯 번째 함수 |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 | [168 `initRecover()`](168_recover_initRecover.md) |
| 다음 | `home.js`, `join.js`에 연결, 그다음 요청 폼 전송 |

## 1. 하는 일
주소가 `#recover`이면 로그인 모달을 열고 **복구 화면**을 보여 줍니다. 이메일 안내 메일의 `Reset password` 버튼(`home.html#recover`)이 이 주소를 가리킵니다. 로그인 모달의 `#login` 주소와 같은 방식입니다.

| 상황 | 동작 |
|---|---|
| `home.html#recover`로 들어옴 | 모달이 열리고 복구 화면(Password 탭, 제목 `Can't sign in?`) |
| 페이지 안에서 주소가 `#recover`로 바뀜(`hashchange`) | 같은 동작 |
| 이미 열린 로그인 화면에서 `#recover`로 바뀜 | 복구 화면으로 바뀜 |
| 모달을 닫음 | 주소의 `#recover`를 지움(새로 고침하면 다시 열리는 일을 막음) |
| `#recovery`, `#recoverx`, `#contact`, 해시 없음 | 복구 화면을 열지 않음 |

## 2. 코드
```js
export function initRecoverFromHash(modal) {
  if (!modal || !modal.querySelector('[data-view="recover"]')) return false;

  if (modal.recoverHashHandler) window.removeEventListener('hashchange', modal.recoverHashHandler);
  if (modal.recoverHashOnClose) modal.removeEventListener('close', modal.recoverHashOnClose);

  const openIfRecoverHash = function () {
    if (location.hash !== '#recover') return;
    if (!modal.open) modal.showModal();
    resetRecoverState(modal);
    showView(modal, 'recover');
  };
  modal.recoverHashHandler = openIfRecoverHash;
  modal.recoverHashOnClose = function () {
    if (location.hash === '#recover') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  };

  window.addEventListener('hashchange', openIfRecoverHash);
  modal.addEventListener('close', modal.recoverHashOnClose);
  openIfRecoverHash();
  return true;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const initRecoverFromHash = (modal) => {
  if (!modal?.querySelector('[data-view="recover"]')) return false;
  const openIfRecoverHash = () => {
    if (location.hash !== '#recover') return;
    if (!modal.open) modal.showModal();
    resetRecoverState(modal);
    showView(modal, 'recover');
  };
  window.addEventListener('hashchange', openIfRecoverHash);
  modal.addEventListener('close', () => {
    if (location.hash === '#recover') history.replaceState(null, '', location.pathname + location.search);
  });
  openIfRecoverHash();
  return true;
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `modal?.querySelector(…)` | `!modal \|\| !modal.querySelector(…)` | 모달이 없으면 건너뜁니다 |
| 처리기를 바로 `addEventListener` | 모달 요소에 붙여 두었다가 이전 것을 떼고 다시 닮 | 이 함수를 두 번 불러도 처리기가 쌓이지 않습니다 |

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `location.hash !== '#recover'` | **정확히** `#recover`일 때만 엽니다. `#recovery`나 `#recoverx`는 열지 않습니다(`startsWith`가 아니라 같음 비교) |
| `hashchange` | 주소의 `#…` 부분이 바뀔 때(링크 클릭, 직접 입력) 일어납니다 |
| `history.replaceState(null, '', …)` | 새 기록을 쌓지 않고 주소만 바꿉니다. 해시를 지울 때 뒤로 가기 단추가 `#recover`로 돌아가지 않게 합니다 |
| `location.pathname + location.search` | 경로와 `?…` 부분은 그대로 두고 `#…`만 뺍니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| **정확히 `#recover`일 때만** | 비슷한 해시(`#recovery`)가 다른 곳(나중에 생길 앵커)에 쓰일 수 있고, `#login?next=…` 같은 값을 붙이는 `#login`과 달리 `#recover`는 값을 받지 않아서 더 엄격하게 비교해도 됩니다 |
| 열 때 `resetRecoverState()`를 거침 | `hashchange`로 이미 입력 중인 복구 화면을 다시 열 수 있으므로 항상 깨끗한 처음 상태에서 시작합니다 |
| **모달을 닫으면 `#recover`를 지움** | 지우지 않으면 닫은 뒤 새로 고침할 때 복구 화면이 다시 열립니다. `#login`을 지우는 홈 화면의 기존 함수와 같은 이유입니다 |
| 다른 해시로 바뀐 뒤 닫으면 **그 해시를 지우지 않음** | 사용자가 `#feature`로 이동했는데 모달을 닫으면서 위치 정보가 사라지면 안 됩니다. 시험으로 확인했습니다 |
| 닫기 처리기를 `initRecover()`의 것과 **따로 둠** | 두 함수가 서로 몰라도 각자 동작하고, 한쪽만 써도 됩니다 |
| 모달이 이미 열려 있으면 `showModal()`을 부르지 않음 | 옛 브라우저는 이미 열린 `<dialog>`에 `showModal()`을 부르면 오류를 냅니다 |

## 4. 시험 (실제 서버, 31개 통과)
`home.html`, `join.html` 두 페이지에서 같은 시험을 했습니다.

| 확인 | 결과 |
|---|---|
| 연결하면 `true`(세 번 불러도) | ✔ ✔ |
| `#recover`로 들어오면 모달이 열리고 복구 화면, 제목, Password 탭 | ✔ ✔ |
| 닫으면 주소의 `#recover`가 지워지고 경로는 그대로 | ✔ ✔ |
| 다시 열면 로그인 화면(`#recover`가 남아 있지 않음) | ✔ ✔ |
| 페이지 안에서 주소가 `#recover`로 바뀌면 열림 | ✔ ✔ |
| `Esc`로 닫아도 `#recover`가 지워짐 | ✔ ✔ |
| 이미 열린 로그인 화면에서 `#recover`로 바뀌면 복구 화면으로, 오류 없음 | ✔ ✔ |
| `#recovery`, `#recoverx`, `#contact`, `#`은 복구 화면을 열지 않음 (`#login`은 홈 화면이 원래 로그인 모달을 여는 주소라 모달은 열릴 수 있지만 복구 화면은 아님) | ✔ (10개) |
| 다른 해시(`#feature`)로 바뀐 뒤 닫으면 그 해시를 지우지 않음 | ✔ ✔ |
| 해시가 없으면 연결해도 열지 않음 | ✔ ✔ |
| 연결 뒤 흐름 전체에서 자바스크립트 오류 없음 | ✔ ✔ |
| 모달이 `null`이거나 복구 화면이 없으면 `false` | ✔ |

**시험이 잡은 시험의 착오.** 처음 시험은 `#login`, `#contact`가 "모달을 열지 않음"이라고 가정했는데, `home.html`에는 `#login` 해시로 로그인 모달을 여는 기존 함수가 있어서 `#login`은 모달이 열렸습니다. 그리고 앞 시험이 열어 둔 모달이 남아서 다음 해시의 결과에 섞였습니다. 이 함수의 오류가 아니라 시험의 가정이 틀린 것이어서, 시험을 "복구 화면을 열지 않음"으로 바로잡고 각 해시 사이에 모달을 닫도록 했습니다.

**시험을 확인하는 시험.** 일부러 틀리게 바꿔 시험이 잡는지 보았습니다.

| 바꾼 것 | 결과 |
|---|---|
| 처음 확인 제거(`#recover`로 들어와도 안 열림) | 4개 실패 |
| `hashchange` 연결 제거 | 8개 실패 |
| 닫을 때 해시를 지우지 않음 | 10개 실패 |
| `#recover`를 `startsWith`로 비교 | 4개 실패 |
| 열린 뒤 복구 화면으로 바꾸지 않음 | 6개 실패 |
| **닫을 때 항상 해시를 지움**(`#feature`도) | 2개 실패 |
| 모든 해시에서 열림 | 12개 실패 |
| 복구 화면이 없어도 진행 | 1개 실패 |
| **`!modal.open` 검사 제거(`showModal()`을 항상 부름)** | **실패 없음** |

마지막은 시험의 빈틈이 아니라 브라우저의 성질입니다. 지금 쓰는 Chrome은 이미 열린 모달에 `showModal()`을 불러도 아무 일도 하지 않고 오류를 내지 않습니다. 이 검사는 오류를 내는 옛 브라우저를 위한 방어입니다.

## 5. 아직 이 함수를 부르는 곳이 없습니다
`home.js`와 `join.js`가 `initRecover()`와 이 함수를 불러야 실제 화면에서 동작합니다. 다음 단계에서 두 줄을 더합니다.
