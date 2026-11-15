# 백엔드 317 — 오토메이션 서비스 (`services/automation_service.py`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/automation_service.py` |
| 작업 | S1-15 오토메이션과 페이드: 레인과 점의 조회, 저장, 삭제 규칙 |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 316 모델과 스키마, 다음 318 API와 /full |

## 1. 하는 일

서비스에는 함수가 네 개 있습니다.

| 함수 | 하는 일 |
|---|---|
| `_lane_response(lane, points)` | 레인과 점을 응답 모양으로 바꿉니다. |
| `lanes_for_tracks(db, track_ids)` | 트랙 여러 개의 레인을 한꺼번에 모아 `{트랙 번호: [레인]}`으로 돌려줍니다. |
| `list_lanes(db, user, track_id)` | 한 트랙의 레인 목록을 돌려줍니다. 프로젝트 멤버면 누구나 읽습니다. |
| `save_lane(db, user, track_id, data)` | 대상 하나의 곡선을 통째로 저장합니다. 점이 없으면 레인을 지웁니다. |

저장은 "점을 통째로 바꾸기"입니다. 화면은 점을 끌 때마다 전체 곡선을 보내므로, 서버가 점 하나씩 비교하지 않고 기존 점을 모두 지운 뒤 새 점을 넣는 쪽이 단순하고 안전합니다.

```text
save_lane
  1. 트랙을 찾고, 프로젝트 멤버인지 확인, OWNER 또는 EDITOR 만 통과
  2. target_type 에 따라 검사
       INSTRUMENT_PARAM: track_instrument_id 와 param_index 필수, 그 악기가 이 트랙 소속이어야 함
       DEVICE_PARAM:     track_plugin_id 와 param_index 필수, 그 이펙트가 이 트랙 소속이어야 함
       VOLUME, PAN:      장치와 칸 번호는 무시 (null 로 둠)
  3. (트랙, 종류, 이펙트, 악기, 칸) 이 같은 레인을 찾음
  4. points 가 비어 있으면: 레인이 있으면 지우고 None
  5. 레인이 없으면 만들고, 점을 모두 지운 뒤 tick 순으로 다시 넣음
```

## 2. 언제 쓰나

| 쓰는 곳 | 하는 일 |
|---|---|
| `GET /tracks/{id}/automation` | `list_lanes`를 부릅니다. |
| `PUT /tracks/{id}/automation` | `save_lane`을 부릅니다. |
| `GET /projects/{id}/full` | `lanes_for_tracks`로 프로젝트 전체의 레인을 한 번에 가져옵니다 (318). |

## 3. 코드

```python
def lanes_for_tracks(db: Session, track_ids: list[int]) -> dict[int, list[AutomationLaneResponse]]:
    if not track_ids:
        return {}
    lanes = db.scalars(
        select(AutomationLane)
        .where(AutomationLane.track_id.in_(track_ids))
        .order_by(AutomationLane.lane_id)
    ).all()
    if not lanes:
        return {}
    points = db.scalars(
        select(AutomationPoint)
        .where(AutomationPoint.lane_id.in_([ln.lane_id for ln in lanes]))
        .order_by(AutomationPoint.lane_id, AutomationPoint.tick)
    ).all()
    by_lane: dict[int, list[AutomationPoint]] = {}
    for p in points:
        by_lane.setdefault(p.lane_id, []).append(p)
    out: dict[int, list[AutomationLaneResponse]] = {}
    for ln in lanes:
        out.setdefault(ln.track_id, []).append(_lane_response(ln, by_lane.get(ln.lane_id, [])))
    return out
```

레인과 점을 각각 쿼리 한 번으로 가져오므로, 트랙이 많아도 쿼리 수가 늘지 않습니다. 점은 `tick` 순으로 정렬해 돌려줍니다.

```python
def save_lane(db, user, track_id, data):
    track = track_service.require_track(db, user, track_id)
    _project, member = project_service.get_membership(db, track.project_id, user)
    project_service.require_role(member, MemberRole.OWNER, MemberRole.EDITOR)

    plugin_id = None
    instrument_id = None
    param_index = None
    if data.target_type == AutomationTarget.INSTRUMENT_PARAM:
        if data.track_instrument_id is None or data.param_index is None:
            raise AppError(ErrorCode.VALIDATION_ERROR, 400,
                           "Instrument automation needs track_instrument_id and param_index.")
        owner = db.scalar(select(TrackInstrument.track_id).where(
            TrackInstrument.track_instrument_id == data.track_instrument_id))
        if owner != track_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, 400, "The instrument is not on this track.")
        instrument_id = data.track_instrument_id
        param_index = data.param_index
    elif data.target_type == AutomationTarget.DEVICE_PARAM:
        ...  # 위와 같은 모양: track_plugin_id 와 TrackPlugin 으로 검사

    # (트랙, 종류, 이펙트, 악기, 칸) 이 같은 레인 찾기: None 은 IS NULL 로 비교
    lane = db.scalars(query).first()

    if not data.points:
        if lane is not None:
            db.delete(lane)
            db.commit()
        return None
    if lane is None:
        lane = AutomationLane(track_id=track_id, target_type=data.target_type,
                              track_plugin_id=plugin_id, track_instrument_id=instrument_id,
                              param_index=param_index)
        db.add(lane)
        db.flush()
    lane.is_enabled = data.is_enabled
    db.execute(delete(AutomationPoint).where(AutomationPoint.lane_id == lane.lane_id))
    rows = [AutomationPoint(lane_id=lane.lane_id, tick=p.tick, value=p.value, curve=p.curve)
            for p in sorted(data.points, key=lambda p: p.tick)]
    db.add_all(rows)
    db.commit()
    ...
    return _lane_response(lane, rows)
```

| 규칙 | 이유 |
|---|---|
| 소속 트랙 확인 | 다른 트랙의 악기나 이펙트 번호를 보내 남의 데이터에 레인을 붙이는 것을 막고, 외래 키 오류(500) 대신 400을 돌려줍니다. |
| `VOLUME`, `PAN`은 장치와 칸을 무시 | 화면이 실수로 보내도 같은 대상의 레인이 둘로 갈라지지 않습니다. |
| 점을 `tick` 순으로 저장 | 재생이 이진 탐색이 아니라 순서대로 읽어도 되게 합니다. |
| 점이 비면 레인 삭제 | 별도의 DELETE 주소 없이 "비우기"를 표현합니다. |

## 4. 흔한 질문

Q. 두 사람이 동시에 같은 레인을 저장하면 어떻게 되나요?
A. 나중에 저장한 쪽의 곡선이 남습니다. 협업 편집 충돌 처리는 Phase 3의 범위입니다.
