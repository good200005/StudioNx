# JS 143 — 클립 오른쪽 길이 조절 배선 (`initClipDrag` 확장)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 스물아홉 번째 작업 (FR-208 클립 오른쪽 길이 조절) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 왼쪽 끝 트리밍(`trimClipLeft`, offset_tick) 배선을 이어서 진행합니다 |

## 1. 하는 일
클립 **오른쪽 끝 6px 안쪽**을 잡으면 옮기기가 아니라 **길이 조절**이 됩니다. 끌면 격자에 맞춰 길이가 늘고 주는데, **최소 한 칸**보다 짧아지지 않습니다(더 끌어도 삭제되지 않고 멈춤).

```
[■■■■ Kick        ]        ← 오른쪽 끝을 오른쪽으로 끌기
[■■■■■■■■ Kick    ]        ← 격자에 맞춰 길어짐 (min = 한 칸)
[■ Kick           ]        ← 왼쪽으로 끝까지 끌어도 한 칸에서 멈춤
```

- 잡은 자리: 클립 끝에서 6px 안쪽(`EDGE_PX`)이면 조절, 그 밖은 기존대로 옮기기.
- 옮기기는 여러 클립을 함께 옮기지만, 길이 조절은 **잡은 클립 하나만** 바뀝니다.
- Alt 를 누른 채 끌면 격자를 무시하고 1틱까지 줄일 수 있습니다(`snapUnit` 규칙 그대로).
- 끄는 동안 클립에 `is-resizing`(CSS가 좌우 화살표 커서·손잡이 색을 켬)을 붙입니다.

## 2. 코드
`EDGE_PX` 상수 (파일 위쪽)
```js
/** 클립 끝에서 이만큼(px) 안쪽을 잡으면 옮기기가 아니라 길이 조절로 봄 (FR-208) */
const EDGE_PX = 6;
```
`initClipDrag` 안 — 잡았을 때 모드 정하기
```js
const rect = clip.getBoundingClientRect();
const onRight = rect.right - e.clientX <= EDGE_PX;   // 오른쪽 끝 손잡이를 잡았나
drag = {
  clip, multi, wasSelected,
  mode: onRight ? 'resize' : 'move',   // 오른쪽 끝 = 길이 조절, 그 밖 = 옮기기
  id: e.pointerId, x: e.clientX, scrollLeft: scroll.scrollLeft,
  group: selected().map((c) => ({
    clip: c,
    start: parseFloat(c.style.getPropertyValue('--s')) || 0,
    length: parseFloat(c.style.getPropertyValue('--l')) || 1,
  })),
  moved: false,
};
drag.primary = drag.group.find((g) => g.clip === clip);
```
끄는 중 — 클립 오른쪽 길이를 조절할 때 실행되는 코드
```js
if (drag.mode === 'resize') {
  const stepTicks = barsToTicks(snapUnit(e.altKey));            // Alt = 격자 무시(1틱)
  const deltaTicks = barsToTicks(dx / barWidth(lanes));
  const lenTick = resizeClipLength(barsToTicks(drag.primary.length), deltaTicks, stepTicks);
  drag.primary.clip.style.setProperty('--l', round(ticksToBars(lenTick)));
  edgeScroll(scroll, e.clientX);
  return;
}
```
놓을 때 — 알림(`onChange`)
```js
if (mode === 'resize') {
  clip.classList.remove('is-resizing');
  const length = parseFloat(clip.style.getPropertyValue('--l'));
  if (length !== drag.primary.length) onChange({ type: 'resize', clip, trackId: clip.closest('.sq-track').dataset.trackId, start: drag.primary.start, length });
} else { /* 기존 move 처리 */ }
```
**최신 문법으로 쓰면** (공부용)
```js
const mode = rect.right - e.clientX <= EDGE_PX ? 'resize' : 'move';
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `const mode = cond ? a : b` | 같은 코드 | 여기서는 그대로 씁니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 화면(마디)과 함수(tick) 단위를 변환 | 화면 클립은 `--s`·`--l` 이 마디 단위입니다. 검증된 함수 121~125 는 tick 단위라 `barsToTicks`·`ticksToBars`(115·116)로 오갑니다 |
| `resizeClipLength()` 재사용 | 스냅·최소 한 칸 규칙을 이미 시험했습니다(122). 화면 코드는 결과만 `--l` 에 씁니다 |
| 끝 6px 만 조절 | 옮기려고 잡았는데 길이가 바뀌면 답답합니다. 손잡이 폭(6px)을 그대로 씁니다 |
| Alt 로 1틱까지 | 스냅 규칙과 같게 맞춰, 미세 조절이 필요할 때 씁니다 |
| 잡은 클립만 조절 | 여러 클립의 길이를 한 번에 바꾸는 것은 규칙이 복잡합니다. 지금은 하나만 합니다 |

## 4. 시험
**(1) Node 단위 시험** — 모듈 적재 확인(11개 통과). `resizeClipLength` 자체는 122에서 14개 통과.

**(2) 브라우저 확인(Chrome headless + CDP 실제 마우스 이벤트, 실제 `studioNx.html`)** — 클립 오른쪽 끝을 잡고 끌었습니다.
| 확인 | 결과 |
|---|---|
| 오른쪽 끝을 오른쪽으로 끌기 → 길이 4 → 7 마디(격자에 맞춰 증가) | ✔ |
| 끄는 동안 `is-resizing` 표시 | ✔ |
| 왼쪽으로 끝까지 끌기 → 최소 한 칸(1 마디)에서 멈추고 삭제되지 않음 | ✔ |
| 가운데를 끌면 예전대로 옮기기(시작 0 → 5, 길이 그대로), `is-dragging` 표시 | ✔ |
