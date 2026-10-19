# AI 구현 설명 80 — S1-10 프로젝트 전체 저장·불러오기 (백엔드 + 프런트 JS)

| 항목 | 내용 |
|---|---|
| 작업 | S1-10 프로젝트 전체 저장·불러오기: `GET /projects/{id}/full`, 곡 설정 저장, 자동 저장, Undo/Redo, 명령 레지스트리 (PRD 02 FR-253~256, FR-2169) |
| 작성 | Claude (AI), 2026-10-19, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-10-full-save` (PR #86 오픈, 머지 전) |
| 백엔드 함수 문서 | 264 ~ 268 (md, PDF) · 합본 [S1-10_project_full_api.pdf](<backend(fastAPI_Python)/S1-10 - 프로젝트 전체 저장·불러오기/S1-10_project_full_api.pdf>) |
| 프런트 함수 문서 | 269 ~ 273 (md, PDF) · 합본 S1-10_full_save_frontend.pdf |
| 이전 문서 | [79_s1-09_ui.md](79_s1-09_ui.md) |

## 1. 실행 결과
시퀀서 화면을 `?projectId=` 로 열면 로그인을 확인한 뒤 `GET /projects/{id}/full` 하나로 프로젝트 설정(BPM · Key · 박자)과 트랙, 악기 · 이펙트, 패턴 목록까지 한 번에 불러옵니다. BPM 칩과 Key 칩을 바꾸면 저장 대기열에 모이고, Ctrl+S 나 마지막 변화 후 30초 뒤 자동으로 저장됩니다. 이펙트를 고치고 Ctrl+Z 를 누르면 이전 값으로 돌아가고, Ctrl+Shift+Z 로 다시 앞으로 갑니다. 저장 안 된 것이 남아 있으면 창을 닫으려 할 때 브라우저가 한 번 물어봅니다. Ctrl+P 를 누르면 커맨드 팔레트가 떠서 이름으로 명령을 검색할 수 있습니다.

`?projectId=` 가 없으면 S1-09 때 만든 데모 모드로 열립니다. 이때 저장 · 이력 · 명령 레지스트리는 조용히 비활성화되고, 화면에 이미 있는 예시 배선만 움직입니다.

## 2. 무엇을 만들었나
| 파일 | 역할 |
|---|---|
| `studionx/backend/app/schemas/full_project.py` | `/full` 응답 모양 (프로젝트 · 트랙 · 패턴 · 노트) |
| `studionx/backend/app/services/full_project_service.py` | 6회 조회 후 파이썬에서 그룹핑 (N+1 회피) |
| `studionx/backend/app/services/project_service.py` | `update_settings` — BPM · Key 등 허용 칸만 갱신 |
| `studionx/backend/app/api/v1/projects.py` | `GET /projects/{id}/full`, `PATCH /projects/{id}/settings` |
| `studionx/frontend/static/js/pages/sequencer-commands.js` | 명령 레지스트리 · 커맨드 팔레트 (269) |
| `studionx/frontend/static/js/pages/sequencer-history.js` | Undo/Redo 최소 100단계 (270) |
| `studionx/frontend/static/js/pages/sequencer-save.js` | 저장 · 자동 저장 · 떠나기 경고 (271) |
| `studionx/frontend/static/js/pages/sequencer.js` | 시작점 init · loadProject · 단축키 · handleChange (272) |
| `studionx/frontend/static/js/pages/sequencer-devices.js` | applyFullProject · setDeviceNotifier · 이력 도우미 (273) |
| `docs/handoff/s1-10_tests/` | 백엔드 시험 (라우트 19건) · 프런트 UI 시험 (진행 중) |

## 3. 백엔드 함수 5개 (번호는 S1-09 백엔드 242 에 이어서)
| # | 함수·대상 | 하는 일 | 설명 |
|---|---|---|---|
| 264 | `full_project.py` 스키마 | `/full` 응답 모양 Pydantic | [264](<backend(fastAPI_Python)/S1-10 - 프로젝트 전체 저장·불러오기/264_schemas_full_project.md>) |
| 265 | `full_project_service.py` `get_full_project` 앞부분 | 6회 조회 후 그룹핑 | [265](<backend(fastAPI_Python)/S1-10 - 프로젝트 전체 저장·불러오기/265_full_project_service_info.md>) |
| 266 | `get_full_project` | 트랙 · 장치 · 패턴 · 노트를 한 덩어리로 | [266](<backend(fastAPI_Python)/S1-10 - 프로젝트 전체 저장·불러오기/266_full_project_service_get_full_project.md>) |
| 267 | `project_service.py` `update_settings` | BPM · Key 등 허용 칸 갱신 | [267](<backend(fastAPI_Python)/S1-10 - 프로젝트 전체 저장·불러오기/267_project_service_update_settings.md>) |
| 268 | `projects.py` 2개 라우트 | `/full` 과 `/settings` 연결 | [268](<backend(fastAPI_Python)/S1-10 - 프로젝트 전체 저장·불러오기/268_api_projects_full.md>) |

## 4. 프런트 함수 5개 (번호는 S1-09 프런트 263 에 이어서)
| # | 함수·대상 | 하는 일 | 설명 |
|---|---|---|---|
| 269 | `sequencer-commands.js` | 레지스트리 · 팔레트 | [269](<javascript/S1-10 - 프로젝트 전체 저장·불러오기/269_sequencer-commands.md>) |
| 270 | `sequencer-history.js` | Undo/Redo | [270](<javascript/S1-10 - 프로젝트 전체 저장·불러오기/270_sequencer-history.md>) |
| 271 | `sequencer-save.js` | 저장 · 자동 저장 · 떠나기 | [271](<javascript/S1-10 - 프로젝트 전체 저장·불러오기/271_sequencer-save.md>) |
| 272 | `sequencer.js` init · loadProject · initShortcuts · handleChange | 시작점 | [272](<javascript/S1-10 - 프로젝트 전체 저장·불러오기/272_sequencer-init_load.md>) |
| 273 | `sequencer-devices.js` applyFullProject · setDeviceNotifier · 도우미 | 장치 채우기 · 이력 알림 | [273](<javascript/S1-10 - 프로젝트 전체 저장·불러오기/273_sequencer-devices_full_notify.md>) |

## 5. 요구사항 대응
| 요구사항 | 내용 | 어디서 |
|---|---|---|
| FR-253 | Ctrl+S 수동 저장, 30초 자동 저장 | 271 `saveNow` · `markDirty`, 272 `initShortcuts` |
| FR-254 | `/full` 하나로 전체 불러오기 | 266 `get_full_project`, 272 `loadProject`, 273 `applyFullProject` |
| FR-255 | Undo/Redo 최소 100단계, 디바이스 동작만 | 270 `HISTORY_LIMIT`, 273 `reapplyDevice` 등 |
| FR-256 | `beforeunload` 경고 | 271 `onBeforeUnload` |
| FR-2169 | 메뉴 · 단축키 · 팔레트 · Nyxi 가 같은 명령 사용 | 269 `runCommand`, 272 `initShortcuts`, 271 `registerCommand` |
| FR-202a | BPM · Key · 박자를 상단에 채움 | 272 `applyProjectInfo` |

## 6. 왜 이렇게
| 결정 | 이유 |
|---|---|
| `/full` 응답에 clips · markers · tempo_changes · meter_changes 를 빈 배열로 | 지금 만들 트랙 · 악기 · 이펙트 · 패턴만 담습니다. 나중에 표가 생기면 넣습니다 (2026-10-18 결정) |
| Undo/Redo 대상을 디바이스 동작으로 | 프런트에서 상태가 크지 않고, 클립 · 노트 · 오토메이션은 아직 저장 경로가 없습니다. 구조는 확장 가능하게 |
| `PATCH /settings` 는 `exclude_unset` | 요청에 없는 칸은 건드리지 않습니다. BPM 만 바꾸면 BPM 만 바뀝니다 |
| `revision` 은 건드리지 않음 | 프로젝트를 새로 열 때마다 오르면 이전 이력과 어긋납니다 |
| 장치 알림은 `setDeviceNotifier` 로 | 장치 모듈이 이력 모듈을 직접 알 필요가 없습니다. 시퀀서 시작점이 연결합니다 |
| `applying` 깃발 | undo 가 만든 알림이 다시 pushHistory 로 들어가면 이력이 어긋납니다 |
| `e.isTrusted` 가드 (예정) | UI 모듈의 예시 배선이 공용 레지스트리를 다시 불러 무한 재귀가 되지 않게 합니다 |

## 7. 검증 결과
| 방법 | 대상 | 결과 |
|---|---|---|
| `pytest -q` | 백엔드 전체 | **1045 passed** (73.86s) |
| `ruff check .` | 백엔드 + tests | All checks passed |
| `node --check` | 프런트 JS 모듈 | 통과 (전통 문법만 사용, `?.` · `??` 없음) |
| 라이브 API 시험 | `/full` · `/settings` | 프로젝트 · 트랙 · 패턴 · 노트가 모두 들어오고, BPM 변경이 저장됩니다 |
| headless UI 시험 `docs/handoff/s1-10_tests/ui.mjs` | 로그인 · `/full` 로드 · Ctrl+S · Ctrl+Z · Ctrl+P · beforeunload | 진행 중 |

> 프런트 headless 시험은 시퀀서 모듈의 `init()` 이 완성된 뒤 한 번에 실행합니다.

## 8. 작업 중 고친 것
| 무엇 | 어떻게 |
|---|---|
| 백엔드 시험의 `bass` · `keys` 미사용 대입 | ruff F841 로 잡혀 제거 |
| `test_full_project_routes.py` 한 줄이 88자 초과 | `ProjectLongName(...)` 을 여러 줄로 분해 (ruff E501) |
| `ruff check app` 만으로는 tests 가 빠짐 | `ruff check .` 로 확인하도록 규칙을 넓힘 |
| YouTrack 콘솔 인코딩 | `PYTHONIOENCODING=utf-8` 없이는 `UnicodeEncodeError` 발생 |
| 임시 파일 경로의 따옴표 이스케이프 | PowerShell 에서 `\"` 가 제대로 안 되므로 임시 `.py` · `.mjs` 파일로 실행 |

