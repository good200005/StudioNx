# AI 구현 설명 35 — P1-04 회원가입 API (비밀번호 · 중복 확인 · 탈퇴 후 재가입 · 가입)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI), 2026-10-07 |
| 작업 | P1-04 회원가입: PRD 01 FR-101, FR-102, FR-108, 처리방침 동의 |
| 브랜치 | `feature/phase1/p1-04-signup-api` |
| 바꾼 파일 | `core/security.py`, `services/auth_service.py`, `api/v1/auth.py`, `schemas/auth.py`, `requirements.txt` (`email-validator`) |
| 진행 방식 | **함수 하나씩** 구현 → 사용자 검토 → 다음 |
| 함수별 설명 | `docs/ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/14 ~ 25` (md, PDF), 합본 [`P1-04_signup_api.pdf`](<backend(fastAPI_Python)/P1-04 - 회원가입 API/P1-04_signup_api.pdf>) |
| 이전 문서 | [34_p1-02_03_site_test.md](34_p1-02_03_site_test.md), [33_p1-03_backend_core.md](33_p1-03_backend_core.md) |

## 1. 한 일
join.html 이 쓰는 서버 쪽 회원가입을 만들었습니다.

| API | 하는 일 |
|---|---|
| `POST /api/v1/auth/signup` | 가입. 201 `{user_id, email, nickname}` |
| `GET /api/v1/auth/check-email?email=` | 이메일 실시간 중복 확인 |
| `GET /api/v1/auth/check-nickname?nickname=` | 닉네임 실시간 중복 확인 (userInfo.html 도 사용) |

## 2. 항목 12개
| # | 파일 | 항목 | 하는 일 | 설명 |
|---|---|---|---|---|
| 14 | `security.py` | `check_password_rules()` | 비밀번호 규칙 6개 중 어긴 것 목록 | [14](<backend(fastAPI_Python)/P1-04 - 회원가입 API/14_security_check_password_rules.md>) |
| 15 | `security.py` | `hash_password()` | bcrypt 해시 (소금, 비용 12) | [15](<backend(fastAPI_Python)/P1-04 - 회원가입 API/15_security_hash_password.md>) |
| 16 | `security.py` | `verify_password()` | 해시와 비교. 72바이트 초과, 망가진 해시는 `False` | [16](<backend(fastAPI_Python)/P1-04 - 회원가입 API/16_security_verify_password.md>) |
| 17 | `auth_service.py` | `normalize_email()` | 앞뒤 공백 제거 + 소문자 | [17](<backend(fastAPI_Python)/P1-04 - 회원가입 API/17_auth_service_normalize_email.md>) |
| 18 | `auth_service.py` | `release_withdrawn()` | 탈퇴 행의 이메일, 닉네임을 비켜 둠 | [18](<backend(fastAPI_Python)/P1-04 - 회원가입 API/18_auth_service_release_withdrawn.md>) |
| 19 | `auth_service.py` | `check_email()`, `availability_of()` | 이메일 쓸 수 있는지 (TAKEN, REJOIN_TOO_SOON) | [19](<backend(fastAPI_Python)/P1-04 - 회원가입 API/19_auth_service_check_email.md>) |
| 20 | `auth_service.py` | `check_nickname()` | 닉네임 쓸 수 있는지 (대소문자 무시는 DB 규칙) | [20](<backend(fastAPI_Python)/P1-04 - 회원가입 API/20_auth_service_check_nickname.md>) |
| 21 | `auth_service.py` | `signup()`, `unavailable_error()` | 검사 → 저장. 동시 가입도 409 | [21](<backend(fastAPI_Python)/P1-04 - 회원가입 API/21_auth_service_signup.md>) |
| 22 | `auth.py` | `POST /auth/signup` | 가입 라우터 (201) | [22](<backend(fastAPI_Python)/P1-04 - 회원가입 API/22_auth_route_signup.md>) |
| 23 | `auth.py` | `GET /auth/check-email` | 형식 틀리면 422, 확인만 | [23](<backend(fastAPI_Python)/P1-04 - 회원가입 API/23_auth_route_check_email.md>) |
| 24 | `auth.py` | `GET /auth/check-nickname` | 2 ~ 20자, 확인만 | [24](<backend(fastAPI_Python)/P1-04 - 회원가입 API/24_auth_route_check_nickname.md>) |
| 25 | `schemas/auth.py` | `SignupRequest`, `Nickname` | `EmailStr`, 공백 지운 뒤 길이 | [25](<backend(fastAPI_Python)/P1-04 - 회원가입 API/25_auth_schema_signup_request.md>) |

