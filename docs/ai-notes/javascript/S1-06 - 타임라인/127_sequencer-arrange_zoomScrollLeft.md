# JS 127 — `zoomScrollLeft()` (마우스 지점 고정 줌)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 열세 번째 함수 (FR-209 가로 줌) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 세로 줌(트랙 높이, FR-209)과 트랙 추가·삭제(FR-207) 함수를 이어서 진행합니다 |

## 1. 하는 일
가로 줌으로 **마디 폭이 바뀔 때, 마우스 아래 지점이 화면에서 안 움직이게** 할 스크롤 위치를 돌려줍니다.

> 1) 마우스 아래의 마디 위치를 구합니다: `(스크롤 + 마우스x − 헤드폭) ÷ 옛 마디폭`
> 2) 폭이 바뀐 뒤 같은 화면 x 에 오도록 스크롤을 옮깁니다: `헤드폭 + 마디위치 × 새 마디폭 − 마우스x`

```
확대 전:  |────100────|────100────|    마우스가 마디 1 위
스크롤 0,  마우스 x=300,  헤드 200
확대 후:  |───200───|───200───|        마디 1 이 안 움직이게 스크롤 100
```

| 스크롤 | 마우스x | 헤드 | 옛 폭 | 새 폭 | 새 스크롤 |
|---|---|---|---|---|---|
| 0 | 300 | 200 | 100 | 200 | 100 (확대) |
| 50 | 200 | 200 | 100 | 200 | 100 (헤드 끝 지점 고정) |
| 400 | 500 | 200 | 200 | 100 | 50 (축소) |
| 123 | 456 | 200 | 150 | 150 | 123 (폭 그대로) |

## 2. 코드
```js
export function zoomScrollLeft(scrollLeft, anchorX, headWidth, oldBarWidth, newBarWidth) {
  const nums = [scrollLeft, anchorX, headWidth, newBarWidth];
  if (nums.some((n) => typeof n !== 'number' || !isFinite(n))) throw new RangeError('줌 스크롤 인자는 유한한 숫자여야 합니다');
  if (typeof oldBarWidth !== 'number' || !isFinite(oldBarWidth) || oldBarWidth <= 0) throw new RangeError('oldBarWidth 는 0 보다 큰 숫자여야 합니다: ' + oldBarWidth);
  const barAtAnchor = (scrollLeft + anchorX - headWidth) / oldBarWidth;
  return headWidth + barAtAnchor * newBarWidth - anchorX;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const zoomScrollLeft = (scrollLeft, anchorX, headWidth, oldBarWidth, newBarWidth) => {
  const barAtAnchor = (scrollLeft + anchorX - headWidth) / oldBarWidth;
  return headWidth + barAtAnchor * newBarWidth - anchorX;
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| 화살표 함수 | `function` 선언 | 같은 동작입니다 |
| 인자 검사를 안 씀 | `typeof`·`isFinite` 검사 | 잘못된 값(0 나눗셈 등)을 막으려고 검사를 넣었습니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 헤드 폭을 빼고 계산 | 왼쪽 트랙 이름칸은 줌과 무관하게 고정입니다. 마디가 시작하는 곳부터 재야 마우스 지점이 정확합니다 |
| `oldBarWidth > 0` 검사 | 0으로 나누면 `Infinity`가 나 스크롤이 망가집니다 |
| 결과를 안 자름(음수도 그대로) | 이 함수는 좌표 계산만 합니다. 실제로 보이는 범위로 자르는 일은 스크롤 영역(`scrollLeft`)이 합니다 |
| `nums.some`으로 네 값 검사 | `isFinite('200')`은 문자열을 숫자로 바꿔 통과시킵니다. `typeof`까지 봐야 잘못된 값이 걸립니다 |
| 폭이 같으면 스크롤 그대로 | 확대·축소가 아니면 화면이 안 움직여야 합니다. 식이 저절로 그렇게 나옵니다 |

## 4. 시험 (Node에서 직접 실행, 11개 통과)
| 확인 | 결과 |
|---|---|
| 확대(0→100) · 헤드 끝 지점 고정(→100) · 축소(→50) | ✔ |
| 폭 그대로면 스크롤 그대로(123) | ✔ |
| 헤드 0, 음수 결과도 그대로 | ✔ |
| `oldBarWidth` 0·음수, `anchorX` `NaN`, 새 폭 문자열 → 오류 | ✔ |
