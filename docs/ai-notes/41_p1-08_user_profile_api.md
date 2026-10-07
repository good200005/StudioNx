# AI 구현 설명 41 — P1-08 회원 정보 API (내 정보 · 닉네임 · 프로필 사진)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) · 2026-10-07 |
| 작업 | P1-08 회원 정보 — PRD 01 FR-106 (FR-131 용량은 제외 결정) |
| 브랜치 | `feature/phase1/p1-08-user-profile-api` |
| 바꾼 파일 | `services/user_service.py` · `api/v1/users.py` · `api/v1/router.py`(한 줄) · `schemas/user.py`(닉네임 타입) |
| 진행 방식 | **함수 하나씩** 구현 → 사용자 검토 → 다음 |
| 함수별 설명 | `docs/ai-notes/backend(fastAPI_Python)/P1-08 - 회원 정보 API/35 ~ 43` (md · PDF), 합본 [`P1-08_user_profile_api.pdf`](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/P1-08_user_profile_api.pdf>) |
| 실제 사이트 시험 | [42_p1-08_site_test.md](42_p1-08_site_test.md) — 8개 모두 통과 |
| 이전 문서 | [40_fix_sweetalert_dialogs.md](40_fix_sweetalert_dialogs.md) |

## 1. 한 일
| API | 하는 일 |
|---|---|
| `GET /api/v1/users/me` | 내 정보 7칸 |
| `PATCH /api/v1/users/me` | 닉네임 변경 (이메일은 변경 불가) |
| `POST /api/v1/users/me/profile-image` | 사진 올리기 — jpg · png · webp, 2MB |
| `DELETE /api/v1/users/me/profile-image` | 사진 지우기 → 화면은 닉네임 첫 글자 |
| `GET /api/v1/profile-images/{name}` | 사진 파일 (`<img src>` 용, 로그인 없이) |

## 2. 사용자 결정 (2026-10-07)
| 결정 | 내용 |
|---|---|
| 프로필 사진 용량 | 저장 한도 5GB 사용량에 **넣지 않음** — 회원당 최대 2MB 한 장, 사용량은 작업 파일만 |
| 사진 주소 | 회원 번호 대신 **무작위 32자 파일 이름** — 템플릿의 `/users/{번호}/profile-image` 는 번호를 바꿔 가며 다른 회원을 찾아볼 수 있어 탈퇴 추적 방지 ③ 과 어긋남. PRD 01 §7 도 고침 |

## 3. 항목 9개
| # | 파일 | 항목 | 하는 일 | 설명 |
|---|---|---|---|---|
| 35 | `user_service.py` | `profile_image_url()` | 저장 경로 → 주소 (`/api/v1/profile-images/{32자}.jpg`) | [35](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/35_user_service_profile_image_url.md>) |
| 36 | `user_service.py` | `to_me_response()` | User → 응답 7칸 (해시 등 제외) | [36](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/36_user_service_to_me_response.md>) |
| 37 | `user_service.py` · `schemas/user.py` | `update_me()` | 닉네임 — 공백 제거 2~20자, 대소문자만 변경 허용, 중복 409, 탈퇴 3일 409 | [37](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/37_user_service_update_me.md>) |
| 38 | `user_service.py` | `save_profile_image()` · `image_extension()` | 종류 · 크기 · **내용** 검사 → 저장 → DB → 예전 파일 삭제 | [38](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/38_user_service_save_profile_image.md>) |
| 39 | `user_service.py` | `delete_profile_image()` | DB → 파일 삭제 (P1-09 탈퇴가 재사용) | [39](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/39_user_service_delete_profile_image.md>) |
| 40 | `user_service.py` | `profile_image_file()` | 이름 → 파일 경로, 이름 모양 · 탈퇴 · 폴더 밖 · 없음은 같은 404 | [40](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/40_user_service_profile_image_file.md>) |
| 41 | `users.py` | `GET · PATCH /users/me` | 36 · 37 연결 | [41](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/41_users_route_me.md>) |
| 42 | `users.py` | `POST · DELETE /users/me/profile-image` | 38 · 39 연결 | [42](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/42_users_route_profile_image.md>) |
| 43 | `users.py` · `router.py` | `GET /profile-images/{name}` | 40 의 파일 + 종류 · `nosniff` · 캐시 1일 | [43](<backend(fastAPI_Python)/P1-08 - 회원 정보 API/43_users_route_profile_image_file.md>) |

