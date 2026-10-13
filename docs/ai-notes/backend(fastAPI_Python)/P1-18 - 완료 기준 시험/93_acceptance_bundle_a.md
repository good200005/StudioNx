# Backend(FastAPI/Python) 93 — 묶음 A: 가입, 로그인, 마이페이지, 비밀번호, 중복 가입

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/tests/test_phase1_acceptance.py` (묶음 A, 시험 6개) |
| 작업 | P1-18 완료 기준 시험: PRD 01 §10의 1, 2, 3번 완료 기준을 실제 요청으로 확인 |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 (묶음 단위) |
| 이전 · 다음 | (P1-18 첫 묶음) · [94 묶음 B](94_acceptance_bundle_b.md) (다음) |

## 1. 하는 일
작업마다 만든 시험이 가입, 로그인, 대시보드를 **따로따로** 확인하고 있었습니다. 이 묶음은 그것들이 **하나의 흐름으로 이어지는지**와, 기존 시험에 빠져 있던 두 곳(닉네임 중복의 요청 시험, DB 전체의 평문 검사)을 채웁니다. 모든 시험은 실제 앱과 실제 MySQL로 돌고, 시험이 끝나면 되돌려집니다.

| 시험 | 완료 기준 | 확인하는 것 |
|---|---|---|
| `test_a1_signup_login_my_page_one_flow` | 1 | 가입(201) → 로그인(200) → `/users/me` → `/me/dashboard`를 차례로 부릅니다. 프로젝트를 만들면 대시보드의 최근 프로젝트와 이어 하기에 나타나고, 로그인 때 받은 쿠키로 `/auth/refresh`가 새 Access Token을 줍니다 |
| `test_a2_dashboard_and_me_need_login` | 4의 요청 쪽 | `/users/me`, `/me/dashboard`, `/projects`가 토큰 없이 401 `UNAUTHORIZED`입니다 (화면의 로그인 모달 이동은 화면 시험 범위) |
| `test_a3_password_is_never_stored_in_plain_text` | 3 | 해시가 bcrypt 모양(60자, `$2`로 시작)이고 올바른 비밀번호만 통과합니다. 사용자 행의 **모든 칸**에 평문이 없고, 같은 비밀번호도 해시가 다르며(소금), 가입과 로그인 응답에 비밀번호와 해시가 없습니다 |
| `test_a4_duplicate_email_and_nickname_cannot_sign_up` | 2 | 이메일이 같으면 409 `EMAIL_TAKEN`, 닉네임이 같으면 409 `NICKNAME_TAKEN`입니다. 대소문자만 달라도 막히고, 거절된 가입은 행을 남기지 않습니다 |
| `test_a5_signup_creates_no_project_member_rows` | 9의 앞부분 | 가입만으로는 프로젝트 멤버 행이 생기지 않습니다 (OWNER 행은 프로젝트를 만들 때 생깁니다) |
| `test_a6_login_keeps_signup_account_and_updates_last_login` | 1 | 가입 직후 마지막 로그인은 비어 있고, 로그인하면 UTC 현재 시각으로 기록됩니다 |

## 2. 코드 (뼈대 부분)
```python
@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db   # 앱이 시험용 세션을 쓰게 함
    yield TestClient(app)
    app.dependency_overrides.clear()


def sign_up(client, name, **fields):
    return client.post(f"{API}/auth/signup", json=signup_body(name, **fields))

def log_in(client, name, password=PASSWORD, remember=False): ...
def bearer(res):
    return {"Authorization": f"Bearer {res.json()['access_token']}"}
```
`signup_body(name)`은 이메일 `{name}@example.com`, 닉네임 `{name}_nick`을 만듭니다. 시험마다 다른 `name`을 써서 서로 겹치지 않게 합니다.

**평문 검사 부분 (A3)**
```python
for column in inspect(User).columns:
    value = getattr(user, column.key)
    assert PASSWORD not in str(value), column.key
```
| 식 | 뜻 |
|---|---|
| `inspect(User).columns` | `users` 테이블의 모든 칸 목록입니다 |
| `getattr(user, column.key)` | 그 칸의 값을 꺼냅니다 |
| `PASSWORD not in str(value)` | 어느 칸이든 평문이 들어 있으면 실패합니다. 해시 칸만이 아니라 모든 칸을 보므로, 나중에 로그 칸이나 메모 칸이 생겨도 같은 시험이 지켜 줍니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 서비스를 직접 부르지 않고 **HTTP 요청**으로 | 화면이 실제로 쓰는 경로(라우터, 의존성, 오류 처리기)를 모두 지나갑니다 |
| 한 시험에 흐름을 이어서 | 완료 기준이 "가입 → 로그인 → 마이페이지"라는 **연결**이어서, 각 단계가 맞아도 연결이 끊기면 이 시험만 잡습니다 |
| 모든 칸을 검사 | 해시 칸만 보면 다른 칸에 평문이 새는 경우를 놓칩니다 |
| 닉네임 중복을 요청으로 | 서비스 시험은 있었지만 라우터가 409를 올바른 JSON으로 내보내는지는 이 묶음이 처음 확인합니다 |
| 거절된 가입의 행 수 확인 | 가입이 실패했는데 일부 행이 남는 일(트랜잭션 누수)을 막습니다 |

## 4. 결과
6개 모두 처음 돌렸을 때 통과했습니다. 빠진 곳을 메우는 시험이어서, 기존 코드가 이미 완료 기준 1, 2, 3번을 만족한다는 확인이며 코드 수정은 없었습니다.
