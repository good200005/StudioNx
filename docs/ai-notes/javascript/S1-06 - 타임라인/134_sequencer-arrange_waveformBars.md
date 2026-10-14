# JS 134 — `waveformBars()` (파형 위·아래 좌표)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 스무 번째 함수 (FR-210 오디오 클립 파형 그리기) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 파형을 실제 캔버스에 그리는 배선(그리기 함수)과 클립 배치를 진행합니다 |

## 1. 하는 일
`waveformColumns()`가 만든 칸 진폭(0~1)을 **가운데를 기준으로 위·아래 좌표**로 펼칩니다. 캔버스에 세로 선으로 그릴 때 바로 쓰는 좌표입니다.

- 가운데 = `height / 2`
- 각 칸: `top = 가운데 − 진폭 × 반`, `bottom = 가운데 + 진폭 × 반`
- 캔버스 그리기: `x = 칸 번호 × 칸 너비` 로 두고 `moveTo(x, top)` → `lineTo(x, bottom)`

```
칸 [1, 0, 0.5], 높이 10 (가운데 5)
  1.0 → [0, 10]      ▮
  0.0 → [5,  5]      ─
  0.5 → [2.5, 7.5]   ▮
```
| 칸 | 높이 | 결과 |
|---|---|---|
| [1, 0, 0.5] | 10 | [[0, 10], [5, 5], [2.5, 7.5]] |
| [1, 0.25] | 8 | [[0, 8], [3, 5]] |
| [2] (1로 잘림) | 10 | [[0, 10]] |
| [-1] (0으로) | 10 | [[5, 5]] |
| [] | 10 | [] |

## 2. 코드
```js
export function waveformBars(columns, height) {
  if (!Array.isArray(columns)) throw new RangeError('columns 는 배열이어야 합니다');
  if (typeof height !== 'number' || !isFinite(height) || height <= 0) throw new RangeError('height 는 0 보다 큰 숫자여야 합니다: ' + height);
  const midY = height / 2;
  const out = new Array(columns.length);
  for (let i = 0; i < columns.length; i++) {
    let amp = columns[i];
    if (typeof amp !== 'number' || !isFinite(amp) || amp < 0) amp = 0;
    if (amp > 1) amp = 1;
    out[i] = [midY - amp * midY, midY + amp * midY];
  }
  return out;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const waveformBars = (columns, height) =>
  columns.map((raw) => {
    const amp = Math.min(1, Math.max(0, Number.isFinite(raw) ? raw : 0));
    return [height / 2 - amp * height / 2, height / 2 + amp * height / 2];
  });
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `map` | `for` 반복 | 같은 결과입니다. 진폭 자르는 단계가 눈에 보이도록 반복으로 씁니다 |
| `Number.isFinite` | `typeof` + `isFinite` | 숫자 아님까지 거르려고 둘 다 봅니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 가운데 기준 대칭 | 파형은 위아래로 뻗습니다. 가운데 줄을 기준으로 삼으면 진폭 0이 곧 무음(가운데 선)이 됩니다 |
| `[top, bottom]` 짝으로 돌려줌 | 캔버스 `moveTo`·`lineTo`에 그대로 넣습니다. 칸 너비(가로)는 부르는 쪽이 곱합니다 |
| 진폭 0~1로 자름 | 샘플 진폭이 넘칠 수 있습니다. 화면을 벗어나지 않게 클램프합니다 |
| 소리 없는 칸은 한 줄 | 완전히 지우지 않고 가운데 선을 남겨, 클립이 빈 곳 없이 이어져 보입니다 |
| 높이만 받음(가로 없음) | 가로 위치는 칸 번호로 정해집니다. 이 함수는 세로 모양만 맡습니다 |

## 4. 시험 (Node에서 직접 실행, 14개 통과)
| 확인 | 결과 |
|---|---|
| 칸 [1,0,0.5]·높이 10 → [[0,10],[5,5],[2.5,7.5]] | ✔ |
| 높이 8(가운데 4) · 최대 진폭은 위아래 끝 · 0은 가운데 줄 | ✔ |
| 진폭 >1은 1로 · 음수는 0으로 · 숫자 아님은 0으로 | ✔ |
| 빈 칸 → 빈 배열 · 결과 길이 = 칸 수 · `top ≤ bottom` | ✔ |
| 칸 배열 아님·높이 0·음수·숫자 아님 → 오류 | ✔ |