## 9. 남은 일과 다음 작업이 쓰는 곳
| 작업 | 쓰는 것 |
|---|---|
| Connect to Another 저장 (FR-2197) | 241 연결선 경로와 236 서비스로 선을 저장하고 그립니다. 화면은 251 이펙트 칸에 자리만 잡아 두었습니다 |
| 클립 · 패턴 저장 · 불러오기 | `/full` 의 `clips` 칸이 비어 있습니다. 편곡 드래그(30)와 패턴 목록(272 `applyPatterns`)을 이어 붙입니다 |
| 갈래(패처) 보드 (FR-265~269) | 241 목록으로 선을 그리고 236 `gain_db` 로 세기를 정합니다 |
| 소리와 미터 (S1-11) | 263 `startMeters` 는 재생 중일 때만 흉내 내는 상태입니다 |
| 프리셋 저장 경로 | 지금은 읽기만 있습니다. `POST /plugins/{id}/presets` 는 다음 작업입니다 |
| 이 작업에서 미룬 것 | Connect 링크, 갈래 보드, 클립 · 패턴 저장, 트랙 순서 끌기, Nyxi 액션 실제 연결 |

## 10. 자주 받을 질문 대비 (Q/A)
Q. 왜 `/full` 을 새로 만들었나요?

A. 트랙 · 악기 · 이펙트 · 패턴을 각각 부르면 요청이 여섯 번 이상 나가고, 화면이 다 그려지기 전에 불안정합니다. 서버가 6회 조회한 뒤 파이썬에서 묶어서 한 번에 줍니다.

