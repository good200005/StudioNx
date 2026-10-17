# AI 구현 설명 76 — S1-07 샘플 라이브러리 화면 JS

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 작업 | S1-07 샘플 라이브러리 화면 JS (YouTrack StudioNx-38). 목록·파형·검색·태그·업로드·편집·삭제·저장 용량을 실제 데이터에 연결합니다 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 바꾼 파일 | `studionx/frontend/static/js/core/api.js`, `studionx/frontend/static/js/pages/sequencer-ui.js`, `studionx/frontend/static/css/pages/studio.css` |
| 함수 문서 | JS 193~210 (18개), 합본 `S1-07 - 샘플 라이브러리 UI/S1-07_sample_library_ui.pdf` |
| 진행 방식 | 목업 19~25(개요 75)를 바탕으로, 작업 단위 안에서 함수 18개를 이어서 구현하고 함수마다 문서를 남깁니다 |

## 1. 한 일

`studioNx.html` 의 샘플 라이브러리 패널(개요 75에서 만든 HTML/CSS)을 실제 서버 데이터에 연결했습니다. 표시만 하던 목록·파형·저장 용량을 채우고, 업로드·검색·태그·이름 편집·삭제를 동작하게 했습니다.

| 영역 | 만든 것 |
|---|---|
| API (core/api.js, 193~200) | `fetchSampleList`, `uploadSample`, `fetchSampleFileUrl`, `fetchSampleWaveform`, `renameSample`, `setSampleTags`, `deleteSample`, `fetchTags` |
| 화면 (sequencer-ui.js, 201~210) | `initSamplePanel`, `renderSampleList`, `drawSampleWaveform`, `applySampleFilters`, `toggleSamplePreview`, `uploadQueue`, `renderUploadRow`, `updateStorageBar`, `toggleEmptyState`, `startSampleEdit` |
| 스타일 (studio.css) | 파형 캔버스, 삭제 버튼, 인라인 편집 상자, 업로드 실패 색 |

## 2. 흐름

```
페이지 열림
  initUI → initSamplePanel
    fetchTags (200)           태그 목록을 받아 둡니다
    fetchSampleList (193)     샘플 50건을 받습니다
    renderSampleList (202)    줄마다 그립니다
      drawSampleWaveform (203) 캔버스에 파형을 그립니다
    readStorageLimit (208)    "… / 1 GB" 에서 한도를 읽습니다
    updateStorageBar (208)    쓴 양과 막대를 채웁니다
    toggleEmptyState (209)    빈 상태를 정합니다
  이벤트는 bindSamplePanelEvents 가 한 곳에서 연결합니다

사용자 동작
  검색·칩      → applySampleFilters (204)  클라이언트에서 거릅니다
  재생 버튼    → toggleSamplePreview (205) → fetchSampleFileUrl (195)
  드롭·Upload  → uploadQueue (206) → uploadSample (194, 진행률)
  더블 클릭    → startSampleEdit (210) → renameSample (197) + setSampleTags (198)
  ×            → removeSample (210) → deleteSample (199)
```

## 3. 결정한 것

| 결정 | 이유 |
|---|---|
| 새 파일을 만들지 않고 `sequencer-ui.js` 에 넣음 | 시퀀서 화면 전용 코드라 파일을 나눌 만큼 크지 않고, 기존 초기화 흐름(`initUI`)에 바로 붙습니다 |
| 필터를 클라이언트에서 처리 | 한 쪽이 50건이라 서버에 다시 묻지 않고도 즉시 거를 수 있습니다. 입력은 150ms 디바운스합니다 |
| 파형은 캔버스에 그림 | 목업의 파형은 장식이었지만, 실제 파형 JSON(196)은 값이 200개라 캔버스가 맞습니다. `has-wave` 로 마스크 배경을 끕니다 |
| 업로드는 XMLHttpRequest | 진행률(`onProgress`)이 필요합니다. 표준 `fetch` 로는 업로드 진행을 알 수 없습니다 |
| 편집은 목록 안 인라인 상자 | 줄 위치를 그대로 두고 이름·태그를 고칠 수 있습니다. 목업 22와 같습니다 |
| 삭제 전 `window.confirm` | 되돌릴 수 없는 작업이라 한 번 묻습니다 |
| 이벤트를 위임으로 연결 | 줄이 다시 그려져도(202) 다시 붙일 필요가 없습니다 |
| 저장 용량은 목록 합으로 임시 계산 | 남은 용량 API(`GET /me/storage`, FR-134)가 아직 없습니다. 생기면 그 값으로 바꿉니다 |

## 3.1 목업 19~25 대응

| 목업 | 화면에서의 구현 |
|---|---|
| 19 목록과 태그 | `renderSampleList`, `sampleRow` (이름, 태그 칩, 메타) |
| 20 미리듣기 재생 중 | `toggleSamplePreview`, `.is-playing` |
| 21 저장 용량 | `updateStorageBar`, `updateStorageBar` (한도 읽기 포함) |
| 22 이름·태그 편집 | `startSampleEdit`, `saveSampleEdit` |
| 23 드롭 업로드 | `uploadQueue`, `renderUploadRow` |
| 24 빈 목록 | `toggleEmptyState` (`#files-empty`) |
| 25 검색 결과 없음 | `toggleEmptyState` (`#files-noresults`, `#noresults-query`) |

## 4. 검증

실제 서버 없이 화면을 띄워, 응답을 흉내 낸 상태에서 사람이 누르는 순서대로 확인했습니다(정적 서버와 헤드리스 Chrome, 콘솔 오류 0건).

| 확인 | 결과 |
|---|---|
| 목록 3건 렌더, 파형 캔버스 3개(폭·높이 > 0) | ✔ |
| 저장 용량 "820 KB / 1 GB", 막대 0.1% | ✔ |
| 검색 `kick` → 1줄, `zzz` → 결과 없음 문구 'zzz' | ✔ |
| 칩 `Loops` → 0줄, `All` → 3줄 | ✔ |
| `＋ Tag` 1회 → '#Techno' 눌림, 'Vocal Chop' 1줄 | ✔ |
| 줄 선택 동작 | ✔ |
| 더블 클릭 → 편집 상자(이름, 태그 2개 중 1개 눌림) | ✔ |
| 이름 저장 → `PATCH` + `PUT` 호출, 줄 이름 'Kick 909 v2' | ✔ |
| 삭제 → `DELETE`, 줄 3→2, 저장 용량 820→703 KB | ✔ |
| 업로드 → 진행 줄 1개(0%) → 완료 후 사라짐, 'New Loop' 맨 위, 총 3줄 | ✔ |
| 미리듣기 → 파일 요청 1회 | ✔ |

## 5. 남은 일

- 실제 백엔드와 붙여 확인합니다. 지금은 응답을 흉내 내어 화면 동작만 확인했습니다.
- 남은 용량 API(`GET /me/storage`, FR-134)가 생기면 저장 용량을 실제 값으로 바꿉니다. 지금은 받아 온 목록의 크기 합이라 50건을 넘는 프로젝트에서는 실제보다 작게 보입니다.
- 드래그한 샘플을 타임라인 트랙에 놓는 연결(클립 만들기)은 다음 작업에서 합니다.
- 파형 채움(재생 위치) 애니메이션은 실시간 재생 연결과 함께 다듬습니다.

(End of file)
