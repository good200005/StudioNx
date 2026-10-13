# Studio Nx — 시퀀서 기능 보강 후보 (매뉴얼 대조)

| 항목 | 내용 |
|---|---|
| 목적 | DAW 의 기본 기능 중 Studio Nx 시퀀서 기획(PRD 02)에 **빠진 것**을 정리 |
| 대조한 자료 | [Ableton Live 12 Manual](https://www.ableton.com/en/live-manual/12/welcome-to-live/) (43장) · [FL Studio Online Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual) (Playlist · Piano roll · Channel Rack · Mixer) |
| 비교 대상 | [PRD 02](PRD/02_Phase2_Sequencer_Core.md) FR-201 ~ FR-2202 · [DB.md](DB.md) · [Sequencer_Layout_Mockup.md](Sequencer_Layout_Mockup.md) |
| 작성일 | 2026-10-05 |
| 상태 | **A · B 반영 완료 (2026-10-06)** — PRD 02 §4.18 FR-2211~2230, PRD 03 FR-315, DB (42개 테이블). C 는 범위 밖 (C1 MPE 는 추후) |

---

## 1. 한눈에
| 구분 | 개수 | 뜻 |
|---|---|---|
| **A. 기본인데 빠진 것** | 14 | DAW 라면 거의 다 있는 기능. 넣는 것을 추천 |
| **B. 있으면 좋은 것** | 7 | 쓰는 사람은 많지만 없어도 곡은 만들 수 있음 |
| **C. 일부러 빼도 되는 것** | 8 | 웹 DAW 첫 버전에는 과함 |

> 결정 (2026-10-06): **A · B 모두 넣음** — A 의 1~5 · 7~10 · 14 필수, A 의 6 · 11~13 권장, B 권장(B4 추후). C 는 범위 밖, **C1 MPE 는 추후** (피아노에 필요한 서스테인 페달·릴리즈 벨로시티는 A10 에 포함).

## 2. A. 기본인데 빠진 것
| # | 기능 | 한 줄 설명 | 매뉴얼 근거 | 예전 상태 | DB 반영 | PRD |
|---|---|---|---|---|---|---|
| A1 | **그룹(폴더) 트랙** | 여러 트랙을 한 묶음으로 접고, 묶음째 M/S·볼륨 조절 | Ableton Group Tracks · FL Track grouping | 없음 | `tracks.parent_track_id` | FR-2211 |
| A2 | **센드 / 리턴 트랙** | 리버브·딜레이 하나를 여러 트랙이 나눠 씀. 트랙마다 보내는 양 조절 | Ableton Return Tracks · FL Send | Connect to Another 는 한 곳만이라 부족 | `track_sends` 표, 트랙 종류 `RETURN` | FR-2212 |
| A3 | **오디오 클립 페이드·크로스페이드** | 클립 앞뒤를 부드럽게, 겹친 클립은 자연스럽게 이어짐 | Ableton Fades and Crossfades · FL Fade | 목업(샘플 설정)에만 있음 | `clips` 페이드 길이·곡선 | FR-2213 |
| A4 | **Warp · 음정 · 거꾸로 · 노멀라이즈** | 샘플을 곡 BPM 에 맞게 늘이고 줄임(템포 변경 대응), 음 높이·방향·크기 조절 | Ableton Warping · FL Time-stretch | 목업에만 있음 | `clips` warp 모드·마커, pitch, reverse | FR-2214 |
| A5 | **마커 (Intro · Drop …)** | 곡 구간 이름 표시, 클릭해서 그 위치로 이동 | Ableton Locators · FL Time markers | 목업에만 있음 | `markers` 표 | FR-2215 |
| A6 | **시간 삽입 · 삭제 · 복제** | 구간을 통째로 비우거나 지우면 뒤 내용이 당겨지거나 밀림 | Ableton …Time commands · FL Insert/Delete space | 없음 | 없음 | FR-2216 |
| A7 | **바운스 / 프리즈** | 트랙을 오디오로 굳혀 CPU 를 아낌 (웹이라 특히 중요) | Ableton Bounce to Audio · FL Consolidate | 없음 | 결과는 `samples`, 트랙 프리즈 상태 | FR-2217 |
| A8 | **플러그인 지연 보정 (PDC)** | 지연이 있는 플러그인(리미터·WASM) 때문에 트랙끼리 박자가 어긋나는 것 방지 | Ableton Device Delay Compensation | 없음 | 없음 (WASM 인터페이스가 지연값 보고) | FR-2218 |
| A9 | **피아노롤 기본 명령** | 옮기기(옥타브), 노트 뮤트, 자르기·붙이기, 레가토, 휴머나이즈, 퀀타이즈 강도, 거꾸로·뒤집기 | Ableton Editing MIDI · FL Piano roll Tools | 퀀타이즈(권장)만 | `midi_notes.is_muted` | FR-2219 |
| A10 | **CC · 피치벤드 · 서스테인 페달** | 건반의 페달·휠 움직임까지 녹음하고 편집 | Ableton MIDI Controller Envelopes · FL Event editor | 노트만 녹음 | `midi_cc_events` 표 | FR-2220 |
| A11 | **녹음 옵션** | 펀치 인/아웃(구간만 녹음), 녹음하면서 퀀타이즈, 덮어쓰기/합치기(overdub) | Ableton Recording · FL Punch markers | 카운트인만 | 없음 | FR-2221 |
| A12 | **오토메이션 녹음** | 재생 중 노브를 움직이면 그대로 기록 | Ableton Automation Arm | 손으로 덮어쓰기(override)만 | 없음 | FR-2222 |
| A13 | **스윙 / 그루브** | 박자를 살짝 밀어 사람 느낌 내기 | Ableton Groove Pool · FL Swing | 없음 | `patterns.swing` | FR-2223 |
| A14 | **복사·붙여넣기 · 시간 범위 선택 · 재생 따라 스크롤** | 여러 트랙 구간 선택 후 복사, 재생 위치를 따라 화면 이동(Follow) | 두 매뉴얼 공통 | 복제만 | 없음 | FR-2224 |

## 3. B. 있으면 좋은 것
| # | 기능 | 한 줄 설명 | 매뉴얼 근거 | 비고 · PRD |
|---|---|---|---|---|
| B1 | **MIDI 이펙트** | Arpeggiator · Chord · Scale · Velocity · Random — 노트를 자동으로 바꿔 줌 | Ableton MIDI Effect Reference · FL Arpeggiator | EDM 에서 아르페지에이터 자주 씀 → FR-2225 |
| B2 | **모든 트랙 흐린 노트(ghost)** | 피아노롤에 다른 트랙·패턴 노트를 흐리게 겹쳐 보기 | FL Ghost channels · Ableton Multi-clip editing | 지금은 레이어 트랙에만 (FR-2198) → FR-2226 |
| B3 | **노트 확률 · 벨로시티 랜덤** | 재생할 때마다 노트가 날지 말지, 세기가 조금씩 다르게 | Ableton Chance · Velocity Deviation | → FR-2227 |
| B4 | **샘플 → MIDI 변환** | 샘플을 조각 내 패드에 배치, 멜로디·드럼을 노트로 추출 | Ableton Converting Audio to MIDI · FL Slicex | Phase 4 AI 분리와 연결 → FR-2228 (추후) |
| B5 | **오디오 퀀타이즈 · 리샘플링** | 오디오 타이밍을 그리드에 맞춤 / 마스터 소리를 트랙에 녹음 | Ableton Warping · Routing (Resampling) | → FR-2229 |
| B6 | **트랙별 따로 출력 (stems)** | 트랙마다 별도 파일로 내보내기 | Ableton Export · FL Split mixer tracks | 지금 PRD 03 은 전체 믹스다운만 → PRD 03 FR-315 |
| B7 | **누락 파일 찾기 · 안 쓰는 샘플 정리** | 지워진 샘플을 다시 연결, 프로젝트에서 안 쓰는 샘플 표시 | Ableton Managing Files and Sets | 저장 용량 관리와 연결 → FR-2230 |

## 4. C. 일부러 빼도 되는 것
| # | 기능 | 빼는 이유 |
|---|---|---|
| C1 | MPE (노트마다 음정·압력 따로) | **추후** — Roli Seaboard·LinnStrument 같은 MPE 건반이 있어야 의미 있음. 피아노 표현(서스테인·소프트 페달, 릴리즈 벨로시티)은 A10 으로 충분 |
| C2 | 튜닝 시스템 (12평균율 밖) | 일부 장르 전용 |
| C3 | Max for Live · 사용자 장치 만들기 | 웹에서는 별도 개발 환경이 필요 |
| C4 | Push · 외부 컨트롤러 매핑 | 장비 의존. Web MIDI 노트 입력(FR-234)으로 충분 |
| C5 | 비디오 불러오기 · 영상 맞추기 | 음악 제작 범위 밖 |
| C6 | Link · MIDI 클록 동기화 | 다른 기기·앱과 합주할 때만 필요 |
| C7 | 크로스페이더 | DJ 공연용 |
| C8 | 여러 버전 편곡 (FL Arrangements) | 스냅샷(Phase 6)으로 대신 |

## 5. 참고 — 이미 다른 곳에 있는 것
| 기능 | 위치 |
|---|---|
| 곡 중간 템포·박자 변경 | PRD 02 FR-202a (2026-10-05 추가) |
| 테이크 여러 개 · 컴핑 | PRD 02 FR-2125 (추후) |
| 악기 분리 (stem separation) | PRD 04 |
| 오디오 출력 (WAV · MP3 · FLAC) | PRD 03 |
| 사이드체인 | Connect to Another (FR-2197) |
