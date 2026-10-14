# JS 148 — 오디오 클립 파형 배선 (`placeholderPeaks` · `drawClipWaveform` · `drawWaveforms` · `initWaveforms`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 서른네 번째 작업 (FR-210 오디오 클립 파형) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | S1-06 남은 정리 후 사용자 요청 시 커밋·PR 을 진행합니다 |

## 1. 하는 일
오디오 클립의 파형 미리보기(캔버스)에 파형을 그립니다. 함수 133~135(`waveformColumns`·`waveformBars`·`drawWaveform`)를 실제 캔버스에 연결하고, 클립이 바뀌면 다시 그리도록 배선했습니다.

아직 실제 샘플 데이터가 없어(S1-10 에서 옵니다) 파형 값은 **샘플 이름으로 만든 자리표시 peaks** 를 씁니다. 화면에서 파형이 보이고, 트리밍·확대에 맞춰 다시 그려지는지 확인할 수 있습니다.

```
① 이름 → 자리표시 peaks (0~1 진폭 512칸)        ② 클립 --o·--l → tick
   placeholderPeaks('vox_take2')  →  [0.02, 0.41, …]    offset 0, length 10마디
③ waveformColumns: 클립 폭 칸에 맞게 접기(구간 최대값)
④ waveformBars: 가운데 기준 위·아래 좌표
⑤ drawWaveform: 캔버스에 세로 선으로 그리기
```

