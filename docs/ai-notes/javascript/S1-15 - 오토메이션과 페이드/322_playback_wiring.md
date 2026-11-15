# JavaScript 322 — 오토메이션과 페이드를 재생에 연결하기 (`audio/session.js` 외)

| 항목 | 내용 |
|---|---|
| 파일 | `audio/session.js`, `audio/playback.js`, `audio/mixer.js`, `audio/effect_rack.js`, `pages/sequencer.js`, `pages/sequencer-audio.js`, `pages/sequencer-automation.js`, `pages/sequencer-devices.js` |
| 작업 | S1-15 오토메이션과 페이드: 319~321의 계산과 화면을 불러오기, 재생, 저장에 연결 |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 321 클립 페이드 편집, 다음 개요 91 |

## 1. 하는 일

앞선 세 문서는 각자 따로 동작하는 부품입니다. 이 문서는 부품이 서로 이어지는 지점을 정리합니다.

```text
불러오기  loadProject → setLanes(data.automation) → syncFades()
편집      점 변화 → onAutomationChange → 400ms 뒤 PUT /tracks/{id}/automation
          페이드 핸들 → save → PATCH /clips/{id}
재생      PlaybackSession (getAutomation: getLanes)
            매 tick  overlayTracks → mixer.applyTracks
                     overlayItems → effects / instruments 동기화
            클립 예약  collectAudioClips의 fade_* → fadePoints → gain 곡선
```

## 2. 연결 지점

| 파일 | 변경 | 설명 |
|---|---|---|
| `pages/sequencer.js` | `setLanes`, `syncFades`, `initFades`, `onAutomationChange` 호출 | 불러온 뒤 레인과 페이드를 채우고, 오토메이션 모드를 켜면 `buildLanes`를 부릅니다. 점이 바뀌면 `onAutomationChange`로 저장을 예약하고 변경 기록(`handleChange`)에도 올립니다. |
| `pages/sequencer-audio.js` | `fadeOf`, `collectAudioClips`, `getAutomation: getLanes` | 재생에 넘기는 오디오 클립에 `fade_in_tick`, `fade_out_tick`, 두 곡선을 더하고, 재생 세션이 레인을 읽게 합니다. |
| `pages/sequencer-automation.js` | `renderAutomation(clip)` 내보내기 | 320이 만든 곡선 클립을 그릴 때 씁니다. |
| `audio/session.js` | `_lanes`, `_tracks(tick)`, 이펙트와 악기 읽기 함수 감싸기 | 재생 중일 때만 오토메이션 값을 덮어씁니다. 멈추면 원래 값으로 돌아갑니다. |
| `audio/playback.js` | `fadePoints`로 클립 음량 예약 | 기본 음량(`gain_db`)에 페이드 배율을 곱하고, 점 사이를 `linearRampToValueAtTime`으로 잇습니다. |
| `audio/mixer.js`, `audio/effect_rack.js` | 병렬 이펙트 묶음 | 아래 3절에서 따로 설명합니다. |
| `pages/sequencer-devices.js` | 병렬 버튼, 믹서 슬라이더 연결 수정 | 아래 3절에서 따로 설명합니다. |

### 2.1 재생 중에만 덮어쓰는 이유

```javascript
_lanes() {
  return this.deps.getAutomation ? this.deps.getAutomation() : [];
}

_tracks(tick) {
  const tracks = this.deps.getTracks();
  return this.playing ? overlayTracks(tracks, this._lanes(), tick) : tracks;
}
```

덮어쓰기는 복사본을 만들어 쓰므로 원본(사용자가 정한 값)은 바뀌지 않습니다. 정지 상태에서는 원본을 그대로 써서 슬라이더가 사용자가 둔 위치를 보여 줍니다.

### 2.2 페이드 예약

```javascript
const pts = fadePoints(clip, Math.max(clip.start_tick, nowTick), clip.start_tick + clip.length_tick);
if (pts.length) {
  const t0 = pts[0][0];
  const toSecFrom = function (t) {
    return ticksToSecondsWithChanges(t, baseBpm, changes) - ticksToSecondsWithChanges(t0, baseBpm, changes);
  };
  gain.gain.setValueAtTime(base * pts[0][1], when);
  for (let i = 1; i < pts.length; i++) gain.gain.linearRampToValueAtTime(base * pts[i][1], when + toSecFrom(pts[i][0]));
}
```

