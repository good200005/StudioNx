# JavaScript 224 — 노트 변화 알림 (`rollNotes` · `emitRollNotes` · `openRoll` 의 clip)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-roll.js` |
| 작업 | S1-08 아코디언·피아노롤: 사용자 요구 1번 (MIDI 클립 미리보기) 의 보내는 쪽 |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 223 펼침 상태 기억 · 225 클립 미리보기 그리기 |

## 1. 하는 일
피아노롤에서 노트를 찍거나 옮기고 지울 때마다, 지금 노트 전부를 **저장용 모양(tick 단위)** 으로 모아 `sq:roll-notes` 라는 신호로 알립니다. 이 신호를 `sequencer.js` (225) 가 듣고 그 MIDI 클립의 미리보기를 다시 그립니다. 어느 클립의 노트인지는 피아노롤을 열 때 받은 `R.clip` 으로 압니다.

```
노트 편집(찍기·옮기기·지우기)
└─ R.onChange(change)
   ├─ 사용자 콜백(userChange)      ← 나중에 서버 저장(215)을 붙일 자리
   └─ emitRollNotes()
      └─ document 에 'sq:roll-notes' 보냄  (detail: { clip, notes, bars })
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `initNoteEdit` (220) · Delete 동작 | 노트를 바꾼 뒤 `R.onChange` 를 부릅니다 |
| `openRoll(clip)` | 열 때 `R.clip` 을 그 클립으로 정합니다 |
| `sequencer.js` (225) | `'sq:roll-notes'` 를 듣고 미리보기를 다시 그립니다 |

## 3. 코드
**initRoll 안 — 사용자 콜백 뒤에 알림을 붙임**
```js
const userChange = onChange;
R.onChange = (change) => {
  if (typeof userChange === 'function') userChange(change);
  emitRollNotes();
};
```

**openRoll — 어느 클립인지 기억**
```js
export function openRoll(clip) {
  const bottom = document.getElementById('bottom');
  bottom.hidden = false;
  bottom.querySelectorAll('.sq-panel').forEach((p) => { p.hidden = p.id !== 'panel-roll'; });
  R.clip = clip || null;
  // …제목·트랙 이름 채우기…
}
```

**노트 모으기와 알림**
```js
/** 지금 피아노롤의 노트 전부를 저장용 모양(tick 단위)으로 모은다 (요구사항 1, 2026-10-17) */
function rollNotes() {
  return [...R.notes.querySelectorAll('.sq-note:not(.is-ghost)')].map((n) => ({
    pitch: Number(n.dataset.pitch),
    start_tick: Math.round(Number(n.dataset.start) * TICKS_PER_BAR),
    length_tick: Math.round(Number(n.dataset.length) * TICKS_PER_BAR),
    velocity: Number(n.dataset.vel) || 100,
  }));
}

/** 노트가 바뀔 때마다 알린다 — sequencer.js 가 듣고 그 MIDI 클립의 미리보기를 다시 그린다 */
function emitRollNotes() {
  if (!R || !R.clip) return;
  document.dispatchEvent(new CustomEvent('sq:roll-notes', {
    detail: { clip: R.clip, notes: rollNotes(), bars: R.patternBars },
  }));
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `R.clip = clip || null` | 클립이 안 넘어오면 `null` 로 둡니다 (미리보기 알림 대상이 없음) |
| `R.notes.querySelectorAll('.sq-note:not(.is-ghost)')` | 실제 노트만 고릅니다(끄는 중 미리보기 노트 제외) |
| `Number(n.dataset.start) * TICKS_PER_BAR` | 화면의 마디 단위를 tick 으로 바꿉니다 (DB·API 와 같은 단위) |
| `new CustomEvent('sq:roll-notes', { detail: … })` | 내려보낼 값(`detail`)을 담은 알림 이벤트를 만듭니다 |
| `document.dispatchEvent(...)` | 문서 전체에 알립니다. 듣는 쪽(225)이 받습니다 |
| `if (!R \|\| !R.clip) return` | 아직 안 열렸거나 클립이 없으면 알리지 않습니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| tick 단위로 바꿔 보냄 | DB(`midi_notes`)와 API(213)가 tick 을 씁니다. 화면 단위(마디)를 그대로 보내면 저장할 때 어긋납니다 |
| 사용자 콜백을 따로 보존 | 나중에 서버 저장(215)을 붙일 때 이 자리에 넣습니다. 알림은 그와 별개로 항상 나갑니다 |
| 이벤트로 알림 | 피아노롤과 편곡 화면이 서로를 직접 부르지 않아도 됩니다. 파일 사이 결합을 줄입니다 |
| `is-ghost` 제외 | 끄는 동안의 미리보기 노트는 진짜 노트가 아닙니다 |

## 5. 시험
헤드리스 브라우저에서 피아노롤 노트를 편집(`deleteSelectedNotes`)했을 때 `'sq:roll-notes'` 가 그 클립과 노트 목록·마디 수(`bars: 4`)를 담아 나가고, 그 결과 클립 미리보기가 다시 그려지는 것을 확인했습니다(콘솔 오류 0건).
