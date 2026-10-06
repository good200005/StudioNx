# AI 구현 설명 30 — 시퀀서 편곡 · 피아노롤 · 오토메이션 (꽉 채우기 · 드래그 · 재생선 · 확대/축소 · 선택 · 셋잇단 · 스냅 · Loop · 높이 · 곡선)

| 항목 | 내용 |
|---|---|
| 작성 | Claude (AI) |
| 작성일 | 2026-10-06 |
| 작업 | 사용자 요청 `studionx/frontend-reference/images/sequencer reference/수정 사항.pdf` · `수정 사항2.pdf` 반영. 이전 문서: [29_sequencer_screen.md](29_sequencer_screen.md) |
| 브랜치 | `feature/phase1/p1-15-studionx-stub` |
| 바꾼 파일 | `studioNx.html` · `static/css/pages/studio.css` · `static/i18n/sequencer.json` · **새 파일** `static/js/pages/sequencer-arrange.js` · `sequencer-roll.js` · `sequencer-automation.js`(구현) · `static/js/pages/sequencer.js`(불러오기 세 줄) |

---

## 1. 요청 내용
| # | 요청 (수정 사항.pdf) | 한 일 |
|---|---|---|
| 1 | 편곡 영역(빨간 네모)이 오른쪽·아래 빈 곳(노란 네모)까지 **꽉** 차야 함. 기기마다 브라우저 크기가 달라도 늘 꽉 차게 | CSS — 마디 폭을 화면 폭에 맞춰 늘리고, 남는 높이는 빈 줄이 가져감 (§3) |
| 2 | 트랙의 마디를 드래그로 왼쪽·오른쪽으로 옮김 | JS — 마디 줄·마커 줄·빈 칸을 끌면 편곡이 좌우로 움직임 (§4.1) |
| 3 | 패턴을 드래그 앤 드롭으로 트랙에 놓고, 옮길 수 있어야 함 | JS — 왼쪽 목록 → 트랙 끌어 놓기 (§4.3), 클립 끌어서 옮기기 (§4.2) |
| 4 | (수정 사항2) 재생선이 트랙 머리 칸 오른쪽 끝보다 왼쪽에 오면 사라져야 함 | CSS — 재생선을 트랙 머리 아래 층으로 (§4.5) |
| 5 | (수정 사항2) 재생할 때 "재생선 고정 · 트랙이 움직임"과 "트랙 고정 · 재생선이 움직임" 중 고를 수 있어야 함 | 도구 막대 버튼 두 개 + VIEW 메뉴, 재생선 동작 구현 (§4.6) |
| 6 | (수정 사항2) 패턴은 아래로 옮기지 않고 좌우로만 (Ableton 트랙 관리 방식) | JS — 클립은 자기 트랙 안에서 좌우로만 (§4.2) |
| 7 | (대화) 마커도 드래그해서 좌우로 옮기기 | JS — 마커 끌기 (§4.7) |
| 8 | (대화) Ctrl+휠 확대·축소 때 격자가 촘촘해지거나 듬성해져야 | JS + CSS — 확대 배율 · 격자 단계 · 줄자 숫자 · 스냅 (§4.8) |
| 9 | (대화) 최소 크기로 하면 가로 스크롤 바가 사라짐 · 트랙 길이는 FL 기준 최대로 | 편곡 길이 **999마디** + 가로 스크롤 바 늘 보이게 (§3.1) |
| 10 | (대화) Ctrl 로 여러 패턴 선택 | Ctrl+클릭 선택·해제, 함께 옮기기, 빈 곳 클릭 해제, Ctrl+A (§4.9) |
| 11 | (대화) triplet(셋잇단) | 상단 `³ Triplet` · OPTIONS › Triplet grid — 격자·스냅을 1/12 · 1/24 로 (§4.10) |
| 12 | (대화) ＋ Add Track 아래에도 격자가 있음 → 지우기 | 빈 칸에는 격자를 그리지 않음 (§3) |
| 13 | (대화) 확대할 때 일정 부분의 격자가 흐릿해짐 | 1마디 폭을 정수 px 로 + 격자를 보이는 부분만 canvas 에 정수 픽셀로 그림 (§4.11) |
| 14 | (대화) 드래그로 영역 선택해서 여러 패턴 선택 — **Select(E) 도구일 때만** (사용자 결정) | 도구 막대 도구 고르기 + 사각형 영역 선택 (§4.12) |
| 15 | (대화) 격자를 무시하고 놓는 옵션 — **Alt 끌기 + Snap Off 둘 다** (사용자 결정) | Alt 를 누른 채 끌면 그때만, 상단 `Snap ▾` → Off 면 계속 (§4.13) |
| 16 | (대화) loop 구간 설정 — **마커 줄에서 마우스 오른쪽을 누른 채 끌기** (사용자 결정) | 오른쪽 끌기로 범위 · ⟲ 버튼으로 켜고 끄기 · 재생이 구간 안에서 반복 (§4.14) |
| 17 | (대화) 트랙이 많으면 아래로 스크롤 되나? | 이미 됨 — 시험만 (§2.7) |
| 18 | (대화) 트랙별 · 전체 트랙 높이 바꾸기 | 트랙 아래 경계 끌기 · Alt+끌기(전체) · ↕−/↕+ · VIEW 메뉴 · 경계 더블 클릭(기본으로) (§4.15) |
| 19 | (대화) 피아노롤 확대·축소 · 격자는 편곡 방법을 따르고, 높이는 **모든 노트 높이만** | 새 모듈 `sequencer-roll.js` — Ctrl+휠 · 같은 격자 규칙 · 건반 줄 높이(전체)만, 노트 찍기·옮기기·길이·지우기 (§4.16) |
| 20 | (대화) 피아노롤에서 Shift+휠 = 전체가 커지도록 | 가로(마디 폭) + 세로(노트 높이)를 같은 비율로 (§4.16) |
| 21 | (대화) 오토메이션: 클릭 = 점, 드래그 = 기울기, 곡선도 — **점과 점 사이 가운데 `↕` 를 누른 채 위아래로 끌면 곡선** (사용자 결정) | 새 모듈 `sequencer-automation.js` — 모드 켜기, 점 찍기·끌기·지우기, ↕ 곡선 (§4.17) · 동작 GIF |
| 22 | (대화) MIDI 노트 · 트랙 안 패턴은 **선택하고 Delete · Backspace** 로 지우기 | 편곡 클립 · 피아노롤 노트 — 마지막으로 누른 곳 기준, EDIT › Delete 도 (§4.18) |
| 23 | (대화) 빈 곳에 오디오를 놓으면 오디오 트랙, MIDI 를 놓으면 MIDI 트랙 생성 · 종류가 다른 트랙에 놓으면 새 트랙을 만들지 묻기 (탐색기에서 바로 놓기는 안 함) | 목록 → 빈 곳 = 새 트랙, 다른 종류 트랙 = 묻는 창 → 그 아래에 새 트랙 (§4.19) |
| 24 | (대화) 트랙 번호는 위치대로 다시 매기기 (Ableton · FL 처럼) | `renumberTracks` — 번호를 가리키는 연결 표시도 함께 (§4.19) |

> **2026-10-06 변경:** 편곡 길이 64마디 → **999마디**. 아래 §2.1 · §2.3 의 캡처·숫자 일부는 64마디일 때 찍은 것입니다 (꽉 채우기 원리는 같음).

> JS 는 원래 템플릿만 두는 규칙이지만, 이번 2·3번은 사용자가 동작을 요청해서 AI 가 구현했습니다. `sequencer.js`의 다른 함수(TODO)는 그대로입니다.

## 2. 실행 결과
### 2.1 꽉 채우기 — 화면 크기 3가지
![1440×900 — 64마디 중 일부가 보이고 가로 스크롤](images/30_sequencer_arrange_drag/01_fill_1440.png)

![1920×1080 — 남는 높이는 빈 줄, 리턴·MASTER 는 맨 아래](images/30_sequencer_arrange_drag/02_fill_1920.png)

![2560×1440 — 64마디가 다 들어가도 남으면 마디 폭을 늘려 오른쪽 끝까지](images/30_sequencer_arrange_drag/03_fill_2560.png)

