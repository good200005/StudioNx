# JavaScript 284 — 클립에 서버 번호 달기 (sequencer-arrange.js)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-10a 클립·연결·패턴 API: 편곡 클립에 clipId · patternId · sampleId 달기 (PRD 02 FR-2196 클립·패턴) |
| 작성 | Claude (AI), 2026-10-19, 사용자 검토 |
| 이전 · 다음 | 이전 283 Connect 칸과 연결 저장, 다음 (다음 작업) 시퀀서 저장 경로 |

## 1. 하는 일
편곡 화면의 클립 요소는 `createClip` 이 만듭니다. S1-10a 에서는 `createClip` 에 서버 번호 세 가지(`clipId`, `patternId`, `sampleId`)를 받아 넣을 수 있게 했습니다. 왼쪽 목록에서 끌어다 놓기, Ctrl+D 복제, Draw · Paint 로 새로 그리기, 가르기, `sequencer.js` 가 읽는 `templateOf` 까지 이 번호가 따라다니도록 연결했습니다.

```text
왼쪽 목록 .sq-file (data-pattern-id / data-sample-id)
   │ dragstart → initListDrop 의 data 에 patternId · sampleId 담기
   ▼
createClip({ kind, name, start, length, clipId?, patternId?, sampleId? })
   ▼
button.sq-clip
   ├─ dataset.clipId     ← 서버 clips 표의 clip_id (저장 뒤 PATCH · DELETE 에 씀)
   ├─ dataset.patternId  ← MIDI 클립이 가리키는 patterns 표 번호
   └─ dataset.sampleId   ← AUDIO 클립이 가리키는 samples 표 번호

Ctrl+D 복제 ─┐
가르기(split) ┼─ templateOf(clip) 또는 dataset 직접 읽기 → patternId · sampleId 이어받기
Draw · Paint ┘
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `clipElement` (`sequencer-devices.js`) | `/full` 클립을 화면에 놓을 때 번호를 함께 넘깁니다 |
| `initListDrop` 의 `dragstart` | 목록 항목의 `dataset.patternId`, `dataset.sampleId` 를 끄는 자료에 담습니다 |
| Ctrl+D 복제 | 선택한 클립의 `dataset.patternId`, `dataset.sampleId` 를 복제본에 그대로 넘깁니다 |
| `templateOf` | Draw · Paint 템플릿과 가르기(split)의 오른쪽 조각이 같은 패턴 · 샘플을 가리키게 합니다 |
| `sequencer.js` 저장 경로 | `dataset.clipId` 로 PATCH · DELETE, `dataset.patternId` · `dataset.sampleId` 로 클립 만들기에 씁니다 |

## 3. 코드
```javascript
/**
 * 클립 하나 만들기 (S1-06 FR-208) — studioNx.html 의 클립과 같은 모양.
 * 서버에서 온 클립이면 번호를 달아 둡니다 (S1-10a FR-2196) — 저장(PATCH·DELETE) 때 씁니다.
 * @param {{ kind: string, name: string, start: number, length: number,
 *   clipId?: number|string, patternId?: number|string, sampleId?: number|string }} param0
 * @returns {HTMLButtonElement}
 */
