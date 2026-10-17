# JS 200 — 태그 목록 불러오기 (`fetchTags`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/api.js` |
| 작업 | S1-07 샘플 라이브러리: 두 번째 함수 (FR-224 태그) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 201 `initSamplePanel` |

## 1. 하는 일
고를 수 있는 태그 목록을 받아 옵니다. `GET /tags` 가 번호·이름·분류를 돌려주면, 편집 상자(210)의 태그 버튼과 태그 필터(204)의 순환 목록에 씁니다.

```js
fetchTags()
  → GET /api/v1/tags
  → { items: [{ tag_id: 1, name: 'Techno', category: 'GENRE' }, …] }
```

## 2. 코드
```js
export async function fetchTags() {
  return api.get('/tags');
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 분류(`category`)까지 받음 | 편집 상자에서 장르 태그를 다르게 보여 줄 수 있습니다(`GENRE` → `is-genre` 색) |
| 실패해도 목록은 보여 줌 | 태그를 못 받아도 샘플은 봐야 합니다. 201 이 이 실패를 삼키고 빈 목록으로 둡니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 편집 상자에 태그 버튼 2개가 생기고 붙은 태그가 눌린 상태로 표시됨 | ✔ |
| `＋ Tag` 순환에 태그 이름이 순서대로 들어감 | ✔ |
