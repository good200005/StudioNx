# JavaScript 225 — MIDI 클립 미리보기 (`setClipNotes` · `drawClipPreview` · `initClipPreviews`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer.js` |
| 작업 | S1-08 아코디언·피아노롤: 사용자 요구 1번 (MIDI 패턴 멜로디·음정으로 클립 미리보기) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 224 노트 변화 알림 · 226 (예정) |

## 1. 하는 일
MIDI 클립 안의 캔버스(`.sq-clip__preview`)에 **노트를 실제 음높이와 길이대로 작은 막대**로 그립니다. 그래서 클립만 봐도 어떤 멜로디인지 알 수 있습니다. 피아노롤에서 노트가 바뀔 때마다(224 의 `'sq:roll-notes'`) 그 클립을 다시 그립니다. 오디오 클립은 편곡의 `drawWaveforms` 가 맡으므로 여기서는 건너뜁니다.

```
피아노롤 노트 변화 → 'sq:roll-notes' { clip, notes }
└─ initClipPreviews 가 듣는다
   └─ setClipNotes(clip, notes)   ← 노트를 담고
      └─ drawClipPreview(canvas, clip)  ← 음높이·길이대로 막대를 그림
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `sequencer.js` 시작부 | `initClipPreviews()` 로 듣기를 시작합니다 |
| 피아노롤 (224) | 노트가 바뀔 때마다 이벤트를 보냅니다 |
| S1-10 (예정) | 프로젝트를 불러올 때 받은 노트를 `setClipNotes` 로 담습니다 |

## 3. 코드
```js
/** MIDI 클립 → 미리보기 노트 목록 (피아노롤에서 바뀔 때마다 채운다) */
const clipNotes = new WeakMap();

export function setClipNotes(clip, notes) {
  clipNotes.set(clip, notes || []);
  drawClipPreview(clip.querySelector('.sq-clip__preview'), clip);
}

export function drawClipPreview(canvas, clip) {
  if (!canvas || !clip || !clip.classList.contains('sq-clip--midi')) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pw, ph);
  const notes = clipNotes.get(clip) || [];
  if (w < 2 || h < 2 || !notes.length) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bars = parseFloat(clip.style.getPropertyValue('--l')) || 1;   // 클립 길이(마디)
  const ticks = bars * TICKS_PER_BAR;
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) { if (n.pitch < lo) lo = n.pitch; if (n.pitch > hi) hi = n.pitch; }
  if (hi === lo) { lo -= 1; hi += 1; }
  const pad = 0.12;
  const barH = Math.max(1, Math.round(h * 0.14));
  ctx.fillStyle = getComputedStyle(clip).getPropertyValue('--tc').trim() || 'currentColor';
  for (const n of notes) {
    const x = (n.start_tick / ticks) * w;
    const bw = Math.max(1, (n.length_tick / ticks) * w);
    const y = (1 - (n.pitch - lo) / (hi - lo)) * (1 - pad * 2) + pad;
    ctx.fillRect(x, y * h - barH / 2, Math.min(bw, w - x), barH);
  }
}

function initClipPreviews() {
  document.addEventListener('sq:roll-notes', (e) => {
    const detail = e.detail || {};
    if (detail.clip) setClipNotes(detail.clip, detail.notes || []);
  });
}
initClipPreviews();
```
`sequencer.js` 맨 위 import 는 `TICKS_PER_BAR` 를 더합니다.
```js
import { initArrange, TICKS_PER_BAR, restoreOpenPanels } from './sequencer-arrange.js';
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `new WeakMap()` | 클립 요소를 열쇠로 노트 목록을 담습니다. 클립이 지워지면 함께 사라집니다 |
| `devicePixelRatio`(`dpr`) | 고해상도 화면에서 선명하게 그리려고 캔버스 실제 크기를 배수만큼 키웁니다 |
| `canvas.width = pw` | 캔버스 실제 픽셀 크기(그리는 좌표계) |
| `canvas.clientWidth` | 화면에 보이는 크기(CSS 픽셀) |
| `ctx.clearRect(...)` | 먼저 캔버스를 비웁니다 |
| `clip.classList.contains('sq-clip--midi')` | MIDI 클립만 그립니다 (오디오는 편곡이 맡음) |
| `clip.style.getPropertyValue('--l')` | 클립 길이(마디)를 CSS 변수에서 읽습니다 |
| `(n.start_tick / ticks) * w` | 노트의 가로 위치(픽셀) |
| `1 - (n.pitch - lo) / (hi - lo)` | 음높이를 세로로 뒤집어 매핑(높은 음이 위) |
| `ctx.fillRect(...)` | 노트 막대 하나를 그립니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 클립 길이 기준으로 나눔 | 노트의 tick 을 클립 마디 수로 나눠 가로 위치를 정합니다. 클립을 늘리면 미리보기도 넓어집니다 |
| 화면에 보이는 음역만 사용 | 노트의 최저·최고 음 사이에 맞춰 그려 변화가 잘 보입니다. 한 음뿐이면 위아래로 1칸씩 벌립니다 |
| `WeakMap` 으로 담음 | 별도 자료구조를 관리하지 않아도 클립이 사라지면 담긴 노트도 정리됩니다 |
| 이벤트로 받음 | 피아노롤이 클립을 직접 알 필요 없이 문서 이벤트(224)만 보면 됩니다 |
| 오디오는 건너뜀 | 오디오 클립 미리보기는 S1-06 의 `drawWaveforms` 가 파형을 그립니다. 여기서 덮으면 안 됩니다 |

## 5. 시험
헤드리스 브라우저에서 빈 캔버스(픽셀 0) → 노트 4개를 담으니 156픽셀, 이벤트로 노트 2개를 받으니 92픽셀, 빈 목록으로 지우니 다시 0픽셀이 되는 것을 확인했습니다. 피아노롤 편집(`'sq:roll-notes'`)으로 클립이 403픽셀 그려지는 것도 확인했습니다(콘솔 오류 0건). 캡처는 `docs/screenshots/2026-10-17_s1-08_fixes/07_clip_preview_midi.png` 입니다.