export function createClip({ kind, name, start, length, clipId, patternId, sampleId }) {
  const clip = document.createElement('button');
  clip.type = 'button';
  clip.className = `sq-clip sq-clip--${kind}`;
  clip.style.setProperty('--s', start);
  clip.style.setProperty('--l', length);
  if (clipId !== undefined && clipId !== null) clip.dataset.clipId = String(clipId);
  if (patternId !== undefined && patternId !== null) clip.dataset.patternId = String(patternId);
  if (sampleId !== undefined && sampleId !== null) clip.dataset.sampleId = String(sampleId);
  const label = document.createElement('span');
  label.className = 'sq-clip__name';
  label.textContent = `${kind === 'audio' ? '⇥' : '▤'} ${name}`;
  const preview = document.createElement('canvas');
  preview.className = 'sq-clip__preview';
  clip.append(label, preview);
  return clip;
}

  // initListDrop 안 — 왼쪽 목록을 끌 때
  document.addEventListener('dragstart', (e) => {
    const item = e.target.closest?.('.sq-file[draggable="true"][data-kind]');
    if (!item) return;
    data = {
      kind: item.dataset.kind, name: item.dataset.name, length: parseFloat(item.dataset.bars) || 1, color: item.dataset.color,
      // 서버 번호 — MIDI 는 패턴, AUDIO 는 샘플 (S1-10a FR-2196). 없으면 null
      patternId: item.dataset.patternId || null,
      sampleId: item.dataset.sampleId || null,
    };

  // Ctrl+D 복제
  const clip = createClip({ kind, name, start: newStart, length, patternId: c.dataset.patternId, sampleId: c.dataset.sampleId });

/** 클립 → 놓을 것 */
function templateOf(clip) {
  return {
    kind: clip.classList.contains('sq-clip--audio') ? 'audio' : 'midi',
    name: clip.querySelector('.sq-clip__name').textContent.replace(/^[▤⇥]\s*/, '').trim(),
    length: parseFloat(clip.style.getPropertyValue('--l')) || 1,
    // 서버 번호를 이어받아 복제 · 가르기 · 새로 그리기가 같은 패턴/샘플을 가리키게 (S1-10a)
    patternId: clip.dataset.patternId || null,
    sampleId: clip.dataset.sampleId || null,
  };
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `clipId !== undefined && clipId !== null` | 번호를 안 넘기면 속성을 아예 만들지 않습니다. `dataset` 에 `undefined` 글자가 남지 않습니다 |
| `clip.dataset.clipId = String(clipId)` | `dataset` 은 항상 글자입니다. `sequencer.js` 가 읽은 뒤 `Number(...)` 로 다시 바꿉니다 |
| `item.dataset.patternId \|\| null` | 속성이 없으면 `undefined` 이므로 `\|\| null` 로 바꿔 담습니다 |
| `c.dataset.patternId` (Ctrl+D) | 복제본도 원본과 같은 패턴을 가리키게 합니다. 새 패턴을 만들지 않습니다 |
| `clip.classList.contains('sq-clip--audio')` | 오디오 · MIDI 구분은 클래스 이름으로 읽습니다 |
| `text.replace(/^[▤⇥]\s*/, '')` | 이름 칸에 붙은 기호를 떼고 본래 이름만 돌려줍니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 번호를 `dataset` 에 담음 | 클립 요소 하나가 화면과 서버 사이의 연결 고리입니다. 요소를 따라다니므로 복제 · 가르기 · 끌기 어디서 읽어도 같은 번호를 줍니다 |
| `createClip` 이 세 번호를 모두 선택으로 받음 | 새로 만드는 클립(번호 없음)과 서버에서 온 클립(번호 있음)이 같은 함수를 씁니다 |
| `clipId` 는 복제에 넘기지 않음 | 복제본은 아직 서버에 없는 새 클립입니다. 원본의 `clipId` 를 물려주면 저장할 때 원본을 고치게 됩니다 |
| `patternId` · `sampleId` 는 복제에 넘김 | 복제본도 같은 노트 · 같은 소리를 연주해야 합니다 (DB 에서도 두 클립은 같은 패턴을 가리킵니다) |
| `templateOf` 에 번호 포함 | Draw · Paint 로 새로 그린 클립과 가르기의 오른쪽 조각도 같은 패턴 · 샘플을 쓰게 하기 위해서입니다 |
| 목록 항목은 `data-pattern-id`, `data-sample-id` 로 시작 | 목록 항목은 `data-kind` 로 종류를 이미 갖고 있으므로, 번호는 마침표 이름 형식을 그대로 따랐습니다 |

## 5. 시험
`docs/handoff/s1-10a_tests/ui.mjs` 에서 왼쪽 목록에서 MIDI 항목을 끌어 클립을 놓은 뒤, `dataset.patternId` 가 붙어 있는지, 저장하면 `dataset.clipId` 가 붙는지, 새로 불러와도 번호가 남는지 확인합니다. 시험은 14개 항목 모두 통과했고, 화면 사진은 `docs/screenshots/2026-10-19_s1-10a_clips_connections/` 에 있습니다 (`01_clip_created.png`, `03_reloaded.png`).
