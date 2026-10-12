# Backend(FastAPI/Python) 54 — `purge_old_inquiries()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/workers/retention.py` |
| 작업 | P1-12 문의 API: 오래된 문의 지우기 (개인정보 처리방침 §4) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [53 `POST /inquiries`](53_inquiries_route_create.md) · [55 `retention.main()`](55_retention_main.md) |

## 1. 하는 일
하루에 한 번 실행되는 정리 작업 중 **문의**를 담당하는 부분입니다. 오래된 문의를 DB에서 완전히 지웁니다.

| 문의 (오늘 기준) | 결과 |
|---|---|
| 답변한 지 400일 | 지웁니다 |
| 받은 지 500일, 답변한 지 300일 | **남깁니다**. 답변한 날부터 1년을 셉니다 |
| 답변 없이 받은 지 400일 | 지웁니다 (사용자 결정) |
| 답변 없이 받은 지 100일 | 남깁니다 |
| 답변한 지 정확히 365일 | 지웁니다 |

돌려주는 값은 지운 개수입니다.

## 2. 언제 쓰나
| 실행 | |
|---|---|
| 55번 `main()` | `python -m app.workers.retention`으로 하루에 한 번 실행합니다 (예약 작업은 배포 때 설정합니다). 49번 `purge_withdrawn_accounts`와 함께 실행됩니다 |

### 사용자 결정 (2026-10-08): 답변하지 않은 문의
처리방침에는 "답변 후 1년"만 적혀 있어서, 관리자가 답하지 않은 문의는 영원히 남을 수 있었습니다. 그래서 **받은 뒤 1년**이 지나면 지우기로 했습니다 (추천안 A).

| 문의 | 기준 날짜 | 보관 기간 |
|---|---|---|
| 답변함 | 답변한 날 | 1년 |
| 답변하지 않음 | 받은 날 | 1년 |

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
**`delete`, `func`, `Inquiry`를 이번에 추가했습니다.**

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
| `from sqlalchemy import delete, func` | `DELETE` 문을 만들고, SQL 함수를 부릅니다 (`func.coalesce`는 SQL의 `COALESCE`가 됩니다) |

| 식 | 뜻 |
|---|---|
| `func.coalesce(Inquiry.answered_at, Inquiry.created_at)` | SQL `COALESCE(answered_at, created_at)`입니다. 답변 시각이 있으면 그 값을, 없으면(`NULL`) 받은 시각을 씁니다. 두 규칙을 **조건 하나**로 표현합니다 |
| `delete(Inquiry).where(…)` | 조건에 맞는 행을 DB에서 한 번에 지웁니다 (하나씩 읽어 오지 않습니다) |
| `.rowcount` | 지운 행의 수입니다 |

## 4. 흐름
1. 기준 시각을 지금(UTC)으로부터 365일 전으로 정합니다.
2. "답변 시각, 없으면 받은 시각"이 기준 시각보다 오래된 문의를 한 번에 지웁니다.
3. 저장한 뒤 지운 개수를 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 답변이 없으면 받은 뒤 1년 | 사용자 결정입니다. 답장용 이메일 같은 개인정보가 끝없이 남지 않게 합니다 (저장 기간 제한 원칙) |
| 답변이 있으면 **답변한 날**이 기준 | 처리방침을 그대로 따랐습니다. 늦게 답한 문의도 답한 뒤 1년은 남깁니다 (시험: 받은 지 500일, 답변한 지 300일 → 남김) |
| `COALESCE` 조건 하나로 처리 | 두 규칙을 따로 지우는 것보다 단순하고, `DELETE` 한 번으로 끝납니다 |
| 행을 실제로 지움 (탈퇴 회원처럼 값만 비우지 않음) | 다른 표가 문의를 가리키지 않기 때문입니다 (템플릿) |
| 시간대 처리는 49번과 같음 | 한국 시각으로 날짜가 넘어가도 정확히 1년을 셉니다 |

## 6. 처리방침 문구
이 결정에 맞춰 처리방침에 "답변하지 않은 문의는 받은 뒤 1년"이라는 문구를 넣고, 버전을 `2026-10-08`로 올렸습니다 (사용자 결정 A). 자세한 내용은 [55 §6](55_retention_main.md)에 있습니다.

## 7. 시험 (`tests/test_retention.py`에 3개를 추가해서 모두 11개, 실제 MySQL로 실행)
| 시험 | 확인한 것 |
|---|---|
| 문의 5가지 | 답변한 지 400일, 답변 없이 400일, 답변한 지 정확히 365일인 3개는 지워지고, 답변한 지 300일(받은 지 500일)과 답변 없이 100일인 2개는 남습니다 |
| 두 번 실행 | 처음에는 1개, 두 번째에는 0개를 지웁니다 |
| 한국 시각 21:00 (= UTC 12:00) | 정확히 1년이 된 문의를 지웁니다 |

전체 시험 403개가 통과했고, `ruff` 검사도 통과했습니다. 시험이 끝난 뒤 DB의 문의는 0건입니다.
