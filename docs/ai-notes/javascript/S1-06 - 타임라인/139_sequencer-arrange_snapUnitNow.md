# JS 139 — `snapUnitNow()` (스냅 방식 하나로 모으기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 스물다섯 번째 함수 (FR-206 — 고른 분할을 끌기에 연결) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | Snap 메뉴에 분할 목록을 그리고 클릭을 잇는 배선을 진행합니다 |

## 1. 하는 일
스냅 방식을 **한 값(마디 단위)** 으로 모읍니다. 끌기 코드는 이 값 하나만 봅니다.

| 방식 | 뜻 | 스냅 한 칸 |
|---|---|---|
| `'off'` | 격자 무시 | 1틱 (`TICK`) |
| `'division'` | 내가 고른 분할 | `divisionBars(고른 값)` |
| `'line'` | 확대에 따라 자동 | `getSnap()` |

- Alt(`free`)를 누른 채 끌면 방식과 무관하게 **1틱**입니다.

```
snapUnitNow(free)
   ├ Alt 이거나 'off'  → TICK (1틱)
   ├ 'division'        → divisionBars(고른 분할)   ← FR-206
   └ 그 밖('line')      → getSnap()  (확대에 따라 자동)
```

배선: 스냅 한 칸을 구하던 `snapUnit`이 이제 `snapUnitNow`를 부르고, `setSnapDivision`으로 분할을 고르면 방식이 `'division'`이 됩니다.

## 2. 코드
```js
export function snapUnitNow(free = false) {
  if (free || snapMode === 'off') return TICK;
  if (snapMode === 'division') return divisionBars(snapDivision, snapTriplet);
  return getSnap();
}

const snapUnit = (free) => snapUnitNow(free);
```
`setSnapDivision`에 한 줄을 더했습니다.
```js
export function setSnapDivision(division, triplet = false) {
  divisionTicks(division);
  snapDivision = division;
  snapTriplet = triplet ? true : false;
  snapMode = 'division';
  return { division: snapDivision, triplet: snapTriplet };
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const snapUnitNow = (free = false) =>
  free || snapMode === 'off' ? TICK
  : snapMode === 'division' ? divisionBars(snapDivision, snapTriplet)
  : getSnap();
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| 중첩 삼항 | `if` 세 줄 | 같은 결과입니다. 세 경우가 눈에 또렷하게 보이도록 `if`로 폈습니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 한 함수에서 셋을 판단 | 끌기 코드가 `snapMode`를 곳곳에서 따지면 규칙이 흩어집니다. 한 곳에서만 정합니다 |
| Alt 최우선 | Alt는 "지금 이 순간 격자를 무시"라는 뜻입니다. 어떤 방식이든 앞서야 합니다 |
| 분할을 고르면 방식 전환 | 별도 "분할 모드"를 켜는 단계를 없앱니다. 고르는 순간이 곧 전환입니다 |
| `'line'`은 그대로 자동 | 기존 확대 연동(Line) 동작을 건드리지 않습니다. Line·Off 버튼은 예전처럼 동작합니다 |
| `snapUnit`은 얇게 유지 | 기존 호출부(`snap`·`floorSnap`)를 그대로 두려고 이름만 남기고 위임합니다 |

## 4. 시험 (Node에서 직접 실행, 11개 통과)
브라우저 없이 돌리려고 `document`를 가짜로 채워 넣고 불러왔습니다.
| 확인 | 결과 |
|---|---|
| 처음엔 `line` → `SNAP`(0.25) | ✔ |
| `off` → `TICK` | ✔ |
| 분할을 고르면 방식이 `division` · 1/8 → 0.125 · 1/16T → 1/48 | ✔ |
| Alt면 방식과 무관하게 1틱 | ✔ |
| Line으로 돌아오면 자동(`SNAP`) | ✔ |
