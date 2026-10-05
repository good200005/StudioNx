# Studio Nx — ERD (관계 설명)

> 그림: [`ERD.png`](ERD.png) · 컬럼 상세: [`DB.md`](DB.md) §3 · DBMS: MySQL 8.0 (`studionx`) · 테이블 42개

![Studio Nx ERD](ERD.png)

---

## 1. 읽는 법
| 표기 | 의미 |
|---|---|
| `\|\|` (선 끝 두 줄) | 반드시 1개 |
| `\|o` (선 끝 줄 + 원) | 0 또는 1개 (FK가 NULL 허용) |
| 까마귀발 + 원 | 0개 이상 (N) |
| `PK` / `FK` / `UQ` | 기본키 / 외래키 / 유니크 |
| `(null)` | NULL 허용 FK |
| `→ users` | 요청자·작성자를 가리키는 FK. 선이 너무 많아져 **그림에서는 선을 생략**하고 박스 안에만 표기 |

## 2. 한 줄 요약
**회원(users)이 프로젝트(projects)를 갖고, 프로젝트는 트랙 → 클립으로 내려가며, MIDI 클립은 패턴(노트 묶음)을 가리킨다. 트랙에는 디바이스가 체인/패처로 연결되고 오토메이션 레인이 붙는다. 샘플·플러그인·태그·템플릿은 공용 자원이고, 출력·분리·AI·협업(코멘트·스냅샷)은 프로젝트나 샘플에 매달린 부가 기록이다.**

## 3. 영역별 구성
| 영역 | 테이블 | 핵심 역할 |
|---|---|---|
| 계정 · 사이트 운영 | `users`, `user_settings`, `inquiries`, `dev_notes` | 회원(+저장 용량), UI 설정(테마·단축키·캐릭터·튜토리얼), 문의, 메인 페이지 Development 공지 |
| 프로젝트 · 협업 | `projects`, `project_members`, `project_sessions`, `invitations`, `project_change_logs`, `chat_messages`, `timeline_comments`, `project_snapshots` | 프로젝트와 참여자·작업 세션·초대·편집이력·톡방·코멘트·스냅샷 |
| 시퀀서 | `tracks`, `track_instruments`, `track_plugins`, `track_plugin_links`, `track_sends`, `track_connections`, `patterns`, `launcher_scenes`, `clips`, `midi_notes`, `midi_cc_events`, `automation_lanes`, `automation_points`, `tempo_changes`, `meter_changes`, `markers` | 곡의 실제 내용 (트랙·악기·디바이스·라우팅·센드·연결·패턴·런처·클립·노트·CC·오토메이션·템포/박자 지도·마커) |
| 라이브러리 · 플러그인 · 템플릿 | `samples`, `tags`, `sample_tags`, `plugins`, `plugin_presets`, `project_templates` | 샘플 라이브러리, 태그, 웹 플러그인 목록·프리셋, 프로젝트 템플릿 |
| 출력 · 분리 | `export_jobs`, `separation_jobs`, `separation_stems` | 오디오 출력 작업, 악기 분리 작업과 결과 |
| AI | `reference_tracks`, `reference_tags`, `ai_analyses`, `ai_recommendations`, `assistant_messages` | 레퍼런스 분석·추천, Nyxi 도우미 대화 |

## 4. 관계 목록
> 형식: **부모 → 자식** (관계) · 연결 컬럼 · 설명

### 4.1 계정
| 부모 → 자식 | 관계 | 연결 컬럼 | 설명 |
|---|---|---|---|
| users → user_settings | 1 : 0..1 | `user_settings.user_id` (PK=FK) | 회원당 UI 설정 1행 |
| users → inquiries | 0..1 : N | `inquiries.user_id` (null) | 비회원 문의는 NULL |
| users → dev_notes | 1 : N | `dev_notes.author_id` | 공지 작성자 (관리자만) |
| users → projects | 1 : N | `projects.owner_id` | 프로젝트 소유자 |
| users → samples | 1 : N | `samples.owner_id` | 개인 샘플 라이브러리 |
| users → plugin_presets | 0..1 : N | `plugin_presets.owner_id` (null) | NULL = 시스템 프리셋 |

