# 백엔드 163 — `request_email_reminder()` (이메일 안내 요청)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/services/password_reset_service.py` |
| 작업 | P1-28 이메일을 잊은 경우 (FR-119): 열네 번째 함수 (`check_reminder_rate_limit()`과 내부 `_rate_limit()` 포함) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 | [162 `build_email_reminder_message()`](162_mail_templates_build_email_reminder_message.md) |
| 시험 | `tests/test_password_reset_service.py`의 11개 추가 (파일 전체 82개) |
| 다음 | `POST /auth/email-reminder/request` 라우터 |

## 1. 하는 일
"가입한 이메일이 무엇인지" 알려 주는 메일을 요청합니다. 재설정 요청(154번)과 같은 방식이고 **가입 여부와 관계없이 항상 같은 결과**를 돌려줍니다.

| 순서 | 일 |
|---|---|
| 1 | `check_reminder_rate_limit()`으로 횟수를 검사합니다(이메일 3번, IP 10번, 10분). 넘으면 429입니다 |
| 2 | 이메일(소문자, 공백 제거)로 회원을 찾습니다. 없거나 `ACTIVE`가 아니면(탈퇴, 정지) **아무것도 보내지 않고** 끝냅니다 |
| 3 | `ACTIVE`이면 `build_email_reminder_message()`(162번)로 문안을 만들어 메일(지금은 서버 로그)로 보냅니다 |

사용자 결정대로 **가입되지 않은 주소에는 아무것도 보내지 않습니다**(D안, "계정이 없다" 메일은 만들지 않음).

## 2. 코드 (요약)
```python
def request_email_reminder(db: Session, email: str, ip: str | None) -> None:
    check_reminder_rate_limit(ip, email)

    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None or user.status != UserStatus.ACTIVE:
        return

    settings = get_settings()
    if settings.mail_backend != "log":
        logger.warning("email reminder requested but mail is not configured (MAIL_BACKEND)")
        return

    message = build_email_reminder_message(user.email, settings.app_base_url)
    logger.info("[DEV MAIL] to %s: %s", mask_email(user.email), message.subject)
```

## 3. 결정과 이유
| 결정 | 이유 |
|---|---|
| **한도는 재설정 요청과 같고 기록은 따로 셈** | 비밀번호 재설정을 여러 번 눌렀다고 이메일 안내가 막히거나 그 반대가 되지 않습니다. 이 결정은 제안한 대로 진행했습니다 |
| 속도 제한 본문을 `_rate_limit(store, ip, email)` 한 곳으로 모음 | 두 요청이 같은 규칙을 쓰므로 복사하지 않고, 기록 저장소(`store`)만 다르게 넘깁니다. 기존 `check_reset_rate_limit()`의 동작과 시험은 그대로입니다 |
| **토큰을 만들지 않음** | 이 메일은 이미 아는 사실(로그인 이메일)을 알려 줄 뿐이고 아무 권한도 주지 않습니다. 비밀번호를 바꾸려면 메일의 `Reset password` 버튼으로 재설정 요청을 따로 합니다 |
| 로그에는 받는 사람을 **가려서** 남기고 **본문은 남기지 않음** | 본문에 이메일이 들어 있고, 로그는 오래 남고 여러 곳으로 흘러갑니다. 제목만 남깁니다 |
| `mail_backend`가 `log`가 아니면 아무것도 보내지 않음 | 재설정 요청과 같은 규칙입니다. 배포에서 메일 설정 없이 켜져 있어도 안전한 쪽으로 실패합니다 |

## 4. 시험 (11개 추가, 파일 전체 82개 통과)
| 확인 | 결과 |
|---|---|
| `ACTIVE` 회원은 보낸 것으로 기록되고 받는 사람이 가려짐, 로그에 원문 이메일이 없음 | ✔ |
| 로그에 본문(링크)과 토큰이 없고 토큰 행도 만들지 않음 | ✔ |
| 없는 이메일은 아무것도 보내지 않고 같은 결과 | ✔ |
| 탈퇴, 정지 회원은 아무것도 받지 않음 | ✔ ✔ |
| 이메일의 대소문자와 공백을 정리한 뒤 찾음 | ✔ |
| 가입 여부와 무관하게 4번째가 429 | ✔ |
| **재설정 요청과 이메일 안내는 한도를 따로 셈**(안내를 다 써도 재설정은 3번 가능) | ✔ |
| IP 한도 10번 | ✔ |
| `mail_backend`가 `log`가 아니면 보내지 않고 "메일 설정 없음"만 기록 | ✔ |
| 문안은 템플릿에서 오고 저장된 이메일과 설정의 사이트 주소를 씀 | ✔ |

**시험을 확인하는 시험.** 일부러 틀리게 바꿔 시험이 잡는지 보았습니다.

| 바꾼 것 | 결과 |
|---|---|
| 한도 기록을 재설정과 공유 | 1개 실패 |
| 상태 검사 제거 | 2개 실패 |
| 가입되지 않은 주소에도 발송 | 3개 실패 |
| 이메일 가리기 제거 | 1개 실패 |
| 본문을 로그에 남김 | 2개 실패 |
| `mail_backend` 검사 제거 | 1개 실패 |
| 횟수 검사 제거 | 3개 실패 |
| 토큰을 만들어 버림 | 1개 실패 |

**시험을 쓰다 발견한 것.** 같은 시험 파일에 이름이 같은 함수(`test_email_lookup_ignores_case_and_spaces`)가 둘 있어서 `ruff`가 "다시 정의됨(F811)"을 알렸습니다. 파이썬에서는 뒤의 것이 앞의 것을 덮어 **앞 시험이 조용히 실행되지 않았습니다.** 이름을 `test_reminder_email_lookup_…`으로 바꿔서 둘 다 실행되게 했습니다(시험 수가 81개에서 82개로 늘어난 이유).

전체 pytest 843개 통과, `ruff` 통과.
