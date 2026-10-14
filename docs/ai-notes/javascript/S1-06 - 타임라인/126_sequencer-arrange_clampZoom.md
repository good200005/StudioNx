# JS 126 — `clampZoom()` (가로 줌 한계)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 열두 번째 함수 (FR-209 가로 줌) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 커서 위치를 고정하는 줌(`zoomScrollLeft`)과 세로 줌(트랙 높이, FR-209) 함수를 이어서 진행합니다 |

## 1. 하는 일
가로 줌 **배율을 한계 안으로 맞춥니다.** 배율 1 = 1마디 28.8px이고, 클수록 마디가 넓어집니다(확대).

> 맞춘 배율 = 요청 배율을 [최소, 최대] 안으로 가둔 값
> 최소 = `ZOOM_MIN`(0.25) 과 **화면 맞춤 배율** 중 큰 쪽, 최대 = `ZOOM_MAX`(12)

| 요청 | 화면 맞춤 | 결과 | 이유 |
|---|---|---|---|
| 1 | — | 1 | 범위 안 |
| 0.1 | — | 0.25 | 최소보다 작음 |
| 20 | — | 12 | 최대보다 큼 |
| 0.5 | 0.8 | 0.8 | 화면 맞춤이 최소 |
| 5 | 0.8 | 5 | 둘 다보다 큼 |
| 0.1 | 0.1 | 0.25 | 화면 맞춤도 0.25 미만 |
| 1 | 100 | 12 | 화면 맞춤이 너무 큼(짧은 곡) |

```
축소 ←── 0.25 ──┬───────────────────┬── 12 ──→ 확대
        (화면 맞춤이 더 크면 그쪽)
```

## 2. 코드
```js
export function clampZoom(zoom, fitZoom) {
  if (typeof zoom !== 'number' || !isFinite(zoom)) throw new RangeError('zoom 은 유한한 숫자여야 합니다: ' + zoom);
  const fit = (typeof fitZoom === 'number' && isFinite(fitZoom)) ? fitZoom : ZOOM_MIN;
  const lo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, fit));
  return Math.min(Math.max(zoom, lo), ZOOM_MAX);
}
```
`ZOOM_MIN = 0.25`, `ZOOM_MAX = 12`는 파일 위쪽(`setZoom` 근처)에 이미 있는 값을 그대로 씁니다.

**최신 문법으로 쓰면** (공부용)
```js
export const clampZoom = (zoom, fitZoom = ZOOM_MIN) => {
  const lo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, fitZoom));
  return Math.min(Math.max(zoom, lo), ZOOM_MAX);
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| 기본값 인자 `fitZoom = ZOOM_MIN` | `typeof … ? fitZoom : ZOOM_MIN` | 값을 안 줄 때의 기본값. 다만 `0`·`null` 같은 잘못된 값도 걸러야 해서 `typeof` 검사를 씁니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 최소를 화면 맞춤으로 | 이보다 더 축소하면 곡 오른쪽에 빈 공간만 늘어납니다. 곡이 화면에 꼭 차는 게 가장 작은 씀씀이입니다 |
| `fitZoom`을 [0.25, 12]로 눌러 씀 | 화면 맞춤이 12보다 큰 짧은 곡에서도 최소 ≤ 최대가 되어 결과가 한계 밖으로 새지 않습니다 |
| `ZOOM_MIN`·`ZOOM_MAX` 재사용 | 프로토타입 `setZoom`과 같은 값입니다. 두 곳에 숫자를 두지 않습니다 |
| `fitZoom` 없거나 잘못되면 `ZOOM_MIN` | 화면 크기를 아직 못 잰 첫 렌더에서도 안전하게 0.25를 최소로 씁니다 |
| 배율 NaN·문자열은 오류 | 잘못된 배율로 화면을 그리면 격자가 사라집니다. 바로 알립니다 |

## 4. 시험 (Node에서 직접 실행, 14개 통과)
| 확인 | 결과 |
|---|---|
| 1은 그대로 · 0.1→0.25 · 20→12 | ✔ |
| 화면 맞춤이 최소(0.5, fit 0.8 → 0.8) · 그보다 크면 그대로 | ✔ |
| fit 0.1→0.25 · fit 100→12 · fit 0→0.25 · fit `null`→0.25 | ✔ |
| 확대 요청도 12 상한 | ✔ |
| zoom `NaN`·문자열 → 오류 | ✔ |
