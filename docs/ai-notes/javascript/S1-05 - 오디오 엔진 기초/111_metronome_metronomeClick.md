# JS 111 — `metronomeClick()` (메트로놈 박·강박 판정)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/audio/metronome.js` (새 파일, 소리를 쓰지 않는 순수 계산) |
| 작업 | S1-05 오디오 엔진 기초: 여덟 번째 함수 (FR-203 메트로놈) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-05-audio-engine` |
| 다음 | 메트로놈 클래스(on/off·클릭 소리·카운트인 연결), 그다음 루프 |

## 1. 하는 일
어떤 tick이 메트로놈 박에 놓이는지, 그중 마디 첫 박(강박)인지 판정합니다. 스케줄러(`Transport`)가 `onStep(tick, time)`으로 넘겨준 단계마다 이 함수를 불러, `null`이 아니면 클릭 소리를 냅니다.

박 길이는 **박자 분모(den)** 로 정합니다. 4/4는 4분음표(960 tick), 6/8은 8분음표(480 tick)입니다.

| 입력 (tick, 분자, 분모) | 결과 |
|---|---|
| 0, 4, 4 | `{beatIndex:0, accent:true}` (강박) |
| 960, 4, 4 | `{beatIndex:1, accent:false}` |
| 240, 4, 4 | `null` (박 사이) |
| 480, 6, 8 | `{beatIndex:1, accent:false}` |
| −3840, 4, 4 | `{beatIndex:0, accent:true}` (카운트인 마디 첫 박) |

## 2. 코드
```js
import { PPQ } from './timing.js';

export const TIME_SIG_DEN_VALUES = [1, 2, 4, 8, 16, 32];

export function metronomeClick(tick, timeSigNum, timeSigDen) {
  if (typeof tick !== 'number' || !isFinite(tick)) throw new RangeError('tick 은 유한한 숫자여야 합니다: ' + tick);
  if (!Number.isInteger(timeSigNum) || timeSigNum < 1 || timeSigNum > 32) throw new RangeError('timeSigNum 은 1~32 정수여야 합니다: ' + timeSigNum);
  if (TIME_SIG_DEN_VALUES.indexOf(timeSigDen) === -1) throw new RangeError('timeSigDen 은 1,2,4,8,16,32 중 하나여야 합니다: ' + timeSigDen);

  const beatTicks = (PPQ * 4) / timeSigDen;
  const measureTicks = beatTicks * timeSigNum;

  let offset = tick % measureTicks;
  if (offset < 0) offset += measureTicks;
  if (Math.abs(offset % beatTicks) > 1e-9) return null;

  const beatIndex = Math.round(offset / beatTicks);
  return { beatIndex: beatIndex, accent: beatIndex === 0 };
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const metronomeClick = (tick, timeSigNum, timeSigDen) => {
  const beatTicks = (PPQ * 4) / timeSigDen;
  const measureTicks = beatTicks * timeSigNum;
  const offset = ((tick % measureTicks) + measureTicks) % measureTicks;
  if (offset % beatTicks !== 0) return null;
  const beatIndex = Math.round(offset / beatTicks);
  return { beatIndex, accent: beatIndex === 0 };
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `((x % m) + m) % m` | `let offset = …; if (offset < 0) offset += m;` | 음수도 0 이상으로 만드는 나머지입니다 |
| `{ beatIndex, accent }` (속기) | `{ beatIndex: beatIndex, accent: … }` | 이름이 같은 변수를 그대로 담습니다 |
| `TIME_SIG_DEN_VALUES.includes(x)` | `indexOf(x) === -1` | 배열에 값이 있는지 봅니다(전통 문법) |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 소리와 분리한 순수 함수 | 클릭 소리를 내지 않고도 박·강박 판정을 Node로 시험합니다. 소리는 다음 함수에서 `AudioContext` 노드로 냅니다 |
| 박 길이를 분모로 정함 | 6/8은 8분음표가 박이라 분모 8이 자연스럽습니다. 강박(마디 첫 박)이 6/8에서도 첫 8분음표에 옵니다 |
| 음수 tick도 마디 격자로 | 카운트인(FR-203, 1마디)은 0보다 앞에서 울립니다. −마디길이도 강박이 되어 카운트인이 한 마디로 들립니다 |
| `1e-9` 허용 오차 | `%` 계산에 아주 작은 소수 오차가 날 수 있어, 박 위인지 확인할 때 아주 작은 여유를 둡니다. 소수 tick(격자 아님)은 `null` |
| `Number.isInteger` 로 분자 검사 | 분자는 정수만 뜻이 있습니다(1~32). `DB.md` 의 CHECK 와 같은 범위입니다 |
| `round` 로 박 번호 | 부동소수 오차가 있어도 0~분자−1 의 정수 박 번호가 나옵니다 |
| 단계가 박보다 촘촘해야 함 | 스케줄러 단계(`stepTicks`)가 박 길이보다 크면 일부 박을 건너뜁니다. 기본 1/16(240)은 분모 16까지(240 tick) 덮습니다 |

## 4. 시험 (Node에서 직접 실행, 35개 통과)
| 확인 | 결과 |
|---|---|
| 4/4 강박·1~3박·다음 마디, 박 사이 null | ✔ |
| 3/4, 6/8, 7/8, 2/2, 1/4(매 박 강박) | ✔ |
| 음수 tick(카운트인 −3840 강박, −960=3박, −240 null) | ✔ |
| 소수 tick(100.5)은 null | ✔ |
| 분자·분모 오류(NaN·0·33·1.5·분모 3·0) 시 `RangeError` | ✔ |
| `TIME_SIG_DEN_VALUES` 가 [1,2,4,8,16,32] | ✔ |
