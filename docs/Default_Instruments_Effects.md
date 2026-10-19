# Studio Nx — 기본 악기와 이펙트 결정

| 항목 | 내용 |
|---|---|
| 기준 문서 | [PRD 02](PRD/02_Phase2_Sequencer_Core.md) FR-242, FR-243, FR-247, [Implementation_Plan.md](Implementation_Plan.md) S1-09, S1-11, S2-03 |
| 작성 | Claude (AI), 2026-10-19, 사용자 검토 |
| 목적 | 시퀀서에 처음 넣을 기본 악기와 이펙트를 Ableton Live와 FL Studio의 공통점을 근거로 정합니다 |
| 상태 | 1단계 구성 확정, Sampler One-Shot 모드만 보류 |

---

## 1. 배경
S1-11(WAV 출력)을 시작하기 전에 현재 소리 경로를 확인했더니, 시퀀서 화면에서는 소리가 나지 않았습니다. 악기와 이펙트는 값을 저장하는 화면과 데이터까지만 구현되어 있습니다. 출력 결과가 시퀀서에서 들리는 소리와 같아야 하므로(PRD 03 §1), 어떤 악기와 이펙트를 먼저 소리 나게 할지 정해야 합니다.

### 1.1 현재 상태
| 항목 | 상태 | 근거 |
|---|---|---|
| tick 스케줄러와 메트로놈 | 라이브러리로만 있으며 어떤 페이지도 가져다 쓰지 않습니다 | `audio/engine.js`, `audio/scheduler.js` |
| 재생 버튼 | 재생선만 움직이고 오디오는 나오지 않습니다 | `sequencer-arrange.js:1349-1372` |
| 클립과 노트 재생 | 구현되어 있지 않습니다 | `onStep`에 연결된 코드가 없습니다 |
| 오디오 노드 생성 | 메트로놈 클릭용 `createOscillator`, `createGain` 두 곳뿐입니다 | `audio/engine.js:20-21` |
| 트랙 볼륨, 팬, 뮤트, 솔로 | 화면과 서버 저장만 있고 소리에는 반영되지 않습니다 | `sequencer-devices.js` |
| 미터 | `Math.random()`으로 흉내 낸 값입니다 | `sequencer-devices.js:2132-2155` |
| 플러그인 시드 | 7종이 DB에 등록되어 있고 파라미터 화면은 `param_schema`로 자동 생성됩니다 | `studionx/db/02_phase2_sequencer.sql` |

### 1.2 계획서에서 비어 있던 부분
S1-05 문서는 악기 소리를 얹는 일을 "S1-07 이후"로 미뤘고, S1-09 문서는 소리와 미터를 "다음 작업"으로 미뤘습니다. 그런데 `Implementation_Plan.md`의 어느 작업도 재생 오디오 그래프를 맡고 있지 않습니다.

## 2. 조사 방법과 한계
| 대상 | 읽은 곳 | 한계 |
|---|---|---|
| Ableton Live | Live 12 매뉴얼의 Instrument Reference와 Audio Effect Reference(ableton.com) | 요청한 `help.ableton.com`은 403이어서 같은 매뉴얼의 공식 판을 읽었습니다. 각 장의 끝부분 약 4만 자는 읽지 못했습니다 |
| FL Studio | 에디션 비교 페이지와 기능 소개 페이지(image-line.com) | 온라인 매뉴얼 본문이 403이어서 플러그인 이름과 짧은 설명만 확인했고 파라미터는 확인하지 못했습니다 |

- Playwright가 설치되어 있지 않아 WebFetch로 읽었습니다.
- 내용은 요약 모델을 거친 것이므로, 구현 전에 필요한 파라미터는 다시 확인해야 합니다.

