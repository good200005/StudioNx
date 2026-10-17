# JavaScript 223 — 펼침 상태 기억 (`saveOpenPanels` · `restoreOpenPanels`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-08 아코디언·피아노롤: 트랙 아코디언 펼침 상태 기억 (FR-261 의 V 토글에 더한 사용자 요구) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 222 트랙 메뉴·단축키 · 224 노트 변화 알림 |

## 1. 하는 일
V 버튼으로 트랙을 펼칠 때마다 **지금 펼쳐 둔 트랙 번호**를 `localStorage` 에 담아 둡니다. 화면을 다시 열면 담아 둔 트랙들을 그대로 다시 펼칩니다. FR-261 의 원래 규칙(기본은 하나만 열림, Shift 로 여러 개, 펼친 만큼 아래 트랙을 밀기)은 `toggleTrackPanel` 이 이미 지키고 있고, 이 함수는 그 상태를 **기억**하는 부분을 맡습니다.

```
V 클릭 → toggleTrackPanel (열기/닫기 · 하나만/여러 개)
          └─ saveOpenPanels()            ← 펼쳐진 트랙 번호를 담음
화면 다시 열기 → restoreOpenPanels()      ← 담아 둔 트랙을 다시 펼침
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `toggleTrackPanel` (2367) | 상태가 바뀐 뒤 `saveOpenPanels` 를 부릅니다 |
| `sequencer.js` 시작부 | 트랙이 그려진 뒤 `restoreOpenPanels` 를 부릅니다 |

## 3. 코드
```js
/** V — 그 트랙 펼침 열고 닫기 (기본은 하나만, Shift 면 여러 개) */
export function toggleTrackPanel(track, keepOthers = false) {
  const btn = track.querySelector('.sq-expand');
  const acc = ensureAccordion(track);
  if (!btn || !acc) return;
  const open = acc.hidden;
  if (open && !keepOthers) {
    document.querySelectorAll('.sq-acc:not([hidden])').forEach((a) => {
      a.hidden = true;
      const t = a.previousElementSibling;
      t?.classList.remove('is-open');
      t?.querySelector('.sq-expand')?.setAttribute('aria-expanded', 'false');
    });
  }
  acc.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  track.classList.toggle('is-open', open);
  saveOpenPanels();
}

const PANEL_KEY = 'sq-open-tracks';

function saveOpenPanels() {
  try {
    const ids = [...document.querySelectorAll('#tracks > .sq-track.is-open')]
      .map((t) => t.dataset.trackId)
      .filter(Boolean);
    localStorage.setItem(PANEL_KEY, JSON.stringify(ids));
  } catch { /* 저장 못 하는 환경은 그냥 넘어감 */ }
}

export function restoreOpenPanels() {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(PANEL_KEY) || '[]'); } catch { ids = []; }
  if (!Array.isArray(ids) || !ids.length) return;
  for (const id of ids) {
    const track = document.querySelector(`#tracks > .sq-track[data-track-id="${id}"]`);
    if (track && !track.classList.contains('is-open')) toggleTrackPanel(track, true);
  }
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `PANEL_KEY` | localStorage 에 담을 때 쓰는 열쇠 이름(`sq-open-tracks`)입니다 |
| `querySelectorAll('#tracks > .sq-track.is-open')` | 지금 펼쳐진 트랙 줄만 골라냅니다 |
| `.map((t) => t.dataset.trackId)` | 각 줄의 `data-track-id` 를 모읍니다 |
| `.filter(Boolean)` | 번호가 없는 줄을 걸러 냅니다 |
| `JSON.stringify(ids)` | 번호 배열을 글자로 바꿔 담습니다 |
| `JSON.parse(... || '[]')` | 담긴 글자를 배열로 되돌립니다. 없으면 빈 배열 |
| `toggleTrackPanel(track, true)` | `true`(keepOthers) 로 여러 트랙을 차례로 펼칩니다 |
| `try { … } catch { … }` | 저장을 못 하는 환경도 있으니 실패해도 앱이 멈추지 않게 합니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 트랙 번호로 담음 | 순서가 바뀌어도 번호가 같으면 다시 펼 수 있습니다 |
| `keepOthers=true` 로 복원 | 펼친 트랙이 여럿일 수 있어 하나씩 순서대로 열어야 합니다 |
| 저장 실패를 삼킴 | 시크릿 모드처럼 저장이 막힌 곳에서도 나머지 기능은 그대로 돌아야 합니다 |

## 5. 시험
헤드리스 브라우저에서 트랙 1과 3을 펼친 뒤 새로 고침 → 두 트랙이 그대로 펼쳐지고(`is-open` 2개, 아코디언 2개 표시) 저장 값이 `["1","3"]` 인 것을 확인했습니다. Shift 없이 다른 트랙을 펼치면 그 하나만 남는 것도 확인했습니다(콘솔 오류 0건).
