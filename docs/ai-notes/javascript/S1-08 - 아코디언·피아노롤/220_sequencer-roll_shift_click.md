# JavaScript 220 — 겹쳐 찍기 (`initNoteEdit` 의 Shift+클릭)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-roll.js` |
| 작업 | S1-08 아코디언·피아노롤: 사용자 요구 4번 (노트 위에 겹쳐 찍기) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 219 마디 눈금 클릭 · 221 트랙 선택·그룹 |

## 1. 하는 일
피아노롤에서 **이미 있는 노트 위**를 `Shift` 를 누른 채 클릭하면, 그 노트를 옮기지 않고 **같은 음높이·시작 위치에 새 노트를 하나 더** 찍습니다(겹침 허용, FR-2317). 빈 곳 클릭은 늘 새로 찍습니다.

```
pointerdown (좌측 버튼)
├─ 노트 위가 아니거나 Shift 인 경우 → 새 노트 (Shift 면 아래 노트의 pitch·start 를 물려받음)
│  └─ 마지막 길이(R.lastLength)·세기 100 으로 만들고 붙임 → onChange({type:'add'})
└─ 그 외 → 선택/이동/크기 조절 (기존 동작 그대로)
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 피아노롤 | 같은 음을 여러 번 겹쳐 두고 세기를 달리하거나, 코드를 쌓을 때 |
| 사용자 요구 4번 | "노트를 겹쳐 찍을 수 있게 해 달라" |

## 3. 코드
```js
notes.addEventListener('pointerdown', (e) => {
  const target = e.target.closest('.sq-note:not(.is-ghost)');
  const multi = e.ctrlKey || e.metaKey;
  // …오른쪽 클릭 = 지우기…
  if (e.button !== 0) return;
  let note = target;
  let added = false;
  // 빈 곳 클릭 = 찍기 · Shift+클릭(노트 위) = 그 노트에 겹쳐 새로 찍기 (FR-2317 노트 겹침 허용)
  if (!note || e.shiftKey) {
    let pitch = null;
    let start = null;
    if (note) {                                  // 노트 위 + Shift → 그 노트 자리에 겹쳐 찍기
      pitch = Number(note.dataset.pitch);
      start = clamp(Number(note.dataset.start), 0, R.rollBars - R.lastLength);
    } else {                                     // 빈 곳 → 클릭한 음높이·위치에 새로 찍기
      const { bar, row } = point(e);
      pitch = R.high - row;
      if (pitch < R.low || pitch > R.high) return;
      start = clamp(snapF(bar, e.altKey), 0, R.rollBars - R.lastLength);
    }
    const n = document.createElement('span');
    n.className = 'sq-note';
    n.dataset.pitch = pitch;
    n.dataset.start = start;
    note = n;
    note.dataset.length = R.lastLength;
    note.dataset.vel = 100;
    notes.append(note);
    placeNote(note);
    renderVelocity();
    added = true;
    select(note, false);
  } else if (!note.classList.contains('is-selected')) {
    select(note, multi);
  }
  // …아래는 끌기(이동) 준비…
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `e.target.closest('.sq-note:not(.is-ghost)')` | 클릭한 곳에서 가장 가까운 노트를 찾습니다(미리보기 노트는 제외) |
| `!note || e.shiftKey` | 빈 곳이거나 Shift 인 경우 = 새로 찍기 |
| `Number(note.dataset.pitch)` | 노트 요소의 `data-pitch` 값을 숫자로 읽습니다 |
| `point(e)` | 클릭 좌표를 `{ bar, row }` 로 바꿉니다 |
| `placeNote(note)` | 요소를 위치·길이에 맞게 화면에 놓습니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| Shift 를 겹침에 배정 | 같은 자리에서 옮기기 대신 새로 찍는 일은 드뭅니다. 실수로 덮어쓰지 않게 수식 키를 씁니다 |
| 겹칠 땐 아래 노트 값을 물려받음 | 겹쳐 찍는 목적은 보통 같은 음·위치에 다른 세기를 주는 것입니다 |
| `added` 표시 | 새로 찍은 노트는 곧바로 끌지 않고, 세기 편집용으로만 씁니다 |

## 5. 시험
헤드리스 브라우저에서 일반 클릭은 노트 수가 그대로, Shift+클릭은 노트가 1개 늘고 같은 음높이·시작 위치의 겹친 쌍이 생기는 것을 확인했습니다(콘솔 오류 0건).