| 크기 | 편곡 칸 폭 | 마디 영역 폭 | 1마디 | 아래 끝 |
|---|---|---|---|---|
| 1440×900 | 1124px | 2043px (가로 스크롤) | 28.8px | MASTER 아래 = 화면 아래 |
| 1920×1080 | 1604px | 2043px (가로 스크롤) | 28.8px | 같음 |
| 2560×1440 | 2244px | **2244px (딱 맞음)** | 31.94px | 같음 |

### 2.2 재생선 (수정 사항2)
![편곡을 옮겨 재생선이 트랙 머리 칸 왼쪽으로 가면 가려져 안 보임](images/30_sequencer_arrange_drag/08_playhead_hidden.png)

![⇥ Playhead moves — 트랙은 그대로, 재생선이 오른쪽으로](images/30_sequencer_arrange_drag/09_follow_page.png)

![⇆ Tracks move — 재생선은 그 자리, 트랙이 왼쪽으로](images/30_sequencer_arrange_drag/10_follow_scroll.png)

| 시험 (1440×900, 145 BPM, 2초 재생) | 재생선 화면 위치 | 편곡 스크롤 |
|---|---|---|
| 편곡을 600px 옮김 (재생 안 함) | 276px — 트랙 머리 오른쪽 끝(516px)보다 왼쪽 → 가려짐 | 600 |
| ⇥ Playhead moves | 876 → 911px (움직임) | 0 → 0 (그대로) |
| ⇆ Tracks move | 912 → 912px (그대로) | 0 → 35 (움직임) |
| ■ 멈춤 (재생 중) | 시작한 마디(13.75)로 돌아감 | — |
| 새로고침 | 고른 방식(Tracks move) 그대로 | — |

### 2.3 확대 · 축소 (Ctrl+휠) · 마커 끌기
![확대 — 1마디 95.6px, 박(1/4) 선이 생기고 마디 번호가 1마디마다](images/30_sequencer_arrange_drag/11_zoom_beat.png)

![더 확대 — 1마디 317.5px, 1/16 선까지](images/30_sequencer_arrange_drag/12_zoom_sixteenth.png)

![끝까지 축소 — 999마디라 최소(1마디 7.2px)에서도 가로 스크롤 바가 남음](images/30_sequencer_arrange_drag/15_zoom_min_999.png)

![Zoom to fit — 클립·마커가 있는 32마디까지를 한 화면에](images/30_sequencer_arrange_drag/16_zoom_to_content.png)

![마커 Prechorus 를 4 → 6마디로 끌어 옮김](images/30_sequencer_arrange_drag/14_marker_drag.png)

| 시험 (1440×900, 마우스는 편곡 칸 700px 지점) | 배율 | 1마디 | 격자 | 마디 번호 | 마우스 아래 마디 |
|---|---|---|---|---|---|
| 처음 | 1 | 28.8px | 마디 | 2마디마다 (32개) | 17.36 |
| Ctrl+휠 위로 8칸 | 3.32 | 95.6px | 마디 + 박 | 1마디마다 | 17.35 |
| 8칸 더 | 11.02 | 317.5px | 마디 + 박 + 1/16 | 1마디마다 | 17.34 |
| Ctrl+휠 아래로 끝까지 (999마디) | 0.25 (최소) | 7.2px | 4마디마다 | 8마디마다 (125개) | — — 편곡 폭 7,393px > 화면 1,124px → 가로 스크롤 바 남음 |
| VIEW › Zoom to fit | 1.0 | 28.9px | 마디 | 2마디마다 | 클립이 있는 1~32마디가 한 화면에 |
| Ctrl 없이 휠 | 그대로 | — | — | — | — (세로 스크롤) |
| 마커 Prechorus 를 2마디만큼 끌기 | — | — | — | — | 4 → 6마디 |

### 2.4 여러 선택 · 셋잇단
![Ctrl+클릭 — Lead · Drums 선택 (Strum 은 Ctrl+클릭 두 번으로 다시 뺌)](images/30_sequencer_arrange_drag/17_multi_select.png)

![선택한 두 클립을 함께 2마디 오른쪽으로 — 선택 안 한 Strum 은 그대로](images/30_sequencer_arrange_drag/18_multi_move.png)

![셋잇단 켬 · 박 단계 — 1박이 3칸(1/12마디)](images/30_sequencer_arrange_drag/19_triplet_beat.png)

![셋잇단 켬 · 1/16 단계 — 1박이 6칸(1/24마디)](images/30_sequencer_arrange_drag/20_triplet_sixteenth.png)

| 시험 | 결과 |
|---|---|
| Lead 클릭 → Strum · Drums Ctrl+클릭 | 선택: Lead, Strum, Drums |
| Strum 다시 Ctrl+클릭 | 선택: Lead, Drums |
| Lead 를 2마디 오른쪽으로 끌기 | Lead 0 → 2, Drums 4 → 6 (Strum 은 0 그대로) |
| 다시 4마디 왼쪽으로 끌기 | Lead 0, Drums 4 — 맨 앞 Lead 가 0 에서 멈춰 2마디만 (간격 유지) |
| 트랙 빈 곳 클릭 | 선택 없음 |
| Ctrl+A | 20 / 20 선택 |
| 박 단계(1마디 95.6px)에서 0.4마디 끌기 — 셋잇단 끔 | +0.5 (1/4 스냅) |
| 같은 끌기 — 셋잇단 켬 | +0.4167 (= 5/12, 1/12 스냅) · `--sq-sub` 12 |
| 1/16 단계 — 셋잇단 켬 | `--sq-sub` 24 |

### 2.5 격자 또렷함 (흐려짐 수정)
![박 단계 — 마디 · 박 선이 모두 같은 진하기로 또렷](images/30_sequencer_arrange_drag/21_grid_sharp_beat.png)

![1/16 단계](images/30_sequencer_arrange_drag/22_grid_sharp_sixteenth.png)

![곡 끝 근처(901~903마디, 스크롤 285,300px)에서도 또렷](images/30_sequencer_arrange_drag/23_grid_sharp_far.png)

시험: Ctrl+휠로 16단계 확대하며 매번 canvas 한 줄의 픽셀을 읽어, 완전히 칠한 선 픽셀과 **반쯤 칠한(번진) 픽셀** 수를 셈.

| 단계 | 1마디 폭 | 선 픽셀 | 번진 픽셀 |
|---|---|---|---|
| 처음 | 29px | 32 | **0** |
| 확대 5 (박) | 61px | 60 | **0** |
| 확대 12 (1/16) | 174px | 85 | **0** |
| 확대 16 | 317px | 46 | **0** |
| 900마디 근처 | 317px | 47 | **0** |
| 셋잇단 켬 | 317px | 70 | **0** |
| ＋ Add Track 아래 빈 칸 | — | 0 (안 그림) | — |

### 2.6 영역 선택 · 스냅 · Loop
![Select(E) 도구 — 1~4번 트랙, 5~10마디를 끌어 영역 선택](images/30_sequencer_arrange_drag/24_marquee.png)

![Snap ▾ 메뉴 — Line / Off](images/30_sequencer_arrange_drag/25_snap_menu.png)

![마커 줄 오른쪽 끌기로 Loop 4~8마디 — 눈금 위 보라 띠 · 트랙 위 옅은 보라 · ⟲ 켜짐, 재생이 구간 안에서 반복](images/30_sequencer_arrange_drag/26_loop.png)

| 시험 | 결과 |
|---|---|
| Draw 도구에서 트랙 빈 곳 끌기 | 좌우 이동 (스크롤 200) — 그대로 |
| Select(E) 도구 → 힌트 바 | `Select (E) — Drag on empty space to select clips …` |
| 1~4번 트랙 · 5~10마디 영역 끌기 | 선택: Lead #2, Strum, Drums, Chords (조금이라도 걸친 클립) |
| Ctrl+영역 끌기 (8번 트랙) | 위 4개 + vox_take2 |
| 빈 곳 클릭 | 선택 없음 |
| 마디 단계에서 0.37마디 끌기 — Alt | 0 → 0.370052 (격자 무시, 1틱 단위) |
| 같은 끌기 — 그냥 | 1마디에 붙음 |
| Snap ▾ → Off 후 같은 끌기 | +0.370052 (계속 무시), 버튼 글자 `Snap: Off ▾` |
| 마커 줄 4.2 → 7.9마디 오른쪽 끌기 | Loop 4~8마디(1마디 스냅), 띠 진하게, ⟲ 켜짐 |
| 7.5마디에서 재생 2.5초 | 8 을 넘어 5.01마디 — 구간 안으로 돌아옴 |
| ⟲ 다시 누르기 | Loop 꺼짐 (띠 흐리게) |

