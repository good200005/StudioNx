# Studio Nx — DB 설계 문서

> 이 문서는 Studio Nx의 데이터베이스 구조(테이블, 컬럼, 관계, 인덱스)를 정리한 문서입니다.
> 각 PRD 문서(`docs/PRD/*.md`)의 "사용 테이블" 항목은 이 문서의 절을 가리킵니다.

---

## 1. 개요

### 1.1 DBMS 선택
| 항목 | 내용 |
|---|---|
| DBMS | **MySQL 8.0** |
| 선택 이유 | 기획서 규칙: "Oracle DB를 새로 설치해야 하면 MySQL로 대체". 개발 PC에 Oracle은 없고 MySQL 8.0(서비스 `MySQL80-scit`)이 이미 실행 중 |
| Database 이름 | `studionx` (기존 DB를 쓰지 않고 새로 만듦) |
| 문자셋 | `utf8mb4` / `utf8mb4_0900_ai_ci` (한글·이모지 지원) |
| 스토리지 엔진 | InnoDB (트랜잭션, FK 지원) |

### 1.2 Database 생성
```sql
CREATE DATABASE studionx
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

-- 애플리케이션 전용 계정 (비밀번호는 실제 값으로 교체)
CREATE USER 'studionx_app'@'localhost' IDENTIFIED BY '<비밀번호>';
GRANT SELECT, INSERT, UPDATE, DELETE ON studionx.* TO 'studionx_app'@'localhost';
```

### 1.3 설계 규칙
| 규칙 | 내용 |
|---|---|
| 테이블명 | 소문자 `snake_case`, 복수형 (`users`, `projects`) |
| PK | `<단수형>_id` `BIGINT UNSIGNED AUTO_INCREMENT` (연결 테이블은 복합 PK) |
| FK | 참조 대상 PK와 같은 이름 사용 (예외: `owner_id`, `inviter_id`처럼 의미가 분명할 때) |
| 시간 | `DATETIME(3)`, **UTC 기준**으로 저장. 기본값(`CURRENT_TIMESTAMP`)도 UTC가 되도록 앱이 연결할 때마다 `SET time_zone = '+00:00'`을 실행합니다 (`app/db/session.py`, 2026-10-12). DB 도구로 직접 넣을 때는 세션 시간대를 확인하십시오 |
| 공통 컬럼 | `created_at` (기본값 현재시각), `updated_at` (수정 시 자동 갱신) |
| 소프트 삭제 | 복구가 필요한 데이터(`users`, `projects`, `samples`, `chat_messages`, `timeline_comments`, `dev_notes`)는 `deleted_at`으로 표시만 함 |
| 상태값 | `ENUM` 사용, 값은 대문자 |
| 유연한 설정값 | 플러그인 파라미터, AI 추천 설정 등 구조가 자주 바뀌는 값은 `JSON` |
| 예약어 | MySQL 예약어(`references`, `key` 등)는 테이블/컬럼명으로 쓰지 않음 → `reference_tracks`, `music_key` |

### 1.4 시간 단위(Tick) 규칙
시퀀서의 위치·길이는 초(sec)가 아닌 **tick** 단위로 저장합니다. BPM이 바뀌어도 음표 위치가 틀어지지 않기 위함입니다.
- **PPQ(4분음표 1개당 tick 수) = 960**
- 예: 4/4 박자 1마디 = 960 × 4 = 3840 tick
- **템포·박자 지도**: 시작 BPM·박자는 `projects.bpm`, `time_sig_num/den`, 곡 중간 변경은 `tempo_changes`·`meter_changes` (2026-10-05). tick 은 그대로이고, **실제 시간(초)과 마디 번호는 이 지도로 계산**합니다. 그래서 BPM·박자를 바꿔도 노트·클립·오토메이션은 박자 위치에 붙어 있습니다.
- 6/8 처럼 분모가 8 이면 1마디 = 960 × 6 ÷ 2 = 2880 tick (1마디 tick = 960 × 4 ÷ 분모 × 분자)

### 1.5 파일 저장 정책
- 오디오/MIDI/이미지 파일은 **DB에 BLOB으로 저장하지 않습니다.**
- 파일은 서버 파일 스토리지(개발: 로컬 `storage/` 디렉토리, 추후 S3 등으로 교체 가능)에 저장하고, DB에는 **상대 경로(`file_path`)만** 저장합니다.
- 경로 규칙 예시: `samples/{user_id}/{uuid}.wav`, `exports/{project_id}/{export_id}.mp3`

---

## 2. ERD

![Studio Nx ERD](ERD.png)

> - 이미지 파일: [`docs/ERD.png`](ERD.png) (고해상도)
> - 관계를 글로 정리한 문서: [`docs/ERD.md`](ERD.md)
> - 표기: 박스 안에는 **PK·FK·UQ 컬럼만** 표시 (전체 컬럼은 아래 §3). 선 끝 `|` = 1, 까마귀발 = N, `o` = 0 가능(선택).

### 2.1 테이블 목록
| # | 테이블 | 설명 | Phase |
|---|---|---|---|
| 1 | `users` | 회원 (+ 저장 용량) | 1 |
| 2 | `inquiries` | 홈 화면 문의 | 1 |
| 3 | `projects` | 시퀀서 프로젝트 | 1 (목록) / 2 (편집) |
| 4 | `project_members` | 프로젝트 참여자·권한 (생성 시 OWNER 등록) | 1 / 6 |
| 5 | `samples` | 개인 샘플 라이브러리 (업로드·녹음·출력·분리 결과) | 2 |
| 6 | `tags` | 태그(장르·악기·분위기) | 2 |
| 7 | `sample_tags` | 샘플-태그 연결 | 2 |
| 8 | `plugins` | 웹 기반 가상악기/이펙트 목록 | 2 |
| 9 | `plugin_presets` | 플러그인 프리셋 | 2 |
| 10 | `tracks` | 트랙 (AUDIO / MIDI / MASTER / GROUP / RETURN) | 2 |
| 11 | `track_plugins` | 트랙 디바이스 — 체인 순서 + 패처 노드 위치 | 2 |
| 12 | `track_plugin_links` | 패처 모드의 디바이스 연결선(라우팅) | 2 |
| 13 | `patterns` | MIDI 패턴 (링크 클립이 공유하는 노트 묶음) | 2 |
| 14 | `clips` | 타임라인 위의 오디오·MIDI 클립 | 2 |
| 15 | `midi_notes` | 패턴의 노트 | 2 |
| 16 | `automation_lanes` | 오토메이션 레인 (대상 파라미터) | 2 |
| 17 | `automation_points` | 오토메이션 포인트 | 2 |
| 18 | `project_templates` | 프로젝트 템플릿 (시스템/내 템플릿) | 2 |
| 19 | `user_settings` | 사용자 UI 설정 (테마·단축키·캐릭터·하단 패널·튜토리얼) | 2 |
| 20 | `export_jobs` | 오디오 출력 작업 | 3 |
| 21 | `separation_jobs` | 악기 분리 작업 | 4 |
| 22 | `separation_stems` | 분리 결과 stem | 4 |
| 23 | `reference_tracks` | 레퍼런스 트랙(링크/파일) | 5 |
| 24 | `reference_tags` | 레퍼런스-태그(장르) 연결 | 5 |
| 25 | `ai_analyses` | AI 분석 결과 | 5 |
| 26 | `ai_recommendations` | AI 추천 설정(프리셋/믹싱/마스터링) | 5 |
| 27 | `assistant_messages` | Nyxi 도우미(AI) 대화 기록 | 5 |
| 28 | `invitations` | 프로젝트 초대 | 6 |
| 29 | `project_change_logs` | 실시간 편집 변경 이력 | 6 |
| 30 | `chat_messages` | 프로젝트 단체 채팅(톡방) | 6 |
| 31 | `timeline_comments` | 타임라인 코멘트 (위치 댓글·답글·해결) | 6 |
| 32 | `project_snapshots` | 버전 스냅샷 | 6 |
| 33 | `dev_notes` | 메인 페이지 Development 공지 (관리자만 작성) | 1 |
| 34 | `project_sessions` | 프로젝트 작업 세션 (마이페이지 최근 7일 작업 시간) | 1 (표시) / 2 (기록) |
| 35 | `tempo_changes` | 곡 중간 템포 변경점 (템포 지도) | 2 |
| 36 | `meter_changes` | 곡 중간 박자 변경점 (박자 지도) | 2 |
| 37 | `track_instruments` | 트랙의 악기 (레이어링: 한 트랙에 여러 악기) | 2 |
| 38 | `track_sends` | 센드 (트랙 → 리턴 트랙으로 보내는 양) | 2 |
| 39 | `track_connections` | Connect to Another (다른 트랙의 플러그인·악기 단계로 연결) | 2 |
| 40 | `midi_cc_events` | 패턴의 CC · 피치벤드 · 페달 이벤트 | 2 |
| 41 | `markers` | 타임라인 마커 (Intro · Drop …) | 2 |
| 42 | `password_reset_tokens` | 비밀번호 재설정 링크 토큰 (해시, 30분, 1회용) | 1 |

---

## 3. 테이블 정의

> 표기: **PK** 기본키, **FK** 외래키, **UQ** 유니크, **IDX** 인덱스, `CURRENT` = `CURRENT_TIMESTAMP(3)`

### 3.1 Phase 1 — 계정 · 기본

#### `users` — 회원
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| user_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | 회원 ID |
| email | VARCHAR(255) | N | | UQ | 로그인 ID |
| password_hash | VARCHAR(255) | N | | | bcrypt/argon2 해시 (평문 저장 금지) |
| nickname | VARCHAR(50) | N | | UQ | 화면 표시 이름 |
| profile_image_path | VARCHAR(500) | Y | NULL | | 프로필 이미지 경로 |
| role | ENUM('USER','ADMIN') | N | 'USER' | | 권한 |
| status | ENUM('ACTIVE','SUSPENDED','DELETED') | N | 'ACTIVE' | | 계정 상태 |
| last_login_at | DATETIME(3) | Y | NULL | | 마지막 로그인 |
| password_changed_at | DATETIME(3) | Y | NULL | | 비밀번호를 재설정한 시각 (2026-10-14). 이 시각보다 먼저 발급된 로그인(액세스, 리프레시 토큰의 `iat`)은 무효 |
| privacy_agreed_at | DATETIME(3) | N | | | 가입 때 개인정보 처리방침 동의(+만 16세 이상 확인) 시각 — 동의 없이는 가입 불가 |
| privacy_version | VARCHAR(20) | N | | | 동의한 처리방침 버전(시행일, 예: `2026-10-05`) — 처리방침이 바뀌면 어느 판에 동의했는지 확인 |
| storage_quota_bytes | BIGINT UNSIGNED | N | 5368709120 | | 저장 한도 (기본 5GB) |
| storage_used_bytes | BIGINT UNSIGNED | N | 0 | | 현재 사용량 (파일 생성·삭제 시 증감, 하루 1회 재계산) |
| created_at | DATETIME(3) | N | CURRENT | | 가입일 |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | 수정일 |
| deleted_at | DATETIME(3) | Y | NULL | | 탈퇴일(소프트 삭제) |

#### `password_reset_tokens` — 비밀번호 재설정 토큰 (FR-118)
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| token_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| user_id | BIGINT UNSIGNED | N | | FK → users, IDX | 재설정할 회원 |
| token_hash | CHAR(64) | N | | UQ | 링크에 넣은 토큰의 SHA-256 해시 (**원문은 저장하지 않음**, 메일 링크에만 있음) |
| expires_at | DATETIME(3) | N | | IDX | 만료 시각 (발급 + 30분) |
| used_at | DATETIME(3) | Y | NULL | | 사용한 시각 (NULL이 아니면 다시 쓸 수 없음) |
| created_at | DATETIME(3) | N | CURRENT | | 발급 시각 |

> 같은 회원이 다시 요청하면 이전 토큰은 사용 처리합니다. 만료되었거나 사용한 행은 정리 작업(`retention`)에서 지웁니다.

