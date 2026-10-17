# JS 197 — 샘플 이름 바꾸기 (`renameSample`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/api.js` |
| 작업 | S1-07 샘플 라이브러리: 두 번째 함수 (FR-225 이름 변경) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 198 `setSampleTags` |

## 1. 하는 일
샘플 이름을 바꿉니다. `PATCH /samples/{id}` 에 `{ name }` 을 보내고, 바뀐 샘플 한 줄(붙어 있는 태그 포함)을 돌려받습니다.

```js
renameSample(1, 'Kick 909 v2')
  → PATCH /api/v1/samples/1  { "name": "Kick 909 v2" }
  → SampleResponse
```

## 2. 코드
```js
export async function renameSample(sampleId, name) {
  return api.patch('/samples/' + encodeURIComponent(sampleId), { name: name });
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `PATCH` (일부 수정) | 이름만 바꾸므로 `PUT`(전체 교체)이 아닙니다. 서버도 이름만 받습니다(177 문서) |
| 바뀐 한 줄을 돌려받음 | 편집 상자를 닫으며 그 줄만 다시 그리면(210) 됩니다. 목록 전체를 다시 받지 않습니다 |
| 이름 길이 검사는 서버가 | 최대 200자(`SAMPLE_NAME_MAX`) 검사는 백엔드가 합니다. 화면은 `maxLength=200` 로 미리 막습니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 이름을 'Kick 909 v2' 로 저장 → `PATCH /samples/1` 호출 | ✔ |
| 저장 뒤 첫 줄 이름이 'Kick 909 v2' 로 바뀜 | ✔ |
