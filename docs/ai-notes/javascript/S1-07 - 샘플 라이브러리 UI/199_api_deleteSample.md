# JS 199 — 샘플 지우기 (`deleteSample`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/api.js` |
| 작업 | S1-07 샘플 라이브러리: 두 번째 함수 (FR-225 삭제) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 200 `fetchTags` |

## 1. 하는 일
샘플을 지웁니다(소프트 삭제). `DELETE /samples/{id}` 가 204(본문 없음)로 끝나면 성공입니다.

```js
deleteSample(1)
  → DELETE /api/v1/samples/1
  → 204 (본문 없음 → null)
```

## 2. 코드
```js
export async function deleteSample(sampleId) {
  return api.delete('/samples/' + encodeURIComponent(sampleId));
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 되돌림은 화면이 | 서버는 소프트 삭제(잠시) 후 바로 지웁니다. 지우기 전 확인은 화면(209 문서의 205 계열)이 `confirm` 으로 합니다 |
| 204 는 null | `apiFetch` 가 204 를 null 로 돌려줍니다. 화면은 실패(throw)만 잡으면 됩니다 |
| 지운 뒤 목록 재정렬은 화면이 | 그 줄만 지우고 저장 용량을 빼면 됩니다(209). 목록을 다시 받지 않습니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| × 를 누르고 확인하면 `DELETE /samples/1` 호출 | ✔ |
| 줄이 사라지고(3 → 2) 저장 용량이 820 KB → 703 KB 로 줄어듦 | ✔ |
