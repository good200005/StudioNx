# AI 구현 설명 18 — 회원 정보 · 프로필 사진 API 템플릿

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-03 |
| 작업 | P1-08 `/users/me` 조회·수정, 프로필 사진 올리기·지우기·보기 (**템플릿**). 이전 문서: [17_login_jwt_template.md](17_login_jwt_template.md) |
| 브랜치 | `feature/phase1/p1-08-user-profile-api` (P1-05 브랜치에서 갈라짐 → **P1-04·05 PR 먼저 병합**) |
| 원칙 | 백엔드는 **템플릿만** — 라우터·스키마·함수 이름과 TODO. 실제 구현은 사용자 |

---

## 1. 무엇을 만들었나
| 파일 | 상태 | 내용 |
|---|---|---|
| `app/api/v1/users.py` | 템플릿 (새 파일) | 라우터 5개 (§2.1) |
| `app/api/v1/router.py` | 수정 | `users.router`를 `/users`로 연결 |
| `app/schemas/user.py` | 완성 (새 파일) | `MeResponse`, `MeUpdateRequest` |
| `app/services/user_service.py` | 템플릿 (새 파일) | `to_me_response`, `profile_image_url`, `update_me`, `save_profile_image`, `delete_profile_image`, `profile_image_file` + 제한값 `PHOTO_TYPES`, `PHOTO_MAX_BYTES` |
| `app/core/errors.py` | 수정 | `FILE_TOO_LARGE`(413), `UNSUPPORTED_FILE_TYPE`(415) 추가 |
| `tests/test_user_routes.py` | 완성 (새 파일) | 주소 연결 확인 |

## 2. 왜 이렇게 했나
### 2.1 API
| Method | Path | 로그인 | 설명 |
|---|---|---|---|
| GET | `/users/me` | ✔ | 내 정보 `MeResponse` |
| PATCH | `/users/me` | ✔ | 닉네임 변경 (이메일은 변경 불가, FR-106) |
| POST | `/users/me/profile-image` | ✔ | multipart, 칸 이름 `file` |
| DELETE | `/users/me/profile-image` | ✔ | 사진 지우기 (Remove 버튼용) — 새로 추가 |
| GET | `/users/{user_id}/profile-image` | - | 사진 파일 (`<img src>`용) — 새로 추가 |

> 새로 넣은 두 주소는 화면(`userinfo.js`의 "API 정하기")에 맞춰 제안했고, 사용자 결정(2026-10-03)으로 PRD 01 §7 표에도 추가했습니다.

### 2.2 사진을 API로 내보내는 이유
- `storage/`는 웹에 공개하지 않습니다. 정적 파일로 열어 두면 샘플·출력 파일까지 주소만 알면 받을 수 있습니다.
- `<img>` 요청에는 `Authorization` 헤더를 붙일 수 없어서, 사진 주소만 로그인 없이 읽게 했습니다. 협업 화면(Phase 6)에서 다른 멤버 사진도 이 주소로 보여 줍니다.
- 주소 끝에 `?v=<수정 시각>`을 붙이면 사진을 바꿨을 때 브라우저가 예전 사진을 캐시에서 꺼내지 않습니다.

### 2.3 사진 검사 순서
| 단계 | 실패 응답 |
|---|---|
| `content_type`이 jpg/png/webp인가 | 415 `UNSUPPORTED_FILE_TYPE` |
| 2MB 이하인가 (`read(2MB + 1)`로 끝까지 읽지 않고 판단) | 413 `FILE_TOO_LARGE` |
| (권장) 파일 앞 바이트가 실제 이미지인가 | 415 |
| 저장 경로 `profiles/{user_id}/{uuid}.확장자`, DB에는 상대 경로만 (DB.md §1.5) | — |

`content_type`은 브라우저가 보내는 값이라 바꿔 보낼 수 있으므로, 파일 앞 바이트(JPG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF…WEBP`)로 한 번 더 확인하길 권장합니다.

## 3. 검증 결과 (2026-10-03)
| 확인 | 결과 |
|---|---|
| `pytest` | 9개 통과 |
| `ruff check` | 통과 |
| OpenAPI | `/users/me`(GET·PATCH), `/users/me/profile-image`(POST·DELETE), `/users/{user_id}/profile-image`(GET) 표시 |

## 4. 남은 일 (사용자)
| 순서 | 할 일 | 파일 |
|---|---|---|
| 1 | `get_current_user` (P1-03 TODO) — 이 API는 모두 이것에 의존 | `app/api/deps.py` |
| 2 | 서비스 함수 6개 | `app/services/user_service.py` |
| 3 | 라우터 본문 5개 | `app/api/v1/users.py` |
| 4 | 화면 연결 `loadMe`, `initPhotoUpload`, `initProfileForm` | `static/js/pages/userinfo.js` |
| 5 | 사진을 저장 용량(FR-131)에 넣을지 정하기 | — |

## 5. 자주 받을 질문 대비
- **Q. 업로드 라우터만 `async def`인 이유는?** `UploadFile.read()`가 비동기 함수라 `await`가 필요합니다. DB 세션은 동기지만 짧은 커밋 한 번이라 괜찮습니다.
- **Q. 경로 검사(`is_relative_to`)는 왜 하나?** DB 값이 잘못 들어가 `../`가 섞여도 `storage/` 밖 파일을 내보내지 않게 하는 안전장치입니다.
- **Q. 닉네임 길이 규칙은 어디에?** `schemas/auth.py`의 `NICKNAME_MIN/MAX`를 가입과 수정에서 함께 씁니다.
