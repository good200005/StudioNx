# JS 18 — `showAlert()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/dialog.js` (새 파일) |
| 작업 | 수정: 브라우저 기본 창을 SweetAlert로 바꿈 (사용자 요청 `frontend-reference/images/main page reference/sweetalert수정.pdf`, 2026-10-07) |
| 작성 | Claude (AI), 2026-10-07, 사용자 검토 |
| 이전 · 다음 | [17 `initJoinForm()`](<../P1-07 - 가입·로그인 JS/17_join_initJoinForm.md>) · [19 `initFormAlerts()`](19_dialog_initFormAlerts.md) |

## 1. 하는 일
**제목(큰 글씨), 설명, OK 버튼**으로 된 알림창을 띄웁니다. 모양은 home.html의 분위기에 맞췄습니다. 먹색 면에, 제목은 "Make your noise"나 "Sign In"과 같은 **Unbounded** 글꼴이고, 모서리는 0이며, 위쪽에 2px 보라색 선이 있습니다.

![로그인 모달 위에 뜬 알림창](../../images/javascript_sweetalert/18_showAlert_on_login_modal.png)

| 부르는 코드 | 화면 |
|---|---|
| `showAlert('Check your email', 'Enter a valid email address.')` | 위의 캡처입니다 (위쪽 선은 보라) |
| `showAlert('Oops', 'Something went wrong.', { tone: 'error' })` | 위쪽 선만 빨강입니다 |
| `showAlert('Open on a computer', '…', { note: 'Sign in on a computer …', confirmText: 'Got it' })` | 설명 아래에 작은 글씨 한 줄이 나오고, 버튼 글자가 "Got it"이 됩니다 (목업 09, 16) |
| 휴대폰 (600px 이하) | 아래에서 올라오는 시트가 되고, 버튼이 폭을 가득 채웁니다 (목업 09, 13). `dialog.css`가 처리합니다 |
| 로그인 모달이 열려 있을 때 | 모달 **위에** 뜨고, 닫으면 모달은 그대로이며 커서는 원래 칸으로 돌아갑니다 |

## 2. 언제 쓰나
사용자가 올린 수정 사항은 다음과 같습니다. 로그인 모달에서 Email을 비우거나 형식이 틀리면 **브라우저 기본 말풍선**("이 입력란을 작성하세요.")이 뜨는데, 이것을 SweetAlert로 바꾸고, 색감과 글꼴은 home.html에 맞추며, Prompt와 Confirm 창도 같은 형식으로 만들어 달라는 요청입니다.

| 함수 | 하는 일 | 상태 |
|---|---|---|
| **18 `showAlert`** | 알림창(OK 하나)입니다. 작은 화면 안내(목업 09)에도 씁니다 | **이번** |
| 19 `initFormAlerts` | 폼의 기본 말풍선을 막고 18번으로 보여 줍니다. 로그인 모달, 문의, 새 프로젝트 폼에 씁니다 | 다음 |
| 20 `confirmDialog` | 확인창(확인, 취소)입니다. 프로젝트 삭제에 씁니다 (목업 05) | 그다음 |
| 21 `promptDialog` | 입력창입니다. 회원 탈퇴 비밀번호에 씁니다 (목업 08). 이름 변경용은 만들지 않습니다 (Edit details 모달을 그대로 쓰기로 사용자가 결정) | 그다음 |

목업: `docs/page_mockups/sweetalert/` (01~16, 2026-10-07 사용자 검토)

**함께 넣은 것 (코드 외)**
| 파일 | 내용 |
|---|---|
| `static/vendor/sweetalert2/` | SweetAlert2 **v11.26.25** (MIT, `LICENSE` 포함)입니다. CDN 대신 파일로 넣었으므로 버전이 고정되고, 인터넷이 없어도 됩니다 |
| `static/css/dialog.css` | 모양을 정합니다 (home.html의 `.modal`, `.btn`, 토큰을 그대로 씁니다) |
| home, join, myPage, myProject, userInfo의 `.html` | `<link>` 두 줄을 넣었습니다 (라이브러리 CSS → `dialog.css` 순서) |

## 3. 코드
**import** (파일 맨 위)
```js
import Swal from '../../vendor/sweetalert2/sweetalert2.esm.min.js';
```

