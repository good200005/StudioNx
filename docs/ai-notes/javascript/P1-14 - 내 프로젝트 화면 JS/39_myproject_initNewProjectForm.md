# JS 39 — `initNewProjectForm()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/myproject.js` |
| 작업 | P1-14 내 프로젝트 화면 — 새 프로젝트 만들기 · PRD 01 FR-122 · FR-126 · FR-129 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [38 `initDesktopOnlyLinks()`](38_studio_initDesktopOnlyLinks.md) · [40 `initEditProjectForm()`](40_myproject_initEditProjectForm.md) |

## 1. 하는 일
New project 모달에서 **Create project** 를 누르면 서버에 프로젝트를 만들고(`POST /projects`, P1-13 59), 화면 폭에 따라 다음으로 이어간다.

| 상황 | 결과 |
|---|---|
| 넓은 화면 (1280 이상) | 누른 순간 **빈 새 창** → 응답이 오면 그 창이 `studioNx.html?projectId=…&new=1` (시퀀서 "새 프로젝트" 로딩) |
| 좁은 화면 | 창 없이 **"… is saved."** 안내 (36 `created`) |
| 둘 다 | 모달 닫힘 · 폼 비움 · 검색 · 정렬을 기본으로 되돌리고 목록을 다시 받음 → **새 프로젝트가 맨 위** |
| 제목이 공백뿐 | 보내지 않고 `Enter a title.` |
| BPM 10 (20~999 밖) 등 | 브라우저 검사에서 멈춤 → 알림창 (FIX-01 `initFormAlerts`) · 보내지 않음 |
| 서버 오류 | 미리 연 빈 창을 **닫고** 모달 안에 서버 문구 · 입력값은 그대로 |
| 보내는 동안 | Create 버튼 잠금 (두 번 눌러 두 개 만들어지지 않게) |

보내는 값: `{ title, description(없으면 null), bpm(숫자), time_sig_num, time_sig_den }` — 박자 칸의 `'7/8'` 을 7 과 8 로 나눔.

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 페이지 시작 (`myproject.js` 맨 아래, 이미 있음) | `initNewProjectForm();` — 폼에 한 번 걸어 둠 |

모달은 `New project` 버튼의 `command="show-modal"` 이 연다 (HTML). 이 함수는 **보내기**만 맡는다.

## 3. 코드
**import** (`myproject.js` 맨 위)
```js
import { initAuthState } from '../core/auth-ui.js';
import { requireLogin, logout, loginUrl } from '../core/auth.js';
import { api } from '../core/api.js';
import { initModalFallback } from '../core/modal.js';
import { canOpenStudio, showDesktopOnly, initDesktopOnlyLinks, openStudio, openBlankStudio } from '../core/studio.js';
import { includePartials } from '../core/include.js';
import { initFormAlerts } from '../core/dialog.js';
```
**`openBlankStudio` 를 이번에 추가했다.** 이 함수는 `api`(P1-02) · `canOpenStudio`(35) · `showDesktopOnly`(36) · `openStudio` · `openBlankStudio`(37) 와 같은 파일의 `refreshList`(33) 를 쓴다.

**함수**
```js
export function initNewProjectForm() {
  const form = document.getElementById('new-project-form');
  if (!form) return;
  const modal = document.getElementById('new-project-modal');
  const error = document.getElementById('new-project-error');
  const submit = form.querySelector('[type="submit"]');
  const showError = function (message) {
    error.textContent = message;
    error.hidden = false;
  };

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const title = document.getElementById('new-title').value.trim();
    const description = document.getElementById('new-description').value.trim();
    const sig = document.getElementById('new-sig').value.split('/');   // '7/8' → ['7', '8']
    error.hidden = true;
    if (!title) {
      showError('Enter a title.');
      return;
    }

    // 넓은 화면: 클릭한 지금 빈 창을 열어 둠 (응답 뒤에 열면 팝업으로 막힘 — 37)
    const wide = canOpenStudio();
    const win = wide ? openBlankStudio() : null;
    submit.disabled = true;
    let project;
    try {
      project = await api.post('/projects', {
        title: title,
        description: description ? description : null,
        bpm: Number(document.getElementById('new-bpm').value),
        time_sig_num: Number(sig[0]),
        time_sig_den: Number(sig[1]),
      });
    } catch (err) {
      if (win) win.close();
      showError(err.message);
      return;
    } finally {
      submit.disabled = false;
    }

    // 성공 — 모달 닫고 폼 비우기
    if (modal && modal.open) modal.close();
    form.reset();
    if (wide) {
      openStudio(project.project_id, { isNew: true, win: win });
    } else {
      showDesktopOnly('created', project.title);
    }

    // 목록은 기본 조건(최근 수정순 · 검색 없음)으로 — 새 프로젝트가 맨 위
    const query = document.getElementById('project-query');
    const sort = document.getElementById('project-sort');
    if (query) query.value = '';
    if (sort) sort.value = 'updated';
    refreshList({ query: '', sort: 'updated', page: 1 });
  });
}
```