#### `inquiries` — 문의 (home.html 문의 창)
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| inquiry_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| user_id | BIGINT UNSIGNED | Y | NULL | FK → users | 비회원 문의면 NULL |
| name | VARCHAR(50) | Y | NULL | | 작성자 이름 (메인 페이지 문의 폼은 이름을 받지 않음 → NULL) |
| email | VARCHAR(255) | N | | | 답변 받을 이메일 |
| title | VARCHAR(200) | N | | | 제목 |
| content | TEXT | N | | | 내용 (폼에서 최대 2,000자) |
| privacy_agreed_at | DATETIME(3) | N | | | 개인정보 정책 동의 시각 (동의 없이는 저장 불가) |
| status | ENUM('RECEIVED','ANSWERED','CLOSED') | N | 'RECEIVED' | IDX | 처리 상태 |
| answer | TEXT | Y | NULL | | 관리자 답변 |
| answered_at | DATETIME(3) | Y | NULL | | 답변 일시 |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

#### `dev_notes` — Development 공지 (메인 페이지)
> 작성·수정은 **관리자(`users.role = 'ADMIN'`)만** 가능 — 관리 화면은 SQLAdmin(`/admin`). 메인 페이지는 공개된 최신 4건을 읽기만 함.

| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| note_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| author_id | BIGINT UNSIGNED | N | | FK → users | 작성한 관리자 |
| title | VARCHAR(150) | N | | | 제목 |
| summary | VARCHAR(300) | N | | | 카드에 보이는 짧은 요약 |
| content | MEDIUMTEXT | N | | | 본문 (Markdown) |
| is_published | TINYINT(1) | N | 0 | IDX(is_published, published_at) | 공개 여부 (0 = 초안) |
| published_at | DATETIME(3) | Y | NULL | | 공개 시각 — 메인 페이지 정렬 기준 |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |
| deleted_at | DATETIME(3) | Y | NULL | | 소프트 삭제 |

#### `projects` — 시퀀서 프로젝트
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| project_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| owner_id | BIGINT UNSIGNED | N | | FK → users, IDX | 생성자(소유자) |
| title | VARCHAR(100) | N | | | 프로젝트 이름 |
| description | VARCHAR(500) | Y | NULL | | 설명 |
| bpm | DECIMAL(6,2) | N | 120.00 | | **시작** 템포 (곡 중간 변경은 `tempo_changes`) |
| time_sig_num | TINYINT UNSIGNED | N | 4 | | **시작** 박자 분자 (4/4의 앞 4, 곡 중간 변경은 `meter_changes`) |
| time_sig_den | TINYINT UNSIGNED | N | 4 | | 박자 분모 |
| music_key | VARCHAR(10) | Y | NULL | | 조성 (예: `C#m`) |
| scale_mode | VARCHAR(20) | Y | NULL | | 스케일 (`major`, `minor`, `dorian`, `pentatonic_minor` 등) — 스케일 도우미용 |
| sample_rate | INT UNSIGNED | N | 48000 | | 프로젝트 샘플레이트 |
| master_settings | JSON | Y | NULL | | 마스터 부가 설정(목표 LUFS, 디더링 등). **마스터 디바이스는 MASTER 트랙의 `track_plugins`** |
| revision | INT UNSIGNED | N | 0 | | 협업용 문서 버전 번호 (Phase 6) |
| thumbnail_path | VARCHAR(500) | Y | NULL | | 목록용 썸네일 |
| template_id | BIGINT UNSIGNED | Y | NULL | FK → project_templates | 시작한 템플릿 (기록용) |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | IDX | 최근 수정순 정렬용 |
| deleted_at | DATETIME(3) | Y | NULL | | 소프트 삭제 |

#### `project_sessions` — 작업 세션 (마이페이지 작업 시간)
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| session_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, IDX(project_id, started_at) | 작업한 프로젝트 |
| user_id | BIGINT UNSIGNED | N | | FK → users, IDX(user_id, started_at) | 작업한 사람 (협업 프로젝트도 **본인 시간만** 셈) |
| started_at | DATETIME(3) | N | CURRENT | | 시퀀서에서 프로젝트를 연 시각 |
| last_seen_at | DATETIME(3) | N | CURRENT | | 마지막 신호 시각 (시퀀서가 1분마다 보냄). 신호가 끊긴 시각 = 세션 끝 |
| active_seconds | INT UNSIGNED | N | 0 | | 실제 작업 시간(초). 마우스·키보드 입력이 **5분 넘게 없는 구간은 빼고** 더함 |

> - 기록: 시퀀서(Phase 2)가 프로젝트를 열면 행을 만들고, 1분마다 `last_seen_at`과 `active_seconds`를 갱신합니다. 마지막 신호가 10분 넘게 지났으면 새 세션을 만듭니다.
> - 표시: 마이페이지(Phase 1)가 `user_id` 기준 최근 7일 행을 읽어 요일별 막대와 합계를 그립니다. 날짜는 UTC로 저장하고, 요일 구분은 브라우저 시간대로 합니다. 자정을 넘긴 세션은 시작한 날에 표시합니다.

---

### 3.2 Phase 2 — 시퀀서 코어

#### `samples` — 개인 샘플 라이브러리
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| sample_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| owner_id | BIGINT UNSIGNED | N | | FK → users, IDX | 소유자 |
| name | VARCHAR(200) | N | | | 표시 이름 (기본값: 원본 파일명) |
| original_filename | VARCHAR(255) | N | | | 업로드 원본 파일명 |
| file_path | VARCHAR(500) | N | | | 스토리지 상대 경로 |
| mime_type | VARCHAR(100) | N | | | `audio/wav` 등 |
| file_size | BIGINT UNSIGNED | N | | | 바이트 |
| duration_ms | INT UNSIGNED | Y | NULL | | 길이(ms) |
| sample_rate | INT UNSIGNED | Y | NULL | | |
| channels | TINYINT UNSIGNED | Y | NULL | | 1=mono, 2=stereo |
| bpm | DECIMAL(6,2) | Y | NULL | | 감지/입력된 BPM |
| music_key | VARCHAR(10) | Y | NULL | | 감지/입력된 키 |
| waveform_path | VARCHAR(500) | Y | NULL | | 파형 미리보기 데이터(JSON/PNG) 경로 |
| source | ENUM('UPLOAD','SEPARATION','EXPORT','RECORDING','BOUNCE','RESAMPLE') | N | 'UPLOAD' | | 생성 경로 (BOUNCE = 트랙을 오디오로 굳힘·프리즈, RESAMPLE = 마스터 소리를 녹음) |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |
| deleted_at | DATETIME(3) | Y | NULL | | |

#### `tags` — 태그
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| tag_id | INT UNSIGNED | N | AUTO_INCREMENT | PK | |
| name | VARCHAR(50) | N | | UQ(category, name) | 태그명 (예: `Lo-fi`, `Kick`) |
| category | ENUM('GENRE','INSTRUMENT','MOOD','ETC') | N | 'ETC' | | 분류 |
| is_system | TINYINT(1) | N | 1 | | 1=기본 제공 태그(클릭 선택용), 0=사용자 생성 |
| created_at | DATETIME(3) | N | CURRENT | | |

#### `sample_tags` — 샘플-태그 연결
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| sample_id | BIGINT UNSIGNED | N | | PK, FK → samples | |
| tag_id | INT UNSIGNED | N | | PK, FK → tags, IDX | |

#### `plugins` — 웹 기반 가상악기 / 이펙트
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| plugin_id | INT UNSIGNED | N | AUTO_INCREMENT | PK | |
| code | VARCHAR(50) | N | | UQ | 프론트에서 모듈을 찾는 키 (예: `nx-subsynth`, `nx-eq3`) |
| name | VARCHAR(100) | N | | | 표시 이름 |
| plugin_type | ENUM('INSTRUMENT','EFFECT','MIDI_EFFECT') | N | | | 가상악기 / 이펙트 / MIDI 이펙트(Arpeggiator·Chord 등, 악기 앞에서 노트를 바꿈) |
| engine | ENUM('WEBAUDIO','WASM') | N | 'WEBAUDIO' | | 구현 방식 (Web Audio 노드 / C++→WASM) |
| version | VARCHAR(20) | N | '1.0.0' | | |
| param_schema | JSON | N | | | 파라미터 정의 배열: 이름, 범위, 기본값, 단위, **`primary`**(카드에 노출할 핵심 파라미터 여부), **`group`**(상세 모달의 탭/섹션) |
| card_asset | VARCHAR(100) | Y | NULL | | 디바이스 카드 아트 키 (Nyxi 에셋 `manifest.json`의 항목명, 외부 제작). NULL이면 플레이스홀더 |
| is_active | TINYINT(1) | N | 1 | | 사용 가능 여부 |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

#### `plugin_presets` — 플러그인 프리셋
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| preset_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| plugin_id | INT UNSIGNED | N | | FK → plugins, IDX | |
| owner_id | BIGINT UNSIGNED | Y | NULL | FK → users | NULL이면 시스템 기본 프리셋 |
| name | VARCHAR(100) | N | | | |
| params | JSON | N | | | 파라미터 값 |
| source | ENUM('SYSTEM','USER','AI') | N | 'USER' | | AI 추천을 저장한 경우 'AI' |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

#### `tracks` — 트랙
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| track_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, IDX(project_id, order_index) | |
| name | VARCHAR(100) | N | | | |
| track_type | ENUM('AUDIO','MIDI','MASTER','GROUP','RETURN') | N | | | MASTER는 프로젝트당 1개, 생성 시 자동 생성·삭제 불가. **GROUP** = 그룹(폴더) 트랙, **RETURN** = 리턴 트랙(센드를 받음) |
| order_index | INT UNSIGNED | N | 0 | | 화면 위→아래 순서 |
| color | CHAR(7) | N | '#7C5CFF' | | HEX 색상 |
| volume_db | DECIMAL(5,2) | N | 0.00 | | 페이더 (-60 ~ +6 dB) |
| pan | DECIMAL(3,2) | N | 0.00 | | -1.00(L) ~ 1.00(R) |
| is_muted | TINYINT(1) | N | 0 | | |
| is_solo | TINYINT(1) | N | 0 | | |
| is_enabled | TINYINT(1) | N | 1 | | 켜기/끄기 (0 = 트랙을 아예 멈춤, 처리도 쉼). `is_muted` 는 소리만 끔 |
| parent_track_id | BIGINT UNSIGNED | Y | NULL | FK → tracks | 속한 그룹 트랙 (그룹이 지워지면 NULL) |
| frozen_sample_id | BIGINT UNSIGNED | Y | NULL | FK → samples | 프리즈 결과 오디오. 값이 있으면 이 오디오를 재생하고 악기·이펙트 처리는 쉼 |
| routing_mode | ENUM('CHAIN','PATCHER') | N | 'CHAIN' | | 디바이스 라우팅 방식. CHAIN: `slot_index` 순서대로 직렬 연결 / PATCHER: `track_plugin_links` 연결선대로 처리 |
| assignee_id | BIGINT UNSIGNED | Y | NULL | FK → users | 담당 멤버 (표시용, Phase 6) |
| locked_by | BIGINT UNSIGNED | Y | NULL | FK → users | 잠근 멤버. NULL이면 잠금 없음 (Phase 6) |
| locked_at | DATETIME(3) | Y | NULL | | 잠근 시각 (자동 해제 판단) |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

> 트랙 펼침 상태는 사용자마다 다르므로 DB에 저장하지 않고 브라우저(localStorage)에 저장합니다.
> 악기는 2026-10-06부터 `track_instruments`에 저장합니다 (예전 `instrument_plugin_id`·`instrument_params` 삭제 — 레이어링으로 악기가 여러 개가 될 수 있음).

