# JS 206 — 업로드 줄 세우기 (`uploadQueue`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-07 샘플 라이브러리: 열네 번째 함수 (FR-226 업로드) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 207 `renderUploadRow` |

## 1. 하는 일
고르거나 끌어다 놓은 파일들을 하나씩 올립니다. 파일마다 진행 줄(207)을 만들고, 진행률은 `uploadSample`(194)의 콜백으로 채웁니다. 취소(×)를 누르면 그 파일만 멈춥니다. 성공하면 줄을 지우고 새 샘플을 목록 맨 위에 넣고 저장 용량을 더합니다.

```
Upload 버튼 / 드롭 / 빈 목록 버튼 → uploadQueue(files)
  파일마다:
    renderUploadRow → li.sq-upload-row        (207)
    uploadSample(file, { signal, onProgress }) (194)
      progress → setUploadProgress(줄, %)
      성공 → 줄 지움 + prependSampleRow + 저장 용량 갱신
      취소 → 줄 지움
      실패 → 줄에 is-error + 짧은 이유 (uploadErrorMessage)
  줄이 하나도 안 남으면 #upload-list 숨김
```

## 2. 코드
```js
function uploadQueue(fileList) {
  const listEl = document.getElementById('upload-list');
  if (!listEl) return;
  const files = Array.prototype.slice.call(fileList);
  if (!files.length) return;
  listEl.hidden = false;
  files.forEach((file) => {
    const row = renderUploadRow(file);
    const controller = new AbortController();
    const cancel = row.querySelector('.sq-upload-row__cancel');
    if (cancel) cancel.addEventListener('click', () => controller.abort());
    uploadSample(file, {
      signal: controller.signal,
      onProgress: (loaded, total) => setUploadProgress(row, loaded, total),
    }).then((sample) => {
      row.remove();
      if (!listEl.children.length) listEl.hidden = true;
      if (sample) {
        prependSampleRow(sample);
        sampleState.usedBytes += sample.file_size ? sample.file_size : 0;
        sampleState.total += 1;
        updateStorageBar(sampleState.usedBytes, sampleState.limitBytes);
        applySampleFilters();
      }
      showToast(file.name + ' uploaded');
    }).catch((err) => {
      if (err && err.code === 'ABORTED') row.remove();
      else { row.classList.add('is-error'); row.querySelector('em').textContent = uploadErrorMessage(err); }
      if (!listEl.children.length) listEl.hidden = true;
    });
  });
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 파일마다 `AbortController` | 취소(×)는 그 파일 하나만 멈춰야 합니다. 한 번에 여러 파일이 올라가도 서로 영향이 없습니다 |
| `Array.prototype.slice.call` | `FileList` 는 배열이 아니어서 `forEach` 를 못 씁니다(전통 문법 유지) |
| 성공 시 `prependSampleRow` | 서버가 돌려준 그 샘플을 목록 맨 위에 넣어, 다시 목록을 받지 않고도 바로 보이게 합니다 |
| 실패 줄은 남겨 둠 | 왜 실패했는지(`Too large` 등)를 보여 줍니다. 취소만 줄을 지웁니다 |
| 빈 목록은 숨김 | 진행 줄이 하나도 없으면 `#upload-list` 를 감춥니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 파일 1개 드롭 → 줄이 1개 생기고 0% 표시 | ✔ |
| 끝나면 줄이 사라지고 `#upload-list` 가 숨겨짐 | ✔ |
| 새 샘플 'New Loop' 이 목록 맨 위에 붙고 개수가 3으로 복귀 | ✔ |
