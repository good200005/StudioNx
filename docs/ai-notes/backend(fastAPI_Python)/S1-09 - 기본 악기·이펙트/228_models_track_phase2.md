# Backend(FastAPI/Python) 228 — `Track` Phase 2 칸 · `RoutingMode`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/models/track.py` |
| 작업 | S1-09 기본 악기·이펙트: 트랙 헤더 믹서와 라우팅 방식 칸 (PRD 02 FR-251, FR-252, FR-269) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 227 `TrackInstrument` · `TrackPlugin` · 229 플러그인 스키마 |

## 1. 하는 일
`tracks` 표에 Phase 2 에서 쓰는 칸을 모두 채웠습니다. Phase 1 에서는 프로젝트를 만들 때 MASTER 트랙 한 줄을 넣는 데만 썼는데(PRD 01 FR-122), 이제 트랙 헤더의 믹서(볼륨·팬·뮤트·솔로), 라우팅 방식, 갈래 자리까지 다룹니다.

| 새로 쓴 칸 | 뜻 |
|---|---|
| `color` | 트랙 색 `#RRGGBB`, 기본 `#7C5CFF` |
| `volume_db`, `pan` | 페이더(-60.00~+6.00 dB)와 좌우 위치(-1.00~1.00), DECIMAL(5,2)·(3,2) |
| `is_muted`, `is_solo`, `is_enabled` | 소리 끄기, 솔로, 트랙 자체를 멈춤. `is_enabled` 가 0이면 처리를 아예 쉽니다 |
| `parent_track_id` | 그룹 트랙에 속한 트랙 (그룹을 지우면 NULL, FR-252) |
| `frozen_sample_id` | 프리즈 결과 오디오. 값이 있으면 악기·이펙트 처리를 쉬고 이 오디오를 재생합니다 |
| `routing_mode` | `CHAIN`(일렬 체인) 또는 `PATCHER`(갈래 구성), 기본 `CHAIN` (FR-267) |
| `assignee_id`, `locked_by`, `locked_at` | 담당 멤버와 잠금 정보 (Phase 6 용, 지금은 응답에만 담깁니다) |

`RoutingMode` 는 이 표에서만 쓰는 열거형입니다. 화면은 이 값을 보고 [Effects] 칸을 체인으로 그릴지 갈래 카드로 그릴지 정합니다 (FR-262·267).

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `track_service.list_tracks` · `create_track` · `require_track` · `update_track` (233) | 트랙 한 줄을 읽고 만들고 고칩니다 |
| `track_service.add_effect` (235) | 이펙트를 붙일 때 `node_x`·`node_y`(갈래 자리)를 함께 담습니다 |
| `GET /tracks/{id}/...` 응답 (238~241) | `TrackResponse` 가 이 칸들을 그대로 내보냅니다 |
| S1-10 저장·불러오기 | 트랙과 라우팅 방식을 함께 저장하고 되살립니다 (FR-254) |

## 3. 코드
**열거형**
```python
class TrackType(StrEnum):
    AUDIO = "AUDIO"
    MIDI = "MIDI"
    MASTER = "MASTER"
    GROUP = "GROUP"
    RETURN = "RETURN"


class RoutingMode(StrEnum):
    """이펙트 배치 방식. CHAIN 은 한 줄(직렬), PATCHER 는 갈래(병렬)가 있는 구성 (FR-267)."""

    CHAIN = "CHAIN"
    PATCHER = "PATCHER"
```

**칸**
```python
    order_index: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    color: Mapped[str] = mapped_column(String(7), server_default=text("'#7C5CFF'"))
    volume_db: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default=text("0.00"))
    pan: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("0.00"))
    is_muted: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    is_solo: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("1"))
    parent_track_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("tracks.track_id", ondelete="SET NULL")
    )
    frozen_sample_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("samples.sample_id", ondelete="SET NULL")
    )
    routing_mode: Mapped[RoutingMode] = mapped_column(Enum(RoutingMode), server_default=RoutingMode.CHAIN)
```

**자식 관계 (S1-09 에서 추가)**
```python
    instruments: Mapped[list["TrackInstrument"]] = relationship(
        back_populates="track",
        order_by="TrackInstrument.slot_index",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    plugins: Mapped[list["TrackPlugin"]] = relationship(
        back_populates="track", order_by="TrackPlugin.slot_index",
        cascade="all, delete-orphan", passive_deletes=True,
    )
    plugin_links: Mapped[list["TrackPluginLink"]] = relationship(
        back_populates="track", cascade="all, delete-orphan", passive_deletes=True
    )
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `server_default=text("'#7C5CFF'")` | 작은따옴표가 두 번 겹친 이유는, 바깥따옴표 안의 `#7C5CFF` 를 SQL 문자열로 넘기기 위해서입니다 |
| `Numeric(5, 2)` | 소수 둘째 자리까지입니다. 볼륨 -60.00~+6.00 dB 를 담습니다 |
| `ondelete="SET NULL"` | 부모가 지워지면 이 칸만 비웁니다. 그룹이 사라져도 트랙은 남습니다 (FR-252) |
| `parent_track_id` 가 자기 표를 가리킴 | 같은 표를 다시 가리키는 self 참조입니다. 그룹과 그 안의 트랙을 같은 표에서 다룹니다 |
| `order_by="TrackInstrument.slot_index"` | 관계로 읽을 때 칸 번호 순으로 정렬합니다. 문자열 이름이라 모델 사이 순환을 피합니다 |
| `cascade="all, delete-orphan"` + `passive_deletes=True` | 앱은 자식을 기억만 하고, 실제 삭제는 DB CASCADE 가 합니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `routing_mode` 를 트랙에 둠 | 갈래(패처) 구성은 트랙 단위로 정해집니다. 이펙트마다 정하면 한 트랙 안에서 두 방식이 섞입니다 (FR-267) |
| `is_enabled` 와 `is_muted` 를 나눔 | `is_muted` 는 소리만 끄고 처리는 계속합니다. `is_enabled` 는 처리를 아예 멈춥니다 (DB.md 설명과 같습니다) |
| `assignee_id`·`locked_by` 를 지금 채움 | Phase 6 협업 칸이지만 DB.md 에 이미 있는 칸입니다. 응답 모양을 나중에 바꾸지 않으려고 지금 채웠습니다 |
| MASTER 트랙을 별도 표가 아니라 `track_type` 으로 | 마스터도 트랙과 똑같이 볼륨·이펙트·라우팅을 가집니다. 표를 나누면 같은 기능을 두 번 만들어야 합니다 (FR-252) |

## 5. 시험
`tests/test_track_model.py` 가 `tracks` 칸을 실제 MySQL 과 비교하고, Phase 2 칸의 DB 기본값(색 `#7C5CFF`, 볼륨 0.00, `routing_mode` = `CHAIN`)과 프로젝트를 지우면 트랙이 함께 지워지는지 확인합니다. `tests/test_track_routes.py` 는 만들기·수정 응답의 기본값을 확인합니다.
