# JavaScript 256 — 파라미터 기본값 (`defaultParams` · `withDefaults` · `schemaItem`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 플러그인 기본값으로 파라미터를 온전하게 만듭니다 (FR-244) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 255 값 다듬기와 표시 글 · 257 조작 연결 |

## 1. 하는 일
플러그인 표에는 파라미터마다 기본값이 담긴 스키마가 있습니다. `defaultParams` 는 그 기본값만 모아 params 를 만들고, `withDefaults` 는 서버에 저장된 값 위에 기본값을 깔아 **빠진 키가 없는** params 를 만듭니다. 그래서 나중에 플러그인에 파라미터가 하나 늘어도 저장된 옛 값이 있어 그대로 동작합니다. `schemaItem` 은 키로 스키마 항목 하나를 찾습니다.

```
defaultParams(plugin)          { cutoff: 800, reso: 0.3, ... }   기본값만
withDefaults(plugin, saved)    기본값 위에 saved 를 덮음        빠진 키 없음
```

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `addDevice` (260) | 새 카드를 붙일 때 `defaultParams` 를 보냅니다 |
| `cardHtml` (253) · `wireControls` (258) | 저장 값에 기본값을 깔아 노브 값을 만듭니다 |
| `applyPreset` (261) · `saveDeviceModal` (261) | 프리셋과 저장 뒤 params 를 다시 맞춥니다 |
| `wireControls` (258) | `schemaItem` 으로 노브에 맞는 스키마를 찾습니다 |

## 3. 코드
```js
/** 플러그인의 기본값만 모은 params (붙일 때 · 초기화할 때) */
export function defaultParams(plugin) {
  const out = {};
  const schema = (plugin && plugin.param_schema) || [];
  schema.forEach(function (item) { out[item.key] = item.default; });
  return out;
}

/** 저장된 params 위에 기본값을 깔아 완전한 params 만들기 (빠진 키 채우기) */
export function withDefaults(plugin, saved) {
  const out = defaultParams(plugin);
  if (saved) {
    Object.keys(saved).forEach(function (k) { out[k] = saved[k]; });
  }
  return out;
}

/** 스키마에서 키로 항목 찾기 */
function schemaItem(plugin, key) {
  const schema = (plugin && plugin.param_schema) || [];
  for (let i = 0; i < schema.length; i += 1) {
    if (schema[i].key === key) return schema[i];
  }
  return null;
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `const schema = (plugin && plugin.param_schema) \|\| [];` | 플러그인이 없거나 스키마가 비어도 빈 배열로 시작합니다 |
| `out[item.key] = item.default` | 키 이름 그대로 값을 담습니다 |
| `defaultParams(plugin)` | 기본값을 먼저 깔고 |
| `Object.keys(saved).forEach(...)` | 저장 값이 있으면 그 위에 덮습니다 |
| `schema[i].key === key` | 스키마 항목의 키와 찾는 키를 맞춰 봅니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 기본값을 먼저 깔기 | 옛 카드에 새 파라미터가 없어도 노브가 빈 채로 뜨지 않습니다 |
| 사본을 만들어 반환 | 원본 저장 값(장치 객체)을 건드리지 않습니다 |
| 초기화에도 같은 함수 | Init 버튼이 붙일 때와 같은 값으로 돌아갑니다 |
| `schemaItem` 을 따로 | 같은 스키마 찾기를 여러 곳에서 씁니다 |

## 5. 시험
시험 프로젝트에서 EQ3 를 Init 으로 되돌리면 Low · Mid · High 세 값이 모두 스키마의 `default` 로 돌아오는 것을 확인했습니다. 저장 값에 `low` 하나만 넣고(다른 키 없이) 카드를 그려도 나머지 노브가 기본값으로 채워지는 것도 확인했습니다.
