# JS 207 — 업로드 진행 줄 (`renderUploadRow` · `setUploadProgress` · `uploadErrorMessage`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-07 샘플 라이브러리: 열다섯 번째 함수 (FR-226 진행 표시) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 208 `updateStorageBar` |

## 1. 하는 일
업로드 중인 파일 하나의 진행 줄(`li.sq-upload-row`)을 만들어 `#upload-list` 에 붙입니다. 진행률을 채우고, 실패하면 짧은 이유를 보여 줍니다.

```
li.sq-upload-row
├─ span.sq-upload-row__ic       🎵
├─ b                            파일 이름
├─ em                           "0%" → "100%" (실패 시 "Too large" 등)
├─ button.sq-upload-row__cancel ×
└─ span.sq-upload-row__bar > i  --p 로 채움
```

## 2. 코드
```js
function renderUploadRow(file) {
  const listEl = document.getElementById('upload-list');
  const li = document.createElement('li');
  li.className = 'sq-upload-row';

  const icon = document.createElement('span');
  icon.className = 'sq-upload-row__ic';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🎵';
  li.appendChild(icon);

  const name = document.createElement('b');
  name.textContent = file.name;
  li.appendChild(name);

  const state = document.createElement('em');
  state.textContent = '0%';
  li.appendChild(state);

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'sq-upload-row__cancel';
  cancel.setAttribute('aria-label', 'Cancel upload');
  cancel.textContent = '×';
  li.appendChild(cancel);

  const bar = document.createElement('span');
  bar.className = 'sq-upload-row__bar';
  const fill = document.createElement('i');
  fill.style.setProperty('--p', '0%');
  bar.appendChild(fill);
  li.appendChild(bar);

  if (listEl) listEl.appendChild(li);
  return li;
}

function setUploadProgress(row, loaded, total) {
  const p = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const fill = row.querySelector('.sq-upload-row__bar i');
  if (fill) fill.style.setProperty('--p', p + '%');
  const state = row.querySelector('em');
  if (state) state.textContent = p + '%';
}

function uploadErrorMessage(err) {
  if (!err) return 'Upload failed';
  if (err.code === 'STORAGE_QUOTA_EXCEEDED') return 'No space left';
  if (err.code === 'FILE_TOO_LARGE') return 'Too large';
  if (err.code === 'UNSUPPORTED_FILE_TYPE' || err.code === 'UNSUPPORTED_MEDIA_TYPE') return 'Unsupported format';
  if (err.code === 'NETWORK_ERROR') return 'Network error';
  return err.message ? err.message : 'Upload failed';
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 목업과 같은 클래스 | `studio.css` 의 `.sq-upload-row` 격자(아이콘 / 이름 / 글자 / 버튼 + 아래 막대)를 그대로 씁니다 |
| 진행률은 `--p` 변수 | 목업의 막대가 `--p` 로 채워집니다. 캔버스 없이 CSS 만으로 진행을 그립니다 |
| 짧은 이유로 바꿈 | 서버 메시지가 길 수 있어, 자주 나오는 코드 몇 개만 짧게 줄입니다. 나머지는 메시지를 그대로 씁니다 |
| `em` 하나로 %·이유 | 같은 자리에 퍼센트를 보였다가 실패하면 이유를 보여 줍니다(공간 절약) |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 업로드 줄이 생기고 `em` 0% → (진행) → 사라짐 | ✔ |
| `is-error` 일 때 `em` 색이 빨감 (CSS `.sq-upload-row.is-error em`) | ✔ (설계) |
