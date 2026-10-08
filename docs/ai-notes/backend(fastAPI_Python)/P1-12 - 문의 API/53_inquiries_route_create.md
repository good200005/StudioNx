# Backend(FastAPI/Python) 53 — `POST /api/v1/inquiries` (+ `client_ip()`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/inquiries.py` · `app/core/config.py` (설정 하나) · `studionx/.env.example` (한 줄) |
| 작업 | P1-12 문의 API — 문의 등록 라우터 · PRD 01 FR-112 · FR-113 |
| 작성 | Claude (AI) · 2026-10-08 · 사용자 검토 |
| 이전 · 다음 | [52 `create_inquiry()`](52_inquiry_service_create_inquiry.md) · [54 `purge_old_inquiries()`](54_retention_purge_old_inquiries.md) |

## 1. 하는 일
홈 화면 Contact 폼의 문의를 받는다. **로그인은 선택** — 로그인했으면 회원과 연결한다.

| 요청 | 응답 |
|---|---|
| `{ email, title: "  Bug  ", content, privacy_agreed: true }` | **201** `{ "inquiry_id": 12, "created_at": "…" }` — 제목은 `Bug` 로 저장 |
| 로그인 상태 (`Authorization: Bearer …`) | 201, 회원 번호 연결 |
| 토큰이 틀림 | 201 — 비회원 문의로 받음 |
| `privacy_agreed: false` | 422 · `details.privacy_agreed` |
| 이메일 `abc` · 제목 공백만 · 내용 없음 | 422 · 그 칸 |
| 10분에 3번째 | **429** `TOO_MANY_REQUESTS` "Too many messages. Please try again later." · `details.retry_after` |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 화면 | home.html Contact 폼 `initContactForm` (P1-11 남은 JS — 이 작업 뒤 연결). 201 → 폼 비우고 안내, 429 → 문구 |
| 이어지는 것 | 50 스키마 → 52 `create_inquiry` (동의 → 51 반복 전송 검사 → 저장 → 셈) |

### 사용자 결정 (2026-10-08) — 보낸 사람 IP 를 어디서 읽나 (결정 A)
| 상황 | 읽는 곳 |
|---|---|
| 기본 (`TRUST_PROXY=false`) | 연결된 상대의 IP `request.client.host` — **`X-Forwarded-For` 헤더는 무시** |
| 배포 때 프록시(Nginx 등)를 두면 `TRUST_PROXY=true` | `X-Forwarded-For` 의 **첫** IP (원래 보낸 사람) |

프록시 뒤에서는 연결 상대가 늘 프록시라 모든 사람이 한 IP 로 세어진다. 그래서 헤더가 필요하지만, 프록시가 **없을** 때 헤더를 믿으면 누구나 헤더를 꾸며 IP 제한을 피할 수 있다. 그래서 기본은 끄고, 배포 때 설정 하나로 켠다. (이메일 기준 제한은 어느 쪽이든 동작)

| 바꾼 설정 파일 | 내용 |
|---|---|
| `app/core/config.py` | `trust_proxy: bool = False` + 설명 주석 |
| `studionx/.env.example` | `TRUST_PROXY=false` + 설명 (실제 `.env` 는 건드리지 않음) |

## 3. 코드
**import** (파일 맨 위)
```python
from fastapi import APIRouter, Request, status

from app.api.deps import Db, OptionalUser
from app.core.config import get_settings
from app.schemas.common import ErrorResponse
from app.schemas.inquiry import InquiryCreateRequest, InquiryCreateResponse
from app.services import inquiry_service
```
**`get_settings` · `inquiry_service` 줄을 이번에 추가했다.**

**도우미**
```python
def client_ip(request: Request) -> str | None:
    if get_settings().trust_proxy:
        first = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else None
```

**라우터** (경로 · 응답 설정은 템플릿 그대로)
```python
@router.post(
    "",
    response_model=InquiryCreateResponse,
    status_code=status.HTTP_201_CREATED,
    responses={422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
def create_inquiry(
    data: InquiryCreateRequest,
    request: Request,
    user: OptionalUser,
    db: Db,
) -> InquiryCreateResponse:
    inquiry = inquiry_service.create_inquiry(db, data, user, client_ip(request))
    return InquiryCreateResponse(inquiry_id=inquiry.inquiry_id, created_at=inquiry.created_at)
```

### 문법 풀이
| import 문법 | 뜻 |
|---|---|
| `from app.core.config import get_settings` | `.env` 설정 (P1-01). `trust_proxy` 를 읽음 |
| `from app.services import inquiry_service` | 모듈 통째로 — 라우터 함수 이름도 `create_inquiry` 라 겹치지 않게 |

| 식 | 뜻 |
|---|---|
| `request.headers.get("x-forwarded-for", "")` | 헤더 이름은 대소문자를 가리지 않음, 없으면 빈 글자 |
| `.split(",")[0].strip()` | `"203.0.113.5, 10.0.0.1"` → `"203.0.113.5"` (맨 앞이 원래 보낸 사람, 뒤는 거쳐 온 프록시들) |
| `request.client.host if request.client else None` | 연결 상대 IP. 알 수 없으면 `None` (51 은 그때 이메일로만 셈) |
| `user: OptionalUser` | 토큰이 있고 맞으면 회원, 없거나 틀리면 `None` (P1-03 06) — 401 을 내지 않음 |

## 4. 흐름
1. 본문 검사 (50) — 틀리면 422.
2. 토큰이 있으면 회원 확인 (없거나 틀리면 비회원).
3. 보낸 사람 IP 결정 (`client_ip`).
4. 52 `create_inquiry` — 동의 422 · 반복 전송 429 · 저장.
5. 201 + 번호 · 접수 시각.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 로그인 선택 · 틀린 토큰도 받음 | 문의는 누구나 보낸다. 만료된 토큰 때문에 문의가 막히면 안 된다 |
| 응답은 번호 · 시각만 | 템플릿 — 화면은 "보냈습니다" 만 보여 준다. 받은 내용을 그대로 돌려줄 필요가 없다 |
| 헤더는 **첫** IP | 프록시들은 자기 앞의 주소를 뒤에 덧붙인다 — 맨 앞이 사용자 |
| 설정은 `.env` 로 | 개발 컴퓨터(프록시 없음)와 배포 서버(프록시 있음)가 코드를 바꾸지 않고 다르게 동작 |

## 6. 시험 (`tests/test_inquiry_routes.py` 에 15개 추가 · 모두 16개, 실제 앱 + MySQL)
| 시험 | 확인한 것 |
|---|---|
| 비회원 | 201, 응답 칸 2개, DB 에 저장 · 제목 공백 제거 · `user_id` 없음 |
| 회원 · 틀린 토큰 | 회원 연결 · 비회원으로 201 |
| 동의 안 함 · 형식 3가지 | 422 · `details` 에 그 칸 |
| 3번째 | 429 · 코드 · 문구 · `retry_after` 1~601초 |
| **기본: 헤더를 꾸며도** | IP 마다 다른 `X-Forwarded-For` · 다른 이메일로 보내도 3번째 429 — 헤더를 믿지 않음 |
| `TRUST_PROXY` 켬 | 헤더의 첫 IP 로 사람마다 따로 셈 (3명 모두 201), 연결 IP 는 쓰지 않음 |
| `client_ip` 5가지 | 꺼짐 → 연결 IP / 켜짐 → 첫 IP · 공백 제거 / 빈 헤더 · 헤더 없음 → 연결 IP |

전체 시험 400개 통과, `ruff` 검사 통과. 시험 뒤 DB 의 문의는 0개.
