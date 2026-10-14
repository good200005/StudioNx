# JS 104 — `ticksToSeconds()` (tick를 초로 바꾸기)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/audio/timing.js` (새 파일, 소리와 화면을 쓰지 않는 계산 전용 모듈) |
| 작업 | S1-05 오디오 엔진 기초: 첫 번째 함수 (FR-205 시간 단위 tick, PPQ 960) |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-05-audio-engine` (`develop`에서 만듦) |
| 다음 | 곡 중간 템포 변경을 반영한 변환(`tempo_changes`), 스케줄러, 메트로놈, 루프 순서로 한 함수씩 진행합니다 |

## 1. 하는 일
시간을 **tick**(1박 = 960 tick)으로 관리하고, 소리를 낼 때만 **초**로 바꿉니다. 이 함수는 템포(BPM)가 하나일 때의 변환입니다.

> 초 = tick × 60 ÷ (BPM × 960)

| 입력 | 결과 |
|---|---|
| 960 tick(1박), 120 BPM | 0.5초 |
| 3840 tick(4/4 한 마디), 120 BPM | 2초 |
| 960 tick, 60 BPM | 1초 |
| -960 tick (카운트인처럼 0보다 앞), 120 BPM | -0.5초 |
| BPM이 0 이하, 숫자가 아님, tick이 NaN이나 Infinity | 오류(`RangeError`) |

## 2. 코드
```js
export const PPQ = 960;

export function ticksToSeconds(tick, bpm) {
  if (typeof tick !== 'number' || !isFinite(tick)) throw new RangeError('tick 은 유한한 숫자여야 합니다: ' + tick);
  if (typeof bpm !== 'number' || !isFinite(bpm) || bpm <= 0) throw new RangeError('bpm 은 0 보다 큰 숫자여야 합니다: ' + bpm);
  return (tick * 60) / (bpm * PPQ);
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const ticksToSeconds = (tick, bpm) => {
  if (!Number.isFinite(tick)) throw new RangeError(`tick 은 유한한 숫자여야 합니다: ${tick}`);
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError(`bpm 은 0 보다 큰 숫자여야 합니다: ${bpm}`);
  return (tick * 60) / (bpm * PPQ);
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `Number.isFinite(x)` | `typeof x !== 'number' \|\| !isFinite(x)` | 숫자이면서 NaN, Infinity가 아닌지 확인합니다. `Number.isFinite`는 문자열을 자동 변환하지 않아서 한 번에 됩니다 |
| 템플릿 문자열 `` `…${x}` `` | `'…' + x` | 글자와 값을 잇습니다 |
| 화살표 함수 | `function` 선언 | 같은 동작입니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 시간은 tick, 소리를 낼 때만 초 | 초로 저장하면 BPM을 바꿀 때 모든 클립의 위치를 다시 계산해야 합니다. tick이면 템포가 바뀌어도 위치가 변하지 않습니다 (DB와 같은 단위) |
| `audio/` 폴더에 DOM과 `AudioContext`를 쓰지 않는 파일로 분리 | 계산만 따로 시험할 수 있습니다. 나중에 오프라인 렌더(WAV 출력, S1-11)에서도 같은 계산을 그대로 씁니다 |
| 잘못된 값은 오류를 던짐 | `NaN`이나 `Infinity`를 조용히 돌려주면 스케줄러가 엉뚱한 시각에 소리를 냅니다. 바로 알리는 쪽이 원인을 찾기 쉽습니다 |
| BPM의 범위(20~300)는 여기서 검사하지 않음 | 범위는 입력 화면과 저장(FR-202)이 맡고, 이 함수는 계산이 성립하는 조건(0보다 큰 유한한 수)만 봅니다 |
| tick이 음수여도 계산 | 카운트인(FR-203)처럼 0보다 앞의 시간을 쓸 수 있어야 합니다 |

## 4. 시험 (Node에서 직접 실행, 16개 통과)
| 확인 | 결과 |
|---|---|
| 120 BPM 1박 0.5초, 60 BPM 1박 1초, 0 tick 0초, 한 마디 2초 | ✔ |
| 소수 BPM(93.5), 경계 BPM(20은 3초, 300은 0.2초) | ✔ |
| 음수 tick(-960은 -0.5초), `PPQ`가 960 | ✔ |
| BPM이 0, 음수, 문자열, NaN이면 오류 | ✔ |
| tick이 NaN, Infinity, 없음이면 오류 | ✔ |
