# Backend(FastAPI/Python) 52 — `create_inquiry()`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/inquiry_service.py` |
| 작업 | P1-12 문의 API: 문의 저장 (PRD 01 FR-112, FR-113) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [51 `check_rate_limit()`](51_inquiry_service_rate_limit.md) · [53 `POST /inquiries`](53_inquiries_route_create.md) |

## 1. 하는 일
홈 화면 Contact 폼에서 보낸 문의를 `inquiries` 표에 저장합니다.

| 상황 | 결과 |
|---|---|
| 로그인하지 않은 사람 | 저장합니다. `user_id`는 비어 있고, 상태는 `RECEIVED`, 동의 시각은 지금입니다 |
| 로그인한 회원 | 저장하면서 `user_id`를 연결합니다. 이메일은 **폼에 적은 답장 주소**를 그대로 씁니다 |
| 처리방침에 동의하지 않음 | 422 "Please agree to the privacy policy."와 `details.privacy_agreed: "required"`로 응답합니다. 저장하지도 세지도 않습니다 |
| 10분 안에 3번째 | 429로 응답하고 저장하지 않습니다 (51) |
| 저장 실패 (DB 오류) | 오류를 그대로 전달하고, 반복 전송 횟수로 **세지 않습니다** |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `POST /api/v1/inquiries` (53) | 라우터가 로그인한 회원(없으면 `None`)과 IP를 넘깁니다 |
| 답변 | 관리자 화면(SQLAdmin `/admin`, P1-21)에서 `answer`, `answered_at`, 상태를 채웁니다 |
| 보관 기간 | 답변하고 1년이 지나면 지웁니다 (54번 `purge_old_inquiries`) |

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
**`from datetime import UTC, datetime`을 이번에 추가했습니다.**

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
| `user: User \| None` | 로그인한 회원이거나 `None`입니다 (P1-03 06번 `OptionalUser`) |
| `user.user_id if user else None` | 조건식입니다. 회원이 있으면 회원 번호를, 없으면 `None`을 씁니다 |
| `datetime.now(UTC).replace(tzinfo=None)` | 지금 UTC 시각에서 시간대 표시만 떼어 냅니다 (DB는 항상 UTC로 저장합니다) |
| `db.refresh(inquiry)` | DB가 채운 값(`inquiry_id`, `created_at`, `status`)을 다시 읽습니다 |

## 4. 흐름
1. 처리방침 동의 여부를 확인하고, 동의하지 않았으면 422로 응답합니다.
2. 반복 전송을 검사하고(51), 한도를 넘으면 429로 응답합니다.
3. 문의 행을 만들어 저장합니다.
4. 저장에 성공했으면 반복 전송 1번으로 셉니다.
5. 저장된 문의를 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 동의 검사를 맨 앞에 둠 | 동의 없이 온 요청은 반복 전송 검사도 하지 않습니다 (횟수로 세지도 않습니다) |
| 세기는 `commit` **뒤에** 함 | 저장에 실패한 시도는 세지 않는다는 사용자 결정 때문입니다 (51). `commit`이 오류를 던지면 `record_inquiry_send` 줄까지 오지 않습니다 (시험으로 확인했습니다) |
| 로그인한 회원도 **폼에 적은 이메일**로 저장 | 회원이 다른 주소로 답장을 받고 싶을 수 있기 때문입니다. 회원과의 연결은 `user_id`로 따로 남습니다 |
| `.strip()`을 하지 않음 (템플릿에는 있었음) | 50번 스키마가 이미 앞뒤 공백을 지운 값을 넘겨주기 때문입니다 |
| 이름(`name`) 칸은 비워 둠 | 표에는 칸이 있지만 화면 폼에는 이름 칸이 없습니다 (DB는 `NULL`을 허용합니다) |
| 상태는 DB 기본값을 씀 | `RECEIVED`입니다. 템플릿과 DB 설계를 그대로 따랐습니다 |
| 관리자 알림 메일은 보내지 않음 | Phase 1 범위 밖입니다 (템플릿) |

## 6. 시험 (`tests/test_inquiry_service.py`에 5개를 추가해서 모두 17개, 실제 MySQL로 실행)
| 시험 | 확인한 것 |
|---|---|
| 비회원 | DB에 `user_id`가 없고, 이메일, 제목, 내용(줄바꿈 포함), `RECEIVED`, 동의 시각, `created_at`이 저장되며 답변은 비어 있습니다. 반복 전송은 1번으로 셉니다 |
| 회원 | `user_id`가 연결되고, 이메일은 폼에 적은 다른 주소입니다 |
| 동의하지 않음 | 422와 문구, `details`가 나오고, 저장 0건, 셈 0번입니다 |
| 3번째 | 429이고, 저장은 2건뿐입니다 |
| 저장 실패 3번 | 오류가 그대로 전달되고, 셈은 0번입니다 (사용자 결정) |

전체 시험 385개가 통과했고, `ruff` 검사도 통과했습니다. 시험이 끝난 뒤 DB의 문의는 0건입니다.