### 2.7 트랙이 많을 때 세로 스크롤
![트랙 30개 — 아래로 스크롤해 30번 · Add Track · 리턴 · MASTER 까지, 마디 줄은 위에 고정](images/30_sequencer_arrange_drag/27_many_tracks_scrolled.png)

| 시험 (시험용으로 트랙 20개 복제) | 결과 |
|---|---|
| 트랙 10개 | 편곡 높이 797px = 화면 → 세로 스크롤 바 없음, 빈 줄 98px |
| 트랙 30개 | 편곡 높이 1,602px > 797px → 세로 스크롤 바(15px), 빈 줄은 최소 24px |
| 휠 아래로 (Ctrl 없이) | 805px 내려감, 마디 줄 · 마커 줄은 위에 고정, MASTER 보임 |

### 2.8 트랙 높이
![2번 트랙 +40px, 3번 트랙 +20px (아래 경계 끌기)](images/30_sequencer_arrange_drag/28_track_height_one.png)

![Alt+경계 끌기 → 전체 30px — 낮은 트랙은 악기 이름 줄을 숨김](images/30_sequencer_arrange_drag/29_track_height_compact.png)

| 시험 | 1 · 2 · 3 · 4 · 5 · 그룹 높이(px) |
|---|---|
| 처음 | 44 · 44 · 44 · 44 · 44 · 44 |
| 2번 트랙 아래 경계를 40px 아래로 (클립 칸 쪽) | 44 · **84** · 44 · 44 · 44 · 44 |
| 3번 트랙 경계를 20px 아래로 (트랙 머리 쪽) | 44 · 84 · **64** · 44 · 44 · 44 |
| 2번 경계 더블 클릭 | 44 · **44** · 64 · 44 · 44 · 44 |
| 1번 경계를 Alt+끌기 14px 위로 | 모두 **30** (낮은 트랙 표시) |
| ↕+ 두 번 | 모두 44 |
| VIEW › Reset track heights | 모두 44 |