#### `track_plugins` — 트랙 디바이스 (체인 + 패처 노드)
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| track_plugin_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| track_id | BIGINT UNSIGNED | N | | FK → tracks, UQ(track_id, slot_index) | |
| plugin_id | INT UNSIGNED | N | | FK → plugins | `plugin_type = 'EFFECT'`만 허용(애플리케이션에서 검증) |
| slot_index | TINYINT UNSIGNED | N | | | 체인 뷰에서의 순서 (0부터). CHAIN 모드에서는 이 순서가 곧 신호 흐름 |
| node_x | INT | Y | NULL | | 패처 뷰에서 노드의 X 좌표(px) |
| node_y | INT | Y | NULL | | 패처 뷰에서 노드의 Y 좌표(px) |
| params | JSON | N | | | 파라미터 값 |
| is_bypassed | TINYINT(1) | N | 0 | | |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

#### `track_plugin_links` — 패처 연결선
> `tracks.routing_mode = 'PATCHER'`일 때만 사용. CHAIN → PATCHER 전환 시 현재 체인 순서대로 연결선을 자동 생성합니다.

| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| link_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| track_id | BIGINT UNSIGNED | N | | FK → tracks, IDX | |
| from_track_plugin_id | BIGINT UNSIGNED | Y | NULL | FK → track_plugins | 출발 노드. **NULL = 트랙 소스**(오디오 클립 또는 가상악기 출력) |
| from_port | TINYINT UNSIGNED | N | 0 | | 출발 노드의 출력 포트 번호 |
| to_track_plugin_id | BIGINT UNSIGNED | Y | NULL | FK → track_plugins | 도착 노드. **NULL = 트랙 출력**(페이더 → 마스터) |
| to_port | TINYINT UNSIGNED | N | 0 | | 도착 노드의 입력 포트 번호 (사이드체인 등은 1번 이상) |
| gain_db | DECIMAL(5,2) | N | 0.00 | | 연결선 게인 (병렬 처리 시 비율 조절) |
| created_at | DATETIME(3) | N | CURRENT | | |

> 순환(사이클) 연결과, 같은 노드·포트 쌍의 중복 연결은 애플리케이션에서 막습니다.

#### `track_instruments` — 트랙의 악기 (레이어링)
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| track_instrument_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| track_id | BIGINT UNSIGNED | N | | FK → tracks, UQ(track_id, slot_index) | MIDI 트랙 |
| plugin_id | INT UNSIGNED | N | | FK → plugins | `plugin_type = 'INSTRUMENT'`만 (애플리케이션 검사) |
| slot_index | TINYINT UNSIGNED | N | 0 | | INSTRUMENTS 칸 순서 (0 = 첫 악기). 같은 노트를 모든 악기가 연주 |
| params | JSON | Y | NULL | | 악기 파라미터 값 |
| volume_db | DECIMAL(5,2) | N | 0.00 | | 이 악기 줄의 볼륨 |
| pan | DECIMAL(3,2) | N | 0.00 | | 이 악기 줄의 팬 |
| is_solo | TINYINT(1) | N | 0 | | 이 악기 줄만 듣기 |
| is_enabled | TINYINT(1) | N | 1 | | |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

#### `track_sends` — 센드 (리턴 트랙으로 보내기)
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| send_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| track_id | BIGINT UNSIGNED | N | | FK → tracks, UQ(track_id, return_track_id) | 보내는 트랙 |
| return_track_id | BIGINT UNSIGNED | N | | FK → tracks | 받는 리턴 트랙 (`track_type='RETURN'`, 자기 자신 금지 — 애플리케이션 검사) |
| level_db | DECIMAL(5,2) | N | -12.00 | | 보내는 양 |
| is_pre_fader | TINYINT(1) | N | 0 | | 1 = 페이더 전 (트랙 볼륨과 상관없이 보냄) |
| created_at | DATETIME(3) | N | CURRENT | | |

#### `track_connections` — Connect to Another
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| connection_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| from_track_id | BIGINT UNSIGNED | N | | FK → tracks, **UQ** | 보내는 트랙 (트랙마다 연결 1개). 행이 없으면 `Connect = None` |
| to_track_id | BIGINT UNSIGNED | N | | FK → tracks, IDX | 받는 트랙 (Track 번호 칸) |
| target | ENUM('PLUGIN','INSTRUMENTS') | N | 'PLUGIN' | | PLUGIN = 받는 트랙의 플러그인 입력 / INSTRUMENTS = 레이어 (`<from Track X>` 줄) |
| to_track_plugin_id | BIGINT UNSIGNED | Y | NULL | FK → track_plugins | PLUGIN 일 때 받는 플러그인 (Plugin 칸). INSTRUMENTS 이면 NULL |
| to_port | TINYINT UNSIGNED | N | 1 | | 받는 플러그인의 입력 번호 (사이드체인·Carrier 등). 입력 종류(엿듣기/옮기기)는 `plugins.param_schema` 에 정의 |
| also_play | TINYINT(1) | Y | NULL | | NULL = 자동(엿듣기 켜짐 / 옮기기 꺼짐), 1·0 = 사용자가 `Also play this track` 으로 정함 |
| volume_db | DECIMAL(5,2) | N | 0.00 | | INSTRUMENTS 일 때 받는 쪽 `<from Track X>` 줄의 볼륨 |
| pan | DECIMAL(3,2) | N | 0.00 | | 〃 팬 |
| is_solo | TINYINT(1) | N | 0 | | 〃 Solo |
| created_at | DATETIME(3) | N | CURRENT | | |

> 자기 자신·서로(1→10, 10→1)·고리(1→10→5→1) 연결, PLUGIN 인데 플러그인이 비어 있는 경우는 애플리케이션에서 막습니다 (MySQL 은 CASCADE 가 걸린 FK 컬럼에 CHECK 를 둘 수 없음). 받는 트랙·플러그인이 지워지면 행이 지워져 `Connect = None` 이 됩니다.

#### `clips` — 클립
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| clip_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| track_id | BIGINT UNSIGNED | N | | FK → tracks, IDX(track_id, start_tick) | |
| clip_type | ENUM('AUDIO','MIDI') | N | | | 트랙 타입과 일치해야 함 |
| sample_id | BIGINT UNSIGNED | Y | NULL | FK → samples | AUDIO 클립일 때만 사용 |
| pattern_id | BIGINT UNSIGNED | Y | NULL | FK → patterns, IDX | **MIDI 클립은 필수.** 같은 패턴을 가리키는 클립끼리 링크(하나를 고치면 모두 바뀜) |
| name | VARCHAR(100) | Y | NULL | | |
| start_tick | INT UNSIGNED | N | | | 타임라인 시작 위치 |
| length_tick | INT UNSIGNED | N | | | 클립 길이 |
| offset_tick | INT UNSIGNED | N | 0 | | 샘플 앞부분 잘라낸 양 (트리밍) |
| gain_db | DECIMAL(5,2) | N | 0.00 | | 클립 게인 (노멀라이즈는 피크를 계산해 이 값으로 설정) |
| is_looped | TINYINT(1) | N | 0 | | |
| fade_in_tick | INT UNSIGNED | N | 0 | | 앞 페이드 길이 (오디오) |
| fade_out_tick | INT UNSIGNED | N | 0 | | 뒤 페이드 길이. 겹친 두 클립의 페이드가 크로스페이드 |
| fade_in_curve | DECIMAL(3,2) | N | 0.00 | | 페이드 곡선 (-1.00 ~ 1.00, 0 = 직선) |
| fade_out_curve | DECIMAL(3,2) | N | 0.00 | | |
| warp_mode | ENUM('OFF','BEATS','TONES','TEXTURE','REPITCH','COMPLEX') | N | 'BEATS' | | 늘이기 방식. OFF = 초 단위 재생(템포를 따르지 않음) |
| warp_markers | JSON | Y | NULL | | Warp 마커 `[{sample_sec, tick}]` |
| pitch_semitones | DECIMAL(5,2) | N | 0.00 | | 음정 (-48 ~ +48 반음, 소수 = 센트) |
| is_reversed | TINYINT(1) | N | 0 | | 거꾸로 재생 |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

#### `midi_notes` — MIDI 노트
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| note_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| pattern_id | BIGINT UNSIGNED | N | | FK → patterns, IDX(pattern_id, start_tick) | 노트는 클립이 아니라 **패턴**에 속함 |
| pitch | TINYINT UNSIGNED | N | | | 0~127 (60 = C4) |
| velocity | TINYINT UNSIGNED | N | 100 | | 1~127 |
| start_tick | INT UNSIGNED | N | | | **패턴 시작 기준** 상대 위치 |
| length_tick | INT UNSIGNED | N | | | |
| channel | TINYINT UNSIGNED | N | 0 | | 0~15 |
| release_velocity | TINYINT UNSIGNED | N | 64 | | 건반을 뗄 때의 세기 (피아노 음색 등) |
| is_muted | TINYINT(1) | N | 0 | | 노트 뮤트 (지우지 않고 소리만 끔) |
| probability | DECIMAL(3,2) | N | 1.00 | | 재생될 확률 (0.00 ~ 1.00) |
| velocity_deviation | TINYINT UNSIGNED | N | 0 | | 재생마다 벨로시티를 ± 이 값 안에서 랜덤 |

#### `midi_cc_events` — CC · 피치벤드 · 페달
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| event_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| pattern_id | BIGINT UNSIGNED | N | | FK → patterns, IDX(pattern_id, controller, tick) | 노트처럼 **패턴**에 속함 |
| tick | INT UNSIGNED | N | | | 패턴 시작 기준 위치 |
| controller | SMALLINT UNSIGNED | N | | | 0~127 = CC 번호 (1 모듈레이션, 64 서스테인 페달, 67 소프트 페달 …) / 128 = 피치벤드 / 129 = 채널 프레셔 |
| value | SMALLINT UNSIGNED | N | | | CC 0~127, 피치벤드 0~16383 (8192 = 가운데) |
| channel | TINYINT UNSIGNED | N | 0 | | 0~15 |

#### `patterns` — MIDI 패턴
> MIDI 클립의 노트는 패턴에 저장됩니다. 클립 복제 시 **링크 복제**는 같은 `pattern_id`, **독립 복제**는 패턴을 복사해 새 `pattern_id`를 씁니다.

| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| pattern_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, IDX | |
| name | VARCHAR(100) | N | | | 패턴 이름 (예: `Drum A`) |
| color | CHAR(7) | Y | NULL | | 링크 클립 표시 색 |
| length_tick | INT UNSIGNED | N | 3840 | | 패턴 길이 (기본 1마디) |
| swing | DECIMAL(3,2) | N | 0.00 | | 스윙 정도 (0.00 ~ 1.00, 짝수 16분음표를 뒤로 밂) |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

#### `automation_lanes` — 오토메이션 레인
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| lane_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| track_id | BIGINT UNSIGNED | N | | FK → tracks, IDX | 대상 트랙 (MASTER 트랙 포함) |
| target_type | ENUM('VOLUME','PAN','INSTRUMENT_PARAM','DEVICE_PARAM') | N | | | 대상 종류 |
| track_plugin_id | BIGINT UNSIGNED | Y | NULL | FK → track_plugins | `DEVICE_PARAM`일 때 대상 디바이스 |
| param_index | SMALLINT UNSIGNED | Y | NULL | | `*_PARAM`일 때 `param_schema` 순번 |
| is_enabled | TINYINT(1) | N | 1 | | 레인 켜기/끄기 |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

> 같은 대상에 레인이 두 개 생기지 않도록 애플리케이션에서 검사합니다 (NULL이 섞여 DB UNIQUE로는 막기 어려움).

#### `automation_points` — 오토메이션 포인트
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| point_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| lane_id | BIGINT UNSIGNED | N | | FK → automation_lanes, IDX(lane_id, tick) | |
| tick | INT UNSIGNED | N | | | 타임라인 위치 |
| value | DECIMAL(12,4) | N | | | 파라미터 **실제 단위** 값 (dB, Hz 등) |
| curve | DECIMAL(3,2) | N | 0.00 | | 다음 포인트까지 곡선 정도 (-1.00 ~ 1.00, 0 = 직선) |

