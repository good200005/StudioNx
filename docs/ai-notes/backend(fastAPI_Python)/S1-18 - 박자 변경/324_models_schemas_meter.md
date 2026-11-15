# 백엔드 324 — 박자 변경점 모델과 스키마 (`models/meter_change.py`, `schemas/meter.py`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/models/meter_change.py`, `studionx/backend/app/schemas/meter.py` |
| 작업 | S1-18 박자 줄: 곡 중간의 박자 변경점을 저장하는 표와 요청, 응답 모양 (FR-202b) |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 323 템포 줄, 다음 325 박자 서비스 |

## 1. 하는 일

`meter_changes` 표는 이미 DB에 있었고(`db/02_phase2_sequencer.sql`), 이를 읽고 쓰는 모델과 API 모양이 없었습니다. 이번에 템포 변경점(S1-13)과 같은 구조로 만들었습니다.

| 이름 | 뜻 |
|---|---|
| `MeterChange` | 표의 한 행입니다. `tick`(위치), `time_sig_num`(분자), `time_sig_den`(분모)을 가집니다. |
| `MeterChangeInput` | 화면이 보내는 변경점 한 건입니다. |
| `MeterChangeItem` | 응답의 한 건입니다. 입력에 `meter_change_id`를 더했습니다. |
| `MeterChangesSaveRequest` | `PUT` 본문입니다. 목록 전체를 담고, 같은 위치가 둘이면 거부합니다. |
| `MeterChangesResponse` | `{ items, total }`, tick 오름차순입니다. |

시작 박자(`tick` 0)는 `projects.time_sig_num/den`이므로 이 표에는 넣지 않습니다. 그래서 `tick`은 1 이상입니다.

## 2. 코드

```python
MeterTick = Annotated[int, Field(ge=1, le=4294967295)]
MeterNum = Annotated[int, Field(ge=1, le=32)]      # DB CHECK 와 같음
MeterDen = Literal[1, 2, 4, 8, 16, 32]              # DB CHECK 와 같음

class MeterChangesSaveRequest(BaseModel):
    changes: list[MeterChangeInput] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def no_duplicate_ticks(self):
        ticks = [c.tick for c in self.changes]
        if len(ticks) != len(set(ticks)):
            raise ValueError("meter changes must have distinct ticks")
        return self
```

| 규칙 | 이유 |
|---|---|
| 분모를 `Literal`로 제한 | DB의 `chk_meter_den`과 같은 값만 받아, DB 오류(500) 대신 422로 돌려줍니다. |
| 중복 위치 거부 | DB의 `UNIQUE(project_id, tick)`과 같은 규칙을 요청 단계에서 먼저 확인합니다. |
| 목록 최대 500개 | 한 번에 보내는 양을 제한합니다. 템포 변경점과 같은 값입니다. |

## 3. Q&A

Q. 왜 PATCH가 아니라 목록 전체를 보내나요?
A. 화면이 점을 끌거나 지울 때마다 모양이 달라지므로, 한 건씩 보내면 순서와 중복을 맞추기 어렵습니다. 통째로 교체하면 서버와 화면의 목록이 항상 같습니다.

Q. 시작 박자는 어디에 있나요?
A. `projects` 표의 `time_sig_num`, `time_sig_den`입니다. 상단 설정에서 바꾸고, 이 표에는 그 뒤의 변경점만 둡니다.
