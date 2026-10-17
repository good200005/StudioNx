# JS 210 — 이름·태그 편집 · 삭제 · 버튼 연결 (`startSampleEdit` · `saveSampleEdit` · `removeSample` · `bindSamplePanelEvents`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-07 샘플 라이브러리: 열여덟 번째 함수 (FR-225 이름·태그·삭제, FR-224 연결) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 함수 문서 합본 PDF · 개요 ai-note 76 · 커밋 |

## 1. 하는 일
줄을 더블 클릭하면 아래에 편집 상자를 열어 이름과 태그를 고칩니다. Save 를 누르면 바뀐 것만 서버로 보내고(197·198) 그 줄만 다시 그립니다. 줄의 × 로 샘플을 지웁니다(199). 이 모든 버튼을 `bindSamplePanelEvents` 가 한 곳에서 연결합니다.

```
#file-list  dblclick  → startSampleEdit(li)
   li.sq-file-edit
   ├─ input.sq-file-edit__name
   ├─ div.sq-file-edit__tags > button.sq-file-edit__tag[aria-pressed]
   └─ button.sq-link(Cancel) / button.sq-upload.sq-file-edit__save(Save)
   Save → saveSampleEdit → renameSample? + setSampleTags? → replaceSampleRow

#file-list  click .sq-file__del → removeSample → confirm → deleteSample → 줄 제거

bindSamplePanelEvents (201 에서 한 번)
  ├─ #file-list click/delegate (삭제 · 재생)
  ├─ #file-list dblclick (편집)
  ├─ #file-search input (150ms 디바운스 → 204)
  ├─ .sq-filters click (칩 · ＋ Tag 순환)
  ├─ #upload-button · #empty-upload · #upload-input change (→ 206)
  ├─ #drop-zone dragover/dragleave/drop (→ 206)
  └─ #clear-search click
```

## 2. 코드
```js
function startSampleEdit(row) {
  const id = row.dataset.sampleId;
  const listEl = document.getElementById('file-list');
  if (!id || !listEl) return;
  const existing = listEl.querySelector('.sq-file-edit');
  if (existing) existing.remove();
  const item = findSampleItem(id);
  if (!item) return;
  const box = document.createElement('li');
  box.className = 'sq-file-edit';
  box.dataset.sampleId = id;
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'sq-file-edit__name';
  nameInput.maxLength = 200;
  nameInput.value = item.name;
  box.appendChild(nameInput);
  // 태그 버튼: /tags 목록으로 만들고, 붙은 것은 aria-pressed="true"
  const tagWrap = document.createElement('div');
  tagWrap.className = 'sq-file-edit__tags';
  const itemTagIds = (item.tags ? item.tags : []).map((t) => String(t.tag_id));
  sampleState.tags.forEach((t) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sq-file-edit__tag';
    btn.dataset.tagId = String(t.tag_id);
    btn.setAttribute('aria-pressed', itemTagIds.indexOf(String(t.tag_id)) !== -1 ? 'true' : 'false');
    btn.textContent = t.name;
    btn.addEventListener('click', () => btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
    tagWrap.appendChild(btn);
  });
  box.appendChild(tagWrap);
  // Cancel / Save
  // … 생략 …
  row.after(box);
  nameInput.focus();
  nameInput.select();
}

async function saveSampleEdit(row, box, item) {
  const name = box.querySelector('.sq-file-edit__name').value.trim();
  const tagIds = Array.prototype.map.call(box.querySelectorAll('.sq-file-edit__tag[aria-pressed="true"]'), (b) => Number(b.dataset.tagId));
  const currentIds = (item.tags ? item.tags : []).map((t) => String(t.tag_id)).sort().join(',');
  const nextIds = tagIds.map((n) => String(n)).sort().join(',');
  let updated = item;
  if (name && name !== item.name) updated = await renameSample(item.sample_id, name);
  if (currentIds !== nextIds) updated = await setSampleTags(item.sample_id, tagIds);
  replaceSampleRow(row, updated ? updated : item);
  box.remove();
  showToast('Sample updated');
}

function removeSample(row) {
  const id = row.dataset.sampleId;
  const item = findSampleItem(id);
  if (!id || !item) return;
  if (!window.confirm('Delete "' + item.name + '"?')) return;
  deleteSample(id).then(() => {
    if (sampleState.playingId === id) stopSamplePreview();
    sampleState.items = sampleState.items.filter((s) => String(s.sample_id) !== String(id));
    sampleState.usedBytes = Math.max(0, sampleState.usedBytes - (item.file_size ? item.file_size : 0));
    sampleState.total = Math.max(0, sampleState.total - 1);
    row.remove();
    updateStorageBar(sampleState.usedBytes, sampleState.limitBytes);
    applySampleFilters();
  });
}
```
편집 상자 열기 CSS (`studio.css`)
```css
.sq-file-edit { display: grid; gap: 0.35rem; padding: 0.45rem 0.65rem; border-bottom: 1px solid var(--sq-line); background: var(--sq-panel-2); }
.sq-file-edit__tag[aria-pressed="true"] { background: color-mix(in srgb, var(--sq-accent) 26%, transparent); border-color: var(--sq-accent); color: var(--c-ink); }
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 상자를 목록의 `li` 로 | 목록이 세로로 늘어서므로, 편집 상자도 줄 사이에 끼워 넣어 위치가 자연스럽습니다 |
| 한 번에 하나만 | 새로 열면 이전 상자를 지웁니다. 열린 상자가 여러 개면 어느 걸 저장하는지 헷갈립니다 |
| 바뀐 것만 보냄 | 이름만 바꿨으면 `PATCH` 만, 태그만 바꿨으면 `PUT` 만 보냅니다. 불필요한 요청이 없습니다 |
| 태그는 누름 버튼 | 태그가 많아도 목록에서 골라 켜고 끌 수 있습니다. 저장 시 켜진 것의 번호를 모읍니다 |
| 지우기 전 `confirm` | 되돌릴 수 없는 작업이라 한 번 묻습니다 |
| 이벤트 위임(delegate) | 줄이 다시 그려져도(202) 위임이라 다시 붙일 필요가 없습니다. 배선이 `bindSamplePanelEvents` 한 곳에 모입니다 |
| 검색 150ms 디바운스 | 타자마다 거르면 느립니다. 잠깐 멈추면 한 번만 돌립니다 |
| 드롭은 `Files` 일 때만 | 트랙 클립을 끌어오는 내부 드래그와 구분합니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 더블 클릭 → 상자 열림(이름 'Kick 909', 태그 버튼 2개, 붙은 것 1개 눌림) | ✔ |
| 이름 바꾸고 태그 토글 후 Save → `PATCH` + `PUT` 호출, 줄 이름 'Kick 909 v2' | ✔ |
| × → 확인 → `DELETE`, 줄 3 → 2, 저장 용량 820 → 703 KB | ✔ |
| `＋ Tag` 클릭 → '#Techno' 눌림, 'Vocal Chop' 1줄만 보임 | ✔ |
| 검색 입력 → 150ms 뒤 1회 필터 | ✔ |
| 파일 드롭 → `#upload-list` 에 진행 줄 | ✔ |
| 콘솔 오류 0건 | ✔ |
