# JS 147 — 가로·세로 줌 배선 (`clampZoom` · `zoomScrollLeft` · `stepTrackHeight`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 서른세 번째 작업 (FR-209 가로·세로 줌) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | FR-210 오디오 클립 파형 배선을 이어서 진행합니다 |

## 1. 하는 일
가로 줌(Ctrl+휠, VIEW 메뉴 확대·축소)과 세로 줌(트랙 높이 ↕+ / ↕−)이 이미 검증된 세 함수를 쓰도록 바꿨습니다.

- **가로 확대·축소**: `setZoom()` 이 한계를 `clampZoom()` 으로 맞추고, 스크롤 위치를 `zoomScrollLeft()` 로 옮깁니다. 마우스 아래에 있던 마디가 화면에서 제자리에 남습니다.
- **세로 확대·축소**: `stepAllTrackHeights()` 가 `stepTrackHeight()` 로 다음 단계 높이를 구합니다.

```
Ctrl+휠 (마우스 아래 마디 고정)      VIEW ▸ Zoom In/Out      ↕+ / ↕−
배율 0.25 … 12                      1.25배씩                 28·36·44·…·200px
```

## 2. 코드
가로 줌 — `setZoom`
```js
export function setZoom(zoom, anchorX) {
  const c = zoomCtx;
  if (!c) return;
  const head = c.scroll.querySelector('.sq-track__head')?.getBoundingClientRect().width ?? 0;
  const x = anchorX ?? head + (c.scroll.clientWidth - head) / 2;
  const oldBarWidth = barWidth(c.lanes);
  c.zoom = clampZoom(zoom, fitZoom(c));
  applyBarWidth(c);
  updateGrid(c);
  c.scroll.scrollLeft = zoomScrollLeft(c.scroll.scrollLeft, x, head, oldBarWidth, barWidth(c.lanes));
}
```
세로 줌 — `stepAllTrackHeights`
```js
function stepAllTrackHeights(dir) {
  const next = stepTrackHeight(baseTrackHeight(heightCtx.lanes), dir);
  if (next != null) setAllTrackHeights(next);
  return next;
}
```
**최신 문법으로 쓰면** (공부용)
```js
const x = anchorX ?? head + (c.scroll.clientWidth - head) / 2;
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `??` (null 병합) | `anchorX ?? …` | 여기 코드에는 그대로 남아 있습니다(들어온 값이 없을 때만 기본값) |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `clampZoom()` 재사용 | 최소(맞춤/ZOOM_MIN)·최대(ZOOM_MAX) 규칙을 이미 시험했습니다(126). 화면 코드가 같은 식을 두 번 적을 필요가 없습니다 |
| `zoomScrollLeft()` 재사용 | "마우스 아래 마디 고정" 계산을 이미 시험했습니다(127). 반올림된 마디 폭을 넘겨 정확히 맞춥니다 |
| 나머지 반올림은 `applyBarWidth` 가 | 마디 폭은 정수 px 이어야 선이 흐려지지 않습니다. 새 폭을 잰 뒤 `zoomScrollLeft` 에 넘깁니다 |
| `stepTrackHeight()` 재사용 | 단계 목록·0.5px 여유 규칙을 이미 시험했습니다(128). 전에는 화면 함수가 목록을 직접 뒤졌습니다 |
| 동작(휠·버튼)은 그대로 | 규칙만 검증된 함수로 모으고, 이벤트 연결은 손대지 않아 되돌리기 쉽습니다 |

## 4. 시험
**(1) Node 단위 시험** — 모듈 적재 확인(11개 통과). `clampZoom`·`zoomScrollLeft`·`stepTrackHeight` 는 126~128에서 각각 통과.

**(2) 브라우저 확인(Chrome headless + CDP 실제 휠·클릭, 실제 `studioNx.html`)** — Ctrl+휠과 ↕ 버튼을 썼습니다.
| 확인 | 결과 |
|---|---|
| Ctrl+휠 확대 → 배율 1 → 1.16, 마우스 아래 마디 10.34 → 10.33(제자리) | ✔ |
| 아주 많이 확대 → 배율 12(`ZOOM_MAX`)에서 멈춤 | ✔ |
| 아주 많이 축소 → 배율 0.25(`ZOOM_MIN`)에서 멈춤 | ✔ |
| ↕+ 클릭 → 트랙 높이 44 → 56, ↕− → 56 → 44 (한 단계씩) | ✔ |
