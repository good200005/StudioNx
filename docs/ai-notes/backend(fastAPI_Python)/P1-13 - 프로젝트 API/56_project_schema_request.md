# Backend(FastAPI/Python) 56 — `ProjectCreateRequest` · `ProjectUpdateRequest` (프로젝트 요청 스키마)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/schemas/project.py` |
| 작업 | P1-13 프로젝트 API — 만들기 · 수정 요청 본문 검사 · PRD 01 FR-122 · FR-124 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [55 `retention.main()`](<../P1-12 - 문의 API/55_retention_main.md>) · [57 `get_membership` · `require_role`](57_project_service_membership.md) |

## 1. 하는 일
새 프로젝트 모달 · Edit details 모달이 보낸 값을 **저장하기 전에** 검사한다. 틀리면 422 `VALIDATION_ERROR` (P1-03 처리기).

| 보낸 값 | 결과 |
|---|---|
| `{"title": "  My Song  "}` | 통과 — 제목 `"My Song"`, 설명 없음, BPM 120, 4/4 |
| 제목 `""` · `"   "` · 101자 | 422 |
| 설명 `"   "` | 통과 — 설명 **없음**(None) |
| 박자 `7/8` (`time_sig_num=7, time_sig_den=8`) | 통과 |
| 박자 아래 숫자 `3` · `12` · `64` | 422 — 1 · 2 · 4 · 8 · 16 · 32 만 |
| 수정 `{"title": null}` | 422 — 제목은 비울 수 없음 |
| 수정 `{}` | 통과 — 아무것도 바꾸지 않음 |
| 수정 `{"description": ""}` 또는 `null` | 통과 — 설명 지움 |

## 2. 언제 쓰나
| 요청 | 스키마 | 화면 |
|---|---|---|
| `POST /api/v1/projects` | `ProjectCreateRequest` | myProject.html 새 프로젝트 모달 (P1-14) |
| `PATCH /api/v1/projects/{id}` | `ProjectUpdateRequest` | Edit details 모달 (P1-14) |

FastAPI 가 라우터 인자의 타입을 보고 자동으로 검사한다. 서비스(58 · 59)는 이미 검사 · 정리된 값을 받는다.

## 3. 코드
**import · 상수** (파일 맨 위)
```python
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

PROJECT_PAGE_SIZE_MAX = 50  # 한 번에 받을 수 있는 최대 개수 (화면은 10)
PROJECT_TITLE_MAX = 100  # 화면 #new-title · #edit-title maxlength 와 같음
PROJECT_DESCRIPTION_MAX = 500  # 화면 #new-description · #edit-description maxlength 와 같음
TIME_SIG_DENOMINATORS = (1, 2, 4, 8, 16, 32)  # 박자 아래 숫자 (음표 길이)

ProjectTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=PROJECT_TITLE_MAX)
]
ProjectDescription = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=PROJECT_DESCRIPTION_MAX)
]
```
**`Annotated` · `StringConstraints` · `field_validator` 와 상수 · 타입 4개를 이번에 추가했다.**

**만들기**
```python
class ProjectCreateRequest(BaseModel):
    title: ProjectTitle
    description: ProjectDescription | None = None
    bpm: Decimal = Field(default=Decimal("120"), ge=20, le=999, decimal_places=2)
    time_sig_num: int = Field(default=4, ge=1, le=32)
    time_sig_den: int = Field(default=4)

    @field_validator("description")
    @classmethod
    def _empty_to_none(cls, value: str | None) -> str | None:
        return value or None  # 공백만 친 설명 → "" → None

    @field_validator("time_sig_den")
    @classmethod
    def _check_den(cls, value: int) -> int:
        if value not in TIME_SIG_DENOMINATORS:
            raise ValueError("must be one of 1, 2, 4, 8, 16, 32")
        return value
```
`bpm` · `time_sig_num` 줄은 템플릿 그대로.

