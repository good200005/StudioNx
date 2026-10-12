# Backend(FastAPI/Python) 50 — `InquiryCreateRequest` (문의 요청 스키마)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/schemas/inquiry.py` |
| 작업 | P1-12 문의 API: 요청 본문 검사 (PRD 01 FR-112) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [49 `purge_withdrawn_accounts()`](<../P1-09 - 비밀번호 변경·탈퇴/49_retention_purge_withdrawn_accounts.md>) · [51 `check_rate_limit()`](51_inquiry_service_rate_limit.md) |

## 1. 하는 일
홈 화면의 **Contact** 폼이 보내는 JSON `{ email, title, content, privacy_agreed }`의 **모양**을 검사합니다. 값이 틀리면 서비스까지 가지 않고 422로 응답합니다.

| 보낸 값 | 결과 |
|---|---|
| `"  you@example.com "` | 통과하고, 앞뒤 공백을 지운 `"you@example.com"`이 됩니다 |
| 이메일이 `abc`, `kim@naver`, `a@b@c.com`, 빈 문자열 | 422이고, `details.email`에 오류가 담깁니다 |
| 제목 `"  Bug report  "` | 통과하고, `"Bug report"`가 됩니다 |
| 제목이나 내용이 빈 문자열, 공백만, 줄바꿈만 | 422이고, 해당 칸에 오류가 담깁니다 |
| 내용 `"\n  line 1\nline 2  \n"` | 통과하고 `"line 1\nline 2"`가 됩니다. **가운데 줄바꿈은 그대로 남습니다** |
| 제목 201자, 내용 2001자 | 422입니다 (앞뒤 공백은 길이에 세지 않습니다) |
| `privacy_agreed`가 없음 | 422입니다. `false`는 여기서 통과하고, 서비스(52)가 422로 막습니다 |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `POST /api/v1/inquiries` (53) | 라우터 매개변수 `data: InquiryCreateRequest`로 씁니다. 값이 틀리면 함수가 호출되지도 않고 422로 응답합니다 (P1-03 03번 처리기) |
| 화면 | home.html의 Contact 폼(`initContactForm`, 이 작업이 끝나면 연결)입니다. 화면도 `type="email"`, `required`, `maxlength`로 먼저 막고, FIX-01 19번이 브라우저 말풍선 대신 알림창으로 보여 줍니다 |

## 3. 코드
**import** (파일 맨 위)
```python
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints
```
**`Annotated`, `EmailStr`, `StringConstraints`를 이번에 추가했습니다.**

**상수와 타입**
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
| `from typing import Annotated` | 타입에 **검사 규칙을 붙인** 새 타입 이름을 만들 때 씁니다 |
| `from pydantic import EmailStr, StringConstraints` | 앞은 이메일 형식 타입(P1-04와 같음, `email-validator` 패키지)이고, 뒤는 글자 규칙 묶음입니다 |

| 식 | 뜻 |
|---|---|
| `Annotated[str, StringConstraints(…)]` | "문자열이지만 이 규칙을 지켜야 한다"는 뜻입니다. 변수처럼 이름(`InquiryTitle`)을 붙여 여러 곳에서 씁니다 |
| `strip_whitespace=True` | 앞뒤의 공백, 줄바꿈, 탭을 **먼저** 지우고, 그다음에 `min_length`와 `max_length`를 검사합니다 |
| `EmailStr = Field(max_length=255)` | 이메일 형식과 길이(DB 칸 255자)를 함께 검사합니다 |
| `privacy_agreed: bool` | 반드시 있어야 하는 칸입니다 (기본값 없음). 값이 `true`인지는 서비스가 확인합니다 |

## 4. 흐름
요청 JSON이 들어오면 pydantic이 칸마다 이메일 형식, 공백 제거, 길이, 동의 칸 존재 여부를 검사합니다. 모두 통과하면 정리된 값이 담긴 객체가 라우터로 전달되고, 하나라도 틀리면 422와 함께 `details`에 틀린 칸이 담깁니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 이메일 형식 검사에 `EmailStr` 사용 | 템플릿이 "P1-04 SignupRequest와 같은 방법"을 요구했습니다. 답장을 보낼 주소이므로 형식이 틀리면 받을 의미가 없습니다 |
| 제목과 내용을 **공백을 지운 뒤** 검사 | 템플릿대로(`min_length=1`) 두면 공백 한 칸짜리 문의가 저장됩니다. 닉네임(P1-08 37)에 있던 것과 같은 빈틈입니다 |
| 앞뒤 공백만 지움 | 내용 안의 줄바꿈과 문단은 문의 내용의 일부라서 그대로 둡니다 (시험으로 확인했습니다) |
| 길이 상수를 화면과 같게 맞춤 (`INQUIRY_TITLE_MAX` 신설) | 화면의 `maxlength`(200, 2000)와 서버 기준이 어긋나지 않게 했습니다. 제목 길이는 템플릿에 숫자로만 적혀 있었습니다 |
| 이메일을 소문자로 바꾸지 않음 | 문의 이메일은 중복 확인이나 로그인에 쓰지 않으므로, 사람이 적은 그대로 보관합니다 (반복 전송 제한(51)이 비교할 때만 소문자로 바꿉니다) |
| `privacy_agreed=false`는 여기서 막지 않음 | 템플릿의 설계를 따랐습니다. 서비스(52)가 "Please agree to the privacy policy."와 `details.privacy_agreed`로 알려 줍니다 (가입과 같은 방식) |

**함께 생기는 변화:** 52번 `create_inquiry` 템플릿에 있던 `data.title.strip()`은 이제 하지 않아도 됩니다. 이미 공백이 지워진 값이 오기 때문입니다.

## 6. 시험 (`tests/test_inquiry_schemas.py` 새 파일, 16개)
| 시험 | 확인한 것 |
|---|---|
| 정상 | 네 칸이 그대로 들어옵니다 |
| 공백 제거 | 제목의 앞뒤 공백을 지우고, 내용도 앞뒤만 지우며 가운데 줄바꿈은 유지하고, 이메일의 앞뒤 공백도 지웁니다 |
| 이메일 4가지 | `@` 없음, 점 없음, `@` 두 개, 빈 문자열은 모두 `email` 오류입니다 |
| 빈 제목과 내용 6가지 | 빈 문자열, 공백만, 줄바꿈만인 경우를 두 칸에 각각 넣으면 해당 칸 오류입니다 |
| 길이 | 200자와 2000자는 통과하고, 201자와 2001자는 오류이며, 앞뒤 공백을 붙인 2000자는 통과합니다 |
| 동의 칸 없음 | 오류입니다 |

전체 시험 368개가 통과했고, `ruff` 검사도 통과했습니다.
