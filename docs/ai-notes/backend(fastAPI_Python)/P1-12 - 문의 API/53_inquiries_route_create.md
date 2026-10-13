# Backend(FastAPI/Python) 53 — `POST /api/v1/inquiries` (+ `client_ip()`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/inquiries.py`, `app/core/config.py` (설정 하나), `studionx/.env.example` (한 줄) |
| 작업 | P1-12 문의 API: 문의 등록 라우터 (PRD 01 FR-112, FR-113) |
| 작성 | Claude (AI), 2026-10-08, 사용자 검토 |
| 이전 · 다음 | [52 `create_inquiry()`](52_inquiry_service_create_inquiry.md) · [54 `purge_old_inquiries()`](54_retention_purge_old_inquiries.md) |

## 1. 하는 일
홈 화면 Contact 폼에서 보낸 문의를 받습니다. **로그인은 선택 사항이며**, 로그인한 상태라면 문의를 회원과 연결합니다.

| 요청 | 응답 |
|---|---|
| `{ email, title: "  Bug  ", content, privacy_agreed: true }` | **201** `{ "inquiry_id": 12, "created_at": "…" }`이고, 제목은 `Bug`로 저장됩니다 |
| 로그인 상태 (`Authorization: Bearer …`) | 201이고, 회원 번호가 연결됩니다 |
| 토큰이 틀림 | 201이고, 비회원 문의로 받습니다 |
| `privacy_agreed: false` | 422이고, `details.privacy_agreed`에 오류가 담깁니다 |
| 이메일 `abc`, 공백만 있는 제목, 내용 없음 | 422이고, 해당 칸에 오류가 담깁니다 |
| 10분 안에 3번째 | **429** `TOO_MANY_REQUESTS` "Too many messages. Please try again later."와 `details.retry_after` |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 화면 | home.html Contact 폼의 `initContactForm`입니다 (P1-11에 남은 JS로, 이 작업 뒤에 연결합니다). 201이면 폼을 비우고 안내하며, 429면 문구를 보여 줍니다 |
| 이어지는 처리 | 50번 스키마 → 52번 `create_inquiry` (동의 확인 → 51번 반복 전송 검사 → 저장 → 횟수 세기) |

### 사용자 결정 (2026-10-08): 보낸 사람의 IP를 어디서 읽을 것인가 (결정 A)
| 상황 | 읽는 곳 |
|---|---|
| 기본값 (`TRUST_PROXY=false`) | 연결된 상대의 IP인 `request.client.host`를 씁니다. **`X-Forwarded-For` 헤더는 무시합니다** |
| 배포할 때 프록시(Nginx 등)를 두고 `TRUST_PROXY=true`로 설정 | `X-Forwarded-For`의 **첫 번째** IP(원래 보낸 사람)를 씁니다 |

프록시 뒤에서는 연결 상대가 항상 프록시이기 때문에, 모든 사람이 하나의 IP로 세어집니다. 그래서 헤더가 필요합니다. 하지만 프록시가 **없는데** 헤더를 믿으면, 누구나 헤더를 꾸며서 IP 제한을 피할 수 있습니다. 그래서 기본값은 꺼 두고, 배포할 때 설정 하나로 켜도록 했습니다. (이메일 기준 제한은 어느 쪽이든 동작합니다.)

| 바꾼 설정 파일 | 내용 |
|---|---|
| `app/core/config.py` | `trust_proxy: bool = False`와 설명 주석을 추가했습니다 |
| `studionx/.env.example` | `TRUST_PROXY=false`와 설명을 추가했습니다 (실제 `.env`는 건드리지 않았습니다) |

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
**`get_settings`와 `inquiry_service` 줄을 이번에 추가했습니다.**

**도우미 함수**
```python
def client_ip(request: Request) -> str | None:
    if get_settings().trust_proxy:
        first = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else None
```

