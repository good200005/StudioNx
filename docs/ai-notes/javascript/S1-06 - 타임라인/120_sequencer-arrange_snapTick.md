# JS 120 — `snapTick()` (가장 가까운 격자로 맞추기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 여섯 번째 함수 (FR-206 그리드 스냅 동작) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 클립 위치·길이를 tick으로 다루는 함수(이동·크기 조절)와 Snap 메뉴 연결을 이어서 진행합니다 |

## 1. 하는 일
끌고 있는 위치(tick)를 **가장 가까운 격자 칸에 맞춥니다**. 격자 칸은 한 칸 길이(`stepTicks`)의 배수입니다.

> 맞춘 tick = (tick ÷ stepTicks 를 반올림한 값) × stepTicks

| 넣은 위치 | 한 칸 | 맞춘 결과 |
|---|---|---|
| 1,450 | 960 | 1,920 (가까운 오른쪽 칸) |
| 400 | 960 | 0 (가까운 왼쪽 칸) |
| 480 | 960 | 960 (정확히 반은 오른쪽) |
| 3,840 | 960 | 3,840 (이미 격자 위) |
| 130 | 80 (1/16 셋잇단) | 160 |
| -600 | 960 | -960 (음수도 대칭) |

## 2. 코드
```js
export function snapTick(tick, stepTicks) {
  if (typeof tick !== 'number' || !isFinite(tick)) throw new RangeError('tick 은 유한한 숫자여야 합니다: ' + tick);
  if (typeof stepTicks !== 'number' || !isFinite(stepTicks) || stepTicks <= 0) throw new RangeError('stepTicks 는 0 보다 큰 숫자여야 합니다: ' + stepTicks);
  return Math.round(tick / stepTicks) * stepTicks;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const snapTick = (tick, stepTicks) => Math.round(tick / stepTicks) * stepTicks;
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| 화살표 함수 | `function` 선언 | 같은 동작입니다 |
| `Number.isFinite` | `isFinite` | 둘 다 되지만 `isFinite`는 숫자가 아닌 값도 검사합니다. 여기선 타입 검사를 앞에서 이미 합니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 반올림(가장 가까운 칸) | FR-206 그리드 스냅의 기본 동작입니다. 왼쪽·오른쪽 중 가까운 쪽으로 붙습니다 |
| `Math.round` | 정확히 반(0.5)일 때 위로 올립니다. 격자가 두 칸 사이일 때 오른쪽으로 붙어 예측이 쉽습니다 |
| `stepTicks <= 0` 오류 | 0으로 나누면 `Infinity`·`NaN`이 나 스냅이 망가집니다. 0 이하는 스냅 의미가 없어 바로 알립니다 |
| tick·step 유한성 검사 | 끌기 도중 `NaN`이 들어오면 화면에서 클립이 사라집니다. 함수에서 막습니다 |
| 두 수를 곱해 정수 유지 | `stepTicks`가 정수(240·960 등)라 결과도 정수입니다. 소수 오차(0.0000001)가 생기지 않습니다 |
| 음수도 그대로 반올림 | 클립을 마디 0 왼쪽으로 끌어도 값이 대칭입니다 |

## 4. 시험 (Node에서 직접 실행, 18개 통과)
| 확인 | 결과 |
|---|---|
| 위로(600→960)·아래로(400→0)·정확히 반(480→960) | ✔ |
| 이미 맞은 점(960·3,840)은 그대로 | ✔ |
| 1/16 칸(240), 1/16 셋잇단 칸(80)으로 맞추기 | ✔ |
| 음수 대칭(-600→-960, -1,450→-1,920) | ✔ |
| step 0·음수, tick `NaN`, step 없음, tick 문자열 → 오류 | ✔ |
