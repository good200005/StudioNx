# Backend(FastAPI/Python) 65 — `get_ai_usage()` (오늘 AI 사용량)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/dashboard_service.py` |
| 작업 | P1-16 대시보드 API: 마이페이지의 AI 사용량 칸 (PRD 01 FR-136, PRD 05 FR-551, FR-553) |
| 작성 | Claude (AI), 2026-10-12, 사용자 검토 |
| 이전 · 다음 | [64 `get_storage()`](64_dashboard_get_storage.md) · [66 `get_recent_projects()`](66_dashboard_get_recent_projects.md) |

## 1. 하는 일
이 함수는 **오늘** 사용한 AI 횟수와 하루 한도를 돌려줍니다. Phase 1에는 AI 기능이 없으므로 사용한 횟수는 항상 0입니다.

| 칸 | 값 | 뜻 |
|---|---|---|
| `analyses` | `{"used": 0, "limit": 5}` | 레퍼런스 트랙 분석: 하루 5번까지 (PRD 05) |
| `questions` | `{"used": 0, "limit": 30}` | Nyxi에게 질문하기: 하루 30번까지 |

마이페이지(P1-17)에는 "AI analyses 0 / 5 · Questions 0 / 30"과 같은 형태로 표시됩니다.

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 68 `get_dashboard`(예정) → `GET /me/dashboard` | myPage.html의 AI 사용량 칸 (P1-17) |

**"오늘"의 기준은 UTC 0시입니다 (2026-10-12 사용자 결정 A).** 그래서 사용량은 한국 시각으로 **매일 오전 9시**에 0으로 돌아갑니다.

| 선택 | 하루가 바뀌는 시각 | 결정 |
|---|---|---|
| **A. UTC 0시** | 모든 회원이 같은 시각 (한국 오전 9시) | ✅ 채택했습니다. 회원의 시간대 정보가 필요하지 않습니다 |
| B. 사용자 시간대 0시 | 각자의 자정 | Phase 5에서 필요해지면 도입합니다. 회원별 시간대를 저장할 칸이 있어야 하는데, 지금 DB에는 없습니다 |

## 3. 코드
**import와 상수** (파일 맨 위)
```python
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.dashboard import (
    DashboardAi,
    DashboardResponse,
    DashboardStorage,
    ReadyProject,
    RecentProject,
    StorageByKind,
    UsageCount,
)

# AI 일일 한도 (PRD 05 FR-551) — 지금은 고정값, 나중에 core/config.py 설정으로 옮기기
AI_DAILY_ANALYSES = 5
AI_DAILY_QUESTIONS = 30
```
**`UsageCount`를 이번에 추가했습니다.** 이 함수는 `Session`, `User`, `DashboardAi`, `UsageCount`와 두 상수를 사용합니다.

**함수**
```python
def get_ai_usage(db: Session, user: User) -> DashboardAi:
    return DashboardAi(
        analyses=UsageCount(used=0, limit=AI_DAILY_ANALYSES),
        questions=UsageCount(used=0, limit=AI_DAILY_QUESTIONS),
    )
```

**Phase 5에서 바뀔 모양** (참고용이며, 지금 코드에는 없습니다)
```python
today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
used = db.scalar(select(func.count()).select_from(AiAnalysis)
                 .where(AiAnalysis.user_id == user.user_id, AiAnalysis.created_at >= today))
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from app.schemas.dashboard import UsageCount` | `{used, limit}` 두 칸으로 된 응답 모양입니다 |

| 식 | 뜻 | 예 |
|---|---|---|
| `UsageCount(used=0, limit=5)` | 칸 이름을 지정해서 값을 넣어 만듭니다 | `{"used": 0, "limit": 5}` |
| `db`와 `user`를 받지만 쓰지 않음 | Phase 5에서 횟수를 셀 때 필요합니다. 이 함수를 부르는 쪽(68)을 그때 고치지 않아도 되도록 지금부터 같은 모양으로 둡니다 | |
| `.replace(hour=0, …)` (Phase 5) | 지금 UTC 시각의 시, 분, 초를 0으로 바꿔서 오늘 UTC 0시를 만듭니다 | |

## 4. 흐름
두 한도 상수와 0으로 응답을 만들어 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 지금은 사용량이 0 | Phase 1에는 AI 기능도, 사용 기록을 남길 표도 없습니다 (템플릿). 그래도 칸은 지금부터 내보내서 화면이 처음부터 같은 모양을 쓰게 했습니다 |
| UTC 0시 (A) | 사용자가 결정했습니다. 다른 시각 칸도 모두 UTC로 저장하므로 비교가 단순하고, 회원의 시간대 정보도 필요하지 않습니다 |
| 매개변수를 미리 받아 둠 | 템플릿의 모양을 그대로 따랐습니다. Phase 5에서는 함수 안쪽만 바꾸면 됩니다 |
| 한도는 상수로 둠 | PRD 05에 정해진 값입니다. 나중에 `core/config.py` 설정으로 옮겨서 서버마다 바꿀 수 있게 할 예정입니다 (템플릿 메모) |

## 6. 시험 (`tests/test_dashboard_service.py`: 3개를 추가해서 모두 7개)
| 시험 | 확인한 것 |
|---|---|
| 한도 값 | 5와 30입니다 (PRD 05) |
| Phase 1 응답 | `{"analyses": {"used": 0, "limit": 5}, "questions": {"used": 0, "limit": 30}}` |
| DB를 읽지 않음 | `db` 자리에 `None`을 넘겨도 동작합니다. 지금은 쿼리가 한 번도 나가지 않습니다 |

전체 시험 503개가 통과했고, `ruff` 검사도 통과했습니다.
