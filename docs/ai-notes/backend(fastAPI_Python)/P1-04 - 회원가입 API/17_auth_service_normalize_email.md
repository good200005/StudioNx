# Backend(FastAPI/Python) 17 — `normalize_email()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/auth_service.py` |
| 작업 | P1-04 회원가입: 이메일 비교 기준 (PRD 01 FR-101) |
| 작성 | Claude (AI), 2026-10-07, 사용자 검토 |
| 이전 · 다음 | [16 `verify_password()`](16_security_verify_password.md) · [18 `release_withdrawn()`](18_auth_service_release_withdrawn.md) |

## 1. 하는 일
이메일의 **앞뒤 공백을 지우고 소문자로** 바꿉니다. 같은 사람이 다르게 입력한 이메일을 하나의 값으로 맞추기 위해서입니다.

| 입력 | 결과 |
|---|---|
| `"User@Example.COM"` | `"user@example.com"` |
| `"  user@example.com  "` | `"user@example.com"` |
| `"first.last+tag@Mail.Example.com"` | `"first.last+tag@mail.example.com"` (점과 `+`는 그대로 둡니다) |

## 2. 언제 쓰나
이메일을 **DB와 비교하거나 저장하기 전에는 항상** 이 함수를 거칩니다.

| 쓰는 곳 | 하는 일 |
|---|---|
| 19 `check_email()` | join.html 이메일 칸의 실시간 중복 확인 |
| 21 `signup()` | 가입할 때의 중복 확인과 저장 |
| P1-05 `authenticate()` | 로그인 모달에서 입력한 이메일로 회원 찾기 |

**이 함수가 없으면 생기는 문제**

| 순서 | 일어나는 일 |
|---|---|
| ① | A가 `kim@naver.com`으로 가입합니다 |
| ② | B가 `Kim@Naver.com`으로 가입합니다. DB의 `UNIQUE`는 글자가 다르니 통과시킵니다 (MySQL 설정에 따라 다릅니다) |
| ③ | 두 계정이 실제로는 **같은 메일함**을 가리킵니다. 비밀번호 찾기 메일이 엉뚱한 사람에게 갈 수 있습니다 |
| ④ | 또는 A가 로그인할 때 `Kim@naver.com`이라고 입력하면 회원을 찾지 못합니다 |

## 3. 코드
**import** (파일 맨 위)
```python
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.auth import AvailabilityResponse, SignupRequest
```
`auth_service.py` 맨 위의 import입니다. **이 함수는 import한 것을 쓰지 않습니다.** `strip()`과 `lower()`는 파이썬 문자열(`str`)에 기본으로 들어 있는 기능입니다.

**함수**
```python
def normalize_email(email: str) -> str:
    return email.strip().lower()
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from 모듈 import 이름` | 모듈 안의 `이름`만 가져와서 그대로 씁니다 |

| 식 | 뜻 | 예 |
|---|---|---|
| `문자열.strip()` | 앞뒤의 공백, 탭, 줄바꿈을 지웁니다. **가운데는 그대로 둡니다** | `" a b "` → `"a b"` |
| `문자열.lower()` | 모두 소문자로 바꿉니다 | `"Kim@Naver.COM"` → `"kim@naver.com"` |
| `.strip().lower()` | 앞의 결과에 이어서 다음 기능을 부릅니다 (왼쪽부터 차례대로 실행됩니다) | |

## 4. 흐름
1. 앞뒤 공백을 지웁니다.
2. 소문자로 바꿉니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 함수 하나로 모음 | 중복 확인, 가입, 로그인이 **같은 기준**으로 비교해야 합니다. 한 곳이라도 빠지면 §2의 문제가 생깁니다 |
| `@` 앞부분까지 소문자로 바꿈 | 규격상 `@` 앞은 대소문자를 구분할 수 있지만, 네이버나 Gmail 같은 실제 메일 서비스는 구분하지 않습니다. 사람이 대소문자를 섞어 입력해도 같은 계정이 되는 편이 안전합니다 |
| 점과 `+`는 건드리지 않음 | Gmail은 `a.b@`와 `ab@`를 같게 보지만, 다른 서비스는 그렇지 않습니다. 서비스마다 규칙이 달라서 손대지 않습니다 |
| 가운데 공백은 지우지 않음 | `"a b@x.com"`은 틀린 형식입니다. 고쳐 주지 않고, 입력 검사(`EmailStr`, 25)가 422로 돌려보냅니다 |
| 화면이 보낸 값은 그대로 받고 여기서 맞춤 | 브라우저가 무엇을 보내든, 서버가 마지막으로 같은 기준을 지킵니다 |

## 6. 시험 (`tests/test_auth_service.py` 새 파일, 7개)
| 시험 | 확인한 것 |
|---|---|
| 입력 5가지 | 그대로, 대문자, 앞뒤 공백, 탭과 줄바꿈, 점과 `+` 유지가 위 표의 결과와 같습니다 |
| 같은 사람의 다른 입력 | `" Kim@Naver.com"`과 `"kim@naver.com "`이 같은 값이 됩니다 |
| 가운데 공백 | 지우지 않습니다 (`"a b@x.com"`) |

전체 시험 115개가 통과했고, `ruff` 검사도 통과했습니다.
