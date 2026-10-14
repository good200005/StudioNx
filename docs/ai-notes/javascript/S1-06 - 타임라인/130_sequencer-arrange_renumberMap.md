# JS 130 — `renumberMap()` (트랙 삭제 뒤 번호 정리표)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 열여섯 번째 함수 (FR-207 트랙 삭제) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 트랙 순서 드래그(FR-207)와 오디오 클립 파형(FR-210) 함수를 이어서 진행합니다 |

## 1. 하는 일
트랙을 지운 뒤 번호를 다시 매긴 **표(옛 번호 → 새 번호)**를 돌려줍니다. 남은 트랙을 위에서부터 차례로 1, 2, 3 … 으로 매깁니다(번호 = 위치).

```
2번(Bass) 삭제
전:  1. Kick   2. Bass   3. Lead   4. Pad
후:  1. Kick             2. Lead   3. Pad
     표: 1→1,  3→2,  4→3
```

| 지금 번호 | 새 번호 표 |
|---|---|
| `[1, 2, 3]` | 1→1, 2→2, 3→3 |
| `[1, 3, 4]` | 1→1, 3→2, 4→3 |
| `[3, 4, 5]` | 3→1, 4→2, 5→3 |
| `[1, null, 3]` | 1→1, 3→2 (그룹 줄 건너뜀) |
| `[2]` | 2→1 |
| `[]` | (빈 표) |

## 2. 코드
```js
export function renumberMap(numbers) {
  if (!Array.isArray(numbers)) throw new RangeError('numbers 는 배열이어야 합니다');
  const map = new Map();
  let n = 0;
  for (const old of numbers) {
    if (typeof old !== 'number' || !isFinite(old) || old <= 0) continue;
    n += 1;
    map.set(old, n);
  }
  return map;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const renumberMap = (numbers) =>
  new Map(numbers.filter((x) => Number.isFinite(x) && x > 0).map((x, i) => [x, i + 1]));
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `filter` + `map` | `for` 반복 + `continue` | 같은 결과입니다. `null`·문자열을 거르는 조건이 한눈에 보이도록 반복으로 씁니다 |
| `Number.isFinite` | `isFinite` | 둘 다 되지만 여기선 `typeof`까지 함께 봅니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 번호 = 위치(1..n) | 프로토타입 규칙 그대로입니다. Ableton·FL처럼 중간 번호를 다시 채워 빈 번호가 남지 않습니다 |
| 그룹 줄 건너뜀 | 번호가 없는 줄(그룹 트랙)은 세지 않습니다. 번호 있는 트랙만 차례로 채웁니다 |
| 표(Map)로 돌려줌 | 번호를 가리키는 곳(⇠10 · Track 10 등)을 한 번에 바꾸려면 옛→새 표가 필요합니다. 프로토타입 `renumberTracks()`와 같은 뜻입니다 |
| `Map`은 넣은 차례를 지킴 | 위에서 아래 순서가 그대로 남아 새 번호가 순증합니다 |
| 배열이 아니면 오류 | 목록을 잘못 넘기면 조용히 빈 표가 나와 번호가 안 바뀝니다. 바로 알립니다 |

## 4. 시험 (Node에서 직접 실행, 11개 통과)
| 확인 | 결과 |
|---|---|
| 차례대로는 그대로(1→1,2→2,3→3) | ✔ |
| 중간 삭제(1→1,3→2,4→3) · 뒷 번호(3→1,4→2,5→3) | ✔ |
| 그룹 줄 건너뜀(한 줄·여러 줄) | ✔ |
| 하나만(2→1) · 빈 목록(빈 표) | ✔ |
| 0·음수·문자열은 건너뜀 | ✔ |
| 배열 아님·없음 → 오류 | ✔ |
