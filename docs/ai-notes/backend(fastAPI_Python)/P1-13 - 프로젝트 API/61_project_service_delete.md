# Backend(FastAPI/Python) 61 — `delete_project()` (프로젝트 삭제 · 소프트 삭제)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/project_service.py` |
| 작업 | P1-13 프로젝트 API — 프로젝트 삭제 · PRD 01 FR-125 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [60 `update_project`](60_project_service_update.md) · [62 프로젝트 라우터](62_projects_routes.md) |

## 1. 하는 일
프로젝트 행을 **지우지 않고** `deleted_at` 에 지금 시각(UTC)을 적는다 (소프트 삭제). OWNER 만 할 수 있다.

| 상황 | 결과 |
|---|---|
| OWNER 가 삭제 | `deleted_at` 채움 → 목록에서 사라지고, 다시 열면 404 |
| EDITOR · VIEWER 가 삭제 | 403 `"You don't have permission."`, 그대로 |
| 이미 삭제된 프로젝트를 또 삭제 | 404 — 여기까지 오지 않음 (`get_membership` 57) |

| 표 | 삭제 뒤 |
|---|---|
| `projects` | 행 남음, `deleted_at` 만 채워짐 |
| `project_members` · `tracks` (MASTER 등) | 그대로 — 복구할 수 있게 |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| `DELETE /api/v1/projects/{id}` 라우터 (62) — `get_membership`(57) 뒤 | myProject.html 카드의 Delete → `confirmDialog` 확인 (P1-14) |

**소프트 삭제**: 행을 `DELETE` 하지 않고 "지운 시각" 칸만 채워 두는 방식. 읽는 쪽(57 · 58)이 `deleted_at IS NULL` 인 것만 보므로 사용자에게는 지워진 것과 같다. 회원 탈퇴(P1-09)와 같은 방식.

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
`from datetime import UTC, datetime` 줄을 이번에 추가했다. 이 함수는 `UTC` · `datetime` · `Session` · `Project` · `ProjectMember` · `MemberRole` 을 쓴다.

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
| `from datetime import UTC, datetime` | `datetime` = 날짜 · 시각, `UTC` = 세계 표준시 시간대 |

| 식 | 뜻 |
|---|---|
| `datetime.now(UTC)` | 지금 시각 (UTC, 시간대 정보 붙음) |
| `.replace(tzinfo=None)` | 시간대 정보만 떼어 냄 — DB 의 `DATETIME` 칸은 시간대를 저장하지 않으므로 (값은 UTC 그대로) |
| `-> None` | 돌려주는 값 없음 — 라우터는 204 (본문 없음) 로 응답 |

## 4. 흐름
1. 역할 검사 — OWNER 가 아니면 403.
2. `deleted_at` = 지금 (UTC).
3. `commit` → 끝. 이후 `get_membership` · `list_projects` 가 이 프로젝트를 보지 않는다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 소프트 삭제 | 실수로 지운 것을 되살릴 수 있다. 트랙 · 클립 · 샘플 연결을 한꺼번에 지우는 큰 작업을 요청 중에 하지 않는다 (FR-125) |
| OWNER 만 | 협업자(Phase 6)가 남의 프로젝트를 통째로 없애지 못하게 (PRD 01 §5) |
| 트랙 · 멤버는 그대로 | 복구할 때 그대로 돌아옴. 실제 파일 정리는 나중 정리 작업 (FR-137) |
| UTC 로 저장 | 다른 시각 칸(가입 · 탈퇴 · 문의)과 같은 규칙 — 화면에서 사용자 시간대로 바꿈 |
| `refresh` 없음 · 돌려주는 값 없음 | 삭제 응답은 본문이 없으니 새 값을 읽을 필요가 없다 |
| 두 번 삭제는 신경 쓰지 않음 | 이미 삭제된 것은 57 이 404 로 막음 |

## 6. 시험 (`tests/test_project_service.py` · 4개 추가, 모두 42개)
| 시험 | 확인한 것 |
|---|---|
| OWNER 삭제 | 행은 남고 `deleted_at` 이 지금 이후, 멤버 행 · MASTER 트랙 그대로 |
| 사라짐 | 목록에 남은 것만 (total 1), 지운 것은 `get_membership` 404, 남은 것은 그대로 열림 |
| EDITOR · VIEWER | 403 `FORBIDDEN`, `deleted_at` 그대로 None |

전체 시험 480개 통과, `ruff` 검사 통과.
