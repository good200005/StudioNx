# Backend(FastAPI/Python) 177 — `Sample` 모델 컬럼

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/models/sample.py` |
| 작업 | S1-07 샘플 라이브러리: ORM 모델 컬럼 (`docs/DB.md` §3.2, `studionx/db/02_phase2_sequencer.sql`) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [176 `initResetForm()`](<../../javascript/P1-28 - 비밀번호 찾기/176_reset_initResetForm.md>) · [178 `Tag` 모델](178_models_tag.md) |

## 1. 하는 일
MySQL의 `samples` 테이블(사용자가 올린 샘플 파일 한 건의 정보)을 파이썬 클래스 `Sample`로 옮겨 적습니다. 그러면 SQL 문 대신 파이썬 코드로 샘플을 읽고 쓸 수 있습니다.

| SQL | 파이썬 (이 클래스가 있으면) |
|---|---|
| `SELECT * FROM samples WHERE sample_id = 3` | `db.get(Sample, 3)` |
| `source` 칸 읽기 | `sample.source`는 `SampleSource.UPLOAD` |
| `INSERT INTO samples (owner_id, …) VALUES (…)` | `db.add(Sample(owner_id=…, …))` |

**테이블은 이 클래스가 만들지 않습니다.** 테이블은 `studionx/db/02_phase2_sequencer.sql`로 이미 만들어져 있고, 이 클래스는 그 모양을 그대로 따라 적은 것입니다. 파일 자체는 디스크에 있고(경로 규칙 `samples/{owner_id}/{uuid}.{확장자}`), 이 행은 그 정보와 파형 파일 경로만 가집니다.

## 2. 언제 쓰나
샘플을 다루는 S1-07의 모든 백엔드 코드가 이 클래스를 씁니다.

| 쓰는 곳 | 읽거나 쓰는 칸 |
|---|---|
| S1-07 업로드 (FR-221 ~ 223) | `owner_id`, `name`, `original_filename`, `file_path`, `mime_type`, `file_size`를 넣고, 올릴 때 파일에서 읽은 `duration_ms`, `sample_rate`, `channels`, `waveform_path`를 채웁니다 |
| S1-07 라이브러리 목록 (FR-224) | `owner_id`로 거르고 `name`으로 찾으며, `deleted_at`이 비어 있는 행만 보여 줍니다 |
| S1-07 이름 변경, 삭제 (FR-225) | `name`을 고치고, 삭제할 때 `deleted_at`을 기록합니다(소프트 삭제) |
| S1-07 저장 용량 (FR-227) | 올리기 전 `file_size`의 합으로 남은 용량을 확인합니다 |
| 뒤 작업 (S1-10 등) | `clips.sample_id`와 `tracks.frozen_sample_id`가 이 행의 `sample_id`를 가리킵니다 |

## 3. 코드
**import** (파일 맨 위)
```python
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Enum, FetchedValue, ForeignKey, Numeric, String, text
from sqlalchemy.dialects.mysql import DATETIME, INTEGER, TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:  # 타입 표시용 (실행 중에는 불러오지 않음 — 순환을 피함)
    from app.models.tag import Tag
