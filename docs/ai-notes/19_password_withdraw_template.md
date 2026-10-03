# AI 구현 설명 19 — 비밀번호 변경 · 회원 탈퇴 API 템플릿

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-03 |
| 작업 | P1-09 비밀번호 변경, 회원 탈퇴(재확인, 소프트 삭제, 로그인 차단) (**템플릿**). 이전 문서: [18_user_profile_api_template.md](18_user_profile_api_template.md) |
| 브랜치 | `feature/phase1/p1-09-password-withdraw` (P1-08 브랜치에서 갈라짐 → **P1-04·05·08 PR 먼저 병합**) |
| 원칙 | 백엔드는 **템플릿만** — 라우터·스키마·함수 이름과 TODO. 실제 구현은 사용자 |

---

## 1. 무엇을 만들었나
| 파일 | 상태 | 내용 |
|---|---|---|
| `app/api/v1/users.py` | 템플릿 추가 | `PUT /users/me/password`, `DELETE /users/me` (둘 다 성공 시 204) |
| `app/schemas/user.py` | 완성 추가 | `PasswordChangeRequest {current_password, new_password}`, `WithdrawRequest {password}` |
| `app/services/user_service.py` | 템플릿 추가 | `check_current_password`, `change_password`, `withdraw` |
| `app/core/errors.py` | 수정 | `WRONG_PASSWORD`(400) 추가 |
| `tests/test_user_routes.py` | 완성 추가 | 두 주소 연결 확인 |

## 2. 왜 이렇게 했나
### 2.1 비밀번호가 틀리면 401이 아니라 400
| 상황 | 응답 | 이유 |
|---|---|---|
| 로그인 모달에서 틀림 | 401 `INVALID_CREDENTIALS` | 로그인 전이라 인증 실패가 맞음 |
| 로그인한 뒤 재확인에서 틀림 | 400 `WRONG_PASSWORD` | 화면(`api.js`)은 401을 받으면 토큰 재발급을 시도함. 토큰은 멀쩡하므로 401을 쓰면 재발급 후 같은 요청을 다시 보내게 됨 |

### 2.2 탈퇴 처리 (FR-108)
| 단계 | 내용 |
|---|---|
| 재확인 | `check_current_password` |
| 소프트 삭제 | `status = 'DELETED'`, `deleted_at = 지금` — 행은 남김 (프로젝트·문의 기록과 연결되어 있음) |
| 로그인 차단 | `authenticate`, `get_current_user`, `get_active_user`가 모두 `ACTIVE`만 통과시키므로 추가 작업 없음 |
| 쿠키 | 라우터에서 `clear_refresh_cookie` (P1-05) |

### 2.3 사용자가 정할 것
| 항목 | 선택지 |
|---|---|
| 같은 이메일·닉네임으로 다시 가입 | 그대로 두면 UNIQUE 때문에 다시 못 씀 / 탈퇴 시 `email`을 `deleted+{user_id}@…`처럼 바꿔 둠 |
| 내가 OWNER인 프로젝트 | 함께 소프트 삭제 / 남겨 둠 (협업 멤버가 있을 수 있음, Phase 6) |
| 프로필 사진 파일 | 탈퇴 시 삭제 권장 (`delete_profile_image` 재사용) |

## 3. 검증 결과 (2026-10-03)
| 확인 | 결과 |
|---|---|
| `pytest` | 10개 통과 |
| `ruff check` | 통과 |
| OpenAPI | `PUT /users/me/password`, `DELETE /users/me` 표시 |

## 4. 남은 일 (사용자)
| 순서 | 할 일 | 파일 |
|---|---|---|
| 1 | 서비스 함수 3개 | `app/services/user_service.py` |
| 2 | 라우터 본문 2개 | `app/api/v1/users.py` |
| 3 | §2.3 결정 | — |
| 4 | 화면 연결 `initPasswordForm`, `initWithdrawForm` | `static/js/pages/userinfo.js` |
| 5 | 테스트: 탈퇴한 계정으로 로그인하면 실패 (P1-18) | `tests/` |

## 5. 자주 받을 질문 대비
- **Q. DELETE 요청에 본문을 넣어도 되나?** HTTP 규칙상 금지는 아니고 FastAPI도 받습니다. 비밀번호를 주소(쿼리)에 넣으면 서버 로그에 남을 수 있어 본문으로 받습니다.
- **Q. 왜 행을 지우지 않나?** 프로젝트·문의·협업 기록이 `user_id`로 연결되어 있어, 지우면 기록이 끊기거나 함께 지워집니다 (DB.md §4 삭제 정책).
- **Q. 비밀번호를 바꾸면 다른 기기도 로그아웃되나?** 지금은 아닙니다. 리프레시 토큰을 DB에 두지 않기 때문입니다 ([17](17_login_jwt_template.md) §2.4).
