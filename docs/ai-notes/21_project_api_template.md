# AI 구현 설명 21 — 프로젝트 CRUD API 템플릿

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-03 |
| 작업 | P1-13 프로젝트 목록·생성·조회·수정·삭제, 생성 시 OWNER 멤버 + MASTER 트랙 트랜잭션, 권한 검사 (**템플릿**). 이전 문서: [20_inquiry_api_template.md](20_inquiry_api_template.md) |
| 브랜치 | `feature/phase1/p1-13-project-api` (P1-12 브랜치에서 갈라짐 → **앞 PR 먼저 병합**) |
| 원칙 | 백엔드는 **템플릿만** — 라우터·스키마·함수 이름과 TODO. 실제 구현은 사용자 |

---

## 1. 무엇을 만들었나
| 파일 | 상태 | 내용 |
|---|---|---|
| `app/api/v1/projects.py` | 템플릿 (새 파일) | 라우터 5개 (§2.1) |
| `app/api/v1/router.py` | 수정 | `/projects` 연결 |
| `app/schemas/project.py` | 완성 + TODO | `ProjectSort`, `ProjectCreateRequest`, `ProjectUpdateRequest`, `ProjectItem`, `ProjectListResponse`. 박자 분모 검사만 TODO |
| `app/services/project_service.py` | 템플릿 (새 파일) | `get_membership`, `require_role`, `to_item`, `list_projects`, `create_project`, `update_project`, `delete_project` |
| `tests/test_project_routes.py` | 완성 (새 파일) | 주소 연결 확인 |

## 2. 왜 이렇게 했나
### 2.1 API
| Method | Path | 권한 | 성공 |
|---|---|---|---|
| GET | `/projects?query=&sort=&page=&size=` | 로그인 | 200 `{items, total, page, size}` |
| POST | `/projects` | 로그인 | 201 `ProjectItem` |
| GET | `/projects/{id}` | 멤버 | 200 `ProjectItem` |
| PATCH | `/projects/{id}` | OWNER · EDITOR | 200 `ProjectItem` |
| DELETE | `/projects/{id}` | OWNER | 204 |

- `sort`(`updated` / `title` / `created`)는 화면 정렬 메뉴 값과 같고, PRD 01 §7 표에는 없던 칸입니다. 화면(`myproject.js`)이 이미 보내고 있어 받도록 했습니다.
- `ProjectItem`의 칸 이름은 `myproject.js` `renderProjects` 주석의 응답 예시와 맞췄습니다 (`my_role`, `member_count`, `opened`).

### 2.2 생성은 한 트랜잭션 (FR-122)
```
db.add(Project) → db.flush()      ← project_id 받기 (아직 commit 아님)
db.add(ProjectMember role=OWNER)
db.add(Track type=MASTER)
db.commit()                        ← 셋 다 저장, 중간 오류면 rollback 으로 셋 다 취소
```
MASTER 트랙 없이 프로젝트만 생기면 시퀀서가 마스터 출력을 찾지 못하므로, 셋이 함께 저장되거나 함께 취소되어야 합니다.

### 2.3 권한 검사
| 단계 | 함수 | 실패 |
|---|---|---|
| 프로젝트가 있고 삭제되지 않았나 | `get_membership` | 404 |
| 내가 멤버인가 | `get_membership` | **404** (403 아님) |
| 역할이 맞나 | `require_role` | 403 `FORBIDDEN` |

멤버가 아닐 때 403을 주면 "이 번호의 프로젝트가 있다"는 사실이 드러납니다. 그래서 없는 프로젝트와 같은 404를 권장합니다.

## 3. 검증 결과 (2026-10-03)
| 확인 | 결과 |
|---|---|
| `pytest` | 12개 통과 |
| `ruff check` | 통과 |
| OpenAPI | `/projects`(GET·POST), `/projects/{project_id}`(GET·PATCH·DELETE) 표시 |

## 4. 남은 일 (사용자)
| 순서 | 할 일 | 파일 |
|---|---|---|
| 1 | `Project`, `ProjectMember`, `Track` 모델 컬럼 (P1-03 TODO) | `app/models/project.py`, `track.py` |
| 2 | 서비스 함수 7개 | `app/services/project_service.py` |
| 3 | 라우터 본문 5개 | `app/api/v1/projects.py` |
| 4 | 화면 연결 (목록·새 프로젝트·수정·삭제) | `static/js/pages/myproject.js` |
| 5 | 테스트: 다른 사람 프로젝트 접근 차단 (P1-18) | `tests/` |

> `opened`(FR-130)는 `ProjectSession` 모델이 필요합니다. 모델은 P1-16 템플릿에서 추가하므로, 그 전에는 `False`로 두어도 됩니다.

## 5. 자주 받을 질문 대비
- **Q. `flush`와 `commit`의 차이는?** `flush`는 SQL을 DB로 보내 `project_id`를 받지만 트랜잭션은 열린 채로 둡니다. `commit`이 되어야 다른 연결에서도 보이고, 그 전에 `rollback`하면 모두 취소됩니다.
- **Q. 검색에 `ilike`를 쓰는 이유는?** 대소문자를 구분하지 않고 찾기 위해서입니다. 검색어에 `%`나 `_`가 있으면 와일드카드로 해석되므로 escape를 권장합니다.
- **Q. 정렬 뒤에 `project_id`를 하나 더 붙이는 이유는?** 수정 시각이 같은 행이 있으면 페이지를 넘길 때 순서가 바뀌어 같은 항목이 두 번 보이거나 빠질 수 있습니다.
