# JavaScript 323 — 템포 줄 편집 (`pages/sequencer-tempo.js`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-tempo.js` |
| 작업 | S1-16 템포 줄: 오토메이션 모드의 Tempo 줄에서 템포 변경점을 찍고, 끌고, 지우고, 저장 (S1-17에서 되돌리기 추가) |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 322 재생 연결, 다음 없음 |

## 1. 하는 일

오토메이션 모드(`Automation (A)`)에서 보이는 Tempo 줄을 실제로 편집할 수 있게 합니다. 점 하나가 변경점 하나입니다.

| 조작 | 결과 |
|---|---|
| 빈 곳 클릭 | 그 위치에 변경점을 추가합니다. 가로는 스냅 단위에 맞고, 세로는 BPM이 됩니다. |
| 점 끌기 | 위치(tick)와 BPM을 바꿉니다. 앞뒤 점을 넘어가지 않습니다. |
| `Shift`+점 클릭 | 그 변경점의 전환 방식을 `STEP`과 `LINEAR`로 번갈아 바꿉니다. |
| 점 더블클릭 | 변경점을 지웁니다. |
| `Alt` 누르고 찍기, 끌기 | 스냅 없이 1 tick 단위로 움직입니다. |
| `Shift` 누르고 찍기, 끌기 | BPM을 0.1 단위로 정합니다. 평소에는 정수입니다. |

마디 0의 첫 점은 상단 BPM 칩의 값입니다. 점은 보이지만 이 줄에서는 고치지도 지우지도 않습니다.

```text
initTempoRow()                  본문에 pointer 이벤트 연결, 첫 그림
  pointerdown → onDown           빈 곳이면 추가, 점이면 끌기 시작 (Shift 면 램프 전환)
  pointermove → onMove           끄는 동안 목록과 그림 갱신
  pointerup   → onUp             끝나면 저장 예약
  dblclick    → onDouble         삭제
setTempoRow(list)               서버 값을 받아 그림
renderTempoRow()                현재 목록으로 다시 그림
```

## 2. 언제 쓰나

| 쓰는 곳 | 하는 일 |
|---|---|
| 시퀀서 시작 (`sequencer.js`) | `initTempoRow()`로 켭니다. |
| 프로젝트를 불러온 뒤 | `setTempoRow(data.tempo_changes)`로 서버 값을 그립니다. |
| 상단 BPM이 바뀔 때 (`applyBpm`) | `renderTempoRow()`로 기준 점을 다시 그립니다. |
| 재생과 내보내기 | `sequencer-devices.js`의 목록을 읽으므로 고친 즉시 반영됩니다 (S1-13). |

## 3. 코드

### 3.1 점 목록과 세로 범위

```js
function allPoints() {
  const list = [{ tick: 0, bpm: baseBpm(), ramp: 'STEP', base: true }];
  return list.concat(playbackTempoChanges());
}

function rangeOf(points) {
  if (frozen) return frozen;
  // 가장 낮은 BPM과 높은 BPM에 위아래 여유 30을 주고, 10 단위로 맞춤. 폭은 최소 80
}
```

세로 범위는 점의 BPM에서 계산합니다. 점을 끄는 동안에는 `frozen`에 범위를 붙잡아 두어, 점이 움직일 때 화면 전체가 같이 출렁이지 않게 합니다.

### 3.2 그리기 `renderTempoRow`

본문을 비우고 `<svg><polyline>`과 점 버튼(`.sq-global__pt`), 값 글자(`.sq-global__lab`)를 새로 만듭니다.

- `STEP`: 앞 점의 BPM으로 가로로 가다가 이 점의 틱에서 수직으로 꺾입니다.
- `LINEAR`: 앞 점에서 이 점까지 비스듬히 이어집니다 (S1-13의 재생 계산과 같은 뜻입니다).
- 첫 점은 `.is-base`를 달아 다르게 보이게 합니다.
- 가로 길이는 마지막 변경점 뒤로 16마디, 최소 64마디입니다.

### 3.3 찍기, 끌기, 지우기

`locate(e)`가 포인터 위치를 마디(소수)와 세로 퍼센트로 바꾸고, `snapTick`이 스냅 단위(`getSnap()`)에 맞춥니다. 같은 틱에 이미 점이 있으면 새로 찍지 않습니다.

`onUp`은 끌지 않고 눌렀다 뗀 경우 다시 그리지 않습니다. 다시 그리면 버튼이 새로 만들어져 더블클릭의 두 번째 클릭이 끊기기 때문입니다.

### 3.4 저장 `scheduleSave`

```js
api.put('/projects/' + pid + '/tempo-changes', { changes: playbackTempoChanges() })
```

400ms 안에 이어진 편집은 한 번으로 모아 보냅니다. 서버는 목록을 통째로 바꿔 저장합니다 (S1-13). 저장에 실패하면 콘솔에 경고만 남깁니다.

### 3.5 되돌리기 `record` (S1-17)

```js
function record(label, before, after) {
  pushHistory({
    label: label,
    undo: function () { commit(before, true); },
    redo: function () { commit(after, true); },
  });
}
```

추가, 끌기, 램프 전환, 삭제가 끝날 때마다 바꾸기 전 목록(`before`)과 후 목록(`after`)을 `sequencer-history.js`에 기록합니다. 되돌리기와 다시 실행은 그 목록을 그대로 `commit`하므로 화면, 재생 목록, 서버 저장이 함께 돌아갑니다. 끌기는 놓을 때 한 번만 기록하고, 움직이지 않고 뗀 경우는 기록하지 않습니다. `Ctrl+Z`와 `Ctrl+Shift+Z`, 메뉴의 EDIT 항목이 그대로 쓰입니다.

### 3.6 최신 문법으로 쓰면

```js
const baseBpm = () => parseFloat(document.getElementById('bpm')?.textContent) || 120;
const btn = e.target.closest?.('.sq-global__pt');
```

| 실제 코드 | 최신 문법 | 이유 |
|---|---|---|
| `el ? parseFloat(el.textContent) : NaN` | `parseFloat(el?.textContent)` | 프로젝트 규칙상 `?.`를 쓰지 않습니다. |
| `e.target.closest ? e.target.closest(...) : null` | `e.target.closest?.(...)` | 같은 이유입니다. |

## 4. 흔한 질문

Q. 첫 점은 왜 못 끄나요?
A. 곡의 시작 BPM은 프로젝트 BPM이어서 상단 칩에서 바꿉니다. 이 줄은 그 뒤의 변경점만 다룹니다.

Q. 실행 취소가 되나요?
A. 됩니다 (S1-17). 프로젝트를 다시 열면 기록은 비워집니다.

Q. 박자(Meter) 줄은요?
A. 서버에 박자 변경 모델이 없고, 마디 길이가 바뀌면 눈금자와 스냅 계산이 모두 달라지므로 따로 다룹니다.
