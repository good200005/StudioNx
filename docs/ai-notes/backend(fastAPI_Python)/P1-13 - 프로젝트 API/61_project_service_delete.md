# Backend(FastAPI/Python) 61 — `delete_project()` (프로젝트 삭제 · 소프트 삭제)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/project_service.py` |
| 작업 | P1-13 프로젝트 API: 프로젝트 삭제 (PRD 01 FR-125) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [60 `update_project`](60_project_service_update.md) · [62 프로젝트 라우터](62_projects_routes.md) |

## 1. 하는 일
프로젝트 행을 **지우지 않고** `deleted_at`에 지금 시각(UTC)을 적습니다 (소프트 삭제). OWNER만 삭제할 수 있습니다.

| 상황 | 결과 |
|---|---|
| OWNER가 삭제 | `deleted_at`이 채워집니다. 목록에서 사라지고, 다시 열려고 하면 404입니다 |
| EDITOR나 VIEWER가 삭제 | 403 `"You don't have permission."`이고, 프로젝트는 그대로입니다 |
| 이미 삭제된 프로젝트를 또 삭제 | 404입니다. `get_membership`(57)에서 막혀서 이 함수까지 오지 않습니다 |

| 표 | 삭제한 뒤 |
|---|---|
| `projects` | 행은 남고, `deleted_at`만 채워집니다 |
| `project_members`, `tracks` (MASTER 등) | 그대로 둡니다. 나중에 복구할 수 있게 하기 위해서입니다 |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| `DELETE /api/v1/projects/{id}` 라우터 (62): `get_membership`(57) 다음에 부릅니다 | myProject.html 카드의 Delete → `confirmDialog` 확인 (P1-14) |

**소프트 삭제**: 행을 `DELETE`하지 않고 "지운 시각" 칸만 채워 두는 방식입니다. 데이터를 읽는 쪽(57, 58)이 `deleted_at IS NULL`인 행만 보기 때문에, 사용자에게는 지워진 것과 똑같이 보입니다. 회원 탈퇴(P1-09)와 같은 방식입니다.

## 3. 코드
**import** (파일 맨 위)
```python
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models import Project, ProjectMember, ProjectSession, Track, User
from app.models.project import MemberRole
from app.models.track import TrackType
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectItem,
    ProjectListResponse,
    ProjectSort,
    ProjectUpdateRequest,
)
```
`from datetime import UTC, datetime` 줄을 이번에 추가했습니다. 이 함수는 `UTC`, `datetime`, `Session`, `Project`, `ProjectMember`, `MemberRole`을 사용합니다.

**함수**
```python
def delete_project(db: Session, project: Project, member: ProjectMember) -> None:
    require_role(member, MemberRole.OWNER)
    project.deleted_at = datetime.now(UTC).replace(tzinfo=None)  # DB 는 UTC 를 시간대 없이 저장
    db.commit()
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from datetime import UTC, datetime` | `datetime`은 날짜와 시각이고, `UTC`는 세계 표준시 시간대입니다 |

| 식 | 뜻 |
|---|---|
| `datetime.now(UTC)` | 지금 시각입니다 (UTC, 시간대 정보가 붙어 있습니다) |
| `.replace(tzinfo=None)` | 시간대 정보만 떼어 냅니다. DB의 `DATETIME` 칸은 시간대를 저장하지 않기 때문입니다 (값은 UTC 그대로입니다) |
| `-> None` | 돌려주는 값이 없습니다. 라우터는 204(본문 없음)로 응답합니다 |

## 4. 흐름
1. 역할을 검사합니다. OWNER가 아니면 403으로 응답합니다.
2. `deleted_at`에 지금 시각(UTC)을 넣습니다.
3. `commit`하고 끝납니다. 이후로는 `get_membership`과 `list_projects`가 이 프로젝트를 보지 않습니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 소프트 삭제 | 실수로 지운 프로젝트를 되살릴 수 있습니다. 또 트랙, 클립, 샘플 연결을 한꺼번에 지우는 큰 작업을 요청 처리 중에 하지 않아도 됩니다 (FR-125) |
| OWNER만 삭제 가능 | 협업자(Phase 6)가 남의 프로젝트를 통째로 없애지 못하게 합니다 (PRD 01 §5) |
| 트랙과 멤버는 그대로 둠 | 복구할 때 그대로 돌아옵니다. 실제 파일 정리는 나중에 별도 정리 작업에서 합니다 (FR-137) |
| UTC로 저장 | 다른 시각 칸(가입, 탈퇴, 문의)과 같은 규칙입니다. 화면에서 사용자의 시간대로 바꿔 보여 줍니다 |
| `refresh`도, 돌려주는 값도 없음 | 삭제 응답에는 본문이 없으므로 새 값을 다시 읽을 필요가 없습니다 |
| 두 번 삭제하는 경우를 따로 처리하지 않음 | 이미 삭제된 프로젝트는 57번이 404로 막습니다 |

## 6. 시험 (`tests/test_project_service.py`: 4개를 추가해서 모두 42개)
| 시험 | 확인한 것 |
|---|---|
| OWNER가 삭제 | 행은 남고 `deleted_at`이 지금 이후 시각으로 채워지며, 멤버 행과 MASTER 트랙은 그대로입니다 |
| 목록에서 사라짐 | 목록에는 남은 프로젝트만 나오고(total 1), 지운 프로젝트는 `get_membership`에서 404이며, 남은 프로젝트는 그대로 열립니다 |
| EDITOR, VIEWER | 403 `FORBIDDEN`이고, `deleted_at`은 그대로 None입니다 |

전체 시험 480개가 통과했고, `ruff` 검사도 통과했습니다.