### 2.9 피아노롤
![MIDI 클립(Lead #2) 더블 클릭 → 아래 칸 피아노롤 · Ctrl+휠로 확대 (1마디 394px, 박 선) · 5마디 = 패턴 끝(보라 선)](images/30_sequencer_arrange_drag/32_roll_zoom_in.png)

![셋잇단 켬 — 박 안이 3칸, 새 노트(E3)가 1/12 격자(2.1667마디)에 찍힘](images/30_sequencer_arrange_drag/34_roll_triplet.png)

| 시험 (1440×900) | 결과 |
|---|---|
| Lead #2 클립 더블 클릭 | 아래 칸에 피아노롤, 제목 `Piano roll — Lead #2` |
| 처음 | 1마디 160px · 줄 12px · 번진 픽셀 0 |
| Ctrl+휠 위로 6칸 (마우스 아래 박자) | 1마디 394px · 마우스 아래 13.90 → 13.89박 (제자리) · 번짐 0 |
| Ctrl+휠 아래로 끝까지 | 1마디 111px = 8마디가 화면에 꽉 (더 축소 안 됨) · 번짐 0 |
| ↕+ 두 번 | 모든 줄 12 → 16px |
| 건반 줄 경계를 끌어 줄마다 4px 줄이기 | 16 → **12px** (예상 12) |
| ↕− | 10px |
| 빈 곳 클릭 (1.6마디, 박 단계) | G3 노트가 1.5마디에 (0.25마디 길이) |
| 그 노트를 0.3마디 오른쪽 · 2줄 위로 끌기 | A3, 1.75마디 |
| 오른쪽 끝을 0.5마디 늘리기 | 길이 0.25 → 0.75 |
| 오른쪽 클릭 | 지워짐 |
| 셋잇단 켜고 2.2마디 클릭 | 2.166667마디 (1/12 격자), 길이는 마지막 길이 0.75 |
| **Shift**+휠 위로 4칸 | 1마디 160 → 292px **그리고** 줄 12 → 22px · 마우스 아래 11.4박 · 68.8음 제자리 |
| Shift+휠 아래로 6칸 (Windows 처럼 deltaX 로 보냄) | 1마디 119px(꽉 채우기에서 멈춤) · 줄 9px · 음높이 68.7 제자리 |
| 그다음 Ctrl+휠 위로 3칸 | 1마디 186px, 줄은 9px 그대로 (가로만) |
| 그냥 휠 | 세로 스크롤만 |

![Shift+휠 — 가로·세로가 함께 커짐 (1마디 292px · 줄 22px)](images/30_sequencer_arrange_drag/35_roll_shift_zoom.png)

### 2.10 오토메이션 편집 (동작 GIF)
**동작 영상:** [`images/30_sequencer_arrange_drag/37_automation_demo.webp`](images/30_sequencer_arrange_drag/37_automation_demo.webp) (15초 · 자막 ①~⑨ · 커서 표시, 애니메이션 WebP — 브라우저로 열기, PDF 에서는 아래 정지 화면)

![오토메이션 모드 — Reverb mix 클립에 점을 찍고 ↕ 로 첫 구간은 볼록, 둘째 구간은 오목하게](images/30_sequencer_arrange_drag/38_automation_curve.png)

| 단계 (GIF 자막) | 점 데이터 `[시간(마디), 값, 곡선]` 결과 |
|---|---|
| 처음 | `[0, 0.2, 0] · [7.2, 0.2, −0.55] · [12, 0.8, 0]` |
| ① ⤴ Automation A | 모드 켜짐, 패턴 흐림 · 누를 수 없음 |
| ② 빈 곳 클릭 (3.1마디) | `[3, 0.7, 0]` 점 추가 (1마디 격자에 붙음) |
| ③ 점 끌기 | `[2, 0.85, 0]` — 앞뒤 선의 기울기가 바뀜 |
| ④ ↕ 위로 | 그 구간 곡선 **+1** (볼록, 끝까지 올림) |
| ⑤ ↕ 아래로 | **−0.71** (오목) — 손잡이가 포인터를 따라감 |
| ⑥ 첫 구간 ↕ 위로 | 첫 구간 **+0.68** |
| ⑦ ↕ 더블 클릭 | 그 구간 **0** (직선) |
| ⑧ 점 더블 클릭 | 점 지워짐, 처음 · 끝 점은 남음 |
| ⑨ ⤴ Automation A | 모드 꺼짐 |

### 2.11 드래그
![마디 줄을 왼쪽으로 끌어 편곡이 400px 이동](images/30_sequencer_arrange_drag/04_pan.png)

![클립 옮기기 — Lead #2 를 아래로 끌어도 1번 트랙 그대로, 2마디 오른쪽으로만](images/30_sequencer_arrange_drag/05_move_clip.png)

![Patterns 목록의 Chords 를 5. Pad 트랙에 끄는 중 (점선 = 놓일 자리)](images/30_sequencer_arrange_drag/06_drop_ghost.png)

![놓은 뒤 — 22마디에 Chords 클립이 생기고 선택됨](images/30_sequencer_arrange_drag/07_dropped.png)

자동 시험(헤드리스 Chrome 에 실제 마우스 이벤트) 결과:

| 시험 | 결과 |
|---|---|
| 마디 줄을 400px 왼쪽으로 끌기 | 편곡 스크롤 0 → 400 |
| 트랙 빈 칸을 400px 오른쪽으로 끌기 | 400 → 0 (되돌아옴) |
| `Lead #2`(1번 트랙, 8마디) → 오른쪽 2마디 + 아래 트랙으로 끌기 | **1번 트랙 그대로**, 10마디 |
| 오디오 `vox_take2` → 위 트랙으로 끌기 | 8번 트랙 그대로, 가로만 2 → 3마디 |
| Patterns 버튼 | 제목 `Patterns · 9 items`, 패턴 목록 보임, 필터 숨김 |
| `Chords` 패턴을 5. Pad 22마디에 놓기 | 5번 트랙에 `Chords` 클립 (22마디, 12마디 길이) |

## 3. 꽉 채우기 (CSS)
```css
.sq-lanes {
  --sq-bar-w: max(1.8rem, calc((100cqw - var(--sq-head-w)) / var(--sq-bars)));
  width: calc(var(--sq-head-w) + var(--sq-bars) * var(--sq-bar-w));
  min-height: 100%;
  display: flex; flex-direction: column;
}
.sq-fill { flex: 1 0 1.5rem; }
```
- **가로:** 편곡 길이를 64마디(`--sq-bars`)로 늘림. 1마디 폭은 "최소 1.8rem, 화면이 넓으면 `(편곡 칸 폭 − 트랙 머리) ÷ 64`" 중 큰 값. `100cqw`는 `.sq-scroll`(`container-type: inline-size`)의 안쪽 폭이라 창 크기가 바뀌어도 CSS 만으로 다시 계산됩니다. 눈금·클립·마커·재생선이 모두 같은 `--sq-bar-w`를 쓰므로 함께 맞춰집니다.
- **세로:** `.sq-lanes`를 세로 flex 로 바꾸고 높이를 최소 100% 로. `＋ Add Track` 바로 아래에 빈 줄 `.sq-fill`(트랙 머리 칸 + 빈 칸 — **격자는 그리지 않음**, 사용자 요청 2026-10-06)을 두어 남는 높이를 모두 가져가게 했습니다. 그래서 리턴 트랙과 MASTER 는 늘 화면 맨 아래에 붙습니다 (MASTER 맨 아래 원칙 FR-252 그대로).
- 트랙이 많아 화면보다 길면 `.sq-fill`은 최소 높이(1.5rem)만 남고 세로 스크롤이 생깁니다.

### 3.1 편곡 길이 999마디 · 가로 스크롤 바
- **왜 스크롤 바가 사라졌나:** 편곡이 64마디일 때 끝까지 축소하면 64마디가 한 화면에 다 들어가서, 더 볼 곳이 없으니 브라우저가 가로 스크롤 바를 숨겼습니다.
- **길이:** FL Studio 는 플레이리스트 길이에 공식 상한이 없어서(Image-Line 포럼: "제한 없음"), 같은 FL 의 패턴 상한(999개)에 맞춰 **999마디**로 정했습니다 (사용자 결정). 145 BPM 4/4 에서 약 27분.
- 최소 배율 0.25(1마디 7.2px)에서도 999 × 7.2 ≈ 7,200px 라 화면보다 넓어 스크롤 바가 늘 생깁니다. 그래도 `.sq-scroll { overflow-x: scroll }`로 가로 스크롤 바를 **항상** 보이게 했습니다.
- 꽉 채우기 공식(`max(1.8rem × 배율, 꽉 채우기 폭)`)은 그대로 — 999마디면 화면이 아주 넓지 않는 한 꽉 채우기 폭이 더 작아서 배율이 정합니다.
- 템포 줄 예시 곡선은 1~32마디 기준이라 `width: calc(var(--sq-bar-w) * 32)`로 고정 (실제로는 `renderGlobalLanes`가 변경점으로 그림).

## 4. 드래그 (`sequencer-arrange.js`)
`sequencer.js` 맨 아래에서 `initArrange({ onChange })`를 부릅니다. 바뀐 위치는 **화면에만** 반영되고, 저장은 `onChange`로 넘깁니다 (지금은 `console.debug`).

| 함수 | 하는 일 |
|---|---|
| `initArrange({ onChange })` | 아래 4개를 연결 |
| `initPan` | 좌우 이동 |
| `initClipDrag` | 클립 옮기기 |
| `initListDrop` | 목록 → 트랙 끌어 놓기 |
| `initBrowserLists` | 왼쪽 Samples ↔ Patterns 목록 바꾸기 |
| `createClip({ kind, name, start, length })` | 클립 버튼 만들기 (HTML 과 같은 모양, export) |

### 4.1 좌우 이동 (`initPan`)
- **어디서:** 마디 줄 · 마커 줄 · 트랙의 빈 칸 · 아래 빈 줄을 왼쪽 버튼으로 끌기. 가운데 버튼은 클립 위에서도 됩니다.
- **어떻게:** 누른 곳의 X 와 그때 `scrollLeft`를 기억 → 움직인 만큼 반대로 `scrollLeft` 를 바꿈. 4px 이상 움직여야 끌기로 보고(`DRAG_THRESHOLD`), 그때부터 `setPointerCapture`로 편곡 밖으로 나가도 계속 따라옵니다. 끄는 동안 커서는 `grabbing`.
- 클립·마커·버튼·오토메이션 위에서는 시작하지 않음 → 그것들은 각자 동작.

### 4.2 클립 옮기기 (`initClipDrag`)
- **가로:** `새 시작 = 처음 시작 + 움직인 거리 ÷ 1마디 폭`, 지금 격자 단계의 스냅 단위(§4.8, 기본 1마디 · 확대하면 1박 · 1/16)로 반올림, 0 ~ (999 − 길이) 안으로. 끄는 중 편곡이 자동 스크롤되면 그만큼도 더합니다.
- **세로로는 옮기지 않음** (수정 사항2): 클립은 자기 트랙 안에서 좌우로만 움직입니다 — Ableton 처럼 트랙이 악기·이펙트를 갖고, 클립은 그 트랙의 소리이기 때문. 다른 트랙에 넣으려면 목록에서 끌어 놓기(§4.3)나 복사·붙여넣기로.
- **가장자리:** 포인터가 편곡 칸 오른쪽 끝·트랙 머리 옆 40px 안에 오면 자동 스크롤.
- **클릭:** 4px 안 움직이고 떼면 그 클립만 선택(`.is-selected`). 끈 뒤 따라오는 click 은 막아 선택이 바뀌지 않게.
- 클립은 `--s`(시작 마디)만 바꿈.

### 4.3 목록 → 트랙 (`initListDrop`)
- 왼쪽 목록 항목에 `data-kind`(midi/audio) · `data-name` · `data-bars`(길이) 를 넣어 두었습니다. 누락 파일은 `draggable="false"`.
- HTML5 끌어 놓기: `dragstart`에서 정보를 담고, 트랙 위 `dragover`에서 종류가 맞으면 점선 클립(`.is-ghost`)으로 놓일 자리를 보여 줌 (1박 단위, 트랙 배경도 살짝 보라). `drop`하면 `createClip`으로 진짜 클립을 만들고 선택.
- 종류가 안 맞는 트랙 위에서는 놓을 수 없음 표시(브라우저 기본 금지 커서).

### 4.4 Samples ↔ Patterns (`initBrowserLists`)
패턴을 끌어 놓으려면 패턴 목록이 필요해서, 왼쪽 버튼 줄의 **Samples · Patterns** 두 버튼만 동작하게 했습니다. 제목·개수·검색 안내를 바꾸고, Patterns 에서는 샘플용 필터 칩을 숨김. 나머지 카테고리(Presets 등)는 `sequencer.js` `initRail`(템플릿)에서.

### 4.5 재생선 가리기 (CSS)
재생선(`#playhead`)은 편곡 안에서 `position: absolute`인데, 예전에는 `z-index: 5`로 트랙 머리(`sticky`, `z-index: 4`) **위**에 그려져서 편곡을 옮기면 머리 칸 위로 지나갔습니다. `z-index: 3`으로 내려 트랙 머리·트랙 펼침(`.sq-acc`도 `z-index: 4`로)·눈금 **아래**로 지나가게 했습니다. 머리 칸 배경이 불투명해서, 재생선이 머리 칸 오른쪽 끝보다 왼쪽에 오면 가려져 보이지 않습니다. JS 계산은 필요 없습니다.

### 4.6 재생 방식 고르기 · 재생선 움직이기
| 방식 | 버튼 (도구 막대) | VIEW 메뉴 | 재생 중 |
|---|---|---|---|
| `page` (기본) | ⇥ Playhead moves | Playback: playhead moves | 트랙은 그대로, 재생선이 오른쪽으로. 화면 오른쪽 끝을 넘으면 한 화면 넘김 (안 넘기면 재생선이 화면 밖으로 사라짐) |
| `scroll` | ⇆ Tracks move | Playback: tracks move | 재생선은 재생을 시작할 때의 화면 위치(안 보였으면 트랙 칸 1/3 지점)에 그대로, 트랙이 왼쪽으로. 곡 처음·끝처럼 더 스크롤할 수 없으면 재생선이 대신 움직임 |

- 고른 방식은 이 브라우저에 기억(`localStorage`의 `studionx.sequencer.follow`). 정식으로는 환경 설정(FR-2161)에 저장할 곳.
- 함수: `setFollowMode(mode)` · `getFollowMode()` · `setPlayheadBar(bar)` (export). 단축키·커맨드 팔레트(`runCommand('view.followPage')`)도 `setFollowMode`를 부르면 됩니다.
- **미리보기 재생 (소리 없음):** 소리 엔진이 아직 없어서 ▶ 를 누르면 상단 BPM 으로 `마디/초 = BPM ÷ 60 ÷ 4`(4/4) 만큼 재생선만 움직입니다 (`requestAnimationFrame`). ▶ 다시 → 일시정지, 재생 중 ■ → 시작한 자리로, 멈춘 상태에서 ■ → 곡 처음으로. 재생 중에는 `body.is-playing`이 붙어 Nyxi 가 춤춥니다.
- 소리 엔진을 만들면 미리보기 대신 엔진의 재생 위치를 `setPlayheadBar(bar)`로 넘기면 됩니다 (박자 변경점·템포 변경점도 엔진이 계산).

### 4.7 마커 끌기 (`initMarkerDrag`)
- 마커 줄의 마커(`.sq-marker`)를 왼쪽 버튼으로 끌면 좌우로 옮겨짐 — 클립과 같은 스냅, 0 ~ 999마디 안. 커서는 `ew-resize`.
- 4px 안 움직이고 떼면 클릭(마커 위치로 이동 — `sequencer.js` 몫), 끈 뒤의 click 은 막음.
- 옮기면 `onChange({ type: 'marker', marker, start })` → `PATCH /api/v1/markers/{id}`.

### 4.8 확대 · 축소 · 격자 (`initZoom`)
- **배율:** `.sq-lanes`의 `--sq-zoom` (1 = 1마디 1.8rem = 28.8px). CSS 는 `--sq-bar-w: max(1.8rem × 배율, 꽉 채우기 폭)` — 축소해도 화면보다 좁아지지 않음 (수정 사항 1번 유지). 범위 0.25 ~ 12배.
- **Ctrl+휠:** 휠 한 칸(deltaY 100)에 약 1.16배. 브라우저 확대는 `preventDefault`로 막음(`passive: false`). 노트북 터치패드의 두 손가락 벌리기도 Ctrl+휠로 들어와서 같이 됨.
- **기준점:** 마우스 아래에 있던 마디가 그 자리에 남도록 스크롤을 다시 맞춤 — `새 scrollLeft = 머리 폭 + 그 마디 × 새 1마디 폭 − 마우스 X`.
- **격자 단계** (`GRID_LEVELS`, 1마디 폭으로 고름 → `.sq-lanes[data-grid]`):

| 1마디 폭 | `data-grid` | 보이는 선 | 마디 번호 | 스냅 |
|---|---|---|---|---|
| 160px 이상 | `sixteenth` | 마디(진하게) · 박 · 1/16 | 1마디마다 | 1/16 |
| 56px 이상 | `beat` | 마디(진하게) · 박 | 1마디마다 | 1박 (1/4) |
| 24px 이상 | `bar` | 마디 | 2마디마다 | 1마디 |
| 12px 이상 | `bar` | 마디 | 4마디마다 | 1마디 |
| 그 아래 | `bar4` | 4마디마다 | 8마디마다 | 1마디 |

- 선은 처음에 CSS 배경 세 겹(`repeating-linear-gradient`)이었으나, 확대 때 흐려져서 canvas 로 바꿨습니다 (§4.11). 클립·마커·재생선·오토메이션 위치는 모두 `--sq-bar-w`를 쓰므로 함께 늘고 줄어듭니다.
- **스냅 = 보이는 선** (상단 "Snap: Line"): 클립 옮기기·목록에서 놓기·마커 끌기가 `getSnap()`으로 지금 단계의 단위를 씀. 그래서 확대할수록 더 잘게 옮길 수 있음. (그 전에는 늘 1박이었음)
- **줄자 숫자**는 단계가 바뀔 때 JS 가 다시 씀 (`renderRuler`, HTML 의 숫자는 처음 모양).
- VIEW 메뉴 `Zoom in` · `Zoom out` · `Zoom to fit`(`data-command="view.zoom*"`)도 연결. **Zoom to fit**(`zoomToContent`)은 999마디 전체가 아니라 클립·오토메이션·마커가 있는 곳까지(8마디 단위로 올림, 최소 32마디)를 한 화면에 맞춤 — 999마디를 다 넣으면 1마디가 1px 도 안 되기 때문. 창 크기가 바뀌면(`ResizeObserver`) 단계를 다시 계산.
- 함수: `setZoom(zoom, anchorX)` · `getZoom()` · `getSnap()` · `zoomToContent()` (export).

### 4.9 여러 클립 선택 (`initClipDrag`)
| 동작 | 결과 |
|---|---|
| 클릭 | 그 클립만 선택 |
| **Ctrl**(Mac ⌘)+클릭 | 선택에 넣기 / 이미 선택돼 있으면 빼기 |
| 선택된 클립을 끌기 | 선택된 클립이 **모두 같은 만큼** 옮겨짐 (서로 간격 유지) |
| 선택 안 된 클립을 끌기 | 그 클립만 선택하고 옮김 (Ctrl 을 누른 채면 선택에 더해 함께) |
| 트랙 빈 곳 클릭(끌지 않음) | 선택 모두 풀기 |
| Ctrl+A | 편곡의 클립 모두 선택 (입력칸에 커서가 있으면 원래대로 글자 선택) |

- 함께 옮길 때는 **잡은 클립**을 스냅에 맞춘 거리(delta)를 모두에게 더함. 맨 앞 클립이 0 아래로, 맨 뒤 클립이 999마디 너머로 가지 않게 delta 를 줄임 → 선택한 클립끼리 간격이 늘 그대로.
- 세로로는 여전히 옮기지 않음 (수정 사항2). 옮긴 클립마다 `onChange({ type: 'move' … })`.
- 선택된 클립은 `z-index: 1`로 겹친 클립 위에 보임.

### 4.10 셋잇단 격자 (`setTriplet`)
- 켜기: 상단 2줄 `Snap: Line` 옆 **`³ Triplet`** 버튼, 또는 OPTIONS › **Triplet grid** (둘이 같이 바뀜). `.sq-lanes[data-triplet]`.
- 확대 단계별:

| 단계 | 보통 | 셋잇단 |
|---|---|---|
| 마디 (`bar`, `bar4`) | 1마디 | 1마디 (그대로 — 박 선이 안 보이는 크기라) |
| 박 (`beat`) | 1/4 (4분) | **1/12** (8분 셋잇단, 1박 3칸) |
| 1/16 (`sixteenth`) | 1/16 | **1/24** (16분 셋잇단, 1박 6칸) |

- 격자: 가장 잘게 나누는 선의 칸 수를 보통 16 → 셋잇단 12 · 24 로 바꿈 (`drawGrid`). 박 선은 그대로 진하게 보여서 박 안이 3칸·6칸으로 나뉜 것이 보임.
- 스냅: `getSnap()`이 셋잇단이면 1/12 · 1/24 를 돌려줌 → 클립 옮기기 · 목록에서 놓기 · 마커 끌기 모두 따라감. `1/12 = 0.08333…` 처럼 길어지지 않게 소수 6자리로 정리.
- 마디 단계에서는 바뀌는 것이 없으니 확대(Ctrl+휠)해서 쓰는 기능 — 버튼 title 에 안내.
- 함수: `setTriplet(on)` · `isTriplet()` (export). 단축키(Ableton 은 Ctrl+3)는 브라우저 탭 전환과 겹쳐 넣지 않음.

### 4.11 격자 흐려짐 수정 (canvas)
**원인 두 가지**
1. 1마디 폭이 소수 px(예: 95.6px)라 박·1/16 선이 픽셀 사이에 놓임 → 브라우저가 1px 선을 두 픽셀에 나눠 칠해 흐려짐. 이것이 일정 간격으로 되풀이돼 "일정 부분만 흐린" 것처럼 보임.
2. 999마디를 확대하면 편곡 폭이 수십만 px 인데, CSS 반복 무늬(`repeating-linear-gradient`)를 이렇게 큰 영역에 그리면 시작점에서 멀어질수록 계산 오차로 선이 번질 수 있음.

**고친 방법**
- **1마디 폭을 정수 px 로** (`applyBarWidth`): JS 가 `round(28.8 × 배율)`(화면이 아주 넓으면 꽉 채우는 폭을 올림) 을 `.sq-lanes`의 `--sq-bar-w`에 직접 넣음. CSS 공식은 JS 가 돌기 전의 처음 모양용으로만 남음. 클립·마커·재생선·줄자 선이 모두 정수 마디 폭을 쓰게 됨.
- **격자는 canvas 에** (`drawGrid`): 트랙 칸의 CSS 배경 무늬를 없애고, 편곡 스크롤 칸 바로 뒤에 화면 크기만 한 `<canvas id="grid-canvas">`(z 0)를 깔아 **지금 보이는 부분의 선만** 그림. 선 위치는 `Math.round(x × devicePixelRatio)`로 정수 픽셀 → 늘 또렷. 편곡 폭이 아무리 커도 canvas 는 화면 크기라 오차가 없음.
- 세로로는 트랙 클립 칸(`.sq-track__lane`)이 있는 줄에만 그림 → ＋ Add Track 아래 빈 칸 · 트랙 펼침 · 눈금에는 선이 없음. 트랙 머리·눈금·펼침은 불투명해서 canvas 위를 덮음.
- 단계별 선과 색은 §4.8 표 그대로 (마디 단계: 마디 선, 박: 마디 진하게 + 박, 1/16: 마디 · 박 · 1/16, 셋잇단이면 가장 잘게 나눈 선이 12 · 24 칸).
- **다시 그리는 때:** 스크롤(`scroll`), 확대·축소, 셋잇단 켜고 끄기, 트랙 높이 변화(펼침·그룹 접기·아래 칸 — `ResizeObserver`), 창 크기, 테마 바뀜. `requestAnimationFrame`으로 모아서 한 화면에 한 번만.
- 함수: `requestGrid()` · `drawGrid()` · `applyBarWidth()` (모듈 안).

### 4.12 도구 · 영역 선택 (`setTool` · `initMarquee`)
- 도구 막대 버튼에 `data-tool`(draw · paint · delete · mute · slip · slice · select · zoom)을 넣고, 누르면 그 도구만 `aria-pressed="true"`, 힌트 바 문구도 바뀜. 지금 동작이 다른 도구는 **Select** 뿐 (나머지 도구 동작은 `sequencer.js` 구현 때).
- **Select(E) 도구일 때만** 트랙 빈 곳을 끌면 사각형(`.sq-marquee`)이 그려지고, 사각형에 **조금이라도 걸친** 클립이 선택됨. Ctrl 을 누르고 끌면 원래 선택에 더함. 그냥 클릭하면 선택 풀기. 여러 트랙에 걸쳐도 됨, 가장자리에서 자동 스크롤.
- 이때 빈 곳 끌기는 좌우 이동을 하지 않음 → 좌우 이동은 마디 줄 · 마커 줄 끌기, 가운데 버튼, 스크롤 바로. 다른 도구에서는 예전처럼 빈 곳 끌기 = 좌우 이동.
- 선택된 클립 끌기 = 함께 옮기기(§4.9)는 도구와 상관없이 그대로.
- 편곡 영역은 끌기 동작이 많아 글자 선택을 막음(`user-select: none`, 입력칸 제외) — 끌 때 트랙 이름이 파랗게 선택되던 것 수정.

### 4.13 격자 무시 (`setSnapMode` · Alt)
- **Alt 를 누른 채 끌기** → 그 끌기만 격자 무시. 클립 옮기기 · 목록에서 놓기 · 마커 끌기 · Loop 그리기 모두.
- **상단 `Snap: Line ▾` → Off** → 계속 격자 무시 (`Snap: Off ▾`로 바뀜). 메뉴 바깥 클릭 · Esc 로 닫힘.
- 격자를 무시해도 **1틱**(PPQ 960 → 1마디 = 3840틱) 단위로는 맞춤 → DB 의 tick 값과 딱 맞아떨어짐.
- 함수: `setSnapMode('line' | 'off')` · `getSnapMode()`.

### 4.14 Loop (`setLoop` · `initLoop`)
- **마커 줄에서 마우스 오른쪽 버튼을 누른 채 끌기** → 누른 곳 ~ 지금 위치가 Loop 구간 (스냅 · Alt 적용, 최소 한 칸). 그리면 Loop 가 켜짐. 마커 줄의 오른쪽 클릭 메뉴는 막음.
- 상단 재생 버튼 옆 **⟲** 버튼으로 켜고 끄기. 켜면 눈금 위 띠(`#loop`)가 보라로 진해지고 트랙 위에 옅은 보라(격자 canvas 가 그림), 끄면 띠가 흐려짐.
- 켜져 있으면 미리보기 재생이 구간 끝에서 구간 처음으로 돌아감 (구간보다 뒤에서 재생을 시작하면 그대로 진행).
- 바꾸면 `onChange({ type: 'loop', start, length, on })` → 프로젝트 설정에 저장할 곳.
- 함수: `setLoop({ start, length, on })` · `getLoop()`.

### 4.15 트랙 높이 (`initTrackHeight`)
| 동작 | 결과 |
|---|---|
| 트랙 **아래 경계**(트랙 머리 · 클립 칸 어디든, 6px)를 끌기 | 그 트랙만 높이 바뀜 (커서 ↕) |
| **Alt**+경계 끌기 | 모든 트랙이 같은 높이로 (트랙마다 따로 정한 높이는 지움) |
| 경계 **더블 클릭** | 그 트랙을 기본(전체) 높이로 |
| 도구 막대 **↕− / ↕+** | 전체 높이를 한 단계 (28 · 36 · 44 · 56 · 72 · 96 · 128 · 160 · 200px) |
| VIEW › Taller tracks · Shorter tracks · Reset track heights | 위와 같음, Reset 은 처음 높이(44px) |

- 높이는 CSS 변수 `--sq-row-h`: 전체는 `.sq-lanes`에, 한 트랙은 그 `.sq-track`에 (한 트랙 값이 이김). 28 ~ 200px.
- 손잡이는 `.sq-track::after`(아래 경계 6px, 트랙 머리 위까지 덮도록 z 5). 거기를 누르면 이벤트 target 이 트랙 자신이라 클립·빈 곳 동작과 겹치지 않음.
- 38px 보다 낮으면 `.is-compact` — 악기 이름 줄을 숨기고 버튼을 줄임.
- 클립은 트랙 높이에 맞춰 늘고 줄며, 격자는 높이가 바뀔 때 다시 그림(`ResizeObserver`).
- 바꾸면 `onChange({ type: 'trackHeight', trackId, height })` 또는 `{ type: 'trackHeight', all: true, height }` → 트랙 설정 · 사용자 보기 설정에 저장할 곳.
- 더블 클릭: 끌기 때 포인터를 편곡 영역에 붙잡아서 dblclick 의 target 이 편곡 영역이 됨 → 더블 클릭한 y 위치로 트랙을 찾음 (처음 시험에서 안 되던 것 수정).
- 함수: `setTrackHeight(track, px | null)` · `setAllTrackHeights(px)` (export).

### 4.16 피아노롤 (`sequencer-roll.js`)
**열기 · 닫기:** 편곡에서 MIDI 클립을 **더블 클릭** → 아래 칸에 피아노롤(제목 · 트랙 이름이 그 클립으로). ✕ 나 Esc 로 닫기. (아래 칸 패널 전환은 원래 `sequencer.js` `openBottom` 몫이라, 지금은 피아노롤 열기만 이 모듈이 함 — 노트도 아직 예시 패턴 하나)

**노트 데이터 → 위치:** HTML 노트는 `data-pitch`(MIDI, 60 = C4) · `data-start` · `data-length`(마디, 패턴 처음 기준) · `data-vel`. JS 가 CSS 변수 `--ns`(시작) · `--nr`(줄 = 가장 높은 음 − 음높이) · `--nl`(길이) 로 바꾸고, CSS 가 `× --roll-bar-w`, `× --roll-row-h` 로 자리를 잡음 → 확대·높이를 바꿔도 변수 두 개만 바꾸면 됨. 건반 범위 C1(24) ~ C8(108), 피아노롤 길이 8마디(패턴 4마디 뒤는 어둡게 + 보라 선).

**가로 확대 · 축소 — 편곡과 같은 방법 (§4.8)**
- Ctrl+휠, 마우스 아래 박자가 제자리, 1마디 폭은 **정수 px**, 축소는 피아노롤 칸을 꽉 채우는 데까지 (1 = 1마디 160px, 0.1 ~ 8배).
- 마디 줄을 끌면 좌우 이동. 그냥 휠 = 세로(음높이) 스크롤.
- **Shift+휠 = 전체 확대·축소** (사용자 요청): 가로 마디 폭과 세로 노트(건반 줄) 높이를 **같은 비율**로 함께. 마우스 아래 박자 · 음높이가 제자리. 가로는 꽉 채우기에서, 세로는 6 ~ 32px 에서 멈춤. Windows 브라우저는 Shift+휠을 가로 스크롤로 바꿔 `deltaX`로 보내서 `deltaY || deltaX` 를 씀. 줄 높이는 정수로 반올림되므로 소수 값(`rowHf`)을 따로 두어 여러 번 굴려도 비율이 어긋나지 않게 함.

**격자 — 편곡과 같은 규칙**
- 편곡 모듈의 `gridLevelFor(1마디 폭)` · `gridLayers(단계, 셋잇단)` · `snapUnitFor(단계, Alt)` 를 그대로 씀 → 마디 · 박 · 1/16 단계, 셋잇단(1/12 · 1/24), Snap Line/Off, Alt 끌기가 편곡과 똑같이 동작. 상단 `³ Triplet` · `Snap ▾` 을 바꾸면 `sq:grid-settings` 이벤트로 피아노롤 격자도 다시 그림.
- 선은 canvas 에 정수 픽셀로 (§4.11 과 같은 방식) — 세로선 + 가로 줄 선 · 검은 건반 줄 음영 · 옥타브(C) 줄은 진하게.

**높이 — 모든 노트(건반 줄) 함께만** (노트 하나씩은 없음)
- 피아노롤 머리줄 **↕− / ↕+** (6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32px) — 화면 가운데 음높이가 제자리.
- **건반 줄 경계**(위아래 3px, 커서 ↕)를 끌기 — 끈 경계가 포인터를 따라오도록 모든 줄 높이를 바꿈 (`줄 높이 = (포인터 − 건반 맨 위) ÷ 경계까지 줄 수`). 트랙 높이 끌기와 같은 느낌.
- 줄이 9px 보다 낮으면 건반의 C 이름을 숨김.

**노트 편집**
| 동작 | 결과 |
|---|---|
| 빈 곳 클릭 | 포인터가 있는 칸의 시작에 노트 찍기 (길이 = 마지막으로 찍거나 늘린 길이, 처음 1박). 누른 채 끌면 바로 옮김 |
| 노트 끌기 | 가로는 스냅, 세로는 음높이(줄) 단위. 선택된 노트가 여럿이면 함께 |
| 노트 오른쪽 끝(5px) 끌기 | 길이 (최소 한 칸) |
| 노트 오른쪽 클릭 | 지우기 |
| Ctrl+클릭 | 여러 선택 / 빼기 |
| Alt 를 누른 채 | 격자 무시 (1틱) |

- 흐린 노트(`.is-ghost`, 다른 트랙 노트)는 누를 수 없음. 벨로시티 줄은 노트 위치에 맞춰 다시 그리고 피아노롤 가로 스크롤을 따라감. 왼쪽 `Selected note` 에 선택한 노트 이름 · 벨로시티.
- 바꾸면 `onChange({ type: 'add' | 'move' | 'resize' | 'delete', note, pitch, start, length })` → `PUT /patterns/{id}/notes` 로 저장할 곳 (start · length 는 마디 → tick 으로).
- 함수: `initRoll` · `openRoll(clip)` · `closeRoll()` · `setRollZoom(zoom, anchorX)` · `setRollRowHeight(px, anchorY)` · `noteName(pitch)` (export).
- 시험 중 고친 것: 처음 시험에서 노트 찍기 · 길이가 안 된 것처럼 보였는데, 스크립트가 화면 밖 음높이를 눌렀거나 같은 음높이의 흐린 노트를 잡은 탓 — 코드 문제 아님.

### 4.17 오토메이션 편집 (`sequencer-automation.js`)
**모드:** 도구 막대 **⤴ Automation A** · **A 키**(입력칸 밖, 수식키 없이) · VIEW › Automation mode 로 켜고 끄기 (`setAutomationMode`). 켜면 `body.is-automation` — 패턴 25% 흐림 + **누를 수 없음**(곡선만 편집), 오토메이션 클립 · 템포/박자 줄이 보이고 힌트 바가 사용법으로 바뀜. (`sequencer.js`의 `setAutomationMode` 템플릿 자리를 이 모듈이 대신함)

**데이터:** 오토메이션 클립(`.sq-auto`)의 `data-points` = `[[시간, 값, 곡선], …]` — 시간은 클립 처음 기준 마디, 값 0~1(정식으로는 파라미터 실제 단위로 바꿔 저장, FR-2108), 곡선은 **다음 점까지** 휘는 정도 −1~1(0 = 직선) → DB `automation_points(time, value, curve)`와 같은 모양.

**그리기:** 구간마다 24조각으로 곡선을 SVG(`viewBox 0~100`, 선 두께는 안 늘어남)로, 아래는 옅은 채움. 점(`.sq-apt`)과 ↕(`.sq-acurve`)는 % 위치의 HTML 이라 확대 · 트랙 높이를 바꿔도 모양이 안 찌그러짐. 구간이 22px 보다 좁거나 평평하면(곡선이 의미 없음) ↕ 를 숨김.

| 동작 | 결과 |
|---|---|
| 클립 빈 곳 클릭 | 그 시간(격자 스냅 · Alt 무시) · 값에 점. 그 구간은 둘로 나뉘고 새 두 구간은 직선부터 |
| 점 끌기 | 시간 · 값 — 앞뒤 점 사이에서만, 처음 · 끝 점은 시간 고정(값만). 끄는 동안 값 % 표시 |
| 점 더블 클릭 | 지우기 (처음 · 끝 점 제외) |
| **↕ 를 누른 채 위아래로 끌기** | 곡선 — 손잡이(구간 가운데)가 포인터 높이를 따라가도록 curve 를 계산. 위 = 가운데가 직선보다 위(올라가는 구간은 볼록), 아래 = 반대. 끄는 동안 `curve +0.68` 표시 |
| ↕ 더블 클릭 | 다시 직선(0) |

**곡선 식:** `g(x) = (e^(a·x) − 1) / (e^a − 1)`, `a = −curve × 6 × (올라가면 1, 내려가면 −1)`. ↕ 를 끌 때는 가운데 `g(0.5) = 1 / (e^(a/2) + 1)` 이 포인터 위치가 되도록 a 를 바로 풀어서 curve 를 구함 → 손잡이가 정확히 포인터를 따라감. 재생 때 소리에 적용하는 것(Web Audio `setValueCurveAtTime` 등)은 소리 엔진 몫(FR-2105).

- 바꾸면 `onChange({ type: 'automation', clip, points })`, 모드는 `{ type: 'automationMode', on }`.
- 아직 안 한 것: 오토메이션 클립 끌어 옮기기 · 다음 패턴 시작에서 멈춤(`dragAutomation`), 겹침 창 처리(`askAutomationOverlap`), 템포 · 박자 점 편집(`renderGlobalLanes`) — `sequencer.js` 템플릿 그대로.

### 4.18 지우기 (Delete · Backspace)
| 어디 | 고르기 | 지우기 |
|---|---|---|
| 편곡 클립(패턴 · 샘플) | 클릭 · Ctrl+클릭 · Select(E) 영역 · Ctrl+A | **Delete** 또는 **Backspace** · EDIT › Delete |
| 피아노롤 노트 | 클릭 · Ctrl+클릭 | 같음 (노트는 오른쪽 클릭으로도 하나씩) |

- **어느 쪽을 지울지:** 마지막으로 누른 곳 — 편곡 칸을 눌렀으면 클립, 피아노롤 안을 눌렀으면 노트 (`body[data-focus-area]`, `pointerdown` 을 capture 단계에서 기록). 피아노롤을 열 때 더블 클릭한 클립이 선택된 채라도, 노트를 누른 뒤에는 노트만 지워짐.
- 입력칸(검색 · 채팅 · 숫자)에서는 글자만 지움. Ctrl · Alt 와 같이 누르면 안 지움. 오토메이션 모드에서는 클립을 지우지 않음.
- 지울 때마다 `onChange({ type: 'delete', … })` — 편곡은 `clip, trackId, start, length`, 피아노롤은 `note, pitch, start, length`.
- Draw 도구 힌트 바도 `Select and press Delete to remove`로 바꿈 (언어 사전 포함).
- 함수: `deleteSelectedClips()` · `deleteSelectedNotes()` · `isDeleteKey(e)` · `focusArea()` (export).

| 시험 | 결과 |
|---|---|
| Drums 클릭 · Chords Ctrl+클릭 → Delete | 클립 20 → 18, 둘 다 없어짐 |
| Lead #2 더블 클릭(피아노롤 열림, 클립 선택된 채) → 노트 E4 클릭 · D#4 Ctrl+클릭 → Backspace | 노트 8 → 6, **Lead #2 클립은 그대로** |
| 편곡의 Pad 클릭 → Delete (피아노롤 열린 채) | Pad 클립만 지워짐, 노트 그대로 |
| Bass 선택 후 검색칸에서 Backspace | 검색 글자만 지워짐 (`abc` → `ab`), Bass 그대로 |

### 4.19 목록에서 놓아 새 트랙 만들기
| 어디에 놓나 | 결과 |
|---|---|
| 같은 종류 트랙 (샘플 → 오디오, 패턴 → MIDI) | 그 트랙에 클립 (예전과 같음) |
| **빈 곳** (＋ Add Track 줄 · 그 아래 빈 칸) | 끌어 올리면 놓일 자리에 `＋ New audio track — “kick_808_punch” at bar 4` 안내 상자 → 놓으면 **맨 끝에 새 트랙**(샘플 = 오디오, 패턴 = MIDI)과 클립 |
| **종류가 다른 트랙** (샘플 → MIDI 트랙, 패턴 → 오디오 트랙) | 점선이 **주황**으로 → 놓으면 묻는 창 `Create a new audio(MIDI) track?` → **만들기**면 그 트랙 **바로 아래**(펼침이 열려 있으면 펼침 아래)에 새 트랙과 클립, **취소**면 아무것도 안 함 |
| 그룹 · 리턴 · MASTER | 놓을 수 없음 (예전과 같음) |

- 새 트랙 이름 = 끈 항목 이름(`kick_808_punch`, `Bass`), 색 = 오디오는 오디오 색 · MIDI 는 패턴 색. MIDI 트랙 악기 칸은 `No instrument`.
- **번호 = 위치** (사용자 결정): 트랙을 넣으면 `renumberTracks()`가 위에서부터 1, 2, 3 … 으로 다시 매김(그룹 트랙은 번호 없음). 번호를 가리키는 표시도 같이 바꿈 — 이름 옆 `⇠10` · `→1`, 악기 스택의 `<from Track 10>`, 레이어 트랙의 `Track 1 › Instruments` · OFF 덮개, Connect to Another 트랙 번호 칸, 믹서 줄 이름, 피아노롤 트랙 이름. 한 번에 바꿔서(옛 번호 → 새 번호 표) 겹쳐 바뀌지 않음. 바뀌면 `onChange({ type: 'renumber', map: { 옛: 새 } })` — DB 의 트랙 순서(`position`)로 저장할 곳.
- 클립 위치는 놓은 곳(격자 스냅, Alt 무시). 새 클립만 선택됨.
- `onChange({ type: 'createTrack', track, kind, trackId })` 다음에 `{ type: 'create', … }` → `POST /tracks` 후 `POST /clips` 로 저장할 곳.
- 함수: `createTrack({ kind, name, color })` (export), 묻는 창은 `dialog#track-kind-ask`.

| 시험 | 결과 |
|---|---|
| kick 샘플 → 빈 칸 3.4마디 | 안내 상자 `at bar 4` → `11. kick_808_punch`[오디오] 맨 끝, 클립 3마디 |
| Bass 패턴 → ＋ Add Track 줄 | `12. Bass`[MIDI] 맨 끝 |
| Lead 패턴 → 8. Vocal(오디오) | 주황 점선 → 창 `Create a new MIDI track?` → 만들기 → `13. Lead`[MIDI]가 8. Vocal 바로 아래 |
| snare 샘플 → 3. Drums(MIDI) → 취소 | 트랙 그대로 |
| 같은 끌기 → 만들기 | `14. snare_tight_02`[오디오]가 3. Drums 바로 아래, 클립 2마디 |

번호 다시 매기기 (위 시험을 다시):

| 시험 | 트랙 번호 · 연결 표시 |
|---|---|
| Lead 를 8. Vocal 아래에 | `8. Vocal · 9. Lead · 10. Riser · 11. Lead Hi …` |
| snare 를 3. Drums 아래에 | `3. Drums · 4. snare_tight_02 · 5. Chords … 9. Vocal · 10. Lead · 11. Riser · 12. Lead Hi …` |
| 연결 표시 | 1. Lead 의 `+1·⇠10` → `+1·⇠12`, 악기 스택 `<from Track 10>` → `<from Track 12>`, 믹서 `8. Vocal` → `9. Vocal`. 1번을 가리키는 `→1` · `Track 1 › Instruments` · 번호 칸 `1` 은 그대로 |

![빈 칸에 끌어 올리면 놓일 자리에 새 트랙 안내](images/30_sequencer_arrange_drag/40_drop_new_track.png)

![패턴을 오디오 트랙에 놓았을 때 묻는 창](images/30_sequencer_arrange_drag/41_ask_new_track.png)

## 5. 저장 연결 (직접 구현할 곳)
```js
initArrange({ onChange: (change) => { … } });
// change = { type: 'move' | 'create' | 'createTrack' | 'delete' | 'marker' | 'loop' | 'trackHeight', clip | marker, trackId, start, length, on, height, all }  (start · length 는 마디, height 는 px)
```
- `move` → `PATCH /api/v1/clips/{id}` (`start_tick = start × 960 × 박자 분자`) — 트랙은 바뀌지 않음
- `create` → `POST /api/v1/clips` (패턴이면 `pattern_id`, 샘플이면 `sample_id`) → 응답의 id 를 `clip.dataset.clipId`에
- 실패하면 클립을 원래 자리로 되돌리기

## 6. 만들면서 고친 것
| 문제 | 원인 | 해결 |
|---|---|---|
| 재생선이 트랙 머리 칸 위로 지나감 (수정 사항2) | 재생선 `z-index: 5` > 트랙 머리 `4` | 재생선 `3`, 트랙 펼침도 `4` |
| Patterns 목록에서도 필터 칩이 보임 | `.sq-filters { display: flex }`가 `hidden` 속성을 덮음 | `.sq-filters[hidden] { display: none }` |
| (시험) 클립 옮기기가 안 되는 것처럼 보임 | 앞 시험에서 편곡을 옮겨 둬서 클립이 트랙 머리 뒤에 숨어 있었음 — 코드 문제 아님 | 시험 전에 스크롤을 0 으로 |
