# JavaScript 327 — 박자 줄 편집 (`pages/sequencer-meter.js`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-meter.js` |
| 작업 | S1-18 박자 줄: 오토메이션 모드의 Meter 줄에서 박자 변경점을 더하고, 바꾸고, 지우고, 저장 |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 326 `GET /full` 의 박자, 다음 328 메트로놈의 박자 변경 |

## 1. 하는 일

Meter 줄을 마디 구간으로 나누어 보여 주고, 구간의 박자를 편집합니다. 첫 구간(마디 1부터)의 박자는 프로젝트 설정이라 이 줄에서 고치지 않습니다.

| 조작 | 결과 |
|---|---|
| 구간 안쪽 마디 클릭 | 그 마디부터 새 박자 구간을 만듭니다. 앞 구간 박자의 다음 항목으로 시작합니다. |
| 변경점이 시작하는 마디 클릭 | 박자를 다음 항목으로 바꿉니다. `Shift`는 이전 항목입니다. |
| `Alt`+클릭 | 그 변경점을 지웁니다. |

박자 목록은 `4/4, 3/4, 2/4, 5/4, 6/8, 7/8, 12/8, 6/4` 순서로 돕니다. 목록에 없는 박자에서 시작하면 첫 항목부터 돕니다.

```text
initMeterRow()                  본문에 클릭 연결, 첫 그림
setMeterRow(list, project)      서버 값과 프로젝트 박자를 받아 그림
renderMeterRow()                구간 div(.sq-global__seg)로 다시 그림
onClick → commit → record       목록 바꾸기, 화면 갱신, 저장 예약, 되돌리기 기록
```

## 2. 언제 쓰나

| 쓰는 곳 | 하는 일 |
|---|---|
| 시퀀서 시작 (`sequencer.js`) | `initMeterRow()`로 켭니다. |
| 프로젝트를 불러온 뒤 | `setMeterRow(data.meter_changes, data.project)`로 그립니다. |
| 오토메이션 모드로 전환 | `renderGlobalLanes`가 `setMeterRow`를 다시 부릅니다. |

## 3. 코드

### 3.1 구간 목록

```js
function segments() {
  const list = [{ tick: 0, num: base.num, den: base.den, base: true }];
  return list.concat(playbackMeterChanges());
}
```

기준 구간(마디 0)에 변경점을 이어 붙입니다. 구간의 끝은 다음 구간의 시작이고, 마지막 구간은 곡 길이보다 16마디 더 길게 그립니다.

### 3.2 클릭 처리

```js
const bar = barAt(e);
const startsHere = seg.tick / TICKS_PER_BAR === bar;
if (startsHere && !seg.base) { /* Alt 면 삭제, 아니면 박자 순환 */ }
if (startsHere || bar < 1) return;     // 기준 구간의 첫 마디는 프로젝트 설정
list.push({ tick: bar * TICKS_PER_BAR, num: to.num, den: to.den });
```

변경점은 항상 마디 경계(3840 tick)에 둡니다. 서버는 임의의 tick을 받지만 화면 격자가 4/4 마디로 고정되어 있어 마디 단위로만 찍게 했습니다.

### 3.3 저장과 되돌리기

```js
function commit(list) { changes = list.slice().sort(...); renderMeterRow(); scheduleSave(); }
function record(label, before, after) {
  pushHistory({ label: label, undo: function () { commit(before); }, redo: function () { commit(after); } });
}
```

저장은 400ms 모아서 `PUT /projects/{id}/meter-changes`로 통째로 보냅니다. 되돌리기와 다시 실행은 바꾸기 전후 목록을 그대로 `commit`합니다.

### 3.4 최신 문법으로 쓰면

```js
const seg = segs.findLast(s => s.tick / TICKS_PER_BAR <= bar);
const to = PRESETS[((i < 0 ? 0 : i) + step + n) % n];
```

| 실제 코드 | 최신 문법 |
|---|---|
| `for` 문으로 마지막 구간 찾기 | `findLast` |
| `function () {}` 콜백 | 화살표 함수 |

## 4. Q&A

Q. 마디 길이가 실제로 바뀌나요?
A. 아닙니다. 눈금자와 클립 격자는 4/4 마디(3840 tick)로 고정이라 격자 폭은 그대로입니다. 줄과 서버에는 박자 정보가 남고, 메트로놈 계산이 그 정보를 읽습니다 (328).

Q. 새로 열면 되돌리기 기록이 남나요?
A. 아닙니다. 프로젝트를 다시 열면 기록은 비워집니다.
