# AI 구현 설명 75 — S1-07 샘플 라이브러리 UI (HTML/CSS)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-16, 사용자 검토 |
| 작업 | S1-07 샘플 라이브러리 UI (YouTrack StudioNx-38). `studioNx.html` `.sq-files` 패널과 `studio.css` 대응 스타일, 목업 장면 19~25 반영 |
| 브랜치 | `feature/phase1/s1-07-sample-library-ui` |
| 바꾼 파일 | `studionx/frontend/studioNx.html`, `studionx/frontend/static/css/pages/studio.css` |
| 진행 방식 | 목업 시퀀서 레이아웃에 장면 19~25 추가(`docs/page_mockups/sequencer/layout/`) → 사용자 확인 후 실제 프론트 반영 (HTML/CSS) |

## 1. 목업 작업

- 시퀀서 목업: `docs/page_mockups/sequencer/layout/` 에 장면 19~25 7장 추가
  - 19 `19_library_list_tags.png` (목록과 태그)
  - 20 `20_library_preview_playing.png` (미리듣기 재생 중, 파형 채움 42%)
  - 21 `21_library_storage.png` (저장 용량 620 MB / 1 GB, 62%)
  - 22 `22_library_rename_tags.png` (이름 인라인 편집 + 태그 편집기)
  - 23 `23_library_drop_upload.png` (드래그앤드롭 업로드와 진행)
  - 24 `24_library_empty.png` (빈 목록)
  - 25 `25_library_no_results.png` (검색 결과 없음)
- 소스: `_source/layout.html?s=19..25` (libraryPanel() 함수), `_source/shot.mjs`에 1..25 등록
- 검증: Chrome headless로 렌더 후 CDP 측정 스크립트로 `scrollHeight == clientHeight` (오버플로 없음), 행 42px, 파형 상시 표시, 태그 인라인, 재생 상태 배경/채움 확인
- 문서: `docs/Sequencer_Layout_Mockup.md`에 장면 19~25 반영

## 2. 실제 프론트 반영

기존 `.sq-files`/`.sq-filelist`/`.sq-file`/`.sq-filters`/`.sq-search`/`.sq-drop`/`.sq-side` 구조를 유지하면서 (JS 선택자 호환) 목업의 필수 요소를 추가했습니다.

### 2.1 `studioNx.html`

| 요소 | 설명 |
|---|---|
| `.sq-files__head` | `h2#files-title` + `.sq-files__count` (직후, JS가 길이/아이템 수 갱신) + `.sq-sort` + `#upload-button`/`#upload-input` |
| `.sq-filters` | `All/Drums/Bass/FX/Vocal/Loops/My uploads` + `＋ Tag` (`.sq-filters__tag`) |
| `.sq-uploads#upload-list` | 업로드 진행 목록 (FR-226, JS가 행 추가; 기본적으로 `hidden`) |
| `.sq-filelist#file-list` | 샘플 목록. 샘플 행에 `.sq-file__play` 버튼, `.sq-file__icon`, `.sq-file__title`(이름 + `.sq-file__tags`), `.sq-file__meta`, `.sq-file__wave` |
| `.is-playing` | 재생 중 행입니다. 배경, 박스섀도우, 파형 불투명도, 재생 버튼 표시, 파형 `i` 채움(`--p`)을 바꿉니다 |
| `.is-missing` | 사라진 파일 행 (경고 색상) |
| `.sq-empty#files-empty` | 빈 목록 (FR-221)입니다. 기본은 `hidden`입니다 |
| `.sq-noresults#files-noresults` | 검색 결과 없음 (FR-224)입니다. 기본은 `hidden`이며, `#noresults-query`를 씁니다 |
| `#pattern-list` | 기존 구조 유지 (`.sq-pattern`)입니다. 그리드는 `.sq-pattern`으로 분리해 대응합니다 |
| `#drop-zone` | 드롭 존 (미니멀 슬림 스타일, `.is-over` 처리) |
| `.sq-storage#storage` | 저장 용량 바 (FR-227)입니다. 사용량 620 MB / 1 GB, 62% (`--p`)입니다 |
| `.sq-search` | 검색 라벨 + `#file-search` (placeholder 유지) |

