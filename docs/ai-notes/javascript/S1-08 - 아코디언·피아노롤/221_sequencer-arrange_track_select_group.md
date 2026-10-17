# JavaScript 221 — 트랙 선택과 그룹 (`selectTrack` · `groupSelectedTracks` · `ungroupTracks` · `deleteSelectedTracks` · `addGroup`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-08 아코디언·피아노롤: 사용자 요구 3번 (트랙 선택 + 그룹화, FR-207) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 220 겹쳐 찍기 · 222 트랙 메뉴·단축키 |

## 1. 하는 일
트랙 머리의 빈 곳을 클릭해 트랙을 고르고, 고른 트랙들을 그룹으로 묶거나 풉니다. 그룹은 안쪽 트랙을 접었다 펼 수 있고, 그룹을 풀거나 지우면 안쪽 트랙은 다시 밖으로 나옵니다.

| 함수 | 하는 일 |
|---|---|
| `selectedTracks()` | 지금 선택된 트랙 줄 (MASTER 제외) |
| `clearTrackSelection()` | 트랙 선택 풀기 |
| `selectTrack(track, e)` | 그냥 클릭 = 이것만, Ctrl/Cmd = 더하고 빼기, Shift = 기준 트랙에서 여기까지 모두 |
| `createGroupEl()` | `Group N` 그룹 줄 하나를 만듦 |
| `updateGroupCount(group)` | 그룹 머리의 `N tracks` 글자를 맞춤 |
| `addGroup(notify)` | 빈 그룹 하나를 리턴·MASTER 위에 넣음 |
| `groupSelectedTracks(notify)` | 선택 트랙들을 새 그룹으로 묶음 (선택 없으면 빈 그룹) |
| `ungroupTracks(notify)` | 선택 그룹을 풀어 안쪽 트랙을 밖으로 냄 |
| `deleteSelectedTracks(notify)` | 선택 트랙을 지움 (그룹이면 안쪽을 밖으로 낸 뒤) |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 트랙 머리 클릭 (2654 `initTrackButtons`) | `selectTrack` 을 부릅니다 |
| 오른쪽 클릭 메뉴 (222) · `Ctrl+G` | `groupSelectedTracks`·`ungroupTracks`·`deleteSelectedTracks` 를 부릅니다 |
| ADD › Group track | `addGroup` 을 부릅니다 |

```
selectTrack(track, e)
├─ Shift + 기준 트랙 있음 → 기준~여기 사이 모두
├─ Ctrl/Cmd            → 그 트랙만 더하거나 빼기 (기준 갱신)
└─ 그냥 클릭            → 이것만 선택 (기준 갱신)
```

## 3. 코드
```js
export function selectTrack(track, e = {}) {
  if (!track || track.classList.contains('sq-track--master')) return;
  const list = trackItems();
  const multi = e.ctrlKey || e.metaKey;
  if (e.shiftKey && trackAnchor && list.includes(trackAnchor)) {
    const a = list.indexOf(trackAnchor);
    const b = list.indexOf(track);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    list.forEach((t, i) => t.classList.toggle('is-selected', i >= lo && i <= hi && !t.classList.contains('sq-track--master')));
  } else if (multi) {
    track.classList.toggle('is-selected');
    trackAnchor = track;
  } else {
    list.forEach((t) => t.classList.toggle('is-selected', t === track));
    trackAnchor = track;
  }
}

export function groupSelectedTracks(notify = arrangeOnChange) {
  const sel = selectedTracks();
  if (!sel.length) return addGroup(notify);
  const group = createGroupEl();
  sel[0].before(group);
  [...sel].reverse().forEach((t) => {
    const acc = t.nextElementSibling;                       // 펼침 칸은 트랙 바로 뒤에 붙어 있음
    const withAcc = acc && acc.classList.contains('sq-acc') ? acc : null;
    group.after(t);                                         // 역순으로 넣어 원래 차례를 지킴
    if (withAcc) t.after(withAcc);
    t.dataset.parent = group.dataset.trackId;
    t.classList.add('is-child');
  });
  clearTrackSelection();
  group.classList.add('is-selected');
  trackAnchor = group;
  updateGroupCount(group);
  notify({ type: 'group', trackId: group.dataset.trackId, children: sel.map((t) => t.dataset.trackId) });
  return group;
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `trackAnchor` | Shift 로 "여기까지" 를 잴 기준 트랙을 담아 둡니다 |
| `list.indexOf(t)` | 그 줄이 목록에서 몇 번째인지 구합니다 |
| `classList.toggle('is-selected', 참거짓)` | 두 번째 값이 참이면 붙이고 거짓이면 뗍니다 |
| `sel[0].before(group)` | 첫 선택 트랙 **앞**에 그룹 줄을 넣습니다 |
| `[...sel].reverse()` | 뒤에서부터 옮겨 원래 위→아래 차례를 지킵니다 |
| `dataset.parent` | 안쪽 트랙에 부모 그룹 번호를 적어 둡니다 |
| `notify({ type: 'group', ... })` | 저장을 위해 바뀐 사실을 알립니다 (서버 연결은 S1-10) |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| MASTER 는 항상 제외 | MASTER 는 옮기거나 지울 수 없는 줄입니다. 선택 대상에서 뺍니다 |
| 펼침 칸도 함께 옮김 | 트랙 바로 뒤에 `.sq-acc`(아코디언)가 붙어 있어, 트랙만 옮기면 칸이 떨어집니다 |
| 그룹을 풀면 안쪽을 밖으로 | 안쪽 트랙을 숨긴 채 그룹만 지우면 트랙이 사라진 것처럼 보입니다. 밖으로 낸 뒤 지웁니다 |
| `notify` 로 알림 | 서버 저장(자동 저장)은 S1-10 이 붙입니다. 지금은 바뀐 사실만 알립니다 |

## 5. 시험
헤드리스 브라우저에서 트랙 2개를 골라 `Ctrl+G` → 그룹이 1개 생기고 안쪽 2개가 `data-parent` 로 묶이며 접기/펼치기가 되는 것을 확인했습니다(콘솔 오류 0건).
