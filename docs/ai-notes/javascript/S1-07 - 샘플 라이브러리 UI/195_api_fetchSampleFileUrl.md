# JS 195 — 샘플 미리듣기 주소 (`fetchSampleFileUrl`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/api.js` |
| 작업 | S1-07 샘플 라이브러리: 두 번째 함수 (FR-224 미리듣기) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 196 `fetchSampleWaveform` |

## 1. 하는 일
샘플의 오디오 파일(`GET /samples/{id}/file`)을 토큰을 붙여 받아 `Blob` 으로 만들고, `objectURL` 로 바꿔 돌려줍니다. 이 주소를 `<audio src>` 에 넣어 미리듣기(205)에 씁니다. 같은 샘플은 한 번만 받습니다.

## 2. 코드
```js
const sampleFileUrls = new Map();

export async function fetchSampleFileUrl(sampleId) {
  const key = String(sampleId);
  const hit = sampleFileUrls.get(key);
  if (hit) return hit;

  if (!accessToken) await refreshAccessToken();

  const send = () => {
    const headers = { Accept: '*/*' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}/samples/${encodeURIComponent(key)}/file`, {
      headers: headers,
      credentials: 'same-origin',
    });
  };

  let res = await send();
  if (res.status === 401 && (await refreshAccessToken())) res = await send();
  if (!res.ok) throw await toApiError(res);

  const url = URL.createObjectURL(await res.blob());
  sampleFileUrls.set(key, url);
  return url;
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| blob → objectURL | Access Token 이 메모리에만 있어 `<audio src="/samples/1/file">` 처럼 바로 걸면 토큰이 안 실립니다. 그래서 토큰을 붙여 받은 뒤 주소로 바꿉니다 |
| `Map` 으로 캐시 | 같은 줄을 여러 번 재생할 때 다시 받지 않습니다. 창을 닫을 때까지 유지됩니다 |
| 401 이면 재발급 후 1회 재시도 | 파일 응답은 `apiFetch` 를 거치지 않아 재발급 규칙을 여기서 따로 겁니다 |
| `Accept: */*` | JSON 이 아니라 오디오 바이너리를 받으므로 JSON 을 요구하지 않습니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| ▶ 를 누르면 `/samples/{id}/file` 요청이 나감 (스텁 검증, 호출 1회) | ✔ |
| 두 번째 재생은 캐시로 요청이 늘지 않음 | ✔ (설계) |
