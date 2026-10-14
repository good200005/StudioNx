# JS 119 — `snapStepTicks()` (스냅 한 칸 길이 고르기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 다섯 번째 함수 (FR-206 그리드 스냅) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | tick을 격자에 맞추는 함수(가장 가까운 칸으로)와 Snap 메뉴 연결을 이어서 진행합니다 |

## 1. 하는 일
Snap 메뉴에서 고른 **칸**과 `³ Triplet` 여부를 **한 칸의 tick 길이** 하나로 정리합니다. 끌기 코드는 이 값을 스냅 단위로 씁니다.

> 셋잇단이 꺼져 있으면 `divisionTicks()`(예: `1/16` = 240), 켜져 있으면 `tripletTicks()`(예: `1/16` = 80)

| 칸 | 보통 | 셋잇단 |
|---|---|---|
| `1/1` | 3840 | 1280 |
| `1/2` | 1920 | 640 |
| `1/4` | 960 | 320 |
| `1/8` | 480 | 160 |
| `1/16` | 240 | 80 |
| `1/32` | 120 | 40 |
| 이름이 틀림(`1/3` 등) | 오류(`RangeError`) | 오류(`RangeError`) |

## 2. 코드
```js
export function snapStepTicks(division, triplet = false) {
  return triplet ? tripletTicks(division) : divisionTicks(division);
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const snapStepTicks = (division, triplet = false) =>
  triplet ? tripletTicks(division) : divisionTicks(division);
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| 화살표 함수 | `function` 선언 | 같은 동작입니다 |
| 기본값 인자 | 그대로 사용 | `triplet`을 안 주면 보통(꺼짐)으로 봅니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 칸 + 셋잇단을 한 함수로 | 끌기 코드가 매번 "셋잇단이면 어느 값"을 따지지 않고 이 함수 하나만 부르면 됩니다 |
| 두 값 함수를 그대로 씀 | 칸 값(`divisionTicks`)과 셋잇단 값(`tripletTicks`)이 각각 한 곳에서 나옵니다. 검사·오류도 그대로 전해집니다 |
| `triplet` 기본값 false | 두 번째 인자를 안 주는 곳(Snap Off·Line 등)에서도 안전하게 보통 칸을 돌려줍니다 |
| 없는 칸은 오류 | 조용히 0이나 NaN을 돌려주면 스냅이 꺼진 것처럼 보입니다. 바로 알리는 쪽이 낫습니다 |

## 4. 시험 (Node에서 직접 실행, 15개 통과)
| 확인 | 결과 |
|---|---|
| `1/4`·`1/8`·`1/16` 보통/셋잇단이 960/320·480/160·240/80 | ✔ |
| `1/1` 보통 3840, `1/32` 셋잇단 40 | ✔ |
| `triplet` 생략·false는 보통, true는 `tripletTicks()`와 같음 | ✔ |
| 없는 칸(보통·셋잇단)·숫자·없음 → 오류 | ✔ |