**최신 문법으로 쓰면** (공부용 — 바뀌는 부분만)
```js
const [num, den] = document.getElementById('new-sig').value.split('/').map(Number);
project = await api.post('/projects', { title, description: description || null, bpm: +bpmField.value, time_sig_num: num, time_sig_den: den });
win?.close();
openStudio(project.project_id, { isNew: true, win });
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `const [a, b] = 배열` | `sig[0]` · `sig[1]` | 배열에서 꺼내기 |
| `.map(Number)` | `Number(sig[0])` 따로 | 모두 숫자로 |
| `{ title }` · `{ win }` | `{ title: title }` · `{ win: win }` | 줄임 속성 |
| `x \|\| null` | `x ? x : null` | 비었으면 null |
| `win?.close()` | `if (win) win.close()` | 있을 때만 |

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `import { …, openBlankStudio } from '../core/studio.js'` | 클릭 때 빈 시퀀서 창을 미리 여는 함수 (37) |

| 식 | 뜻 | 예 |
|---|---|---|
| `form.addEventListener('submit', async function (event) { … })` | Enter · Create 를 누르면 (브라우저 검사를 통과한 뒤에만 불림) | |
| `'7/8'.split('/')` | `/` 로 나눔 | `['7', '8']` |
| `Number('128.5')` | 글자 → 숫자 | 128.5 |
| `try { … } catch { … } finally { … }` | 실패하면 catch, **성공 · 실패 모두** 끝에 finally | 버튼 잠금 풀기 |
| `catch` 안의 `return` 뒤에도 `finally` 실행 | | |
| `form.reset()` | 칸을 HTML 처음 값으로 (제목 빈 칸 · BPM 120 · 4/4) | |
| `modal.close()` | `<dialog>` 닫기 | |

## 4. 흐름
1. 기본 보내기(페이지 이동) 막기 → 제목 공백이면 문구 후 끝.
2. 넓은 화면이면 **지금** 빈 창 열기 (기다리기 전).
3. 버튼 잠금 → `POST /projects`.
4. 실패: 빈 창 닫기 · 문구 · 버튼 풀기.
5. 성공: 모달 닫기 · 폼 비우기 → 넓으면 빈 창을 시퀀서로, 좁으면 "saved" 안내 → 검색 · 정렬 칸을 기본으로 → 목록 다시 받기(33 `refreshList`).

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 빈 창을 **await 전에** | 응답 뒤에 열면 팝업 차단 (37) |
| 실패하면 빈 창 닫기 | 빈 흰 창이 남지 않게 (시험 05 에서 창 수가 그대로임을 확인) |
| 공백 제목은 보내지 않음 | `required` 는 공백 한 칸도 통과시킴 → 서버 422 의 영어 검사 문구보다 짧고 분명하게 |
| 검사는 브라우저에 맡김 (BPM 범위 · 필수) | HTML 의 `min` · `max` · `required` 가 이미 있고, FIX-01 이 말풍선 대신 알림창으로 보여 줌 |
| 만든 뒤 검색 · 정렬을 기본으로 | 검색 중(`zzz`)이었다면 새 프로젝트가 목록에 안 보임 → "맨 위에 보인다" (템플릿) 를 지키려고. 검색 칸 · 정렬 칸 글자도 함께 비움 |
| 좁은 화면은 "saved" 안내 | 시퀀서를 못 여는 화면 — 만들어졌다는 것과 컴퓨터에서 열면 된다는 것을 알려 줌 (FR-129) |
| 목록 창은 그대로 | 새 창으로 시퀀서가 열리고, 이 창은 갱신된 목록으로 남음 (템플릿) |

## 6. 시험 (실제 myProject.html · 실제 서버 · 헤드리스 Chrome · 7개)
New project 버튼으로 모달을 열고 칸을 채운 뒤 보냈다 ("사용자가 누른 것" 으로). 열린 창은 Chrome 창 목록으로 확인했다.

| # | 한 일 | 결과 |
|---|---|---|
| 01 | 1280 · `'  New Wave '` · 설명 · 128.5 · 7/8 | 새 창 `studioNx.html?projectId=…&new=1` · 모달 닫힘 · 제목 칸 비움 · 목록 맨 위 `New Wave` · 서버 저장값 제목 `New Wave` · 설명 · bpm `128.50` · `7/8` |
| 02 | 검색 `zzz` (0개) 중에 `Second` 만들기 | 목록이 기본으로 → `Second, New Wave, Old One` · 주소 `?query=zzz` → 없음 · 검색 칸 비움 |
| 03 | 1024 · `Phone Idea` · 3/4 | 새 창 없음 · "Phone Idea is saved." 안내 · 목록 맨 위 |
| 04 | 제목 공백 | `Enter a title.` · 요청 0 · 창 없음 · 모달 그대로 |
| 05 | 서버 500 (가짜) | 문구 `Something went wrong. Please try again.` · 빈 창 닫혀 창 수 그대로 · 버튼 풀림 · 입력값 그대로 |
| 06 | 응답을 0.8초 늦춤 | 보내는 동안 버튼 잠김 → 끝나면 풀림 · 요청 1번 |
| 07 | BPM 10 | 요청 0 · 알림창(FIX-01) |

### 캡처
좁은 화면에서 만든 뒤:

![narrow](../../images/javascript_p1-14/39_03_narrow.png)

공백 제목:

![blank](../../images/javascript_p1-14/39_04_blank.png)