페이드가 없으면 `fadePoints`가 빈 배열을 돌려주어 기존 경로(고정 음량)를 그대로 씁니다. 재생을 클립 중간에서 시작하면 `nowTick`부터의 배율로 시작하므로 페이드 한가운데에서도 소리가 튀지 않습니다. tick 간격은 템포 변경을 반영한 초로 바꾸어, 템포가 달라져도 페이드 길이가 맞습니다.

## 3. 같은 변경에 들어 있는 병렬 이펙트

S1-15 작업 중 이펙트 랙에 "병렬" 기능이 함께 들어갔습니다. 이펙트 카드의 `∥` 버튼을 누르면 그 이펙트가 앞 이펙트와 같은 입력을 받고, 출력은 합쳐집니다.

| 항목 | 설명 |
|---|---|
| 저장 | `params.__parallel`에 켜짐 여부를 둡니다 (`toggleParallel`이 `updateDevice`로 저장). |
| 묶기 | `effect_rack.js`가 `__parallel`인 이펙트를 앞 이펙트와 한 묶음으로 만들고, 묶음 모양을 문자열로 만들어 바뀐 경우에만 다시 연결합니다. |
| 연결 | `mixer.js`가 묶음이 둘 이상이면 입력을 나누고 `GainNode`에서 출력을 합칩니다. |
| 화면 | 이펙트 카드에 `.sq-fx__par` 버튼이 보이고, `aria-pressed`로 상태를 알립니다. |

같은 변경에서 믹서 하단 슬라이더가 움직이지 않던 문제도 고쳤습니다. `buildStrip`이 `wireControls`를 부르고, 더블클릭하면 볼륨과 팬을 0으로 되돌립니다.

## 4. 같은 변경 묶음에 있는 그 밖의 항목

아래는 S1-15와 직접 관련은 없지만 같은 작업 트리에 들어 있습니다. 상세 설명은 이 문서의 범위가 아닙니다.

| 항목 | 위치 |
|---|---|
| 패턴 복제, 이름 바꾸기, 길이, 스윙 명령 | `pages/sequencer.js` |
| 루프 구간 명령과 단축키 (`Ctrl+L`, `Ctrl+Shift+L`) | `pages/sequencer-arrange.js`, `studioNx.html` |
| 피아노 롤 `Ctrl` 끌기 선택 | `pages/sequencer-roll.js` |
| 줌 변화 알림(`sq:zoom`)과 클립 미리보기 다시 그리기 | `pages/sequencer-arrange.js`, `pages/sequencer-devices.js` |

## 5. 알려진 한계

| 한계 | 설명 |
|---|---|
| WAV 내보내기 | 클립 페이드는 재생과 같은 `ClipPlayer`를 쓰므로 처음부터 반영됩니다. 오토메이션은 `renderOffline`에 `getAutomation`을 받아 반영합니다. 레인이 있으면 시간 창을 0.1초로 줄이고(`AUTOMATION_WINDOW_SECONDS`), 창이 바뀔 때마다 `overlayTracks`와 `overlayItems`로 값을 다시 적용합니다. 레인이 없으면 기존 2초 창 그대로입니다. 시험은 `docs/handoff/s1-15_tests/render_automation.mjs`(6건)입니다. |
| 템포와 박자 줄 | 화면 위쪽 템포 줄은 아직 정적 표시이며 편집할 수 없습니다. 별도 작업으로 분리했습니다. |
| 악기 레인 재생 | 이펙트 레인과 같은 방식으로 적용되도록 `overlayItems`를 고쳤지만, 소리로 다시 확인하지는 않았습니다. 내보내기 렌더는 Sampler 노브 레인으로 확인했습니다. |

## 6. 최신 문법으로 쓰면

```javascript
// 전통 문법 (실제 코드)
const lanes = (this.deps.getAutomation && this.deps.getAutomation()) || [];
// 최신 문법
const lanes = this.deps.getAutomation?.() ?? [];

// 전통 문법 (실제 코드)
const base = dbToGain(clip.gain_db || 0);
// 최신 문법
const base = dbToGain(clip.gain_db ?? 0);
```
