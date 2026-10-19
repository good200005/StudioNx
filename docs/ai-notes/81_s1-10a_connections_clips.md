# AI 구현 문서 81 — S1-10a: 타임라인 클립 · 연결선 저장 (FR-2196 · FR-2197)

| 항목 | 내용 |
|---|---|
| 작업 | S1-10a 클립·연결·패턴 저장 |
| 작성 | Claude (AI), 2026-10-19, 사용자 검토 |
| 기반 | S1-10 전체 저장·불러오기 (PR #86 병합), develop 996692e |
| 프론트 | sequencer-devices.js · sequencer-arrange.js · sequencer.js · sequencer-roll.js |
| 백엔드 | clips/patterns/connections 라우터·서비스·모델·스키마 |
| 함수 문서 | 백엔드 274~281 (8건) · 프런트 282~287 (6건), 합 14건 |
| 테스트 | docs/handoff/s1-10a_tests/ui.mjs 14/14 통과 |
| 이전 문서 | [80_s1-10_full_save.md](80_s1-10_full_save.md) |

## 1. 실행 결과
시퀀서 화면을 `?projectId=` 로 열면 S1-10 때 비어 있던 `/full` 의 `clips` 칸이 타임라인 편곡의 클립 목록으로 채워집니다. 서버에서 온 MIDI 클립을 더블클릭하면 피아노롤이 열리면서 그 패턴의 노트와 길이가 그대로 표시되고, 롤에서 고치면 `PUT /patterns/{id}/notes` 로 저장됩니다. 편곡에서 클립을 만들고, 복제하고, 옮기고, 길이를 늘리고, 자르면 즉시 서버에 반영됩니다. Connect 칸에서 다른 트랙을 고르면 연결선이 저장되고, 화면을 다시 불러와도 그대로 그려집니다.

## 2. 무엇을 만들었나
| 파일 | 역할 |
|---|---|
| `studionx/backend/app/models/clip.py` | 타임라인 클립 표의 ORM 모델 |
| `studionx/backend/app/models/track_connection.py` | 트랙 간 연결(Connect to Another) 표의 ORM 모델 |
| `studionx/backend/app/schemas/clip.py` · `schemas/connection.py` | 클립 · 연결 요청과 응답 모양 |
| `studionx/backend/app/services/clip_service.py` | 클립 목록 · 만들기 · 수정 · 삭제 |
| `studionx/backend/app/services/connection_service.py` | 연결 생성 · 조회 · 삭제 |
| `studionx/backend/app/services/pattern_service.py` | 패턴 만들기, 노트 통째 교체, 패턴 삭제 |
| `studionx/backend/app/api/v1/clips.py` · `connections.py` | 클립 · 연결 HTTP 라우터 |
| `studionx/backend/app/api/v1/patterns.py` | 패턴 여섯 길 라우터 |
| `studionx/frontend/static/js/pages/sequencer-devices.js` | `/full` 클립 칸 그리기, Connect 칸과 연결선 |
| `studionx/frontend/static/js/pages/sequencer-arrange.js` | 편곡 클립에 clipId · patternId 달기 |
| `studionx/frontend/static/js/pages/sequencer.js` | 클립 동작마다 서버에 값을 보내고, 패턴 만들기와 노트 저장 |
| `studionx/frontend/static/js/pages/sequencer-roll.js` | 서버 클립 노트를 피아노롤에 채우고 저장 경로 연결 |
| `docs/handoff/s1-10a_tests/ui.mjs` | 헤드리스 UI 시험 14건 |

## 3. 백엔드 함수 문서 8개 (번호는 S1-10 백엔드 268 에 이어서)
| # | 함수·대상 | 하는 일 | 설명 |
|---|---|---|---|
| 274 | `models/clip.py` | 클립 ORM 모델 | [274](<backend(fastAPI_Python)/S1-10a - 클립·연결·패턴 API/274_models_clip.md>) |
| 275 | `models/track_connection.py` | 트랙 연결 ORM 모델 | [275](<backend(fastAPI_Python)/S1-10a - 클립·연결·패턴 API/275_models_track_connection.md>) |
| 276 | `schemas/clip.py` · `schemas/connection.py` | 클립 · 연결 요청·응답 스키마 | [276](<backend(fastAPI_Python)/S1-10a - 클립·연결·패턴 API/276_schemas_clip_connection.md>) |
| 277 | `services/clip_service.py` | 클립 목록 · 만들기 · 수정 · 삭제 | [277](<backend(fastAPI_Python)/S1-10a - 클립·연결·패턴 API/277_services_clip.md>) |
| 278 | `services/connection_service.py` | 연결 만들기 · 보기 · 지우기 | [278](<backend(fastAPI_Python)/S1-10a - 클립·연결·패턴 API/278_services_connection.md>) |
| 279 | `services/pattern_service.py` | 패턴 만들기 · 노트 교체 · 삭제 | [279](<backend(fastAPI_Python)/S1-10a - 클립·연결·패턴 API/279_services_pattern.md>) |
| 280 | `api/v1/clips.py` · `connections.py` | 클립 · 연결 라우터 | [280](<backend(fastAPI_Python)/S1-10a - 클립·연결·패턴 API/280_api_clips_connections.md>) |
| 281 | `api/v1/patterns.py` | 패턴 라우터 여섯 길 | [281](<backend(fastAPI_Python)/S1-10a - 클립·연결·패턴 API/281_api_patterns.md>) |

## 4. 프런트 함수 문서 6개 (번호는 S1-10 프런트 273 에 이어서)
| # | 함수·대상 | 하는 일 | 설명 |
|---|---|---|---|
| 282 | `sequencer-devices.js` 클립 칸 | `/full` 클립 그리기, 서버 클립 요소 만들기, MIDI 미리보기 | [282](<javascript/S1-10a - 클립·연결 저장/282_sequencer-devices_clips.md>) |
| 283 | `sequencer-devices.js` Connect 칸 | 연결선 그리기와 저장 · 지우기, 트랙 줄 배치 | [283](<javascript/S1-10a - 클립·연결 저장/283_sequencer-devices_connections.md>) |
| 284 | `sequencer-arrange.js` | 편곡 클립에 clipId · patternId · sampleId 달기 | [284](<javascript/S1-10a - 클립·연결 저장/284_sequencer-arrange_clip_ids.md>) |
| 285 | `sequencer.js` | 클립 생성 · 복제 · 이동 · 길이 조절 · 트리밍 · 고르기마다 서버에 값 보내기 | [285](<javascript/S1-10a - 클립·연결 저장/285_sequencer_clip_save.md>) |
| 286 | `sequencer.js` | 패턴 만들기 · 미사용 패턴 정리 · 노트 저장 · 롤→클립 미리보기 갱신 | [286](<javascript/S1-10a - 클립·연결 저장/286_sequencer_patterns.md>) |
| 287 | `sequencer-roll.js` | 서버 클립 노트 불러오기, 패턴 길이 반영, 롤 노트 저장 경로 연결 | [287](<javascript/S1-10a - 클립·연결 저장/287_sequencer-roll_clip_notes.md>) |

## 5. 요구사항 대응
| 요구사항 | 내용 | 어디서 |
|---|---|---|
| FR-2196 | 타임라인 클립 · 패턴을 서버에 저장하고 불러오기 | 277 `clip_service`, 279 `pattern_service`, 280·281 라우터, 282·285·286 화면 |
| FR-2197 | Connect to Another 연결선 저장과 그림 | 278 `connection_service`, 280 연결 라우터, 283 Connect 칸 |
| FR-231 | 피아노롤 노트를 패턴으로 통째 저장 | 279 `replace_notes`, 286·287 롤 저장 경로 |
| FR-2244 | 패턴 메뉴(만들기 · 삭제) | 286 패턴 만들기와 미사용 패턴 정리 |
| S1-10 §9 예정 | `/full` 의 `clips` 칸 채우기 | 264·266 스키마의 빈 배열이 277·282로 채워짐 |

## 6. 왜 이렇게
| 결정 | 이유 |
|---|---|
| 클립과 패턴을 나눈 표로 | 클립은 편곡 위치(트랙 · 시작 · 길이), 패턴은 음표 내용입니다. 같은 패턴을 여러 자리에 붙일 수 있습니다 |
| 노트 저장을 PUT 통째 교체로 | 피아노롤은 지금 보이는 노트 전부를 다시 보내므로 부분 고치기보다 통째 교체가 맞습니다 (279·281) |
| 연결선을 `track_connections` 표로 | S1-09 갈래 배선과 화면의 Connect 칸이 같은 자료를 씁니다 (278) |
| 화면은 값이 바뀔 때마다 바로 서버에 보냄 | 드래그 중에도 빠지면 그대로 저장되게 하고, 한 번의 이동이 하나의 PATCH/PUT 로 끝나게 합니다 (285) |
| 롤 노트는 이벤트로 시퀀서에 알림 | 롤 모듈이 저장을 직접 몰래지 않고 `sq:roll-notes` 이벤트로 시퀀서 시작점이 이어 받습니다 (287) |
| 헤드리스 UI 시험 14건 | 클립 만들기부터 연결선 · 피아노롤 저장까지 사람처럼 클릭해 확인합니다 |

## 7. 검증 결과
| 방법 | 대상 | 결과 |
|---|---|---|
| `pytest -q` | 백엔드 전체 | **1083 passed** |
| `ruff check .` | 백엔드 + tests | All checks passed (오류 없음) |
| `node --check` | 프런트 JS 모듈 | 통과 (전통 문법만 사용, `?.` · `??` 없음) |
| 헤드리스 UI 시험 `docs/handoff/s1-10a_tests/ui.mjs` | 클립 · 연결 · 패턴 흐름 14건 | **14/14 통과** |
| 화면 캡처 | `docs/screenshots/2026-10-19_s1-10a_clips_connections/` | 시험 14건의 화면을 저장 |

## 8. 남은 일과 다음 작업이 쓰는 곳
| 작업 | 쓰는 것 |
|---|---|
| 오토메이션 · 마커 · 템포·박자 변화 저장 | `/full` 의 나머지 빈 칸. 클립(277)과 같은 방식으로 표를 추가합니다 |
| 갈래(패처) 보드 (FR-265~269) | 278 연결 서비스와 283 연결선 그리기를 그대로 씁니다 |
| 프리셋 저장 경로 | S1-09 때 미룬 `POST /plugins/{id}/presets` 가 남아 있습니다 |
| 문서 PDF | 함수 문서 274~287의 PDF와 합본 PDF는 이 정리 문서에 이어서 만듭니다 |

## 9. 자주 받을 질문 대비 (Q/A)
Q. 클립과 패턴이 왜 다른 표인가요?

A. 클립은 "몇 번째 트랙의 언제부터 얼마 동안 놓을지"이고, 패턴은 "어떤 음표들을 담을지"입니다. 같은 패턴을 여러 자리에 붙이면 노트를 한 번만 고쳐도 모든 자리에 반영됩니다.

Q. 피아노롤에서 고친 노트는 어디에 저장되나요?

A. `PUT /patterns/{id}/notes` 로 패턴의 노트 전체를 교체합니다(287). 편곡 화면의 클립 미리보기는 `sq:roll-notes` 이벤트로 바로 다시 그려집니다.

Q. 연결선은 어떻게 저장되나요?

A. Connect 칸에서 대상 트랙을 고르면 `track_connections` 표에 한 줄이 생기고, 지우면 줄이 사라집니다(278·283). 화면을 다시 불러오면 연결선이 같은 자리에 그대로 그려집니다.

Q. 테스트는 몇 건이고 어디까지 보나요?

A. `docs/handoff/s1-10a_tests/ui.mjs` 14건이 모두 통과했습니다. 클립 만들기·이동·복제·트리밍, 연결선 저장, 패턴 만들기, 피아노롤 노트 저장과 다시 열기까지 화면에서 확인합니다. 화면 캡처는 `docs/screenshots/2026-10-19_s1-10a_clips_connections/` 에 있습니다.
