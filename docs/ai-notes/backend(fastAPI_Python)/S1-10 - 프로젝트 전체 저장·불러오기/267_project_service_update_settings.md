# Backend(FastAPI/Python) 267 — 곡 설정 저장 (`project_service.update_settings`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/project_service.py` |
| 작업 | S1-10 프로젝트 전체 저장·불러오기: 곡 전체 설정 저장 (PRD 02 FR-253) |
| 작성 | Claude (AI), 2026-10-19, 사용자 검토 |
| 이전 · 다음 | 266 `get_full_project` · 268 프로젝트 라우터(전체 조회 · 곡 설정) |

## 1. 하는 일
BPM · 박자 · Key · 스케일 · 샘플레이트 · 마스터 설정을 저장합니다. 화면의 Ctrl+S 수동 저장과 자동 저장이 바뀐 칸만 보내는 곳입니다.

```text
PATCH /projects/{id}/settings { bpm: 140.5, music_key: 'Am' }
1. require_role  OWNER · EDITOR 인지 확인 (VIEWER 는 403)
2. 보낸 칸만 setattr (exclude_unset)
3. commit → refresh → Project 반환
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `PATCH /projects/{id}/settings` (268) | 라우터가 이 함수를 부릅니다 |
| 시퀀서 Ctrl+S · 자동 저장 | 화면이 고친 BPM · 박자 · Key 를 보냅니다 (FR-253) |
| 마스터 설정 저장 | 마스터 트랙의 리미터 · 페이드 설정 묶음을 담습니다 (FR-252 이후 작업) |

## 3. 코드
```python
def update_settings(db, project, member, data) -> Project:
    """곡 전체 설정(BPM · 박자 · Key · 스케일 · 샘플레이트 · 마스터 설정) 수정 (FR-253) — OWNER · EDITOR 만."""
    require_role(member, MemberRole.OWNER, MemberRole.EDITOR)
    for name, value in data.model_dump(exclude_unset=True).items():
        setattr(project, name, value)
    db.commit()
    db.refresh(project)
    return project
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `require_role(member, MemberRole.OWNER, MemberRole.EDITOR)` | 역할이 둘 중 하나가 아니면 403 을 냅니다 (056) |
| `model_dump(exclude_unset=True)` | 요청에 실제로 담겨 온 칸만 사전으로 만듭니다. 보내지 않은 칸은 빠집니다 |
| `setattr(project, name, value)` | 칸 이름과 값으로 그대로 넣습니다 |
| `db.commit()` | 여기서 실제 DB 에 저장됩니다 (`get_db` 는 commit 을 하지 않습니다) |
| `db.refresh(project)` | DB 가 채운 `updated_at` 을 다시 읽습니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 수정(`update_project`)과 함수를 나눔 | 제목 · 설명 수정(FR-124)은 화면이 다르고 응답도 다릅니다. 한 함수에 섞으면 권한 · 응답이 꼬입니다 |
| `exclude_unset` 으로 바뀐 칸만 | 화면이 곡 설정 전체를 매번 보내면 다른 창에서 바꾼 값을 덮어씁니다 (S3-02 동시 편집 대비) |
| 저장 뒤 프로젝트 칸을 돌려줌 | 화면이 저장 결과(새 `updated_at` · 값)를 곧바로 표시합니다 |
| 새 표를 만들지 않음 | 곡 설정은 이미 `projects` 칸으로 있습니다 (01_phase1_account.sql 83~88행) |
| `revision` 은 건드리지 않음 | 그 값은 협업 연산(FR-611)이 올립니다. 저장이 함부로 올리면 충돌 판정이 어긋납니다 |

## 5. 시험
`tests/test_project_settings_routes.py` 10건이 모두 통과합니다. 보낸 칸만 바뀌고 나머지는 그대로인지(`test_settings_updates_only_sent_fields`), 마스터 설정과 박자를 담을 수 있는지, EDITOR 는 200 · VIEWER 는 403 · 남의 프로젝트는 404 인지, 범위를 벗어난 값이 422 인지 확인합니다.