#### `tempo_changes` — 템포 변경점 (템포 지도)
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| tempo_change_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, UQ(project_id, tick) | |
| tick | INT UNSIGNED | N | | | 변경 위치 (> 0. 0 위치의 템포는 `projects.bpm`) |
| bpm | DECIMAL(6,2) | N | | | 템포 (20.00 ~ 300.00) |
| ramp | ENUM('STEP','LINEAR') | N | 'STEP' | | `STEP` = 이 위치에서 바로 바뀜 / `LINEAR` = 직전 템포 지점부터 이 위치까지 서서히 바뀜 |
| created_at | DATETIME(3) | N | CURRENT | | |

#### `meter_changes` — 박자 변경점 (박자 지도)
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| meter_change_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, UQ(project_id, tick) | |
| tick | INT UNSIGNED | N | | | 변경 위치 (> 0, **마디 경계만** — 애플리케이션에서 검사) |
| time_sig_num | TINYINT UNSIGNED | N | | | 분자 (1 ~ 32) |
| time_sig_den | TINYINT UNSIGNED | N | | | 분모 (1·2·4·8·16·32) |
| created_at | DATETIME(3) | N | CURRENT | | |

#### `markers` — 타임라인 마커
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| marker_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, IDX(project_id, tick) | |
| tick | INT UNSIGNED | N | | | 위치 |
| name | VARCHAR(50) | N | | | 이름 (Intro · Drop …) |
| color | CHAR(7) | Y | NULL | | |
| created_at | DATETIME(3) | N | CURRENT | | |

> 시퀀서 화면: 오토메이션 모드에서 맨 위 **Tempo** 줄(점·계단/직선)과 **Meter** 줄(마디 단위 덩어리)로 편집합니다. 처음엔 변경점이 없어 평평한 선·한 덩어리입니다 ([Sequencer_Layout_Mockup.md](Sequencer_Layout_Mockup.md) 목업 14).

#### `project_templates` — 프로젝트 템플릿
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| template_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| owner_id | BIGINT UNSIGNED | Y | NULL | FK → users, IDX | NULL = 시스템 템플릿 |
| name | VARCHAR(100) | N | | | |
| description | VARCHAR(500) | Y | NULL | | |
| genre_tag_id | INT UNSIGNED | Y | NULL | FK → tags | 장르 |
| data | JSON | N | | | BPM·박자·키, 트랙 구성, 디바이스 체인, (선택) 패턴·샘플 참조 |
| preview_path | VARCHAR(500) | Y | NULL | | 미리듣기 오디오 |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

#### `user_settings` — 사용자 UI 설정 (users와 1:1)
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| user_id | BIGINT UNSIGNED | N | | PK, FK → users | |
| theme | ENUM('DARK','LIGHT','SYSTEM') | N | 'DARK' | | 테마 |
| accent_color | CHAR(7) | N | '#7C5CFF' | | 강조 색 |
| ui_scale | DECIMAL(3,2) | N | 1.00 | | UI 배율 (0.80 ~ 1.50) |
| keybindings | JSON | Y | NULL | | 사용자 지정 단축키 `{명령ID: 키}` (기본값과 다른 것만 저장) |
| tutorial_state | JSON | Y | NULL | | 튜토리얼 코스별 진행 단계·완료 여부 |
| character_enabled | TINYINT(1) | N | 1 | | 시퀀서 화면 캐릭터 표시 여부 |
| character_code | VARCHAR(50) | N | 'nyxi' | | 선택한 캐릭터/스킨 (에셋 폴더 `static/characters/{code}/`) |
| character_state | JSON | Y | NULL | | 캐릭터 창 위치·크기, 춤 on/off, 말풍선 on/off |
| tips_level | ENUM('OFF','IMPORTANT','ALL') | N | 'IMPORTANT' | | Nyxi 팁 레벨 (끄기 / 중요한 것만 / 모두) |
| tips_state | JSON | Y | NULL | | 다시 보지 않기 팁 목록, 팁별 마지막 표시 시각, **익숙해짐 확인창(프로젝트 5개) 표시 시각** |
| bottom_panel_state | JSON | Y | NULL | | 하단 패널 높이, 마지막으로 연 탭(톡방/Nyxi) |
| ui_settings | JSON | Y | NULL | | 기타 UI 설정 (**`language`: 시퀀서 언어 `en`·`ko`·`ja`, 없으면 `en`**, 글자 크기, 고대비, 패널 위치·너비, 파형·미터 스타일, 스냅·자동저장 기본값, 오디오 버퍼, 녹음 레이턴시 보정값, 로컬 캐시 상한 등) |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |

---

### 3.3 Phase 3 — 오디오 출력

#### `export_jobs` — 출력 작업
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| export_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, IDX | |
| user_id | BIGINT UNSIGNED | N | | FK → users | 요청자 |
| format | ENUM('WAV','MP3','FLAC') | N | | | |
| sample_rate | INT UNSIGNED | N | 44100 | | |
| bit_depth | TINYINT UNSIGNED | Y | NULL | | WAV/FLAC: 16/24/32 |
| bitrate_kbps | SMALLINT UNSIGNED | Y | NULL | | MP3: 128/192/320 |
| range_start_tick | INT UNSIGNED | N | 0 | | 출력 구간 시작 |
| range_end_tick | INT UNSIGNED | Y | NULL | | NULL이면 프로젝트 끝까지 |
| render_mode | ENUM('CLIENT','SERVER') | N | 'CLIENT' | | 렌더링 위치 |
| export_mode | ENUM('MIXDOWN','STEMS') | N | 'MIXDOWN' | | 전체 믹스다운 / 트랙별 따로(stems, 결과는 zip) |
| status | ENUM('PENDING','PROCESSING','DONE','FAILED') | N | 'PENDING' | IDX | |
| progress | TINYINT UNSIGNED | N | 0 | | 0~100 |
| result_path | VARCHAR(500) | Y | NULL | | 결과 파일 경로 |
| file_size | BIGINT UNSIGNED | Y | NULL | | |
| error_message | VARCHAR(1000) | Y | NULL | | |
| created_at | DATETIME(3) | N | CURRENT | | |
| completed_at | DATETIME(3) | Y | NULL | | |

---

### 3.4 Phase 4 — 악기 분리

#### `separation_jobs` — 분리 작업
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| separation_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| user_id | BIGINT UNSIGNED | N | | FK → users, IDX | 요청자 |
| source_sample_id | BIGINT UNSIGNED | N | | FK → samples | 분리할 원본 |
| model_name | VARCHAR(50) | N | | | 사용 모델 (예: `htdemucs`) |
| stem_mode | ENUM('2STEM','4STEM','6STEM') | N | '4STEM' | | 2: 보컬/반주, 4: 보컬/드럼/베이스/기타, 6: +기타/피아노 |
| status | ENUM('PENDING','PROCESSING','DONE','FAILED') | N | 'PENDING' | IDX | |
| progress | TINYINT UNSIGNED | N | 0 | | |
| error_message | VARCHAR(1000) | Y | NULL | | |
| created_at | DATETIME(3) | N | CURRENT | | |
| completed_at | DATETIME(3) | Y | NULL | | |

#### `separation_stems` — 분리 결과
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| stem_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| separation_id | BIGINT UNSIGNED | N | | FK → separation_jobs, UQ(separation_id, stem_type) | |
| stem_type | ENUM('VOCALS','DRUMS','BASS','GUITAR','PIANO','OTHER','ACCOMPANIMENT') | N | | | |
| sample_id | BIGINT UNSIGNED | N | | FK → samples, UQ | 결과 파일은 `samples`에 `source='SEPARATION'`으로 등록됨 |
| created_at | DATETIME(3) | N | CURRENT | | |

---

### 3.5 Phase 5 — AI 레퍼런스 분석

#### `reference_tracks` — 레퍼런스 트랙
> `references`는 MySQL 예약어라 `reference_tracks`로 이름 지음
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| reference_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| user_id | BIGINT UNSIGNED | N | | FK → users, IDX | 등록자 |
| project_id | BIGINT UNSIGNED | Y | NULL | FK → projects, IDX | 연결된 프로젝트 (없을 수 있음) |
| source_type | ENUM('LINK','FILE') | N | | | |
| source_url | VARCHAR(1000) | Y | NULL | | LINK일 때 (YouTube 등) |
| file_path | VARCHAR(500) | Y | NULL | | FILE일 때 업로드 경로 |
| title | VARCHAR(200) | Y | NULL | | 곡 제목 (링크 메타데이터 또는 직접 입력) |
| genre_text | VARCHAR(100) | Y | NULL | | 사용자가 직접 입력한 주 장르 |
| created_at | DATETIME(3) | N | CURRENT | | |

#### `reference_tags` — 레퍼런스-태그(장르) 연결
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| reference_id | BIGINT UNSIGNED | N | | PK, FK → reference_tracks | |
| tag_id | INT UNSIGNED | N | | PK, FK → tags | 태그 클릭으로 선택한 장르 |

#### `ai_analyses` — AI 분석 결과
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| analysis_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| reference_id | BIGINT UNSIGNED | N | | FK → reference_tracks, IDX | |
| status | ENUM('PENDING','PROCESSING','DONE','FAILED') | N | 'PENDING' | | |
| model_version | VARCHAR(50) | Y | NULL | | 분석에 사용한 모델/버전 |
| bpm | DECIMAL(6,2) | Y | NULL | | |
| music_key | VARCHAR(10) | Y | NULL | | |
| loudness_lufs | DECIMAL(5,2) | Y | NULL | | 통합 라우드니스 |
| true_peak_db | DECIMAL(5,2) | Y | NULL | | |
| dynamic_range_db | DECIMAL(5,2) | Y | NULL | | |
| spectral_profile | JSON | Y | NULL | | 대역별 에너지 분포 |
| features | JSON | Y | NULL | | 기타 특징(악기 구성, 스테레오 폭 등) |
| summary | TEXT | Y | NULL | | 사람이 읽을 분석 요약 |
| error_message | VARCHAR(1000) | Y | NULL | | |
| created_at | DATETIME(3) | N | CURRENT | | |
| completed_at | DATETIME(3) | Y | NULL | | |

#### `ai_recommendations` — AI 추천 설정
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| recommendation_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| analysis_id | BIGINT UNSIGNED | N | | FK → ai_analyses, IDX | |
| project_id | BIGINT UNSIGNED | Y | NULL | FK → projects | 적용 대상 프로젝트 |
| rec_type | ENUM('SYNTH_PRESET','PLUGIN_PRESET','MIXING','MASTERING') | N | | | 추천 종류 |
| target_plugin_id | INT UNSIGNED | Y | NULL | FK → plugins | 프리셋 추천일 때 대상 플러그인 |
| settings | JSON | N | | | 추천 설정값 |
| rationale | TEXT | Y | NULL | | 추천 이유 설명 |
| is_applied | TINYINT(1) | N | 0 | | 프로젝트에 적용했는지 |
| applied_at | DATETIME(3) | Y | NULL | | |
| created_at | DATETIME(3) | N | CURRENT | | |

#### `assistant_messages` — Nyxi 도우미(AI) 대화
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| message_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| user_id | BIGINT UNSIGNED | N | | FK → users, IDX(user_id, project_id, message_id) | 대화 주인 (Nyxi 대화는 개인별, 협업 멤버와 공유하지 않음) |
| project_id | BIGINT UNSIGNED | Y | NULL | FK → projects | 대화가 일어난 프로젝트 |
| role | ENUM('USER','ASSISTANT') | N | | | 질문 / 답변 |
| content | TEXT | N | | | 메시지 내용 |
| context | JSON | Y | NULL | | 질문 시점의 프로젝트 요약 (BPM, 트랙·디바이스 구성 등) |
| model_version | VARCHAR(50) | Y | NULL | | 답변 생성 모델 |
| created_at | DATETIME(3) | N | CURRENT | | |

---

### 3.6 Phase 6 — 협업 · 단체톡

