# JS 128 — `stepTrackHeight()` (세로 줌 트랙 높이 단계)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 열네 번째 함수 (FR-209 세로 줌) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 트랙 추가·삭제(FR-207) 함수를 이어서 진행합니다 |

## 1. 하는 일
세로 줌: 트랙 높이를 **한 단계 키우거나 줄인 다음 높이**를 돌려줍니다. 규칙은 프로토타입에 이미 있던 것을 그대로 씁니다.

```
트랙 높이 단계 (px)
 28 ── 36 ── 44 ── 56 ── 72 ── 96 ── 128 ── 160 ── 200
최소       (기본)                                      최대
              └ 38 미만이면 트랙 이름 줄 숨김(compact)
```

| 지금 높이 | 방향 | 다음 |
|---|---|---|
| 44 | 크게 | 56 |
| 44 | 작게 | 36 |
| 50 | 크게 | 56 |
| 50 | 작게 | 44 |
| 28 | 작게 | `null` (최소) |
| 200 | 크게 | `null` (최대) |

## 2. 코드
```js
export function stepTrackHeight(currentPx, dir) {
  if (typeof currentPx !== 'number' || !isFinite(currentPx)) throw new RangeError('currentPx 는 유한한 숫자여야 합니다: ' + currentPx);
  const up = dir > 0;
  const next = up
    ? TRACK_H_STEPS.find((h) => h > currentPx + 0.5)
    : TRACK_H_STEPS.slice().reverse().find((h) => h < currentPx - 0.5);
  return next == null ? null : next;
}
```
`TRACK_H_STEPS = [28, 36, 44, 56, 72, 96, 128, 160, 200]`은 파일 아래쪽(트랙 높이 기능)에 이미 있는 값을 그대로 씁니다.

**최신 문법으로 쓰면** (공부용)
```js
export const stepTrackHeight = (currentPx, dir) =>
  (dir > 0 ? TRACK_H_STEPS.find((h) => h > currentPx + 0.5)
           : [...TRACK_H_STEPS].reverse().find((h) => h < currentPx - 0.5)) ?? null;
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `?? null` (null 병합) | `next == null ? null : next` | `find`가 못 찾으면 `undefined`를 돌려주는데, 밖으로는 `null`로 맞춥니다 |
| 스프레드 `[...arr]` | `arr.slice()` | 배열을 복사해 뒤집습니다(원본을 안 건드림) |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 단계 목록을 그대로 씀 | 프로토타입에서 이미 정한 값(28~200, 44 기본)입니다. 화면 CSS `--sq-row-h`와 같은 값이라 눈금이 맞습니다 |
| 0.5px 여유 | 지금 높이가 단계 사이(예: 50.3)여도 반올림 오차로 단계를 건너뛰지 않게 합니다 |
| 못 가면 `null`(오류 아님) | 이미 최소·최대에 닿은 것은 정상입니다. 부르는 쪽은 `null`이면 아무것도 안 하면 됩니다 |
| 방향은 `dir > 0`만 봄 | 0이나 음수는 줄이기로 봅니다. `null` 없이도 동작합니다 |
| `currentPx` 검사 | 화면을 못 잰 첫 순간에는 높이가 `NaN`일 수 있어 막습니다 |

## 4. 시험 (Node에서 직접 실행, 16개 통과)
| 확인 | 결과 |
|---|---|
| 44→56, 44→36, 28→36, 200→160 | ✔ |
| 28 -1·200 +1 → `null` | ✔ |
| 단계 사이(50·45·44.4)에서 위·아래 이동 | ✔ |
| 방향 0·음수는 줄이기 | ✔ |
| 연속 세 번 크게(44→56→72→96) | ✔ |
| `currentPx` `NaN`·문자열 → 오류 | ✔ |
