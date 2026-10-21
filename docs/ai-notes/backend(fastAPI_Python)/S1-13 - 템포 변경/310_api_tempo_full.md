# 백엔드 310 — 템포 API와 `/full` (`api/v1/projects.py`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/projects.py`, `studionx/backend/app/services/full_project_service.py`, `studionx/backend/app/schemas/full_project.py` |
| 작업 | S1-13 템포 변경: 템포 변경점 조회와 저장 API, 그리고 프로젝트 전체 조회에 변경점 포함 (PRD 02 FR-202a, FR-254) |
| 작성 | Claude (AI), 2026-10-21, 사용자 검토 |
| 이전, 다음 | 이전 309 템포 서비스, 다음 311 화면과 오디오 연결 |

## 1. 하는 일

| 요청 | 하는 일 | 권한 |
|---|---|---|
| `GET /projects/{id}/tempo-changes` | 템포 변경점 목록 (tick 오름차순) | 멤버면 누구나 |
| `PUT /projects/{id}/tempo-changes` | 보낸 목록으로 통째 교체. 빈 목록이면 모두 지움 | OWNER, EDITOR (VIEWER는 403) |
| `GET /projects/{id}/full` | 응답의 `tempo_changes`가 이전에는 늘 빈 목록이었고, 이제 저장된 변경점을 담음 | 멤버면 누구나 |

라우터는 얇게 두고 로직은 `tempo_service`(309)에 있습니다. 요청과 응답의 모양은 308의 스키마입니다.

```text
PUT /api/v1/projects/12/tempo-changes
{ "changes": [ { "tick": 3840, "bpm": 140, "ramp": "STEP" },
               { "tick": 7680, "bpm": 160.5, "ramp": "LINEAR" } ] }

200 { "items": [ { "tempo_change_id": 31, "tick": 3840, "bpm": 140.0, "ramp": "STEP" },
                 { "tempo_change_id": 32, "tick": 7680, "bpm": 160.5, "ramp": "LINEAR" } ],
      "total": 2 }
```

## 2. 언제 쓰나

| 쓰는 곳 | 하는 일 |
|---|---|
| 시퀀서가 화면을 열 때 | `GET /full`의 `tempo_changes`를 받아 재생과 내보내기가 씁니다 (311). |
| 템포 줄(Tempo lane) 편집 (아직 화면이 없음) | 점을 고칠 때마다 `PUT`으로 전체 목록을 보냅니다. |

## 3. 코드

### 3.1 라우터

```python
@router.get(
    "/{project_id}/tempo-changes",
    response_model=TempoChangesResponse,
    responses=NOT_FOUND,
)
def read_tempo_changes(project_id: int, user: CurrentUser, db: Db) -> TempoChangesResponse:
    """프로젝트의 템포 변경점 목록 (FR-202a) — 멤버면 누구나, tick 오름차순."""
    return tempo_service.list_tempo_changes(db, user, project_id)
```

```python
@router.put(
    "/{project_id}/tempo-changes",
    response_model=TempoChangesResponse,
    responses={**NOT_FOUND, **FORBIDDEN},
)
def replace_tempo_changes(
    project_id: int,
    data: TempoChangesSaveRequest,
    user: CurrentUser,
    db: Db,
) -> TempoChangesResponse:
    """템포 변경점을 보낸 목록으로 통째 교체 (FR-202a) — OWNER·EDITOR 만 (VIEWER 는 403).

    템포 줄(Tempo lane)이 바뀔 때마다 점 전체를 보낸다. 빈 목록이면 모두 지워 평평한 템포로 돌아감.
    """
    return tempo_service.replace_tempo_changes(db, user, project_id, data)
```

### 3.2 프로젝트 전체 조회에 변경점 포함

`get_full_project`의 끝에서 `FullProjectResponse`를 만들 때, 이전에는 `tempo_changes`를 채우지 않아 기본값인 빈 목록이 나갔습니다. 이제 `tempo_service.tempo_items`로 읽어 넣습니다.

```python
    return FullProjectResponse(
        project=project_info(db, project, member),
        tracks=[...],
        patterns=[...],
        clips=clips,
        tempo_changes=tempo_service.tempo_items(db, project_id),
    )
```

응답 스키마에서는 `tempo_changes`의 타입이 `list[dict[str, Any]]`에서 `list[TempoChangeItem]`으로 바뀌었습니다. 화면이 읽는 모양은 같은 JSON이고, 이제 모양이 정해져 있다는 점만 다릅니다 (`tempo_change_id`, `tick`, `bpm`, `ramp`).

```python
class FullProjectResponse(BaseModel):
    """GET /projects/{id}/full 응답 — 한 번의 요청으로 곡 전체 (FR-254).

    clips 는 프로젝트의 모든 클립(track_id 로 트랙에 묶임), connections 는 각 트랙의
    나가는 연결이다. tempo_changes 는 저장된 템포 변경점(tick 오름차순)이고, markers ·
    meter_changes 는 그 표와 API 가 아직 없어 늘 빈 목록이다.
    """

    project: FullProjectInfo
    tracks: list[FullTrackResponse]
    patterns: list[PatternResponse]
    clips: list[ClipResponse] = Field(default_factory=list)
    markers: list[dict[str, Any]] = Field(default_factory=list)
    tempo_changes: list[TempoChangeItem] = Field(default_factory=list)
    meter_changes: list[dict[str, Any]] = Field(default_factory=list)
```

## 4. 왜 이렇게

| 선택 | 이유 |
|---|---|
| 새 라우터 파일 대신 `projects.py`에 둡니다 | 변경점은 프로젝트에 속하고 주소가 `/projects/{id}/...`입니다. `/full`과 `/settings`가 이미 같은 파일에 있어서 곡 전체 설정과 한곳에서 보입니다. |
| `PUT`(통째 교체)이고 `POST`와 `PATCH`와 `DELETE`가 없습니다 | 템포 줄은 점 전체가 하나의 곡선이라, 점마다 주소를 두면 요청이 많아지고 중간 상태가 생깁니다 (309). |
| `GET /full`에도 넣어 화면이 한 번에 받습니다 | 시퀀서는 화면을 열 때 서버 요청이 한 번이어야 한다는 S1-10의 원칙을 지킵니다. 별도 `GET`은 템포 줄만 새로 읽을 때 쓰도록 남겨 둡니다. |
| `/full`의 `tempo_changes` 타입을 구체적으로 바꿨습니다 | `dict[str, Any]`는 "아직 모델이 없어 빈 목록"이라는 임시 자리였습니다. 모델이 생겼으니 모양을 고정해야 OpenAPI 문서와 화면이 같은 약속을 봅니다. |
| `markers`와 `meter_changes`는 그대로 빈 목록입니다 | 그 표의 모델과 API는 이번 범위가 아닙니다. 화면은 이 칸이 늘 있다고 보고 읽으므로 칸 자체는 유지합니다. |

## 5. 시험

`studionx/backend/tests/test_tempo_routes.py`(22건)와 `test_full_project_routes.py`가 확인합니다.

- 연결: `/projects/{project_id}/tempo-changes`에 `get`과 `put`만 등록되어 있습니다.
- `GET /full`의 `tempo_changes`가 저장한 변경점을 tick 오름차순으로 담고, 각 항목의 키가 `tempo_change_id`, `tick`, `bpm`, `ramp`입니다.
- 변경점이 없는 프로젝트는 `tempo_changes`가 빈 목록입니다 (기존 시험이 그대로 통과).
- 백엔드 전체 시험 1105건이 통과합니다 (이전 1083건에 22건 추가). `ruff`도 통과합니다.