샘플 행 12개로 확대, 태그는 이름 옆 인라인 `.sq-file__tag`/`.is-genre` (장르 보라 톤). 파형은 모든 행에 표시, 재생 중일 때만 채움.

### 2.2 `studio.css`

| 항목 | 설명 |
|---|---|
| `--sq-side-w` | 16.5rem → 20.625rem (330px)로 넓혔습니다. 목업에 맞춰 패널 폭을 확장합니다 |
| `.sq-files` | flex column 유지, 각 섹션 간 경계선 반영 |
| `.sq-sort` | Sort 버튼, 파일 헤드의 `Upload`와 정렬 레이아웃 (`Upload`은 `.sq-files__head` 한정) |
| `.sq-filters` | "All" 선택 시 보라톤 배경, `＋ Tag`는 dashed |
| `.sq-uploads` | 진행 행(아이콘, 이름, 속도, 취소, 바 `i style="--p"`) |
| `.sq-file` | 기본 3열(아이콘, 제목, 메타)입니다. `#file-list .sq-file`은 4열(재생, 아이콘, 제목, 메타)입니다 |
| `.sq-file__play` | 사각 버튼 16×16, 재생/일시정지 시 스타일 |
| `.sq-file__title` | 이름+태그 (flex, 이름 ellipsis) |
| `.sq-file__tags` | 인라인 칩 |
| `.sq-file__wave` | 13px 높이, 마스크 그리드, 채움 `<i>` + 오른쪽 세로선, `is-playing` 시 진하게 |
| `.sq-empty`, `.sq-noresults` | 중앙 정렬 안내, CTA 버튼 |
| `.sq-drop` | 슬림(44px) 수평 레이아웃 |
| `.sq-storage` | 저장 용량 라인 + 바 그래프(`--p`) |
| 패턴/생성 목록 | `.sq-file` 기본 그리드에 맞춰 정상 렌더 (패턴 3열, 생성 목록은 JS 생성 그대로 호환) |

## 3. 호환성

- JS가 참조하는 선택자(`.sq-files .sq-filelist`, `#file-list`, `#pattern-list`, `.sq-file`, `.sq-file__name`, `.sq-file__meta`, `.sq-filters`, `#file-search`, `#drop-zone`, `#upload-button`, `#upload-input`, `.sq-files__count`, `visibleList()`, `applyFilters()`, `.sq-file[aria-selected]`)는 모두 유지됩니다.
- `.sq-filelist[data-generated] .sq-file` (Presets/Plugins 등)과 `#pattern-list .sq-file.sq-pattern`은 기존 구조를 그대로 지원합니다.
- 새로 추가한 규칙에는 `:has`를 쓰지 않았고, 기존과 같은 CSS 문법만 사용했습니다.

## 4. 검증

- `http://localhost:8000/studioNx.html` 다크/라이트 렌더 측정: 12 행 × 41.8px, 사이드 329px, list 630px, 파형 285px, 수평/세로 스크롤 0.
- 패턴 전환 시 3열 그리드, 생성 카테고리 리스트 정상.
- 태그/이름 ellipsis 정상, 재생 행 배경/채움 정상.

## 5. 남은 일

- 빈 목록과 검색 결과 없음 상태를 실제 데이터와 검색 조건에 따라 보이게 합니다 (현재는 `hidden`).
- `#upload-list`의 진행 행 생성과 취소를 구현합니다 (진행률, 속도, 완료 처리).
- 재생 버튼과 파일 선택을 실제 미리듣기에 연결하고, 태그 편집, 이름 변경, 태그 저장을 연동합니다.
- `.sq-storage`의 실사용량을 갱신합니다 (현재 62% 고정).

(End of file)