# JavaScript 255 — 값 다듬기와 표시 글 (`clampValue` · `normOf` · `valueOfNorm` · `knobAngle` · `fmtValue` · `fmtDb` · `volPct` · `faderY` · `panDeg` · `numOr` · `selectLabel`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 파라미터 값을 범위에 맞추고 화면에 쓸 글과 자리를 만듭니다 (FR-244 · FR-2187) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 254 믹서 칸과 아래 믹서 줄 · 256 파라미터 기본값 |

## 1. 하는 일
노브와 페이더는 값을 그대로 쓰지 않고 세 단계를 거칩니다. 첫째, 값이 범위를 벗어나지 않게 다듬고(`clampValue`) step 에 맞춥니다. 둘째, 노브를 돌리기 쉽도록 값을 0~1 자리로 바꾸거나(`normOf`) 되돌립니다(`valueOfNorm`). 셋째, 화면에 쓸 글을 만듭니다(`fmtValue`). 소리가 로그 곡선을 쓰는 파라미터는 같은 자리 이동에도 값이 곱셈으로 바뀝니다. 나머지 함수들은 dB 글, 막대 길이, 손잡이 위치, 팬 각도처럼 화면 자리를 만드는 작은 도우미입니다.

| 함수 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `clampValue` | 범위 안으로 자르고 step 에 맞춤 | 모든 값 저장 |
| `normOf` | 값 → 0~1 자리 | 끌기 시작, 노브 각도 |
| `valueOfNorm` | 0~1 자리 → 값 | 끌기, 휠, 키 |
| `knobAngle` | 값 → 노브 각도 | 카드 노브 |
| `fmtValue` | 값 → 글 (`-20.0 dB`, `On`, `Low`) | 노브 값, 안내 |
| `fmtDb` | dB 글 (`+3.0 dB`) | 페이더, 겹 볼륨 |
| `volPct` | dB → 막대 길이 % | 겹 볼륨 막대 |
| `faderY` | dB → 손잡이 위치 % | 세로 페이더 |
| `panDeg` | 팬(-1~1) → 각도 | 팬 노브 |
| `numOr` | 값이 없으면 대체 값 | 카드 aria |

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `setControlValue` (257) · `onControlMove` (257) | 값을 다듬고 자리를 오갈 때 씁니다 |
| `cardHtml` (253) · `paintKnob` (258) · `buildStrip` (254) | 글과 자리를 만들 때 씁니다 |

## 3. 코드
```js
/** 값 범위 안으로 다듬고 step 에 맞추기 (step 0 = 자유) */
export function clampValue(item, v) {
  const min = item && item.min != null ? item.min : 0;
  const max = item && item.max != null ? item.max : 1;
  let out = Math.min(max, Math.max(min, Number(v)));
  const step = item && item.step ? item.step : 0;
  if (step > 0) out = Math.round(out / step) * step;
  return Number(out.toFixed(4)) || 0;
}

/** 값 → 0~1 자리 (log 곡선이면 로그 자리) */
export function normOf(item, v) {
  const min = item && item.min != null ? item.min : 0;
  const max = item && item.max != null ? item.max : 1;
  if (item && item.curve === 'log' && min > 0 && max > min) {
    return Math.log(Number(v) / min) / Math.log(max / min);
  }
  return (Number(v) - min) / ((max - min) || 1);
}

/** 0~1 자리 → 값 */
export function valueOfNorm(item, n) {
  const min = item && item.min != null ? item.min : 0;
  const max = item && item.max != null ? item.max : 1;
  const k = Math.min(1, Math.max(0, n));
  if (item && item.curve === 'log' && min > 0 && max > min) {
    return clampValue(item, min * Math.pow(max / min, k));
  }
  return clampValue(item, min + k * (max - min));
}

/** 값 → 노브 각도 (가운데 0, 좌우 KNOB_SWEEP) */
export function knobAngle(item, v) {
  return Math.round((normOf(item, v) * 2 - 1) * KNOB_SWEEP);
}

/** 값 → 화면에 쓸 글 (단위 · 소수 자리) */
export function fmtValue(item, v) {
  if (!item) return String(v);
  if (item.type === 'toggle') return v ? 'On' : 'Off';
  if (item.type === 'select') return selectLabel(item, v);
  const step = item.step ? item.step : 0;
  const dec = step >= 1 ? 0 : (step >= 0.1 ? 1 : (step >= 0.01 ? 2 : 3));
  const unit = item.unit ? (item.unit === '%' ? ' %' : ' ' + item.unit) : '';
  return Number(v).toFixed(dec) + unit;
}

/** dB 글자 */
function fmtDb(db) {
  const v = Number(db) || 0;
  return (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
}

/** 겹 볼륨 막대 길이(%) — -60 dB = 0%, +6 dB = 100% */
function volPct(db) {
  return Math.round(((Math.min(6, Math.max(-60, Number(db) || 0)) + 60) / 66) * 100);
}

/** 페이더 손잡이 위치(%) — +6 dB = 0%(위), -60 dB = 100%(아래) */
function faderY(db) {
  return Math.round(((6 - Math.min(6, Math.max(-60, Number(db) || 0))) / 66) * 100);
}

/** 팬(-1 ~ 1) → 각도 */
function panDeg(v) {
  return Math.round(Math.min(1, Math.max(-1, Number(v) || 0)) * KNOB_SWEEP);
}

/** 값에서 쓸 수 있는 숫자 */
function numOr(v, fallback) {
  return v == null ? fallback : Number(v);
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `item.min != null ? item.min : 0` | 값이 없을 때와 0 일 때를 갈라 봅니다 |
| `Math.min(max, Math.max(min, ...))` | 위아래 한계 안으로 가둡니다 |
| `Math.round(out / step) * step` | step 배수로 맞춥니다 |
| `Number(out.toFixed(4))` | 부동소수점 찌꺼기를 지웁니다 |
| `item.curve === 'log'` | 로그 곡선 파라미터인지 봅니다 |
| `Math.log(v / min) / Math.log(max / min)` | 로그 자리로 바꿉니다 |
| `min * Math.pow(max / min, k)` | 로그 자리에서 값으로 되돌립니다 |
| `normOf(...) * 2 - 1` | 0~1 을 -1~1 로 바꿔 좌우 각도를 만듭니다 |
| `toFixed(dec)` | step 크기에 따라 소수 자리를 정합니다 |
| `item.unit === '%'` | 퍼센트는 앞에 띄어쓰기를 넣습니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 자리(0~1)를 거쳐 바꿈 | 끌기 · 휠 · 키가 모두 같은 계산을 쓰게 됩니다 |
| 로그 곡선 | 소리 크기와 주파수는 사람이 로그로 느낍니다 |
| 자유 파라미터는 step 0 | step 이 없으면 값을 그대로 둡니다 |
| `toFixed(4)` | 0.1 을 더할 때 생기는 `0.30000000000000004` 를 막습니다 |
| dB 표시를 따로 | 페이더 눈금은 파라미터 스키마 밖의 고정 범위(-60 ~ +6)입니다 |

## 5. 시험
노브 드래그 시험에서 `aria-valuenow` 가 `-20` 에서 `0` 으로 바뀌고 값 글자가 `-20.0 dB` 로 함께 바뀌는 것을 확인했습니다. dB 를 +6 으로 두면 페이더 손잡이 위치가 0%(맨 위), -60 으로 두면 100%(맨 아래)가 되는 것도 확인했습니다.
