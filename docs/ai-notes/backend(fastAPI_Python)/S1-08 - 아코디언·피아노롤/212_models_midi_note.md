# Backend(FastAPI/Python) 212 — `MidiNote`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/models/midi_note.py` |
| 작업 | S1-08 아코디언·피아노롤: `midi_notes` 표 (PRD 02 FR-231, FR-232) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 211 `Pattern` · 213 패턴 스키마 |

## 1. 하는 일
피아노롤에서 찍은 노트 한 건을 담습니다. 어느 패턴에 속하는지(`pattern_id`)와 음높이·시작 위치·길이·세기를 가집니다. 겹쳐 찍은 노트(FR-2317)는 같은 음높이·위치로 여러 행이 생깁니다.

| 칸 | 뜻 |
|---|---|
| `note_id` | 노트 번호 (자동 증가) |
| `pattern_id` | 어느 패턴의 노트인지 (패턴을 지우면 함께 지워짐) |
| `pitch` | 음높이 0~127 (60 = C4) |
| `velocity` | 세기 1~127 (기본 100) |
| `start_tick` | 시작 위치 (1박 = 960 tick) |
| `length_tick` | 길이 (tick) |
| `channel` | MIDI 채널 0~15 (기본 0) |
| `release_velocity` | 뗄 때 세기 (기본 64) |
| `is_muted` | 소리 끔 (기본 아님) |
| `probability` | 소리 낼 확률 0.00~1.00 (기본 1.00) |
| `velocity_deviation` | 세기 흔들림 (기본 0) |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `pattern_service._notes` (214) | 패턴의 노트를 시작 위치·음높이 차례로 읽습니다 |
| `replace_notes` (215) | 지금 노트를 지우고 보낸 목록을 새로 넣습니다 |
| 피아노롤 (sequencer-roll.js) | `start_tick`·`length_tick`·`pitch`·`velocity` 이름을 화면과 그대로 맞춥니다 |

## 3. 코드
**import** (파일 맨 위)
```python
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, ForeignKey, Numeric, text
from sqlalchemy.dialects.mysql import INTEGER, TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.pattern import Pattern
```
```python
class MidiNote(Base):
    __tablename__ = "midi_notes"

    note_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pattern_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("patterns.pattern_id", ondelete="CASCADE")
    )
    pitch: Mapped[int] = mapped_column(TINYINT(unsigned=True))
    velocity: Mapped[int] = mapped_column(TINYINT(unsigned=True), server_default=text("100"))
    start_tick: Mapped[int] = mapped_column(INTEGER(unsigned=True))
    length_tick: Mapped[int] = mapped_column(INTEGER(unsigned=True))
    channel: Mapped[int] = mapped_column(TINYINT(unsigned=True), server_default=text("0"))
    release_velocity: Mapped[int] = mapped_column(TINYINT(unsigned=True), server_default=text("64"))
    is_muted: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    probability: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default=text("1.00"))
    velocity_deviation: Mapped[int] = mapped_column(
        TINYINT(unsigned=True), server_default=text("0")
    )

    pattern: Mapped["Pattern"] = relationship(back_populates="notes")
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `TINYINT(unsigned=True)` | 0~255 작은 정수입니다. pitch·velocity·channel 이 여기 들어갑니다 |
| `Boolean` | 참·거짓입니다. DB 에는 `TINYINT(1)` 로 들어갑니다 |
| `Numeric(3, 2)` | `probability` 0.00~1.00 을 담습니다 |
| `server_default=text("100")` | 값을 안 주면 DB 가 채웁니다(예: velocity 100) |
| `relationship(back_populates="notes")` | 211 의 `Pattern.notes` 와 짝을 이룹니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 노트를 통째로 갈아 끼움 | 피아노롤은 한 번의 편집으로 여러 노트가 바뀝니다(겹침·이동). 노트마다 번호를 주고받기보다 목록 전체를 다시 보내는 편이 간단하고 어긋날 일이 없습니다 (215) |
| `probability`·`velocity_deviation`·`is_muted` 미리 둠 | 당장은 안 쓰지만 FR-232 의 노트 설정을 담을 칸을 지금 만들어 둡니다 |
| `release_velocity` 기본 64 | 못 박은 소리를 막기 위한 중간값입니다 |

## 5. 시험
`tests/test_pattern_model.py` 에서 `midi_notes` 표가 DB 와 같은지, 관계·기본값을 확인했습니다. 통과합니다.
