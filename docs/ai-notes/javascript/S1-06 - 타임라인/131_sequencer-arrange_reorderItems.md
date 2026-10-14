# JS 131 — `reorderItems()` (트랙 순서 바꾸기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 열일곱 번째 함수 (FR-207 트랙 순서 드래그) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 트랙 이름·색상(FR-207)과 오디오 클립 파형(FR-210) 함수를 이어서 진행합니다 |

## 1. 하는 일
목록에서 항목 하나를 **다른 자리로 옮긴 새 목록**을 돌려줍니다. 트랙을 위아래로 끌어 순서를 바꿀 때 씁니다.

> `from` 자리 항목을 빼서 `to` 자리에 끼워 넣습니다. `to`는 **옮긴 뒤 자리**입니다.

```
[Kick, Bass, Lead] 에서 0번을 2번으로
   Kick 빼기 → [Bass, Lead]
   2번에 끼우기 → [Bass, Lead, Kick]
```

| 원래 | from | to | 결과 |
|---|---|---|---|
| [Kick, Bass, Lead] | 0 | 2 | [Bass, Lead, Kick] |
| [Kick, Bass, Lead] | 2 | 0 | [Lead, Kick, Bass] |
| [Kick, Bass, Lead] | 1 | 1 | [Kick, Bass, Lead] |
| [1, 2, 3, 4] | 0 | 3 | [2, 3, 4, 1] |

번호는 자리에서 나오므로, 옮긴 뒤 `renumberMap()`으로 다시 매깁니다.

## 2. 코드
```js
export function reorderItems(items, from, to) {
  if (!Array.isArray(items)) throw new RangeError('items 는 배열이어야 합니다');
  const n = items.length;
  if (!Number.isInteger(from) || from < 0 || from >= n) throw new RangeError('from 자리가 범위 밖입니다: ' + from);
  if (!Number.isInteger(to) || to < 0 || to >= n) throw new RangeError('to 자리가 범위 밖입니다: ' + to);
  const out = items.slice();
  const moved = out.splice(from, 1)[0];
  out.splice(to, 0, moved);
  return out;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const reorderItems = (items, from, to) => {
  const out = [...items];
  out.splice(to, 0, ...out.splice(from, 1));
  return out;
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| 스프레드 복사 `[...items]` | `items.slice()` | 같은 뜻입니다 |
| `...out.splice(...)` 한 줄 | `moved` 변수 두 줄 | 같은 동작입니다. 읽기 쉽게 나눴습니다 |
| `Array.prototype.toSpliced`(최신) | `slice` + `splice` | 원본을 안 바꾸는 최신 메서드입니다. 여기선 옛 방식으로 씁니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `to` = 옮긴 뒤 자리 | "빼고 나서 끼운 자리"로 정하면 같은 자리(1→1)가 저절로 제자리가 됩니다. 머릿속으로 따라가기 쉽습니다 |
| 원본을 안 바꿈(`slice`) | 끌기 도중 실패해도 원래 순서가 남습니다. 되돌리기가 쉽습니다 |
| `from`·`to` 정수 검사 | 소수 자리나 범위 밖이 들어오면 `splice`가 엉뚱하게 잘라 순서가 망가집니다. 바로 막습니다 |
| 자리 범위를 `[0, n)`으로 | 자리는 항목 사이가 아니라 항목이 있는 자리입니다. 하나만 있을 때 0→0만 허용됩니다 |
| 번호와 분리 | 순서 바꾸기와 번호 매기기(`renumberMap`)를 따로 두면 각각 시험하기 쉽습니다 |

## 4. 시험 (Node에서 직접 실행, 15개 통과)
| 확인 | 결과 |
|---|---|
| 앞으로(0→2)·뒤로(2→0)·제자리(1→1) | ✔ |
| 한 칸 이동(1→2, 2→1) · 가운데(1→2) · 맨 끝(0→3) | ✔ |
| 원래 목록이 안 바뀜 | ✔ |
| 하나짜리(0→0) | ✔ |
| 범위 밖·음수·소수·배열 아님·빈 목록 → 오류 | ✔ |
