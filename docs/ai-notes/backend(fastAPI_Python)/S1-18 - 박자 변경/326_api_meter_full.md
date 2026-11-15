# 백엔드 326 — 박자 변경점 API와 전체 불러오기 (`api/v1/projects.py`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/projects.py`, `studionx/backend/app/services/full_project_service.py`, `studionx/backend/app/schemas/full_project.py` |
| 작업 | S1-18 박자 줄: 박자 변경점 API와 `GET /full` 연결 (FR-202b) |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 325 서비스, 다음 327 프런트 박자 줄 |

## 1. 하는 일

| 요청 | 권한 | 응답 |
|---|---|---|
| `GET /api/v1/projects/{id}/meter-changes` | 멤버 누구나 | `{ items, total }`, tick 오름차순 |
| `PUT /api/v1/projects/{id}/meter-changes` | OWNER, EDITOR (VIEWER 403) | 교체한 뒤의 `{ items, total }` |
| `GET /api/v1/projects/{id}/full` | 멤버 누구나 | `meter_changes`에 같은 목록을 담습니다 |

`GET /full`은 지금까지 `meter_changes`를 늘 빈 목록으로 내려보냈습니다. 이제 `meter_service.meter_items`로 실제 변경점을 담습니다. 타입도 자유 형식(`dict`)에서 `MeterChangeItem`으로 바꾸었습니다. `markers`만 아직 빈 목록입니다.

## 2. 시험

`studionx/backend/tests/test_meter_routes.py` 22건: 빈 목록, 저장 후 조회와 정렬, 통째 교체, 비우기, `/full` 포함, 권한(VIEWER 403, EDITOR 가능, 비멤버 404, 로그인 필요 401), 잘못된 값 9종과 중복 위치, 501개 초과(422), 경계값(1/1, 32/32). 백엔드 전체 1161건이 통과합니다.

## 3. Q&A

Q. 박자를 바꾸면 이미 놓은 클립 위치도 바뀌나요?
A. 아닙니다. 클립 위치는 tick이라 그대로입니다. 박자는 마디를 어떻게 세는지(메트로놈 강박, 눈금 표시)만 정합니다.
