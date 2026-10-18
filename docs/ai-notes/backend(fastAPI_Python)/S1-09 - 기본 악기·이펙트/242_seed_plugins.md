# Backend(FastAPI/Python) 242 — 시드 SQL (기본 악기·이펙트 일곱 종)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/db/migrations/2026-10-18_plugins_seed.sql` (같은 내용이 `studionx/db/02_phase2_sequencer.sql` 에도 들어 있습니다) |
| 작업 | S1-09 기본 악기·이펙트: 플러그인 정의 일곱 종을 넣습니다 (PRD 02 FR-241, FR-244, FR-246) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 241 연결선 API · (다음) 78 개요 |

## 1. 하는 일
`plugins` 표에 기본 플러그인 일곱 종을 넣습니다. 악기 둘과 이펙트 다섯입니다. 각 줄에는 화면이 노브와 선택 상자를 그리는 데 필요한 `param_schema`(JSON)가 함께 들어갑니다.

| `code` | 이름 | 종류 | 항목 수 | 나눔(`group`) |
|---|---|---|---|---|
| `synth_sub` | Subtractive Synth | INSTRUMENT | 17 | Osc 1, Osc 2, Filter, Amp Env, LFO |
| `sampler` | Sampler | INSTRUMENT | 8 | Sample, Amp Env |
| `eq3` | EQ | EFFECT | 7 | Low, Mid, High |
| `compressor` | Compressor | EFFECT | 6 | Main |
| `reverb` | Reverb | EFFECT | 4 | Main |
| `gain` | Gain / Utility | EFFECT | 3 | Main |
| `limiter` | Limiter | EFFECT | 2 | Main |

모두 `engine` = `WEBAUDIO`, `version` = `1.0.0`, `is_active` = 1 입니다. 항목 47개 가운데 41개는 종류를 적지 않아 `knob`(돌리는 노브)이 되고, 선택 상자 4개와 켜기/끄기 2개만 종류를 적었습니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| 처음 DB 를 만들 때 | `studionx/db/02_phase2_sequencer.sql` 에 같은 `INSERT` 가 들어 있어 따로 실행하지 않습니다 |
| 이미 쓰던 DB | 이 파일을 실행해 일곱 종을 넣거나 갱신합니다 (예: 정의를 고쳤을 때) |
| 시험 | `tests/test_plugin_routes.py` 가 `synth_sub`·`eq3` 를 골라 읽습니다 |
| 화면 | `GET /plugins` 가 이 표를 읽어 악기/이펙트 고르기 목록을 만듭니다 |

## 3. 코드
```sql
INSERT INTO plugins (code, name, plugin_type, engine, version, param_schema, card_asset, is_active)
VALUES
('synth_sub', 'Subtractive Synth', 'INSTRUMENT', 'WEBAUDIO', '1.0.0',
 '[{"key":"osc1_wave","name":"Wave","type":"select","group":"Osc 1","default":"saw",
    "options":[{"value":"sine","label":"Sine"}, ...]},
   {"key":"cutoff","name":"Cutoff","group":"Filter","min":20,"max":20000,"default":1200,
    "unit":"Hz","step":1,"curve":"log","primary":true}, ...]',
 NULL, 1),
('sampler', 'Sampler', 'INSTRUMENT', 'WEBAUDIO', '1.0.0', '[ ... ]', NULL, 1),
('eq3', 'EQ', 'EFFECT', 'WEBAUDIO', '1.0.0', '[ ... ]', NULL, 1),
('compressor', 'Compressor', 'EFFECT', 'WEBAUDIO', '1.0.0', '[ ... ]', NULL, 1),
('reverb', 'Reverb', 'EFFECT', 'WEBAUDIO', '1.0.0', '[ ... ]', NULL, 1),
('gain', 'Gain / Utility', 'EFFECT', 'WEBAUDIO', '1.0.0', '[ ... ]', NULL, 1),
('limiter', 'Limiter', 'EFFECT', 'WEBAUDIO', '1.0.0', '[ ... ]', NULL, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  plugin_type = VALUES(plugin_type),
  engine = VALUES(engine),
  version = VALUES(version),
  param_schema = VALUES(param_schema),
  card_asset = VALUES(card_asset),
  is_active = VALUES(is_active);
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `code` | 플러그인을 가리키는 짧은 이름입니다. `UNIQUE` 라 같은 `code` 로 다시 넣으면 갱신됩니다 |
| `param_schema` | 화면이 노브를 그리는 설계도입니다. `key`(저장 이름), `name`(보이는 이름), `min`·`max`·`default`·`step`, `unit`, `type`, `group`, `curve`, `primary`, `options` 를 담습니다 |
| `"type":"select"` | 고르는 상자입니다. `options` 의 `value`·`label` 을 씁니다 |
| `"type":"toggle"` | 켜기/끄기 단추입니다. 값을 적지 않으면 `knob` 입니다 (229) |
| `"curve":"log"` | 소리에서 자주 쓰는 로그 눈금입니다. `Cutoff` 처럼 넓은 범위에 씁니다 |
| `"primary":true` | 카드 앞면에 크게 보여 줄 주요 노브입니다 |
| `card_asset` = NULL | 카드 그림은 화면(CSS)이 그립니다. 그림 파일을 쓰는 플러그인이 생기면 여기에 경로를 넣습니다 |
| `ON DUPLICATE KEY UPDATE` | 같은 `code` 가 있으면 값을 새로 씁니다. 여러 번 실행해도 같은 결과입니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 정의를 코드가 아니라 시드로 | 플러그인은 소리 엔진(`WEBAUDIO`)이 아는 것만 넣을 수 있습니다. 화면에서 만들면 없는 엔진 이름이 들어갑니다 |
| `code` 를 키로 갱신 | 정의를 고칠 때 지우고 다시 넣으면, 그 플러그인을 쓰던 트랙의 악기·이펙트가 함께 지워집니다. 갱신이 안전합니다 |
| 일곱 종으로 시작 | 신시사이저, 샘플러, EQ, 컴프레서, 리버브, 게인, 리미터면 S1-09 화면 검토에 충분합니다. 더 필요한 종류는 나중에 같은 방식으로 넣습니다 |
| `synth_sub` 만 17개 | 소리를 만드는 악기는 조절할 것이 많습니다. 이펙트는 3~7개로 짧게 두어 카드가 복잡해지지 않게 했습니다 |
| 항목 이름을 영어로 | 코드 이름(`cutoff`)과 화면 이름(`Cutoff`)을 그대로 씁니다. 한글 이름은 화면 사전이 붙일 때 바꿉니다 |

## 5. 시험
- `tests/test_plugin_model.py` 가 `param_schema` 를 실제 MySQL 에 넣었다 다시 읽어 같은 사전이 되는지 확인합니다 (JSON 왕복).
- `tests/test_plugin_routes.py` 가 시드에서 `synth_sub`·`eq3` 를 고유 `code` 로 만들어 읽고, `param_schema` 가 비어 있지 않은지 확인합니다.
- 시드 파일을 두 번 실행해도 오류가 나지 않습니다(`ON DUPLICATE KEY UPDATE`).