```

| import | 가져오는 것 | 쓰는 곳 |
|---|---|---|
| `datetime`, `Decimal` | 날짜 시각 타입, 소수 타입 | 시각 칸, `bpm` |
| `StrEnum` | 값이 문자열인 열거형 | `SampleSource` |
| `BigInteger`, `String`, `Numeric` | SQL의 `BIGINT`, `VARCHAR(n)`, `DECIMAL(6,2)` | 숫자·글자·소수 칸 |
| `Enum` | SQL의 `ENUM(…)` | `source` |
| `text` | SQL 문장을 그대로 넘깁니다 | 기본값 `CURRENT_TIMESTAMP(3)` |
| `FetchedValue` | "DB가 값을 바꾼다"는 표시 | `updated_at` |
| `ForeignKey` | 다른 테이블을 가리킴 | `owner_id` → `users` |
| `INTEGER`, `TINYINT` (MySQL 전용) | 부호 없는 정수 (`INT UNSIGNED`, `TINYINT UNSIGNED`) | `duration_ms`, `sample_rate`, `channels` |
| `DATETIME` (MySQL 전용) | 밀리초까지 저장하는 `DATETIME(3)` | 시각 칸 |
| `TYPE_CHECKING` | 실행 중에는 안 불러오고 타입 검사 때만 불러옴 | `Tag` 순환 import 회피 |
| `relationship` | FK를 파이썬 속성으로 오가게 함 | `sample.tags` |

**클래스** (칸 선언)
```python
class SampleSource(StrEnum):
    UPLOAD = "UPLOAD"
    SEPARATION = "SEPARATION"
    EXPORT = "EXPORT"
    RECORDING = "RECORDING"
    BOUNCE = "BOUNCE"
    RESAMPLE = "RESAMPLE"


