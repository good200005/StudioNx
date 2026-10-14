# JS 137 — `setSnapDivision()` · `getSnapDivision()` (스냅 분할 저장·조회)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 스물세 번째 함수 (FR-206 그리드 스냅) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 고른 스냅을 실제 끌기에 쓰는 연결(선택값 → 스냅 단위)을 진행합니다 |

## 1. 하는 일
Snap 메뉴에서 고른 **분할과 셋잇단 여부**를 담아 두고(`setSnapDivision`), 나중에 꺼냅니다(`getSnapDivision`). 짝으로 움직이는 한 쌍이라 함께 둡니다.

- 담기 전에 이름을 `divisionTicks()`로 확인합니다. 없는 이름이면 **오류를 던지고 담지 않습니다**(이전 값 유지).
- 기본값은 `'1/16'`(보통).
- 조회는 지금 값을 새 객체로 돌려줍니다(사본).

| 하는 일 | 부르는 법 | 결과/반환 |
|---|---|---|
| 기본값 조회 | `getSnapDivision()` | `{division:'1/16', triplet:false}` |
| 1/4 담기 | `setSnapDivision('1/4')` | `{division:'1/4', triplet:false}` |
| 1/8T 담기 | `setSnapDivision('1/8', true)` | `{division:'1/8', triplet:true}` |
| 없는 값 | `setSnapDivision('1/3')` | 오류, 이전 값 유지 |

## 2. 코드
```js
let snapDivision = '1/16';
let snapTriplet = false;

export function setSnapDivision(division, triplet = false) {
  divisionTicks(division);
  snapDivision = division;
  snapTriplet = triplet ? true : false;
  return { division: snapDivision, triplet: snapTriplet };
}

export function getSnapDivision() {
  return { division: snapDivision, triplet: snapTriplet };
}
```
**최신 문법으로 쓰면** (공부용)
```js
let state = { division: '1/16', triplet: false };

export const setSnapDivision = (division, triplet = false) => {
  divisionTicks(division);
  state = { division, triplet: Boolean(triplet) };
  return { ...state };
};

export const getSnapDivision = () => ({ ...state });
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| 한 객체 `state` | 변수 두 개 | 같은 뜻입니다. 값이 둘뿐이라 나눠 두면 읽기 쉬워 그대로 씁니다 |
| `Boolean(triplet)` | `triplet ? true : false` | 같은 결과입니다 |
| `{ ...state }` | 새 객체 리터럴 | 둘 다 사본을 돌려줍니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 담기 전 이름 검사 | 오타나 없는 분할을 담으면 나중에 끌기에서 조용히 틀린 값이 됩니다. 담는 순간 막습니다 |
| 검사 실패 시 이전 값 유지 | 잘못 골랐다고 스냅이 사라지면 안 됩니다. 이전 선택을 그대로 둡니다 |
| `triplet`을 boolean으로 | `1` 같은 값이 들어와도 `true`로 맞춥니다. 나중 비교가 어긋나지 않습니다 |
| 조회가 사본 반환 | 돌려받은 객체를 고쳐도 저장값이 안 바뀝니다. 상태를 밖에서 망가뜨리지 못합니다 |
| 두 함수를 함께 | 저장과 조회는 같은 값 하나를 다룹니다. 따로 두면 어긋나므로 짝으로 봅니다 |

## 4. 시험 (Node에서 직접 실행, 12개 통과)
모듈 상태라 순서대로 이어서 확인했습니다.
| 확인 | 결과 |
|---|---|
| 기본값 `{1/16, false}` | ✔ |
| 담기 반환값 · 담은 뒤 조회 | ✔ |
| 셋잇단 담기 · 조회 | ✔ |
| `triplet` 생략은 보통 · 참 같은 값도 boolean | ✔ |
| 없는 분할·빈 이름 → 오류 | ✔ |
| 오류 뒤 이전 값 유지 | ✔ |
| 조회는 사본(매번 새 객체) | ✔ |
