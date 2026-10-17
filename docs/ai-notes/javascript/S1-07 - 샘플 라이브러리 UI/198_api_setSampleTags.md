# JS 198 — 샘플 태그 설정 (`setSampleTags`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/api.js` |
| 작업 | S1-07 샘플 라이브러리: 두 번째 함수 (FR-225 태그) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 199 `deleteSample` |

## 1. 하는 일
샘플에 붙은 태그를 통째로 바꿉니다. `PUT /samples/{id}/tags` 에 `{ tag_ids }` 를 보내고, 새로 붙은 태그가 담긴 샘플 한 줄을 돌려받습니다. 보낸 목록이 그 샘플의 태그 **전부**가 됩니다.

```js
setSampleTags(1, [2, 5])
  → PUT /api/v1/samples/1/tags  { "tag_ids": [2, 5] }
  → SampleResponse
```

## 2. 코드
```js
export async function setSampleTags(sampleId, tagIds) {
  return api.put('/samples/' + encodeURIComponent(sampleId) + '/tags', { tag_ids: tagIds });
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `PUT` (전체 교체) | 태그는 붙이기·떼기가 섞여 순서 문제가 생깁니다. 화면이 최종 목록을 한 번에 보내면 서버가 그대로 맞춥니다 |
| 빈 목록이면 모두 뗌 | `tag_ids: []` 가 "태그 없음"의 뜻입니다. 편집 상자에서 모두 끄면 이렇게 보냅니다 |
| 번호(`tag_id`) 배열 | 태그 이름은 바뀔 수 있어 화면은 번호로 다룹니다. 이름은 `/tags`(200) 목록에서 찾습니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 편집 상자에서 태그를 바꾸면 `PUT /samples/1/tags` 호출 | ✔ |
| 저장 뒤 그 줄에 새 태그가 반영됨 | ✔ |
