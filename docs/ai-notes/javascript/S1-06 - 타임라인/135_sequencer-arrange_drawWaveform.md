# JS 135 — `drawWaveform()` (파형 캔버스에 그리기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 스물한 번째 함수 (FR-210 오디오 클립 파형 그리기) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 캔버스 크기 계산과 클립 배치를 잇는 배선을 진행합니다 |

## 1. 하는 일
`waveformBars()`가 만든 `[top, bottom]` 좌표를 **캔버스에 세로 선으로 그립니다**. 칸마다 `moveTo` → `lineTo`로 막대 하나를 긋습니다.

- 칸의 x = **칸 가운데** (`칸 번호 × 칸 너비 + 칸 너비 / 2`)
- 색·굵기(`strokeStyle`·`lineWidth`)는 부르는 쪽이 미리 정합니다

```
bars [[0,10],[5,5]], 칸 너비 4
  x=2 에 [0 → 10]
  x=6 에 [5 → 5]
```

호출 순서: `beginPath` → (칸마다 `moveTo`·`lineTo`) → `stroke`

## 2. 코드
```js
export function drawWaveform(ctx, bars, colWidth) {
  if (!ctx || typeof ctx.beginPath !== 'function') throw new RangeError('ctx 는 캔버스 2D 컨텍스트여야 합니다');
  if (!Array.isArray(bars)) throw new RangeError('bars 는 배열이어야 합니다');
  if (typeof colWidth !== 'number' || !isFinite(colWidth) || colWidth <= 0) throw new RangeError('colWidth 는 0 보다 큰 숫자여야 합니다: ' + colWidth);
  ctx.beginPath();
  for (let i = 0; i < bars.length; i++) {
    const x = i * colWidth + colWidth / 2;
    const bar = bars[i];
    ctx.moveTo(x, bar[0]);
    ctx.lineTo(x, bar[1]);
  }
  ctx.stroke();
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const drawWaveform = (ctx, bars, colWidth) => {
  ctx.beginPath();
  bars.forEach(([top, bottom], i) => {
    const x = i * colWidth + colWidth / 2;
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  });
  ctx.stroke();
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `forEach` + 구조 분해 `([top, bottom])` | `for` + `bar[0]`·`bar[1]` | 같은 결과입니다. 좌표가 어디서 오는지 반복문으로 또렷하게 읽히게 씁니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `beginPath`·`stroke`를 함수 안에서 | 부르는 쪽이 잊어도 선이 반드시 그려집니다. 그리기 단위가 스스로 완결됩니다 |
| x = 칸 가운데 | 막대가 칸 한가운데 서야 칸 너비가 커져도 고르게 보입니다. 한쪽 끝에 붙지 않습니다 |
| 색·굵기는 안 정함 | 이 함수는 **모양**만 맡습니다. 트랙 색(FR-207 `trackColor`)·선 굵기는 부르는 쪽이 정합니다 |
| `ctx.beginPath` 존재 확인 | `ctx`가 없거나 캔버스가 아니면 중간에 조용히 멈춥니다. 시작 전에 막습니다 |
| 빈 배열이면 선 없이 스트로크 | 파형이 없어도 정상으로 끝나, 뒤 이어지는 그리기에 지장이 없습니다 |

## 4. 시험 (Node에서 직접 실행, 12개 통과)
가짜 캔버스(호출을 기록하는 객체)를 만들어 확인했습니다.
| 확인 | 결과 |
|---|---|
| 그리기 순서(beginPath→moveTo→lineTo→…→stroke) | ✔ |
| `moveTo`·`lineTo` 수 = 막대 수 · `beginPath`·`stroke` 각 한 번 | ✔ |
| 빈 막대 → `beginPath`·`stroke`만 | ✔ |
| 칸 너비 1 → x=0.5 (칸 가운데) | ✔ |
| ctx 없음·`beginPath` 없음·bars 배열 아님·칸 너비 0·숫자 아님 → 오류 | ✔ |
