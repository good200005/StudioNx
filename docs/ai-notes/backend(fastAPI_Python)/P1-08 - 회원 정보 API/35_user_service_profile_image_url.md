# Backend(FastAPI/Python) 35 — `profile_image_url()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/user_service.py` |
| 작업 | P1-08 회원 정보 — 프로필 사진 주소 · PRD 01 FR-106 |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [34 `POST /auth/logout`](<../P1-05 - 로그인 API/34_auth_route_logout.md>) · [36 `to_me_response()`](36_user_service_to_me_response.md) |

## 1. 하는 일
회원의 프로필 사진 **저장 경로**를 화면이 `<img src>` 에 넣을 **주소**로 바꾼다. 사진이 없으면 `None`.

| `user.profile_image_path` (DB) | 돌려주는 값 |
|---|---|
| `None` · `""` | `None` → 화면은 닉네임 첫 글자를 보여 줌 |
| `"profiles/3f9c2b7e0d1a4c5b8e6f7a9b0c1d2e3f.jpg"` | `"/api/v1/profile-images/3f9c2b7e0d1a4c5b8e6f7a9b0c1d2e3f.jpg"` |

## 2. 언제 쓰나
| 쓰는 곳 | 하는 일 |
|---|---|
| 36 `to_me_response()` | `GET /users/me` 등의 응답 `profile_image_url` 칸 |
| (P1-16) 대시보드 응답 | 프로필 카드 사진 |

### 사용자 결정 (2026-10-07) — 주소에 회원 번호를 넣지 않음
템플릿은 `/api/v1/users/{회원 번호}/profile-image?v=…` 였다. 이 주소는 로그인 없이 열린다(`<img>` 는 토큰을 붙일 수 없음). 그러면 누구나 번호를 1, 2, 3… 바꿔 가며 **그 번호의 회원이 있는지 · 사진이 무엇인지** 볼 수 있다. P1-04 때 정한 **탈퇴 추적 방지 ③ "회원 번호를 받는 공개 API 는 만들지 않음"** 과 어긋나서, 사용자가 **무작위 파일 이름**을 골랐다.

| | 템플릿 | 결정 |
|---|---|---|
| 저장 경로 | `profiles/{회원 번호}/{무작위}.jpg` | `profiles/{무작위 32자}.jpg` |
| 주소 | `/api/v1/users/85/profile-image?v=1696651200` | `/api/v1/profile-images/{무작위 32자}.jpg` |
| 남의 사진 찾아보기 | 번호만 바꾸면 됨 | 32자(16진수 = 2¹²⁸ 가지)를 맞혀야 함 |
| 사진을 바꿨을 때 캐시 | `?v=` 로 해결 | 이름 자체가 바뀌어 필요 없음 |

함께 고친 문서 · 주석: PRD 01 §7 의 API 표, 이 파일의 사진 저장(38) · 사진 파일(40) 템플릿 주석, `users.py` 머리말. 라우터 주소 자체는 43 을 구현할 때 바꾼다.

## 3. 코드
**import** (파일 맨 위)
```python
from pathlib import Path, PurePosixPath

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.user import MeResponse, MeUpdateRequest
```
**`PurePosixPath` 를 이번에 추가했다.**

**상수** (이번에 추가)
```python
# 사진을 두는 폴더 (settings.storage_dir 아래) · 화면이 사진을 받는 주소 앞부분
PROFILE_DIR = "profiles"
PROFILE_IMAGE_URL = "/api/v1/profile-images/"
```

**함수**
```python
def profile_image_url(user: User) -> str | None:
    if not user.profile_image_path:
        return None
    return PROFILE_IMAGE_URL + PurePosixPath(user.profile_image_path).name
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from pathlib import Path, PurePosixPath` | `Path` 는 실제 파일(디스크)용, `PurePosixPath` 는 **글자만** 다루는 경로 — 디스크를 보지 않고, 구분자는 늘 `/` |

| 식 | 뜻 |
|---|---|
| `-> str \| None` | 글자 또는 `None` 을 돌려줌 (Python 3.10 문법) |
| `if not user.profile_image_path:` | `None` 과 빈 글자 `""` 를 함께 걸러 냄 |
| `PurePosixPath("profiles/3f9c….jpg").name` | 마지막 부분 = 파일 이름 `"3f9c….jpg"` |
| `PROFILE_IMAGE_URL + …` | 글자 잇기 |

## 4. 흐름
1. 저장 경로가 없으면 `None`.
2. 있으면 파일 이름만 꺼내 주소 앞부분에 붙여 돌려준다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 파일 이름만 주소에 (폴더 빼고) | 폴더 이름(`profiles`)은 서버 안의 사정이다. 주소는 `/profile-images/` 로 이미 사진임을 말한다 |
| `PurePosixPath` (`Path` 아님) | DB 의 경로는 늘 `/` 로 저장한다(DB.md §1.5 상대 경로). Windows 에서 `Path` 를 쓰면 `\` 구분자로 바뀔 수 있다. 디스크를 볼 필요도 없다 |
| 문자열 자르기(`split('/')[-1]`) 대신 `PurePosixPath` | 뜻이 이름에 드러난다 |
| 주소 앞부분을 상수로 | 40 · 43(사진 파일 라우터)이 같은 주소를 쓴다. 한 곳만 고치면 된다 |
| DB 를 보지 않음 | 이미 가진 `User` 만으로 계산 — 응답을 만들 때마다 부르므로 가볍게 |

## 6. 시험 (`tests/test_user_service.py` 새 파일 · 5개)
| 시험 | 확인한 것 |
|---|---|
| 사진 없음 (`None`) · 빈 글자 | `None` |
| `profiles/{32자}.jpg` · `.webp` | `/api/v1/profile-images/{32자}.jpg` · `.webp` |
| 회원 번호 85 | 주소에 `85` · `/users/` 가 없음 |

전체 시험 239개 통과, `ruff` 검사 통과.
