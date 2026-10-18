# Backend(FastAPI/Python) 241 — 연결선 API (목록 · 긋기 · 지우기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/tracks.py` (연결선 경로) |
| 작업 | S1-09 기본 악기·이펙트: 갈래 연결선 경로 세 개 (PRD 02 FR-265~269) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 240 이펙트 API · 242 시드 SQL |

## 1. 하는 일
갈래(패처) 연결선을 다루는 경로 세 개를 엽니다.

| 경로 | 하는 일 | 상태 코드 |
|---|---|---|
| `GET /tracks/{track_id}/links` | 연결선 목록 (번호 순) | 200, 401, 404 |
| `POST /tracks/{track_id}/links` | 연결선 긋기 | 201, 400, 401, 403, 404 |
| `DELETE /tracks/{track_id}/links/{link_id}` | 연결선 지우기 | 204, 401, 403, 404 |

연결선을 고치는 경로는 아직 없습니다. 선을 옮기는 화면이 필요하면 지우고 다시 긋거나, 준비해 둔 `TrackPluginLinkUpdateRequest`(230)로 경로를 하나 더 열면 됩니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 갈래(패처) 보드 열기 | `GET` 으로 저장된 선을 그립니다 (FR-267) |
| 카드 이어 붙이기 | 카드 출력에서 다른 카드 입력으로 끌어 놓으면 `POST` (FR-265) |
| 선 지우기 | 선을 고르고 `DELETE` |

## 3. 코드
**목록과 긋기**
```python
@router.get("/tracks/{track_id}/links", response_model=list[TrackPluginLinkResponse],
            responses={...})
def list_links(track_id: Annotated[int, Path(ge=1)], db: Db, current_user: CurrentUser):
    links = track_service.list_links(db, current_user, track_id)
    return [TrackPluginLinkResponse.model_validate(lnk) for lnk in links]


@router.post("/tracks/{track_id}/links", response_model=TrackPluginLinkResponse,
             status_code=status.HTTP_201_CREATED, responses=WRITE_RESPONSES)
def add_link(track_id: Annotated[int, Path(ge=1)], req: TrackPluginLinkCreateRequest,
             db: Db, current_user: CurrentUser):
    link = track_service.add_link(
        db, current_user, track_id,
        from_track_plugin_id=req.from_track_plugin_id, from_port=req.from_port,
        to_track_plugin_id=req.to_track_plugin_id, to_port=req.to_port, gain_db=req.gain_db,
    )
    return TrackPluginLinkResponse.model_validate(link)
```

**지우기**
```python
@router.delete("/tracks/{track_id}/links/{link_id}",
               status_code=status.HTTP_204_NO_CONTENT, responses={...})
def remove_link(track_id: Annotated[int, Path(ge=1)], link_id: Annotated[int, Path(ge=1)],
                db: Db, current_user: CurrentUser):
    track_service.remove_link(db, current_user, track_id, link_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `from_track_plugin_id=req.from_track_plugin_id` | 요청 칸 이름을 그대로 서비스 인자로 넘깁니다. `from` 은 파이썬 예약어라 접두어를 붙였습니다 |
| `from_port`·`to_port` | 카드의 어느 입·출력에 꽂혔는지 나타냅니다. 0 부터 셉니다 |
| `gain_db` | 선마다 다른 세기입니다. 기본 0.00 dB |
| `{link_id}` | 선 한 줄의 행 번호입니다. 트랙과 맞지 않으면 404 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 표 이름(`link`)을 주소에 그대로 | 화면 코드와 DB 가 같은 이름을 씁니다. `connection` 처럼 다른 말을 쓰면 트랙 사이 연결(`track_connections`)과 헷갈립니다 |
| 긋기만 201 | 새 선이 생기는 경로입니다. 지우기는 204 |
| 선 수정 경로를 안 엶 | 지금 화면에는 선을 끌어 옮기는 기능이 없습니다. 안 쓰는 경로를 미리 열면 시험도 문서도 늘어납니다 |
| 목록에 번호 순 정렬 | 선이 그려지는 순서가 매번 같아 화면이 흔들리지 않습니다 |

## 5. 시험
`tests/test_track_routes.py` 의 `test_patcher_links_crud` 가 트랙 입력(빈 `from`)에서 이펙트 A 로 가는 선과 이펙트 A 에서 이펙트 B 로 가는 선을 만들고, 목록 개수·`gain_db` 저장·지우기를 확인합니다. 다른 트랙의 이펙트를 가리키면 404 입니다.