### 4.2 프로젝트 · 협업
| 부모 → 자식 | 관계 | 연결 컬럼 | 설명 |
|---|---|---|---|
| projects ↔ users | N : M | `project_members(project_id, user_id)` | 참여자와 권한(OWNER/EDITOR/VIEWER). 소유자도 OWNER로 들어감 |
| projects → project_sessions | 1 : N | `project_sessions.project_id` | 작업 세션 (작업한 사람 `user_id` → users). 마이페이지 최근 7일 작업 시간 |
| projects → invitations | 1 : N | `invitations.project_id` | 초대 (inviter·invitee → users) |
| projects → project_change_logs | 1 : N | `project_change_logs.project_id` | 실시간 편집 이력, `(project_id, revision)` 유일 |
| projects → chat_messages | 1 : N | `chat_messages.project_id` | 프로젝트 = 톡방 |
| projects → timeline_comments | 1 : N | `timeline_comments.project_id` | 위치(tick) 코멘트. `parent_comment_id`로 답글(자기 참조) |
| tracks / clips → timeline_comments | 0..1 : N | `track_id`, `clip_id` (null) | 트랙·클립에 붙인 코멘트 (지워지면 NULL) |
| projects → project_snapshots | 1 : N | `project_snapshots.project_id` | 버전 스냅샷 (데이터는 압축 JSON 파일) |
| users → tracks (담당·잠금) | 0..1 : N | `tracks.assignee_id`, `locked_by` (null) | 그림에서는 선 생략 (`→ users` 표기) |

### 4.3 시퀀서
| 부모 → 자식 | 관계 | 연결 컬럼 | 설명 |
|---|---|---|---|
| projects → tracks | 1 : N | `tracks.project_id` | 트랙 목록 |
| tracks → clips | 1 : N | `clips.track_id` | 트랙 위 클립 |
| projects → patterns | 1 : N | `patterns.project_id` | MIDI 패턴 (노트 묶음) |
| patterns → midi_notes | 1 : N | `midi_notes.pattern_id` | 노트는 **패턴**에 속함 |
| patterns → clips | 0..1 : N | `clips.pattern_id` (null) | MIDI 클립은 패턴 필수. 같은 패턴을 쓰는 클립 = 링크 클립 |
| projects → launcher_scenes | 1 : N | `launcher_scenes.project_id` | 클립 런처 씬(행) |
| launcher_scenes → clips | 0..1 : N | `clips.scene_id` (null) | NULL = 타임라인 클립, 값 = 런처 슬롯 `(track_id, scene_id)` 유일 |
| tracks → automation_lanes | 1 : N | `automation_lanes.track_id` | 트랙별 오토메이션 레인 (MASTER 포함) |
| track_plugins → automation_lanes | 0..1 : N | `automation_lanes.track_plugin_id` (null) | 디바이스 파라미터 오토메이션 |
| automation_lanes → automation_points | 1 : N | `automation_points.lane_id` | 포인트 (tick, 값, 곡선) |
| projects → tempo_changes | 1 : N | `tempo_changes.project_id` | 곡 중간 템포 변경점 (시작 템포는 `projects.bpm`) |
| projects → meter_changes | 1 : N | `meter_changes.project_id` | 곡 중간 박자 변경점 (시작 박자는 `projects.time_sig_*`) |
| samples → clips | 0..1 : N | `clips.sample_id` (null) | 오디오 클립만 샘플 참조 |
| tracks → track_plugins | 1 : N | `track_plugins.track_id` | 트랙의 이펙트 디바이스 (`slot_index` = 체인 순서) |
| plugins → track_plugins | 1 : N | `track_plugins.plugin_id` | 어떤 플러그인의 인스턴스인지 |
| tracks → track_instruments | 1 : N | `track_instruments.track_id` | MIDI 트랙의 악기들 (레이어링, `slot_index` 순서) |
| plugins → track_instruments | 1 : N | `track_instruments.plugin_id` | 어떤 악기 플러그인인지 |
| tracks → track_sends | 1 : N | `track_sends.track_id`, `return_track_id` | 센드 (리턴 트랙으로 보내는 양) |
| tracks → track_connections | 1 : 0..1 | `track_connections.from_track_id` (UQ), `to_track_id` | Connect to Another (없으면 None) |
| track_plugins → track_connections | 0..1 : N | `track_connections.to_track_plugin_id` (null) | 받는 플러그인 (레이어면 NULL) |
| tracks → tracks | 0..1 : N | `tracks.parent_track_id` (null) | 그룹 트랙 안의 트랙 |
| samples → tracks | 0..1 : N | `tracks.frozen_sample_id` (null) | 프리즈 결과 오디오 |
| patterns → midi_cc_events | 1 : N | `midi_cc_events.pattern_id` | CC·피치벤드·페달 |
| projects → markers | 1 : N | `markers.project_id` | 타임라인 마커 |
| tracks → track_plugin_links | 1 : N | `track_plugin_links.track_id` | 패처 연결선 |
| track_plugins → track_plugin_links | 0..1 : N | `from_track_plugin_id`, `to_track_plugin_id` (null) | NULL = 트랙 소스 / 트랙 출력 |

