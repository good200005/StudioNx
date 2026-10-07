# JS 20 — `confirmDialog()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/dialog.js` |
| 작업 | 수정 — 브라우저 기본 창 → SweetAlert (사용자 요청 `sweetalert수정.pdf` "Confirm 창도 SweetAlert 형식", 2026-10-07) |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [19 `initFormAlerts()`](19_dialog_initFormAlerts.md) · [21 `promptDialog()`](21_dialog_promptDialog.md) |

## 1. 하는 일
**취소 · 확인** 두 버튼짜리 확인창을 띄우고, 사용자가 확인을 눌렀으면 `true`, 아니면 `false` 를 돌려준다. `window.confirm()` 대신 쓴다.

| 데스크톱 | 휴대폰 (600px 이하) |
|---|---|
| ![데스크톱](../../images/javascript_sweetalert/20_confirm_delete.png) | ![휴대폰](../../images/javascript_sweetalert/20_confirm_delete_mobile.png) |

| 부르는 코드 | 화면 | 돌려주는 값 |
|---|---|---|
| `await confirmDialog({ title: 'Delete project?', text: '…', confirmText: 'Delete project', danger: true })` | 위 캡처. 처음 커서는 **Cancel** | Delete project → `true` |
| `await confirmDialog({ title: 'Leave this page?', text: '…' })` | 보라 OK · Cancel. 처음 커서는 OK | OK → `true` |
| (어느 쪽이든) Cancel · Esc · 바깥 클릭 | 닫힘 | `false` |

## 2. 언제 쓰나
| 쓰는 곳 | 언제 붙이나 |
|---|---|
| 내 프로젝트의 **프로젝트 삭제** (목업 05 · 12) | P1-14 `initDeleteProject` 구현 때 — 지금의 `#delete-project-modal` 과 행 메뉴 Delete 의 `command="show-modal"` 을 지우고, Delete 클릭 → `confirmDialog` → `true` 면 삭제 API. `myproject.js` 템플릿 주석에 적어 둠 |
| 회원 탈퇴 (목업 08) | 비밀번호 칸이 있어서 21 `promptDialog` 로 |

지금 HTML 모달을 바로 지우지 않은 이유: 삭제 버튼이 **JS 없이** `command` 속성으로 모달을 연다. 모달을 지우면 P1-14 전까지 삭제 버튼이 아무 일도 안 하게 된다.

## 3. 코드
**import** (`dialog.js` — 18 과 같음, 추가 없음)

**함수**
```js
export async function confirmDialog(options) {
  const danger = options.danger === true;
  const openModal = document.querySelector('dialog[open]');
  const result = await Swal.fire({
    target: openModal || document.body,
    title: options.title,
    text: options.text || '',
    showCancelButton: true,
    confirmButtonText: options.confirmText || 'OK',
    cancelButtonText: options.cancelText || 'Cancel',
    reverseButtons: true,           // 취소 · 확인 순서 (확인이 오른쪽)
    focusCancel: danger,
    buttonsStyling: false,
    heightAuto: false,
    scrollbarPadding: false,
    returnFocus: true,
    showClass: { popup: 'snx-dialog-in' },
    hideClass: { popup: 'snx-dialog-out' },
    customClass: {
      popup: 'snx-dialog snx-dialog--' + (danger ? 'danger' : 'info'),
      title: 'snx-dialog__title',
      htmlContainer: 'snx-dialog__text',
      actions: 'snx-dialog__actions',
      confirmButton: danger ? 'btn btn--danger' : 'btn btn--primary',
      cancelButton: 'btn btn--ghost',
    },
  });
  return result.isConfirmed === true;
}
```

