# JS 138 — `divisionBars()` (고른 분할 → 마디 단위)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 스물네 번째 함수 (FR-206 그리드 스냅 연결) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 이 값을 `snap`·`snapUnit` 에 물리는 배선을 진행합니다 |

## 1. 하는 일
Snap 메뉴에서 고른 분할을 **마디 단위**로 바꿉니다. 끌기 코드(`snap`·`snapUnit`)가 마디 단위를 쓰므로 그 단위로 맞춰 줍니다.

- `divisionTicks()`(tick 길이)를 `TICKS_PER_BAR`(3840)로 나눕니다. 4/4에서 1/n 음표 = 1/n 마디입니다.
- 셋잇단이면 `tripletTicks()`(÷3)를 나눕니다.

| 분할 | tick | 마디 |
|---|---|---|
| 1/1 | 3840 | 1 |
| 1/2 | 1920 | 0.5 |
| 1/4 | 960 | 0.25 |
| 1/8 | 480 | 0.125 |
| 1/16 | 240 | 0.0625 |
| 1/32 | 120 | 0.03125 |
| 1/4T | 320 | 0.0833… (=0.25/3) |
| 1/16T | 80 | 0.0208… (=1/48) |

## 2. 코드
```js
export function divisionBars(division, triplet = false) {
  return snapStepTicks(division, triplet) / TICKS_PER_BAR;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const divisionBars = (division, triplet = false) =>
  divisionTicks(division) / 3 ** Number(triplet) / TICKS_PER_BAR;
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `3 ** Number(triplet)` | `snapStepTicks()` 안의 분기 | 같은 값입니다. 셋잇단 판단을 이미 있는 `snapStepTicks()`에 맡겨 한 곳에서만 다룹니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| tick을 거쳐 마디로 | `divisionTicks()`는 이미 검증·계산이 끝난 함수입니다. 이름 검사와 셋잇단 처리를 다시 만들지 않습니다 |
| `snapStepTicks()` 재사용 | 칸+셋잇단을 한 값으로 만드는 규칙(119)이 이미 있습니다. 같은 규칙을 두 번 쓰지 않습니다 |
| 나누는 값으로 `TICKS_PER_BAR` | 4/4 기준 3840입니다. 마디당 tick 수를 바꿔야 할 때 이 상수 한 곳만 고치면 됩니다 |
| 반환은 마디 단위 | 끌기 코드가 마디로 계산합니다. 여기서 tick으로 돌려주면 부르는 쪽마다 또 나눠야 합니다 |
| 이름 오류는 그대로 전달 | `divisionTicks()`가 던진 오류를 감싸지 않고 그대로 올립니다. 원인이 한 곳에 남습니다 |

## 4. 시험 (Node에서 직접 실행, 11개 통과)
| 확인 | 결과 |
|---|---|
| 1/1~1/32 → 1, 0.5, 0.25, 0.125, 0.0625, 0.03125 | ✔ |
| 1/4T → 0.25/3 · 1/16T → 1/48 | ✔ |
| `triplet` 생략은 보통과 같음 | ✔ |
| 없는 분할·빈 이름 → 오류 | ✔ |
