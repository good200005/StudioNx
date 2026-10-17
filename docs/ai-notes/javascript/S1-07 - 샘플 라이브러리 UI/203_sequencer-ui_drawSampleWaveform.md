# JS 203 — 목록 줄 파형 그리기 (`drawSampleWaveform` · `drawPeaks`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-07 샘플 라이브러리: 열한 번째 함수 (FR-223 파형) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 204 `applySampleFilters` |

## 1. 하는 일
줄의 `.sq-file__wave` 안에 캔버스를 만들어, 서버가 준 파형(196 `peaks`)을 세로줄로 그립니다. 파형이 아직 없거나 실패하면 아무것도 하지 않아 기존 CSS 세로 무늬가 그대로 남습니다.

```
.sq-file__wave
├─ canvas.sq-file__wave__canvas   ← JS 가 삽입·그림 (있으면 .has-wave)
└─ i                              ← 재생 진행 채움(205). 캔버스 위에 그려짐
```

## 2. 코드
```js
async function drawSampleWaveform(row) {
  const wave = row.querySelector('.sq-file__wave');
  const id = row.dataset.sampleId;
  if (!wave || !id) return;
  let data = null;
  try { data = await fetchSampleWaveform(id); } catch (e) { return; }
  const peaks = data && data.peaks ? data.peaks : null;
  if (!peaks || !peaks.length) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'sq-file__wave__canvas';
  wave.classList.add('has-wave');
  wave.insertBefore(canvas, wave.firstChild);
  drawPeaks(canvas, peaks, colorOf());
}

function drawPeaks(canvas, peaks, color) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const mid = h / 2;
  ctx.fillStyle = color || 'currentColor';
  const step = peaks.length / w;
  for (let x = 0; x < w; x++) {
    const peak = peaks[Math.min(peaks.length - 1, Math.floor(x * step))];
    const top = mid - (peak ? peak[1] : 0) * mid;
    const bot = mid - (peak ? peak[0] : 0) * mid;
    ctx.fillRect(x, Math.max(0, top), 1, Math.max(1, bot - top));
  }
}
```
CSS (`studio.css`)
```css
.sq-file__wave.has-wave { background: none; mask: none; }              /* CSS 무늬 위에 캔버스 */
.sq-file__wave__canvas  { position: absolute; inset: 0; width: 100%; height: 100%; }
.sq-file__wave i        { z-index: 1; }                                /* 진행 채움은 위 */
.sq-file:not(.is-playing) .sq-file__wave i { display: none; }          /* 정지 줄은 채움 숨김 */
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 캔버스는 JS 가 삽입 | 목록이 동적(202)이라 HTML 에 미리 둘 수 없습니다. 파형이 있을 때만 만듭니다 |
| 캔버스를 `<i>` 앞에 삽입 | DOM 순서상 `<i>`(진행 채움)가 캔버스 위에 그려집니다. `z-index:1` 로 확실히 합니다 |
| 정지 줄은 `<i>` 숨김 | 목업의 `<i style="--p:0%">` 는 재생 전에도 0% 채움을 그립니다. 재생 중이 아니면 숨겨 파형만 보이게 합니다 |
| `has-wave` 로 CSS 무늬 제거 | 파형 캔버스가 생기면 아래 CSS 세로 무늬(`mask`)가 비쳐 보입니다. 겹치지 않게 지웁니다 |
| dpr 로 캔버스 확대 | 맥·레티나에서 선이 흐려지지 않게 CSS 폭 × 화면 배율로 잡고, 그리기는 CSS 좌표로 합니다 |
| 실패하면 조용히 | 파형은 곁들이는 정보라, 없어도 줄은 정상입니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 목록 3줄 각각에 캔버스가 생기고 폭·높이 > 0 | ✔ |
| `.has-wave` 3줄 | ✔ |
| 콘솔 오류 0건 | ✔ |
