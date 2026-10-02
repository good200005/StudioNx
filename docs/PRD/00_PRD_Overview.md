# Studio Nx — PRD 00. 전체 개요

| 항목 | 내용 |
|---|---|
| 문서 버전 | v0.1 (초안) |
| 작성일 | 2026-10-01 |
| 원본 기획 | `StudioNx_CLAUDE.md` |
| DB 문서 | [`docs/DB.md`](../DB.md) |

---

## 1. 제품 비전
**Studio Nx는 설치 없이 브라우저에서 바로 쓰는 웹 기반 DAW(Digital Audio Workstation) 시퀀서입니다.**

샘플을 끌어다 놓고, MIDI를 찍고, 웹 기반 가상악기/이펙트로 곡을 만든 뒤 WAV/MP3로 내보낼 수 있습니다.
여기에 다음 두 가지 차별점을 더합니다.
1. **AI 레퍼런스 분석** — 참고할 곡(YouTube 링크/파일)과 장르를 주면, AI가 분석해 synth·플러그인 프리셋과 믹싱·마스터링 설정을 추천합니다.
2. **실시간 협업** — Google Docs처럼 여러 회원이 하나의 프로젝트를 동시에 편집하고, 단체 채팅으로 소통합니다.

## 2. 대상 사용자
| 페르소나 | 특징 | 핵심 니즈 |
|---|---|---|
| 입문 프로듀서 | DAW 설치·구매가 부담, 믹싱 지식 부족 | 브라우저에서 바로 시작, "이런 느낌" 내는 법을 AI가 알려줌 |
| 비트메이커 / 취미 작곡가 | 샘플 위주 작업, 여러 기기에서 작업 | 샘플 라이브러리 관리, 어디서나 같은 프로젝트 열기 |
| 협업 팀 (밴드, 작곡 스터디) | 파일 주고받기가 번거로움 | 같은 프로젝트를 동시에 편집, 채팅으로 피드백 |

## 3. 핵심 기능 ↔ Phase 매핑
| # | 기획서 핵심 기능 | Phase | 문서 |
|---|---|---|---|
| 1 | 회원 등 기본 CRUD | Phase 1 | [01_Phase1_Account_Pages.md](01_Phase1_Account_Pages.md) |
| 2 | 시퀀서 (샘플 드래그앤드롭·라이브러리, MIDI 클릭/외부 악기 입력, 웹 기반 synth·plugin) | Phase 2 | [02_Phase2_Sequencer_Core.md](02_Phase2_Sequencer_Core.md) |
| 5 | WAV/MP3 등 포맷별 출력 | Phase 3 | [03_Phase3_Audio_Export.md](03_Phase3_Audio_Export.md) |
| 4 | 샘플 악기 분리 (instrument separation) | Phase 4 | [04_Phase4_Stem_Separation.md](04_Phase4_Stem_Separation.md) |
| 3 | 레퍼런스 AI 분석 → 프리셋·믹싱·마스터링 추천 | Phase 5 | [05_Phase5_AI_Reference_Analysis.md](05_Phase5_AI_Reference_Analysis.md) |
| 6 | 회원 초대 실시간 협업 + 단체톡 | Phase 6 | [06_Phase6_Collaboration_Chat.md](06_Phase6_Collaboration_Chat.md) |
| + | 시퀀서 캐릭터 Nyxi(Fruity Dance식, 외형은 외부 AI 플랫폼 제작), 트랙 아코디언(Ableton 체인 + FL Patcher), **Nyxi 카드형 디바이스 UI + 상세 설정 모달**, 토글형 하단 패널 | Phase 2 | [02](02_Phase2_Sequencer_Core.md) §4.7~4.9 |
| + | 오토메이션, 스케일·코드 도우미, 오디오 녹음, 패턴·클립 런처, 템플릿(확인창), 튜토리얼, UI 커스터마이징·커맨드 팔레트, 로컬 캐시 | Phase 2 | [02](02_Phase2_Sequencer_Core.md) §4.2, §4.10~4.16 |
| + | 저장 용량·사용량 관리 | Phase 1 | [01](01_Phase1_Account_Pages.md) §4.4 |
| + | Nyxi 도우미 (FL Studio Gopher식 AI 도우미, 캐릭터가 얼굴), **Nyxi 팁(상황 인지, 프로젝트 5개 시 유지 여부 확인창)** | Phase 5 | [05](05_Phase5_AI_Reference_Analysis.md) §4.4~4.5 |
| + | 타임라인 코멘트, 버전 스냅샷·복원, 트랙 잠금·담당자 | Phase 6 | [06](06_Phase6_Collaboration_Chat.md) §4.5~4.7 |
| + | 오디오 회귀 테스트, Sentry 활용 확장 | 공통 | 이 문서 §5, §7.1 |