### 4.4 라이브러리 · 플러그인
| 부모 → 자식 | 관계 | 연결 컬럼 | 설명 |
|---|---|---|---|
| samples ↔ tags | N : M | `sample_tags(sample_id, tag_id)` | 샘플 태그 |
| plugins → plugin_presets | 1 : N | `plugin_presets.plugin_id` | 플러그인별 프리셋 |
| users → project_templates | 0..1 : N | `project_templates.owner_id` (null) | NULL = 시스템 템플릿 |
| tags → project_templates | 0..1 : N | `project_templates.genre_tag_id` (null) | 템플릿 장르 |
| project_templates → projects | 0..1 : N | `projects.template_id` (null) | 어떤 템플릿에서 시작했는지 |

### 4.5 출력 · 분리
| 부모 → 자식 | 관계 | 연결 컬럼 | 설명 |
|---|---|---|---|
| projects → export_jobs | 1 : N | `export_jobs.project_id` | 출력 작업 (요청자 → users) |
| samples → separation_jobs | 1 : N | `separation_jobs.source_sample_id` | 분리할 원본 (요청자 → users) |
| separation_jobs → separation_stems | 1 : N | `separation_stems.separation_id` | 작업당 stem 여러 개, `(separation_id, stem_type)` 유일 |
| samples → separation_stems | 1 : 0..1 | `separation_stems.sample_id` (UQ) | 결과 stem도 하나의 샘플로 저장 |

### 4.6 AI
| 부모 → 자식 | 관계 | 연결 컬럼 | 설명 |
|---|---|---|---|
| users → reference_tracks | 1 : N | `reference_tracks.user_id` | 레퍼런스 등록자 |
| projects → reference_tracks | 0..1 : N | `reference_tracks.project_id` (null) | 프로젝트 연결은 선택 |
| reference_tracks ↔ tags | N : M | `reference_tags(reference_id, tag_id)` | 장르 태그 |
| reference_tracks → ai_analyses | 1 : N | `ai_analyses.reference_id` | 분석 결과 (재분석 가능) |
| ai_analyses → ai_recommendations | 1 : N | `ai_recommendations.analysis_id` | 프리셋/믹싱/마스터링 추천 |
| projects → ai_recommendations | 0..1 : N | `ai_recommendations.project_id` (null) | 적용 대상 프로젝트 |
| plugins → ai_recommendations | 0..1 : N | `ai_recommendations.target_plugin_id` (null) | 프리셋 추천 대상 플러그인 |
| users → assistant_messages | 1 : N | `assistant_messages.user_id` | Nyxi 도우미 대화 (개인 전용) |
| projects → assistant_messages | 0..1 : N | `assistant_messages.project_id` (null) | 대화가 일어난 프로젝트 |

## 5. 꼭 알아둘 규칙
1. **프로젝트를 지우면** 트랙·클립·패턴·노트·디바이스·연결선·오토메이션·씬·멤버·초대·이력·채팅·코멘트·스냅샷·출력이 함께 지워집니다(CASCADE). 레퍼런스·추천·Nyxi 대화는 `project_id`만 NULL이 됩니다.
2. **회원·샘플·프로젝트는 소프트 삭제**(`deleted_at`)입니다. 실제 DELETE가 거의 일어나지 않아 users FK는 RESTRICT입니다.
3. **N:M 연결 테이블은 3개**: `project_members`, `sample_tags`, `reference_tags` (모두 복합 PK).
4. **분리 결과와 출력 결과는 `samples`에 다시 들어갑니다** (`source = 'SEPARATION' / 'EXPORT'`). 그래서 타임라인에서 일반 샘플처럼 쓸 수 있습니다.
5. **라우팅**: `tracks.routing_mode = 'CHAIN'`이면 `track_plugins.slot_index` 순서로 직렬, `'PATCHER'`이면 `track_plugin_links` 연결선대로 처리합니다.
6. 시퀀서의 위치·길이는 모두 **tick (PPQ = 960)** 단위입니다. `midi_notes.start_tick`은 **패턴 시작 기준** 상대값입니다.
7. **마스터도 트랙입니다** (`tracks.track_type = 'MASTER'`, 프로젝트당 1개). 그래서 마스터 디바이스·오토메이션도 일반 트랙과 같은 테이블을 씁니다.
8. **클립 종류 규칙**: MIDI 클립 = `pattern_id` 필수·`sample_id` NULL / AUDIO 클립 = `sample_id` 필수·`pattern_id` NULL (CHECK 제약).
