# 백엔드 316 — 오토메이션 모델과 스키마 (`models/automation.py`, `schemas/automation.py`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/models/automation.py`, `studionx/backend/app/schemas/automation.py` |
| 작업 | S1-15 오토메이션과 페이드: 트랙 파라미터를 시간에 따라 바꾸는 곡선을 담는 테이블과 요청, 응답 모양 |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 없음 (S1-15의 첫 문서), 다음 317 오토메이션 서비스 |

## 1. 하는 일

오토메이션은 "재생하는 동안 볼륨이나 노브 값을 곡선대로 움직이는" 기능입니다. 곡선 하나는 대상 하나에 속하므로 두 테이블로 나눕니다.

| 테이블 | 한 줄의 뜻 | 주요 칸 |
|---|---|---|
| `automation_lanes` | 레인: 트랙의 대상 하나 | `track_id`, `target_type`, `track_plugin_id`, `track_instrument_id`, `param_index`, `is_enabled` |
| `automation_points` | 레인 위의 점 하나 | `lane_id`, `tick`, `value`, `curve` |

`target_type`은 네 가지입니다.

| 값 | 대상 | 같이 쓰는 칸 |
|---|---|---|
| `VOLUME` | 트랙 볼륨(dB) | 없음 |
| `PAN` | 트랙 팬(-1~1) | 없음 |
| `INSTRUMENT_PARAM` | 악기 층의 노브 | `track_instrument_id`, `param_index` |
| `DEVICE_PARAM` | 이펙트 장치의 노브 | `track_plugin_id`, `param_index` |

악기와 이펙트는 서로 다른 테이블(`track_instruments`, `track_plugins`)에 있으므로, 레인도 외래 키를 둘로 나눕니다. 처음에는 `track_plugin_id` 하나로 둘 다 가리키려 했지만, 악기 번호를 넣으면 외래 키 오류로 500이 났습니다 (2026-11-15에 `track_instrument_id`를 추가해 고쳤습니다).

점의 `value`는 화면 비율이 아니라 실제 단위로 저장합니다 (볼륨은 dB, 팬은 -1~1, 노브는 그 노브의 값). `curve`는 이 점에서 다음 점까지의 휘어짐(-1~1)입니다.

## 2. 언제 쓰나

| 쓰는 곳 | 하는 일 |
|---|---|
| 317 서비스 | 레인과 점을 읽고 쓸 때 이 모델을 씁니다. |
| 318 API | 요청과 응답 검증에 스키마를 씁니다. |
| 프로젝트 삭제, 트랙 삭제 | `ondelete="CASCADE"`로 레인과 점이 함께 지워집니다. |

## 3. 코드

### 3.1 모델 (`models/automation.py`)

```python
class AutomationTarget(StrEnum):
    VOLUME = "VOLUME"
    PAN = "PAN"
    INSTRUMENT_PARAM = "INSTRUMENT_PARAM"
    DEVICE_PARAM = "DEVICE_PARAM"


class AutomationLane(Base):
    __tablename__ = "automation_lanes"

    lane_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    track_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tracks.track_id", ondelete="CASCADE")
    )
    target_type: Mapped[AutomationTarget] = mapped_column(Enum(AutomationTarget))
    track_plugin_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("track_plugins.track_plugin_id", ondelete="CASCADE")
    )
    track_instrument_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("track_instruments.track_instrument_id", ondelete="CASCADE")
    )
    param_index: Mapped[int | None] = mapped_column(SMALLINT(unsigned=True))
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("1"))
    # created_at, updated_at 생략


class AutomationPoint(Base):
    __tablename__ = "automation_points"

    point_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lane_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("automation_lanes.lane_id", ondelete="CASCADE")
    )
    tick: Mapped[int] = mapped_column(INTEGER(unsigned=True))
    value: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    curve: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("0.00"))
```

`tick`은 960 PPQ 기준이며, 4/4박자에서 한 마디가 3840입니다. `value`는 소수 넷째 자리까지, `curve`는 둘째 자리까지 저장합니다.

### 3.2 스키마 (`schemas/automation.py`)

```python
POINTS_MAX = 5000


class AutomationPointInput(BaseModel):
    tick: Annotated[int, Field(ge=0)]
    value: Annotated[Decimal, Field(ge=-100000, le=100000, decimal_places=4)]
    curve: Annotated[Decimal, Field(ge=-1, le=1, decimal_places=2)] = Decimal("0.00")


class AutomationPointItem(AutomationPointInput):
    model_config = ConfigDict(from_attributes=True)
    point_id: int


class AutomationLaneSaveRequest(BaseModel):
    target_type: AutomationTarget
    track_plugin_id: Annotated[int, Field(ge=1)] | None = None
    track_instrument_id: Annotated[int, Field(ge=1)] | None = None
    param_index: Annotated[int, Field(ge=0, le=65535)] | None = None
    is_enabled: bool = True
    points: list[AutomationPointInput] = Field(default_factory=list, max_length=POINTS_MAX)


class AutomationLaneResponse(BaseModel):
    lane_id: int
    track_id: int
    target_type: AutomationTarget
    track_plugin_id: int | None
    track_instrument_id: int | None
    param_index: int | None
    is_enabled: bool
    points: list[AutomationPointItem]
```

| 검증 | 값 | 이유 |
|---|---|---|
| `points` 개수 | 최대 5000 | 한 번의 저장이 지나치게 커지는 것을 막습니다. |
| `curve` | -1~1, 소수 둘째 자리 | 화면 곡선과 같은 범위입니다. |
| `value` | ±100000, 소수 넷째 자리 | 어떤 노브 값도 담기는 넉넉한 범위입니다. |
| `points`가 빈 목록 | 허용 | "이 레인을 지운다"는 뜻으로 씁니다 (317). |

## 4. 흔한 질문

Q. 왜 레인 번호가 아니라 "대상"으로 저장하나요?
A. 화면이 "이 트랙의 이 노브" 단위로 곡선을 편집하기 때문입니다. 같은 대상의 레인은 하나뿐이므로, 요청에 대상만 적으면 서버가 레인을 찾거나 만듭니다.
