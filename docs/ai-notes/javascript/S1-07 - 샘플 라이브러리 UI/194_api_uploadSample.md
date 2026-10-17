# JS 194 — 샘플 업로드 (`uploadSample`, `xhrError`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/api.js` |
| 작업 | S1-07 샘플 라이브러리: 두 번째 함수 (FR-221·226 업로드) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 195 `fetchSampleFileUrl` |

## 1. 하는 일
고른 파일 하나를 `POST /samples`(multipart, `file`)로 올리고, 진행률을 콜백으로 알려 줍니다. 취소(AbortSignal)를 받으면 그 업로드만 멈추고, 끝나면 올린 샘플 한 줄(`SampleResponse`)을 돌려줍니다.

```js
uploadSample(file, { signal, onProgress(loaded, total) })
  → POST /api/v1/samples  (multipart/form-data)
  → SampleResponse
```

## 2. 코드
```js
export function uploadSample(file, options = {}) {
  const signal = options.signal;
  const onProgress = options.onProgress;
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) { reject(new ApiError(0, 'ABORTED', 'Upload cancelled.')); return; }

    function send(retried) {
      const form = new FormData();
      form.append('file', file, file.name);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/samples`);
      xhr.withCredentials = true;
      if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('Accept', 'application/json');
      if (xhr.upload && onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total);
        });
      }
      xhr.addEventListener('load', () => {
        if (xhr.status === 401 && !retried) {
          refreshAccessToken().then((ok) => (ok ? send(true) : reject(xhrError(xhr))));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(parse(xhr));
        else reject(xhrError(xhr));
      });
      xhr.addEventListener('error', () => reject(new ApiError(0, 'NETWORK_ERROR', 'Network error. Please try again.')));
      xhr.addEventListener('abort', () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled.')));
      if (signal) signal.addEventListener('abort', () => xhr.abort());
      xhr.send(form);
    }

    if (!accessToken) refreshAccessToken().then(() => send(false));
    else send(false);
  });
}

function xhrError(xhr) {
  let data = null;
  try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { data = null; }
  const e = data && data.error;
  if (e && e.code) return new ApiError(xhr.status, e.code, e.message == null ? '' : e.message, e.details == null ? null : e.details);
  return new ApiError(xhr.status, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `XMLHttpRequest` (fetch 아님) | `fetch` 는 업로드 **진행률**(FR-226)을 제공하지 않습니다. `xhr.upload` 의 `progress` 이벤트가 필요합니다 |
| `FormData` 로 `file` 한 칸 | 백엔드 `POST /samples` 가 `multipart/form-data` 의 `file` 필드를 받습니다(177·192 문서) |
| `AbortSignal` → `xhr.abort()` | 업로드 줄의 취소(×) 버튼과 연결됩니다. 취소는 실패가 아니라 `code:'ABORTED'` 로 구분합니다 |
| 401 이면 재발급 후 1회 재시도 | Access Token 이 메모리에만 있어 만료될 수 있습니다. `apiFetch` 와 같은 규칙입니다 |
| 오류를 `ApiError` 로 통일 | fetch 용 `toApiError` 와 같은 모양(`status`·`code`·`message`)이라 화면(206)이 한 곳에서 분기합니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 파일 올리면 `#upload-list` 줄이 생기고 0% → 100% 로 채워짐 (스텁 XHR) | ✔ |
| 끝나면 줄이 사라지고 새 샘플이 목록 맨 위에 붙음 (`New Loop`) | ✔ |
| 취소(×) 시 줄이 사라지고 목록이 그대로임 | ✔ (설계) |
