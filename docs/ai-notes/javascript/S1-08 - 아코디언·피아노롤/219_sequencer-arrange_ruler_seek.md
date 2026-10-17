# JavaScript 219 — 마디 눈금 클릭으로 플레이헤드 (`rulerBar` · `initPan`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-08 아코디언·피아노롤: 사용자 요구 2번 (마디 눈금 클릭 → 플레이헤드 이동) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 218 패턴 라우터(노트·수정) · 220 겹쳐 찍기 |

## 1. 하는 일
편곡 화면 위쪽 **마디 눈금**(`.sq-ruler__bars`) 줄을 클릭하면 그 자리로 플레이헤드가 옮겨집니다. 끌지 않고 그냥 누른 경우만 반응하고, 끌면 기존의 좌우 이동(팬)이 됩니다. `Alt` 를 누르면 격자에 붙이지 않고 Free 로 놓습니다.

```
눈금 줄 pointerdown → pan.ruler 에 그 줄을 기억
pointerup (안 끌었을 때) → setPlayheadBar(clamp(rulerBar(...), 0, totalBars))
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 편곡 화면 | 재생을 멈춘 채 원하는 마디로 바로 점프해 확인할 때 |
| 사용자 요구 2번 | "마디 눈금 클릭하면 재생 위치가 그쪽으로 이동" |

## 3. 코드
```js
/** 마디 눈금에서 클릭한 x → 마디 (눈금 줄 왼쪽 = 0마디, Alt 면 스냅 없이). 클릭 = 플레이헤드 옮기기 */
function rulerBar(barEl, clientX, free, lanes) {
  return snap((clientX - barEl.getBoundingClientRect().left) / barWidth(lanes), free);
}
```
```js
function initPan({ scroll, lanes }) {
  const PAN_AREA = '.sq-ruler__bars, .sq-markers__track, .sq-track__lane, .sq-fill__lane';
  let pan = null;

  scroll.addEventListener('pointerdown', (e) => {
    const middle = e.button === 1;
    if (!middle && e.button !== 0) return;
    if (!middle && (!e.target.closest(PAN_AREA) || e.target.closest('button, .sq-auto, .sq-loop'))) return;
    // …도구별 예외(영역 선택·툴 동작)는 그대로 통과…
    pan = {
      x: e.clientX, left: scroll.scrollLeft, id: e.pointerId, moved: false,
      clear: !middle && !e.ctrlKey && !e.metaKey && !!e.target.closest('.sq-track__lane, .sq-fill__lane'),
      // 마디 눈금을 그냥 클릭(끌지 않음) → 플레이헤드를 그 자리로 (FR-2331)
      ruler: !middle ? e.target.closest('.sq-ruler__bars') : null,
      draw: !middle && currentTool === 'draw' ? { lane: e.target.closest('.sq-track__lane'), x: e.clientX, free: e.altKey } : null,
    };
    if (middle) e.preventDefault();
  });
  // …pointermove 는 scroll.scrollLeft 를 움직이는 팬…
  const end = (e) => {
    if (!pan || e.pointerId !== pan.id) return;
    if (pan.moved) scroll.releasePointerCapture(e.pointerId);
    else if (pan.ruler) setPlayheadBar(clamp(rulerBar(pan.ruler, e.clientX, e.altKey, lanes), 0, totalBars(lanes)));
    else if (pan.draw?.lane && drawClipAt(pan.draw.lane, pan.draw.x, pan.draw.free)) { /* 놓음 */ }
    else if (pan.clear) clearSelection(scroll);
    scroll.classList.remove('is-panning');
    pan = null;
  };
  scroll.addEventListener('pointerup', end);
  scroll.addEventListener('pointercancel', end);
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `barEl.getBoundingClientRect().left` | 눈금 줄의 화면상 왼쪽 좌표입니다 |
| `(clientX - left) / barWidth(lanes)` | 클릭한 x 를 마디 수로 바꿉니다 |
| `snap(값, free)` | 격자에 붙입니다. `free`(Alt)면 그대로 둡니다 |
| `pan.ruler` | 누른 대상이 눈금 줄이면 그 줄을 기억합니다 (아니면 `null`) |
| `!pan.moved` | 끌지 않은(그냥 누른) 경우만 플레이헤드를 옮깁니다 |
| `clamp(v, 0, totalBars(lanes))` | 0 ~ 전체 마디 사이로 값을 가둡니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 끌면 팬, 안 끌면 점프 | 같은 줄에서 좌우 이동도 자주 씁니다. 끌었는지로 둘을 가릅니다 |
| `pointerup` 에서 판단 | 누르는 순간 움직이면 스크롤하려다 실수로 재생 위치가 바뀝니다 |
| `pan.ruler` 를 미리 기억 | `pointerup` 의 대상(`e.target`)은 누른 요소가 아닐 수 있어, 누를 때 기억해 둡니다 |

## 5. 시험
헤드리스 브라우저에서 눈금 4마디 지점을 클릭 → 플레이헤드 `--at` 값이 처음 값에서 `4` 로 바뀌는 것을 확인했습니다(콘솔 오류 0건).
