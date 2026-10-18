# JavaScript 253 — Nyxi 카드 한 장 (`cardHtml` · `instrumentMixHtml` · `effectExtraHtml`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: Nyxi 카드 한 장을 만듭니다 (FR-2181) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 252 악기 칸과 이펙트 칸 HTML · 254 믹서 칸과 아래 믹서 줄 |

## 1. 하는 일
카드 한 장에는 아트 자리, 이름, 바이패스 버튼(이펙트만), 떼기 버튼(✕), 핵심 파라미터 노브 2~4개, 프리셋 이름이 담깁니다. 악기 카드에는 아래 줄로 겹 볼륨 · 팬 · 솔로가 더 붙고(`instrumentMixHtml`), 이펙트 카드에는 미니 미터가 붙습니다(`effectExtraHtml`). 카드에는 저장 값을 알려 주는 표시 두 개가 붙습니다. `data-device-kind` 는 그 카드가 악기인지 이펙트인지, `data-track-plugin-id` 또는 `data-track-instrument-id` 는 서버 줄 번호입니다. 이 번호는 나중에 값을 저장하거나 떼어낼 때 쓰입니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `instrumentsHtml` (252) · `effectsHtml` (252) | 카드마다 `cardHtml` 을 부릅니다 |
| `wireControls` (258) | `data-device-kind` 와 줄 번호로 장치를 찾습니다 |
| `wireCells` (262) | 카드 안에서 눌린 버튼을 이 표시로 알아봅니다 |

## 3. 코드
```js
export function cardHtml(kind, track, d) {
  const p = pluginById(d.plugin_id);
  const name = p ? p.name : 'Plugin #' + d.plugin_id;
  const values = withDefaults(p, d.params);
  const prim = primaryItems(p);
  const bypassed = kind === 'EFFECT' && d.is_bypassed;
  const idAttr = kind === 'EFFECT'
    ? ' data-track-plugin-id="' + d.track_plugin_id + '"'
    : ' data-track-instrument-id="' + d.track_instrument_id + '"';
  const knobs = prim.map(function (item) {
    return '<span class="sq-knob" role="slider" tabindex="0" data-param-key="' + esc(item.key) + '"'
      + ' aria-label="' + esc(item.name) + '" aria-valuemin="' + numOr(item.min, 0) + '"'
      + ' aria-valuemax="' + numOr(item.max, 1) + '" aria-valuenow="' + numOr(values[item.key], 0) + '">'
      + '<i style="--a:' + knobAngle(item, values[item.key]) + 'deg"></i>'
      + '<span class="sq-knob__val">' + esc(fmtValue(item, values[item.key])) + '</span>'
      + '<span class="sq-knob__name">' + esc(item.name) + '</span></span>';
  }).join('');
  const mix = kind === 'INSTRUMENT' ? instrumentMixHtml(d) : effectExtraHtml();
  return '<li class="sq-fx sq-fx--dev' + (bypassed ? ' is-bypassed' : '') + '" draggable="' + String(kind === 'EFFECT') + '"'
    + ' data-device-kind="' + kind + '"' + idAttr + '>'
    + '<span class="sq-fx__art" aria-hidden="true">' + artHtml(p) + '</span>'
    + '<div class="sq-fx__head"><span class="sq-fx__grip" aria-hidden="true">' + (kind === 'EFFECT' ? '⠿' : '⏻') + '</span>'
    + '<span class="sq-fx__name">' + esc(name) + '</span>'
    + (kind === 'EFFECT'
      ? '<button type="button" class="sq-fx__power" aria-pressed="' + String(!d.is_bypassed) + '" aria-label="Bypass">🎛</button>'
      : '')
    + '<button type="button" class="sq-fx__del" aria-label="Remove ' + (kind === 'EFFECT' ? 'effect' : 'instrument') + '">✕</button></div>'
    + '<div class="sq-knobs">' + knobs + '</div>'
    + '<span class="sq-fx__preset">Preset: ' + esc(d.__preset || 'Init') + '</span>'
    + mix + '</li>';
}

/** 악기 카드 아래 줄 — 겹 볼륨 · 팬 · 솔로 */
function instrumentMixHtml(d) {
  const db = Number(d.volume_db || 0);
  return '<div class="sq-fx__mix">'
    + '<span class="sq-irow__vol sq-num" role="slider" tabindex="0" data-live="layer-volume"'
    + ' aria-label="Layer volume" aria-valuemin="-60" aria-valuemax="6" aria-valuenow="' + db + '">'
    + '<span class="sq-irow__db sq-num">' + fmtDb(db) + '</span><i style="--v:' + volPct(db) + '%"></i></span>'
    + '<span class="sq-irow__pan" role="slider" tabindex="0" data-live="layer-pan" aria-label="Pan" style="--p:' + panDeg(Number(d.pan || 0)) + 'deg"></span>'
    + '<button type="button" class="sq-irow__solo" aria-pressed="' + String(!!d.is_solo) + '" aria-label="Solo layer">S</button></div>';
}

/** 이펙트 카드 아래 줄 — 미니 미터 (엔진이 붙기 전까지 흉내) */
function effectExtraHtml() {
  return '<span class="sq-fx__mini" aria-hidden="true"><i style="--m:38%"></i><i style="--m:26%"></i><i style="--m:12%"></i></span>';
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `idAttr` | 악기와 이펙트가 쓰는 줄 번호 이름이 달라 골라 담습니다 |
| `bypassed ? ' is-bypassed' : ''` | 꺼 둔 이펙트는 흐리게 보이게 합니다 |
| `draggable="' + String(kind === 'EFFECT') + '"` | 이펙트 카드만 끌어 순서를 바꿉니다 |
| `data-param-key` | 노브가 어느 파라미터인지 적어 둡니다 |
| `style="--a:...deg"` | CSS 변수로 노브 각도를 넘깁니다 |
| `(kind === 'EFFECT' ? '...' : '')` | 바이패스 버튼은 이펙트 카드에만 넣습니다 |
| `d.__preset \|\| 'Init'` | 프리셋 이름은 화면에서만 쓰는 값이라 `__` 를 붙였습니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 값을 글자로 만들기 | 카드가 수십 장이라 문자열로 만드는 편이 빠릅니다 |
| 줄 번호를 카드에 적음 | 저장 · 떼기 요청에 그 줄 번호가 필요합니다 |
| 이펙트만 끌 수 있게 | 악기 겹 차례는 소리 결과를 거의 바꾸지 않습니다 (FR-263) |
| 아트 자리를 늘 남김 | 그림이 생기면 CSS 만 바꿔 끼울 수 있습니다 |

## 5. 시험
시험 프로젝트에서 Bass Synth 칸의 이펙트 카드 2장이 `data-track-plugin-id` 를 각각 42 와 39 로 가지고, 악기 카드가 `data-track-instrument-id` 를 가지는 것을 확인했습니다. 노브 값 글자는 `-20.0 dB`, `0 %` 처럼 단위와 함께 나왔습니다.
