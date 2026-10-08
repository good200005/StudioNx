# Backend(FastAPI/Python) 59 — `create_project()` (프로젝트 만들기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/project_service.py` |
| 작업 | P1-13 프로젝트 API — 새 프로젝트 · PRD 01 FR-122 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [58 `to_item` · `list_projects`](58_project_service_list.md) · [60 `update_project`](60_project_service_update.md) |

## 1. 하는 일
새 프로젝트 모달의 값(56 에서 검사 끝)으로 **세 행을 한 번에** 저장한다.

| 표 | 넣는 행 |
|---|---|
| `projects` | 제목 · 설명 · BPM · 박자, `owner_id` = 나 |
| `project_members` | (새 프로젝트, 나, **OWNER**) |
| `tracks` | 이름 `Master`, 종류 **MASTER**, `order_index` 0 |

셋 중 하나라도 실패하면 **셋 다 저장되지 않는다** (rollback). 저장된 `Project` 를 돌려주면 라우터(62)가 `to_item` 으로 응답을 만든다.

| 보낸 값 | 저장 결과 |
|---|---|
| `{"title": "  New Song "}` | 제목 `New Song`, 설명 없음, BPM 120.00, 4/4 + OWNER 행 + Master 트랙 |
| `{"title": "A", "bpm": 128.5, "time_sig_num": 7, "time_sig_den": 8}` | BPM 128.50, 7/8 |
| 트랙 저장에서 DB 오류 | 프로젝트 · 멤버 행도 사라짐, 오류는 그대로 위로 (500) |

## 2. 언제 쓰나
| 호출하는 곳 | 화면 |
|---|---|
| `POST /api/v1/projects` 라우터 (62) | myProject.html 새 프로젝트 모달의 Create (P1-14) |

**트랜잭션**: 여러 SQL 을 "모두 성공 또는 모두 취소" 한 묶음으로 처리하는 DB 기능.
- `db.add` — 세션에 올려 두기만 함 (아직 SQL 없음)
- `db.flush` — INSERT 를 DB 에 보냄. 하지만 **확정 전**이라 다른 연결에서는 안 보이고 되돌릴 수 있음
- `db.commit` — 묶음 전체를 확정
- `db.rollback` — 확정 전의 묶음 전체를 취소

## 3. 코드
**import** (파일 맨 위)
```python
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

MASTER_TRACK_NAME = "Master"
```
`Track` · `MemberRole` · `TrackType` 을 이번에 추가했다. 이 함수는 `Session` · `Project` · `ProjectMember` · `Track` · `User` · `MemberRole` · `TrackType` · `ProjectCreateRequest` · `MASTER_TRACK_NAME` 을 쓴다.

**함수**
```python
def create_project(db: Session, user: User, data: ProjectCreateRequest) -> Project:
    project = Project(
        owner_id=user.user_id,
        title=data.title,
        description=data.description,
        bpm=data.bpm,
        time_sig_num=data.time_sig_num,
        time_sig_den=data.time_sig_den,
    )
    try:
        db.add(project)
        db.flush()  # commit 전에 project_id 를 받기 위해 (INSERT 만 먼저 보냄)
        db.add(
            ProjectMember(
                project_id=project.project_id, user_id=user.user_id, role=MemberRole.OWNER
            )
        )
        # MASTER 는 화면에서 늘 맨 아래 고정이라 순서 번호는 쓰지 않음 (2026-10-06)
        db.add(
            Track(
                project_id=project.project_id,
                name=MASTER_TRACK_NAME,
                track_type=TrackType.MASTER,
                order_index=0,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(project)  # DB 가 채운 created_at · updated_at · bpm 등 다시 읽기
    return project
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from app.models.project import MemberRole` | 역할 이름 목록 (OWNER · EDITOR · VIEWER). 글자를 직접 쓰는 것보다 오타가 나지 않음 |
| `from app.models.track import TrackType` | 트랙 종류 목록 (AUDIO · MIDI · MASTER · GROUP · RETURN) |

| 식 | 뜻 |
|---|---|
| `db.flush()` 뒤 `project.project_id` | INSERT 를 보내면 DB 가 만든 자동 번호가 객체에 채워짐 → 멤버 · 트랙 행에 씀 |
| `try: ... except Exception: db.rollback(); raise` | 어떤 오류든 먼저 취소하고, 같은 오류를 그대로 다시 던짐 (`raise` 만 쓰면 받은 오류 그대로) |
| `db.refresh(project)` | DB 에서 그 행을 다시 읽음 — `created_at` · `updated_at` 처럼 DB 가 채운 값을 받으려고 |

## 4. 흐름
1. 검사가 끝난 값으로 `Project` 객체를 만든다.
2. `add` → `flush` — 프로젝트 INSERT, 번호 받기.
3. 그 번호로 OWNER 멤버 · MASTER 트랙을 `add`.
4. `commit` — 남은 INSERT 두 개를 보내고 셋 다 확정.
5. 2~4 에서 오류 → `rollback` 으로 셋 다 취소 → 오류를 다시 던짐 (처리기가 500).
6. `refresh` → 돌려줌.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 세 행을 한 트랜잭션 | 프로젝트만 있고 OWNER 행이 없으면 `get_membership`(57)이 주인에게도 404 를 낸다 — 아무도 열 수 없는 프로젝트가 생김. MASTER 트랙이 없으면 시퀀서가 깨짐 (FR-122) |
| `flush` 로 번호를 먼저 받음 | 멤버 · 트랙 행에 `project_id` 가 필요하지만, 아직 확정하면 안 되므로 (템플릿 순서) |
| `except` 에서 `rollback` 후 `raise` | 실패한 세션은 rollback 하기 전까지 다음 쿼리를 못 한다. 오류를 삼키지 않고 다시 던져야 처리기가 500 · Sentry 로 남긴다 |
| `title.strip()` 하지 않음 | 스키마(56)가 이미 공백을 지움 (템플릿 TODO 의 `strip()` 은 필요 없어짐) |
| `MemberRole.OWNER` · `TrackType.MASTER` | 글자 `"OWNER"` 대신 목록 이름 — 오타면 바로 오류 |
| MASTER `order_index` 0 | MASTER 는 트랙 목록 맨 아래 고정이라 순서 번호를 보지 않음 (2026-10-06 결정). 템플릿 값 그대로 |
| 프로젝트를 돌려줌 (`ProjectItem` 아님) | 화면 모양으로 바꾸는 일은 `to_item` 이 맡음 — 만들기 · 수정 · 상세가 같은 응답 모양 |

## 6. 시험 (`tests/test_project_service.py` · 4개 추가, 모두 29개)
| 시험 | 확인한 것 |
|---|---|
| 세 행 저장 | 제목 공백 정리 · 설명 · BPM 128.50 · 7/8, `created_at` 등 DB 값, OWNER 행, Master 트랙 하나 (MASTER · 0) |
| 기본값 | 제목만 → 설명 None · BPM 120.00 · 4/4 |
| 목록 · 응답 | 만든 뒤 목록에 OWNER · 멤버 1 · opened False 로 나옴 |
| 실패 시 취소 | 트랙 이름을 101자로 바꿔 트랙 INSERT 에서 DB 오류 → 프로젝트 · 멤버 행 0개, 먼저 확정한 회원은 그대로 |

전체 시험 467개 통과, `ruff` 검사 통과.