**수정**
```python
class ProjectUpdateRequest(BaseModel):
    title: ProjectTitle | None = None
    description: ProjectDescription | None = None

    @field_validator("title")
    @classmethod
    def _title_not_null(cls, value: str | None) -> str:
        # 보내지 않으면 이 검사는 돌지 않음 (기본값은 검사하지 않음) → null 을 직접 보낸 경우만
        if value is None:
            raise ValueError("title cannot be empty")
        return value

    @field_validator("description")
    @classmethod
    def _empty_to_none(cls, value: str | None) -> str | None:
        return value or None
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from typing import Annotated` | 타입에 검사 규칙을 붙여 새 이름으로 (`ProjectTitle`) |
| `from pydantic import StringConstraints, field_validator` | 글자 규칙(공백 제거 · 길이) / 칸 하나를 직접 검사하는 함수 |

| 식 | 뜻 |
|---|---|
| `StringConstraints(strip_whitespace=True, min_length=1, …)` | 앞뒤 공백을 **먼저** 지우고 길이를 잼 |
| `ProjectTitle \| None = None` | 제목 또는 null, 안 보내면 None |
| `@field_validator("time_sig_den")` + `@classmethod` | 그 칸의 기본 검사가 끝난 뒤 불리는 함수 (pydantic 규칙상 classmethod) |
| `raise ValueError(...)` | 검사 실패 → pydantic 이 422 로 바꿈 |
| `value or None` | `""` 처럼 빈 값이면 None, 아니면 그대로 |
| `model_dump(exclude_unset=True)` | (59 에서 씀) **보낸 칸만** 꺼냄 — 보내지 않은 칸은 바꾸지 않으려고 |

## 4. 흐름
1. JSON 을 받아 칸마다 타입 · 범위 검사 (BPM 20~999, 소수 둘째 자리까지, 박자 위 1~32).
2. 제목 · 설명은 앞뒤 공백을 지운 뒤 길이 검사.
3. `field_validator` — 빈 설명은 None, 박자 아래 숫자 확인, (수정) 제목 null 거부.
4. 하나라도 틀리면 422, 아니면 서비스로.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 제목을 **공백 제거 후** 검사 | 템플릿(`min_length=1`)대로면 공백 한 칸짜리 제목이 저장된다 — 닉네임(37) · 문의(50)와 같은 빈틈. 서비스의 `data.title.strip()`(템플릿)은 필요 없어짐 |
| 빈 설명 → None | 칸을 비우는 것 = 설명 없음. `""` 와 `NULL` 두 가지가 섞이지 않게. Edit details 에서 설명을 지우면 화면은 빈 칸을 보냄 |
| 박자 아래 숫자는 6개만 | 음표 길이(온 · 2분 · 4분 · 8분 · 16분 · 32분)만 박자가 된다 (템플릿 TODO). 화면은 4/4 · 3/4 · 6/8 · 7/8 만 고르지만 서버도 막음 |
| 수정에서 제목 null 거부를 **스키마**에서 | 템플릿은 서비스에서 422 를 내라고 했지만, 스키마에서 막으면 다른 검사 오류와 같은 모양(`VALIDATION_ERROR` + `details`)으로 나간다 |
| 길이 상수를 화면과 같게 | 화면 `maxlength` 100 · 500 과 서버가 어긋나지 않게 (문의 50 과 같음) |

## 6. 시험 (`tests/test_project_schemas.py` 새 파일 · 33개)
| 시험 | 확인한 것 |
|---|---|
| 기본값 | 제목만 → 설명 None · BPM 120 · 4/4 |
| 공백 | 제목 · 설명 앞뒤 공백 제거, 공백 뒤 100자 제목 통과 |
| 틀린 제목 4가지 | `""` · 공백 · 줄바꿈만 · 101자 → 422 |
| 설명 | 빈 칸 · 공백 → None, 501자 → 422 |
| 박자 | 아래 1 · 2 · 4 · 8 · 16 · 32 통과 / 0 · 3 · 5 · 12 · 64 · −4 → 422, 위 0 · 33 → 422 |
| BPM | 19.99 · 999.01 · 소수 셋째 자리 → 422 |
| 수정 | 빈 요청 → 바꿀 것 없음, 제목 null · 빈 · 101자 → 422, 공백 제목 정리 · 빈 설명 → None |

전체 시험 438개 통과, `ruff` 검사 통과.