#### `project_members` — 프로젝트 참여자
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| project_id | BIGINT UNSIGNED | N | | PK, FK → projects | |
| user_id | BIGINT UNSIGNED | N | | PK, FK → users, IDX | |
| role | ENUM('OWNER','EDITOR','VIEWER') | N | 'EDITOR' | | 권한 |
| last_read_message_id | BIGINT UNSIGNED | Y | NULL | | 채팅 안 읽은 수 계산용 |
| joined_at | DATETIME(3) | N | CURRENT | | |

> 프로젝트 생성 시 소유자도 `role='OWNER'`로 함께 INSERT 합니다. (Phase 1부터 넣어 두면 Phase 6에서 마이그레이션이 필요 없음)

#### `invitations` — 초대
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| invitation_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, IDX | |
| inviter_id | BIGINT UNSIGNED | N | | FK → users | 초대한 사람 |
| invitee_email | VARCHAR(255) | N | | IDX | 초대받는 이메일 |
| invitee_id | BIGINT UNSIGNED | Y | NULL | FK → users | 이미 회원이면 채움 |
| role | ENUM('EDITOR','VIEWER') | N | 'EDITOR' | | 부여할 권한 |
| token | CHAR(64) | N | | UQ | 초대 링크 토큰 |
| status | ENUM('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELED') | N | 'PENDING' | | |
| expires_at | DATETIME(3) | N | | | 만료 시각 (기본 7일) |
| created_at | DATETIME(3) | N | CURRENT | | |
| responded_at | DATETIME(3) | Y | NULL | | |

#### `project_change_logs` — 편집 변경 이력
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| change_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, UQ(project_id, revision) | |
| user_id | BIGINT UNSIGNED | N | | FK → users | 변경한 사람 |
| revision | INT UNSIGNED | N | | | 이 변경이 적용된 후의 `projects.revision` |
| op_type | VARCHAR(50) | N | | | 예: `clip.move`, `note.add`, `track.update` |
| target_type | VARCHAR(30) | N | | | `track`, `clip`, `note` 등 |
| target_id | BIGINT UNSIGNED | Y | NULL | | 대상 행 ID |
| payload | JSON | N | | | 변경 내용 (이전값/새값) |
| created_at | DATETIME(3) | N | CURRENT | | |

#### `chat_messages` — 단체 채팅
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| message_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, IDX(project_id, message_id) | 프로젝트 = 채팅방 |
| user_id | BIGINT UNSIGNED | Y | NULL | FK → users | SYSTEM 메시지면 NULL |
| message_type | ENUM('TEXT','SYSTEM') | N | 'TEXT' | | SYSTEM: "OO님이 입장했습니다" 등 |
| content | TEXT | N | | | |
| created_at | DATETIME(3) | N | CURRENT | | |
| deleted_at | DATETIME(3) | Y | NULL | | |

#### `timeline_comments` — 타임라인 코멘트
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| comment_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, IDX(project_id, resolved_at) | |
| user_id | BIGINT UNSIGNED | N | | FK → users | 작성자 |
| parent_comment_id | BIGINT UNSIGNED | Y | NULL | FK → timeline_comments | 답글이면 원 코멘트 ID |
| tick | INT UNSIGNED | Y | NULL | | 위치 (답글은 NULL) |
| track_id | BIGINT UNSIGNED | Y | NULL | FK → tracks | 특정 트랙에 붙인 경우 |
| clip_id | BIGINT UNSIGNED | Y | NULL | FK → clips | 특정 클립에 붙인 경우 (클립 이동 시 따라감) |
| content | TEXT | N | | | `@닉네임` 멘션 포함 가능 |
| resolved_at | DATETIME(3) | Y | NULL | | 해결 처리 시각 |
| resolved_by | BIGINT UNSIGNED | Y | NULL | FK → users | 해결 처리한 사람 |
| created_at | DATETIME(3) | N | CURRENT | | |
| updated_at | DATETIME(3) | N | CURRENT (ON UPDATE) | | |
| deleted_at | DATETIME(3) | Y | NULL | | 소프트 삭제 |

#### `project_snapshots` — 버전 스냅샷
| 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|
| snapshot_id | BIGINT UNSIGNED | N | AUTO_INCREMENT | PK | |
| project_id | BIGINT UNSIGNED | N | | FK → projects, IDX(project_id, created_at) | |
| created_by | BIGINT UNSIGNED | Y | NULL | FK → users | NULL = 자동 스냅샷 |
| snapshot_type | ENUM('MANUAL','AUTO_DAILY','BEFORE_RESTORE','BEFORE_TEMPLATE','BEFORE_AI_APPLY') | N | | | 생성 이유 |
| name | VARCHAR(100) | Y | NULL | | 수동 스냅샷 이름 (예: `믹스 v1`) |
| revision | INT UNSIGNED | N | | | 스냅샷 시점의 `projects.revision` |
| data_path | VARCHAR(500) | N | | | 전체 상태 압축 JSON 파일 경로 (샘플 오디오는 복사하지 않고 참조) |
| preview_path | VARCHAR(500) | Y | NULL | | 미리듣기 오디오 (요청 시 생성) |
| size_bytes | BIGINT UNSIGNED | N | 0 | | 파일 크기 합 (저장 용량에 포함) |
| is_pinned | TINYINT(1) | N | 0 | | 고정 — 자동 정리 제외 |
| created_at | DATETIME(3) | N | CURRENT | | |

> 스냅샷 데이터를 DB의 JSON 컬럼이 아닌 **파일**로 두는 이유: 프로젝트 전체 상태(노트 수천 개)는 수 MB가 될 수 있어 DB 백업·조회를 무겁게 만들기 때문입니다.

---

## 4. 삭제(ON DELETE) 정책
| 관계 | 정책 | 이유 |
|---|---|---|
| users → password_reset_tokens | CASCADE | 회원이 사라지면 재설정 토큰도 의미가 없음 |
| projects → tracks → clips | CASCADE | 프로젝트 구성요소는 프로젝트와 생명주기가 같음 |
| projects → patterns → midi_notes | CASCADE | |
| patterns → clips | RESTRICT | 클립이 쓰는 패턴은 지울 수 없음 (마지막 클립이 지워지면 애플리케이션이 패턴 정리) |
| tracks → automation_lanes → automation_points | CASCADE | |
| projects → tempo_changes, meter_changes, markers | CASCADE | 템포·박자 지도·마커는 프로젝트의 일부 |
| tracks → track_instruments, track_sends, track_connections | CASCADE | 트랙(보내는 쪽·받는 쪽 모두)이 지워지면 함께 삭제 → 연결은 None 으로 |
| track_plugins → track_connections | CASCADE | 받는 플러그인이 지워지면 연결 삭제 |
| tracks(그룹) → tracks.parent_track_id | SET NULL | 그룹을 지워도 안의 트랙은 남음 |
| samples → tracks.frozen_sample_id | SET NULL | 프리즈 오디오가 지워지면 프리즈 해제 |
| patterns → midi_cc_events | CASCADE | |
| track_plugins → automation_lanes | CASCADE | 디바이스를 지우면 그 파라미터 오토메이션도 삭제 |
| projects → timeline_comments, project_snapshots | CASCADE | |
| tracks / clips → timeline_comments | SET NULL | 트랙·클립이 지워져도 코멘트는 tick 위치로 남음 |
| timeline_comments → 답글 | CASCADE | 원 코멘트 삭제 시 답글도 삭제 (실제로는 소프트 삭제 사용) |
| project_templates → projects.template_id | SET NULL | 템플릿을 지워도 프로젝트는 유지 |
| tracks → track_plugins, track_plugin_links | CASCADE | |
| track_plugins → track_plugin_links | CASCADE | 디바이스를 지우면 연결된 선도 삭제 |
| users → user_settings | CASCADE | 1:1 부속 데이터 |
| clips.sample_id → samples | RESTRICT | 사용 중인 샘플은 바로 지울 수 없음 (samples는 소프트 삭제) |
| sample_tags, reference_tags | CASCADE | 연결 테이블 |
| separation_jobs → separation_stems | CASCADE | |
| ai_analyses → ai_recommendations | CASCADE | |
| projects → project_members / invitations / change_logs / chat_messages | CASCADE | |
| projects → project_sessions | CASCADE | 작업 시간 기록은 프로젝트와 함께 삭제 (프로젝트는 소프트 삭제라 실제로는 남음) |
| users → (각종 FK) | RESTRICT | 회원은 소프트 삭제만 하므로 실제 DELETE가 일어나지 않음 |
| *.project_id (NULL 허용: reference_tracks, ai_recommendations, assistant_messages) | SET NULL | 프로젝트가 지워져도 분석 기록은 남김 |

---

## 5. DDL 초안

> 아래 SQL은 **문서용 초안**입니다. 실제 실행 전 검토가 필요하며, 이 문서 작성 시점에는 DB에 실행하지 않았습니다.
> FK 의존 순서대로 정렬되어 있어 위에서부터 차례로 실행하면 됩니다.