> `+` 행은 2026-10-01 추가 요구사항입니다. 채택 경위는 [Ai_feedback.md](../Ai_feedback.md) §0, 상세 설명은 [Ai_feedback_moreExplain.md](../Ai_feedback_moreExplain.md)
> Phase 순서는 기획서 번호가 아니라 **의존성** 기준입니다.
> 시퀀서(Phase 2)가 있어야 출력(3)이 가능하고, 샘플 라이브러리가 있어야 분리(4)가 가능하며, 플러그인·믹서 구조가 있어야 AI 추천값(5)을 적용할 수 있습니다. 실시간 협업(6)은 프로젝트 데이터 구조가 안정된 뒤에 얹는 것이 안전합니다.

## 4. 로드맵
```
Phase 1  계정·기본 페이지   ──►  회원가입/로그인, 마이페이지, 프로젝트 목록
Phase 2  시퀀서 코어        ──►  studioNx.html 핵심 (MVP 완성 시점)
Phase 3  오디오 출력        ──►  WAV / MP3 / (FLAC) 내보내기
Phase 4  악기 분리          ──►  샘플 → stem 분리 → 라이브러리 등록
Phase 5  AI 레퍼런스 분석   ──►  분석 + 프리셋·믹싱·마스터링 추천
Phase 6  협업·단체톡        ──►  초대, 동시 편집, 채팅
```
- **MVP = Phase 1 + 2 + 3의 핵심** (혼자서 곡을 만들고 파일로 내보낼 수 있는 상태)
- Phase(기능 묶음)와 별개로, 실제 **구현 순서는 MVP·중요도 기준 3단계**로 나눴습니다 → [Implementation_Plan.md](../Implementation_Plan.md) (구현 목록 + 간트차트)

## 5. 기술 스택
| 영역 | 기술 | 비고 |
|---|---|---|
| Frontend | HTML5 + CSS + JavaScript (Vanilla) | 오디오: Web Audio API, AudioWorklet / 입력: Web MIDI API, Drag and Drop API |
| Backend | Python **FastAPI** | REST API + WebSocket(Phase 6), 무거운 작업은 백그라운드 작업 큐 |
| Database | **MySQL 8.0** (database `studionx`) | 기획서 규칙: Oracle 설치가 필요하면 MySQL로 대체 → 현재 PC에 MySQL 8.0이 설치되어 있어 MySQL 사용. 상세는 [DB.md](../DB.md) |
| C++ | DSP / 가상악기 엔진 (JUCE 등 학습 목적) | 브라우저에서 쓰려면 **WebAssembly(Emscripten)** 로 빌드해 AudioWorklet에서 호출하는 구조가 유력. 연동 지점만 PRD에 정의하고 구현은 사용자가 직접 |
| 파일 저장 | 서버 로컬 `storage/` (추후 S3 등 교체 가능) | DB에는 경로만 저장 |
| 오류 추적 · 모니터링 | **Sentry** | Frontend(`@sentry/browser`)와 Backend(`sentry-sdk` FastAPI 연동) 모두 적용. 예외·로그 오류 수집, 스택 트레이스, 릴리스·환경(dev/prod) 구분, 성능 추적(Tracing). 백그라운드 워커(인코딩·분리·AI 분석)도 동일하게 연동 |

### 5.1 시스템 구성도 (개념)
```
[Browser]
  ├─ HTML/CSS 페이지들
  ├─ JS 앱 (시퀀서 UI, 상태 관리)
  ├─ Web Audio 그래프 ── AudioWorklet ── (C++ → WASM DSP 모듈)
  └─ Web MIDI (외부 MIDI 키보드)
        │  REST (JSON, multipart)        │ WebSocket (Phase 6)
        ▼                                 ▼
[FastAPI 서버] ── 작업 큐(Worker) ── 인코딩 / 악기 분리 / AI 분석
        │
        ├─ MySQL (studionx)
        └─ File Storage (samples, exports, stems, references)

[Browser] · [FastAPI 서버] · [Worker]  ──(오류·성능 이벤트)──►  [Sentry]
```

## 6. 페이지 구성
| 페이지 | 설명 | Phase |
|---|---|---|
| `home.html` | 서비스 첫 화면 — 서비스 소개, 기능 설명, 문의 창 | 1 |
| (로그인 모달) | 로그인 — 별도 페이지 없이 `home.html`의 모달. 로그인이 필요한 페이지는 `home.html#login`으로 보냄 | 1 |
| `join.html` | 회원가입 | 1 |
| `myPage.html` | 마이페이지 대시보드 (최근 프로젝트, 라이브러리 요약, 받은 초대) | 1 (+6 초대 위젯) |
| `userInfo.html` | 회원 정보 조회·수정·탈퇴, **환경 설정(UI 커스터마이징)** 탭 | 1 (+2 환경 설정) |
| `myProject.html` | 나의 프로젝트 목록 (생성/이름변경/삭제/열기, 공유된 프로젝트) | 1 (+6 공유 목록) |
| `studioNx.html` | 시퀀서 본체 — 트랙 아코디언(디바이스·노트·오토메이션), 어레인지/런처 뷰, 토글형 하단 패널(톡방·Nyxi), 캐릭터 Nyxi, 설정·커맨드 팔레트 | 2~6 |

