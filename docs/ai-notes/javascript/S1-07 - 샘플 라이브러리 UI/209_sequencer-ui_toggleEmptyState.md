# JS 209 — 빈 목록 · 결과 없음 (`toggleEmptyState`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-07 샘플 라이브러리: 열일곱 번째 함수 (FR-221·224 빈 상태) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 210 `startSampleEdit` |

## 1. 하는 일
목록이 0건일 때 알맞은 안내를 보여 줍니다. 전체가 0건이면 "샘플 없음"(업로드 유도), 전체는 있는데 거른 결과가 0건이면 "결과 없음"(검색 지우기)을 띄웁니다.

```
전체 0건          → #files-empty 보임 (Upload files)
전체>0, 보임 0건  → #files-noresults 보임 ("No samples match “<검색어>”")
그 외             → 둘 다 숨김
```

## 2. 코드
```js
function toggleEmptyState(total, shown) {
  const empty = document.getElementById('files-empty');
  const none = document.getElementById('files-noresults');
  if (!empty || !none) return;
  empty.hidden = total > 0;
  const noResults = total > 0 && shown === 0;
  none.hidden = !noResults;
  if (noResults) {
    const query = document.getElementById('noresults-query');
    const searchEl = document.getElementById('file-search');
    if (query) query.textContent = searchEl ? searchEl.value.trim() : '';
  }
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 두 상태를 구분 | 빈 패널에 "검색을 지우세요"는 말이 안 됩니다. 상황에 맞는 안내를 보여 줍니다 |
| `hidden` 속성 | CSS `.sq-empty[hidden]{display:none}` 로 감춥니다. 목록 영역 자리(008)는 그대로 둡니다 |
| 검색어를 안내에 넣음 | "No samples match “zzz”" 처럼 무엇을 찾았는지 되짚어 줍니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 3건 정상 → 둘 다 숨김 | ✔ |
| `zzz` 검색 → 결과 없음 보임, 문구 'zzz' | ✔ |
| `Loops` 칩 → 결과 없음 보임 | ✔ |
