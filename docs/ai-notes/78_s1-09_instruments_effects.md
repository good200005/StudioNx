# AI 구현 설명 78 — S1-09 기본 악기·이펙트 (백엔드 API)

| 항목 | 내용 |
|---|---|
| 작업 | S1-09 기본 악기·이펙트: 트랙·악기·이펙트·연결선 백엔드 API (PRD 02 FR-241~246, FR-251~253, FR-262~269) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-09-instruments-effects` (PR [#82](https://github.com/good200005/StudioNx/pull/82), `develop` 으로 병합 대기) |
| 함수 문서 | 226 ~ 242 (md, PDF) · 합본 [S1-09_instruments_effects_api.pdf](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/S1-09_instruments_effects_api.pdf>) |
| 이전 문서 | [77_s1-08_accordion_pianoroll.md](77_s1-08_accordion_pianoroll.md) |

## 1. 실행 결과
트랙을 만들고 고치고 지우는 일, 트랙에 가상악기와 이펙트를 붙이고 소리 순서를 바꾸는 일, 갈래(패처)에서 이펙트 카드를 잇는 일을 백엔드에서 할 수 있게 되었습니다. 플러그인 정의 일곱 종(악기 2, 이펙트 5)을 시드로 넣었고, 각 플러그인의 노브·선택 상자 설계도(`param_schema`)를 함께 담아 화면이 그것만 읽고 파라미터 화면을 그릴 수 있습니다.

이번 작업은 **백엔드까지**입니다. 화면(트랙 헤더의 Instrument·Effects·Connect 칸)은 아직 스켈레톤만 있어, §9 에 다음 작업으로 적어 두었습니다.

## 2. 무엇을 만들었나
| 파일 | 역할 |
|---|---|
| `backend/app/models/plugin.py` | `plugins` · `plugin_presets` 표 (226) |
| `backend/app/models/track_plugin.py` | `track_instruments` · `track_plugins` · `track_plugin_links` 표 (227) |
| `backend/app/models/track.py` | 트랙의 Phase 2 칸(라우팅·부모 트랙·협업 잠금) 추가 (228) |
| `backend/app/schemas/plugin.py` | 플러그인·프리셋 응답 모양 (229) |
| `backend/app/schemas/device.py` | 악기·이펙트·연결선 요청·응답 (230) |
| `backend/app/schemas/track.py` | 트랙 요청·응답 (231) |
| `backend/app/services/plugin_service.py` | 플러그인 조회·프리셋 조회 (232) |
| `backend/app/services/track_service.py` | 트랙 CRUD·권한, 악기·이펙트·연결선 CRUD (233~236) |
| `backend/app/api/v1/plugins.py` | 플러그인 경로 3개 (237) |
| `backend/app/api/v1/tracks.py` | 트랙·악기·이펙트·연결선 경로 12개 (238~241) |
| `backend/app/api/v1/router.py` | `plugins`·`tracks` 라우터 등록 |
| `studionx/db/migrations/2026-10-18_plugins_seed.sql` | 시드 일곱 종 (242) |
| `studionx/db/02_phase2_sequencer.sql` | 세 표와 시드를 Phase 2 스키마에 함께 넣음 |

## 3. 함수 17개 (번호는 S1-08 의 225 에 이어서)
| # | 함수·대상 | 하는 일 | 설명 |
|---|---|---|---|
| 226 | `Plugin` · `PluginPreset` | 플러그인 정의와 프리셋 표 | [226](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/226_models_plugin.md>) |
| 227 | `TrackInstrument` · `TrackPlugin` · `TrackPluginLink` | 트랙 안 장치 표 | [227](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/227_models_track_plugin.md>) |
| 228 | `Track` (Phase 2 칸) | 라우팅·부모 트랙·잠금 칸 | [228](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/228_models_track_phase2.md>) |
| 229 | 플러그인 스키마 | `param_schema` 항목 모양 | [229](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/229_schemas_plugin.md>) |
| 230 | 디바이스 스키마 | 악기·이펙트·연결선 요청·응답 | [230](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/230_schemas_device.md>) |
| 231 | 트랙 스키마 | 트랙 요청·응답 | [231](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/231_schemas_track.md>) |
| 232 | `plugin_service` | 목록·한 건·프리셋 | [232](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/232_plugin_service.md>) |
| 233 | 트랙 서비스 (트랙·권한) | 목록·만들기·조회·고치기·지우기 | [233](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/233_track_service_track.md>) |
| 234 | 악기 칸 | 칸 번호 확인과 네 함수 | [234](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/234_track_service_instrument.md>) |
| 235 | 이펙트 칸 | 체인 순서와 카드 자리 | [235](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/235_track_service_effect.md>) |
| 236 | 연결선 | 갈래 나누기와 합치기 | [236](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/236_track_service_link.md>) |
| 237 | `GET /plugins` 등 3개 | 플러그인 조회 | [237](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/237_api_plugins.md>) |
| 238 | 트랙 API 5개 | 목록·만들기·조회·고치기·지우기 | [238](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/238_api_tracks.md>) |
| 239 | 악기 API 4개 | 목록·붙이기·고치기·떼기 | [239](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/239_api_instruments.md>) |
| 240 | 이펙트 API 4개 | 목록·붙이기·고치기·떼기 | [240](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/240_api_effects.md>) |
| 241 | 연결선 API 3개 | 목록·긋기·지우기 | [241](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/241_api_links.md>) |
| 242 | 시드 SQL | 기본 악기·이펙트 일곱 종 | [242](<backend(fastAPI_Python)/S1-09 - 기본 악기·이펙트/242_seed_plugins.md>) |

## 4. 열어 둔 경로 (주소 11개, 동작 19개)
| 경로 | 하는 일 |
|---|---|
| `GET /plugins` · `GET /plugins/{id}` · `GET /plugins/{id}/presets` | 플러그인 목록·한 건·프리셋 (237) |
| `GET` · `POST /projects/{id}/tracks` | 트랙 목록·만들기 (238) |
| `GET` · `PATCH` · `DELETE /tracks/{id}` | 트랙 조회·고치기·지우기 (238) |
| `GET` · `POST /tracks/{id}/instruments` | 악기 목록·붙이기 (239) |
| `PATCH` · `DELETE /tracks/{id}/instruments/{iid}` | 악기 고치기·떼기 (239) |
| `GET` · `POST /tracks/{id}/plugins` | 이펙트 목록·붙이기 (240) |
| `PATCH` · `DELETE /tracks/{id}/plugins/{pid}` | 이펙트 고치기·떼기 (240) |
| `GET` · `POST /tracks/{id}/links` | 연결선 목록·긋기 (241) |
| `DELETE /tracks/{id}/links/{lid}` | 연결선 지우기 (241) |

## 5. 요구사항 대응
| 요구사항 | 내용 | 어디서 |
|---|---|---|
| FR-241 | 기본 악기·이펙트 정의 제공 | 242 시드, 232 목록 |
| FR-242 | 사용자 프리셋 저장·불러오기 | 226·229 표와 스키마, 232 프리셋 조회 |
| FR-244 | 악기/이펙트 고르기 목록 | 237 `GET /plugins` |
| FR-245 | 트랙에 악기·이펙트 붙이기 | 234·235 서비스, 239·240 경로 |
| FR-246 | `param_schema` 로 파라미터 화면 | 229 스키마, 242 시드 |
| FR-251 | 트랙 만들기·고치기·지우기 | 233 서비스, 238 경로 |
| FR-252 | MASTER 트랙과 부모 트랙 | 233 `create_track` |
| FR-253 | 트랙 목록과 순서 | 233 `list_tracks` |
| FR-262 | 악기 파라미터 값 저장 | 234 `params`, 239 `PATCH` |
| FR-263 | 이펙트 체인 순서 편집 | 235 `slot_index`, 234 `_require_free_slot` |
| FR-264 | 파라미터·세기·켜기 저장 | 230·231 스키마 |
| FR-265 | 갈래(패처) 연결 | 236, 241 |
| FR-266 | 연결마다 다른 세기 | 236 `gain_db` |
| FR-267 | 갈래 나누기·합치기·빈 끝 | 236, 241 |
| FR-269 | 카드 자리와 라우팅 방식 | 228 `routing_mode`, 230 `node_x`·`node_y` |

## 6. 왜 이렇게
| 결정 | 이유 |
|---|---|
| 플러그인 정의는 시드로만 | 정의를 화면에서 만들면 없는 엔진 이름·빈 `param_schema` 가 들어갑니다. 시드는 `code` 를 키로 갱신해 쓰던 악기가 지워지지 않습니다 (242) |
| 악기·이펙트 종류를 서로 못 바꾸게 | 악기 칸에 이펙트를 넣으면 신호 흐름이 끊깁니다. 서비스가 400 으로 알려 줍니다 (234·235) |
| 칸 번호를 미리 확인 | DB 에 `UNIQUE (track_id, slot_index)` 가 있어, 안 막으면 500 이 납니다. 400 으로 알려 주어 화면이 다른 칸을 고르게 합니다 (234) |
| 목록은 관계 대신 쿼리로 | 같은 요청에서 지운 뒤 다시 읽을 때 관계에는 지워진 행이 남습니다(DB CASCADE). 쿼리는 늘 실제 값을 돌려줍니다 (234·235) |
| 남의 트랙은 404 | 403 을 돌려주면 그 번호의 트랙이 있다는 사실이 새어 나갑니다. 프로젝트 API 와 같은 규칙입니다 (233) |
| 고치기는 보낸 칸만 | `exclude_unset=True` 로 안 보낸 칸을 걸러, 볼륨만 고칠 때 파라미터가 덮이지 않습니다 (238~240) |

## 7. 검증 결과
| 방법 | 대상 | 결과 |
|---|---|---|
| `python -m pytest -q` (실제 MySQL, 끝나면 rollback) | 전체 | 통과 (S1-08 까지 1019건 + 이번에 더한 19건) |
| `python -m ruff check .` | 백엔드 전체 | 통과 |
| 함수 시험 | `tests/test_plugin_routes.py` | 목록·한 건·프리셋, 401·404·422 |
| 함수 시험 | `tests/test_track_routes.py` | 트랙·악기·이펙트·연결선 CRUD, 칸 충돌 400, 권한 403·404 |
| 모델 시험 (신규) | `tests/test_plugin_model.py` | 다섯 표의 칸·기본값을 실제 MySQL 과 비교, `param_schema` JSON 왕복, 같은 칸 두 번은 `IntegrityError`, 트랙을 지우면 장치 행도 삭제 |
| 경로 등록 | `test_track_routes_registered` | 트랙·악기·이펙트·연결선 8개 경로 확인 |

> 화면 검증은 없습니다. S1-09 화면(Instrument·Effects·Connect 칸)이 아직 스켈레톤이라, 이번 검증은 API 와 DB 까지입니다.

## 8. 작업 중 고친 것
| 무엇 | 어떻게 |
|---|---|
| 칸 번호 중복이 500 이 되던 문제 | `_require_free_slot` 을 만들어 붙이기·고치기 네 곳에서 미리 확인하고 400 으로 답하게 했습니다 |
| `plugin_presets.source` 기본값 | DB 는 `'USER'` 인데 모델이 `SYSTEM` 이어서, 모델을 DB 에 맞췄습니다 (226) |
| 프리셋 목록 시험 | "남의 프리셋도 시스템이면 보인다" 는 잘못된 가정을 지우고, 로그인하지 않으면 401 을 확인하는 시험으로 바꿨습니다 |

## 9. 남은 일과 다음 작업이 쓰는 곳
| 작업 | 쓰는 것 |
|---|---|
| S1-09 화면 (Instrument·Effects·Connect 칸) | 237 플러그인 목록으로 고르기 창을 채우고, 239·240 으로 붙이고, 229 `param_schema` 로 노브를 그립니다 |
| 체인 순서 끌어 옮기기 | 옮긴 카드의 새 `slot_index` 를 240 `PATCH` 로 보냅니다. 서로 맞바꿀 때는 빈 칸(예: 100)을 거쳐 세 번 보냅니다 (235) |
| 갈래(패처) 보드 | 241 목록으로 선을 그리고, 236 `gain_db` 로 세기를 정합니다 |
| S1-10 저장·불러오기(`/full`) | 트랙·악기·이펙트·연결선을 한 번에 담고 되살리는 일이 남았습니다 |
| 프리셋 저장 경로 | 지금은 읽기만 있습니다. `POST /plugins/{id}/presets` 는 S1-10 이후에 붙입니다 |
| 이 작업에서 미룬 것 | 화면 배선, 프리셋 저장, 트랙 사이 연결(`track_connections`), 자동 저장은 다음 작업입니다 |

## 10. 자주 받을 질문 대비 (Q/A)
Q. 화면은 언제 볼 수 있나요?

A. 이번 작업은 백엔드까지입니다. 트랙 헤더의 Instrument·Effects·Connect 칸은 스켈레톤만 있어, 다음 화면 작업에서 237~241 경로를 붙입니다.

Q. 이펙트 순서를 서로 맞바꾸려면 요청을 몇 번 보내나요?

A. 세 번입니다. 한 카드를 빈 칸(100번)으로 옮기고, 다른 카드를 비워진 자리로 옮긴 뒤, 첫 카드를 마지막 자리로 옮깁니다. 이미 찬 칸에 넣으려 하면 400 이라 맞바꾸기가 한 번에 되지 않습니다(235).

Q. 같은 칸에 두 번 붙이면 왜 400 인가요?

A. 한 트랙의 같은 칸 번호는 소리 순서를 뜻합니다. 둘이 같은 번호면 순서를 정할 수 없어 DB 가 막습니다. 위반하기 전에 서비스가 400 으로 알려 주어 화면이 다른 칸을 고를 수 있습니다(234).