**함수**
```js
export async function showAlert(title, text, options = {}) {
  const tone = options.tone === 'error' ? 'error' : 'info';
  const openModal = document.querySelector('dialog[open]');
  let note;
  if (options.note) {
    note = document.createElement('span');
    note.textContent = options.note; // 글자 그대로 (footer 에 글자를 바로 주면 HTML 로 해석됨)
  }
  await Swal.fire({
    target: openModal || document.body,
    title: title,
    text: text || '',
    footer: note,
    confirmButtonText: options.confirmText || 'OK',
    buttonsStyling: false,          // 버튼 모양은 우리 .btn
    heightAuto: false,              // <html> · <body> 높이를 건드리지 않음
    scrollbarPadding: false,
    returnFocus: true,
    showClass: { popup: 'snx-dialog-in' },
    hideClass: { popup: 'snx-dialog-out' },
    customClass: {
      popup: 'snx-dialog snx-dialog--' + tone,
      title: 'snx-dialog__title',
      htmlContainer: 'snx-dialog__text',
      actions: 'snx-dialog__actions',
      footer: 'snx-dialog__note',
      confirmButton: 'btn btn--primary',
    },
  });
}
```

**최신 문법으로 쓰면** (공부용이며, 바뀌는 부분만 적었습니다)
```js
export async function showAlert(title, text = '', { tone = 'info', note, confirmText = 'OK' } = {}) {
  await Swal.fire({
    target: document.querySelector('dialog[open]') ?? document.body,
    title, text, confirmButtonText: confirmText,
    footer: note && Object.assign(document.createElement('span'), { textContent: note }),
    customClass: { popup: `snx-dialog snx-dialog--${tone === 'error' ? 'error' : 'info'}`, … },
    …
  });
}
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `text = ''` (매개변수 기본값) | `text: text \|\| ''` | 넘기지 않으면 빈 문자열입니다 |
| `{ tone = 'info' } = {}` (구조 분해 + 기본값) | `options = {}` + `options.tone === 'error' ? …` | 옵션에서 `tone`을 꺼냅니다 |
| `… ?? document.body` | `openModal \|\| document.body` | 없으면 body를 씁니다 |
| `{ title, text }` (속성 줄여 쓰기) | `title: title` | 이름이 같으면 한 번만 씁니다 |
| `` `snx-dialog--${tone}` `` | `'snx-dialog--' + tone` | 문자열을 잇습니다 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `import Swal from '…'` | 그 파일의 **기본 내보내기**(`export default`)를 `Swal`이라는 이름으로 받습니다. `{ }`가 없습니다 |
| `'../../vendor/…'` | `static/js/core/`에서 두 폴더 위(`static/`)로 올라가 `vendor/sweetalert2/`를 가리킵니다 |

| 식 | 뜻 |
|---|---|
| `Swal.fire({ … })` | 창을 띄우고, **창이 닫힐 때 끝나는 Promise**를 돌려줍니다. 그래서 `await`로 닫힐 때까지 기다릴 수 있습니다 |
| `document.querySelector('dialog[open]')` | 지금 열려 있는 `<dialog>`입니다 (없으면 `null`) |
| `target` | 창을 넣을 곳입니다 (SweetAlert2 옵션) |
| `text` | 설명을 **글자 그대로** 넣습니다 (`html` 옵션과 달리 태그를 해석하지 않습니다) |
| `footer: note` | 설명 아래 줄입니다. **문자열을 그대로 주면 HTML로 해석**되므로, `<span>`을 만들고 `textContent`로 넣은 요소를 넘깁니다. `note`가 `undefined`이면 줄이 생기지 않습니다 |
| `customClass` | SweetAlert2의 각 부분에 이 프로젝트의 클래스를 붙입니다. 그러면 `dialog.css`가 모양을 정합니다 |
| `buttonsStyling: false` | 라이브러리의 버튼 색을 끕니다. 그래서 `.btn btn--primary` 모양이 그대로 적용됩니다 |

## 4. 흐름
1. `tone`을 `'error'` 또는 `'info'`로 정합니다.
2. 열린 `<dialog>` 모달이 있는지 확인합니다.
3. 있으면 그 안에, 없으면 `<body>`에 창을 띄웁니다 (모양은 `dialog.css`가 정합니다).
4. OK, Enter, Esc, 바깥 클릭으로 닫히면 끝나고, 커서는 열기 전의 자리로 돌아갑니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 열린 모달 **안에** 띄움 (`target`) | `showModal()`로 연 모달은 브라우저의 맨 위층에 있고, 모달 밖은 눌리지 않습니다. body에 띄우면 알림창이 **모달 뒤에 깔려서 OK도 누를 수 없습니다**. 로그인 모달이 바로 그런 경우입니다 |
| 실제 Esc가 알림창만 닫음 | 시험으로 확인했습니다. 모달 안에 띄워도 Esc는 알림창만 닫고, 로그인 모달은 남습니다 |
| 라이브러리 파일을 저장소에 넣음 (CDN이 아님) | 버전을 고정하고 오프라인에서도 개발할 수 있습니다. 받은 파일에 특정 지역이나 도메인에서 다르게 동작하는 코드가 없는지도 확인했습니다 |
| `.btn btn--primary`와 토큰을 재사용 | 새 색을 만들지 않습니다. 라이트 모드에서도 토큰이 알아서 바뀝니다 |
| SweetAlert의 기본 아이콘과 튀는 확대 효과를 끔 | 수정 사항이 요구한 형식(제목, 설명, 확인)을 따릅니다. home.html의 모달처럼 살짝 올라오며 나타납니다 (움직임 줄이기 설정이면 효과가 없습니다) |
| `text`만 받음 (`html`이 아님) | 서버 오류 문구 등을 넣어도 HTML로 해석되지 않아서 안전합니다 |
| `heightAuto: false` | SweetAlert2는 기본적으로 `<html>`과 `<body>`의 높이를 바꾸므로, 홈 첫 화면의 배치가 흔들릴 수 있습니다 |
| 버튼 글자의 기본값은 `OK` | 사이트 글자는 영어입니다 (시퀀서만 다국어). 작은 화면 안내는 원래 모달처럼 "Got it"을 씁니다 |
| `note`를 버튼 **위**에 둠 (`dialog.css`의 `order`) | SweetAlert는 footer를 버튼 아래에 둡니다. 보충 설명을 읽은 뒤에 버튼을 누르게 하려고 순서를 바꿨습니다 |
| 휴대폰에서는 아래쪽 시트 (`dialog.css`, 600px 이하) | 작은 화면 안내(목업 09)는 휴대폰과 태블릿에서만 뜹니다. 엄지가 닿는 아래쪽에 48px 버튼을 둡니다. 다른 창도 휴대폰에서는 같은 모양입니다 |

## 6. 시험 (실제 home.html을 헤드리스 Chrome으로 열고 그 안에서 실행, 11개)
| 시험 | 확인한 것 |
|---|---|
| 기본 | 창, 제목, 설명, `OK`가 나오고, 버튼 클래스는 `btn btn--primary`이며, 커서가 OK에 있습니다 |
| 모양 | 제목 글꼴은 Unbounded, 모서리는 0px, 위쪽 선은 `rgb(163, 131, 255)`(`--c-violet-ink`)입니다 |
| 닫기 | OK를 누르면 창이 사라지고, Promise가 끝나며, 커서가 원래 자리로 돌아갑니다 |
| `tone: 'error'` | 위쪽 선이 `rgb(255, 138, 138)`(`--c-error`)입니다 |
| 설명에 `<b>…</b> <img onerror=…>`를 넣음 | 글자 그대로 보이고, 태그가 생기지 않습니다 |
| 로그인 모달이 열린 상태 | 창이 모달 안에 생기고, OK 자리에 실제로 OK가 보입니다 (가려지지 않습니다) |
| **실제 Esc 키** | 알림창만 닫히고, 로그인 모달은 열린 채이며, 커서는 Email 칸에 있습니다 |
| **실제 Enter 키** | 창이 닫히고, 모달은 그대로입니다 |
| `note`, `confirmText` (목업 반영 뒤 추가) | 작은 글씨 줄이 보이고 `<b>`가 글자 그대로 나오며, 줄이 버튼보다 위에 있고, 버튼 글자는 "Got it"입니다. `note`가 없으면 줄도 없습니다 |

처음에는 11개 모두 통과했고, `note`를 더한 뒤 14개 모두 통과했습니다. (Esc와 Enter는 브라우저 기본 동작까지 확인하려고 Chrome 개발 도구 기능으로 실제 키를 눌렀습니다.)
