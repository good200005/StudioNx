# JS 196 — 샘플 파형 데이터 (`fetchSampleWaveform`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/api.js` |
| 작업 | S1-07 샘플 라이브러리: 두 번째 함수 (FR-223 파형) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 다음 | 197 `renameSample` |

## 1. 하는 일
샘플의 파형(peaks) 데이터를 받아 옵니다. 백엔드가 미리 계산해 둔 값을 JSON 으로 주면(74 문서 §FR-223), 화면은 그 값을 캔버스에 그립니다(203).

```js
fetchSampleWaveform(1)
  → GET /api/v1/samples/1/waveform
  → { peaks: [[-0.31, 0.42], [-0.12, 0.55], …] }   // [최솟값, 최댓값] 쌍의 배열
```

## 2. 코드
```js
export async function fetchSampleWaveform(sampleId) {
  return api.get('/samples/' + encodeURIComponent(sampleId) + '/waveform');
}
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 값은 JSON(`peaks`) | 오디오 디코딩·다운샘플을 브라우저에서 하지 않습니다. 가벼운 숫자 배열만 받아 그립니다 |
| `[최솟값, 최댓값]` 쌍 | 한 칸(세로줄)에 위·아래를 함께 그려 파형 모양을 그대로 살립니다(203) |
| `api.get` 재사용 | 토큰·오류 처리를 공통 함수에 맡깁니다 |

## 4. 시험
| 확인 | 결과 |
|---|---|
| 목록 3줄이 각각 파형을 받아 캔버스 폭·높이가 0보다 큼 | ✔ |
| 파형이 없거나 실패하면 캔버스를 만들지 않고 세로 무늬 그대로 둠 | ✔ (설계) |