Q. Undo/Redo 가 왜 디바이스만 하나요?

A. 지금 프런트에서 저장되는 것이 곡 설정(BPM · Key)과 장치 동작뿐입니다. 클립 · 노트 · 오토메이션은 저장 경로가 아직 없습니다. 구조는 확장 가능하게 만들어 두었으므로 표가 생기면 이력에 추가하기만 하면 됩니다.

Q. 자동 저장이 매번 PATCH 를 보내나요?

A. 아닙니다. 변화를 pending 에 모았다가 30초 뒤나 Ctrl+S 를 누를 때 한 번에 보냅니다. 노브를 빠르게 돌릴 때마다 요청이 쏟아지지 않습니다.

Q. Ctrl+P 로 뭘 하나요?

A. 커맨드 팔레트가 뜹니다. 'Save', 'Undo', 'Mixer' 처럼 이름으로 검색한 뒤 Enter 로 실행합니다. 메뉴 · 단축키 · 팔레트 · Nyxi 액션이 모두 같은 명령 레지스트리를 씁니다(FR-2169).

Q. 저장 안 된 채로 창을 닫으면 어떻게 되나요?

A. 브라우저가 "정말 떠나시겠습니까?" 를 띄웁니다(FR-256). 저장 안 된 것이 없으면 조용히 닫힙니다.
