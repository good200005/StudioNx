# JS 205 — 미리듣기 (`toggleSamplePreview` · `stopSamplePreview` · `setSamplePlayGlyph`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-07 샘플 라이브러리: 열세 번째 함수 (FR-224 미리듣기) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 206 `uploadQueue` |

## 1. 하는 일
줄의 ▶ 를 누르면 그 샘플을 재생하고, 다시 누르면 멈춥니다. 한 번에 하나만 재생하며, 재생 중에는 파형 채움(`--p`)이 현재 위치를 따라갑니다.

```
▶ 클릭 → toggleSamplePreview
  ├─ 같은 줄이면 → stopSamplePreview
  ├─ fetchSampleFileUrl(id)  ← 195 (blob → objectURL)
  ├─ new Audio(url).play()
  └─ timeupdate → .sq-file__wave i 의 --p = 현재/전체
     'ended'  → stopSamplePreview
```

## 2. 코드
```js
async function toggleSamplePreview(row) {
  const id = row.dataset.sampleId;
  if (!id) return;
  if (sampleState.playingId === id) { stopSamplePreview(); return; }
  stopSamplePreview();
  let url = null;
  try { url = await fetchSampleFileUrl(id); } catch (e) { showToast('Could not load the sample'); return; }
  const audio = new Audio(url);
  sampleState.audio = audio;
  sampleState.playingId = id;
  row.classList.add('is-playing');
  setSamplePlayGlyph(row, true);
  const fill = row.querySelector('.sq-file__wave i');
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const p = Math.min(100, (audio.currentTime / audio.duration) * 100);
    if (fill) fill.style.setProperty('--p', p.toFixed(1) + '%');
  });
  audio.addEventListener('ended', () => stopSamplePreview());
  const played = audio.play();
  if (played && played.catch) played.catch(() => stopSamplePreview());
}

function stopSamplePreview() {
  const id = sampleState.playingId;
  if (sampleState.audio) { sampleState.audio.pause(); sampleState.audio = null; }
  sampleState.playingId = null;
  if (id == null) return;
  const row = document.querySelector('#file-list .sq-file[data-sample-id="' + id + '"]');
  if (!row) return;
  row.classList.remove('is-playing');
  setSamplePlayGlyph(row, false);
  const fill = row.querySelector('.sq-file__wave i');
  if (fill) fill.style.setProperty('--p', '0%');
}

function setSamplePlayGlyph(row, playing) {
  const btn = row.querySelector('.sq-file__play');
  if (!btn) return;
  btn.textContent = playing ? '❚❚' : '▶';
  btn.setAttribute('aria-label', (playing ? 'Pause ' : 'Preview ') + (row.dataset.name || 'sample'));
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `sampleState.playingId` 하나로 관리 | 동시에 한 곡만 재생하게 합니다. 다른 줄을 누르면 먼저 멈춥니다 |
| `is-playing` 클래스 | CSS 가 이 클래스로 재생 파형 채움(`<i>`)을 보이게 합니다(203) |
| `--p` 로 진행 표시 | 목업의 파형 채움과 같은 변수라 따로 그리지 않습니다 |
| `play()` 실패를 `catch` | 브라우저 정책·디코딩 실패로 재생이 안 되면 화면만 되돌립니다(오류 창 없음) |
| 끝나면 상태 초기화 | 'ended' 에서 채움을 0% 로, 글리프를 ▶ 로 되돌립니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| ▶ 클릭 시 `/samples/{id}/file` 요청 발생 (1회) | ✔ |
| 재생 중 `.is-playing` · 글리프 ❚❚ (파일 로드 후) | ✔ (설계) |
| 다시 클릭·'ended' 시 ▶ 로 복귀, 채움 0% | ✔ (설계) |
