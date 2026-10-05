# AI 구현 설명 29 — 시퀀서 화면 (studioNx.html)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-06 |
| 작업 | 확정된 목업 01~18을 실제 페이지로 옮김 (HTML·CSS). JS는 템플릿만. 이전 문서: [28_home_mobile_hero.md](28_home_mobile_hero.md) |
| 브랜치 | `feature/phase1/p1-15-studionx-stub` |
| 기준 | [Sequencer_Layout_Mockup.md](../Sequencer_Layout_Mockup.md) · PRD 02 §4.17 FR-2191~2202 · §4.18 · §4.19 FR-2241~2249 · 색 C Signal(다크) / C Light(라이트) |
| 만든 파일 | `studionx/frontend/studioNx.html` · `static/css/pages/studio.css` · `static/js/pages/sequencer.js`(템플릿) |

---

## 1. 실행 결과 (1440×900)
### 1.1 기본 화면
![기본 — 상단바 두 줄 · 왼쪽 버튼 줄 · 파일 패널 · 편곡 · MASTER · Nyxi](images/29_sequencer_screen/01_default.png)

### 1.2 트랙 펼침 (V)
![2. Strum 펼침 — Instrument · Effects · Connect to Another · Mixer](images/29_sequencer_screen/02_track_open.png)

### 1.3 아래 칸 — 피아노롤 · 믹서
![MIDI 클립 클릭 → 피아노롤](images/29_sequencer_screen/03_piano_roll.png)

![Tab → 믹서 (MASTER 오른쪽 끝 고정)](images/29_sequencer_screen/04_mixer.png)

### 1.4 협업 패널 + 편집 메뉴
![Members · Chat 패널과 EDIT 드롭다운](images/29_sequencer_screen/05_collab_menu.png)

### 1.5 녹음 중 · 라이트 테마
![녹음 중 — 상단바가 보라 띠 + ● REC](images/29_sequencer_screen/06_recording.png)

![라이트 테마 (C Light)](images/29_sequencer_screen/07_light.png)

> 화면의 트랙·클립·파일·숫자는 **모양 확인용 예시**입니다. `sequencer.js`를 구현하면 `GET /projects/{id}/full` 결과로 다시 그립니다.

## 2. 화면 구조
```
┌──────────────────────────────── .sq-top (2줄) ────────────────────────────────┐
│ 로고 · FILE~HELP · PAT/SONG · ▶■● · BPM · 시간 · 스펙트럼 · CPU · Saved · 🌐 · 💬 · Nyxi │
│ 힌트 · Pattern · Snap · Key · Chord · 창 바로가기                                │
├──────┬──────────────┬──────────────────────────────────────────────────────┤
│.sq-  │ .sq-side     │ .sq-main                                             │
│rail  │  파일 패널    │  .sq-tools (도구 막대)                                │
│ 52px │  (264px)     │  .sq-scroll ─ 눈금 · 마커 · 트랙들 · ＋Add Track · MASTER │
│      │  드롭 존      │  .sq-bottom (평소 숨김: 피아노롤/샘플/Agent/믹서)        │
│      │  검색        │  .sq-nyxi (오른쪽 아래에 떠 있음)                       │
│      │ (협업 패널)   │                                                       │
└──────┴──────────────┴──────────────────────────────────────────────────────┘
```
- `<body class="sq">`가 **격자 하나**로 전체를 나눕니다: 행 = 상단바 / 나머지, 열 = 버튼 줄 / 파일 패널 / 편곡.
- 페이지 전체는 스크롤하지 않습니다 (`height: 100svh; overflow: hidden`). 스크롤은 편곡 영역(`.sq-scroll`)과 파일 목록만 합니다.
- 최소 폭 1280px — `core/studio.js`의 `STUDIO_MIN_WIDTH`와 같은 값입니다.

