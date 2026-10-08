# Backend(FastAPI/Python) 50 — `InquiryCreateRequest` (문의 요청 스키마)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/schemas/inquiry.py` |
| 작업 | P1-12 문의 API — 요청 본문 검사 · PRD 01 FR-112 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [49 `purge_withdrawn_accounts()`](<../P1-09 - 비밀번호 변경·탈퇴/49_retention_purge_withdrawn_accounts.md>) · [51 `check_rate_limit()`](51_inquiry_service_rate_limit.md) |

## 1. 하는 일
홈 화면 **Contact** 폼이 보내는 JSON `{ email, title, content, privacy_agreed }` 의 **모양**을 검사한다. 틀리면 서비스까지 가지 않고 422.

| 보낸 값 | 결과 |
|---|---|
| `"  you@example.com "` | 통과 → `"you@example.com"` (앞뒤 공백 제거) |
| 이메일 `abc` · `kim@naver` · `a@b@c.com` · 빈 글자 | 422 · `details.email` |
| 제목 `"  Bug report  "` | 통과 → `"Bug report"` |
| 제목 · 내용이 빈 글자 · 공백만 · 줄바꿈만 | 422 · 그 칸 |
| 내용 `"\n  line 1\nline 2  \n"` | 통과 → `"line 1\nline 2"` — **가운데 줄바꿈은 그대로** |
| 제목 201자 · 내용 2001자 | 422 (앞뒤 공백은 길이에 안 셈) |
| `privacy_agreed` 없음 | 422 — `false` 는 여기서 통과, 서비스(52)가 422 로 막음 |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `POST /api/v1/inquiries` (53) | 라우터 매개변수 `data: InquiryCreateRequest` — 틀리면 함수가 불리지도 않고 422 (P1-03 03 처리기) |
| 화면 | home.html Contact 폼 (`initContactForm`, 이 작업이 끝나면 연결). 화면도 `type="email"` · `required` · `maxlength` 로 먼저 막고, FIX-01 19 가 말풍선 대신 알림창으로 보여 줌 |

## 3. 코드
**import** (파일 맨 위)
```python
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints
```
**`Annotated` · `EmailStr` · `StringConstraints` 를 이번에 추가했다.**

**상수 · 타입**
```python
INQUIRY_TITLE_MAX = 200  # 화면 input maxlength 와 같음
INQUIRY_CONTENT_MAX = 2000  # 화면 textarea maxlength 와 같음

# 제목 · 내용 — 앞뒤 공백을 먼저 지우고 길이를 잼 → 공백만 친 칸은 422
# (닉네임 Nickname 과 같은 방법)
# 내용 가운데의 줄바꿈은 그대로 둠
InquiryTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=INQUIRY_TITLE_MAX)
]
InquiryContent = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=INQUIRY_CONTENT_MAX)
]
```

**스키마**
```python
class InquiryCreateRequest(BaseModel):
    email: EmailStr = Field(max_length=255)  # 형식 검사 · 앞뒤 공백 제거 (email-validator)
    title: InquiryTitle
    content: InquiryContent
    privacy_agreed: bool
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from typing import Annotated` | 타입에 **검사 규칙을 붙인** 새 타입 이름을 만들 때 |
| `from pydantic import EmailStr, StringConstraints` | 이메일 형식 타입 (P1-04 와 같음, `email-validator` 패키지) · 글자 규칙 묶음 |

| 식 | 뜻 |
|---|---|
| `Annotated[str, StringConstraints(…)]` | "글자인데, 이 규칙을 지켜야 함" — 변수처럼 이름(`InquiryTitle`)을 붙여 여러 곳에 씀 |
| `strip_whitespace=True` | 앞뒤 공백 · 줄바꿈 · 탭을 **먼저** 지움 → 그다음 `min_length` · `max_length` 검사 |
| `EmailStr = Field(max_length=255)` | 이메일 형식 + 길이 (DB 칸 255자) |
| `privacy_agreed: bool` | 반드시 있어야 함 (기본값 없음). `true` 인지는 서비스가 봄 |

## 4. 흐름
요청 JSON → pydantic 이 칸마다 검사 (이메일 형식 · 공백 제거 · 길이 · 동의 칸 있음) → 통과하면 깨끗한 값이 든 객체로 라우터에 전달, 하나라도 틀리면 422 + `details` 에 틀린 칸.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 이메일 형식 검사 = `EmailStr` | 템플릿 요구 "P1-04 SignupRequest 와 같은 방법". 답장할 주소이므로 형식이 틀리면 받을 의미가 없다 |
| 제목 · 내용을 **공백 제거 후** 검사 | 템플릿대로(`min_length=1`)면 공백 한 칸짜리 문의가 저장된다. 닉네임(P1-08 37)과 같은 빈틈 |
| 제거는 앞뒤만 | 내용 안의 줄바꿈 · 문단은 문의의 일부 — 그대로 둔다 (시험으로 확인) |
| 길이 상수를 화면과 같게 (`INQUIRY_TITLE_MAX` 새로) | 화면 `maxlength` 200 · 2000 과 서버가 어긋나지 않게. 제목 길이는 템플릿에 숫자로만 있었다 |
| 이메일을 소문자로 바꾸지 않음 | 문의는 중복 확인 · 로그인에 쓰지 않는다. 사람이 적은 그대로 보관 (반복 전송 제한(51)이 비교할 때만 소문자로) |
| `privacy_agreed=false` 는 여기서 막지 않음 | 템플릿 설계 — 서비스(52)가 "Please agree to the privacy policy." 와 `details.privacy_agreed` 로 알려 줌 (가입과 같은 방식) |

**함께 생기는 변화:** 52 `create_inquiry` 템플릿의 `data.title.strip()` 은 이제 할 필요가 없다 (이미 지운 값).

## 6. 시험 (`tests/test_inquiry_schemas.py` 새 파일 · 16개)
| 시험 | 확인한 것 |
|---|---|
| 정상 | 네 칸 그대로 |
| 공백 제거 | 제목 앞뒤 제거, 내용 앞뒤 제거 · 가운데 줄바꿈 유지, 이메일 앞뒤 제거 |
| 이메일 4가지 | `@` 없음 · 점 없음 · `@` 둘 · 빈 글자 → `email` 오류 |
| 빈 제목 · 내용 6가지 | 빈 글자 · 공백만 · 줄바꿈만 × 두 칸 → 그 칸 오류 |
| 길이 | 200 · 2000 통과, 201 · 2001 오류, 앞뒤 공백 + 2000 통과 |
| 동의 칸 없음 | 오류 |

전체 시험 368개 통과, `ruff` 검사 통과.
