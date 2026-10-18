# Backend(FastAPI/Python) 237 — 플러그인 API (`/plugins`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/plugins.py` |
| 작업 | S1-09 기본 악기·이펙트: 플러그인 조회 경로 세 개 (PRD 02 FR-241, FR-244, FR-246) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 236 연결선 · 238 트랙 API |

## 1. 하는 일
플러그인을 읽는 경로 세 개를 엽니다. 등록은 `router.py` 에서 `prefix="/plugins"` 로 붙습니다.

| 경로 | 하는 일 | 상태 코드 |
|---|---|---|
| `GET /plugins` | 목록. `?active_only=false` 면 못 쓰는 것도 포함 | 200, 401 |
| `GET /plugins/{plugin_id}` | 한 건 | 200, 401, 404 |
| `GET /plugins/{plugin_id}/presets` | 시스템 프리셋과 내 프리셋 | 200, 401, 404 |

세 경로 모두 로그인(`CurrentUser`)이 필요합니다. 라우터는 요청·응답 모양과 상태 코드만 정하고, 찾기와 오류는 `plugin_service`(232)에 맡깁니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 화면의 악기/이펙트 고르기 창 | `GET /plugins?active_only=true` 로 목록을 그립니다 (FR-244) |
| 파라미터 그리기 | `GET /plugins/{id}` 의 `param_schema` 를 읽어 노브를 만듭니다 (FR-246) |
| 프리셋 단추 | `GET /plugins/{id}/presets` 로 고를 수 있는 프리셋을 채웁니다 (FR-242) |

## 3. 코드
**목록**
```python
@router.get("", response_model=PluginListResponse, responses={401: {"model": ErrorResponse}})
def list_plugins(
    db: Db,
    current_user: CurrentUser,
    active_only: Annotated[bool, Query(description="활성 플러그인만")] = True,
):
    items = plugin_service.list_plugins(db, active_only=active_only)
    return PluginListResponse(items=[PluginResponse.model_validate(p) for p in items])
```

**한 건과 프리셋**
```python
@router.get("/{plugin_id}", response_model=PluginResponse,
            responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def get_plugin(plugin_id: Annotated[int, Path(ge=1)], db: Db, current_user: CurrentUser):
    p = plugin_service.require_plugin(db, plugin_id)
    return PluginResponse.model_validate(p)


@router.get("/{plugin_id}/presets", response_model=list[PluginPresetResponse],
            responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def list_plugin_presets(plugin_id: Annotated[int, Path(ge=1)], db: Db, current_user: CurrentUser):
    p = plugin_service.require_plugin(db, plugin_id)
    presets = plugin_service.list_plugin_presets(db, p.plugin_id, user_id=current_user.user_id)
    return [PluginPresetResponse.model_validate(pr) for pr in presets]
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `@router.get("")` | 앞 경로가 `"/plugins"` 뿐이라 빈 문자열을 씁니다. `"/"` 로 쓰면 뒤에 슬래시가 붙어 307 리다이렉트가 납니다 |
| `db: Db`, `current_user: CurrentUser` | `Annotated` 로 묶은 의존성입니다. 함수만 적으면 FastAPI 가 세션과 로그인 회원을 넣어 줍니다 |
| `Annotated[bool, Query(...)] = True` | 주소의 `?active_only=false` 를 받습니다. 안 주면 True |
| `Annotated[int, Path(ge=1)]` | 경로 값이 1 이상이어야 합니다. 0 이면 422 입니다 |
| `responses={401: {"model": ErrorResponse}}` | 문서(Swagger)에 오류 모양을 보여 줍니다. 실제 응답은 `AppError` 처리기가 만듭니다 |
| `PluginResponse.model_validate(p)` | ORM 객체를 응답 모델로 바꿉니다. 목록은 `items=[...]` 로 감쌉니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 프리셋 경로도 플러그인 존재를 먼저 확인 | 없는 플러그인의 프리셋은 빈 목록이 아니라 404 가 맞습니다. 화면이 잘못된 번호를 바로 알아챕니다 |
| `current_user` 를 안 쓰는 목록에도 받음 | 로그인하지 않으면 401 을 내야 합니다. 안 받으면 누구나 플러그인 목록을 볼 수 있습니다 |
| 쓰기 경로 없음 | 플러그인 정의는 시드(242)가 넣습니다. 화면에서 만들면 `param_schema` 없는 플러그인이 생깁니다 |
| 목록 응답을 `{items: [...]}` 로 감쌈 | 플러그인 목록은 개수(`total`)를 함께 주는 편이 화면에 낫습니다 (232 와 같은 모양) |

## 5. 시험
`tests/test_plugin_routes.py` 가 다음을 확인합니다.
- 로그인 뒤 목록 200과 `items` 배열, `active_only=false` 일 때 비활성 플러그인 포함
- `param_schema` 가 비어 있지 않고 종류(`plugin_type`)가 `INSTRUMENT`·`EFFECT` 중 하나
- 없는 번호일 때 404, 번호가 0 일 때 422
- 로그인하지 않으면 목록·한 건·프리셋 모두 401 (`test_presets_requires_login`)
