# Backend(FastAPI/Python) 265 — 묶기와 프로젝트 칸 (`_group_by` · `project_info`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/full_project_service.py` |
| 작업 | S1-10 프로젝트 전체 저장·불러오기: 묶기 도우미와 프로젝트 칸 (PRD 02 FR-254) |
| 작성 | Claude (AI), 2026-10-19, 사용자 검토 |
| 이전 · 다음 | 264 프로젝트 전체 응답 스키마 · 266 `_full_track` · `get_full_project` |

## 1. 하는 일
전체 조회(266)를 도와주는 두 함수입니다.

```text
_group_by(rows, key)     트랙별 장치 · 패턴별 노트로 묶습니다
project_info(db, ...)    프로젝트 + 곡 설정 + 내 역할 → FullProjectInfo
```

`project_info` 는 시퀀서가 화면 위쪽(BPM · 박자 · Key)을 그리는 데 쓰는 값을 만듭니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `get_full_project` (266) | 트랙 · 악기 · 이펙트 · 연결선 · 노트를 묶을 때 `_group_by` 를 씁니다 |
| `get_full_project` · 곡 설정 라우터 (268) | 두 곳 모두 `project_info` 로 프로젝트 칸을 만듭니다 |
| `PATCH /projects/{id}/settings` 응답 | 저장 뒤 바뀐 프로젝트 칸을 그대로 돌려줍니다 |

## 3. 코드
```python
def _group_by(rows: list, key) -> dict[Any, list]:
    """행 목록을 key(row) 값으로 묶는다 — 트랙별 장치, 패턴별 노트. 차례는 조회 때 정한 차례를 지킨다."""
    grouped: dict[Any, list] = {}
    for row in rows:
        grouped.setdefault(key(row), []).append(row)
    return grouped


def project_info(db: Session, project: Project, member: ProjectMember) -> FullProjectInfo:
    """Project → FullProjectInfo. 멤버 수와 opened 는 project_service.to_item 이 센 값을 그대로 쓴다."""
    item = project_service.to_item(db, project, member)
    return FullProjectInfo(
        **item.model_dump(),
        scale_mode=project.scale_mode,
        sample_rate=project.sample_rate,
        master_settings=project.master_settings,
        revision=project.revision,
    )
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `key` 인자 | 함수 자체를 받습니다. `lambda row: row.track_id` 처럼 무엇으로 묶을지 넘깁니다 |
| `dict[Any, list]` | 열쇠가 트랙 번호(정수)이거나 패턴 번호(정수)라 둘 다 담도록 열쇠를 `Any` 로 둡니다 |
| `grouped.setdefault(k, []).append(row)` | 그 열쇠가 처음이면 빈 목록을 만들어 넣고, 목록 끝에 행을 더합니다 |
| `**item.model_dump()` | 목록 한 줄(065)의 칸을 전부 펼쳐 넣고, 그 뒤에 곡 설정 네 칸을 더합니다 |
| `member.role` | `my_role` 에 들어가는 `'OWNER'` · `'EDITOR'` · `'VIEWER'` 값입니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 트랙 수만큼 묻지 않고 묶어서 처리 | 화면을 열 때마다 곡 크기에 비례해 느려지면 안 됩니다. 조회 여섯 번으로 끝냅니다 |
| `_group_by` 를 두 곳에서 씀 | 장치와 노트의 묶는 방법이 같아 함수 하나로 충분합니다 |
| 멤버 수 · opened 를 `to_item` 에 맡김 | 마이페이지 목록과 시퀀서가 다른 값을 보여 주면 버그로 보입니다. 세는 규칙을 한 곳에 둡니다 |
| 곡 설정만 따로 더함 | `ProjectItem` 은 목록 화면용이라 `scale_mode` · `sample_rate` · `master_settings` · `revision` 이 없습니다 |

## 5. 시험
`tests/test_full_project_routes.py::test_full_includes_song_settings` 에서 BPM · Key · 스케일 · 마스터 설정 · revision · sample_rate 가 응답에 그대로 실리는지 확인했습니다. `test_full_returns_project_tracks_and_patterns` 에서 `my_role` 이 `'OWNER'`, `member_count` 가 1 인지 확인했습니다. 통과합니다.
