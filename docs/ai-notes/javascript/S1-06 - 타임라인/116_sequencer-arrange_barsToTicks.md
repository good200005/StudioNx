# JS 116 — `barsToTicks()` (마디를 tick으로 바꾸기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 두 번째 함수 (FR-208 클립 위치) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 스냅 단위 함수(FR-206)를 이어서 진행합니다 |

## 1. 하는 일
편곡 화면의 **마디**를 엔진·DB의 **tick**(1박 = 960)으로 바꿉니다. `ticksToBars()`의 역방향입니다. 클립을 끌어 옮긴 위치(마디)를 `clip.start_tick`처럼 tick으로 저장하거나 엔진에 넘길 때 씁니다.

> tick = 마디 × (한 마디의 tick 수)   예: 1마디 × 3840 = 3840 tick

| 입력 | 결과 |
|---|---|
| 0마디 | 0 tick |
| 0.25마디 (1박) | 960 tick |
| 0.125마디 (1/8박) | 480 tick |
| 1마디 (4/4) | 3840 tick |
| 4마디 | 15360 tick |
| -0.25마디 (카운트인) | -960 tick |
| 두 번째 인자 4800 tick (5/4 한 마디) | 4800 tick |
| 마디가 NaN·Infinity·문자열, 마디 길이가 0 이하 | 오류(`RangeError`) |

## 2. 코드
```js
export function barsToTicks(bar, ticksPerBar = TICKS_PER_BAR) {
  if (typeof bar !== 'number' || !isFinite(bar)) throw new RangeError('bar 는 유한한 숫자여야 합니다: ' + bar);
  if (typeof ticksPerBar !== 'number' || !isFinite(ticksPerBar) || ticksPerBar <= 0) throw new RangeError('ticksPerBar 는 0 보다 큰 숫자여야 합니다: ' + ticksPerBar);
  return bar * ticksPerBar;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const barsToTicks = (bar, ticksPerBar = TICKS_PER_BAR) => {
  if (!Number.isFinite(bar)) throw new RangeError(`bar 는 유한한 숫자여야 합니다: ${bar}`);
  if (!Number.isFinite(ticksPerBar) || ticksPerBar <= 0) throw new RangeError(`ticksPerBar 는 0 보다 큰 숫자여야 합니다: ${ticksPerBar}`);
  return bar * ticksPerBar;
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `Number.isFinite(x)` | `typeof x !== 'number' \|\| !isFinite(x)` | 숫자이면서 NaN·Infinity가 아닌지 확인합니다 |
| 템플릿 문자열 | `'…' + x` | 글자와 값을 잇습니다 |
| 화살표 함수 | `function` 선언 | 같은 동작입니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `ticksToBars()`와 짝으로 만듦 | 화면에서 만든 마디를 저장·엔진용 tick으로 되돌리는 길이 있어야 합니다 |
| `TICKS_PER_BAR`, 검사 규칙을 그대로 씀 | 두 함수가 같은 기준(4/4 = 3840, 잘못된 값은 오류)을 써서 어긋나지 않습니다 |
| 소수 결과를 그대로 돌려줌 | 반올림은 부르는 쪽이 합니다. 여기서 반올림하면 저장 위치가 미리 틀어집니다 |
| 잘못된 값은 오류를 던짐 | 엉뚱한 tick이 DB에 저장되는 것을 막습니다 |

## 4. 시험 (Node에서 직접 실행, 18개 통과)
| 확인 | 결과 |
|---|---|
| 0·0.25·0.125·1·4마디가 0·960·480·3840·15360 tick | ✔ |
| 카운트인(-0.25마디)이 -960 tick | ✔ |
| 5/4(4800)·3/4(2880) 인자에서 1마디 | ✔ |
| `ticksToBars(barsToTicks(x))` 왕복이 원래 값 | ✔ |
| 마디가 NaN·Infinity·없음·문자열이면 오류 | ✔ |
| 마디 길이가 0·음수·NaN이면 오류 | ✔ |