## 2. 코드
자리표시 파형 — `placeholderPeaks`
```js
const PEAK_COUNT = 512;

const peaksCache = new Map();

function hashName(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function placeholderPeaks(name) {
  const hit = peaksCache.get(name);
  if (hit) return hit;
  let seed = hashName(name) || 1;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const peaks = new Array(PEAK_COUNT);
  for (let i = 0; i < PEAK_COUNT; i++) {
    const p = i / PEAK_COUNT;
    const body = 0.30 + 0.35 * Math.sin(p * Math.PI * 6) * Math.sin(p * Math.PI * 1.7);
    let v = Math.abs(body) * (0.55 + 0.9 * rand());
    if (rand() > 0.86) v = 1;                                     // 가끔 강한 타격
    const fade = Math.min(1, p * 20) * Math.min(1, (1 - p) * 20); // 앞뒤 페이드
    peaks[i] = Math.max(0.02, Math.min(1, v * fade));
  }
  peaksCache.set(name, peaks);
  return peaks;
}
```
클립 하나 그리기 — `drawClipWaveform`
```js
function drawClipWaveform(clip, dpr) {
  const canvas = clip.querySelector('.sq-clip__preview');
  if (!canvas) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pw, ph);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const nameEl = clip.querySelector('.sq-clip__name');
  const name = (nameEl ? nameEl.textContent : '').replace(/^[▤⇥]\s*/, '').trim();
  const lengthTick = barsToTicks(parseFloat(clip.style.getPropertyValue('--l')) || 1);
  const offsetTick = barsToTicks(parseFloat(clip.style.getPropertyValue('--o')) || 0);
  const sourceLengthTick = offsetTick + lengthTick;
  const columns = Math.max(1, Math.min(4000, Math.round(w)));
  const cols = waveformColumns(placeholderPeaks(name), offsetTick, lengthTick, sourceLengthTick, columns);
  const bars = waveformBars(cols, h);
  ctx.strokeStyle = getComputedStyle(clip).getPropertyValue('--tc').trim() || 'currentColor';
  ctx.lineWidth = 1;
  drawWaveform(ctx, bars, w / columns);
}
```
전체 다시 그리기와 배선 — `drawWaveforms` · `initWaveforms`
```js
function drawWaveforms() {
  const c = zoomCtx;
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  c.lanes.querySelectorAll('.sq-clip--audio').forEach((clip) => drawClipWaveform(clip, dpr));
}

function initWaveforms({ lanes }) {
  new MutationObserver(requestGrid).observe(lanes, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  requestGrid();
}
```
격자와 함께 다시 그리기 — `requestGrid` 한 줄 추가
```js
function requestGrid() {
  if (gridFrame) return;
  gridFrame = requestAnimationFrame(() => { gridFrame = 0; drawGrid(); drawWaveforms(); });
}
```
CSS — 자리표시 그라디언트 제거 (`studio.css`)
```css
.sq-clip--audio .sq-clip__preview { background: none; mask: none; }   /* 파형은 JS 가 캔버스에 그림 (FR-210) */
```
**최신 문법으로 쓰면** (공부용)
```js
const name = (clip.querySelector('.sq-clip__name')?.textContent ?? '').replace(/^[▤⇥]\s*/, '').trim();
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `?.` (옵셔널 체이닝) | `nameEl ? nameEl.textContent : ''` | 이름 요소가 없으면 빈 글자입니다. 실제 코드는 `if`/삼항으로 풀어 씁니다 |
| `??` (null 병합) | `… || ''` | 이름이 없을 때 기본값을 넣습니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 자리표시 peaks (가짜 파형) | 실제 샘플 로딩·디코딩은 S1-10 입니다. 그 전에도 배선(캔버스 그리기·다시 그리기)을 화면에서 시험할 수 있습니다 |
| 이름을 씨앗으로 (`hashName`) | 같은 샘플 이름이면 늘 같은 모양이라 새로 그려도 흔들리지 않고, `vox_take2` 와 `riser_8bar` 는 서로 다르게 보입니다. `peaksCache` 로 한 번만 만듭니다 |
| 소스 길이 = `offset + length` | 실제 소스 전체 길이를 아직 모릅니다. 자리표시에서는 "앞에서 건너뛴 만큼 + 보이는 만큼"을 소스로 봅니다. 그래서 왼쪽을 트리밍하면 파형이 뒤로 밀려 보입니다(실제와 같은 방향) |
| 칸 수 = 캔버스 CSS 폭(1칸 ≈ 1px) | 파형이 화면 폭에 꽉 차고, 확대하면 캔버스가 넓어져 칸이 늘어 더 촘촘히 보입니다. 상한 4000으로 아주 긴 클립도 감당합니다 |
| dpr 로 캔버스 확대 | 맥·레티나에서 선이 흐려지지 않도록 CSS 폭 × 화면 배율로 캔버스를 잡고, 그리기는 CSS 좌표로 합니다 |
| `MutationObserver` 로 style 변화 감지 | 클립을 옮기거나(–s) 길이를 바꾸거나(–l) 트리밍(–o)하면 `style` 속성이 바뀝니다. 그걸 잡아 다시 그립니다. 이벤트마다 다시 그리기 코드를 붙이지 않아 배선이 한 곳에 모입니다 |
| `requestGrid` 에 얹기 | 격자도 확대·스크롤 때 rAF 로 한 번만 다시 그립니다. 파형도 같은 시점에 그려야 클립 폭과 어긋나지 않고, 그리기 횟수도 한 번으로 묶입니다 |
| 캔버스 투명 + CSS 그라디언트 제거 | 예전엔 CSS 가 흉내 낸 파형이었습니다. 이제 진짜 파형을 캔버스에 그리므로 아래 그라디언트와 겹치지 않게 지웁니다 |
| 색은 `--tc` (트랙 색) | 클립 색 계열과 맞춥니다. 글자색(`currentColor`)은 어두울 수 있어 트랙 색을 먼저 씁니다 |

## 4. 시험
**(1) Node 단위 시험** — 모듈 적재 확인(11개 통과). `waveformColumns`·`waveformBars`·`drawWaveform` 은 133~135에서 각각 통과했습니다.

**(2) 브라우저 확인(Chrome headless + CDP, 실제 `studioNx.html`)** — 캔버스 픽셀을 읽어(투명하지 않은 점 개수·서명) 확인했습니다.
| 확인 | 결과 |
|---|---|
| 오디오 클립 캔버스에 파형이 그려짐(vox_take2 288px → 3430점) | ✔ |
| 같은 이름 두 클립(riser_8bar)의 파형 서명이 같음(736431 = 736431) | ✔ |
| 다른 이름(vox_take2 vs riser_8bar)은 서명이 다름 | ✔ |
| MIDI 클립 캔버스는 그리지 않음(0점) — CSS 그라디언트 유지 | ✔ |
| `--l` 을 10 → 6 으로 바꾸면 다시 그려짐(288 → 172px, 3430 → 2264점) | ✔ |
| Ctrl+휠 확대 시 캔버스가 넓어지며 다시 그려짐(288 → 848px, 3430 → 8380점) | ✔ |

스크린샷: `docs/ai-notes/images/javascript_s1-06/s1-06_audio-waveform.png`
