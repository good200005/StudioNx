# Backend(FastAPI/Python) 64 — `get_storage()` (저장 용량)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/dashboard_service.py` |
| 작업 | P1-16 대시보드 API: 마이페이지의 용량 칸 (PRD 01 FR-131, FR-133) |
| 작성 | Claude (AI), 2026-10-12, 사용자 검토 |
| 이전 · 다음 | [63 `ProjectSession` 컬럼](63_model_project_session.md) · [65 `get_ai_usage()`](65_dashboard_get_ai_usage.md) |

## 1. 하는 일
이 함수는 회원의 **저장 용량 한도와 사용량**을 마이페이지 응답 모양(`DashboardStorage`)으로 돌려줍니다.

| 회원 | 결과 |
|---|---|
| 새 회원 (DB 기본값) | `{"quota_bytes": 5368709120, "used_bytes": 0, "by_kind": {"samples": 0, "exports": 0, "stems": 0, "snapshots": 0}}`: 5GB 중 0을 쓴 상태입니다 |
| 한도가 10GB이고 1.23GB를 쓴 회원 (관리자가 한도를 바꾼 경우) | `quota_bytes`는 10737418240, `used_bytes`는 1234567890입니다 |
| 프로필 사진이 있는 회원 | `used_bytes`는 그대로 0입니다. 사진은 사용량에 넣지 않습니다 |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| 68 `get_dashboard`(예정) → `GET /me/dashboard` | myPage.html의 용량 막대 "0 B of 5 GB" (P1-17) |

**용량 숫자의 출처:** 한도는 `users.storage_quota_bytes`(기본 5GB), 사용량은 `users.storage_used_bytes`(기본 0)에서 가져옵니다. 파일을 올리고 지울 때 사용량을 늘리고 줄이는 일은 샘플, 녹음, 출력 기능이 생기는 **Phase 2**에서 합니다. 그래서 지금은 모든 회원의 사용량이 0입니다.

## 3. 코드
**import** (파일 맨 위)
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
)
```
**`StorageByKind`를 이번에 추가했습니다.** 이 함수는 `User`, `DashboardStorage`, `StorageByKind`를 사용합니다.

**함수**
```python
def get_storage(user: User) -> DashboardStorage:
    return DashboardStorage(
        quota_bytes=user.storage_quota_bytes,
        used_bytes=user.storage_used_bytes,
        by_kind=StorageByKind(),
    )
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from app.schemas.dashboard import StorageByKind` | 종류별 사용량의 응답 모양입니다. 네 칸 모두 기본값이 0입니다 |

| 식 | 뜻 | 예 |
|---|---|---|
| `StorageByKind()` | 값을 하나도 넘기지 않으면 모든 칸이 기본값(0)이 됩니다 | `{samples: 0, exports: 0, stems: 0, snapshots: 0}` |
| `-> DashboardStorage` | 돌려주는 값의 모양입니다. FastAPI가 이것을 JSON으로 바꿉니다 | |
| `db` 매개변수가 없음 | DB를 다시 읽지 않습니다. `user`는 토큰 검사(P1-03 `get_current_user`)가 이미 읽어 온 행입니다 | |

## 4. 흐름
회원 행에 있는 두 숫자와, 0으로 채운 종류별 사용량을 묶어서 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `users` 칸을 그대로 씀 | 요청할 때마다 파일 표에서 크기를 더하면 느립니다. 그래서 파일을 올리고 지울 때 미리 갱신해 두는 방식을 씁니다 (FR-133, DB.md) |
| 종류별 사용량은 0 | Phase 1에는 samples나 exports 같은 표가 없습니다 (템플릿). 그래도 칸은 지금부터 내보내서, 화면(P1-17)이 처음부터 같은 모양을 쓰게 했습니다 |
| 프로필 사진은 제외 | 회원당 2MB 한 장뿐이라 "작업 파일 용량"에 넣지 않기로 했습니다 (2026-10-07 결정) |
| DB를 다시 읽지 않음 | 같은 요청 안에서 이미 읽어 온 회원 행이므로, 쿼리를 아낄 수 있습니다 |

## 6. 시험 (`tests/test_dashboard_service.py` 새 파일, 4개)
| 시험 | 확인한 것 |
|---|---|
| 기본값 | 새 회원은 한도 5GB(5368709120), 사용량 0, 종류별 사용량이 모두 0입니다 |
| 회원 값 | 한도 10GB와 사용량 1234567890이 그대로 나옵니다 |
| 프로필 사진 | 사진이 있어도 사용량은 0입니다 |
| JSON 모양 | 칸이 3개이고, 한도는 정수입니다 |

전체 시험 500개가 통과했고, `ruff` 검사도 통과했습니다.