## 3. 주요 부분과 클래스
| 영역 | 클래스 · id | 설명 |
|---|---|---|
| 상단바 | `.sq-top`, `.sq-menu`, `.sq-transport`, `#time`, `#spectrum` | 시간은 큰 글씨 분:초:밀리초 + 작은 글씨 마디(목업 결정). 스펙트럼 막대 24개는 자리 표시 → JS가 canvas로 교체 |
| 메뉴 | `.sq-dropdown` (`#menu-edit`, `#menu-lang`) | 편집 메뉴 항목·단축키는 FR-2242. 다른 메뉴도 같은 모양으로 추가 |
| 버튼 줄 | `.sq-rail__btn[data-category]` | 선택된 것은 `aria-pressed="true"` → 왼쪽 보라 줄 |
| 파일 패널 | `.sq-files`, `.sq-file`, `.sq-drop`, `.sq-search` | 누락 파일은 `.is-missing` (노란 이름 + Relink) |
| 협업 | `#collab` (`hidden`) | Members · Chat 버튼으로 엶 (Phase 6) |
| 눈금·마커 | `.sq-ruler`, `.sq-loop`, `.sq-markers`, `.sq-marker` | 위에 붙어 있음 (`position: sticky; top`) |
| 트랙 | `li.sq-track[data-color]` → `.sq-track__head` + `.sq-track__lane` | 머리는 왼쪽에 붙어 있음 (`sticky; left: 0`). 순서: 켜기/끄기 · V · 이름/악기 · M S ● |
| 클립 | `.sq-clip--midi` / `.sq-clip--audio` + `canvas.sq-clip__preview` | 어두운 면 + 트랙 색 테두리(C 스타일). 그리기 전에는 CSS 무늬가 자리를 표시 |
| 트랙 펼침 | `li.sq-acc` (`hidden`) | 4칸: Instrument · Effects · Connect to Another · Mixer |
| 트랙 추가 · MASTER | `.sq-addrow`, `.sq-track--master` | MASTER는 늘 맨 아래 (FR-252) |
| 아래 칸 | `#bottom` > `.sq-panel[data-panel]` | 한 번에 하나만 보임 |
| Nyxi | `.sq-nyxi` | 재생 중(`body.is-playing`)이면 BPM 속도로 흔들림 |

### 3.1 위치를 숫자로 정하는 방법 (CSS 변수)
클립·마커·재생선은 **마디 단위 숫자**만 주면 CSS가 자리를 계산합니다.

| 변수 | 쓰는 곳 | 뜻 |
|---|---|---|
| `--sq-bar-w` | `.sq` | 1마디 폭 (가로 확대·축소 때 이것만 바꿈) |
| `--sq-bars` | `.sq` | 보이는 마디 수 → 편곡 영역 전체 폭 |
| `--s`, `--l` | `.sq-clip`, `.sq-loop` | 시작 마디(0부터) · 길이(마디) |
| `--at` | `.sq-marker`, `.sq-playhead` | 위치(마디) |
| `--tc` | 트랙·클립 | 트랙 색 (`data-color="1~5 | audio"`가 정함) |
| `--bpm` | `body` | Nyxi 춤 속도 |
| `--sq-acc-h`, `--sq-bottom-h` | `.sq` | 펼침 높이 · 아래 칸 높이 (경계를 끌어 바꿀 때 이 값만 바꿈) |

예: 13마디부터 4마디 클립 → `style="--s:12; --l:4"`. JS에서는 tick을 마디로 바꿔 넣습니다 (`tick / (960 × 박자 분자)`).

