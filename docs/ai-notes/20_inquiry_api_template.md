# AI 구현 설명 20 — 문의 API 템플릿

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-03 |
| 작업 | P1-12 문의 등록(이메일·제목·내용·개인정보 동의) + 반복 전송 제한 (**템플릿**). 이전 문서: [19_password_withdraw_template.md](19_password_withdraw_template.md) |
| 브랜치 | `feature/phase1/p1-12-inquiry-api` (P1-09 브랜치에서 갈라짐 → **앞 PR 먼저 병합**) |
| 원칙 | 백엔드는 **템플릿만** — 라우터·스키마·함수 이름과 TODO. 실제 구현은 사용자 |

---

## 1. 무엇을 만들었나
| 파일 | 상태 | 내용 |
|---|---|---|
| `app/api/v1/inquiries.py` | 템플릿 (새 파일) | `POST /inquiries` — 로그인 선택(`OptionalUser`), 성공 201 |
| `app/api/v1/router.py` | 수정 | `/inquiries` 연결 |
| `app/schemas/inquiry.py` | 완성 + TODO | `InquiryCreateRequest`, `InquiryCreateResponse`, `INQUIRY_CONTENT_MAX`(2,000). 이메일 형식만 TODO |
| `app/services/inquiry_service.py` | 템플릿 (새 파일) | `create_inquiry`, `check_rate_limit` + 제한값(10분에 3번) |
| `tests/test_inquiry_routes.py` | 완성 (새 파일) | 주소 연결 확인 |

## 2. 왜 이렇게 했나
### 2.1 요청과 응답
| 칸 | 규칙 |
|---|---|
| `email` | 답장 받을 주소, 255자 이하 |
| `title` | 1~200자 (DB `VARCHAR(200)`) |
| `content` | 1~2,000자 (화면 `maxlength`와 같음) |
| `privacy_agreed` | `true`가 아니면 422 — 저장할 때 `privacy_agreed_at`에 동의 시각 기록 |

| 응답 | 경우 |
|---|---|
| 201 `{inquiry_id, created_at}` | 접수 |
| 422 `VALIDATION_ERROR` | 칸 형식, 동의 없음 |
| 429 `TOO_MANY_REQUESTS` | 반복 전송 (FR-113) |

### 2.2 로그인은 선택
`OptionalUser`(P1-03 `get_current_user_optional`)를 써서, 토큰이 있으면 `user_id`를 연결하고 없으면 비회원 문의로 저장합니다 (FR-112).

### 2.3 반복 전송 제한 — 메모리 방식 (2026-10-03 결정)
| 항목 | 내용 |
|---|---|
| 기준 | 같은 IP **또는** 같은 이메일로 10분에 3번까지 (`INQUIRY_LIMIT_COUNT`, `INQUIRY_LIMIT_SECONDS`) |
| 저장 | 모듈 변수 `_recent_sends` — 키마다 최근 전송 시각 목록(`deque`) |
| 시각 | `time.monotonic()` — 서버 시계를 바꿔도 영향 없음 |
| 넘으면 | 429 `TOO_MANY_REQUESTS`, `details.retry_after`(초) |
| 한계 | 서버를 재시작하면 기록이 비워지고, 서버가 여러 대면 서버마다 따로 셈 — 지금 규모에서는 충분 |

```
요청 → 오래된 시각 버리기 → 키마다 3번 이상? ─ 예 → 429
                                         └ 아니오 → 시각 기록 → 저장
```

> 함수가 DB를 쓰지 않으므로 `check_rate_limit(ip, email)`에서 `db` 인자를 뺐습니다. 동시에 여러 요청이 들어오면 `threading.Lock`으로 감싸길 권장합니다.

## 3. 검증 결과 (2026-10-03)
| 확인 | 결과 |
|---|---|
| `pytest` | 11개 통과 |
| `ruff check` | 통과 |
| OpenAPI | `POST /api/v1/inquiries` 표시 |

## 4. 남은 일 (사용자)
| 순서 | 할 일 | 파일 |
|---|---|---|
| 1 | `Inquiry` 모델 컬럼, `get_current_user_optional` (P1-03 TODO) | `app/models/inquiry.py`, `app/api/deps.py` |
| 2 | `check_rate_limit`(메모리), `create_inquiry` | `app/services/inquiry_service.py` |
| 3 | 라우터 본문 | `app/api/v1/inquiries.py` |
| 4 | 화면 연결 `initContactForm` (로그인 상태면 이메일 자동 채움) | `static/js/pages/home.js` |

## 5. 자주 받을 질문 대비
- **Q. 동의 칸을 왜 `bool`로 받고 서비스에서 검사하나?** `Literal[True]`로 받으면 FastAPI 기본 문구만 나옵니다. 서비스에서 검사하면 "Please agree to the privacy policy."처럼 화면에 바로 보일 문구를 돌려줄 수 있습니다.
- **Q. 왜 DB로 세지 않나?** `inquiries`에는 IP 컬럼이 없어 이메일 기준만 가능합니다. 메모리 방식은 IP와 이메일을 모두 볼 수 있고 DB 조회가 없습니다.
- **Q. 배포하면 IP가 모두 같게 보이지 않나?** 프록시(Nginx 등) 뒤에서는 `request.client.host`가 프록시 주소입니다. 그때는 `X-Forwarded-For`를 읽도록 바꿉니다 (TODO에 적어 둠).
- **Q. 답변은 어디서 하나?** P1-21 SQLAdmin 관리자 화면(`/admin`)에서 `answer`, `answered_at`, `status`를 바꿉니다.
