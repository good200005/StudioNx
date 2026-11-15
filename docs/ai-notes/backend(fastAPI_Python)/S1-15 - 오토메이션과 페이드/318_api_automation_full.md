# 백엔드 318 — 오토메이션 API와 /full (`api/v1/automation.py`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/automation.py`, `studionx/backend/app/api/v1/router.py`, `studionx/backend/app/schemas/full_project.py`, `studionx/backend/app/services/full_project_service.py` |
| 작업 | S1-15 오토메이션과 페이드: 오토메이션 주소 두 개와 프로젝트 전체 불러오기에 레인 포함 |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 317 서비스, 다음 JS 319 |

## 1. 하는 일

| 주소 | 권한 | 응답 |
|---|---|---|
| `GET /api/v1/tracks/{track_id}/automation` | 멤버 누구나 | 레인 목록 (점 포함) |
| `PUT /api/v1/tracks/{track_id}/automation` | OWNER, EDITOR | 저장된 레인, 점이 없으면 204 |
| `GET /api/v1/projects/{id}/full` | 멤버 누구나 | 기존 내용에 `automation` 목록 추가 |

PUT 본문 예시입니다.

```json
{
  "target_type": "DEVICE_PARAM",
  "track_plugin_id": 812,
  "param_index": 2,
  "is_enabled": true,
  "points": [
    {"tick": 0,    "value": 0.2, "curve": 0},
    {"tick": 3840, "value": 0.8, "curve": -0.3}
  ]
}
```

오류는 다음과 같습니다.

| 상태 | 언제 |
|---|---|
| 400 `VALIDATION_ERROR` | 장치 번호나 칸 번호가 빠졌거나, 다른 트랙의 악기나 이펙트를 보냈을 때 |
| 401 | 로그인하지 않았을 때 |
| 403 | VIEWER 가 저장하려 했을 때 |
| 404 | 트랙이 없거나 프로젝트 멤버가 아닐 때 |

## 2. 코드

```python
router = APIRouter(tags=["automation"])

@router.get("/tracks/{track_id}/automation", response_model=list[AutomationLaneResponse], responses=ERRORS)
def list_automation(track_id: Annotated[int, Path(ge=1)], db: Db, current_user: CurrentUser):
    return automation_service.list_lanes(db, current_user, track_id)


@router.put("/tracks/{track_id}/automation", response_model=AutomationLaneResponse,
            responses={204: {"description": "점이 없어 레인을 지움"}, **ERRORS})
def save_automation(track_id: Annotated[int, Path(ge=1)], body: AutomationLaneSaveRequest,
                    db: Db, current_user: CurrentUser):
    lane = automation_service.save_lane(db, current_user, track_id, body)
    if lane is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return lane
```

라우터 등록(`router.py`)과 `/full` 확장입니다.

```python
api_router.include_router(automation.router, prefix="", tags=["automation"])  # S1-15
```

```python
# schemas/full_project.py
automation: list[AutomationLaneResponse] = Field(default_factory=list)

# services/full_project_service.py
automation=[
    lane
    for lanes in automation_service.lanes_for_tracks(db, track_ids).values()
    for lane in lanes
],
```

`/full`은 프로젝트를 열 때 한 번 부르는 주소이므로, 오토메이션도 여기에 실어야 화면이 레인마다 GET을 반복하지 않습니다. 클립의 페이드 값은 이미 `clips` 테이블 칸(`fade_in_tick` 등)이어서 `PATCH /clips/{id}`와 `/full`의 클립 목록이 그대로 나릅니다.

## 3. 시험

`tests/test_automation_routes.py`에 30개가 있습니다.

| 묶음 | 확인하는 것 |
|---|---|
| 저장과 조회 | 점이 `tick` 순으로 돌아오고, 같은 대상은 레인을 바꿔 씁니다. |
| 비우기 | 점이 없으면 204와 함께 레인이 지워집니다. |
| 대상 네 종류 | 볼륨, 팬, 이펙트 노브, 악기 노브가 각각 저장됩니다. |
| 소속 검사 | 다른 트랙의 악기와 이펙트는 400입니다. |
| 입력 한도 | 점 5001개, `curve` 범위 밖, 음수 `tick`, 너무 큰 `value`를 거절합니다. |
| 권한 | VIEWER 403, 바깥 사용자 404, 비로그인 401입니다. |
| 연동 | `/full`에 레인이 포함되고, 트랙과 악기를 지우면 레인도 지워집니다. |
| 클립 페이드 | `PATCH /clips/{id}`로 페이드 4칸이 저장되고 범위를 검사합니다. |
