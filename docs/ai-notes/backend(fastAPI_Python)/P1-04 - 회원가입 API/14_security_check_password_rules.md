# Backend(FastAPI/Python) 14 — `check_password_rules()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/core/security.py` |
| 작업 | P1-04 회원가입 — 비밀번호 규칙 · PRD 01 FR-102 |
| 작성 | Claude (AI) · 2026-10-07 · 사용자 검토 |
| 이전 · 다음 | [13 모델 관계](<../P1-03 - 백엔드 공통/13_models_relationships.md>) (P1-03 끝) · [15 `hash_password()`](15_security_hash_password.md) |

## 1. 하는 일
비밀번호가 규칙 6가지 중 **무엇을 어겼는지** 이름 목록으로 돌려준다. 빈 목록이면 통과다.

`check_password_rules("abcdefgh")` → `["upper", "number", "special"]`

| 이름 | 규칙 | join.html 조건 목록의 줄 |
|---|---|---|
| `length` | 8 ~ 20자 | 8–20 characters |
| `upper` | 대문자 1개 이상 | Uppercase letter |
| `lower` | 소문자 1개 이상 | Lowercase letter |
| `number` | 숫자 1개 이상 | Number |
| `special` | 키보드 기호 1개 이상 (`!@#$%^&*` 등) | Special character (!@#$…) |
| `allowed` | 영문 · 숫자 · 키보드 기호만 (한글 · 공백 불가) | (목록에 없음 — 칸 아래 오류 문구) |

## 2. 언제 쓰나
| 쓰는 곳 | 하는 일 |
|---|---|
| P1-04 `signup()` (08) | 가입 요청의 비밀번호 검사. 실패하면 422 |
| P1-09 `change_password()` | 새 비밀번호 검사 (같은 규칙) |

브라우저도 같은 규칙으로 검사한다 (`join.js` 의 `PASSWORD_RULES`, P1-07). 입력할 때마다 조건 목록에 ✓ 를 붙인다. **서버가 한 번 더 검사하는 이유:** 브라우저 검사는 개발자 도구나 직접 만든 요청으로 건너뛸 수 있다.

실패하면 `signup()` 이 이 목록을 그대로 담아 응답한다.
```json
422 {"error": {"code": "VALIDATION_ERROR", "message": "Check the password requirements.",
               "details": {"password": ["upper", "number", "special"]}}}
```
화면은 `details.password` 의 이름으로 join.html 조건 목록의 해당 줄(`li[data-rule="upper"]` 등)을 표시할 수 있다.

## 3. 코드
**import** (파일 맨 위)
```python
import re
import string

import jwt

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
```
`security.py` 맨 위의 import 이다. **`re` · `string` 두 줄을 이번에 추가했고**, 이 함수는 그 둘만 쓴다. 둘 다 파이썬 기본 모듈이라 설치가 필요 없다.

| import | 가져오는 것 | 쓰는 곳 |
|---|---|---|
| `re` | 정규식 (글자 패턴 찾기) | 대문자 · 소문자 · 숫자 · 허용 문자 검사 |
| `string` | 자주 쓰는 글자 모음 | `string.punctuation` — 키보드 기호 32개 |

**함수**
```python
PASSWORD_MIN, PASSWORD_MAX = 8, 20


def check_password_rules(plain: str) -> list[str]:
    failed: list[str] = []
    if not PASSWORD_MIN <= len(plain) <= PASSWORD_MAX:
        failed.append("length")
    if not re.search(r"[A-Z]", plain):
        failed.append("upper")
    if not re.search(r"[a-z]", plain):
        failed.append("lower")
    if not re.search(r"[0-9]", plain):
        failed.append("number")
    if not any(ch in string.punctuation for ch in plain):
        failed.append("special")
    if not re.fullmatch(r"[!-~]+", plain):
        failed.append("allowed")
    return failed
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `import 모듈` | 모듈 전체를 가져와 `모듈.이름` 으로 씀 (예: `re.search`, `string.punctuation`) |

| 식 | 뜻 |
|---|---|
| `PASSWORD_MIN, PASSWORD_MAX = 8, 20` | 두 변수에 한 번에 넣음 (`PASSWORD_MIN = 8`, `PASSWORD_MAX = 20`) |
| `8 <= len(plain) <= 20` | 파이썬은 비교를 이어 쓸 수 있음. `8 <= len(plain) and len(plain) <= 20` 과 같음 |
| `r"[A-Z]"` | 정규식. `[A-Z]` = A 부터 Z 중 한 글자. 앞의 `r` 은 `\` 를 글자 그대로 쓰겠다는 표시 |
| `re.search(패턴, 글)` | 글 **어딘가에** 패턴이 있으면 결과, 없으면 `None`. `not None` 은 `True` |
| `re.fullmatch(패턴, 글)` | 글 **전체가** 패턴과 맞아야 결과 |
| `[!-~]+` | `!`(33번) 부터 `~`(126번) 까지의 글자가 1개 이상. 영문 · 숫자 · 키보드 기호가 모두 이 범위다. 한글 · 공백(32번)은 범위 밖 |
| `any(ch in string.punctuation for ch in plain)` | 글자를 하나씩 보며 기호인 것이 **하나라도** 있으면 `True` |

| 입력 | 결과 |
|---|---|
| `"Abcdef1!"` | `[]` (통과) |
| `"Ab1!xyz"` (7자) | `["length"]` |
| `"abcdefgh"` | `["upper", "number", "special"]` |
| `"Abcdef1!한"` | `["allowed"]` |
| `"Abc def1!"` (공백) | `["allowed"]` |
| `""` | 6개 모두 |

## 4. 흐름
1. 빈 목록 `failed` 를 만든다.
2. 규칙 6개를 **차례대로 모두** 검사하고, 어긴 것의 이름을 넣는다.
3. 목록을 돌려준다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 처음 실패에서 멈추지 않고 모두 검사 | 화면이 어긴 조건을 한 번에 모두 표시할 수 있다 |
| `True`/`False` 가 아니라 이름 목록 | 화면의 조건 줄 이름(`data-rule`)과 같아서 그대로 연결된다 |
| 이 함수는 오류를 던지지 않음 | 가입(08)과 비밀번호 변경(P1-09)이 같은 함수를 쓰고, 오류 응답은 각자 만든다 |
| 기호는 `string.punctuation` | 파이썬이 정해 둔 키보드 기호 32개(`!"#$%&'()*+,-./:;<=>?@[\]^_`{\|}~`)다. `join.js` 의 `/[!-/:-@[-`{-~]/` 와 같은 모음인지 시험으로 확인했다 |
| 최대 20자 | PRD FR-102. bcrypt(15)는 72바이트까지만 쓰므로 그보다 충분히 짧다 |

## 6. 시험 (`tests/test_password.py`, 새로 만듦 · 16개)
| 시험 | 확인한 것 |
|---|---|
| 통과 4개 | 8자 · 20자 · 반복 글자 · 밑줄 기호 → `[]` |
| 실패 10개 | 7자 · 21자 · 대문자 없음 · 소문자 없음 · 숫자 없음 · 기호 없음 · 한글 · 공백 · 여러 개 동시 · 빈 글자 → 위 표의 목록 |
| 모든 기호 | `string.punctuation` 32개 각각이 `special` 로 인정됨 |
| 화면과 같은 규칙 | ASCII 33 ~ 126 에서 영문 · 숫자를 뺀 모음 = `string.punctuation` (= `join.js` 정규식) |

전체 시험 92개 통과, `ruff` 검사 통과.
