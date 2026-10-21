# AI 구현 문서 85 — S1-11c: Sampler MIDI 연주 (FR-241, FR-242)

| 항목 | 내용 |
|---|---|
| 작업 | S1-11c Sampler MIDI 연주: 샘플 고르기, Classic과 One-Shot 모드, MIDI 노트로 샘플 재생 |
| 작성 | Claude (AI), 2026-10-21, 사용자 검토 |
| 기반 | S1-11b 병합(develop, PR #89), 결정 문서 `docs/Default_Instruments_Effects.md`, 화면 목업 `docs/page_mockups/sampler/` |
| 프런트 | `audio/sampler.js`와 `pages/sequencer-sampler.js`(신규), 그리고 `instruments.js`, `session.js`, `offline.js`, `sequencer-devices.js`, `studio.css`의 변경 |
| 백엔드 | `schemas/plugin.py`의 `ParamSchemaItem`에 `type: "sample"`, `display`, 옵션의 `hint` 추가 |
| DB | `sampler` 플러그인의 `param_schema`에 `sample_id`와 `mode` 추가 (표 구조 변경 없음, 마이그레이션 `2026-10-21_sampler_sample_mode.sql`) |
| 함수 문서 | JS 301 ~ 304 (4건) |
| 시험 | `docs/handoff/s1-11c_tests/`의 시험 3개, 합 106건 통과 (기존 S1-11a, S1-11b 12개 시험과 백엔드 1083건도 그대로 통과) |
| 이전 문서 | [84_s1-11b_wav_export.md](84_s1-11b_wav_export.md), [82_s1-11a_audio_graph.md](82_s1-11a_audio_graph.md) |

---

## 1. 실행 결과

이 작업 전에는 Sampler가 오디오 클립용이었고, MIDI 노트를 쳐도 소리가 나지 않았습니다. 어떤 샘플을 울릴지 고르는 칸이 없었기 때문입니다. 이제 샘플을 고르면 MIDI 노트로 연주할 수 있고, 재생과 WAV 내보내기에 똑같이 들어갑니다.

| 확인한 장면 | 결과 |
|---|---|
| 샘플을 고르지 않은 Sampler 카드 | 이름 아래에 "No sample chosen. Notes make no sound." 경고가 나오고 카드 테두리가 점선입니다. 이 상태로 재생하면 소리가 없습니다. |
| 상세 창 | Sample 줄(이름, 길이, 샘플레이트, 채널, Change… 버튼, 파형, Root 표시)과 Mode 줄(Classic, One-Shot 버튼과 설명)이 있습니다. |
| 샘플 고르기 | Change…를 누르면 라이브러리 목록이 열리고, 이름으로 검색하며, ▶로 미리 듣고, 고르면 반영됩니다. 브라우저의 샘플을 파형 위로 끌어 놓아도 됩니다. |
| One-Shot | Loop, Sustain, Release 칸이 흐려지고, 노트가 반 박(0.5초)뿐이어도 2초짜리 샘플이 끝까지 울립니다. |
| Classic | 노트가 끝나고 Release가 지나면 조용합니다. Loop를 켜면 샘플보다 긴 노트에서도 소리가 이어집니다. |
| WAV 내보내기 | 재생과 같은 소리가 파일에 들어갑니다. One-Shot의 끝까지 울리는 꼬리도 그대로입니다. |

스크린샷은 `docs/screenshots/2026-10-21_s1-11c_sampler/`에 7장 있습니다.

## 2. 무엇을 만들었나

```text
DB     plugins.param_schema (sampler)   sample_id, mode 항목 추가
백엔드  schemas/plugin.py                 항목 type 에 "sample", display, 옵션 hint 를 허용
소리    audio/sampler.js                  playSamplerNote, samplerRate, samplerSampleIds       (301)
       audio/instruments.js              PLAYABLE_CODES 에 sampler, getBuffer 로 샘플을 찾아 울림  (302)
       audio/session.js, offline.js      Sampler 가 쓰는 샘플도 미리 디코딩                    (302)
화면    pages/sequencer-sampler.js        Sample 줄, 고르기 창, 파형, 미리 듣기, 끌어 놓기         (303)
       pages/sequencer-devices.js        카드 부제와 경고, Mode 버튼 줄, 무시되는 칸 표시          (304)
```

| 파일 | 내용 | 문서 |
|---|---|---|
| `audio/sampler.js` | 노트 하나를 샘플로 울리는 그래프와 계산 함수 | 301 |
| `audio/instruments.js`, `session.js`, `offline.js` | 악기 층의 Sampler 처리와 샘플 미리 불러오기 | 302 |
| `pages/sequencer-sampler.js` | 샘플 고르는 화면 부품 | 303 |
| `pages/sequencer-devices.js`, `studio.css` | 카드와 상세 창의 연결, 스타일 | 304 |
| `studionx/db/02_phase2_sequencer.sql`, `migrations/2026-10-21_sampler_sample_mode.sql` | 새 DB용 시드와 기존 DB용 변경 SQL | 이 문서 §4 |

## 3. 요구사항 대응

| 요구사항 | 내용 | 어디서 |
|---|---|---|
| FR-241 | 플러그인은 `plugins` 표의 정의로 화면이 자동 생성됩니다. 새 항목 종류(`sample`, `segment`)도 스키마로 표현합니다. | 303, 304, 백엔드 `plugin.py` |
| FR-242 | Sampler(샘플 1개를 음정별로 재생): Root, Tune으로 음높이를 맞춰 재생하고, One-Shot 모드를 더했습니다. | 301, 302 |

## 4. 왜 이렇게 (이번 작업의 결정)

| 결정 | 이유 |
|---|---|
| 한 Sampler에 샘플을 하나만 붙입니다 | 목업에서 정한 방식입니다. 건반마다 다른 샘플을 쓰는 것은 Drum Rack(S3-12)의 일입니다. Sampler는 샘플 하나를 음높이로 연주하는 악기로 둡니다. |
| 모드를 둡니다 (Classic, One-Shot) | 멜로디(건반으로 음높이를 바꿔 침)와 드럼(한 번 치면 끝까지 울림)은 노트 길이를 다루는 방식이 다릅니다. 결정 문서에서 사용자가 확정했습니다. |
| One-Shot은 Attack과 Decay를 남깁니다 | Sustain과 Release는 노트 길이에 의존하므로 무시합니다. Decay는 드럼의 꼬리를 줄이는 데 쓰이므로 "0까지 줄이는 시간"으로 해석했습니다. 이 해석은 결정 문서에 없던 세부 사항이라 문서에 적어 둡니다. |
| 같은 샘플을 연속으로 치면 겹쳐 울립니다 | 노트마다 `AudioBufferSourceNode`를 만들어 앞의 소리를 끊지 않습니다. 결정 문서의 권장안입니다. |
| 샘플 번호를 `params`에 둡니다 | 새 표를 만들지 않고 기존 `track_instruments.params`(JSON)에 `sample_id`를 넣습니다. 프리셋, 되돌리기(A/B), 복제가 모두 그대로 동작합니다. 스키마에 `default: null`로 두어 "샘플 없음"을 표현합니다. |
| 샘플을 지워도 악기의 `sample_id`는 지우지 않습니다 | 라이브러리에서 샘플을 지우면 `sample_id`가 가리키는 곳이 사라집니다. 이 경우 화면은 "Sample #번호"로 보이고 소리는 나지 않으며(불러오기 실패는 조용히 건너뜁니다), 다른 샘플을 고르면 됩니다. 샘플을 지울 때 이 악기를 함께 정리하는 일은 이번 작업에서 다루지 않았습니다. |
| 마이그레이션은 `ON DUPLICATE KEY UPDATE`로 갱신합니다 | 이미 트랙에 붙은 Sampler의 `params`는 그대로 두고 정의만 바꿉니다. 키가 빠진 옛 데이터는 `withDefaults`와 `resolveParams`가 기본값으로 채웁니다. 여러 번 실행해도 안전합니다. |
| 새 파일 두 개로 나눕니다 | 소리(`audio/sampler.js`)는 DOM이 없어 Node에서도 시험할 수 있고, 화면(`pages/sequencer-sampler.js`)은 `sequencer-devices.js`가 이미 약 2300줄이라 따로 둡니다. |
| 이 작업을 S1-12 앞에 넣었습니다 | S1-12의 골든 WAV(기준 소리)에 드럼이 처음부터 들어가야 기준을 다시 만들지 않기 때문입니다 (계획서 §2.1). |

## 5. 시험 중에 발견해서 고친 문제

| 문제 | 원인 | 고침 |
|---|---|---|
| 화면 시험 첫 실행에서 4건 실패 | 라이브러리는 샘플 이름에서 확장자를 떼어 보여 주는데, 시험 기대값은 `.wav`가 붙어 있었습니다. 코드는 맞고 시험이 틀렸습니다. | 시험의 기대값을 고쳤습니다. |
| 끌어 놓기 시험에서 칸을 찾지 못함 | 화면이 펼친 트랙을 기억해 두었다가(`restoreOpenPanels`) 새로 열 때 복원합니다. 시험이 펼침 버튼을 무조건 눌러서 오히려 접혔습니다. | 닫혀 있을 때만 누르도록 고쳤습니다. |

시험이 아닌 코드의 오류는 이번에 없었습니다.

## 6. 검증 결과

| 시험 | 건수 | 확인한 것 |
|---|---|---|
| `sampler_unit.mjs` | 39 | 재생 속도, 샘플 번호 모음, 모드별 노드 연결(정지 시각, Loop, 음량, 램프), `PLAYABLE_CODES`와 `InstrumentRack` |
| `render_sampler.mjs` | 28 | 실제 `OfflineAudioContext`로 음높이(440, 880, 220Hz), Release, Attack, Loop, One-Shot, 겹침, 음량, 샘플 없음, Synth와 공존 |
| `ui_sampler.mjs` | 39 | 카드 경고, 상세 창, 고르기 창, 파형, 저장, 재생 소리, 내보내기, 끌어 놓기 |
| 기존 S1-11a(9개), S1-11b(3개) | 12개 시험 전부 통과 | 회귀 없음 |
| 백엔드 `pytest` | 1083 | 통과, `ruff` 통과 |

화면 시험은 시험용 서버(8001), 계정 `s109-tester@example.com`, 프로젝트 14431이 필요합니다. 시험 전용 트랙과 샘플을 만들고 끝나면 지웁니다.

## 7. 알려진 한계

| 한계 | 내용 |
|---|---|
| 샘플이 하나뿐입니다 | 건반마다 다른 샘플(드럼 키트)은 Drum Rack(S3-12)에서 합니다. 지금은 드럼을 칠 때 소리마다 Sampler를 하나씩 붙이고 트랙을 나눠야 합니다. |
| 음높이와 길이가 함께 바뀝니다 | `playbackRate` 방식이라 한 옥타브 위는 속도가 2배가 되어 길이가 절반이 됩니다. 길이를 유지하는 음높이 변환(타임 스트레치)은 지원하지 않습니다. |
| 시작점 지정과 구간 반복이 없습니다 | Loop는 샘플 전체를 되풀이합니다. Start, End, Loop 구간은 이후에 다룹니다. |
| Sampler는 Synth보다 음량 기준이 단순합니다 | `gain × velocity ÷ 127`입니다. 샘플 원본의 크기가 그대로 반영되므로, 크게 녹음된 샘플은 Gain으로 줄여야 합니다. |
| 샘플을 지운 뒤 처리 | 위 결정 표와 같이 소리는 나지 않고 이름만 "Sample #번호"로 보입니다. |
| 샘플 정보가 목록에 없는 경우 | 샘플이 500개를 넘으면(50개 × 10쪽) 뒤쪽 샘플은 이름을 못 찾아 "Sample #번호"로 보입니다. 소리에는 영향이 없습니다. |
| Chrome 헤드리스만 시험했습니다 | Safari와 Firefox의 `AudioBufferSourceNode.loop` 동작은 시험하지 않았습니다. |

## 8. 남은 일과 다음 작업이 쓰는 곳

| 항목 | 내용 |
|---|---|
| 다음 작업 | S1-12 오디오 회귀 테스트 기반. 골든 WAV에 Sampler로 친 드럼 패턴이 처음부터 들어갑니다. `renderOffline`에 `getBuffer`가 이미 연결되어 있어 같은 방식으로 확장하면 됩니다. |
| Drum Rack (S3-12) | `type: "sample"` 칸과 `playSamplerNote`를 패드마다 재사용합니다. |
| 샘플 고르기 | `sequencer-sampler.js`의 고르기 창은 `type: "sample"` 항목이 있는 다른 플러그인에서도 같은 모양으로 나옵니다. |

## 9. 자주 받을 질문 대비 (Q/A)

**Q. Sampler의 소리는 어떻게 MIDI 노트의 음높이를 따라가나요?**
A. 눌린 건반 번호에서 Root 번호를 빼고 Tune을 더한 반음 수를 구해, 2의 (반음 수 ÷ 12) 제곱을 `playbackRate`로 씁니다. 12반음 위면 2배로 빠르게 재생해서 한 옥타브 높은 소리가 납니다 (301).

**Q. Classic과 One-Shot은 어떻게 다른가요?**
A. Classic은 노트 길이만큼 울리고 Release로 끝나며 Loop를 켜면 되풀이합니다. One-Shot은 노트 길이와 Loop, Sustain, Release를 무시하고 샘플 전체를 한 번 울립니다. 드럼처럼 짧은 소리에 씁니다 (301).

**Q. 내보낸 WAV에도 Sampler 소리가 들어가나요?**
A. 들어갑니다. 재생과 내보내기가 같은 `playSamplerNote`를 쓰고, `renderOffline`이 Sampler의 샘플을 미리 디코딩합니다. 시험(`ui_sampler.mjs`)에서 Classic과 One-Shot 모두 재생과 같은 결과가 나오는 것을 확인했습니다 (302).

**Q. 샘플을 고르지 않으면 어떻게 되나요?**
A. 오류 없이 소리만 나지 않습니다. 카드에 경고와 점선 테두리가 나오고, 상세 창에도 같은 경고가 보입니다 (303, 304).

**Q. 기존에 만든 Sampler는 어떻게 되나요?**
A. 그대로 동작합니다. 새 키(`sample_id`, `mode`)가 `params`에 없으면 기본값(샘플 없음, Classic)으로 채워집니다. 마이그레이션은 정의만 바꾸고 `params`는 건드리지 않습니다.

**Q. 새 항목 종류를 화면에 어떻게 추가했나요?**
A. 스키마의 `type`에 `sample`을, 항목에 `display: "segment"`와 옵션에 `hint`를 허용하도록 백엔드 스키마를 넓히고, 화면의 자동 생성(`paramCellHtml`)이 이 값을 보고 그립니다. 플러그인 이름을 화면 코드에 박지 않았습니다 (304).
