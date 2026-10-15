# 백엔드 164 — `POST /auth/email-reminder/request` (이메일 안내 요청 라우터)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/auth.py`의 `email_reminder_request()`, 스키마 `app/schemas/auth.py`의 `EmailReminderRequest`, `EmailReminderResponse` |
| 작업 | P1-28 이메일을 잊은 경우 (FR-119): 열다섯 번째 함수. **백엔드의 마지막 API** |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 | [163 `request_email_reminder()`](163_password_reset_service_request_email_reminder.md) |
| 시험 | `tests/test_password_reset_service.py`의 15개 추가 (파일 전체 97개), 실제 앱과 실제 MySQL |
| 다음 | 화면: 로그인 모달의 복구 화면(Password, Email 탭)과 `resetPassword.html` |

## 1. 하는 일
로그인 없이 부르는 API입니다. 이메일 하나를 받아 `request_email_reminder()`(163번)를 부르고 **가입 여부와 관계없이 항상 같은 응답**을 돌려줍니다. 재설정 요청 API(160번)와 같은 모양입니다.

```
POST /api/v1/auth/email-reminder/request
{ "email": "maybe-this-one@example.com" }

→ 202 Accepted
{ "message": "If an account exists for that email, we've sent a message." }
```

| 결과 | 언제 |
|---|---|
| **202** + 고정 본문 | 형식이 맞는 모든 요청 (가입된 주소, 없는 주소, 탈퇴, 정지 계정 모두 같음) |
| 422 `VALIDATION_ERROR` | 이메일 형식이 틀림, 본문이 없음 |
| 429 `TOO_MANY_REQUESTS` + `details.retry_after` | 요청이 잦음 (재설정 요청과 **한도를 따로 셈**) |

## 2. 코드
```python
class EmailReminderRequest(PasswordResetRequest): ...      # 본문 { email }, 검사는 재설정 요청과 같음
class EmailReminderResponse(PasswordResetRequestResponse): ...

@router.post("/email-reminder/request", response_model=EmailReminderResponse,
             status_code=status.HTTP_202_ACCEPTED,
             responses={422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}})
def email_reminder_request(data: EmailReminderRequest, request: Request, db: Db):
    password_reset_service.request_email_reminder(db, data.email, client_ip(request))
    return EmailReminderResponse(message=PASSWORD_RESET_REQUEST_MESSAGE)
```

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 요청, 응답 모양을 재설정 요청과 **같게** 함 | 화면(JS)이 두 탭에서 같은 코드로 처리할 수 있습니다. 응답 문구도 같아서 "메일을 보냈다"는 안내를 공유합니다 |
| 스키마를 **하위 클래스**로 둠 | 모양은 같지만 OpenAPI 문서에서 이름이 구분되고, 나중에 한쪽만 바꿔도 다른 쪽이 영향을 받지 않습니다 |
| 상태 코드 202, 고정 문구 | 160번과 같은 이유입니다. 메일이 실제로 가는지는 가입 여부에 달려 있고 그것을 알리지 않습니다 |
| IP는 문의 라우터의 `client_ip()`를 씀 | 프록시 규칙(`TRUST_PROXY`)을 한 곳에서 관리합니다 |
| 응답에 이메일을 되돌려 주지 않음 | 응답은 로그, 프록시, 브라우저 기록에 남을 수 있습니다 |

## 4. 시험 (15개 추가, 파일 전체 97개 통과)
| 확인 | 결과 |
|---|---|
| 경로가 등록되고 202, 429가 문서에 있음 | ✔ |
| 가입된 계정은 202 + 고정 본문이고 로그에 가려진 받는 사람이 남음 | ✔ |
| **없는 계정이 가입된 계정과 똑같은 응답**(상태, 본문, `content-length`, 쿠키 없음), 보낸 것은 가입된 주소 하나뿐 | ✔ |
| 탈퇴, 정지 계정도 같은 응답이고 아무것도 보내지 않음 | ✔ ✔ |
| 형식이 틀린 이메일 5종은 422 | ✔ (5개) |
| 본문이 없거나 비면 422 | ✔ |
| 가입 여부와 관계없이 4번째 요청이 429 | ✔ |
| **같은 IP에서 서로 다른 이메일 11번째가 429**(라우터를 거쳐서) | ✔ |
| **이메일 안내를 다 써도 재설정 요청은 막히지 않음**(라우터를 거쳐서, 한도 분리) | ✔ |
| 로그인 없이 호출되고 응답에 이메일이 없음 | ✔ |

**시험을 확인하는 시험.** 일부러 틀리게 바꿔 시험이 잡는지 보았습니다.

| 바꾼 것 | 결과 |
|---|---|
| 상태 코드를 200으로 | 9개 실패 |
| IP 대신 `None`을 넘김 | 1개 실패 (160번에서 보강한 IP 시험이 이번에는 처음부터 포함됨) |
| 가입되지 않은 주소에만 다른 본문 | 1개 실패 |
| 서비스를 재설정으로 잘못 연결 | 2개 실패 |
| 한도 기록을 재설정과 공유 | 2개 실패 |
| 가입되지 않은 주소에 404 | 6개 실패 |

전체 pytest 858개 통과, `ruff` 통과.

## 5. 백엔드가 모두 끝났습니다
비밀번호 찾기와 이메일을 잊은 경우의 백엔드가 끝났습니다. 함수 15개, 모델, 설정이 모두 시험으로 확인되었습니다.

| 번호 | 내용 |
|---|---|
| 150~159 | 토큰 해시, 생성, 저장, 요청 횟수 제한, 요청 처리, 비밀번호 바꾸기, 이전 로그인 무효화(액세스, 리프레시) |
| 160, 161 | `POST /auth/password-reset/request`, `/confirm` |
| 162, 163 | 이메일 안내 메일 문안, 이메일 안내 요청 |
| 164 | `POST /auth/email-reminder/request` |

**화면에서 만들어야 하는 것**
- 로그인 모달의 `Can't sign in?`이 복구 화면(Password, Email 탭)을 엽니다.
- `home.html#recover`를 열면 복구 화면이 열려야 합니다. 이메일 안내 메일의 `Reset password` 버튼이 이 주소를 가리킵니다(`#login`과 같은 방식).
- `resetPassword.html`이 `#token=`을 읽고 주소창에서 지웁니다.