**라우터** (경로와 응답 설정은 템플릿 그대로입니다)
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
| `from app.core.config import get_settings` | `.env` 설정을 읽습니다 (P1-01). 여기서는 `trust_proxy`를 읽습니다 |
| `from app.services import inquiry_service` | 모듈 전체를 가져옵니다. 라우터 함수 이름도 `create_inquiry`라서 이름이 겹치지 않게 하기 위해서입니다 |

| 식 | 뜻 |
|---|---|
| `request.headers.get("x-forwarded-for", "")` | 헤더 이름은 대소문자를 구분하지 않고, 헤더가 없으면 빈 문자열입니다 |
| `.split(",")[0].strip()` | `"203.0.113.5, 10.0.0.1"`에서 `"203.0.113.5"`만 꺼냅니다 (맨 앞이 원래 보낸 사람이고, 뒤는 거쳐 온 프록시들입니다) |
| `request.client.host if request.client else None` | 연결 상대의 IP입니다. 알 수 없으면 `None`이고, 이때 51번은 이메일로만 셉니다 |
| `user: OptionalUser` | 토큰이 있고 올바르면 회원이고, 없거나 틀리면 `None`입니다 (P1-03 06). 401로 응답하지 않습니다 |

## 4. 흐름
1. 본문을 검사합니다 (50). 틀리면 422로 응답합니다.
2. 토큰이 있으면 회원을 확인합니다 (없거나 틀리면 비회원으로 처리합니다).
3. 보낸 사람의 IP를 정합니다 (`client_ip`).
4. 52번 `create_inquiry`가 동의 확인(422), 반복 전송 검사(429), 저장을 차례로 합니다.
5. 201과 함께 문의 번호와 접수 시각을 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 로그인은 선택이고, 틀린 토큰도 받아 줌 | 문의는 누구나 보낼 수 있어야 합니다. 만료된 토큰 때문에 문의가 막히면 안 됩니다 |
| 응답에는 번호와 시각만 담음 | 템플릿을 따랐습니다. 화면은 "보냈습니다"라는 안내만 보여 주므로, 받은 내용을 그대로 돌려줄 필요가 없습니다 |
| 헤더에서는 **첫 번째** IP를 씀 | 프록시들은 자기 앞의 주소를 뒤에 덧붙이기 때문에, 맨 앞이 사용자입니다 |
| 설정은 `.env`로 바꿈 | 개발 컴퓨터(프록시 없음)와 배포 서버(프록시 있음)가 코드를 바꾸지 않고도 다르게 동작할 수 있습니다 |

## 6. 시험 (`tests/test_inquiry_routes.py`에 15개를 추가해서 모두 16개, 실제 앱과 MySQL로 실행)
| 시험 | 확인한 것 |
|---|---|
| 비회원 | 201, 응답 칸 2개이고, DB에 저장되며 제목의 공백이 지워지고 `user_id`는 비어 있습니다 |
| 회원, 틀린 토큰 | 회원이면 연결되고, 틀린 토큰이면 비회원으로 201입니다 |
| 동의하지 않음, 형식 오류 3가지 | 422이고, `details`에 해당 칸이 담깁니다 |
| 3번째 | 429와 코드, 문구, `retry_after` 1~601초가 나옵니다 |
| **기본값에서 헤더를 꾸민 경우** | IP마다 다른 `X-Forwarded-For`와 다른 이메일로 보내도 3번째는 429입니다. 헤더를 믿지 않습니다 |
| `TRUST_PROXY`를 켠 경우 | 헤더의 첫 번째 IP로 사람마다 따로 세서 3명 모두 201이고, 연결 IP는 쓰지 않습니다 |
| `client_ip` 5가지 | 꺼져 있으면 연결 IP, 켜져 있으면 첫 번째 IP(공백 제거)를 쓰고, 빈 헤더나 헤더가 없으면 연결 IP를 씁니다 |

전체 시험 400개가 통과했고, `ruff` 검사도 통과했습니다. 시험이 끝난 뒤 DB의 문의는 0건입니다.
