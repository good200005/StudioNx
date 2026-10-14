# JS 144 — 클립 왼쪽 끝 트리밍 배선 (`initClipDrag` 확장)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 서른 번째 작업 (FR-208 오디오 트리밍, `offset_tick`) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 클립 복제(Ctrl+D, `duplicateClipStart`) 배선을 이어서 진행합니다 |

## 1. 하는 일
클립 **왼쪽 끝 6px 안쪽**을 잡으면 **트리밍**이 됩니다. 시작·길이·오프셋 세 값이 함께 움직여, 오디오는 화면에서 소리가 제자리에 고정된 채 잘립니다.

```
[■■■■■■■ Vocal ]      ← 왼쪽 끝을 오른쪽으로 (앞을 잘라냄)
    [■■■■ Vocal ]      ← 시작 +3, 길이 -3, offset +3 (원본에서 3만큼 더 건너뜀)
```

- 줄이기: 오른쪽 조절과 같은 규칙. 최소 한 칸이고, Alt 면 1틱까지.
- 늘리기: **원본 처음**과 **마디 0** 에 닿을 때까지만. MIDI(원본 없음)는 마디 0 까지 자유롭게, 오프셋은 늘 0.
- 오디오 클립(`sq-clip--audio`)은 `start − offset` 을 원본 처음으로 봐서 그보다 왼쪽으로는 못 갑니다.
- 끄는 동안 `is-resizing`(오른쪽 조절과 같은 표시)을 붙입니다.

| 클립 | 늘리기 한계 | 오프셋 |
|---|---|---|
| 오디오 | `start − offset` (`sourceStartTick`) | 자른 만큼 증가 (`--o`) |
| MIDI | 마디 0 | 항상 0 |

## 2. 코드
잡았을 때 — 모드와 원본 처음
```js
const onLeft = e.clientX - rect.left <= EDGE_PX;    // 왼쪽 끝 손잡이 = 트리밍
const onRight = rect.right - e.clientX <= EDGE_PX;  // 오른쪽 끝 손잡이 = 길이 조절
drag = {
  clip, multi, wasSelected,
  mode: onRight ? 'resize' : onLeft ? 'trim' : 'move',
  id: e.pointerId, x: e.clientX, scrollLeft: scroll.scrollLeft,
  group: selected().map((c) => ({
    clip: c,
    start: parseFloat(c.style.getPropertyValue('--s')) || 0,
    length: parseFloat(c.style.getPropertyValue('--l')) || 1,
    offset: parseFloat(c.style.getPropertyValue('--o')) || 0,
  })),
  moved: false,
};
drag.primary = drag.group.find((g) => g.clip === clip);
// 오디오는 원본 처음이 타임라인 어디인지(start − offset)를 알아야 늘리기 한계를 지킴. MIDI 는 원본이 없어 null
drag.sourceStartTick = clip.classList.contains('sq-clip--audio')
  ? barsToTicks(drag.primary.start) - barsToTicks(drag.primary.offset)
  : null;
```
끄는 중 — 클립을 트리밍할 때 실행되는 코드
```js
if (drag.mode === 'trim') {
  const stepTicks = barsToTicks(snapUnit(e.altKey));
  const deltaTicks = barsToTicks(dx / barWidth(lanes));
  const res = trimClipLeft(barsToTicks(drag.primary.start), barsToTicks(drag.primary.length), deltaTicks, stepTicks, drag.sourceStartTick);
  drag.primary.clip.style.setProperty('--s', round(ticksToBars(res.start)));
  drag.primary.clip.style.setProperty('--l', round(ticksToBars(res.length)));
  drag.primary.clip.style.setProperty('--o', round(ticksToBars(res.offset)));
  edgeScroll(scroll, e.clientX);
  return;
}
```
놓을 때 — 알림(`onChange`)
```js
} else if (mode === 'trim') {
  clip.classList.remove('is-resizing');
  const start = parseFloat(clip.style.getPropertyValue('--s'));
  const length = parseFloat(clip.style.getPropertyValue('--l'));
  const offset = parseFloat(clip.style.getPropertyValue('--o')) || 0;
  if (start !== drag.primary.start || length !== drag.primary.length) onChange({ type: 'trim', clip, trackId: clip.closest('.sq-track').dataset.trackId, start, length, offset });
}
```
**최신 문법으로 쓰면** (공부용)
```js
drag.sourceStartTick = clip.classList.contains('sq-clip--audio')
  ? barsToTicks(drag.primary.start) - barsToTicks(drag.primary.offset)
  : null;
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `a ? b : c` | 같은 코드 | 여기서는 그대로 씁니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `trimClipLeft()` 재사용 | 세 값(시작·길이·오프셋)을 함께 움직이는 규칙을 이미 시험했습니다(123). 화면은 결과만 씁니다 |
| `start − offset` 로 원본 처음 구함 | 오디오는 앞을 잘라도 소리 위치가 고정돼야 합니다. 원본 기준점을 알아야 그 왼쪽으로 못 늘립니다 |
| MIDI 는 `null` | 원본 소스가 없어 마디 0 까지 자유롭게 늘려도 됩니다. 오프셋은 개념이 없어 0 |
| 오른쪽(143)과 같은 `EDGE_PX` | 두 손잡이가 같은 폭이라 잡는 느낌이 일정합니다 |
| 오른쪽 조절 코드를 먼저 냄 | 같은 `initClipDrag` 안에서 경우(모드)만 늘리는 방식이라, 되돌리기 쉽고 충돌이 없습니다 |

## 4. 시험
**(1) Node 단위 시험** — 모듈 적재 확인(11개 통과). `trimClipLeft` 자체는 123에서 통과.

**(2) 브라우저 확인(Chrome headless + CDP 실제 마우스 이벤트, 실제 `studioNx.html`)** — 클립 왼쪽 끝을 잡고 끌었습니다.
| 확인 | 결과 |
|---|---|
| MIDI 왼쪽 끝을 오른쪽으로 → 시작 8 → 11, 길이 4 → 1(최소 한 칸), 오프셋 0 유지 | ✔ |
| MIDI 왼쪽 끝을 왼쪽으로 → 시작 0(마디 0 한계), 길이 12, 오프셋 0 | ✔ |
| 오디오 왼쪽 끝을 오른쪽으로 → 시작 2 → 7, 길이 10 → 5, **오프셋 0 → 5** (원본에서 더 건너뜀) | ✔ |
| 끄는 동안 `is-resizing` 표시(오른쪽 길이 조절과 같은 표시) | ✔ |
