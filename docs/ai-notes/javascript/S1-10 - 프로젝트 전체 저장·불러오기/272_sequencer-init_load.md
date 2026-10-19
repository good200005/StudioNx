# JavaScript 272 — 시퀀서 시작과 전체 불러오기 (`sequencer.js`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer.js` |
| 작업 | S1-10 프로젝트 전체 저장·불러오기: init · loadProject · initShortcuts · handleChange (PRD 02 FR-253~255) |
| 작성 | Claude (AI), 2026-10-19, 사용자 검토 |
| 이전 · 다음 | 271 저장 · 자동 저장 · 273 장치 전체 채우기와 이력 알림 |

## 1. 하는 일
시퀀서 화면의 시작점입니다. 명령·이력·저장을 먼저 세운 뒤, `GET /projects/{id}/full` 한 번으로 화면 전체를 채웁니다.

```text
init()
 ├─ initHistory · initSave · initPalette · initShortcuts
 ├─ setDeviceNotifier(handleChange)  ← 장치 알림 → 이력·저장
 ├─ readProjectId()  없으면 예시 화면 그대로
 ├─ requireLogin()
 └─ loadProject(projectId)
     ├─ api.get('/projects/{id}/full')
     ├─ applyProjectInfo(project)   ← BPM · Key · 박자
     ├─ applyPatterns(patterns)     ← 왼쪽 패턴 목록
     └─ applyFullProject(data)      ← 트랙·장치 그리기 (273)
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `studioNx.html` | `<script type="module" src="static/js/pages/sequencer.js">` 가 자동으로 부릅니다 |
| 브라우저 주소 | `studioNx.html?projectId=14431` 처럼 프로젝트 번호를 받습니다 |
| 메뉴·단축키 | `runCommand(command)` 가 `edit.undo` · `project.save` 등을 레지스트리에 넘깁니다 |

## 3. 코드
```javascript
export async function init() {
  initHistory({ toast: showToast });
  initSave({ toast: showToast });
  initPalette({ toast: showToast });
  initShortcuts();
  setDeviceNotifier(handleChange);

  const projectId = readProjectId();
  if (!projectId) return;
  setProjectId(projectId);
  if (!(await requireLogin())) return;
  try {
    await loadProject(projectId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return;
    showToast('Could not open this project — showing the example screen');
  }
}

export async function loadProject(projectId) {
  let data;
  try {
    data = await api.get('/projects/' + encodeURIComponent(projectId) + '/full');
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) { location.replace('errors/404.html'); return null; }
      if (err.status === 403) { location.replace('errors/403.html'); return null; }
      if (err.status >= 500) { location.replace('errors/500.html'); return null; }
    }
    throw err;
  }
  setProjectId(projectId);
  clearHistory();
  applyProjectInfo(data.project);
  applyPatterns(data.patterns);
  applyFullProject(data);
  return data;
}

export function handleChange(change) {
  if (!change || !change.type) return;
  switch (change.type) {
    case 'bpm': {
      const before = song.bpm;
      song.bpm = Number(change.bpm);
      pushHistory({ label: 'BPM ' + song.bpm, undo: () => applyBpmChange(before), redo: () => applyBpmChange(song.bpm) });
      queueSettings({ bpm: change.bpm });
      break;
    }
    case 'deviceUpdate':
      pushHistory({
        label: change.label || 'Change device',
        undo: () => reapplyDevice(change.trackId, change.kind, change.deviceId, change.before),
        redo: () => reapplyDevice(change.trackId, change.kind, change.deviceId, change.after),
      });
      markDirty('device');
      break;
    default:
      break;
  }
}

export function initShortcuts() {
  document.addEventListener('keydown', function (event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.target.closest && event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('dialog[open]')) return;
    const key = event.key.toLowerCase();
    if (key === 's' && !event.shiftKey) { event.preventDefault(); runRegistered('project.save'); }
    else if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
    else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo(); }
  });
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `readProjectId()` | `?projectId=14431` 에서 숫자만 꺼냅니다. 없으면 null (예시 화면) |
| `if (!projectId) return;` | 예시 화면에서는 저장·이력을 만들지 않습니다 (S1-09 결정 유지) |
| `requireLogin()` | 로그인 안 됐으면 `home.html#login?next=…` 으로 보냅니다 |
| `ApiError` + `err.status` | 404 · 403 · 500 은 각각 오류 페이지로 이동합니다 |
| `clearHistory()` | 프로젝트를 새로 열면 이전 이력을 버립니다 |
| `song` 상수 | BPM · Key 의 "지금 값". 되돌리기가 이전 값으로 돌아갑니다 |
| `runRegistered('project.save')` | 레지스트리의 `project.save` 를 실행합니다 |
| `event.target.closest('input, …')` | 입력창에 커서가 있으면 Ctrl+Z 를 무시합니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `init()` 이 항상 부르지 않음 | `studioNx.html` 이 모듈을 불러오면 `init()` 이 자동으로 실행됩니다 |
| `loadProject` 가 예외를 다시 던짐 | 404 · 403 · 500 은 오류 페이지로, 그 밖(네트워크 등)은 호출한 쪽이 처리합니다 |
| `handleChange` 가 한 곳 | 화면 모듈(편곡·피아노롤·화면·장치)의 변화를 한 곳으로 모아 이력·저장을 붙입니다 |
| `pushHistory` 안에서 `undo` / `redo` 정의 | 같은 값을 다시 넣는 함수를 바로 만들 수 있습니다 |

## 5. 시험
`docs/handoff/s1-10_tests/ui.mjs` 에서 `?projectId=14431` 로 열면 `#bpm` 칩이 서버 BPM 값으로 바뀌고, `#pattern-list` 가 패턴 목록으로 바뀌고, `#tracks` 아래에 서버 트랙 줄이 들어가는지 확인합니다. Ctrl+S → 저장, Ctrl+Z → 이펙트 값 되돌리기, Ctrl+Shift+Z → 다시 하기를 확인합니다.
