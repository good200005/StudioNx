# Backend(FastAPI/Python) 52 — `create_inquiry()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/inquiry_service.py` |
| 작업 | P1-12 문의 API — 문의 저장 · PRD 01 FR-112 · FR-113 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [51 `check_rate_limit()`](51_inquiry_service_rate_limit.md) · [53 `POST /inquiries`](53_inquiries_route_create.md) |

## 1. 하는 일
홈 화면 Contact 폼의 문의를 `inquiries` 표에 저장한다.

| 상황 | 결과 |
|---|---|
| 로그인하지 않은 사람 | 저장 — `user_id` 없음, 상태 `RECEIVED`, 동의 시각 = 지금 |
| 로그인한 회원 | 저장 — `user_id` 연결, 이메일은 **폼에 적은 답장 주소** 그대로 |
| 처리방침 동의 안 함 | 422 "Please agree to the privacy policy." · `details.privacy_agreed: "required"` — 저장 · 세기 없음 |
| 10분에 3번째 | 429 (51) — 저장 안 됨 |
| 저장 실패 (DB 오류) | 오류 그대로 — 반복 전송으로 **세지 않음** |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `POST /api/v1/inquiries` (53) | 라우터가 로그인한 회원(없으면 `None`)과 IP 를 넘김 |
| 답변 | 관리자 화면(SQLAdmin `/admin`, P1-21)에서 `answer` · `answered_at` · 상태를 채움 |
| 보관 기간 | 답변 뒤 1년 지나면 지움 — 54 `purge_old_inquiries` |

## 3. 코드
**import** (파일 맨 위)
```python
import threading
import time
from collections import deque
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models import Inquiry, User
from app.schemas.inquiry import InquiryCreateRequest
```
**`from datetime import UTC, datetime` 을 이번에 추가했다.**

**함수**
```python
def create_inquiry(
    db: Session,
    data: InquiryCreateRequest,
    user: User | None,
    ip: str | None,
) -> Inquiry:
    if not data.privacy_agreed:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            422,
            "Please agree to the privacy policy.",
            details={"privacy_agreed": "required"},
        )
    check_rate_limit(ip, data.email)

    inquiry = Inquiry(
        user_id=user.user_id if user else None,
        email=data.email,
        title=data.title,
        content=data.content,
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)
    record_inquiry_send(ip, data.email)
    return inquiry
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `user: User \| None` | 로그인한 회원 또는 `None` (P1-03 06 `OptionalUser`) |
| `user.user_id if user else None` | 조건식 — 회원이 있으면 번호, 없으면 `None` |
| `datetime.now(UTC).replace(tzinfo=None)` | UTC 지금 시각, 시간대 표시는 뗌 (DB 는 늘 UTC) |
| `db.refresh(inquiry)` | DB 가 채운 값(`inquiry_id` · `created_at` · `status`)을 다시 읽음 |

## 4. 흐름
1. 동의 확인 → 아니면 422.
2. 반복 전송 검사 (51) → 넘으면 429.
3. 문의 행을 만들어 저장.
4. 저장에 성공했으면 반복 전송 1번으로 셈.
5. 저장된 문의를 돌려줌.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 동의 검사가 맨 앞 | 동의 없이 온 요청은 반복 전송 검사도 하지 않는다 (세지도 않음) |
| 세기는 `commit` **뒤** | 사용자 결정 — 저장에 실패한 시도는 세지 않음 (51). `commit` 이 오류를 던지면 `record_inquiry_send` 줄까지 오지 않는다 (시험으로 확인) |
| 로그인 회원도 **폼의 이메일**로 저장 | 회원이 다른 주소로 답장을 받고 싶을 수 있다. 회원 연결은 `user_id` 로 따로 남는다 |
| `.strip()` 을 하지 않음 (템플릿에는 있음) | 50 스키마가 이미 앞뒤 공백을 지운 값을 넘긴다 |
| 이름(`name`) 칸은 비워 둠 | 표에는 있지만 화면 폼에 이름 칸이 없다 (DB 는 `NULL` 허용) |
| 상태는 DB 기본값 | `RECEIVED` — 템플릿 · DB 설계 그대로 |
| 관리자 알림 메일 없음 | Phase 1 범위 밖 (템플릿) |

## 6. 시험 (`tests/test_inquiry_service.py` 에 5개 추가 · 모두 17개, 실제 MySQL)
| 시험 | 확인한 것 |
|---|---|
| 비회원 | DB 에 `user_id` 없음 · 이메일 · 제목 · 내용(줄바꿈 포함) · `RECEIVED` · 동의 시각 · `created_at` · 답변 없음, 반복 전송 1번 셈 |
| 회원 | `user_id` 연결, 이메일은 폼에 적은 다른 주소 |
| 동의 안 함 | 422 · 문구 · `details`, 저장 0 · 셈 0 |
| 3번째 | 429, 저장은 2개뿐 |
| 저장 실패 3번 | 오류 그대로, 셈 0 (사용자 결정) |

전체 시험 385개 통과, `ruff` 검사 통과. 시험 뒤 DB 의 문의는 0개.