class Sample(Base):
    __tablename__ = "samples"

    sample_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), index=True)

    name: Mapped[str] = mapped_column(String(200))
    original_filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    mime_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(BigInteger)

    duration_ms: Mapped[int | None] = mapped_column(INTEGER(unsigned=True))
    sample_rate: Mapped[int | None] = mapped_column(INTEGER(unsigned=True))
    channels: Mapped[int | None] = mapped_column(TINYINT(unsigned=True))
    bpm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    music_key: Mapped[str | None] = mapped_column(String(10))
    waveform_path: Mapped[str | None] = mapped_column(String(500))

    source: Mapped[SampleSource] = mapped_column(Enum(SampleSource), server_default=SampleSource.UPLOAD)
    created_at: Mapped[datetime] = mapped_column(DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"))
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"), server_onupdate=FetchedValue()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DATETIME(fsp=3))

    tags: Mapped[list["Tag"]] = relationship(secondary="sample_tags", back_populates="samples")
```

### SQL과 한 줄씩 비교
| SQL (`02_phase2_sequencer.sql`) | 파이썬 |
|---|---|
| `sample_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT` `PRIMARY KEY` | `BigInteger`, `primary_key=True`, `autoincrement=True` |
| `owner_id BIGINT UNSIGNED NOT NULL` + `KEY idx_samples_owner` | `ForeignKey("users.user_id")`, `index=True` |
| `name VARCHAR(200) NOT NULL` | `Mapped[str]`, `String(200)` |
| `duration_ms INT UNSIGNED NULL` | `Mapped[int \| None]`, `INTEGER(unsigned=True)` |
| `channels TINYINT UNSIGNED NULL` | `Mapped[int \| None]`, `TINYINT(unsigned=True)` |
| `bpm DECIMAL(6,2) NULL` | `Mapped[Decimal \| None]`, `Numeric(6, 2)` |
| `source ENUM(…) NOT NULL DEFAULT 'UPLOAD'` | `Enum(SampleSource)`, `server_default=SampleSource.UPLOAD` |
| `updated_at … ON UPDATE CURRENT_TIMESTAMP(3)` | `server_default=text(…)`, `server_onupdate=FetchedValue()` |
| `deleted_at DATETIME(3) NULL` | `Mapped[datetime \| None]`, `DATETIME(fsp=3)` |

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `INTEGER(unsigned=True)` | `INT UNSIGNED`입니다. **SQLAlchemy의 기본 `Integer`는 `unsigned` 인자를 받지 않아** 오류가 납니다. 그래서 MySQL 전용 타입을 씁니다 |
| `Numeric(6, 2)` | `DECIMAL(6,2)`입니다. 합계 6자리, 소수 2자리이며, 읽으면 파이썬 `Decimal`이 됩니다 |
| `Mapped[str \| None]` | `None`이 없으면 `NOT NULL`, 있으면 `NULL`을 허용합니다 |
| `server_default=…` | 값을 넣지 않으면 **DB가** 채우는 기본값입니다 |
| `relationship(secondary=…, back_populates=…)` | 중간 표(`sample_tags`)를 거치는 다대다 관계입니다. `back_populates`는 반대쪽 `Tag.samples`와 짝을 이룹니다 |

## 4. 흐름 (샘플 하나를 올릴 때, FR-221 ~ 223)
1. 파일을 디스크에 `samples/{owner_id}/{uuid}.wav`로 저장합니다.
2. 파일에서 `duration_ms`, `sample_rate`, `channels`를 읽고(180), 파형 미리보기 데이터를 만들어 `waveform_path`를 정합니다. 읽지 못하는 파일은 업로드 단계에서 415로 거부합니다.
3. `Sample(owner_id=…, name=…, original_filename=…, file_path=…, mime_type=…, file_size=…)`를 만들어 `db.add`하고 `db.flush`합니다.
4. DB가 `sample_id`, `source=UPLOAD`, `created_at`을 채웁니다. `db.refresh`로 다시 읽으면 `sample.source`는 `SampleSource.UPLOAD`입니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 부호 없는 정수는 MySQL 전용 타입으로 | `Integer(unsigned=True)`는 `TypeError`로 거부됩니다(Dialect 기본 타입이 `unsigned`를 받지 않습니다). `db/`의 DDL과 타입을 정확히 맞추려면 `INTEGER(unsigned=True)`를 써야 합니다. 앞선 Phase 1 모델(track.py 등)도 `TINYINT(unsigned=True)`를 같은 방식으로 씁니다 |
| 올릴 때 읽는 칸은 `NULL` 허용 | `duration_ms`, `sample_rate`, `channels`, `bpm`, `music_key`, `waveform_path`는 파일을 읽어야 채워집니다. DB에서는 비워 둘 수 있게 했지만, 읽지 못하는 파일은 업로드 단계에서 415로 거부하므로(180) 실제 업로드에서는 비어 있지 않습니다. `bpm`, `music_key`는 채우는 작업이 뒤에 있어 지금은 비어 있습니다 |
| 삭제는 `deleted_at` (소프트 삭제) | 이미 만든 클립이 이 샘플을 가리킬 수 있어(`clips.sample_id`), 행을 지우면 클립이 끊깁니다. 그래서 지운 표시만 하고 목록에서 뺍니다 (FR-225) |
| 태그만 관계로 연결 | 지금 필요한 것은 태그뿐입니다(FR-224·225). `owner`나 `clips` 같은 관계는 쓸 곳이 생길 때 넣습니다 |
| `bpm`은 `Numeric` | DDL이 `DECIMAL(6,2)`이고, 반올림 오차 없이 정확한 소수를 쓰기 위함입니다 (`128.00`) |

## 6. 시험 (`tests/test_sample_model.py` 새 파일, 5개)
**실제 MySQL**의 `samples` 테이블과 비교했습니다. 넣은 행은 시험이 끝나면 되돌리므로(rollback) DB에 남지 않습니다.

| 시험 | 확인한 것 |
|---|---|
| 칸이 DB와 같은지 | 칸 이름과 순서, `NULL` 허용 여부, `owner_id` → `users` FK가 실제 테이블과 같습니다 |
| 기본값과 비어 있는 칸 | 5칸만 넣고 저장하면 `source`는 `UPLOAD`, `created_at`은 채워지고, `deleted_at`과 metadata 6칸은 비어 있습니다 |
| metadata 값 저장 | `duration_ms=1500`, `sample_rate=48000`, `channels=2`, `bpm='128.00'`, `music_key='Am'`, `waveform_path`를 넣으면 그대로 읽힙니다 |
| 소프트 삭제 | `deleted_at`을 기록해도 행은 남습니다 |
| 소유자 삭제 차단 | FK에 `ON DELETE`가 없어서, 소유자 행을 지우려 하면 DB가 막습니다(`IntegrityError`) |

전체 시험 871개가 통과했고, `ruff` 검사도 통과했습니다.
