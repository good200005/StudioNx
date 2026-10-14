# JS 145 — 클립 복제 배선 (Ctrl+D, `duplicateClipStart`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 서른한 번째 작업 (FR-208 클립 복제, Ctrl+D) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 클립 분할(`splitClip`) 배선을 이어서 진행합니다 |

## 1. 하는 일
선택한 클립을 **Ctrl+D** 로 복제합니다. 복제본은 원본 **바로 오른쪽**(시작 + 길이)에 붙고, 만들어진 복제본이 선택됩니다. 다시 Ctrl+D 를 누르면 그 복제본이 또 오른쪽으로 복제돼 연속으로 이어집니다.

```
[■■■■ Lead ]                         ← Ctrl+D
[■■■■ Lead ][■■■■ Lead ]             ← 원본 오른쪽에 복제, 복제본이 선택됨
[■■■■ Lead ][■■■■ Lead ][■■■■ Lead ] ← 다시 Ctrl+D (연속)
```

- 시작 위치는 `duplicateClipStart(startTick, lengthTick)` = `start + length` 를 씁니다.
- 곡 끝을 넘지 않게 `totalBars` 안으로 당깁니다(`clamp`).
- 오디오 클립은 오프셋(`--o`)도 복사해서 같은 대목이 다시 들립니다.
- 입력칸(`input`·`textarea` 등)에 커서가 있거나 대화상자가 열려 있으면 동작하지 않습니다.

## 2. 코드
```js
// Ctrl+D → 선택한 클립을 바로 오른쪽에 복제 (FR-208 복제). 새 복제본이 선택됨
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'd' || e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
  const clips = [...lanes.querySelectorAll('.sq-clip.is-selected:not(.is-ghost)')];
  if (!clips.length) return;
  e.preventDefault();
  const copies = clips.map((c) => {
    const track = c.closest('.sq-track');
    const start = parseFloat(c.style.getPropertyValue('--s')) || 0;
    const length = parseFloat(c.style.getPropertyValue('--l')) || 1;
    const offset = parseFloat(c.style.getPropertyValue('--o')) || 0;
    const kind = c.classList.contains('sq-clip--audio') ? 'audio' : 'midi';
    const name = c.querySelector('.sq-clip__name').textContent.replace(/^[▤⇥]\s*/, '').trim();
    const newStart = clamp(ticksToBars(duplicateClipStart(barsToTicks(start), barsToTicks(length))), 0, totalBars(lanes) - length);
    const clip = createClip({ kind, name, start: newStart, length });
    if (offset) clip.style.setProperty('--o', offset);
    track.querySelector('.sq-track__lane').append(clip);
    onChange({ type: 'duplicate', clip, trackId: track.dataset.trackId, start: newStart, length, offset });
    return clip;
  });
  clearSelection(lanes);
  copies.forEach((c) => c.classList.add('is-selected'));
});
```
**최신 문법으로 쓰면** (공부용)
```js
const clips = [...lanes.querySelectorAll('.sq-clip.is-selected:not(.is-ghost)')];
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| 스프레드 `[...]` | `[...lanes.querySelectorAll(...)]` | 같은 코드입니다(NamedNodeList 를 배열로) |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `duplicateClipStart()` 재사용 | "원본 오른쪽에 붙인다"는 규칙을 이미 시험했습니다(125). 화면은 시작 위치만 받아 씁니다 |
| 복제본을 선택 | 연속 Ctrl+D 가 자연스럽게 이어집니다. 원본은 선택이 풀려 헷갈리지 않습니다 |
| 원본과 같은 트랙에 넣음 | 복제는 같은 자리에서 바로 쓰는 것이 보통입니다. 트랙을 옮기는 건 따로 끌면 됩니다 |
| 오프셋(`--o`) 복사 | 오디오는 잘라 쓴 대목이 있으므로, 복제본도 같은 대목에서 시작해야 합니다 |
| 곡 끝 `clamp` | 마지막 클립을 복제해도 곡 밖으로 나가지 않습니다 |
| 입력칸·대화상자 예외 | 이름을 고치거나 창을 쓰는 중에 실수로 복제되지 않습니다 (`Ctrl+A` 와 같은 방식) |

## 4. 시험
**(1) Node 단위 시험** — 모듈 적재 확인(11개 통과). `duplicateClipStart` 자체는 125에서 통과.

**(2) 브라우저 확인(Chrome headless + CDP 실제 키 이벤트, 실제 `studioNx.html`)**
| 확인 | 결과 |
|---|---|
| 클립(Lead, 시작 0·길이 4) 선택 후 Ctrl+D → 클립 수 3 → 4, 복제본 시작 4(=0+4), 이름·길이 그대로 | ✔ |
| 복제본만 선택됨(selected 1개, 원본 풀림) | ✔ |
| 다시 Ctrl+D → 클립 수 5, 새 복제본 시작 8(연속) | ✔ |
| 오디오 클립 복제 → 오프셋 4 유지, 시작 8 → 12, 종류 audio | ✔ |
