# JS 202 — 샘플 목록 그리기 (`renderSampleList` · `sampleRow`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-07 샘플 라이브러리: 열 번째 함수 (FR-224 목록) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 203 `drawSampleWaveform` |

## 1. 하는 일
받은 샘플 배열로 `#file-list` 를 다시 그립니다. `studioNx.html` 의 예시 줄을 지우고, 한 건마다 `li.sq-file` 한 줄(`sampleRow`)을 만듭니다. 한 줄에는 재생 버튼 · 아이콘 · 이름+태그 · 길이/키 · 파형 · 삭제 버튼이 들어갑니다. 다 그리면 거르기(204)를 한 번 돌립니다.

```
li.sq-file[data-sample-id][data-kind=audio][data-name][data-bars]
├─ button.sq-file__play        ▶ / ❚❚
├─ span.sq-file__icon          이름·태그로 고른 이모지
├─ span.sq-file__title
│  ├─ span.sq-file__name       이름
│  └─ span.sq-file__tags       span.sq-file__tag (장르는 is-genre)
├─ span.sq-file__meta          "0:05 · Am · 128"
├─ span.sq-file__wave          <i>(진행) + JS 가 그리는 <canvas>
└─ button.sq-file__del         ×
```

## 2. 코드
```js
function renderSampleList(items, total) {
  const listEl = document.getElementById('file-list');
  if (!listEl) return;
  sampleState.items = items;
  sampleState.total = total;
  listEl.textContent = '';
  items.forEach((item) => listEl.appendChild(sampleRow(item)));
  sampleState.usedBytes = items.reduce((sum, item) => sum + (item.file_size ? item.file_size : 0), 0);
  updateStorageBar(sampleState.usedBytes, sampleState.limitBytes);
  applySampleFilters();
}
```
한 줄 — `sampleRow` (요약)
```js
function sampleRow(item) {
  const li = document.createElement('li');
  li.className = 'sq-file';
  li.setAttribute('role', 'option');
  li.setAttribute('aria-selected', 'false');
  li.setAttribute('draggable', 'true');
  li.dataset.kind = 'audio';
  li.dataset.sampleId = String(item.sample_id);
  li.dataset.name = item.name;
  li.dataset.bars = String(sampleBars(item.duration_ms));
  // 재생 · 아이콘 · 이름+태그 · 메타 · 파형 · 삭제 버튼을 차례로 붙임
  drawSampleWaveform(li);   // 203 — 파형은 나중에 채워짐
  return li;
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `#file-list` 를 통째로 다시 그림 | 한 쪽 분량(≤50줄)이라 값싸고, 순서·개수 어긋남이 없습니다 |
| `draggable="true"` · `data-kind=audio` · `data-name` · `data-bars` | 트랙에 끌어 놓을 때 `sequencer-arrange.js`(드래그 셀렉터 `.sq-file[draggable="true"][data-kind]`)가 씁니다. 목업 줄과 같은 이름을 유지해야 합니다 |
| `data-bars` = `sampleBars(duration_ms)` | 120 BPM·4/4 기준(1마디 2초)으로 계산한 클립 길이입니다 |
| 태그는 이름 옆 작은 칩 | 목록을 좁히는 단서입니다. 장르 태그만 `is-genre` 색으로 구분합니다 |
| 다 그린 뒤 `applySampleFilters()` | 검색·필터가 이미 켜져 있으면 새 목록에도 바로 적용됩니다 |
| 저장 용량을 여기서 계산 | 목록을 받은 시점이 값을 아는 유일한 곳입니다. `file_size` 합으로 막대를 채웁니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 목록 3건 → `#file-list .sq-file` 3줄 | ✔ |
| 첫 줄 `data-bars` = 0.25 (500ms → 1/4마디) | ✔ |
| 저장 용량 820 KB / 1 GB, 막대 0.1% | ✔ |
