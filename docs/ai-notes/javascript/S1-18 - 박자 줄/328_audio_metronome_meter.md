# JavaScript 328 — 메트로놈의 박자 변경 (`audio/metronome.js`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/audio/metronome.js` |
| 작업 | S1-18: 메트로놈이 박자 변경점을 따라 강박 위치를 계산 |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 327 박자 줄, 다음 없음 |

## 1. 하는 일

`Metronome`에 박자 변경점 목록을 넣을 수 있게 했습니다. 어느 tick에서 쓸 박자는 그 tick 이전에 마지막으로 시작한 구간이 정하고, 마디는 그 구간의 시작부터 셉니다.

| 메서드 | 하는 일 |
|---|---|
| `setMeterChanges(list)` | `{tick, num, den}` 목록을 검사하고 tick 순으로 정렬해 저장합니다. |
| `meterAt(tick)` | tick에서 쓰는 구간을 돌려줍니다. 없으면 처음 박자입니다. |
| `step(tick, time)` | `metronomeClick(tick - seg.tick, seg.num, seg.den)`으로 강박 여부를 정합니다. |

## 2. 확인

3840 tick에서 3/4가 시작하면 강박은 3박마다 옵니다 (`[강,약,약,강,약,약,강]`). 3839 tick은 4/4, 3840 tick은 3/4 구간입니다.

## 3. 한계

화면의 메트로놈 버튼은 아직 엔진에 연결되지 않아(`options.metronome`은 알림만 띄움) 실제 소리로는 확인하지 못했습니다. 계산만 Node에서 확인했습니다. `sequencer-meter.js`의 목록을 `setMeterChanges`에 넘기는 연결은 메트로놈을 화면에 붙일 때 함께 합니다.
