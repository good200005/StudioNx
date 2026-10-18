# JavaScript 243 — 시작 (`initDevices`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 두 모드를 가르고 첫 그림을 그립니다 (FR-241 · FR-251 · FR-252) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 242 백엔드 필터 목록 끝 · 244 주소의 프로젝트 번호와 플러그인 표 |

## 1. 하는 일
`initDevices` 는 스튜디오 화면이 열릴 때 한 번 불립니다. 주소의 `?projectId=` 를 읽어 **실제 모드**와 **데모 모드**를 가르고, 플러그인 표와 트랙 목록을 읽어 화면을 그린 다음 이벤트를 배선합니다. 실제 모드에서는 칸에 `.is-live` 가 붙어 `sequencer-ui.js` 의 예시 배선과 겹치지 않습니다.

```
initDevices
  ├─ readProjectId()          ?projectId= 가 있으면 실제 모드
  ├─ wireCells(#lanes)        칸 안 누름과 끌기
  ├─ wireDialogs()            고르기 창과 상세 모달
  ├─ wireDemoControls()       예시 화면 노브와 페이더만 화면에서 움직이기
  ├─ loadPlugins() → loadTracks()
  ├─ renderTracks()           #tracks 다시 그리기
  ├─ restoreOpenPanels()      담아 둔 펼침 되살리기 (FR-261)
  ├─ ensureLiveCells(...)     펼쳐 둔 트랙 칸 채우기
  └─ preloadDevices(tracks)   줄 아래 악기 이름 미리 읽기
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `sequencer.js` | 페이지가 뜰 때 `initDevices({ onChange: ... })` 를 부릅니다 |
| `onChange` | 칸 안에서 값이 바뀌면 arrange 쪽에 알리는 함수입니다 |

## 3. 코드
```js
export function initDevices(options) {
  const onChange = (options && options.onChange) || function () {};
  projectId = readProjectId();
  active = projectId !== null;

  wireCells(document.getElementById('lanes'), onChange);
  wireDialogs();
  wireDemoControls(document);

  loadPlugins()
    .then(function () {
      if (!active) return null;
      return loadTracks();
    })
    .then(function () {
      if (!active) return;
      renderTracks();
      // FR-261 — 예시 줄을 갈아 끼운 뒤라, 담아 둔 펼침 상태를 실제 트랙 줄에 다시 적용합니다
      restoreOpenPanels();
      Array.prototype.forEach.call(document.querySelectorAll('#tracks > .sq-track.is-open'), ensureLiveCells);
      // 트랙 줄 · 믹서 줄의 악기 이름을 바로 보여 주기 위해 값을 미리 모읍니다
      preloadDevices(tracks).then(syncTrackSubs);
    })
    .catch(function (err) {
      if (err instanceof ApiError && err.status === 401) return;
      active = false;
      showToast('Could not read this project — showing the example screen');
      if (window.console) console.warn('[devices]', err);
    });
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `options && options.onChange` | 넘어온 알림 함수가 없으면 빈 함수를 씁니다 |
| `active = projectId !== null` | 주소에 번호가 있으면 실제 모드입니다 |
| `.then(function () { ... })` | 앞 단계가 끝난 뒤 이어서 실행합니다 |
| `#tracks > .sq-track.is-open` | 펼쳐 둔 트랙 줄만 골라 칸을 채웁니다 |
| `preloadDevices(tracks).then(syncTrackSubs)` | 미리 읽기가 끝나면 줄 아래 악기 이름을 다시 씁니다 |
| `err.status === 401` 이면 `return` | 로그인이 풀린 경우는 예시 화면으로 바꾸지 않습니다 |
| 마지막 `catch` | 그 밖의 오류는 예시 화면으로 되돌리고 알립니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 플러그인을 먼저 읽음 | 카드에 플러그인 이름과 파라미터를 붙이려면 표가 먼저 있어야 합니다 |
| 그린 뒤 펼침을 복원 | `renderTracks` 가 줄을 갈아 끼우므로 담아 둔 펼침은 그 뒤에 적용합니다 |
| 실패해도 예시 화면 | 서버가 없거나 권한이 없어도 화면이 비지 않게 합니다 |
| 401 은 그대로 둠 | 로그인 만료는 로그인 화면이 맡습니다 |

## 5. 시험
헤드리스 Chrome 시험에서 계정으로 로그인한 뒤 `?projectId=14431` 로 열어 트랙 5줄과 MASTER 1줄이 그려지고, 줄 아래에 악기 이름이 보이며, 자바스크립트 오류가 0건인 것을 확인했습니다. `projectId` 없이 열면 예시 트랙 2줄과 예시 칸이 그대로 남는 것도 확인했습니다.