## 4. 사진이 움직이는 모습
| 순서 | 일어나는 일 | 항목 |
|---|---|---|
| ① | userInfo.html Upload photo → `FormData` 로 `POST /users/me/profile-image` | 42 |
| ② | 종류 · 2MB · 앞 바이트 검사 → `storage/profiles/{32자}.{확장자}` | 38 |
| ③ | 응답 `profile_image_url` = `/api/v1/profile-images/{32자}.png` | 35 · 36 |
| ④ | 화면이 `<img src>` 에 넣음 → 로그인 없이 파일 · `nosniff` · 캐시 1일 | 43 · 40 |
| ⑤ | 바꾸면 새 이름 + 예전 파일 삭제 / Remove 면 경로 `null` + 파일 삭제 | 38 · 39 |
| ⑥ | 탈퇴하면 (P1-09) 사진 주소 404 · 파일 삭제 | 40 · 39 |

## 5. 템플릿과 달라진 점
| 항목 | 템플릿 | 구현 | 이유 |
|---|---|---|---|
| 사진 주소 | `/users/{번호}/profile-image?v=…` | `/profile-images/{무작위}` | 사용자 결정 (§2) |
| 저장 경로 | `profiles/{번호}/{무작위}` | `profiles/{무작위}` | 같음 |
| 닉네임 스키마 | `str` 2~20자 | 가입과 같은 `Nickname` (공백 제거 후 길이) | `"  a  "` 가 통과해 1자 닉네임이 생기는 빈틈 |
| 대소문자만 바꾸기 | 중복 확인 | DB 가 같다고 보면 건너뜀 | 내 닉네임이 "사용 중" 이 되는 빈틈 |
| 사진 저장 · 삭제 순서 | 예전 파일 삭제 → DB | DB → 예전 파일 삭제 | DB 실패 때 사진이 사라지지 않게 |
| 사진 내용 검사 | (권장) | 함 — 앞 바이트 + 확장자도 내용대로 | `image/png` 라고 속인 HTML 을 막음 |
| 탈퇴 3일 문구 | P1-04 가입 문구 | "This nickname can be used again after …" | 수정 화면에 맞게 (P1-04 는 고치지 않음) |

## 6. 시험
| 파일 | 대상 | 시험 수 |
|---|---|---|
| `tests/test_user_service.py` (새 파일) | 35 ~ 40 (실제 MySQL + 임시 폴더) | 56 |
| `tests/test_user_routes.py` | 41 ~ 43 (실제 앱 + MySQL) + 연결 확인 | 26 |

전체 시험 314개 통과, `ruff` 검사 통과. 실제 사이트 시험 8개 통과 (42). 시험 뒤 DB 에는 데모 계정과 사용자 계정만, 진짜 `storage/` 는 비어 있음.

## 7. 다음 작업이 쓰는 곳 · 알아 둘 점
| 작업 | 쓰는 것 |
|---|---|
| P1-09 비밀번호 변경 · 탈퇴 | 탈퇴 마지막에 39 `delete_profile_image` (그 안의 commit 이 함께 저장) |
| P1-10 회원 정보 화면 JS | 41 · 42 · 응답의 `profile_image_url`. 탈퇴는 `promptDialog` (FIX-01) |
| P1-16 · 17 대시보드 | 35 사진 주소 |

| 알아 둘 점 | 내용 |
|---|---|
| 색인 | `users.profile_image_path` 에 색인이 없어 사진을 열 때 회원 표를 훑음. 회원이 많아지면 UNIQUE 색인 (DB 변경 — 그때 정함) |
| 비동기 안의 DB | 사진 올리기는 `async` 안에서 동기 DB 저장 — 수 밀리초. 사용자가 많아지면 나눔 |
| 브라우저 캐시 | 이미 받아 둔 사진은 지워도 그 브라우저에 최대 1일 남음 (42 §06 에서 확인). 화면은 늘 새 주소를 써서 문제없음 |
