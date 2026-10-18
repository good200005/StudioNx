# Backend(FastAPI/Python) 239 — 악기 API (목록 · 붙이기 · 고치기 · 떼기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/tracks.py` (악기 경로) |
| 작업 | S1-09 기본 악기·이펙트: 트랙 안 악기 칸 경로 네 개 (PRD 02 FR-245, FR-262, FR-264) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 238 트랙 API · 240 이펙트 API |

## 1. 하는 일
트랙 안의 악기 칸을 다루는 경로 네 개를 엽니다.

| 경로 | 하는 일 | 상태 코드 |
|---|---|---|
| `GET /tracks/{track_id}/instruments` | 악기 칸 목록 (칸 번호 순) | 200, 401, 404 |
| `POST /tracks/{track_id}/instruments` | 악기 붙이기 | 201, 400, 401, 403, 404 |
| `PATCH /tracks/{track_id}/instruments/{instrument_id}` | 파라미터·볼륨·팬·솔로·켜기·칸 번호 고치기 | 200, 400, 401, 403, 404 |
| `DELETE /tracks/{track_id}/instruments/{instrument_id}` | 악기 떼기 | 204, 401, 403, 404 |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 화면의 [Instrument] 칸 | `GET` 으로 현재 악기를 그리고, `POST` 로 가상악기를 붙입니다 |
| 파라미터 편집 | 노브를 돌린 값을 `PATCH` 로 모아 보냅니다 (FR-262) |
| 악기 떼기 | `DELETE` 로 칸을 비웁니다 |

## 3. 코드
**목록과 붙이기**
```python
@router.get("/tracks/{track_id}/instruments", response_model=list[TrackInstrumentResponse],
            responses={...})
def list_instruments(track_id: Annotated[int, Path(ge=1)], db: Db, current_user: CurrentUser):
    instruments = track_service.list_instruments(db, current_user, track_id)
    return [TrackInstrumentResponse.model_validate(i) for i in instruments]


@router.post("/tracks/{track_id}/instruments", response_model=TrackInstrumentResponse,
             status_code=status.HTTP_201_CREATED, responses=WRITE_RESPONSES)
def add_instrument(track_id: Annotated[int, Path(ge=1)], req: TrackInstrumentCreateRequest,
                   db: Db, current_user: CurrentUser):
    inst = track_service.add_instrument(
        db, current_user, track_id,
        plugin_id=req.plugin_id, slot_index=req.slot_index, params=req.params,
        volume_db=req.volume_db, pan=req.pan, is_solo=req.is_solo, is_enabled=req.is_enabled,
    )
    return TrackInstrumentResponse.model_validate(inst)
```

**고치기와 떼기**
```python
@router.patch("/tracks/{track_id}/instruments/{instrument_id}",
              response_model=TrackInstrumentResponse, responses=WRITE_RESPONSES)
def update_instrument(track_id: Annotated[int, Path(ge=1)],
                      instrument_id: Annotated[int, Path(ge=1)],
                      req: TrackInstrumentUpdateRequest, db: Db, current_user: CurrentUser):
    data = req.model_dump(exclude_unset=True)
    inst = track_service.update_instrument(db, current_user, track_id, instrument_id, **data)
    return TrackInstrumentResponse.model_validate(inst)


@router.delete("/tracks/{track_id}/instruments/{instrument_id}",
               status_code=status.HTTP_204_NO_CONTENT, responses={...})
def remove_instrument(track_id: Annotated[int, Path(ge=1)],
                      instrument_id: Annotated[int, Path(ge=1)],
                      db: Db, current_user: CurrentUser):
    track_service.remove_instrument(db, current_user, track_id, instrument_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `response_model=list[TrackInstrumentResponse]` | 목록 경로는 배열을 돌려줍니다. 감싸는 객체가 없습니다 |
| `[TrackInstrumentResponse.model_validate(i) for i in instruments]` | ORM 목록을 응답 목록으로 한 줄에 바꿉니다 |
| 경로 값 두 개(`track_id`, `instrument_id`) | 둘 다 `Path(ge=1)` 입니다. 주소에 있는 번호가 함수 인자로 들어옵니다 |
| `req: TrackInstrumentCreateRequest` | 본문(JSON)을 검사해 넘깁니다. 검사 실패는 422 입니다 |
| 서비스에 `track_id` 와 `instrument_id` 를 함께 넘김 | 악기가 정말 그 트랙의 것인지 서비스가 확인합니다. 아니면 404 입니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 악기 번호를 칸 번호 대신 씀 | 주소의 `{instrument_id}` 는 행 번호(기본 키)입니다. 칸 번호는 바뀔 수 있어 주소로 쓰면 헷갈립니다 |
| 붙이기만 201 | 새 행이 생기는 경로만 201 입니다. 고치기와 떼기는 각각 200, 204 입니다 |
| 파라미터 전체를 한 번에 | 노브 하나마다 요청을 보내면 소리가 끊깁니다. 화면이 모아 보내고 `params` 를 통째로 바꿉니다 (FR-262) |
| `exclude_unset` 로 부분 수정 | 볼륨만 고칠 때 나머지 칸이 0 으로 덮이지 않습니다 (238 과 같은 방식) |

## 5. 시험
`tests/test_track_routes.py` 가 다음을 확인합니다.
- 붙이기 201과 응답 칸 이름, `params` 저장, 기본값(`is_enabled` = true)
- 없는 플러그인 404, 이펙트 플러그인을 넣으면 400
- 같은 칸 두 번이면 400 (`test_slot_conflict_is_400`), 자기 자리로의 수정은 200
- 고치기 응답(볼륨·켜기), 떼기 204와 목록 비기