**최신 문법으로 쓰면** (공부용 — 바뀌는 부분만)
```js
export async function confirmDialog({ title, text = '', confirmText = 'OK', cancelText = 'Cancel', danger = false }) {
  const { isConfirmed } = await Swal.fire({
    target: document.querySelector('dialog[open]') ?? document.body,
    title, text,
    confirmButtonText: confirmText, cancelButtonText: cancelText,
    customClass: { popup: `snx-dialog snx-dialog--${danger ? 'danger' : 'info'}`, … },
    …
  });
  return isConfirmed;
}
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `({ title, text = '', … })` (매개변수에서 구조 분해 + 기본값) | `options` 하나 받고 `options.text \|\| ''` | 옵션 꺼내기 |
| `const { isConfirmed } = await …` | `const result = await …` + `result.isConfirmed` | 결과에서 칸 하나 꺼내기 |
| `?? document.body` | `openModal \|\| document.body` | 없으면 body |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| (추가 없음) | 18 의 `import Swal from …` 을 같이 씀 |

| 식 | 뜻 |
|---|---|
| `await Swal.fire({ … })` | 창이 닫힐 때까지 기다렸다가 **결과 객체**를 받음 — `{ isConfirmed, isDismissed, dismiss }` |
| `result.isConfirmed` | 확인 버튼(또는 확인에 커서가 있을 때 Enter)으로 닫혔으면 `true`. Cancel · Esc · 바깥 클릭은 `false` |
| `=== true` | 혹시 `undefined` 여도 꼭 `true`/`false` 둘 중 하나로 |
| `showCancelButton: true` | 취소 버튼 보이기 |
| `reverseButtons: true` | 라이브러리 기본(확인 · 취소)을 뒤집어 취소 · 확인 |
| `focusCancel: danger` | `danger` 가 참이면 처음 커서를 취소 버튼에 |
| `danger ? 'btn btn--danger' : 'btn btn--primary'` | 삼항 연산자 — 조건에 따라 둘 중 하나 |

## 4. 흐름
1. `danger` 인지 봄, 열린 `<dialog>` 모달이 있는지 봄.
2. 창을 띄움 — danger 면 빨간 선 · 빨간 확인 버튼 · 커서는 취소.
3. 사용자가 닫을 때까지 기다림.
4. 확인으로 닫혔으면 `true`, 아니면 `false` 를 돌려줌. 커서는 열기 전 자리로.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `Promise<boolean>` 만 돌려줌 | 부르는 쪽이 `if (await confirmDialog(…)) { 삭제 }` 한 줄로 쓴다. `window.confirm()` 과 같은 모양이라 바꾸기 쉽다 |
| danger 면 처음 커서가 **취소** | 확인창이 뜨자마자 습관적으로 Enter 를 눌러도 지워지지 않는다 (시험으로 확인: Enter → `false`) |
| danger 아니면 커서가 확인 | 되돌릴 수 있는 일은 Enter 한 번으로 빠르게 |
| 취소 왼쪽 · 확인 오른쪽 | 기존 HTML 확인창(`.modal__actions`)과 같은 순서. 휴대폰에서는 `dialog.css` 가 위아래로 바꾸고 **확인이 위** (엄지에 가까운 아래가 취소 — 실수로 지우기 어렵게) |
| Esc · 바깥 클릭 = 취소 | 사용자가 그냥 닫는 것은 "하지 않겠다" 는 뜻 |
| 확인 버튼 글자를 행동으로 (`'Delete project'`) | "OK" 보다 무엇이 일어나는지 분명하다 |
| 18 과 설정이 비슷해도 따로 적음 | 함수 하나만 읽어도 무엇을 하는지 보이게. 세 함수가 모두 끝나면 공통 부분을 묶을지 검토 |

**함께 고친 것 (`dialog.css`):** 휴대폰 시트가 화면 **가운데**에 떠 있었다 (목업 09 · 13 포함). SweetAlert 의 화면은 위 · 가운데 · 아래 3줄 격자이고 창이 가운데 줄에 있어서, 아래 줄 · 폭 전체(`grid-row: 3; grid-column: 1 / 4`)로 옮겼다. 목업도 다시 찍었다.

## 6. 시험 (실제 myProject.html 을 헤드리스 Chrome 으로 열고 그 안에서 실행 · 14개)
| 시험 | 확인한 것 |
|---|---|
| danger 모양 | 제목 · 설명 · "Delete project" · "Cancel", 취소가 왼쪽, 확인 `btn--danger`, 위쪽 선 `rgb(255, 138, 138)`, 처음 커서 Cancel |
| **진짜 Enter** (danger) | `false` — 지워지지 않음 |
| Delete project · Cancel 클릭 | `true` · `false` |
| **진짜 Esc** · 바깥 클릭 | `false` · `false` |
| 보통 | `btn--primary`, 기본 글자 OK · Cancel, 처음 커서 OK, 보라 선 → 진짜 Enter → `true` |
| `<img onerror>` 설명 | 글자 그대로 |
| Edit details 모달이 열린 상태 | 확인창이 모달 안 · 맨 위에 보이고, Esc → 확인창만 닫힘 (모달 그대로) |

14/14 통과. 처음에는 **시험 코드**의 실수로 멈췄다 — `async` 함수가 Promise 를 돌려주면 `await` 가 그 Promise 가 끝날 때(창이 닫힐 때)까지 기다린다. 객체로 감싸 돌려주게 고쳤다. 18 · 19 시험도 다시 돌려 모두 통과.
