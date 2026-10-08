# Backend(FastAPI/Python) 54 — `purge_old_inquiries()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/workers/retention.py` |
| 작업 | P1-12 문의 API — 오래된 문의 지우기 · 개인정보 처리방침 §4 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [53 `POST /inquiries`](53_inquiries_route_create.md) · [55 `retention.main()`](55_retention_main.md) |

## 1. 하는 일
하루 한 번 도는 정리 작업 중 **문의** 쪽. 오래된 문의를 DB 에서 아예 지운다.

| 문의 (오늘 기준) | 결과 |
|---|---|
| 답변한 지 400일 | 지움 |
| 받은 지 500일, 답변한 지 300일 | **남김** — 답변 날부터 1년 |
| 답변 없이 받은 지 400일 | 지움 (사용자 결정) |
| 답변 없이 받은 지 100일 | 남김 |
| 답변한 지 정확히 365일 | 지움 |

돌려주는 값 = 지운 개수.

## 2. 언제 쓰나
| 실행 | |
|---|---|
| 55 `main()` | `python -m app.workers.retention` — 하루 한 번 (예약 작업은 배포 때). 49 `purge_withdrawn_accounts` 와 함께 |

### 사용자 결정 (2026-10-08) — 답변하지 않은 문의
처리방침에는 "답변 후 1년" 만 있어, 관리자가 답하지 않은 문의는 영영 남을 수 있었다. **받은 뒤 1년**에 지우기로 했다 (추천 A).

| 문의 | 기준 날짜 | 기간 |
|---|---|---|
| 답변함 | 답변한 날 | 1년 |
| 답변 안 함 | 받은 날 | 1년 |

## 3. 코드
**import** (파일 맨 위)
```python
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Inquiry, User
from app.models.user import UserStatus
from app.services.auth_service import REJOIN_WAIT_DAYS, release_withdrawn
```
**`delete` · `func` · `Inquiry` 를 이번에 추가했다.**

**상수**
```python
INQUIRY_KEEP_DAYS = 365  # 답변 후 · (답변 없으면) 받은 뒤 보관 기간 (처리방침 §4, 2026-10-08)
```

**함수**
```python
def purge_old_inquiries(db: Session, now: datetime) -> int:
    if now.tzinfo is not None:
        now = now.astimezone(UTC).replace(tzinfo=None)
    cutoff = now - timedelta(days=INQUIRY_KEEP_DAYS)
    since = func.coalesce(Inquiry.answered_at, Inquiry.created_at)
    count = db.execute(delete(Inquiry).where(since <= cutoff)).rowcount
    db.commit()
    return count
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from sqlalchemy import delete, func` | `DELETE` 문 · SQL 함수 부르기 (`func.coalesce` → SQL `COALESCE`) |

| 식 | 뜻 |
|---|---|
| `func.coalesce(Inquiry.answered_at, Inquiry.created_at)` | SQL `COALESCE(answered_at, created_at)` — 답변 시각이 있으면 그것, 없으면(`NULL`) 받은 시각. 두 규칙을 **조건 하나**로 |
| `delete(Inquiry).where(…)` | 조건에 맞는 행을 DB 에서 한 번에 지움 (하나씩 읽지 않음) |
| `.rowcount` | 지운 행 수 |

## 4. 흐름
1. 기준 시각 = 지금(UTC) − 365일.
2. "답변 시각, 없으면 받은 시각" 이 기준보다 오래된 문의를 한 번에 지운다.
3. 저장하고 지운 수를 돌려준다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 받은 뒤 1년 (답변 없을 때) | 사용자 결정 — 답장 이메일 같은 개인정보가 끝없이 남지 않게 (저장 기간 제한 원칙) |
| 답변이 있으면 **답변 날** 기준 | 처리방침 그대로 — 늦게 답한 문의도 답한 뒤 1년은 남긴다 (시험: 받은 지 500일 · 답변 300일 → 남김) |
| `COALESCE` 한 조건 | 두 규칙을 따로 지우는 것보다 단순하고, 한 번의 `DELETE` 로 끝난다 |
| 행을 진짜로 지움 (탈퇴 회원처럼 비우지 않음) | 문의는 다른 표가 가리키지 않는다 (템플릿) |
| 49 와 같은 시간대 처리 | 한국 시각을 넘겨도 정확히 1년 |

## 6. 처리방침 문구
이 결정에 맞춰 처리방침에 "답변하지 않은 문의는 받은 뒤 1년" 을 넣고 버전을 `2026-10-08` 로 올렸다 (사용자 결정 A) — [55 §6](55_retention_main.md).

## 7. 시험 (`tests/test_retention.py` 에 3개 추가 · 모두 11개, 실제 MySQL)
| 시험 | 확인한 것 |
|---|---|
| 5가지 문의 | 3개 지움 — 답변 400일 · 답변 없이 400일 · 답변 정확히 365일 / 남음 — 답변 300일(받은 지 500일) · 답변 없이 100일 |
| 두 번 돌리기 | 1 → 0 |
| 한국 시각 21:00 (= UTC 12:00) | 정확히 1년 된 문의 지움 |

전체 시험 403개 통과, `ruff` 검사 통과. 시험 뒤 DB 의 문의는 0개.