```
home ─┬─ (로그인 모달) ──► myPage ─┬─ userInfo
      └─ join                      ├─ myProject ──► studioNx
                                   └─ (초대 수락) ──► studioNx
```

## 7. 공통 비기능 요구사항
| 구분 | 요구사항 |
|---|---|
| 브라우저 | 최신 Chrome / Edge 우선 지원 (Web MIDI·AudioWorklet 지원). Firefox·Safari는 가능한 범위에서 |
| 보안 | 비밀번호 해시 저장(bcrypt/argon2), HTTPS, 모든 API에서 **본인/권한 검사**, 업로드 파일 형식·용량 검증 |
| 성능 | 시퀀서 재생 중 UI 조작으로 오디오가 끊기지 않을 것 (오디오 처리는 AudioWorklet 스레드) |
| 반응형 | 일반 페이지는 모바일 대응. `studioNx.html`은 데스크톱(1280px 이상) 우선 |
| 로그 · 오류 추적 | 서버 오류·작업 실패는 원인(`error_message`)을 DB에 남기고, 예외·오류 로그는 **Sentry**로 수집·추적. 프론트 JS 오류(오디오 엔진, WebSocket 등)도 Sentry로 전송. 비밀번호·토큰 등 민감정보는 Sentry 전송 전 제거(`before_send` 필터) |
| 모니터링 지표 (Sentry 확장) | 오류뿐 아니라 **서비스 품질 지표**도 Sentry 커스텀 이벤트·성능 측정으로 수집: 오디오 언더런(끊김) 횟수, AudioContext 출력 지연, 프로젝트 로딩 시간(캐시 적중 여부), WebSocket 재접속 횟수·연산 거부율, AI 분석·Nyxi 응답 시간, 출력·분리 작업 소요 시간. Session Replay는 입력값·채팅 내용 마스킹 후 오류 발생 세션에만 제한적으로 사용 |
| 저장 용량 | 사용자별 저장 한도(기본 5GB, 설정값)와 사용량 표시. 오래된 출력 파일·자동 스냅샷은 보관 정책에 따라 자동 정리 |
| 시간 | 서버·DB는 UTC 저장, 화면에서 로컬 시간으로 표시 |

### 7.1 품질 보증 — 오디오 회귀 테스트 (골든 파일)
> DAW에서 가장 위험한 버그는 **오류 없이 소리만 조용히 달라지는 것**입니다. Sentry로는 잡히지 않으므로 별도 테스트를 둡니다.

| 항목 | 내용 |
|---|---|
| 방법 | 테스트용 프로젝트 세트(악기별·이펙트별·패처 병렬·오토메이션·템플릿)를 **오프라인 렌더링**해 기준 WAV(골든 파일)와 비교 |
| 비교 기준 | 샘플 단위 차이의 최대값·RMS 차이·LUFS 차이가 허용 오차 이내 (예: RMS 차이 -80 dBFS 이하) |
| 실행 시점 | 오디오 엔진·플러그인·라우팅·오토메이션 코드를 바꿀 때마다 (CI 또는 로컬 명령 1개). Headless Chrome에서 실행 |
| 기준 갱신 | 의도적으로 소리를 바꾼 경우에만, 변경 이유를 기록하고 골든 파일 갱신 |
| 보관 위치 | `tests/audio/projects/`(테스트 프로젝트 JSON), `tests/audio/golden/`(기준 WAV) |
| WASM 비교 | 같은 플러그인의 Web Audio 버전과 C++/WASM 버전 결과를 비교하는 용도로도 사용 |

## 8. AI 활용 규칙 (기획서 원칙 정리)
모든 Phase 문서의 "AI 역할 구분" 절은 이 규칙을 따릅니다.