```sql
USE studionx;

-- ========== Phase 1 ==========
CREATE TABLE users (
  user_id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email              VARCHAR(255)    NOT NULL,
  password_hash      VARCHAR(255)    NOT NULL,
  nickname           VARCHAR(50)     NOT NULL,
  profile_image_path VARCHAR(500)    NULL,
  role               ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
  status             ENUM('ACTIVE','SUSPENDED','DELETED') NOT NULL DEFAULT 'ACTIVE',
  last_login_at      DATETIME(3)     NULL,
  privacy_agreed_at  DATETIME(3)     NOT NULL,
  privacy_version    VARCHAR(20)     NOT NULL,
  storage_quota_bytes BIGINT UNSIGNED NOT NULL DEFAULT 5368709120,
  storage_used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at         DATETIME(3)     NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_nickname (nickname)
) ENGINE=InnoDB;

CREATE TABLE inquiries (
  inquiry_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NULL,
  name        VARCHAR(50)     NULL,
  email       VARCHAR(255)    NOT NULL,
  title       VARCHAR(200)    NOT NULL,
  content     TEXT            NOT NULL,
  privacy_agreed_at DATETIME(3) NOT NULL,
  status      ENUM('RECEIVED','ANSWERED','CLOSED') NOT NULL DEFAULT 'RECEIVED',
  answer      TEXT            NULL,
  answered_at DATETIME(3)     NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (inquiry_id),
  KEY idx_inquiries_status (status),
  CONSTRAINT fk_inquiries_user FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE dev_notes (
  note_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id    BIGINT UNSIGNED NOT NULL,
  title        VARCHAR(150)    NOT NULL,
  summary      VARCHAR(300)    NOT NULL,
  content      MEDIUMTEXT      NOT NULL,
  is_published TINYINT(1)      NOT NULL DEFAULT 0,
  published_at DATETIME(3)     NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at   DATETIME(3)     NULL,
  PRIMARY KEY (note_id),
  KEY idx_dev_notes_published (is_published, published_at),
  CONSTRAINT fk_dev_notes_author FOREIGN KEY (author_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE projects (
  project_id      BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  owner_id        BIGINT UNSIGNED  NOT NULL,
  title           VARCHAR(100)     NOT NULL,
  description     VARCHAR(500)     NULL,
  bpm             DECIMAL(6,2)     NOT NULL DEFAULT 120.00,
  time_sig_num    TINYINT UNSIGNED NOT NULL DEFAULT 4,
  time_sig_den    TINYINT UNSIGNED NOT NULL DEFAULT 4,
  music_key       VARCHAR(10)      NULL,
  scale_mode      VARCHAR(20)      NULL,
  sample_rate     INT UNSIGNED     NOT NULL DEFAULT 48000,
  master_settings JSON             NULL,
  revision        INT UNSIGNED     NOT NULL DEFAULT 0,
  thumbnail_path  VARCHAR(500)     NULL,
  template_id     BIGINT UNSIGNED  NULL,  -- FK는 project_templates 생성 후 ALTER로 추가
  created_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3)      NULL,
  PRIMARY KEY (project_id),
  KEY idx_projects_owner (owner_id),
  KEY idx_projects_updated (updated_at),
  CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

-- project_members는 Phase 6 기능이지만, 프로젝트 생성 시 OWNER 행을 넣기 위해 Phase 1에서 함께 생성
CREATE TABLE project_members (
  project_id           BIGINT UNSIGNED NOT NULL,
  user_id              BIGINT UNSIGNED NOT NULL,
  role                 ENUM('OWNER','EDITOR','VIEWER') NOT NULL DEFAULT 'EDITOR',
  last_read_message_id BIGINT UNSIGNED NULL,
  joined_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (project_id, user_id),
  KEY idx_project_members_user (user_id),
  CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)
) ENGINE=InnoDB;

-- 작업 세션: 시퀀서(Phase 2)가 기록, 마이페이지(Phase 1)가 최근 7일 작업 시간으로 표시
CREATE TABLE project_sessions (
  session_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id     BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  started_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  active_seconds INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id),
  KEY idx_project_sessions_user (user_id, started_at),
  KEY idx_project_sessions_project (project_id, started_at),
  CONSTRAINT fk_ps_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)
) ENGINE=InnoDB;

-- ========== Phase 2 ==========
CREATE TABLE samples (
  sample_id         BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  owner_id          BIGINT UNSIGNED  NOT NULL,
  name              VARCHAR(200)     NOT NULL,
  original_filename VARCHAR(255)     NOT NULL,
  file_path         VARCHAR(500)     NOT NULL,
  mime_type         VARCHAR(100)     NOT NULL,
  file_size         BIGINT UNSIGNED  NOT NULL,
  duration_ms       INT UNSIGNED     NULL,
  sample_rate       INT UNSIGNED     NULL,
  channels          TINYINT UNSIGNED NULL,
  bpm               DECIMAL(6,2)     NULL,
  music_key         VARCHAR(10)      NULL,
  waveform_path     VARCHAR(500)     NULL,
  source            ENUM('UPLOAD','SEPARATION','EXPORT','RECORDING','BOUNCE','RESAMPLE') NOT NULL DEFAULT 'UPLOAD',
  created_at        DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at        DATETIME(3)      NULL,
  PRIMARY KEY (sample_id),
  KEY idx_samples_owner (owner_id),
  CONSTRAINT fk_samples_owner FOREIGN KEY (owner_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE tags (
  tag_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(50)  NOT NULL,
  category   ENUM('GENRE','INSTRUMENT','MOOD','ETC') NOT NULL DEFAULT 'ETC',
  is_system  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tag_id),
  UNIQUE KEY uq_tags_category_name (category, name)
) ENGINE=InnoDB;

CREATE TABLE sample_tags (
  sample_id BIGINT UNSIGNED NOT NULL,
  tag_id    INT UNSIGNED    NOT NULL,
  PRIMARY KEY (sample_id, tag_id),
  KEY idx_sample_tags_tag (tag_id),
  CONSTRAINT fk_st_sample FOREIGN KEY (sample_id) REFERENCES samples (sample_id) ON DELETE CASCADE,
  CONSTRAINT fk_st_tag    FOREIGN KEY (tag_id)    REFERENCES tags (tag_id)       ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE plugins (
  plugin_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code         VARCHAR(50)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  plugin_type  ENUM('INSTRUMENT','EFFECT','MIDI_EFFECT') NOT NULL,
  engine       ENUM('WEBAUDIO','WASM') NOT NULL DEFAULT 'WEBAUDIO',
  version      VARCHAR(20)  NOT NULL DEFAULT '1.0.0',
  param_schema JSON         NOT NULL,
  card_asset   VARCHAR(100) NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (plugin_id),
  UNIQUE KEY uq_plugins_code (code)
) ENGINE=InnoDB;

CREATE TABLE plugin_presets (
  preset_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plugin_id  INT UNSIGNED    NOT NULL,
  owner_id   BIGINT UNSIGNED NULL,
  name       VARCHAR(100)    NOT NULL,
  params     JSON            NOT NULL,
  source     ENUM('SYSTEM','USER','AI') NOT NULL DEFAULT 'USER',
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (preset_id),
  KEY idx_presets_plugin (plugin_id),
  CONSTRAINT fk_presets_plugin FOREIGN KEY (plugin_id) REFERENCES plugins (plugin_id),
  CONSTRAINT fk_presets_owner  FOREIGN KEY (owner_id)  REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE tracks (
  track_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id           BIGINT UNSIGNED NOT NULL,
  name                 VARCHAR(100)    NOT NULL,
  track_type           ENUM('AUDIO','MIDI','MASTER','GROUP','RETURN') NOT NULL,
  order_index          INT UNSIGNED    NOT NULL DEFAULT 0,
  color                CHAR(7)         NOT NULL DEFAULT '#7C5CFF',
  volume_db            DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
  pan                  DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
  is_muted             TINYINT(1)      NOT NULL DEFAULT 0,
  is_solo              TINYINT(1)      NOT NULL DEFAULT 0,
  is_enabled           TINYINT(1)      NOT NULL DEFAULT 1,
  parent_track_id      BIGINT UNSIGNED NULL,
  frozen_sample_id     BIGINT UNSIGNED NULL,
  routing_mode         ENUM('CHAIN','PATCHER') NOT NULL DEFAULT 'CHAIN',
  assignee_id          BIGINT UNSIGNED NULL,
  locked_by            BIGINT UNSIGNED NULL,
  locked_at            DATETIME(3)     NULL,
  created_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (track_id),
  KEY idx_tracks_project_order (project_id, order_index),
  CONSTRAINT fk_tracks_project    FOREIGN KEY (project_id)           REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_tracks_parent     FOREIGN KEY (parent_track_id)      REFERENCES tracks (track_id) ON DELETE SET NULL,
  CONSTRAINT fk_tracks_frozen     FOREIGN KEY (frozen_sample_id)     REFERENCES samples (sample_id) ON DELETE SET NULL,
  CONSTRAINT fk_tracks_assignee   FOREIGN KEY (assignee_id)          REFERENCES users (user_id),
  CONSTRAINT fk_tracks_locked_by  FOREIGN KEY (locked_by)            REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE track_plugins (
  track_plugin_id BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  track_id        BIGINT UNSIGNED  NOT NULL,
  plugin_id       INT UNSIGNED     NOT NULL,
  slot_index      TINYINT UNSIGNED NOT NULL,
  node_x          INT              NULL,
  node_y          INT              NULL,
  params          JSON             NOT NULL,
  is_bypassed     TINYINT(1)       NOT NULL DEFAULT 0,
  created_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (track_plugin_id),
  UNIQUE KEY uq_track_plugins_slot (track_id, slot_index),
  CONSTRAINT fk_tp_track  FOREIGN KEY (track_id)  REFERENCES tracks (track_id) ON DELETE CASCADE,
  CONSTRAINT fk_tp_plugin FOREIGN KEY (plugin_id) REFERENCES plugins (plugin_id)
) ENGINE=InnoDB;

CREATE TABLE track_plugin_links (
  link_id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  track_id             BIGINT UNSIGNED  NOT NULL,
  from_track_plugin_id BIGINT UNSIGNED  NULL,
  from_port            TINYINT UNSIGNED NOT NULL DEFAULT 0,
  to_track_plugin_id   BIGINT UNSIGNED  NULL,
  to_port              TINYINT UNSIGNED NOT NULL DEFAULT 0,
  gain_db              DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
  created_at           DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (link_id),
  KEY idx_links_track (track_id),
  CONSTRAINT fk_links_track FOREIGN KEY (track_id)             REFERENCES tracks (track_id)               ON DELETE CASCADE,
  CONSTRAINT fk_links_from  FOREIGN KEY (from_track_plugin_id) REFERENCES track_plugins (track_plugin_id) ON DELETE CASCADE,
  CONSTRAINT fk_links_to    FOREIGN KEY (to_track_plugin_id)   REFERENCES track_plugins (track_plugin_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE track_instruments (
  track_instrument_id BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  track_id            BIGINT UNSIGNED  NOT NULL,
  plugin_id           INT UNSIGNED     NOT NULL,
  slot_index          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  params              JSON             NULL,
  volume_db           DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
  pan                 DECIMAL(3,2)     NOT NULL DEFAULT 0.00,
  is_solo             TINYINT(1)       NOT NULL DEFAULT 0,
  is_enabled          TINYINT(1)       NOT NULL DEFAULT 1,
  created_at          DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (track_instrument_id),
  UNIQUE KEY uq_track_instruments_slot (track_id, slot_index),
  CONSTRAINT fk_ti_track  FOREIGN KEY (track_id)  REFERENCES tracks (track_id) ON DELETE CASCADE,
  CONSTRAINT fk_ti_plugin FOREIGN KEY (plugin_id) REFERENCES plugins (plugin_id)
) ENGINE=InnoDB;

CREATE TABLE track_sends (
  send_id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  track_id        BIGINT UNSIGNED NOT NULL,
  return_track_id BIGINT UNSIGNED NOT NULL,
  level_db        DECIMAL(5,2)    NOT NULL DEFAULT -12.00,
  is_pre_fader    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (send_id),
  UNIQUE KEY uq_track_sends (track_id, return_track_id),
  CONSTRAINT fk_sends_track  FOREIGN KEY (track_id)        REFERENCES tracks (track_id) ON DELETE CASCADE,
  CONSTRAINT fk_sends_return FOREIGN KEY (return_track_id) REFERENCES tracks (track_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE track_connections (
  connection_id      BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  from_track_id      BIGINT UNSIGNED  NOT NULL,
  to_track_id        BIGINT UNSIGNED  NOT NULL,
  target             ENUM('PLUGIN','INSTRUMENTS') NOT NULL DEFAULT 'PLUGIN',
  to_track_plugin_id BIGINT UNSIGNED  NULL,
  to_port            TINYINT UNSIGNED NOT NULL DEFAULT 1,
  also_play          TINYINT(1)       NULL,
  volume_db          DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
  pan                DECIMAL(3,2)     NOT NULL DEFAULT 0.00,
  is_solo            TINYINT(1)       NOT NULL DEFAULT 0,
  created_at         DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (connection_id),
  UNIQUE KEY uq_connections_from (from_track_id),
  KEY idx_connections_to (to_track_id),
  CONSTRAINT fk_conn_from   FOREIGN KEY (from_track_id)      REFERENCES tracks (track_id) ON DELETE CASCADE,
  CONSTRAINT fk_conn_to     FOREIGN KEY (to_track_id)        REFERENCES tracks (track_id) ON DELETE CASCADE,
  CONSTRAINT fk_conn_plugin FOREIGN KEY (to_track_plugin_id) REFERENCES track_plugins (track_plugin_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE patterns (
  pattern_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id  BIGINT UNSIGNED NOT NULL,
  name        VARCHAR(100)    NOT NULL,
  color       CHAR(7)         NULL,
  length_tick INT UNSIGNED    NOT NULL DEFAULT 3840,
  swing       DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (pattern_id),
  KEY idx_patterns_project (project_id),
  CONSTRAINT fk_patterns_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT chk_patterns_swing  CHECK (swing BETWEEN 0.00 AND 1.00)
) ENGINE=InnoDB;

CREATE TABLE clips (
  clip_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  track_id    BIGINT UNSIGNED NOT NULL,
  clip_type   ENUM('AUDIO','MIDI') NOT NULL,
  sample_id   BIGINT UNSIGNED NULL,
  pattern_id  BIGINT UNSIGNED NULL,
  name        VARCHAR(100)    NULL,
  start_tick  INT UNSIGNED    NOT NULL,
  length_tick INT UNSIGNED    NOT NULL,
  offset_tick INT UNSIGNED    NOT NULL DEFAULT 0,
  gain_db     DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
  is_looped   TINYINT(1)      NOT NULL DEFAULT 0,
  fade_in_tick    INT UNSIGNED  NOT NULL DEFAULT 0,
  fade_out_tick   INT UNSIGNED  NOT NULL DEFAULT 0,
  fade_in_curve   DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
  fade_out_curve  DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
  warp_mode       ENUM('OFF','BEATS','TONES','TEXTURE','REPITCH','COMPLEX') NOT NULL DEFAULT 'BEATS',
  warp_markers    JSON          NULL,
  pitch_semitones DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  is_reversed     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (clip_id),
  KEY idx_clips_track_start (track_id, start_tick),
  CONSTRAINT fk_clips_track  FOREIGN KEY (track_id)  REFERENCES tracks (track_id) ON DELETE CASCADE,
  KEY idx_clips_pattern (pattern_id),
  CONSTRAINT fk_clips_sample  FOREIGN KEY (sample_id)  REFERENCES samples (sample_id),
  CONSTRAINT fk_clips_pattern FOREIGN KEY (pattern_id) REFERENCES patterns (pattern_id),
  CONSTRAINT chk_clips_kind CHECK (
    (clip_type = 'MIDI'  AND pattern_id IS NOT NULL AND sample_id IS NULL) OR
    (clip_type = 'AUDIO' AND sample_id  IS NOT NULL AND pattern_id IS NULL)
  ),
  CONSTRAINT chk_clips_fade_curve CHECK (fade_in_curve BETWEEN -1.00 AND 1.00 AND fade_out_curve BETWEEN -1.00 AND 1.00),
  CONSTRAINT chk_clips_pitch      CHECK (pitch_semitones BETWEEN -48.00 AND 48.00)
) ENGINE=InnoDB;

CREATE TABLE midi_notes (
  note_id     BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pattern_id  BIGINT UNSIGNED  NOT NULL,
  pitch       TINYINT UNSIGNED NOT NULL,
  velocity    TINYINT UNSIGNED NOT NULL DEFAULT 100,
  start_tick  INT UNSIGNED     NOT NULL,
  length_tick INT UNSIGNED     NOT NULL,
  channel     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  release_velocity   TINYINT UNSIGNED NOT NULL DEFAULT 64,
  is_muted           TINYINT(1)       NOT NULL DEFAULT 0,
  probability        DECIMAL(3,2)     NOT NULL DEFAULT 1.00,
  velocity_deviation TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (note_id),
  KEY idx_notes_pattern_start (pattern_id, start_tick),
  CONSTRAINT fk_notes_pattern FOREIGN KEY (pattern_id) REFERENCES patterns (pattern_id) ON DELETE CASCADE,
  CONSTRAINT chk_notes_pitch    CHECK (pitch <= 127),
  CONSTRAINT chk_notes_velocity CHECK (velocity BETWEEN 1 AND 127),
  CONSTRAINT chk_notes_release  CHECK (release_velocity <= 127),
  CONSTRAINT chk_notes_prob     CHECK (probability BETWEEN 0.00 AND 1.00),
  CONSTRAINT chk_notes_vel_dev  CHECK (velocity_deviation <= 127)
) ENGINE=InnoDB;

CREATE TABLE midi_cc_events (
  event_id   BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  pattern_id BIGINT UNSIGNED   NOT NULL,
  tick       INT UNSIGNED      NOT NULL,
  controller SMALLINT UNSIGNED NOT NULL,
  value      SMALLINT UNSIGNED NOT NULL,
  channel    TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id),
  KEY idx_cc_pattern_tick (pattern_id, controller, tick),
  CONSTRAINT fk_cc_pattern FOREIGN KEY (pattern_id) REFERENCES patterns (pattern_id) ON DELETE CASCADE,
  CONSTRAINT chk_cc_controller CHECK (controller <= 129),
  CONSTRAINT chk_cc_value      CHECK (value <= 16383)
) ENGINE=InnoDB;

CREATE TABLE automation_lanes (
  lane_id         BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  track_id        BIGINT UNSIGNED   NOT NULL,
  target_type     ENUM('VOLUME','PAN','INSTRUMENT_PARAM','DEVICE_PARAM') NOT NULL,
  track_plugin_id BIGINT UNSIGNED   NULL,
  param_index     SMALLINT UNSIGNED NULL,
  is_enabled      TINYINT(1)        NOT NULL DEFAULT 1,
  created_at      DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (lane_id),
  KEY idx_lanes_track (track_id),
  CONSTRAINT fk_lanes_track  FOREIGN KEY (track_id)        REFERENCES tracks (track_id)               ON DELETE CASCADE,
  CONSTRAINT fk_lanes_device FOREIGN KEY (track_plugin_id) REFERENCES track_plugins (track_plugin_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE automation_points (
  point_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lane_id  BIGINT UNSIGNED NOT NULL,
  tick     INT UNSIGNED    NOT NULL,
  value    DECIMAL(12,4)   NOT NULL,
  curve    DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
  PRIMARY KEY (point_id),
  KEY idx_points_lane_tick (lane_id, tick),
  CONSTRAINT fk_points_lane FOREIGN KEY (lane_id) REFERENCES automation_lanes (lane_id) ON DELETE CASCADE,
  CONSTRAINT chk_points_curve CHECK (curve BETWEEN -1.00 AND 1.00)
) ENGINE=InnoDB;

CREATE TABLE tempo_changes (
  tempo_change_id BIGINT UNSIGNED       NOT NULL AUTO_INCREMENT,
  project_id      BIGINT UNSIGNED       NOT NULL,
  tick            INT UNSIGNED          NOT NULL,
  bpm             DECIMAL(6,2)          NOT NULL,
  ramp            ENUM('STEP','LINEAR') NOT NULL DEFAULT 'STEP',
  created_at      DATETIME(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tempo_change_id),
  UNIQUE KEY uq_tempo_project_tick (project_id, tick),
  CONSTRAINT fk_tempo_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT chk_tempo_bpm  CHECK (bpm BETWEEN 20.00 AND 300.00),
  CONSTRAINT chk_tempo_tick CHECK (tick > 0)
) ENGINE=InnoDB;

CREATE TABLE meter_changes (
  meter_change_id BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  project_id      BIGINT UNSIGNED  NOT NULL,
  tick            INT UNSIGNED     NOT NULL,
  time_sig_num    TINYINT UNSIGNED NOT NULL,
  time_sig_den    TINYINT UNSIGNED NOT NULL,
  created_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (meter_change_id),
  UNIQUE KEY uq_meter_project_tick (project_id, tick),
  CONSTRAINT fk_meter_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT chk_meter_num  CHECK (time_sig_num BETWEEN 1 AND 32),
  CONSTRAINT chk_meter_den  CHECK (time_sig_den IN (1, 2, 4, 8, 16, 32)),
  CONSTRAINT chk_meter_tick CHECK (tick > 0)
) ENGINE=InnoDB;

CREATE TABLE markers (
  marker_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  tick       INT UNSIGNED    NOT NULL,
  name       VARCHAR(50)     NOT NULL,
  color      CHAR(7)         NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (marker_id),
  KEY idx_markers_project_tick (project_id, tick),
  CONSTRAINT fk_markers_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE project_templates (
  template_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id     BIGINT UNSIGNED NULL,
  name         VARCHAR(100)    NOT NULL,
  description  VARCHAR(500)    NULL,
  genre_tag_id INT UNSIGNED    NULL,
  data         JSON            NOT NULL,
  preview_path VARCHAR(500)    NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (template_id),
  KEY idx_templates_owner (owner_id),
  CONSTRAINT fk_templates_owner FOREIGN KEY (owner_id)     REFERENCES users (user_id),
  CONSTRAINT fk_templates_genre FOREIGN KEY (genre_tag_id) REFERENCES tags (tag_id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_template FOREIGN KEY (template_id) REFERENCES project_templates (template_id) ON DELETE SET NULL;

CREATE TABLE user_settings (
  user_id            BIGINT UNSIGNED NOT NULL,
  theme              ENUM('DARK','LIGHT','SYSTEM') NOT NULL DEFAULT 'DARK',
  accent_color       CHAR(7)         NOT NULL DEFAULT '#7C5CFF',
  ui_scale           DECIMAL(3,2)    NOT NULL DEFAULT 1.00,
  keybindings        JSON            NULL,
  tutorial_state     JSON            NULL,
  character_enabled  TINYINT(1)      NOT NULL DEFAULT 1,
  character_code     VARCHAR(50)     NOT NULL DEFAULT 'nyxi',
  character_state    JSON            NULL,
  tips_level         ENUM('OFF','IMPORTANT','ALL') NOT NULL DEFAULT 'IMPORTANT',
  tips_state         JSON            NULL,
  bottom_panel_state JSON            NULL,
  ui_settings        JSON            NULL,
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ========== Phase 3 ==========
CREATE TABLE export_jobs (
  export_id        BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  project_id       BIGINT UNSIGNED   NOT NULL,
  user_id          BIGINT UNSIGNED   NOT NULL,
  format           ENUM('WAV','MP3','FLAC') NOT NULL,
  sample_rate      INT UNSIGNED      NOT NULL DEFAULT 44100,
  bit_depth        TINYINT UNSIGNED  NULL,
  bitrate_kbps     SMALLINT UNSIGNED NULL,
  range_start_tick INT UNSIGNED      NOT NULL DEFAULT 0,
  range_end_tick   INT UNSIGNED      NULL,
  render_mode      ENUM('CLIENT','SERVER') NOT NULL DEFAULT 'CLIENT',
  export_mode      ENUM('MIXDOWN','STEMS') NOT NULL DEFAULT 'MIXDOWN',
  status           ENUM('PENDING','PROCESSING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
  progress         TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  result_path      VARCHAR(500)      NULL,
  file_size        BIGINT UNSIGNED   NULL,
  error_message    VARCHAR(1000)     NULL,
  created_at       DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3)       NULL,
  PRIMARY KEY (export_id),
  KEY idx_export_project (project_id),
  KEY idx_export_status (status),
  CONSTRAINT fk_export_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_export_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)
) ENGINE=InnoDB;

-- ========== Phase 4 ==========
CREATE TABLE separation_jobs (
  separation_id    BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED  NOT NULL,
  source_sample_id BIGINT UNSIGNED  NOT NULL,
  model_name       VARCHAR(50)      NOT NULL,
  stem_mode        ENUM('2STEM','4STEM','6STEM') NOT NULL DEFAULT '4STEM',
  status           ENUM('PENDING','PROCESSING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
  progress         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  error_message    VARCHAR(1000)    NULL,
  created_at       DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3)      NULL,
  PRIMARY KEY (separation_id),
  KEY idx_sep_user (user_id),
  KEY idx_sep_status (status),
  CONSTRAINT fk_sep_user   FOREIGN KEY (user_id)          REFERENCES users (user_id),
  CONSTRAINT fk_sep_source FOREIGN KEY (source_sample_id) REFERENCES samples (sample_id)
) ENGINE=InnoDB;

CREATE TABLE separation_stems (
  stem_id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  separation_id BIGINT UNSIGNED NOT NULL,
  stem_type     ENUM('VOCALS','DRUMS','BASS','GUITAR','PIANO','OTHER','ACCOMPANIMENT') NOT NULL,
  sample_id     BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (stem_id),
  UNIQUE KEY uq_stems_job_type (separation_id, stem_type),
  UNIQUE KEY uq_stems_sample (sample_id),
  CONSTRAINT fk_stems_job    FOREIGN KEY (separation_id) REFERENCES separation_jobs (separation_id) ON DELETE CASCADE,
  CONSTRAINT fk_stems_sample FOREIGN KEY (sample_id)     REFERENCES samples (sample_id)
) ENGINE=InnoDB;

-- ========== Phase 5 ==========
CREATE TABLE reference_tracks (
  reference_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  project_id   BIGINT UNSIGNED NULL,
  source_type  ENUM('LINK','FILE') NOT NULL,
  source_url   VARCHAR(1000)   NULL,
  file_path    VARCHAR(500)    NULL,
  title        VARCHAR(200)    NULL,
  genre_text   VARCHAR(100)    NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (reference_id),
  KEY idx_ref_user (user_id),
  KEY idx_ref_project (project_id),
  CONSTRAINT fk_ref_user    FOREIGN KEY (user_id)    REFERENCES users (user_id),
  CONSTRAINT fk_ref_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE SET NULL,
  CONSTRAINT chk_ref_source CHECK (
    (source_type = 'LINK' AND source_url IS NOT NULL) OR
    (source_type = 'FILE' AND file_path  IS NOT NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE reference_tags (
  reference_id BIGINT UNSIGNED NOT NULL,
  tag_id       INT UNSIGNED    NOT NULL,
  PRIMARY KEY (reference_id, tag_id),
  KEY idx_ref_tags_tag (tag_id),
  CONSTRAINT fk_rt_ref FOREIGN KEY (reference_id) REFERENCES reference_tracks (reference_id) ON DELETE CASCADE,
  CONSTRAINT fk_rt_tag FOREIGN KEY (tag_id)       REFERENCES tags (tag_id)                   ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE ai_analyses (
  analysis_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_id     BIGINT UNSIGNED NOT NULL,
  status           ENUM('PENDING','PROCESSING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
  model_version    VARCHAR(50)     NULL,
  bpm              DECIMAL(6,2)    NULL,
  music_key        VARCHAR(10)     NULL,
  loudness_lufs    DECIMAL(5,2)    NULL,
  true_peak_db     DECIMAL(5,2)    NULL,
  dynamic_range_db DECIMAL(5,2)    NULL,
  spectral_profile JSON            NULL,
  features         JSON            NULL,
  summary          TEXT            NULL,
  error_message    VARCHAR(1000)   NULL,
  created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3)     NULL,
  PRIMARY KEY (analysis_id),
  KEY idx_analyses_ref (reference_id),
  CONSTRAINT fk_analyses_ref FOREIGN KEY (reference_id) REFERENCES reference_tracks (reference_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE ai_recommendations (
  recommendation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  analysis_id       BIGINT UNSIGNED NOT NULL,
  project_id        BIGINT UNSIGNED NULL,
  rec_type          ENUM('SYNTH_PRESET','PLUGIN_PRESET','MIXING','MASTERING') NOT NULL,
  target_plugin_id  INT UNSIGNED    NULL,
  settings          JSON            NOT NULL,
  rationale         TEXT            NULL,
  is_applied        TINYINT(1)      NOT NULL DEFAULT 0,
  applied_at        DATETIME(3)     NULL,
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (recommendation_id),
  KEY idx_rec_analysis (analysis_id),
  CONSTRAINT fk_rec_analysis FOREIGN KEY (analysis_id)      REFERENCES ai_analyses (analysis_id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_project  FOREIGN KEY (project_id)       REFERENCES projects (project_id)     ON DELETE SET NULL,
  CONSTRAINT fk_rec_plugin   FOREIGN KEY (target_plugin_id) REFERENCES plugins (plugin_id)
) ENGINE=InnoDB;

CREATE TABLE assistant_messages (
  message_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  project_id    BIGINT UNSIGNED NULL,
  role          ENUM('USER','ASSISTANT') NOT NULL,
  content       TEXT            NOT NULL,
  context       JSON            NULL,
  model_version VARCHAR(50)     NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (message_id),
  KEY idx_assist_user_project (user_id, project_id, message_id),
  CONSTRAINT fk_assist_user    FOREIGN KEY (user_id)    REFERENCES users (user_id),
  CONSTRAINT fk_assist_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ========== Phase 6 ==========
-- (project_members는 Phase 1 영역에서 이미 생성)
CREATE TABLE invitations (
  invitation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id    BIGINT UNSIGNED NOT NULL,
  inviter_id    BIGINT UNSIGNED NOT NULL,
  invitee_email VARCHAR(255)    NOT NULL,
  invitee_id    BIGINT UNSIGNED NULL,
  role          ENUM('EDITOR','VIEWER') NOT NULL DEFAULT 'EDITOR',
  token         CHAR(64)        NOT NULL,
  status        ENUM('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELED') NOT NULL DEFAULT 'PENDING',
  expires_at    DATETIME(3)     NOT NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  responded_at  DATETIME(3)     NULL,
  PRIMARY KEY (invitation_id),
  UNIQUE KEY uq_invitations_token (token),
  KEY idx_invitations_project (project_id),
  KEY idx_invitations_email (invitee_email),
  CONSTRAINT fk_inv_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_inviter FOREIGN KEY (inviter_id) REFERENCES users (user_id),
  CONSTRAINT fk_inv_invitee FOREIGN KEY (invitee_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE project_change_logs (
  change_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id  BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  revision    INT UNSIGNED    NOT NULL,
  op_type     VARCHAR(50)     NOT NULL,
  target_type VARCHAR(30)     NOT NULL,
  target_id   BIGINT UNSIGNED NULL,
  payload     JSON            NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (change_id),
  UNIQUE KEY uq_changes_project_rev (project_id, revision),
  CONSTRAINT fk_changes_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_changes_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE chat_messages (
  message_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id   BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NULL,
  message_type ENUM('TEXT','SYSTEM') NOT NULL DEFAULT 'TEXT',
  content      TEXT            NOT NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at   DATETIME(3)     NULL,
  PRIMARY KEY (message_id),
  KEY idx_chat_project_msg (project_id, message_id),
  CONSTRAINT fk_chat_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE timeline_comments (
  comment_id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id        BIGINT UNSIGNED NOT NULL,
  user_id           BIGINT UNSIGNED NOT NULL,
  parent_comment_id BIGINT UNSIGNED NULL,
  tick              INT UNSIGNED    NULL,
  track_id          BIGINT UNSIGNED NULL,
  clip_id           BIGINT UNSIGNED NULL,
  content           TEXT            NOT NULL,
  resolved_at       DATETIME(3)     NULL,
  resolved_by       BIGINT UNSIGNED NULL,
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at        DATETIME(3)     NULL,
  PRIMARY KEY (comment_id),
  KEY idx_comments_project (project_id, resolved_at),
  CONSTRAINT fk_comments_project  FOREIGN KEY (project_id)        REFERENCES projects (project_id)          ON DELETE CASCADE,
  CONSTRAINT fk_comments_user     FOREIGN KEY (user_id)           REFERENCES users (user_id),
  CONSTRAINT fk_comments_parent   FOREIGN KEY (parent_comment_id) REFERENCES timeline_comments (comment_id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_track    FOREIGN KEY (track_id)          REFERENCES tracks (track_id)              ON DELETE SET NULL,
  CONSTRAINT fk_comments_clip     FOREIGN KEY (clip_id)           REFERENCES clips (clip_id)                ON DELETE SET NULL,
  CONSTRAINT fk_comments_resolver FOREIGN KEY (resolved_by)       REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE project_snapshots (
  snapshot_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id    BIGINT UNSIGNED NOT NULL,
  created_by    BIGINT UNSIGNED NULL,
  snapshot_type ENUM('MANUAL','AUTO_DAILY','BEFORE_RESTORE','BEFORE_TEMPLATE','BEFORE_AI_APPLY') NOT NULL,
  name          VARCHAR(100)    NULL,
  revision      INT UNSIGNED    NOT NULL,
  data_path     VARCHAR(500)    NOT NULL,
  preview_path  VARCHAR(500)    NULL,
  size_bytes    BIGINT UNSIGNED NOT NULL DEFAULT 0,
  is_pinned     TINYINT(1)      NOT NULL DEFAULT 0,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (snapshot_id),
  KEY idx_snapshots_project (project_id, created_at),
  CONSTRAINT fk_snapshots_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_snapshots_user    FOREIGN KEY (created_by) REFERENCES users (user_id)
) ENGINE=InnoDB;
```

