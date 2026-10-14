# JS 141 — `deleteTrack()` (트랙 삭제)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js`, `studionx/frontend/static/css/pages/studio.css` |
| 작업 | S1-06 타임라인: 스물일곱 번째 함수 (FR-207 트랙 삭제) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | 트랙 순서 드래그(그립) 배선과 이름·색 변경을 이어서 진행합니다 |

## 1. 하는 일
트랙 머리의 **× 버튼**을 누르면 그 트랙 줄을 지우고 남은 번호를 다시 매깁니다.

```
1. Kick   2. Bass   3. Lead        ← 2번의 × 클릭
1. Kick             2. Lead        ← 줄을 지우고 번호를 다시 매김
```

- MASTER는 지우지 않습니다(맨 아래 고정 줄). MIDI · 오디오 · 리턴 · 그룹은 지웁니다.
- × 는 평소엔 숨겨 두고, 트랙 머리에 마우스를 올리거나 키보드 포커스가 닿으면 보입니다.

| 하는 일 | 부르는 것 | 결과 |
|---|---|---|
| × 클릭 | `deleteTrack(track, onChange)` | 줄 삭제 + 번호정리 + 알림 |
| MASTER × | 없음(버튼 안 만듦) | MASTER 못 지움 |
| ＋ Add Track | `addTrack()` | 새 줄에 × 포함, 번호 다시 매김 |

## 2. 코드
`sequencer-arrange.js`
```js
export function deleteTrack(track, notify = () => {}) {
  if (!track || track.classList.contains('sq-track--master')) return null;
  const trackId = track.dataset.trackId;
  track.remove();
  renumberTracks(notify);
  notify({ type: 'delete', trackId });
  return trackId;
}

function ensureTrackDelete(root) {
  root.querySelectorAll('.sq-track').forEach((track) => {
    if (track.classList.contains('sq-track--master')) return;
    const head = track.querySelector('.sq-track__head');
    if (!head || head.querySelector('.sq-track__del')) return;
    head.append(trackDeleteButton());
  });
}

function trackDeleteButton() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sq-track__del';
  b.setAttribute('aria-label', 'Delete track');
  b.setAttribute('title', 'Delete track');
  b.textContent = '×';
  return b;
}
```
클릭 연결 (initTrackButtons 안)
```js
if (b.matches('.sq-track__del')) { deleteTrack(track, onChange); return; }
```
`createTrack()`·`addTrack()`의 머리 HTML에도 × 버튼을 넣었습니다.

`studio.css`
```css
.sq-track__del {
  flex: none; width: 1.1rem; height: 1.1rem; display: grid; place-items: center;
  border: 1px solid var(--sq-line-2); font: 700 0.7rem/1 var(--font-text);
  color: var(--c-ink-soft); background: rgb(0 0 0 / 0.15); opacity: 0;
  transition: opacity 0.12s;
}
.sq-track__head:hover .sq-track__del,
.sq-track__del:focus-visible { opacity: 1; }
.sq-track__del:hover { color: var(--sq-rec); border-color: var(--sq-rec); }
.sq-track--master .sq-track__del { display: none; }
```
**최신 문법으로 쓰면** (공부용)
```js
export const deleteTrack = (track, notify = () => {}) => {
  if (!track || track.classList.contains('sq-track--master')) return null;
  const { trackId } = track.dataset;
  track.remove();
  renumberTracks(notify);
  notify({ type: 'delete', trackId });
  return trackId;
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `const { trackId } = track.dataset` | `track.dataset.trackId` | 같은 값입니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 줄을 지운 뒤 번호정리 | 번호는 자리에서 나옵니다. 지우고 `renumberTracks()`를 부르면 빈 번호가 남지 않습니다 |
| MASTER 보호 | MASTER는 항상 맨 아래 필요한 줄입니다. 함수와 CSS 두 곳에서 막아 실수로 못 지웁니다 |
| 기존 줄엔 JS로 버튼 삽입 | 트랙 줄이 13개라 HTML을 13번 고치는 것보다, 한 곳(`ensureTrackDelete`)에서 한 번에 붙이는 편이 안전합니다 |
| 이미 있으면 건너뜀 | 다시 초기화해도 × 가 겹쳐 붙지 않습니다 |
| × 는 hover 시에만 | 평소 화면이 깔끔합니다. 실수로 누를 위험도 줄입니다(M/A/S 옆이지만 숨겨 둠) |
| 지운 뒤 알림 | 저장(S1-10)이 붙을 때 `{type:'delete'}`를 받아 처리합니다 |

## 4. 시험
**(1) Node 단위 시험** — 모듈 적재만 확인(11개 그대로 통과).

**(2) 브라우저 확인(Chrome headless + CDP, 실제 `studioNx.html`)**
| 확인 | 결과 |
|---|---|
| 처음 번호 1~10 → 2번 × 클릭 뒤 1~9, 줄 수 11→10 | ✔ |
| MASTER 줄에 × 없음(`masterHasDel` false) · `deleteTrack(master)` → null · MASTER 남음 | ✔ |
| 다시 초기화해도 × 수 안 늘어남(중복 방지) | ✔ |
| ＋ Add Track 뒤 새 줄(11. MIDI)에 × 있음 | ✔ |
| × 기본 `opacity: 0`(숨김, hover 시 표시) | ✔ |

검토용 화면: `docs/ai-notes/images/javascript_s1-06/s1-06_track-delete.png` (× 를 보이도록 한 모습).