## 3. 두 DAW의 기본 악기
| 유형 | Ableton Live | FL Studio | 우리 시드 |
|---|---|---|---|
| 감산 신스 | Analog, Drift | 3x OSC, MiniSynth, SimSynth | Subtractive Synth가 있습니다 |
| 멜로디 샘플러 | Simpler, Sampler | Channel Sampler, DirectWave Player | Sampler가 있습니다 |
| 드럼 원샷, 패드 | Drum Sampler, Impulse, Drum Rack | Fruity Pad Controller(FPC), Drumpad, BassDrum, Fruity Kick | Sampler로 대신하고 Drum Rack은 S3-12로 미뤘습니다 |
| FM 신스 | Operator | Sytrus, Fruity DX10 | 없습니다 |
| 웨이브테이블 | Wavetable | Harmor (상위 에디션) | 없습니다 |
| 물리 모델링 | Tension, Collision, Electric | Sakura, Plucked!, FL Keys | 없습니다 |

- 두 DAW 모두 가장 기본에 두는 것은 감산 신스, 멜로디 샘플러, 드럼 샘플러입니다.
- FM, 웨이브테이블, 물리 모델링은 양쪽에 모두 있지만 고급 악기로 분류됩니다.
- Ableton Simpler는 Classic, One-Shot, Slicing 세 모드를 한 악기에 담고 있습니다.

## 4. 두 DAW의 기본 이펙트
| 유형 | Ableton Live | FL Studio | 우리 시드 |
|---|---|---|---|
| EQ | Channel EQ, EQ Eight, EQ Three | Fruity Parametric EQ 2 | EQ 3-Band가 있습니다 |
| 컴프레서 | Compressor, Glue Compressor, Multiband Dynamics | Fruity Compressor, Multiband Compressor | Compressor가 있습니다 |
| 리미터 | Limiter | Fruity Limiter, Emphasis, Maximus | Limiter가 있습니다 |
| 리버브 | Reverb, Hybrid Reverb | Fruity Reeverb 2, LuxeVerb | Reverb가 있습니다 |
| 딜레이 | Delay, Echo, Filter Delay | Fruity Delay 2와 3, Delay Bank | 없습니다. 1단계에 추가합니다 |
| 필터 | Auto Filter | Fruity Filter, Love Philter | 없습니다 |
| 코러스 | Chorus-Ensemble | Fruity Chorus, Hyper Chorus | 없습니다 |
| 페이저, 플랜저 | Phaser-Flanger | Fruity Phaser, Fruity Flanger | 없습니다 |
| 디스토션, 새추레이션 | Saturator, Overdrive, Redux | Fruity WaveShaper, Soft Clipper, Distructor | 없습니다 |
| 게인, 팬, 스테레오 | Utility | Fruity Balance, PanOMatic, Stereo Enhancer | Gain / Utility가 있습니다 |
| 보코더, 피치 | Vocoder, Shifter, Auto Shift | Fruity Vocoder, Pitcher | 없습니다 |

- 우리 시드 7종은 두 DAW의 가장 기본적인 구성과 잘 맞습니다.
- 가장 큰 공백은 딜레이입니다. 두 DAW 모두 여러 종류를 기본으로 제공합니다.
- Ableton Reverb의 Predelay, Size, Decay, Dry/Wet은 우리 Reverb의 `pre_delay`, `decay`, `mix`와 겹칩니다. Limiter도 Ceiling과 Release가 겹칩니다.

## 5. 결정 현황
| 번호 | 제안 | 결정 | 반영 위치 |
|---|---|---|---|
| 1 | Delay를 1단계에 추가합니다 | ✅ 적용 | §6, §8 |
| 2 | Sampler에 One-Shot 모드를 포함합니다 | ⏸ 보류 | 화면 목업을 확인한 뒤 결정합니다 |
| 3 | 2단계 후보 이펙트를 당겨 오지 않고 단계별 계획을 따릅니다 | ✅ 적용 | §6 |

## 6. 단계별 구성
| 단계 | 악기 | 이펙트 |
|---|---|---|
| 1단계 (이번 작업) | Subtractive Synth, Sampler | EQ 3-Band, Compressor, Reverb, Limiter, Gain / Utility, Delay |
| 2단계 후보 | FM 신스, Drum Rack | Filter, Distortion, Chorus, Phaser / Flanger |
| 이후 | 웨이브테이블, 물리 모델링 | Vocoder, Pitch Shifter |

- 1단계는 트랙 볼륨, 팬, 뮤트, 솔로, 마스터 트랙의 실제 반영도 함께 다룹니다.
- 이후 단계의 Vocoder와 Pitch Shifter는 Web Audio 기본 노드만으로는 어려워서 AudioWorklet이나 WASM이 필요합니다.