---

## 6. 변경 이력
| 날짜 | 내용 |
|---|---|
| 2026-10-01 | 최초 작성 (Phase 1~6 전체 테이블 초안) |
| 2026-10-01 | 트랙 아코디언(체인+패처): `tracks.routing_mode`, `track_plugins.node_x/node_y`, `track_plugin_links` 추가 · 캐릭터/하단 패널: `user_settings` 추가 · Gopher: `assistant_messages` 추가 · ERD를 직선 이미지(`ERD.png`)로 교체 (총 26개 테이블) |
| 2026-10-01 | AI 제안 채택 반영: `patterns`·`launcher_scenes`(패턴·클립 런처, **`midi_notes.clip_id` → `pattern_id`**), `automation_lanes`·`automation_points`, `project_templates`, `timeline_comments`, `project_snapshots` 추가 / `tracks`: MASTER 타입·담당자·잠금 / `projects`: `scale_mode`·`template_id` / `users`: 저장 용량 / `user_settings`: 테마·배율·단축키·튜토리얼 / Gopher → Nyxi(가칭) (총 33개 테이블) |
| 2026-10-02 | `dev_notes`(메인 페이지 Development 공지, 관리자만 작성) 추가 · `inquiries.name` NULL 허용, `inquiries.privacy_agreed_at` 추가 (총 34개 테이블). 기존 DB용 변경 SQL: `studionx/db/migrations/2026-10-02_contact_devnotes.sql` · §2.1에 남아 있던 옛 테이블 목록 삭제 |
| 2026-10-03 | `project_sessions`(프로젝트 작업 세션) 추가 — 마이페이지 Recent Projects의 최근 7일 작업 시간 (P1-17). 총 35개 테이블. 기존 DB용 변경 SQL: `studionx/db/migrations/2026-10-03_project_sessions.sql` |
| 2026-10-06 | **클립 런처 제거** (사용자 결정 — 런치패드 공연용 기능): `launcher_scenes` 표, `clips.scene_id`·`uq_clips_launcher_slot`·`fk_clips_scene` 삭제. 총 41개 테이블. 기존 DB용 변경 SQL: `studionx/db/migrations/2026-10-06_remove_clip_launcher.sql` |
| 2026-10-14 | 비밀번호 찾기(P1-28, FR-118~119): `password_reset_tokens` 추가, `users.password_changed_at` 추가 (테이블 42개) |
| 2026-10-06 | **시퀀서 기능 보강** ([Sequencer_Feature_Gaps.md](Sequencer_Feature_Gaps.md) A·B + PRD 02 §4.17): 새 표 `track_instruments`(레이어 악기 — `tracks.instrument_plugin_id`·`instrument_params` 삭제), `track_sends`(센드), `track_connections`(Connect to Another), `midi_cc_events`(CC·피치벤드·페달), `markers` / `tracks`: `GROUP`·`RETURN` 종류, `is_enabled`, `parent_track_id`, `frozen_sample_id` / `clips`: 페이드·Warp·음정·거꾸로 / `midi_notes`: `release_velocity`·`is_muted`·`probability`·`velocity_deviation` / `patterns.swing` / `plugins` `MIDI_EFFECT` / `samples` `BOUNCE`·`RESAMPLE` / `export_jobs.export_mode`. 총 42개 테이블. 기존 DB용 변경 SQL: `studionx/db/migrations/2026-10-06_sequencer_feature_gaps.sql` |
| 2026-10-05 | `tempo_changes`·`meter_changes` 추가 — 곡 중간 BPM 변속·박자 변경(템포·박자 지도). `projects.bpm`·`time_sig_*`는 시작 값. 총 37개 테이블. 기존 DB용 변경 SQL: `studionx/db/migrations/2026-10-05_tempo_meter_changes.sql` |
| 2026-10-19 | 시스템 플러그인 시드에 `delay`(Delay) 추가 — 두 DAW 기본 이펙트 비교 결과 ([Default_Instruments_Effects.md](Default_Instruments_Effects.md)). 표 구조 변경 없음, 시드 8종. 기존 DB용 변경 SQL: `studionx/db/migrations/2026-10-19_plugin_delay.sql` |
| 2026-10-05 | `users.privacy_agreed_at`, `users.privacy_version` 추가 — 가입 때 개인정보 처리방침 동의 기록 (GDPR·개인정보 보호법 동의 증빙, [Privacy_Policy_Draft.md](Privacy_Policy_Draft.md) D3). 테이블 수 그대로 35개. 기존 DB용 변경 SQL: `studionx/db/migrations/2026-10-05_users_privacy_consent.sql` |
| 2026-10-01 | 이름 **Nyxi** 확정 · `user_settings.tips_level`/`tips_state`(Nyxi 팁) · `plugins.card_asset` 및 `param_schema`의 `primary`/`group`(카드 UI·상세 모달) 추가 |
