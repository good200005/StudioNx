# JS 193 — 샘플 목록 불러오기 (`fetchSampleList`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/api.js` |
| 작업 | S1-07 샘플 라이브러리: 첫 번째 함수 (FR-224 목록·검색) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 194 `uploadSample` |

## 1. 하는 일
샘플 목록을 서버에서 받아 옵니다. `GET /samples` 에 검색어·태그 번호·쪽 번호·쪽 크기를 붙여 부르고, 돌려받은 JSON(`items`·`total`·`page`·`size`)을 그대로 돌려줍니다.

```js
fetchSampleList({ size: 50 })
  → GET /api/v1/samples?size=50
  → { items: [SampleResponse, …], total: 128, page: 1, size: 50 }
```

## 2. 코드
```js
export async function fetchSampleList(params = {}) {
  const qs = new URLSearchParams();
  if (params.query) qs.set('query', params.query);
  if (params.tag != null) qs.set('tag', String(params.tag));
  if (params.page != null) qs.set('page', String(params.page));
  if (params.size != null) qs.set('size', String(params.size));
  const tail = qs.toString();
  return api.get('/samples' + (tail ? '?' + tail : ''));
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `URLSearchParams` 로 쿼리 조립 | 값이 비어 있으면 아예 안 붙습니다. 손으로 `?`·`&` 를 잇지 않아 실수가 없습니다 |
| 값이 있을 때만 `set` | `query=''`·`tag=0` 같은 빈 조건을 서버로 보내지 않습니다. `tag != null` 은 0번 태그도 살립니다 |
| `size` 를 넘겨받음 | 화면(201)이 50(최대)로 부릅니다. 기본 10을 그대로 두면 목록이 10줄만 보입니다 |
| `api.get` 재사용 | 토큰 재발급·401 재시도·오류 변환이 공통 함수에 이미 있습니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| `fetchSampleList({ size: 50 })` → `/samples?size=50` (스텁 검증) | ✔ |
| 목록 3건을 받아 `#file-list` 에 3줄이 그려짐 (202 연동) | ✔ |
| 실패 시 예시 줄을 지우지 않음 (401 은 조용히, 그 외 `showToast`) | ✔ |
