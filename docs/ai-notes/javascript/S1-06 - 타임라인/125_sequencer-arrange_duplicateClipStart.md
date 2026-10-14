# JS 125 — `duplicateClipStart()` (클립 복제 위치)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 열한 번째 함수 (FR-208 복제, Ctrl+D) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 트랙 추가·삭제(FR-207)와 가로·세로 줌(FR-209) 함수를 이어서 진행합니다 |

## 1. 하는 일
클립을 복제할 때 **복제본의 시작 tick**을 돌려줍니다. 복제본은 원본 **바로 뒤**에 붙습니다.

> 복제본 시작 = 원본 시작 + 원본 길이

```
원본:   ├────────┼────────┤   (시작 960 · 길이 1,920)
복제본:          ├────────┼────────┤   (시작 2,880)
```

| 원본 시작 | 원본 길이 | 복제본 시작 |
|---|---|---|
| 0 | 960 | 960 |
| 960 | 1,920 | 2,880 |
| 3,840 | 3,840 | 7,680 |
| 2,880 | 960 | 3,840 |

## 2. 코드
```js
export function duplicateClipStart(startTick, lengthTick) {
  if (typeof startTick !== 'number' || !isFinite(startTick)) throw new RangeError('startTick 은 유한한 숫자여야 합니다: ' + startTick);
  if (typeof lengthTick !== 'number' || !isFinite(lengthTick) || lengthTick <= 0) throw new RangeError('lengthTick 은 0 보다 큰 숫자여야 합니다: ' + lengthTick);
  return startTick + lengthTick;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const duplicateClipStart = (startTick, lengthTick) => startTick + lengthTick;
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| 화살표 함수 | `function` 선언 | 같은 동작입니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 원본 바로 뒤(`start + length`) | Ctrl+D의 익숙한 동작입니다. 빈 곳에 붙여 놓친 클립이 원본과 겹치지 않습니다 |
| 격자 스냅을 따로 안 함 | 시작·길이 둘 다 이미 격자 위 값이라 더한 값도 격자 위입니다. `snapTick()`을 부를 필요가 없습니다 |
| 길이 > 0 검사 | 길이가 0이면 복제본이 원본과 같은 자리에 겹칩니다. 0 이하는 잘못된 입력이라 막습니다 |
| 길이·오프셋은 안 돌려줌 | 원본과 같습니다. 시작만 알면 부르는 쪽이 같은 값으로 클립을 하나 더 만듭니다 |

## 4. 시험 (Node에서 직접 실행, 10개 통과)
| 확인 | 결과 |
|---|---|
| 이어 붙음(960+1,920→2,880, 3,840+3,840→7,680) | ✔ |
| 앞에 붙음(0+960→960), 짧은 셋잇단 클립(0+320→320) | ✔ |
| 격자 위 결과 유지(2,880+960→3,840) | ✔ |
| 길이 0·음수, 시작 `NaN`·문자열, 길이 문자열 → 오류 | ✔ |
