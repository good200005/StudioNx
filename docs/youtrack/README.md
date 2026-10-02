# YouTrack 작업 목록 (CSV)

| 항목 | 내용 |
|---|---|
| 파일 | `StudioNx_tasks.csv` (UTF-8, 69행) |
| 원본 | `docs/Implementation_Plan.md` — 계획이 바뀌면 `python docs/_build/make_youtrack_csv.py`로 다시 생성 |
| 작성일 | 2026-10-02 |

## 1. 구성
| 종류(Type) | 개수 | 내용 | 상위 작업(Plan Parent) |
|---|---|---|---|
| Epic | 4 | 1단계 MVP / 2단계 / 3단계 / 병행 C++ | — |
| Feature | 45 | 구현 계획 S1-01~13, S2-01~15, S3-01~13, C-01~04 | 해당 단계 Epic (E1·E2·E3·EC) |
| Task | 20 | Phase 1 세부 작업 P1-01~19 + P1-20(로딩 애니메이션, 보류) | S1-02 / S1-03 / S1-04 |

## 2. 열(Column)
| 열 | 내용 | YouTrack 필드 |
|---|---|---|
| Plan ID | 계획 문서의 작업 번호 (S1-02, P1-05 …) | **매핑하지 않음**(또는 커스텀 필드). 이슈 ID는 YouTrack이 새로 부여 → Summary 앞에도 번호를 넣어 둠 |
| Summary | 번호 + 작업 이름 | Summary |
| Type | Epic / Feature / Task | Type |
| Plan Parent | 상위 작업의 계획 번호 (E1, S1-02 …) | **YouTrack의 Parent 필드에 매핑하면 안 됨** (기존 이슈 번호만 받음) → 매핑하지 않거나 커스텀 필드로. Description 끝에도 `상위 작업: …`으로 적혀 있음 |
| Stage | 1단계 MVP / 2단계 … / 병행 | 커스텀 필드 또는 Tag |
| Priority | Critical / Major / Normal / Minor (계획의 최상/상/중/하) | Priority |
| State | Open / In Progress / To be discussed(보류) | State |
| Owner | AI / 직접 / 사용자 | 커스텀 필드 또는 Tag (Assignee는 직접 지정) |
| Estimation | 계획의 기간 (2주, 3일 …) | Estimation (가져올 때 `2w`, `3d` 형식으로 매핑) |
| Start date / Due Date | 간트차트 날짜 (P1 작업은 비어 있음) | Start date / Due Date |
| Branch | 작업 브랜치 이름 | 커스텀 필드 또는 Description |
| Related | 관련 PRD 요구사항 | Description 또는 커스텀 필드 |
| Description | 설명 + 진행 상황 | Description |

## 3. 가져오는 방법
1. YouTrack에서 프로젝트 만들기 (예: 이름 `Studio Nx`, 키 `SNX`)
2. 프로젝트 설정 → **Import** → CSV 선택 → `StudioNx_tasks.csv`
3. 열을 위 §2 표대로 YouTrack 필드에 매핑 (없는 필드는 커스텀 필드로 만들거나 Tag로)
4. 가져온 뒤 `Plan Parent`(또는 설명의 `상위 작업`)를 보고 **subtask of** 링크 연결 (Epic → Feature → Task)

> ⚠ 오류 `[458-3] The Parent field is not valid for this issue`: 상위 작업 열을 YouTrack의 **Parent** 필드에 매핑했을 때 납니다. 그 열은 매핑에서 빼세요. (2026-10-02 열 이름을 `Plan Parent`로 바꿔 자동 매핑을 막음)

## 4. 현재 진행 상황 (2026-10-02)
| 작업 | State | 메모 |
|---|---|---|
| S1-01 | In Progress | 환경·DB·FastAPI 완료, Sentry DSN만 남음 |
| P1-01 | In Progress | 공통 CSS + 첫 화면 완료, PR #1 리뷰 대기 |
| P1-11 | In Progress | home 구조·첫 화면은 완료, 섹션 내용 남음 |
| P1-20 | To be discussed | 로딩 애니메이션 보류 (레퍼런스 대기) |

## 5. 자동화 스크립트 (`tools/youtrack/`)
인증: 사용자 환경 변수 `YOUTRACK_URL`, `YOUTRACK_TOKEN` (토큰은 `perm-…` 그대로, 앞에 `perm:`을 붙이지 않음). Claude Code를 재시작하지 않아도 Windows 사용자 환경 변수에서 읽음.

| 명령 | 하는 일 |
|---|---|
| `python tools/youtrack/yt.py check` | 연결·프로젝트 목록 확인 |
| `python tools/youtrack/yt.py issues StudioNx` | 이슈 목록 (ID, 계획 번호, 상위 연결) |
| `python tools/youtrack/yt.py link-parents StudioNx [--dry-run]` | 설명의 `상위 작업:` 기준으로 subtask 연결 |
| `python tools/youtrack/yt.py fields StudioNx` | 프로젝트 필드 목록 |
| `python tools/youtrack/yt.py move <원본> <대상> [--dry-run]` | 프로젝트 간 이동 (대상에 없는 필드가 있으면 중단) |
| `python tools/youtrack/migrate_tasks_to_studionx.py setup / move` | (1회성, 완료) StudioNx_tasks → StudioNx 이동 + 필드 변환 |

## 6. 이동 기록 (2026-10-02)
- CSV로 가져온 `StudioNx_tasks`의 69건을 **`StudioNx` 프로젝트로 이동** (이슈 번호 `StudioNx-1` ~ `StudioNx-69`, 계획 번호는 제목 앞과 `Plan ID` 필드에 유지)
- `StudioNx` 필드 구성: Type에 Epic·Feature·Task, State에 In Progress·To be discussed 추가 / Priority(기본 묶음), Due Date(날짜), 예측(기간), Stage·Owner·Branch·Related·Plan ID·Plan Parent·Start date(글자) 연결
- 값 변환: 글자 → 정식 형식 (Estimation `2주` → 예측 `2w`, Due Date → 날짜). 이동 후 69건 값 대조 불일치 0건, 상위 연결 65건 유지
- 비어 있는 `StudioNx_tasks` 프로젝트와 그 전용 글자 필드(Type·State·Priority·Due Date·Estimation)는 YouTrack 관리 화면에서 삭제 가능