## 7. Web Audio 구현 방식 (1단계)
| 플러그인 | 노드 조합 | 난이도 | 비고 |
|---|---|---|---|
| Sampler | `AudioBufferSourceNode`, 음높이는 `playbackRate`, 엔벨로프는 `GainNode` | 하 | 클립 재생과 같은 디코딩 버퍼를 씁니다 |
| Subtractive Synth | 노트마다 `OscillatorNode` 2개, `BiquadFilterNode`, 엔벨로프용 `GainNode`, LFO용 `OscillatorNode` | 중 | 동시 발음 수 관리가 필요합니다 |
| Gain / Utility | `GainNode`, `StereoPannerNode`, 위상 반전은 게인 -1 | 하 | |
| EQ 3-Band | `BiquadFilterNode` 3개 (lowshelf, peaking, highshelf) | 하 | |
| Compressor | `DynamicsCompressorNode`와 메이크업용 `GainNode` | 하 | 스레숄드, 레이시오, 니, 어택, 릴리스가 그대로 대응됩니다 |
| Reverb | `ConvolverNode`와 코드로 만든 임펄스 응답, 프리딜레이용 `DelayNode`, 댐핑용 `BiquadFilterNode`, 드라이/웻 믹스 | 중 | 외부 파일 없이 디케이와 댐핑 값으로 임펄스를 생성합니다 |
| Limiter | `DynamicsCompressorNode`를 레이시오 20, 니 0으로 설정 | 하 | 근사치입니다. 정확한 리미터는 이후 WASM으로 바꿉니다 |
| Delay | `DelayNode`, 피드백용 `GainNode`, 피드백 경로의 `BiquadFilterNode`, 드라이/웻 믹스 | 하 | 템포 동기(박 단위) 시간을 지원합니다 |

- 실시간 재생과 WAV 렌더링이 같은 그래프 생성 코드를 쓰도록, 컨텍스트를 인자로 받는 구조로 만드는 것을 권합니다(`AudioContext`와 `OfflineAudioContext` 모두).

## 8. 후속 작업
| 작업 | 대상 | 상태 |
|---|---|---|
| Delay 시드와 `param_schema` 추가 | `studionx/db/02_phase2_sequencer.sql`, 기존 DB용 `studionx/db/migrations/2026-10-19_plugin_delay.sql` | ✅ 파일 반영 (2026-10-19) |
| DB 문서 갱신 | `docs/DB.md` 변경 이력, `studionx/db/docs/StudioNx_DB_Guide.md` 변경 SQL 표 | ✅ 반영 |
| 계획서 수정 | `docs/Implementation_Plan.md`: S1-11을 S1-11a(재생 오디오 그래프)와 S1-11b(WAV 출력)로 나누고, Delay를 S2-03에서 S1-11a로 옮김 | ✅ 반영 |
| 간트차트 일정 재조정 | S1-11이 1주에서 3주(S1-11a 2주, S1-11b 1주)로 늘어 S1-12 이후 전체 일정을 2주씩 미뤘습니다. v0.1은 2027-02-22, v0.2는 2027-08-02, v1.0은 2027-12-15입니다 | ✅ 반영 (2026-10-19) |
| YouTrack 이슈 | S1-11a를 `StudioNx-77`로 새로 만들고, 기존 S1-11(`StudioNx-34`)은 S1-11b로 이름을 바꿨습니다 | ✅ 반영 (2026-10-19) |
| Sampler One-Shot 모드 | 화면 목업을 확인한 뒤 결정합니다 | ⏸ 보류 |

## 9. 참고 출처
| 출처 | 주소 |
|---|---|
| Ableton Live 12 Instrument Reference | https://www.ableton.com/en/live-manual/12/live-instrument-reference/ |
| Ableton Live 12 Audio Effect Reference | https://www.ableton.com/en/live-manual/12/live-audio-effect-reference/ |
| FL Studio 에디션 비교 | https://www.image-line.com/fl-studio/compare-editions |
| FL Studio 기능 소개 | https://www.image-line.com/fl-studio/features |
