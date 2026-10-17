# JS 208 — 저장 용량 표시 (`updateStorageBar` · `formatBytes` · `parseBytes` · `readStorageLimit`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-ui.js` |
| 작업 | S1-07 샘플 라이브러리: 열여섯 번째 함수 (FR-227 저장 용량) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 209 `toggleEmptyState` |

## 1. 하는 일
패널 아래 "Project storage" 표시를 실제 값으로 채웁니다. 쓴 양은 목록 샘플의 `file_size` 합, 최대는 화면에 적힌 "… / 1 GB" 에서 읽은 값입니다.

```
#storage
├─ em.sq-storage__val   "820 KB / 1 GB"
└─ .sq-storage__bar i   --p: 0.1%
```

## 2. 코드
```js
function updateStorageBar(usedBytes, limitBytes) {
  const storage = document.getElementById('storage');
  if (!storage) return;
  const label = document.querySelector('#storage .sq-storage__val');
  const bar = document.querySelector('#storage .sq-storage__bar i');
  const limit = limitBytes ? limitBytes : sampleState.limitBytes;
  const pct = limit ? Math.min(100, (usedBytes / limit) * 100) : 0;
  if (label) label.textContent = formatBytes(usedBytes) + ' / ' + formatBytes(limit);
  if (bar) bar.style.setProperty('--p', pct.toFixed(1) + '%');
}

function formatBytes(bytes) {
  if (bytes == null) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return (mb / 1024).toFixed(1).replace(/\.0$/, '') + ' GB';
  if (mb >= 1) return Math.round(mb) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

function parseBytes(text) {
  const m = /([\d.]+)\s*(GB|MB|KB|B)/i.exec(text ? text : '');
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === 'GB') return n * 1024 * 1024 * 1024;
  if (unit === 'MB') return n * 1024 * 1024;
  if (unit === 'KB') return n * 1024;
  return n;
}

function readStorageLimit() {
  const label = document.querySelector('#storage .sq-storage__val');
  if (!label) return;
  const parts = label.textContent.split('/');
  if (parts.length === 2) {
    const limit = parseBytes(parts[1]);
    if (limit) sampleState.limitBytes = limit;
  }
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 쓴 양 = `file_size` 합 | 남은 용량 API(`GET /me/storage`, FR-134)가 아직 없습니다. 한 쪽(≤50)을 다 받으므로 목록 합이 곧 쓴 양입니다. API 가 생기면 그 값으로 바꿉니다 |
| 최대는 화면 글자에서 읽음 | 상수 1 GB 를 코드에 박지 않고, 표기값(`… / 1 GB`)을 기준으로 삼습니다. 표기가 바뀌면 따라갑니다 |
| 1024 기준 (KB/MB/GB) | 파일 크기 표기 관례(2진)를 따릅니다. `file_size` 도 바이트 단위입니다(177 문서) |
| 100% 로 자름 | 한도가 작아 넘겨도 막대는 가득찬 모양까지만 보여 줍니다 |

> 남은 용량 API(FR-134)가 아직 없습니다. 지금 값은 "받아 온 목록의 합"이라 50건을 넘는 프로젝트에서는 실제보다 작게 보입니다. `GET /me/storage` 가 생기면 `updateStorageBar(api.used, api.limit)` 로 바꾸면 됩니다.

## 4. 시험
| 확인 | 결과 |
|---|---|
| 목록 3건(합 840000B) → "820 KB / 1 GB", 막대 0.1% | ✔ |
| 1건 삭제(120000B) → "703 KB / 1 GB" | ✔ |
| 업로드로 늘어난 용량이 더해짐 | ✔ |