| 영역 | AI 역할 | 비고 |
|---|---|---|
| **HTML / CSS** | 적극 활용 (AI가 작성) | 단, 작성 전 관련 디렉토리의 **기존 레퍼런스(스타일·구조)를 먼저 확인**하고 그에 맞출 것 |
| **JavaScript** | **템플릿만 제공** (파일 구조, 함수 시그니처, TODO 주석) | 구현은 사용자가 직접. **요청할 때만** AI가 구현 |
| **Backend (FastAPI)** | **템플릿만 제공** (라우터, 스키마, 함수 뼈대) | 위와 동일 |
| **DB** | 새 database(`studionx`)에 테이블 생성, 구조 문서([DB.md](../DB.md)) 유지 | 스키마 변경 시 DB.md를 반드시 함께 갱신 |
| **C++** | **최대한 건드리지 않음** | JUCE 등 외부 라이브러리 학습 목적. 인터페이스(입출력 규격) 문서화까지만 |
| **문서화** | AI가 구현한 부분은 **반드시 별도 문서에 상세 설명** | 프로젝트 관련 질문(면접·발표 등)에 대비. 예: `docs/ai-notes/<기능명>.md` |

## 9. 용어집
| 용어 | 설명 |
|---|---|
| DAW | Digital Audio Workstation. 음악 녹음·편집·믹싱 소프트웨어 |
| 시퀀서 | 시간축(타임라인) 위에 오디오/MIDI를 배치하고 재생하는 도구 |
| 트랙 / 클립 | 트랙은 가로 한 줄(악기 하나), 클립은 트랙 위에 놓인 오디오/MIDI 덩어리 |
| 샘플 | 짧은 오디오 파일(드럼 한 방, 루프 등) |
| MIDI | 음 높이·세기·길이 등 연주 정보. 소리 자체가 아님 |
| 피아노롤 | MIDI 노트를 격자 위에 찍어 편집하는 화면 |
| 가상악기 / Synth | MIDI를 받아 소리를 만드는 악기 플러그인 |
| 이펙트 플러그인 | EQ, 컴프레서, 리버브 등 소리를 가공하는 플러그인 |
| 프리셋 | 플러그인 파라미터 값을 저장한 묶음 |
| 믹싱 / 마스터링 | 트랙별 밸런스·음색 조정 / 최종 결과물의 음량·톤 마무리 |
| Stem | 곡을 악기별로 나눈 오디오 (보컬, 드럼, 베이스 등) |
| LUFS | 체감 음량 단위. 스트리밍 플랫폼 기준값(예: -14 LUFS) 비교에 사용 |
| Tick / PPQ | 시퀀서 시간 단위. PPQ=960이면 4분음표 1개 = 960 tick |
| AudioWorklet | 브라우저의 별도 오디오 스레드에서 실행되는 사용자 정의 DSP 코드 |
| WASM | WebAssembly. C++ 등을 브라우저에서 실행 가능한 형태로 컴파일한 것 |
| 트랙 아코디언 | 트랙 바로 밑으로 펼쳐지는 편집 영역. 디바이스·피아노롤을 여기서 편집 (하단 고정 패널 대체) |
| 디바이스 체인 | Ableton Live 방식. 악기/이펙트 카드를 왼쪽→오른쪽으로 나열해 직렬 처리 |
| 패처 (Patcher) | FL Studio 방식. 디바이스를 노드로 두고 선으로 연결해 병렬·분기 라우팅 |
| 하단 패널 | 버튼을 누를 때만 나타나는 패널. [톡방]과 [Nyxi] 탭 |
| Nyxi (닉시) | Studio Nx의 오리지널 캐릭터. ① FL Studio **Fruity Dance**(FL Chan)처럼 화면에서 박자에 맞춰 춤추고 ② **AI 도우미의 아이콘·얼굴** ③ **디바이스 카드 아트**의 바탕. 외형·애니메이션은 **별도 AI 플랫폼에서 제작**하며 이 프로젝트는 연동만 담당 |
| Nyxi 팁 | Nyxi가 묻기 전에 먼저 알려주는 상황 인지 팁 (클리핑, 저역 겹침 등). 끄기 / 중요한 것만 / 모두 |
| 디바이스 카드 / 상세 설정 모달 | 이펙터·악기를 Nyxi 기반 카드로 보여주고 핵심 노브만 노출, 세부 설정은 카드 클릭 시 여는 모달에서 조작 |
| Nyxi 도우미 | FL Studio의 Gopher 같은 대화형 AI. Studio Nx 사용법·작곡/믹싱 질문에 답함 (Phase 5). "Gopher"는 FL Studio 서비스명이라 사용하지 않음 |
| 오토메이션 | 볼륨·필터 등 파라미터를 시간에 따라 자동으로 바꾸는 선(레인) |
| 패턴 / 링크 클립 | 여러 클립이 같은 노트 묶음(패턴)을 공유. 하나를 고치면 모두 바뀜 |
| 클립 런처 (세션 뷰) | 트랙 × 씬 격자에서 클립을 즉석 재생·조합하는 화면 (Ableton 방식) |
| 스냅샷 | 특정 시점의 프로젝트 전체 상태 저장본. 미리듣기·복원·복제 가능 |
| 커맨드 팔레트 | Ctrl+P로 모든 명령을 검색해 실행하는 입력창 |
