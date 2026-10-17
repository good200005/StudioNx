# JS 201 — 샘플 라이브러리 시작 (`initSamplePanel` · `loadSampleList`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-07 샘플 라이브러리: 아홉 번째 함수 (FR-221~227 패널 시작) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 202 `renderSampleList` |

## 1. 하는 일
왼쪽 샘플 패널을 시작합니다. 목업 예시 업로드 줄을 비우고, 패널의 모든 버튼을 연결(1165)한 뒤, 태그(200)와 목록(193)을 차례로 불러 그립니다. 둘 중 하나가 실패해도 패널은 그대로 씁니다.

```
initUI (sequencer-ui.js:15)
└─ initSamplePanel
   ├─ #upload-list 비우기 (목업 예시 줄 제거)
   ├─ bindSamplePanelEvents()      ← 검색·필터·업로드·드롭·삭제·편집 연결
   ├─ readStorageLimit()           ← 화면에 적힌 "… / 1 GB" 를 읽어 둠
   ├─ fetchTags() → sampleState.tags
   └─ loadSampleList() → fetchSampleList({ size: 50 }) → renderSampleList
```

## 2. 코드
```js
async function initSamplePanel() {
  const listEl = document.getElementById('file-list');
  if (!listEl) return;
  const uploadEl = document.getElementById('upload-list');
  if (uploadEl) { uploadEl.textContent = ''; uploadEl.hidden = true; }   // 목업 예시 줄 비우기
  bindSamplePanelEvents();
  readStorageLimit();
  try {
    const tagRes = await fetchTags();
    sampleState.tags = tagRes && tagRes.items ? tagRes.items : [];
  } catch (e) {
    sampleState.tags = [];   // 태그가 없어도 목록은 보여 줍니다
  }
  await loadSampleList();
}

async function loadSampleList() {
  try {
    const res = await fetchSampleList({ size: 50 });
    renderSampleList(res && res.items ? res.items : [], res ? res.total : 0);
  } catch (e) {
    if (!e || e.status !== 401) showToast('Could not load your samples');
  }
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `initUI` 에서 부름 | 패널은 한 번만 시작하면 됩니다. 함수마다 이벤트를 붙이지 않아 배선이 한 곳(여기)에 모입니다 |
| 업로드 줄 비우기 | 목업에 있던 예시 진행 줄은 진짜 업로드가 아닙니다. 첫 업로드부터 깨끗하게 시작합니다 |
| 태그 실패를 삼킴 | 태그가 없어도 목록·재생은 되어야 합니다. 실패를 `try` 안에서 삼키고 빈 목록으로 둡니다 |
| 401 은 조용히 | 로그인 안 된 상태는 오류 창이 아니라 로그인 흐름이 맡습니다. 그 외 오류만 `showToast` 로 알립니다 |
| 실패 시 예시 줄 유지 | `renderSampleList` 는 성공했을 때만 호출됩니다. 서버가 없으면 HTML 예시 줄이 그대로 남아 화면이 비지 않습니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 목록 3줄이 그려지고 업로드 예시 줄이 사라짐 | ✔ |
| 태그 2개가 `sampleState.tags` 에 담김 | ✔ |
| 콘솔 오류 0건 | ✔ |