### 3.2 테마
- 다크(기본)는 `tokens.css`의 색을 그대로 쓰고, 시퀀서 전용 면 색(`--sq-panel`, `--sq-line` …)과 트랙 5색(`--tc-1~5`)을 `.sq`에 둡니다.
- 라이트는 `:root[data-theme="light"] .sq`에서 같은 변수만 바꿉니다. 밝은 바탕에서 읽히도록 트랙 색을 진하게 (#5a17e0 · #137a45 · #0b0a0f · #c42b2b · #7d45f7) 했습니다.

### 3.3 상태 클래스 (JS가 붙임)
| 클래스 | 붙는 곳 | 화면 |
|---|---|---|
| `.is-playing` | `body` | Nyxi 춤 (움직임 줄이기 설정이면 안 움직임) |
| `.is-recording` | `body` | 상단바 보라 띠 + `● REC` |
| `.is-open` / `aria-expanded` | 트랙 / V 버튼 | 펼친 트랙 머리 강조 |
| `.is-selected` | 클립 · 노트 | 흰 테두리 |
| `.is-over` | `#drop-zone` | 파일을 끌어 올렸을 때 |

## 4. 만들면서 고친 것
| 문제 | 원인 | 해결 |
|---|---|---|
| 상단 메뉴 글자가 `FILEEDITADD…`로 붙고 칩 테두리가 사라짐 | 버튼 초기화 규칙 `.sq button`(우선순위 0,1,1)이 `.sq-chip`(0,1,0)의 여백·테두리를 덮음 | 초기화를 `:where(.sq) button`으로 바꿔 우선순위를 0으로 |
| 루프 구간이 1마디에 붙음 | 눈금 숫자 규칙 `.sq-ruler__bars span`이 루프에도 적용 | 루프를 `<i>`로, 숫자 규칙은 `> span`만 |
| 피아노롤 노트 칸이 눌림 | 아래 칸의 두 줄 격자를 바깥 `.sq-bottom`에 줘서 패널 안 머리줄·본문이 나뉘지 않음 | 격자를 각 `.sq-panel`로 옮김 |
| 시간 글자가 상단 줄을 넘침 | 1.55rem | 1.2rem |
| 믹서를 열면 Nyxi가 MASTER 줄을 가림 | Nyxi가 늘 바닥에 붙음 | `.sq-main:has(.sq-bottom:not([hidden]))`일 때 아래 칸 위로 올림 |

## 5. JS 템플릿 (`static/js/pages/sequencer.js`)
구현은 하지 않고 함수 이름·할 일·쓸 API만 적었습니다.

| 함수 | 할 일 |
|---|---|
| `init()` | `projectId` 읽기 → 로그인 확인 → `loadProject` → 각 `init*` |
| `loadProject(id)` | `GET /api/v1/projects/{id}/full` → 예시 트랙을 지우고 다시 그림 |
| `renderTrack` · `drawClipPreview` | 트랙 한 줄 HTML, 클립 canvas에 노트·파형 |
| `toggleTrackPanel` | V 펼침 (기본 하나, Shift+V 여러 개) |
| `openBottom(name)` | `'roll' · 'sample' · 'agent' · 'mixer'` 중 하나만 보이기 |
| `initMenus` · `initRail` · `initTracks` · `initBottom` | 메뉴 드롭다운, 버튼 줄, 트랙 버튼, 아래 칸 |
| `initShortcuts` | Space · Tab · A · P/B/D/T/S/C/E · V · Esc |
| `initDropZone` | 파일 끌어 놓기·업로드 |
| `setLanguage` · `initLanguage` | EN/KO/JA, `[data-i18n]` 글자만 |
| `updateTransport(state)` | 재생·녹음 상태, 시간 표시, 재생선 |

## 6. 아직 안 한 것
- 샘플 설정 · Nyxi Agent 패널(`#panel-sample`, `#panel-agent`)은 빈 자리만 있습니다 → 목업 07·08 모양으로 다음에 채움.
- 오토메이션 모드 화면(패턴 25% 흐림, Tempo·Meter 줄, 겹침 창), 그룹·리턴 트랙, 레이어 트랙은 목업(03·09·10~12·14·15)에만 있습니다.
- FILE · ADD 등 나머지 메뉴 드롭다운 내용, 언어 사전(KO/JA).
