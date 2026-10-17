# JS 204 — 목록 거르기 (`applySampleFilters` · `applyFilters` 연결)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-07 샘플 라이브러리: 열두 번째 함수 (FR-224 검색·필터) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 205 `toggleSamplePreview` |

## 1. 하는 일
검색어·필터 칩·고른 태그로 목록 줄을 숨기고 개수를 셉니다. 이름은 `#` 로 시작하면 태그에서, 아니면 이름에서 찾습니다. 0건이면 빈 목록/결과 없음(209)을 보여 줍니다.

```
#file-search  ─┐
필터 칩(All/Drums/…)─┼─▶ applySampleFilters ─▶ 줄 숨김/보임 + sq-files__count
＋ Tag(name)  ─┘                                └─▶ toggleEmptyState (0건일 때)
```

## 2. 코드
```js
function applySampleFilters() {
  const listEl = document.getElementById('file-list');
  if (!listEl) return;
  const searchEl = document.getElementById('file-search');
  const q = (searchEl && searchEl.value ? searchEl.value : '').trim().toLowerCase();
  const chip = document.querySelector('.sq-filters [aria-pressed="true"]');
  const chipName = chip && chip.textContent ? chip.textContent.trim() : '';
  const re = FILTERS[chipName] ? FILTERS[chipName] : null;
  const tagName = sampleState.filterTag ? sampleState.filterTag.toLowerCase() : null;
  const byTag = q.charAt(0) === '#';
  let shown = 0;
  listEl.querySelectorAll('.sq-file').forEach((li) => {
    const nameEl = li.querySelector('.sq-file__name');
    const name = nameEl ? nameEl.textContent.toLowerCase() : '';
    const tags = Array.prototype.map.call(li.querySelectorAll('.sq-file__tag'), (t) => t.textContent.toLowerCase());
    let ok = true;
    if (q) ok = byTag ? tags.some((t) => t.indexOf(q.slice(1)) !== -1) : name.indexOf(q) !== -1;
    if (ok && re && !re.test(name)) ok = false;
    if (ok && tagName && tags.indexOf(tagName) === -1) ok = false;
    li.hidden = !ok;
    if (ok) shown++;
  });
  const count = document.querySelector('.sq-files__count');
  if (count) count.textContent = shown + ' items';
  toggleEmptyState(sampleState.total, shown);
}
```
기존 함수는 이 함수로 넘김 — `applyFilters`
```js
function applyFilters() {
  const list = visibleList();
  if (list && list.id === 'file-list') { applySampleFilters(); return; }
  /* … 다른 목록(Presets·Patterns …)은 예전 규칙대로 … */
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 이미 받은 줄만 거름(클라이언트) | 한 쪽(≤50줄)이라 즉시 반응합니다. 서버를 다시 부르지 않아 입력이 끊기지 않습니다 |
| `#` 접두사로 태그 검색 | note 75 의 안내("try #Drums")와 맞춥니다. `#` 없으면 이름 검색입니다 |
| 칩은 `FILTERS` 정규식 재사용 | 목업부터 쓰던 규칙(`Drums: /kick|snare|hat|drum|perc/i` 등)을 그대로 씁니다 |
| `applyFilters` 위임 | 왼쪽 목록에는 샘플 외에 Presets·Patterns 등이 있어(카테고리별 생성 목록) 그쪽은 예전 규칙을 유지합니다. `#file-list` 일 때만 새 함수로 보냅니다 |
| 숨김은 `hidden` 속성 | CSS `.sq-file[hidden]` 이 `display:none` 이라 레이아웃에서 빠집니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| `kick` 검색 → 1줄('Kick 909')만 보임 | ✔ |
| `zzz` 검색 → 결과 없음 표시, 안내 문구 'zzz' | ✔ |
| `Loops` 칩 → 0줄 + 결과 없음 표시 | ✔ |
| `All` 로 되돌리면 3줄 | ✔ |
| `＋ Tag` 1회 → '#Techno', 'Vocal Chop' 1줄만 보임 | ✔ |
