# Backend(FastAPI/Python) 92 — `setup_admin()` (관리자 화면 붙이기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/admin.py`, `app/core/config.py`, `studionx/.env.example` |
| 작업 | P1-21 공지 API와 관리자 화면: 만든 로그인과 세 화면을 `/admin`에 실제로 연결 (PRD 01 FR-115) |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 이전 · 다음 | [91 `UserAdmin`](91_admin_user_admin.md) · (P1-21 끝, 실제 화면 시험은 개요 문서에서) |

## 1. 하는 일
86~91번에서 만든 부품을 한 곳에 모아 **SQLAdmin 관리자 화면**을 서버에 붙입니다. `main.py`가 이미 이 함수를 부르고 있어서(정적 파일 마운트보다 앞), 이 함수를 채우면 서버가 켜질 때 `/admin`이 생깁니다.

| 항목 | 내용 |
|---|---|
| 주소 | 설정 `admin_path` (기본 `/admin`) |
| 로그인 | `AdminAuth` (ADMIN 계정만, 세션 쿠키 서명은 `jwt_secret`) |
| 화면 | 공지(`DevNoteAdmin`), 문의(`InquiryAdmin`), 회원(`UserAdmin`) |
| 제목 | "Studio Nx Admin" |

**주소를 설정으로 뺐습니다 (사용자 결정, 2026-10-13).** 개발 중에는 `/admin` 그대로 두고, 배포할 때 `.env`의 `ADMIN_PATH`를 추측하기 어려운 값으로 바꿉니다.

```
# .env (배포 때)
ADMIN_PATH=/ops-7f3a9c1e
```

| `ADMIN_PATH` 값 | 결과 |
|---|---|
| `/admin` (기본) | `/admin/login` |
| `/ops-7f3a9c1e` 또는 끝에 `/`가 있는 `/ops-7f3a9c1e/` | `/ops-7f3a9c1e/login` (`/admin`은 열리지 않음) |
| `admin`(슬래시 없음), `/`, 빈 값, `/api/v1…` | 서버가 켜질 때 `ValueError` |

## 2. 언제 쓰나
| 호출하는 곳 | 시점 |
|---|---|
| `main.py`의 `setup_admin(app)` | 서버가 켜질 때 한 번 |

## 3. 코드
**import** (이번에 추가한 것)
```python
from sqladmin import Admin, ModelView
from app.core.config import get_settings
from app.db.session import SessionLocal, engine
```

**설정** (`app/core/config.py`)
```python
admin_path: str = "/admin"
```

**함수**
```python
def setup_admin(app: FastAPI) -> Admin:
    settings = get_settings()
    path = settings.admin_path
    if (
        not path.startswith("/")
        or len(path) < 2
        or path.rstrip("/").startswith(settings.api_prefix)
    ):
        raise ValueError(f"ADMIN_PATH is not usable: {path!r}")
    admin = Admin(
        app,
        engine,
        base_url=path.rstrip("/"),
        authentication_backend=AdminAuth(secret_key=settings.jwt_secret),
        title="Studio Nx Admin",
    )
    admin.add_view(DevNoteAdmin)
    admin.add_view(InquiryAdmin)
    admin.add_view(UserAdmin)
    return admin
```
백엔드(Python)는 지금 방식 그대로여서 "최신 문법" 버전은 따로 두지 않습니다.

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `Admin(app, engine, ...)` | `app`에 SQLAdmin을 붙입니다. `engine`은 DB 연결이며, 이 프로젝트는 동기 엔진이라 `session_maker`도 동기 방식입니다 |
| `base_url=path.rstrip("/")` | 관리자 화면의 주소입니다. 끝의 `/`는 지웁니다 |
| `authentication_backend=AdminAuth(...)` | 로그인 방식입니다. 이것이 있으면 모든 `/admin/…` 요청에서 `authenticate`(87번)가 먼저 불립니다 |
| `secret_key=settings.jwt_secret` | 세션 쿠키 서명용 비밀값입니다. `.env`의 `JWT_SECRET`을 함께 씁니다 |
| `admin.add_view(클래스)` | 화면 하나를 등록합니다. 주소는 `/admin/dev-note/list`처럼 모델 이름으로 정해집니다 |
| `path.rstrip("/").startswith(settings.api_prefix)` | 관리자 주소가 API 주소 아래에 들어가는 실수를 막습니다 |
| `-> Admin` | 만든 `Admin` 객체를 돌려줍니다. 시험이 등록된 화면을 확인하는 데 씁니다 |

## 4. 흐름
1. 설정에서 관리자 주소를 읽고, 쓸 수 없는 값이면 서버를 켜지 않습니다.
2. `Admin`을 만들어 `app`에 `/admin`(또는 설정한 주소)으로 붙입니다.
3. 화면 셋을 등록합니다.
4. 이후 `/admin/…` 요청은 모두 `AdminAuth.authenticate`를 거치고, 통과하지 못하면 로그인 화면으로 갑니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 주소를 설정값 `ADMIN_PATH`로 | 배포할 때 코드 수정 없이 `.env`만 바꿔서 주소를 숨길 수 있습니다 |
| 잘못된 주소는 서버를 켤 때 오류 | 배포 설정 실수를 운영 중에 알게 되는 것보다 시작할 때 바로 알아야 합니다 |
| IP 제한은 두지 않음 | 서버(앱) 안에서 IP를 믿고 거르는 것은 프록시 설정에 달려 있어서 위험하고, 앞단(Nginx 등)에서 거는 것이 맞습니다. 배포 준비 때 정합니다 |
| `jwt_secret`을 세션 서명에 같이 씀 | 비밀값을 하나만 관리합니다. 서명용이라 값이 달라도 API 토큰과 쿠키가 서로 통하지 않습니다 |
| `Admin`을 돌려줌 | 시험이 화면 등록과 인증 방식을 확인할 수 있습니다 |
| 앞으로 `JWT_SECRET`이 `change-me`인 채 운영하면 안 됨 | 세션 쿠키 서명이 추측되기 때문입니다. `.env.example`에 이미 안내가 있고, 배포 준비 때 다시 확인합니다 |

## 6. 시험 (`tests/test_setup_admin.py`, 11개)
| 시험 | 결과 |
|---|---|
| 작은 앱에 붙이면 화면 3개(`dev-note`, `inquiry`, `user`)와 `AdminAuth`가 등록되고 `/admin`이 생김 | 통과입니다 |
| `ADMIN_PATH=/ops-7f3a9c1e/`이면 `/ops-7f3a9c1e/login`은 열리고 `/admin/login`은 404 | 통과입니다 |
| `admin`, `/`, 빈 값, `/api/v1`, `/api/v1/admin` | 모두 `ValueError` |
| 실제 앱: 로그인하지 않고 `/admin/`, 공지, 문의, 회원 목록 | 모두 로그인 화면으로 이동 |
| 실제 앱: `/admin/login` | 200, "Studio Nx Admin" |
| 실제 앱: 없는 계정으로 로그인 | 400, 로그인 쿠키 없음 |
| 실제 앱: API, 홈 화면, 없는 페이지는 그대로 | 통과입니다 |

11개 모두 통과했습니다. 백엔드 전체 pytest와 `ruff`도 통과했습니다. 로그인한 뒤의 화면 흐름은 서버를 띄워서 확인합니다 ([개요 문서의 시험](../../60_p1-21_site_test.md)).
