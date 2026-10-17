# Backend(FastAPI/Python) 217 — 패턴 라우터 `GET /patterns` · `GET /patterns/{id}`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/patterns.py` |
| 작업 | S1-08 아코디언·피아노롤: 패턴 목록·상세 API (PRD 02 FR-232, FR-233) |
| 작성 | Claude (AI), 2026-10-17, 사용자 검토 |
| 이전 · 다음 | 216 `update_pattern` · 218 패턴 라우터(노트·수정) |

## 1. 하는 일
패턴을 읽는 두 길을 엽니다. 라우터는 얇게 두고 로직은 `pattern_service` (214) 로 넘깁니다.

| 메서드 · 경로 | 하는 일 | 권한 |
|---|---|---|
| `GET /patterns?project_id=` | 프로젝트의 패턴 목록 (노트 없이) | 멤버면 누구나 |
| `GET /patterns/{id}` | 패턴 한 건 + 노트 전부 | 멤버면 누구나 |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 피아노롤 | 클립을 열 때 패턴 상세로 노트를 받습니다 |
| 편곡 화면 | 프로젝트의 패턴 목록을 받아 클립과 잇습니다 (연결은 S1-10) |

## 3. 코드
```python
router = APIRouter()

@router.get("", response_model=PatternListResponse)
def list_patterns(
    user: CurrentUser,
    db: Db,
    project_id: Annotated[int, Query(ge=1)],
) -> PatternListResponse:
    return pattern_service.list_patterns(db, user, project_id)

@router.get(
    "/{pattern_id}",
    response_model=PatternResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_pattern(pattern_id: int, user: CurrentUser, db: Db) -> PatternResponse:
    return pattern_service.get_pattern(db, user, pattern_id)
```

`app/api/v1/router.py` 에 아래 한 줄로 붙입니다.
```python
router.include_router(patterns.router, prefix="/patterns", tags=["patterns"])
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `CurrentUser` · `Db` | `app/api/deps.py` 의 별칭입니다. 로그인한 사용자와 DB 세션을 자동으로 받습니다 |
| `Annotated[int, Query(ge=1)]` | 쿼리 값은 1 이상이어야 합니다 (0·음수는 422) |
| `response_model=...` | 응답을 이 스키마(213) 모양으로 검사해 내보냅니다 |
| `responses={404: {"model": ErrorResponse}}` | 문서(OpenAPI)에 404 응답 모양을 적어 둡니다 |
| 경로가 `""` | 접두사가 `/patterns` 라서 빈 문자열이 목록 경로가 됩니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 라우터는 얇게 | 규칙(권한·정렬·응답)은 서비스 한 곳에 모읍니다. 라우터는 부르기만 합니다 |
| 목록은 `project_id` 를 쿼리로 | 프로젝트의 패턴을 모아 보는 것이 목적이라 프로젝트 번호가 기준입니다 |
| 401 은 자동 | `CurrentUser` 가 로그인을 요구합니다 |

## 5. 시험
`tests/test_pattern_routes.py` 에서 목록(빈 목록·여러 건·정렬), 상세(노트 포함), 401·404 를 확인했습니다. 통과합니다.