## 3. 가입 한 번이 지나가는 길
| 순서 | 항목 | 결과 |
|---|---|---|
| ① | join.html **Check** → 23, 24 → 19, 20 | ✓ Available (DB 는 바꾸지 않음) |
| ② | **Sign Up** → 22 | 본문 JSON |
| ③ | 25 스키마 | 이메일 형식, 닉네임 길이. 틀리면 422 |
| ④ | 21 → 14 | 비밀번호 규칙. 틀리면 422 + `["upper", …]` |
| ⑤ | 21 | 처리방침 동의, 판 확인 |
| ⑥ | 21 → 17, 19, 20 (`release=True`) → 18 | 사용 중이면 409, 탈퇴 3일 지난 행은 비켜 둠 |
| ⑦ | 21 → 15 | 비밀번호 해시 |
| ⑧ | 21 | 저장(`commit`). 동시 가입이면 DB 가 막고 409 |
| ⑨ | 22 | 201 `{user_id, email, nickname}` → 화면은 로그인 모달로 (P1-07) |

## 4. 오류 정리
| 상황 | 상태, 코드 | 문구 |
|---|---|---|
| 이메일 형식, 닉네임 길이, 칸 빠짐 | 422 `VALIDATION_ERROR` | Check the highlighted fields. (+ 칸별 `details`) |
| 비밀번호 규칙 | 422 `VALIDATION_ERROR` | Check the password requirements. (+ `details.password`) |
| 처리방침 동의 안 함, 예전 판 | 422 `VALIDATION_ERROR` | Please agree to the Privacy Policy. / Please reload the page. |
| 이메일, 닉네임 사용 중 | 409 `EMAIL_TAKEN`, `NICKNAME_TAKEN` | This email/nickname is already in use. |
| 탈퇴 후 3일 안 | 409 `REJOIN_TOO_SOON` | You can sign up with this email again after Oct 9, 2026 (UTC). |

## 5. 이번 작업에서 정한 것 (2026-10-07)
| 결정 | 내용 |
|---|---|
| 이메일 형식 | `EmailStr` + `email-validator` 2.3.0 (새 패키지). 형식이 틀린 중복 확인은 422 |
| 이메일 대소문자 | `@` 앞까지 소문자로 저장, 비교 (실제 메일 서비스는 구분하지 않음) |
| 닉네임 대소문자 | 표기는 그대로 저장, 비교는 DB 규칙(`utf8mb4_0900_ai_ci`)으로 대소문자, 악센트 무시 → `BeatMaker` = `beatmaker` |
| 비켜 둔 값 | `deleted+{번호}@withdrawn.invalid`, `deleted_user_{번호 10자리}` (23자: 가입 닉네임 최대 20자와 절대 겹치지 않음) |
| 탈퇴 회원 추적 방지 | 다른 사람에게는 'Deleted user' 로만, 3일 뒤 남은 개인 정보 지움(P1-09), 회원 번호로 조회하는 공개 API 없음 |
| 중복 확인은 확인만 | `GET` 은 DB 를 바꾸지 않음. 비켜 두기는 가입 때만 (`release=True`) |
| `verify_password` 를 P1-04 에서 | 15 와 짝. 로그인 입력 100자 때문에 생길 500 을 미리 막음 |

## 6. 템플릿과 달라진 점
| 항목 | 템플릿 | 구현 | 이유 |
|---|---|---|---|
| 비켜 둔 닉네임 | `deleted_{id}` | `deleted_user_{id:010d}` | 회원이 `deleted_85` 를 쓰고 있으면 `UNIQUE` 충돌 → 500 |
| `check_email`, `check_nickname` | 인자 2개 | `release` 인자 추가 | `GET` 확인은 DB 를 바꾸지 않게 |
| `verify_password` | `bcrypt.checkpw` | `ValueError` → `False` | 72바이트 초과, 망가진 해시에서 500 방지 |
| check-nickname 길이 | 최대만 | 최소 2자도, 공백 지운 뒤 | 확인과 가입의 규칙을 같게 |

## 7. 시험
| 파일 | 대상 | 시험 수 |
|---|---|---|
| `tests/test_password.py` | 14, 15, 16 | 32 |
| `tests/test_auth_service.py` | 17 ~ 21 (실제 MySQL) | 37 |
| `tests/test_auth_routes.py` | 22 ~ 24 (실제 앱 + MySQL) | 27 |
| `tests/test_auth_schemas.py` | 25 | 16 |

- `tests/conftest.py` 의 `db` 세션을 "바깥 트랜잭션 + 저장점" 방식으로 바꿨습니다. `commit` 하는 `signup()` 을 시험해도 실제 DB 에 행이 남지 않습니다 (매번 0행 확인).
- 전체 시험 186개 통과, `ruff` 검사 통과.

## 8. 다음 작업이 쓰는 곳
| 작업 | 쓰는 것 |
|---|---|
| P1-05 로그인 | `verify_password` (16), `normalize_email` (17), 가짜 해시로 응답 시간 맞추기 |
| P1-07 가입, 로그인 JS | 22 ~ 24 의 응답, 오류 코드, `details` |
| P1-08 회원 정보 수정 | `Nickname` 타입 (25), `check_nickname` (20) |
| P1-09 비밀번호 변경, 탈퇴 | `check_password_rules`, `hash_password`, `verify_password`, 추적 방지 ② |
